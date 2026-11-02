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
import { STAKE_POLICY } from '../shared/stake.mjs';
import { TICK } from '../shared/sim.mjs';

export function createServer({ config = CONFIG, chain = new SolanaChain(config.rpc), dbFile = path.join(DATA_DIR, 'pocketmonstars.db'), keys = serverKeys() } = {}) {
  const db = openDb(dbFile);
  const registry = new Registry(db), auth = new Auth();
  const matches = new MatchManager({ db, registry, chain, config });
  const nft = new NftService({ config, keys, chain });
  const roots = { '/shared/': path.resolve('shared'), '/': path.resolve('dist') };
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

  const send = (res, code, body) => { const s = JSON.stringify(body, (_, v) => (typeof v === 'bigint' ? v.toString() : v)); res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(s); };
  const body = req => new Promise((ok, fail) => { let s = ''; req.on('data', c => { s += c; if (s.length > 20000) { fail(Error('Body too large')); req.destroy(); } }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(Error('Invalid JSON')); } }); });
  const walletOf = req => auth.wallet((req.headers.authorization || '').replace(/^Bearer /, ''));
  const need = req => { const w = walletOf(req); if (!w) throw Object.assign(Error('Sign in with Phantom first.'), { code: 401 }); return w; };
  const listingRow = id => db.prepare('SELECT * FROM listings WHERE id=?').get(Number(id));
  const waitConfirmed = async sig => { for (let i = 0; i < 30; i++) { const s = await chain.status(sig); if (s?.err) throw Error('Transaction failed on-chain.'); if (['confirmed', 'finalized'].includes(s?.confirmationStatus)) return; await new Promise(r => setTimeout(r, 1000)); } throw Error('Not confirmed yet. Try again in a moment.'); };

  const routes = {
    'GET /api/config': () => ({ cluster: config.cluster, treasury: config.treasury, royaltyBps: config.royaltyBps, collection: config.collection,
      marketAuthority: keys.marketAuthority.publicKey.toBase58(), policy: { minStake: STAKE_POLICY.minStake, maxStake: STAKE_POLICY.maxStake, companyFeeLamports: STAKE_POLICY.companyFeeLamports, networkFeeLamports: STAKE_POLICY.networkFeeLamports } }),
    'POST /api/auth/challenge': async req => ({ message: auth.challenge((await body(req)).wallet) }),
    'POST /api/auth/verify': async req => { const b = await body(req); const s = auth.verify(b.wallet, b.signature); registry.claimAll(s.wallet); return s; },
    'GET /api/monstars/mine': req => ({ monstars: registry.ownedBy(need(req)).map(m => m.toJSON()) }),
    'POST /api/mint/prepare': async req => { const w = need(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.'); if (m.asset) throw Error('Already minted.');
      return nft.mintTransaction({ monstar: m, owner: w }); },
    'POST /api/mint/confirm': async req => { const w = need(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      await waitConfirmed(b.signature); const { owner } = await nft.verifyMint({ monstar: m, asset: b.asset });
      registry.bindAsset(m.serial, b.asset, b.signature); return registry.setOwner(m.serial, owner).toJSON(); },
    'POST /api/monstars/sync': async req => { const b = await body(req), m = registry.get(Number(b.serial));
      if (!m?.asset) throw Error('Not minted yet.'); return registry.setOwner(m.serial, await nft.ownerOf(m.asset)).toJSON(); },
    'GET /api/market': () => ({ listings: db.prepare("SELECT * FROM listings WHERE state='active' ORDER BY id DESC LIMIT 200").all()
      .map(l => ({ ...l, monstar: registry.byAsset(l.asset)?.toJSON() || null })) }),
    'POST /api/market/list': async req => { const w = need(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m?.asset) throw Error('Mint this Monstar before listing it.'); const price = BigInt(b.priceLamports);
      if (price < 10_000n) throw Error('Minimum price is 0.00001 SOL.');
      await nft.verifyListable({ asset: m.asset, seller: w });
      db.prepare("UPDATE listings SET state='cancelled', closed_at=? WHERE asset=? AND state='active'").run(Date.now(), m.asset);
      const r = db.prepare("INSERT INTO listings(asset,serial,seller,price,state,created_at) VALUES(?,?,?,?, 'active', ?)").run(m.asset, m.serial, w, price.toString(), Date.now());
      return listingRow(r.lastInsertRowid); },
    'POST /api/market/cancel': async req => { const w = need(req), l = listingRow((await body(req)).id);
      if (!l || l.seller !== w || l.state !== 'active') throw Error('No active listing of yours.');
      db.prepare("UPDATE listings SET state='cancelled', closed_at=? WHERE id=?").run(Date.now(), l.id); return { ok: true }; },
    'POST /api/market/buy': async req => { const w = need(req), l = listingRow((await body(req)).id);
      if (!l || l.state !== 'active') throw Error('Listing is no longer available.'); return nft.buyTransaction({ listing: l, buyer: w }); },
    'POST /api/market/confirm': async req => { const w = need(req), b = await body(req), l = listingRow(b.id);
      if (!l || l.state !== 'active') throw Error('Listing is no longer active.'); await waitConfirmed(b.signature);
      if (await nft.ownerOf(l.asset) !== w) throw Error('Ownership did not change to your wallet.');
      db.prepare("UPDATE listings SET state='sold', buyer=?, signature=?, closed_at=? WHERE id=?").run(w, b.signature, Date.now(), l.id);
      const m = registry.byAsset(l.asset); return m ? registry.setOwner(m.serial, w).toJSON() : { ok: true }; },
    'POST /api/stake/deposit-tx': async req => ({ transaction: await matches.depositTransaction(need(req)) }),
  };

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
      if (name === '/') name = '/site.html';         // responsive website
      else if (name === '/play') name = '/index.html'; // the game
      const prefix = name.startsWith('/shared/') ? '/shared/' : '/', root = roots[prefix];
      const file = path.resolve(root, '.' + name.slice(prefix.length - 1));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': name.startsWith('/art/') ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    } catch (e) { send(res, e.code === 401 ? 401 : 400, { error: e.message || String(e) }); }
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (ws, req) => {
    const wallet = auth.wallet(new URL(req.url, 'http://x').searchParams.get('token'));
    if (!wallet) { ws.close(4001, 'Sign in first'); return; }
    matches.attach(wallet, ws);
    const reply = msg => { try { ws.send(JSON.stringify(msg)); } catch {} };
    const roomUpdate = room => { matches.attach(wallet, ws); for (const p of room.players) for (const s of p.sockets) { try { s.send(JSON.stringify(matches.publicRoom(room, p.wallet))); } catch {} } };
    ws.on('message', async raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      try {
        if (msg.t === 'input') return matches.input(wallet, msg.i);
        if (msg.t === 'create') return roomUpdate(matches.create(wallet, msg));
        if (msg.t === 'join') return roomUpdate(matches.join(wallet, msg));
        if (msg.t === 'deposit') return roomUpdate(await matches.confirmDeposit(wallet, msg.signature));
        if (msg.t === 'leave') { matches.leave(wallet); return reply({ t: 'left' }); }
        if (msg.t === 'ping') return reply({ t: 'pong', at: msg.at });
      } catch (e) { reply({ t: 'error', error: e.message }); }
    });
    ws.on('close', () => matches.detach(wallet, ws));
  });

  let n = 0;
  const loop = setInterval(() => { matches.tick(TICK); if (++n % 2 === 0) matches.broadcastStates(); }, TICK * 1000);
  server.on('close', () => { clearInterval(loop); wss.close(); db.close(); });
  return { server, db, registry, auth, matches, nft };
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
