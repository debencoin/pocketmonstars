// PocketMonstars game server: static game, Phantom sign-in, Monstar registry + minting, marketplace,
// and the WebSocket 1v1 Stake Duel. Devnet by default.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { CONFIG, DATA_DIR, saveStoredConfig } from './config.mjs';
import { serverKeys } from './keys.mjs';
import { openDb } from './db.mjs';
import { Registry, metadataJson } from './registry.mjs';
import { Auth } from './auth.mjs';
import { SolanaChain } from './escrow.mjs';
import { MatchManager } from './matches.mjs';
import { NftService } from './nft.mjs';
import { Players } from './players.mjs';
import { checkPayment, MEMO_PROGRAM } from './escrow.mjs';
import { SPECIES, HERO_IDS, formName } from '../shared/monstars.mjs';
import { AVATARS, AVATAR_BY_ID } from '../shared/avatars.mjs';
import { STAKE_POLICY, formatSol } from '../shared/stake.mjs';
import { randomBytes } from 'node:crypto';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TICK } from '../shared/sim.mjs';

// Session signing secret: PM_SESSION_SECRET if set (survives redeploys), else one saved in the data folder.
function sessionSecret() {
  if (process.env.PM_SESSION_SECRET) return process.env.PM_SESSION_SECRET;
  const f = path.join(DATA_DIR, 'keys', 'session-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {}
  const s = randomBytes(32).toString('hex'); try { fs.writeFileSync(f, s, { mode: 0o600 }); } catch {} return s;
}
export function createServer({ config = CONFIG, chain = new SolanaChain(config.rpc), dbFile = path.join(DATA_DIR, 'pocketmonstars.db'), keys = serverKeys() } = {}) {
  const db = openDb(dbFile);
  const registry = new Registry(db, { legendaryOwner: config.legendaryOwner, royalOwner: config.royalOwner, gifts: config.gifts }), auth = new Auth({ secret: sessionSecret() });
  const players = new Players(db);
  const matches = new MatchManager({ db, registry, chain, config, players });
  const nft = new NftService({ config, keys, chain });
  const roots = { '/shared/': path.resolve('shared'), '/': path.resolve('dist') };
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };

  const send = (res, code, body) => { const s = JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)); res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(s); };
  const body = req => new Promise((ok, fail) => { let s = ''; req.on('data', c => { s += c; if (s.length > 20000) { fail(Error('Body too large')); req.destroy(); } }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(Error('Invalid JSON')); } }); });
  const walletOf = req => auth.wallet((req.headers.authorization || '').replace(/^Bearer /, ''));
  const need = req => { const w = walletOf(req); if (!w) throw Object.assign(Error('Sign in first.'), { code: 401 }); return w; };
  // SOL actions (minting, market, staking, breeding fees, drop purchases) need a Phantom wallet, not a username account.
  const needWallet = req => { const w = need(req); if (w.startsWith('@')) throw Error('This uses SOL. Sign in with Phantom to do it.'); return w; };
  const isNew = id => !db.prepare('SELECT 1 FROM monstars WHERE origin_owner=? LIMIT 1').get(id);
  const welcome = (id, ref) => { if (isNew(id) && ref) players.setReferrer(id, ref); registry.claimAll(id); return auth.issue(id); };
  const dropMemo = sid => `PMDROP:${sid}`;
  const dropPrice = sid => BigInt(SPECIES[sid].drop.priceLamports);
  const reserved = new Map(); // species -> { wallet, until }: holds a hero for 2 minutes while its buyer pays
  // ---------- profile avatars ----------
  const avatarOwner = a => (a.reservedFor === 'founder' ? config.legendaryOwner : a.reservedFor || players.avatarSale(a.id)?.buyer || null);
  const monstarPic = m => `art/hd/${m.species.art}_s${m.stage.id}.png`;
  function profileOf(id) {
    const owned = AVATARS.filter(a => avatarOwner(a) === id), mons = registry.ownedBy(id), choice = players.avatarChoice(id);
    let avatar = null;
    if (choice?.startsWith('a:') && owned.some(a => a.id === choice.slice(2))) { const a = AVATAR_BY_ID[choice.slice(2)]; avatar = { kind: 'photo', id: a.id, name: a.name, img: a.img, thumb: a.thumb }; }
    if (!avatar && choice?.startsWith('m:')) { const m = mons.find(x => x.serial === Number(choice.slice(2))); if (m) avatar = { kind: 'monstar', serial: m.serial, name: m.toJSON().form || m.species.name, img: monstarPic(m), thumb: monstarPic(m) }; }
    if (!avatar && owned[0]) avatar = { kind: 'photo', id: owned[0].id, name: owned[0].name, img: owned[0].img, thumb: owned[0].thumb };
    if (!avatar && mons.length) { const m = mons.slice().sort((a, b) => b.level - a.level)[0]; avatar = { kind: 'monstar', serial: m.serial, name: m.toJSON().form || m.species.name, img: monstarPic(m), thumb: monstarPic(m) }; }
    return { id, avatar, photos: owned.map(a => ({ id: a.id, name: a.name, img: a.img, thumb: a.thumb })),
      monstars: mons.map(m => ({ serial: m.serial, name: m.toJSON().form || m.species.name, img: monstarPic(m), level: m.level })) };
  }
  const avatarMemo = id => `PMAVATAR:${id}`;
  const listingRow = id => db.prepare('SELECT * FROM listings WHERE id=?').get(Number(id));
  const waitConfirmed = async sig => { for (let i = 0; i < 30; i++) { const s = await chain.status(sig); if (s?.err) throw Error('Transaction failed on-chain.'); if (['confirmed', 'finalized'].includes(s?.confirmationStatus)) return; await new Promise(r => setTimeout(r, 1000)); } throw Error('Not confirmed yet. Try again in a moment.'); };

  const routes = {
    'GET /api/config': () => ({ wildFeeLamports: config.wildFeeLamports.toString(), cluster: config.cluster, treasury: config.treasury, royaltyBps: config.royaltyBps, collection: config.collection,
      marketAuthority: keys.marketAuthority.publicKey.toBase58(), policy: { minStake: STAKE_POLICY.minStake, maxStake: STAKE_POLICY.maxStake, companyFeeLamports: STAKE_POLICY.companyFeeLamports, networkFeeLamports: STAKE_POLICY.networkFeeLamports } }),
    'POST /api/auth/challenge': async req => ({ message: auth.challenge((await body(req)).wallet) }),
    'POST /api/auth/verify': async req => { const b = await body(req); const s = auth.verify(b.wallet, b.signature); return welcome(s.wallet, b.ref); },
    // ---------- username + password accounts (free online play; no SOL) ----------
    'POST /api/account/register': async req => { const b = await body(req); return welcome(players.register(b.username, b.password), b.ref); },
    'POST /api/account/login': async req => { const b = await body(req); return welcome(players.login(b.username, b.password)); },
    'GET /api/referrals/me': req => { const w = need(req); return { code: w, ...players.referralStats(w), bps: 500 }; },
    // ---------- profile + avatars ----------
    'GET /api/profile/me': req => profileOf(need(req)),
    'POST /api/profile/avatar': async req => { const w = need(req), b = await body(req), v = String(b.avatar || '');
      if (v.startsWith('a:')) { const a = AVATAR_BY_ID[v.slice(2)]; if (!a || avatarOwner(a) !== w) throw Error('You do not own that avatar.'); }
      else if (v.startsWith('m:')) { const m = registry.get(Number(v.slice(2))); if (!m || m.owner !== w) throw Error('You do not own that Monstar.'); }
      else throw Error('Pick an avatar.');
      players.setAvatarChoice(w, v); return profileOf(w); },
    'GET /api/avatars': () => ({ avatars: AVATARS.map(a => ({ id: a.id, name: a.name, img: a.img, thumb: a.thumb, note: a.note || '', priceLamports: a.priceLamports,
      owner: avatarOwner(a), forSale: !a.reservedFor && !!a.priceLamports && !players.avatarSale(a.id) })) }),
    'POST /api/avatar/tx': async req => { const w = needWallet(req), b = await body(req), a = AVATAR_BY_ID[String(b.id)];
      if (!a || a.reservedFor || !a.priceLamports) throw Error('That avatar is not for sale.');
      if (players.avatarSale(a.id)) throw Error(a.name + ' is already sold.');
      const { blockhash } = await chain.latestBlockhash(), payer = new PublicKey(w);
      const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(config.treasury), lamports: BigInt(a.priceLamports) }))
        .add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(avatarMemo(a.id)) }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64') }; },
    'POST /api/avatar/confirm': async req => { const w = needWallet(req), b = await body(req), a = AVATAR_BY_ID[String(b.id)];
      if (!a || a.reservedFor || !a.priceLamports) throw Error('That avatar is not for sale.');
      await waitConfirmed(b.signature); await chain.verifyPayment(b.signature, { from: w, to: config.treasury, lamports: BigInt(a.priceLamports), memo: avatarMemo(a.id) });
      const sale = players.avatarSale(a.id); if (sale && sale.signature !== b.signature) throw Error(a.name + ' was already sold. Contact support for a refund: ' + b.signature);
      if (!sale) players.recordAvatarSale(a.id, w, b.signature); players.setAvatarChoice(w, 'a:' + a.id); return profileOf(w); },
    // ---------- Superhero Drop ----------
    'GET /api/drop': () => ({ endsAt: config.dropEndsAt, now: Date.now(), treasury: config.dropTreasury, cluster: config.cluster,
      heroes: HERO_IDS.map(sid => { const sale = players.sale(sid), r = reserved.get(sid);
        return { speciesId: sid, name: SPECIES[sid].name, type: SPECIES[sid].type, top: SPECIES[sid].drop.top, priceLamports: SPECIES[sid].drop.priceLamports,
          sold: !!sale, owner: sale ? registry.get(sale.serial)?.owner || sale.buyer : null, held: !sale && r && r.until > Date.now() }; }) }),
    'POST /api/drop/tx': async req => { const w = needWallet(req), b = await body(req), sid = Number(b.speciesId);
      if (!HERO_IDS.includes(sid)) throw Error('Unknown drop hero.');
      if (Date.now() > config.dropEndsAt) throw Error('The Superhero Drop has ended.');
      if (players.sale(sid)) throw Error(SPECIES[sid].name + ' is already sold.');
      const r = reserved.get(sid); if (r && r.until > Date.now() && r.wallet !== w) throw Error('Someone is buying ' + SPECIES[sid].name + ' right now. Try again in 2 minutes.');
      reserved.set(sid, { wallet: w, until: Date.now() + 120_000 });
      const { blockhash } = await chain.latestBlockhash(), payer = new PublicKey(w);
      const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(config.dropTreasury), lamports: dropPrice(sid) }))
        .add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(dropMemo(sid)) }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), priceSol: formatSol(dropPrice(sid), 2) }; },
    'POST /api/drop/confirm': async req => { const w = needWallet(req), b = await body(req), sid = Number(b.speciesId);
      if (!HERO_IDS.includes(sid)) throw Error('Unknown drop hero.');
      await waitConfirmed(b.signature);
      await chain.verifyPayment(b.signature, { from: w, to: config.dropTreasury, lamports: dropPrice(sid), memo: dropMemo(sid) });
      const sale = players.sale(sid);
      if (sale) { if (sale.signature === b.signature) return registry.get(sale.serial).toJSON(); throw Error(SPECIES[sid].name + ' was already sold. Contact support for a refund with this signature: ' + b.signature); }
      const m = registry.grantHero(w, sid, b.signature); players.recordSale(sid, w, b.signature, m.serial); reserved.delete(sid);
      return m.toJSON(); },
    // Leaderboard: connected wallets ranked by SOL earned in staked matches (final share minus stake), then wins
    'GET /api/leaderboard': () => leaderboard(),
    'GET /api/monstars/mine': req => ({ monstars: registry.ownedBy(need(req)).map(m => m.toJSON()) }),
    'POST /api/mint/prepare': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.'); if (m.asset) throw Error('Already minted.');
      return nft.mintTransaction({ monstar: m, owner: w }); },
    'POST /api/mint/confirm': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      await waitConfirmed(b.signature); const { owner } = await nft.verifyMint({ monstar: m, asset: b.asset });
      registry.bindAsset(m.serial, b.asset, b.signature); return registry.setOwner(m.serial, owner).toJSON(); },
    'POST /api/monstars/sync': async req => { const b = await body(req), m = registry.get(Number(b.serial));
      if (!m?.asset) throw Error('Not minted yet.'); return registry.setOwner(m.serial, await nft.ownerOf(m.asset)).toJSON(); },
    'GET /api/market': () => ({ listings: db.prepare("SELECT * FROM listings WHERE state='active' ORDER BY id DESC LIMIT 200").all()
      .map(l => ({ ...l, monstar: registry.byAsset(l.asset)?.toJSON() || null })) }),
    'POST /api/market/list': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m?.asset) throw Error('Mint this Monstar before listing it.'); const price = BigInt(b.priceLamports);
      if (price < 10_000n) throw Error('Minimum price is 0.00001 SOL.');
      await nft.verifyListable({ asset: m.asset, seller: w });
      db.prepare("UPDATE listings SET state='cancelled', closed_at=? WHERE asset=? AND state='active'").run(Date.now(), m.asset);
      const r = db.prepare("INSERT INTO listings(asset,serial,seller,price,state,created_at) VALUES(?,?,?,?, 'active', ?)").run(m.asset, m.serial, w, price.toString(), Date.now());
      return listingRow(r.lastInsertRowid); },
    'POST /api/market/cancel': async req => { const w = needWallet(req), l = listingRow((await body(req)).id);
      if (!l || l.seller !== w || l.state !== 'active') throw Error('No active listing of yours.');
      db.prepare("UPDATE listings SET state='cancelled', closed_at=? WHERE id=?").run(Date.now(), l.id); return { ok: true }; },
    'POST /api/market/buy': async req => { const w = needWallet(req), l = listingRow((await body(req)).id);
      if (!l || l.state !== 'active') throw Error('Listing is no longer available.'); return nft.buyTransaction({ listing: l, buyer: w }); },
    'POST /api/market/confirm': async req => { const w = needWallet(req), b = await body(req), l = listingRow(b.id);
      if (!l || l.state !== 'active') throw Error('Listing is no longer active.'); await waitConfirmed(b.signature);
      if (await nft.ownerOf(l.asset) !== w) throw Error('Ownership did not change to your wallet.');
      db.prepare("UPDATE listings SET state='sold', buyer=?, signature=?, closed_at=? WHERE id=?").run(w, b.signature, Date.now(), l.id);
      const m = registry.byAsset(l.asset); return m ? registry.setOwner(m.serial, w).toJSON() : { ok: true }; },
    'POST /api/stake/deposit-tx': async req => ({ transaction: await matches.depositTransaction(needWallet(req)) }),
    // ---------- breeding: two players, one Infant each, 0.01 SOL fee per player to the company ----------
    'POST /api/breed/create': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      const code = [...randomBytes(5)].map(x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
      db.prepare("INSERT INTO breeds(code,a,a_serial,state,created_at) VALUES(?,?,?,'open',?)").run(code, w, m.serial, Date.now());
      return breedView(code, w); },
    'POST /api/breed/join': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial)), r = breedRow(b.code);
      if (!r || r.state !== 'open') throw Error('No open breeding request with that code.');
      if (r.a === w) throw Error('Ask another player to join with their Monstar.');
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      db.prepare("UPDATE breeds SET b=?, b_serial=?, state='fees' WHERE code=? AND state='open'").run(w, m.serial, r.code);
      return breedView(r.code, w); },
    'POST /api/breed/status': async req => { const w = need(req), b = await body(req); return breedView(String(b.code || '').toUpperCase(), w); },
    'POST /api/wild/fee-tx': async req => { const w = needWallet(req);
      if (!config.treasury) throw Error('The company fee wallet is not set up yet, so the wild is closed.');
      const { blockhash } = await chain.latestBlockhash();
      const tx = new Transaction({ feePayer: new PublicKey(w), recentBlockhash: blockhash }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(w), toPubkey: new PublicKey(config.treasury), lamports: config.wildFeeLamports }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), feeSol: formatSol(config.wildFeeLamports, 4) }; },
    'POST /api/breed/fee-tx': async req => { const w = needWallet(req), b = await body(req), r = breedRow(b.code);
      if (!r || r.state !== 'fees' || ![r.a, r.b].includes(w)) throw Error('This breeding request is not waiting for your fee.');
      if (!config.treasury) throw Error('The company fee wallet is not set up yet, so breeding is paused.');
      const { blockhash } = await chain.latestBlockhash();
      const tx = new Transaction({ feePayer: new PublicKey(w), recentBlockhash: blockhash }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(w), toPubkey: new PublicKey(config.treasury), lamports: config.breedFeeLamports }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), feeSol: formatSol(config.breedFeeLamports, 4) }; },
    'POST /api/breed/confirm': async req => { const w = needWallet(req), b = await body(req), r = breedRow(b.code);
      if (!r || r.state !== 'fees' || ![r.a, r.b].includes(w)) throw Error('This breeding request is not waiting for your fee.');
      await chain.verifyDeposit(b.signature, { from: w, to: config.treasury, lamports: config.breedFeeLamports });
      db.prepare(`UPDATE breeds SET fee_${r.a === w ? 'a' : 'b'}=? WHERE code=?`).run(b.signature, r.code); // UNIQUE: a fee can't be reused
      const now = breedRow(r.code);
      if (now.fee_a && now.fee_b && now.state === 'fees') {
        const pa = registry.get(now.a_serial), pb = registry.get(now.b_serial);
        if (pa?.owner !== now.a || pb?.owner !== now.b) throw Error('A parent changed owner. Contact support for a refund.');
        const [ca, cb] = registry.breed({ a: pa, b: pb });
        db.prepare("UPDATE breeds SET state='hatched', child_a=?, child_b=? WHERE code=?").run(ca.serial, cb.serial, r.code);
      }
      return breedView(r.code, w); },
  
  };

  let lbCache = null, lbAt = 0;
  function leaderboard() {
    if (lbCache && Date.now() - lbAt < 15_000) return lbCache;
    const rows = db.prepare("SELECT stake, player_a a, player_b b, winner, shares, state FROM matches WHERE player_b IS NOT NULL AND player_b != 'AI' AND state IN ('settled','done','settling','settlement-needs-review')").all();
    const by = new Map(), get = w => by.get(w) || (by.set(w, { wallet: w, net: 0n, earned: 0n, wins: 0, played: 0, staked: 0 }), by.get(w));
    for (const r of rows) {
      let sh = []; try { sh = JSON.parse(r.shares || '[]'); } catch {}
      [r.a, r.b].forEach((w, i) => { if (!w) return; const p = get(w); p.played++; if (r.winner === i) p.wins++;
        const stake = BigInt(r.stake || '0'); if (stake > 0n && sh[i] != null) { const d = BigInt(sh[i]) - stake; p.net += d; if (d > 0n) p.earned += d; p.staked++; } });
    }
    const list = [...by.values()].sort((x, y) => (y.net > x.net ? 1 : y.net < x.net ? -1 : y.wins - x.wins)).slice(0, 50)
      .map((p, i) => ({ rank: i + 1, wallet: p.wallet, net: p.net.toString(), netSol: formatSol(p.net, 6), earnedSol: formatSol(p.earned, 6), wins: p.wins, played: p.played, staked: p.staked }));
    lbAt = Date.now(); return (lbCache = { updatedAt: lbAt, players: list });
  }
  function breedRow(code) { return db.prepare('SELECT * FROM breeds WHERE code=?').get(String(code || '').toUpperCase()); }
  function breedView(code, w) {
    const r = breedRow(code); if (!r || ![r.a, r.b].includes(w) && r.state !== 'open') throw Error('No breeding request with that code.');
    const j = s => (s ? registry.get(s)?.toJSON() : null);
    return { code: r.code, state: r.state, you: r.a === w ? 'a' : 'b', feeSol: formatSol(config.breedFeeLamports, 4),
      parents: [j(r.a_serial), j(r.b_serial)], paid: [!!r.fee_a, !!r.fee_b], children: [j(r.child_a), j(r.child_b)] };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x'), key = req.method + ' ' + url.pathname;
      if (routes[key]) return send(res, 200, await routes[key](req));
      let m;
      if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/meta\/(\d+)\.json$/))) {
        const mon = registry.get(Number(m[1])); if (!mon) return send(res, 404, { error: 'Unknown Monstar' });
        return send(res, 200, metadataJson(mon, config.publicUrl, config.royaltyBps));
      }
      if (req.method === 'GET' && url.pathname === '/api/meta/collection.json') return send(res, 200, { name: 'PocketMonstars', symbol: 'MONSTAR', description: 'One-of-a-kind Monstars. Every DNA is unique.', image: `${config.publicUrl}/art/soloryx.png` });
      if (req.method === 'GET' && (m = url.pathname.match(/^\/api\/monstars\/(\d+)$/))) { const mon = registry.get(Number(m[1])); return mon ? send(res, 200, mon.toJSON()) : send(res, 404, { error: 'Unknown Monstar' }); }
      if (!['GET', 'HEAD'].includes(req.method)) return send(res, 404, { error: 'Not found' });
      if (url.pathname === '/healthz') return send(res, 200, { ok: true, cluster: config.cluster });
      if (url.pathname === '/play/') { res.writeHead(301, { Location: '/play' }); return res.end(); }
      let name = decodeURIComponent(url.pathname);
      if (name === '/' || name === '/play') name = '/index.html'; // the game app opens on its Home tab
      else if (name === '/site') name = '/site.html';              // the older one-page website
      const prefix = name.startsWith('/shared/') ? '/shared/' : '/', root = roots[prefix];
      const file = path.resolve(root, '.' + name.slice(prefix.length - 1));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': name.startsWith('/art/') ? 'public, max-age=604800' : 'no-cache', ...(name === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}), 'X-Content-Type-Options': 'nosniff' });
      req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    } catch (e) { send(res, e.code === 401 ? 401 : 400, { error: e.message || String(e) }); }
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (ws, req) => {
    const wallet = auth.wallet(new URL(req.url, 'http://x').searchParams.get('token'));
    if (!wallet) { ws.close(4001, 'Sign in again'); return; }
    matches.attach(wallet, ws);
    const reply = msg => { try { ws.send(JSON.stringify(msg)); } catch {} };
    { const room = matches.roomOf(wallet); reply(room ? matches.publicRoom(room, wallet) : { t: 'noroom' }); } // lets a reconnecting player resume or reset
    const roomUpdate = room => { matches.attach(wallet, ws); for (const p of room.players) for (const s of p.sockets) { try { s.send(JSON.stringify(matches.publicRoom(room, p.wallet))); } catch {} } };
    ws.on('message', async raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try {
        if (msg.t === 'input') return matches.input(wallet, msg.i);
        if (msg.t === 'create') return roomUpdate(matches.create(wallet, msg));
        if (msg.t === 'join') return roomUpdate(matches.join(wallet, msg));
        if (msg.t === 'ai') return roomUpdate(matches.createAi(wallet, msg));
        if (msg.t === 'wild') return roomUpdate(await matches.createWild(wallet, msg));
        if (msg.t === 'capture') return reply(matches.capture(wallet));
        if (msg.t === 'deposit') return roomUpdate(await matches.confirmDeposit(wallet, msg.signature));
        if (msg.t === 'leave') { matches.leave(wallet); return reply({ t: 'left' }); }
        if (msg.t === 'ping') return reply({ t: 'pong', at: msg.at });
      } catch (e) { reply({ t: 'error', error: e.message }); }
    });
    ws.on('close', () => matches.detach(wallet, ws));
  });

  // The free server plan loses its database on every deploy, so rebuild drop sales from the payments on-chain.
  async function rebuildDrops() {
    if (!chain.memoPayments) return;
    for (const { signature, tx } of await chain.memoPayments(config.dropTreasury, 'PMDROP:')) {
      try {
        const memo = tx.transaction.message.instructions.map(ix => (typeof ix.parsed === 'string' ? ix.parsed : '')).find(x => x.startsWith('PMDROP:'));
        const sid = Number(memo?.slice(7)); if (!HERO_IDS.includes(sid) || players.sale(sid)) continue;
        const buyer = checkPayment(tx, { to: config.dropTreasury, lamports: dropPrice(sid), memo: dropMemo(sid) });
        const m = registry.grantHero(buyer, sid, signature); players.recordSale(sid, buyer, signature, m.serial);
      } catch {}
    }
  }
  async function rebuildAvatars() { // avatar purchases also survive a server reset
    if (!chain.memoPayments || !config.treasury) return;
    for (const { signature, tx } of await chain.memoPayments(config.treasury, 'PMAVATAR:')) {
      try { const memo = tx.transaction.message.instructions.map(ix => (typeof ix.parsed === 'string' ? ix.parsed : '')).find(x => x.startsWith('PMAVATAR:'));
        const a = AVATAR_BY_ID[memo?.slice(9)]; if (!a || a.reservedFor || !a.priceLamports || players.avatarSale(a.id)) continue;
        players.recordAvatarSale(a.id, checkPayment(tx, { to: config.treasury, lamports: BigInt(a.priceLamports), memo: avatarMemo(a.id) }), signature); } catch {}
    }
  }
  if (config.rebuildDrops !== false && AVATARS.some(a => a.priceLamports)) rebuildAvatars().catch(e => console.error('avatar rebuild:', e.message));
  const dropsReady = config.rebuildDrops === false ? Promise.resolve() : rebuildDrops().catch(e => console.error('drop rebuild:', e.message));

  let n = 0;
  const loop = setInterval(() => { try { matches.tick(TICK); if (++n % 2 === 0) matches.broadcastStates(); } catch (e) { console.error('loop error:', e?.stack || e); } }, TICK * 1000);
  server.on('close', () => { clearInterval(loop); wss.close(); db.close(); });
  return { server, db, registry, auth, matches, nft, players, dropsReady };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] === 'setup-collection') {
    const keys = serverKeys(), nft = new NftService({ config: CONFIG, keys, chain: new SolanaChain(CONFIG.rpc) });
    console.log('Collection authority (fund with devnet SOL first):', keys.collectionAuthority.publicKey.toBase58());
    const address = await nft.createOfficialCollection();
    saveStoredConfig({ collection: address });
    console.log('Official collection created:', address);
    process.exit(0);
  }
  const { server } = createServer();
  server.listen(CONFIG.port, CONFIG.host, () => {
    const k = serverKeys();
    console.log(`PocketMonstars on http://${CONFIG.host}:${CONFIG.port}  (${CONFIG.cluster})`);
    console.log('Market authority:', k.marketAuthority.publicKey.toBase58());
    console.log('Collection authority:', k.collectionAuthority.publicKey.toBase58(), CONFIG.collection ? '' : '(no collection yet: run npm run setup:collection)');
    console.log('Treasury:', CONFIG.treasury || 'not set (PM_TREASURY) — company fee is 0 until set');
  });
}
