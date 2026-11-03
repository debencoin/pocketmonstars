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
import { checkPayment, MEMO_PROGRAM, newEscrow } from './escrow.mjs';
import { SPECIES, HERO_IDS, SALE_IDS, SHOP_IDS, formName, nftArt } from '../shared/monstars.mjs';
import { StripePay, verifyWebhook, resaleSplit } from './stripe.mjs';
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
export function createServer({ config = CONFIG, chain = new SolanaChain(config.rpc), dbFile = path.join(DATA_DIR, 'pocketmonstars.db'), keys = serverKeys(),
  stripe = new StripePay({ secretKey: config.stripeSecretKey, webhookSecret: config.stripeWebhookSecret, fixedSolUsd: config.solUsd, publicUrl: config.publicUrl }) } = {}) {
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
  let dropsReadyCard = null;
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

  /** Soul fee split: 95% to the winner, 5% to PocketMonstars (all to the winner if no company wallet is set). */
  const soulPays = c => { const fee = BigInt(c.fee_lamports), cut = config.treasury ? fee * 500n / 10_000n : 0n;
    return [{ to: c.winner, lamports: fee - cut }, ...(cut > 0n ? [{ to: config.treasury, lamports: cut }] : [])]; };
  // ---------- card payments (Stripe) ----------
  const usd = c => '$' + (c / 100).toFixed(2);
  /** Fulfil a paid Checkout Session once (store sale or dollar resale). `live` = may refund / pay out; false while rebuilding. */
  async function fulfil(sess, live = true) {
    const done = players.cardOrder(sess.id); if (done) return JSON.parse(done.result);
    const md = sess.metadata || {}, pi = typeof sess.payment_intent === 'object' ? sess.payment_intent : null; let result;
    if (sess.payment_status !== 'paid' || !md.pm) throw Error('That payment is not complete.');
    if (md.kind === 'sale') {
      const sid = Number(md.sid), sale = players.sale(sid), sig = 'card:' + sess.id;
      if (!SALE_IDS.includes(sid)) throw Error('Unknown item.');
      if (sale && sale.signature !== sig) { // sold to someone else first (SOL and card at the same moment): refund the card
        if (live) await stripe.refund(pi?.id || sess.payment_intent).catch(() => {});
        result = { ok: false, refunded: true, error: SPECIES[sid].name + ' was already sold, so your card was refunded.' };
      } else { const m = registry.grantHero(md.buyer, sid, sig); if (!sale) players.recordSale(sid, md.buyer, sig, m.serial); reserved.delete(sid); result = { ok: true, monstar: m.toJSON() }; }
    } else if (md.kind === 'resale') {
      const m = registry.get(Number(md.serial));
      if (!m || m.owner !== md.seller || m.asset || m.dna !== md.dna) { if (live) await stripe.refund(pi?.id || sess.payment_intent).catch(() => {}); result = { ok: false, refunded: true, error: 'That Monstar is no longer for sale, so your card was refunded.' }; }
      else {
        registry.setOwner(m.serial, md.buyer); players.unlistUsd(m.serial);
        const cents = Number(md.cents), creatorAcct = m.originOwner !== md.seller ? players.payoutAccount(m.originOwner) : null, split = resaleSplit(cents, !!creatorAcct);
        const charge = pi?.latest_charge?.id || pi?.latest_charge, group = 'resale-' + sess.id, sellerAcct = players.payoutAccount(md.seller), paid = [];
        if (live && charge && sellerAcct) { await stripe.transfer({ cents: split.seller, destination: sellerAcct, charge, group, metadata: { session: sess.id, role: 'seller' } }); paid.push('seller'); }
        if (live && charge && creatorAcct && split.creator > 0) { await stripe.transfer({ cents: split.creator, destination: creatorAcct, charge, group, metadata: { session: sess.id, role: 'creator' } }).catch(e => console.error('creator royalty:', e.message)); paid.push('creator'); }
        result = { ok: true, monstar: registry.get(m.serial).toJSON(), split, paid };
      }
    } else if (md.kind === 'soul') { // Immortal Combat buy-back paid by card
      const c = players.soulClaim(md.claim), m = c && registry.get(c.serial);
      if (!c || c.state !== 'open' || !m || m.owner !== c.winner || c.loser !== md.buyer) { if (live) await stripe.refund(pi?.id || sess.payment_intent).catch(() => {}); result = { ok: false, refunded: true, error: 'That buy-back is closed, so your card was refunded.' }; }
      else {
        registry.setOwner(m.serial, c.loser); players.setSoulState(c.id, 'bought', 'card:' + sess.id);
        const esc = players.escrowOfClaim(c.id); if (esc?.state === 'held') players.updateEscrow(esc.id, { release_to: c.loser }); // the loser collects the NFT
        const cents = Number(md.cents), company = Math.floor(cents * 500 / 10_000), acct = players.payoutAccount(c.winner), charge = pi?.latest_charge?.id || pi?.latest_charge;
        if (live && acct && charge) await stripe.transfer({ cents: cents - company, destination: acct, charge, group: 'soul-' + c.id, metadata: { session: sess.id, role: 'winner' } }).catch(e => console.error('soul payout:', e.message));
        result = { ok: true, monstar: registry.get(m.serial).toJSON(), soul: c.id };
      }
    } else if (md.kind === 'catches') {
      const n = Number(md.qty); if (![1, 5].includes(n)) throw Error('Unknown pack.');
      players.addCatchCredits(md.buyer, n); result = { ok: true, catches: n, credits: players.catchCredits(md.buyer) };
    } else throw Error('Unknown order.');
    players.recordCardOrder(sess.id, md.kind, result); return result;
  }
  const payoutReady = async w => { const a = players.payoutAccount(w); if (!a) return { account: null, ready: false };
    const acct = await stripe.account(a); return { account: a, ready: acct.capabilities?.transfers === 'active' && !!acct.payouts_enabled, details: !!acct.details_submitted }; };

  const routes = {
    'GET /api/card/status': async () => { const on = stripe.enabled; let solUsd = null; if (on) solUsd = await stripe.solUsd().catch(() => null);
      return { enabled: on, solUsd, resale: { sellerPct: 90, creatorPct: 5, companyPct: 5 } }; },
    'POST /api/card/checkout': async req => { const w = need(req), b = await body(req), sid = Number(b.speciesId), sp = SPECIES[sid];
      if (!SALE_IDS.includes(sid)) throw Error('That Monstar is not for sale.');
      if (!sp.drop.shop && Date.now() > config.dropEndsAt) throw Error('The Superhero Drop has ended.');
      if (players.sale(sid)) throw Error(sp.name + ' is already sold.');
      const r = reserved.get(sid); if (r && r.until > Date.now() && r.wallet !== w) throw Error('Someone is buying ' + sp.name + ' right now. Try again in a few minutes.');
      const cents = await stripe.centsFor(sp.drop.priceLamports); reserved.set(sid, { wallet: w, until: Date.now() + 10 * 60_000 });
      const sess = await stripe.checkout({ name: `${sp.name} · PocketMonstars (one of one)`, image: `${config.publicUrl}/art/nft/${nftArt(sp)}`, cents, ref: w,
        metadata: { pm: '1', kind: 'sale', sid: String(sid), buyer: w, sol: formatSol(BigInt(sp.drop.priceLamports), 2) } });
      return { url: sess.url, cents, usd: usd(cents) }; },
    'POST /api/card/confirm': async req => { const w = need(req), b = await body(req), sess = await stripe.session(String(b.session || ''));
      if (sess.metadata?.buyer !== w) throw Error('That payment belongs to another player.');
      if (sess.payment_status !== 'paid') return { ok: false, pending: true };
      return fulfil(sess); },
    // ---------- Immortal Combat: soul fees and buy-backs ----------
    'GET /api/soul/mine': req => { const w = need(req);
      return { claims: players.soulClaimsOf(w).map(c => { const m = registry.get(c.serial);
        return { id: c.id, serial: c.serial, monstar: m?.toJSON() || null, you: c.winner === w ? 'winner' : 'loser', winner: c.winner, loser: c.loser, state: c.state, expiresAt: c.expires_at,
          feeSol: formatSol(BigInt(c.fee_lamports), 2), feeLamports: c.fee_lamports, feeUsd: c.fee_cents ? usd(c.fee_cents) : null, feeCents: c.fee_cents,
          canSol: !c.winner.startsWith('@') && !c.loser.startsWith('@'), canCard: stripe.enabled && !!c.fee_cents && !!players.payoutAccount(c.winner), nft: !!players.escrowOfClaim(c.id) }; }),
        collect: players.collectable(w).map(e => ({ id: e.id, serial: e.serial, monstar: registry.get(e.serial)?.toJSON() || null })) }; },
    'POST /api/soul/fee': async req => { const w = need(req), b = await body(req), c = players.soulClaim(b.id);
      if (!c || c.winner !== w) throw Error('Only the winner sets the soul fee.'); if (c.state !== 'open') throw Error('That claim is closed.');
      const sol = Number(b.feeSol); if (!(sol >= 0.1 && sol <= 0.5)) throw Error('The soul fee is 0.1 to 0.5 SOL.');
      let cents = null; if (b.feeUsd != null && b.feeUsd !== '') { cents = Math.round(Number(b.feeUsd) * 100); if (!(cents >= 100 && cents <= 100_000)) throw Error('The dollar fee is $1 to $1,000.');
        if (!(await payoutReady(w).catch(() => ({}))).ready) throw Error('To take dollars, set up your payout account first (Market → Sell For Dollars).'); }
      players.setSoulFee(c.id, BigInt(Math.round(sol * 1e9)), cents); return { ok: true }; },
    'POST /api/soul/tx': async req => { const w = needWallet(req), b = await body(req), c = players.soulClaim(b.id);
      if (!c || c.loser !== w) throw Error('Only the player who lost it can buy it back.'); if (c.state !== 'open') throw Error('Too late: that Monstar now belongs to the winner.');
      if (c.winner.startsWith('@')) throw Error('The winner plays without Phantom, so this buy-back is by card only.');
      const pays = soulPays(c), esc = players.escrowOfClaim(c.id), memo = 'PMSOUL:' + c.id;
      if (esc && esc.state === 'held') return { transaction: await nft.releaseTransaction({ asset: esc.asset, escrowSecret: esc.secret, to: w, payments: pays, memo }), feeSol: formatSol(BigInt(c.fee_lamports), 2) };
      const { blockhash } = await chain.latestBlockhash(), payer = new PublicKey(w), tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
      for (const p of pays) if (p.lamports > 0n) tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(p.to), lamports: p.lamports }));
      tx.add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(memo) }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), feeSol: formatSol(BigInt(c.fee_lamports), 2) }; },
    'POST /api/soul/confirm': async req => { const w = needWallet(req), b = await body(req), c = players.soulClaim(b.id);
      if (!c || c.loser !== w) throw Error('Only the player who lost it can buy it back.');
      if (c.state === 'bought') return registry.get(c.serial).toJSON();
      await waitConfirmed(b.signature); await chain.verifyPayments(b.signature, { from: w, pays: soulPays(c), memo: 'PMSOUL:' + c.id });
      const m = registry.get(c.serial); if (!m || m.owner !== c.winner) throw Error('The Monstar moved. Contact support with ' + b.signature);
      const esc = players.escrowOfClaim(c.id);
      if (esc && esc.state === 'held') { if (await nft.ownerOf(esc.asset) !== w) throw Error('The NFT did not arrive. Contact support with ' + b.signature); players.updateEscrow(esc.id, { state: 'released', release_to: w }); }
      registry.setOwner(m.serial, w); players.setSoulState(c.id, 'bought', b.signature); return registry.get(m.serial).toJSON(); },
    // Immortal Guild: every open Immortal Combat waiting for a rival
    'GET /api/immortal/open': () => ({ fights: [...matches.rooms.values()].filter(r => r.immortal && r.state === 'waiting' && r.players.length === 1)
      .map(r => { const p = r.players[0], m = registry.get(p.monstar.serial) || p.monstar; return { code: r.code, owner: p.wallet, record: recordOf(p.wallet), createdAt: r.createdAt, monstar: m.toJSON(), nft: !!m.asset, power: Object.values(m.stats).reduce((a, b) => a + b, 0) }; })
      .sort((a, b) => b.createdAt - a.createdAt) }),
    // ---------- Immortal Combat: Phantom players sign before the fight ----------
    'POST /api/immortal/sign': async req => { const w = needWallet(req), b = await body(req); return matches.publicRoom(matches.signConsent(w, b.signature), w); },
    'POST /api/immortal/lock-tx': async req => { const w = needWallet(req), room = matches.roomOf(w), p = room?.players.find(x => x.wallet === w);
      if (!room?.immortal || room.state !== 'lock' || !p) throw Error('Nothing to lock right now.');
      const m = registry.get(p.monstar.serial); if (!m?.asset || m.owner !== w) throw Error('This Monstar is not a minted NFT of yours.');
      let row = players.escrowFor(room.code, m.serial);
      if (!row) { const e = newEscrow(); players.newEscrowRow({ room: room.code, serial: m.serial, asset: m.asset, escrow: e.address, secret: e.secret, owner: w }); row = players.escrowFor(room.code, m.serial); }
      return { transaction: await nft.lockTransaction({ asset: m.asset, owner: w, escrow: row.escrow }), escrow: row.escrow }; },
    'POST /api/immortal/lock-confirm': async req => { const w = needWallet(req), b = await body(req), room = matches.roomOf(w), p = room?.players.find(x => x.wallet === w);
      if (!room?.immortal || !p) throw Error('Nothing to lock right now.');
      const row = players.escrowFor(room.code, p.monstar.serial); if (!row) throw Error('Start the lock first.');
      await waitConfirmed(b.signature); if (await nft.ownerOf(row.asset) !== row.escrow) throw Error('The NFT is not in the match escrow yet.');
      players.updateEscrow(row.id, { state: 'held' }); return matches.publicRoom(matches.markLocked(w), w); },
    // NFTs waiting in an escrow for you (your own back after a win or a cancelled match, a bought-back one, or one you won for good)
    'POST /api/escrow/release-tx': async req => { const w = needWallet(req), b = await body(req), e = players.escrow(b.id);
      if (!e || e.state !== 'held' || e.release_to !== w) throw Error('Nothing to collect there.');
      return { transaction: await nft.releaseTransaction({ asset: e.asset, escrowSecret: e.secret, to: w }) }; },
    'POST /api/escrow/release-confirm': async req => { const w = needWallet(req), b = await body(req), e = players.escrow(b.id);
      if (!e || e.release_to !== w) throw Error('Nothing to collect there.');
      if (e.state !== 'released') { await waitConfirmed(b.signature); if (await nft.ownerOf(e.asset) !== w) throw Error('The NFT has not arrived yet.'); players.updateEscrow(e.id, { state: 'released' }); }
      return registry.setOwner(e.serial, w).toJSON(); },
    'POST /api/card/soul': async req => { const w = need(req), b = await body(req), c = players.soulClaim(b.id);
      if (!c || c.loser !== w) throw Error('Only the player who lost it can buy it back.'); if (c.state !== 'open') throw Error('Too late: that Monstar now belongs to the winner.');
      if (!c.fee_cents) throw Error('The winner has not set a dollar price. Use SOL, or ask them to add one.');
      if (!players.payoutAccount(c.winner)) throw Error('The winner cannot take dollars yet.');
      const m = registry.get(c.serial);
      const sess = await stripe.checkout({ name: `Buy back ${m.toJSON().form || m.species.name} · PocketMonstars`, image: `${config.publicUrl}/art/nft/${nftArt(m.species)}`, cents: c.fee_cents, ref: w,
        metadata: { pm: '1', kind: 'soul', claim: String(c.id), buyer: w, cents: String(c.fee_cents) } });
      return { url: sess.url }; },
    'GET /api/catches/me': req => { const w = need(req), a = matches.catchAllowance(w);
      return { wallet: !w.startsWith('@'), free: a.free ?? null, credits: a.credits ?? null, freeTotal: 2, card: stripe.enabled, packs: Object.entries(config.catchPacks).map(([n, usd]) => ({ n: Number(n), usd })) }; },
    'POST /api/card/catches': async req => { const w = need(req), b = await body(req), n = Number(b.pack), price = config.catchPacks[n];
      if (!w.startsWith('@')) throw Error('Phantom players already pay for each wild run, so they catch without passes.');
      if (!price) throw Error('Pick a pack of 1 or 5 catch passes.');
      const sess = await stripe.checkout({ name: `${n} catch pass${n > 1 ? 'es' : ''} · PocketMonstars`, cents: Math.round(price * 100), ref: w, metadata: { pm: '1', kind: 'catches', qty: String(n), buyer: w } });
      return { url: sess.url }; },
    'GET /api/payouts/me': async req => payoutReady(need(req)),
    'POST /api/payouts/connect': async req => { const w = need(req); let a = players.payoutAccount(w);
      if (!a) { a = (await stripe.createAccount(w)).id; players.setPayoutAccount(w, a); }
      return { url: (await stripe.onboardingLink(a)).url }; },
    'GET /api/usd/listings': () => ({ enabled: stripe.enabled, listings: players.usdListings().map(l => { const m = registry.get(l.serial); return m && m.owner === l.seller && !m.asset ? { serial: l.serial, seller: l.seller, cents: l.cents, usd: usd(l.cents), monstar: m.toJSON() } : null; }).filter(Boolean) }),
    'POST /api/usd/list': async req => { const w = need(req), b = await body(req), m = registry.get(Number(b.serial)), cents = Math.round(Number(b.priceUsd) * 100);
      if (!stripe.enabled) throw Error('Card payments are not switched on yet.');
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      if (m.asset) throw Error('This Monstar is minted as an NFT: sell it for SOL in the NFT market instead.');
      if (players.openSoulClaimFor(m.serial)) throw Error('Its old owner can still buy this Monstar back (Immortal Combat). Wait until the buy-back time ends.');
      if (!(cents >= 100 && cents <= 1_000_000)) throw Error('Pick a price from $1 to $10,000.');
      if (!(await payoutReady(w)).ready) throw Error('Set up your payout account first (tap "Get paid in dollars").');
      players.listUsd(m.serial, w, cents); return { ok: true, serial: m.serial, usd: usd(cents) }; },
    'POST /api/usd/cancel': async req => { const w = need(req), b = await body(req), l = players.usdListing(Number(b.serial));
      if (!l || l.seller !== w) throw Error('No listing of yours for that Monstar.'); players.unlistUsd(l.serial); return { ok: true }; },
    'POST /api/usd/buy': async req => { const w = need(req), b = await body(req), l = players.usdListing(Number(b.serial)), m = l && registry.get(l.serial);
      if (!l || !m || m.owner !== l.seller || m.asset) throw Error('That Monstar is not for sale any more.');
      if (l.seller === w) throw Error('That is your own listing.');
      const name = (m.toJSON().form || m.species.name) + ' #' + m.serial;
      const sess = await stripe.checkout({ name: `${name} · Lv${m.level} · PocketMonstars`, image: `${config.publicUrl}/art/nft/${nftArt(m.species)}`, cents: l.cents, ref: w, transferGroup: 'resale-' + m.serial,
        metadata: { pm: '1', kind: 'resale', serial: String(m.serial), seller: l.seller, buyer: w, cents: String(l.cents), dna: m.dna } });
      return { url: sess.url, usd: usd(l.cents) }; },
    'GET /api/config': () => ({ wildFeeLamports: config.wildFeeLamports.toString(), cluster: config.cluster, treasury: config.treasury, royaltyBps: config.royaltyBps, collection: config.collection,
      marketAuthority: keys.marketAuthority.publicKey.toBase58(), policy: { minStake: STAKE_POLICY.minStake, maxStake: STAKE_POLICY.maxStake, companyFeeLamports: STAKE_POLICY.companyFeeLamports, networkFeeLamports: STAKE_POLICY.networkFeeLamports } }),
    'POST /api/auth/challenge': async req => ({ message: auth.challenge((await body(req)).wallet) }),
    'POST /api/auth/verify': async req => { const b = await body(req); const s = auth.verify(b.wallet, b.signature); return welcome(s.wallet, b.ref); },
    // ---------- username + password accounts (free online play; no SOL) ----------
    'POST /api/account/register': async req => { const b = await body(req); return welcome(players.register(b.username, b.password), b.ref); },
    'POST /api/account/login': async req => { const b = await body(req); return welcome(players.login(b.username, b.password)); },
    'GET /api/referrals/me': req => { const w = need(req); return { code: w, ...players.referralStats(w), bps: 500 }; },
    // ---------- profile + avatars ----------
    'GET /api/profile/me': req => { const w = need(req); return { ...profileOf(w), record: recordOf(w) }; },
    'GET /api/record/me': req => recordOf(need(req)),
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
          sold: !!sale, owner: sale ? registry.get(sale.serial)?.owner || sale.buyer : null, held: !sale && r && r.until > Date.now() }; }),
      // Sky Bender market: one of each, sold for SOL with no time limit (COVA is 10 SOL)
      shop: SHOP_IDS.map(sid => { const sale = players.sale(sid), r = reserved.get(sid), sp = SPECIES[sid];
        return { speciesId: sid, name: sp.name, type: sp.type, element: sp.el2, female: !!sp.female, unique: !!sp.unique, priceLamports: sp.drop.priceLamports, mega: sp.kit.mega.name,
          sold: !!sale, owner: sale ? registry.get(sale.serial)?.owner || sale.buyer : null, held: !sale && r && r.until > Date.now() }; }) }),
    'POST /api/drop/tx': async req => { const w = needWallet(req), b = await body(req), sid = Number(b.speciesId);
      if (!SALE_IDS.includes(sid)) throw Error('That Monstar is not for sale.');
      if (!SPECIES[sid].drop.shop && Date.now() > config.dropEndsAt) throw Error('The Superhero Drop has ended.');
      if (players.sale(sid)) throw Error(SPECIES[sid].name + ' is already sold.');
      const r = reserved.get(sid); if (r && r.until > Date.now() && r.wallet !== w) throw Error('Someone is buying ' + SPECIES[sid].name + ' right now. Try again in 2 minutes.');
      reserved.set(sid, { wallet: w, until: Date.now() + 120_000 });
      const { blockhash } = await chain.latestBlockhash(), payer = new PublicKey(w);
      const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash })
        .add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(config.dropTreasury), lamports: dropPrice(sid) }))
        .add(new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(dropMemo(sid)) }));
      return { transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'), priceSol: formatSol(dropPrice(sid), 2) }; },
    'POST /api/drop/confirm': async req => { const w = needWallet(req), b = await body(req), sid = Number(b.speciesId);
      if (!SALE_IDS.includes(sid)) throw Error('That Monstar is not for sale.');
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
      if (m && players.openSoulClaimFor(m.serial)) throw Error('Its old owner can still buy this Monstar back (Immortal Combat). Mint it after the buy-back time ends.');
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.'); if (m.asset) throw Error('Already minted.');
      return nft.mintTransaction({ monstar: m, owner: w }); },
    'POST /api/mint/confirm': async req => { const w = needWallet(req), b = await body(req), m = registry.get(Number(b.serial));
      if (!m || m.owner !== w) throw Error('You do not own that Monstar.');
      await waitConfirmed(b.signature); const { owner } = await nft.verifyMint({ monstar: m, asset: b.asset });
      registry.bindAsset(m.serial, b.asset, b.signature); players.unlistUsd(m.serial); return registry.setOwner(m.serial, owner).toJSON(); },
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
  // Win / loss record of every player (all finished server matches: rivals, Immortal Combat and CPU practice)
  let recCache = null, recAt = 0;
  function records() {
    if (recCache && Date.now() - recAt < 10_000) return recCache;
    const rows = db.prepare("SELECT player_a a, player_b b, winner FROM matches WHERE player_b IS NOT NULL AND state IN ('done','settled','settling','settlement-needs-review')").all();
    const by = new Map(), get = w => by.get(w) || (by.set(w, { wins: 0, losses: 0, draws: 0, pvpWins: 0, pvpLosses: 0 }), by.get(w));
    for (const r of rows) { const pvp = r.b !== 'AI';
      [r.a, r.b].forEach((w, i) => { if (!w || w === 'AI') return; const p = get(w);
        if (r.winner == null) p.draws++; else if (r.winner === i) { p.wins++; if (pvp) p.pvpWins++; } else { p.losses++; if (pvp) p.pvpLosses++; } }); }
    recAt = Date.now(); return (recCache = by);
  }
  const recordOf = w => records().get(w) || { wins: 0, losses: 0, draws: 0, pvpWins: 0, pvpLosses: 0 };
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
      .map((p, i) => ({ rank: i + 1, wallet: p.wallet, net: p.net.toString(), netSol: formatSol(p.net, 6), earnedSol: formatSol(p.earned, 6), wins: p.wins, played: p.played, staked: p.staked, losses: p.played - p.wins, record: recordOf(p.wallet) }));
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
      if (key === 'POST /api/stripe/webhook') { // Stripe calls this when a card payment completes (signature checked)
        const raw = await new Promise((ok, fail) => { let s = ''; req.on('data', c => { s += c; if (s.length > 500_000) { fail(Error('Body too large')); req.destroy(); } }); req.on('end', () => ok(s)); });
        const ev = verifyWebhook(raw, req.headers['stripe-signature'], config.stripeWebhookSecret);
        if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type) && ev.data.object.metadata?.pm) await fulfil(await stripe.session(ev.data.object.id));
        return send(res, 200, { received: true });
      }
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
        const sid = Number(memo?.slice(7)); if (!SALE_IDS.includes(sid) || players.sale(sid)) continue;
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
  // Card sales also survive a reset: replay paid Stripe sessions (store sales to Phantom wallets; username accounts need a persistent disk).
  async function rebuildCard() {
    for (const [user, acct] of await stripe.accountsByUser()) if (!players.payoutAccount(user)) players.setPayoutAccount(user, acct);
    for (const sess of await stripe.paidSessions()) if (sess.metadata.kind === 'sale' && !sess.metadata.buyer.startsWith('@')) { try { await fulfil(await stripe.session(sess.id), false); } catch {} }
  }
  if (config.rebuildDrops !== false && stripe.enabled) dropsReadyCard = rebuildCard().catch(e => console.error('card rebuild:', e.message));
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
