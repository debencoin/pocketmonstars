// Card payments (Stripe) with a fake Stripe: store purchase at the SOL price in dollars, refunds on a double sale,
// dollar resale with the 90 / 5 / 5 split, and webhook signature checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from '../server/index.mjs';
import { CONFIG } from '../server/config.mjs';
import { StripePay, verifyWebhook, resaleSplit, form } from '../server/stripe.mjs';
import { SPECIES, SHOP_IDS } from '../shared/monstars.mjs';

function fakeStripe() {
  const sessions = new Map(), calls = [];
  const fetchImpl = async (url, opt = {}) => {
    const u = new URL(url), body = opt.body ? Object.fromEntries(new URLSearchParams(opt.body)) : {}; calls.push({ method: opt.method, path: u.pathname, body });
    const ok = j => ({ ok: true, status: 200, json: async () => j });
    if (u.host.includes('coingecko')) return ok({ solana: { usd: 150 } });
    if (u.pathname === '/v1/checkout/sessions' && opt.method === 'POST') {
      const id = 'cs_test_' + (sessions.size + 1), md = Object.fromEntries(Object.entries(body).filter(([k]) => k.startsWith('metadata[')).map(([k, v]) => [k.slice(9, -1), v]));
      sessions.set(id, { id, url: 'https://checkout.stripe.test/' + id, payment_status: 'unpaid', metadata: md, amount: Number(body['line_items[0][price_data][unit_amount]']), payment_intent: { id: 'pi_' + id, latest_charge: { id: 'ch_' + id } } });
      return ok(sessions.get(id));
    }
    if (u.pathname.startsWith('/v1/checkout/sessions/')) return ok(sessions.get(decodeURIComponent(u.pathname.split('/').pop())));
    if (u.pathname === '/v1/accounts' && opt.method === 'POST') return ok({ id: 'acct_' + body['metadata[pm_user]'].slice(0, 6) });
    if (u.pathname.startsWith('/v1/accounts/')) return ok({ id: u.pathname.split('/').pop(), capabilities: { transfers: 'active' }, payouts_enabled: true, details_submitted: true });
    if (u.pathname === '/v1/account_links') return ok({ url: 'https://connect.stripe.test/onboard' });
    if (u.pathname === '/v1/transfers') return ok({ id: 'tr_' + calls.length });
    if (u.pathname === '/v1/refunds') return ok({ id: 're_' + calls.length });
    return { ok: false, status: 404, json: async () => ({ error: { message: 'no route ' + u.pathname } }) };
  };
  return { sessions, calls, fetchImpl, pay: id => { sessions.get(id).payment_status = 'paid'; } };
}

test('card: store purchase at the same price in dollars, one of one, a second card buyer is refunded', async () => {
  const fs = fakeStripe(), stripe = new StripePay({ secretKey: 'sk_test_x', publicUrl: 'https://pm.test', fetchImpl: fs.fetchImpl });
  const { server, auth, registry } = createServer({ dbFile: ':memory:', stripe, config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const call = (p, t, b) => fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    assert.equal((await call('/api/card/status')).enabled, true);
    const a = auth.issue('@cardfan').token, b = auth.issue('@late').token, sid = SHOP_IDS[0]; registry.claimAll('@cardfan');
    const co = await call('/api/card/checkout', a, { speciesId: sid });
    assert.equal(co.cents, 150 * 100, '1 SOL at $150 = $150.00'); assert.match(co.url, /checkout\.stripe\.test/);
    assert.match((await call('/api/card/checkout', b, { speciesId: sid })).error, /right now/, 'held for the first buyer');
    assert.ok((await call('/api/card/confirm', a, { session: 'cs_test_1' })).pending);
    fs.pay('cs_test_1');
    const got = await call('/api/card/confirm', a, { session: 'cs_test_1' }); assert.ok(got.ok, got.error); assert.equal(got.monstar.speciesId, sid); assert.equal(got.monstar.owner, '@cardfan');
    assert.equal((await call('/api/card/confirm', a, { session: 'cs_test_1' })).monstar.serial, got.monstar.serial, 'confirming twice is safe');
    assert.match((await call('/api/card/checkout', b, { speciesId: sid })).error, /already sold/);
    // COVA is 10 SOL -> $1,500
    const cova = SPECIES.find(s => s.name === 'COVA').id; assert.equal((await call('/api/card/checkout', b, { speciesId: cova })).cents, 150000);
    // a race: a second paid session for the same Monstar is refunded
    fs.sessions.set('cs_race', { ...fs.sessions.get('cs_test_1'), id: 'cs_race', metadata: { ...fs.sessions.get('cs_test_1').metadata, buyer: '@late' } });
    const race = await call('/api/card/confirm', b, { session: 'cs_race' }); assert.ok(race.refunded); assert.ok(fs.calls.some(c => c.path === '/v1/refunds'));
  } finally { server.close(); }
});

test('card: dollar resale pays the seller 90%, the creator 5% and keeps 5%; the Monstar moves to the buyer', async () => {
  const fs = fakeStripe(), stripe = new StripePay({ secretKey: 'sk_test_x', publicUrl: 'https://pm.test', fetchImpl: fs.fetchImpl });
  const { server, auth, registry } = createServer({ dbFile: ':memory:', stripe, config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const call = (p, t, b) => fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    const seller = auth.issue('@seller').token, buyer = auth.issue('@buyer').token, [mon] = registry.claimAll('@seller');
    assert.match((await call('/api/usd/list', seller, { serial: mon.serial, priceUsd: 20 })).error, /payout account/);
    assert.match((await call('/api/payouts/connect', seller, {})).url, /connect\.stripe\.test/);
    assert.equal((await call('/api/payouts/me', seller)).ready, true);
    assert.match((await call('/api/usd/list', seller, { serial: mon.serial, priceUsd: 0.5 })).error, /\$1/);
    assert.equal((await call('/api/usd/list', seller, { serial: mon.serial, priceUsd: 20 })).usd, '$20.00');
    assert.equal((await call('/api/usd/listings')).listings.length, 1);
    assert.match((await call('/api/usd/buy', seller, { serial: mon.serial })).error, /own listing/);
    const co = await call('/api/usd/buy', buyer, { serial: mon.serial }); assert.match(co.url, /checkout/);
    const id = [...fs.sessions.keys()].at(-1); fs.pay(id);
    const r = await call('/api/card/confirm', buyer, { session: id }); assert.ok(r.ok, r.error);
    assert.equal(registry.get(mon.serial).owner, '@buyer');
    assert.deepEqual(r.split, { seller: 1800, creator: 0, company: 200 }, 'the seller is its creator here, so the company keeps the 5% royalty too');
    const tr = fs.calls.filter(c => c.path === '/v1/transfers'); assert.equal(tr.length, 1); assert.equal(tr[0].body.amount, '1800'); assert.equal(tr[0].body.source_transaction, 'ch_' + id);
    assert.equal((await call('/api/usd/listings')).listings.length, 0);
    assert.deepEqual(resaleSplit(1000, true), { seller: 900, creator: 50, company: 50 });
  } finally { server.close(); }
});

test('card: webhook signatures are checked; switched off without a key', async () => {
  const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } }), t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', 'whsec_x').update(`${t}.${raw}`).digest('hex');
  assert.equal(verifyWebhook(raw, `t=${t},v1=${sig}`, 'whsec_x').type, 'checkout.session.completed');
  assert.throws(() => verifyWebhook(raw, `t=${t},v1=${'0'.repeat(64)}`, 'whsec_x'), /signature/);
  assert.throws(() => verifyWebhook(raw, `t=${t - 900},v1=${sig}`, 'whsec_x'), /old/);
  assert.equal(form({ a: { b: 1 }, c: [{ d: 2 }] }).toString(), 'a%5Bb%5D=1&c%5B0%5D%5Bd%5D=2');
  const off = new StripePay({}); assert.equal(off.enabled, false); await assert.rejects(off.call('GET', '/x'), /not switched on/);
});

test('catch passes: free accounts catch 2 free, then need a pass (bought by card); Phantom wallets are not limited', async () => {
  const fs = fakeStripe(), stripe = new StripePay({ secretKey: 'sk_test_x', publicUrl: 'https://pm.test', fetchImpl: fs.fetchImpl });
  const { server, auth, matches, db, players } = createServer({ dbFile: ':memory:', stripe, config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const call = (p, t, b) => fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    const t = auth.issue('@catcher').token, caught = n => db.prepare('INSERT INTO wild_runs(signature,wallet,species,level,created_at,caught_serial) VALUES(?,?,?,?,?,?)').run('free:' + n, '@catcher', 0, 3, Date.now(), n);
    assert.deepEqual([matches.catchAllowance('@catcher').ok, matches.catchAllowance('@catcher').free], [true, 2]);
    caught(1); caught(2);
    assert.equal(matches.catchAllowance('@catcher').ok, false, 'after 2 free catches a pass is needed');
    assert.equal(matches.catchAllowance('8FzQ35yj3fMrgBjyF1HiYEKprRoJzDfMFbScRp8U2VSR').ok, true, 'Phantom wallets are not limited');
    const me = await call('/api/catches/me', t); assert.equal(me.free, 0); assert.equal(me.credits, 0); assert.equal(me.packs.length, 2);
    const co = await call('/api/card/catches', t, { pack: 5 }); assert.match(co.url, /checkout/);
    const id = [...fs.sessions.keys()].at(-1); assert.equal(fs.sessions.get(id).amount, 399); fs.pay(id);
    const r = await call('/api/card/confirm', t, { session: id }); assert.equal(r.credits, 5);
    assert.equal(matches.catchAllowance('@catcher').ok, true);
    matches.takeCatch('@catcher'); assert.equal(players.catchCredits('@catcher'), 4, 'each catch uses one pass');
  } finally { server.close(); }
});

test('Immortal Combat: the winner takes the loser\'s Monstar; the loser can buy it back (card) before time runs out, else it is gone', async () => {
  const fs = fakeStripe(), stripe = new StripePay({ secretKey: 'sk_test_x', publicUrl: 'https://pm.test', fetchImpl: fs.fetchImpl });
  const { server, auth, matches, registry, players } = createServer({ dbFile: ':memory:', stripe, config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const call = (p, t, b) => fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    const A = '@alpha', B = '@bravo', ta = auth.issue(A).token, tb = auth.issue(B).token, [ma] = registry.claimAll(A), [mb] = registry.claimAll(B);
    const room = matches.create(A, { immortal: true, serial: ma.serial });
    assert.ok(room.immortal); assert.throws(() => matches.join(B, { code: room.code, serial: mb.serial }), /IMMORTAL_CONFIRM/, 'the joiner must confirm');
    matches.join(B, { code: room.code, serial: mb.serial, immortalOk: true });
    for (let i = 0; i < 200 && room.state !== 'live'; i++) matches.tick();
    room.sim.fighters[1].hp = 0; // A wins
    for (let i = 0; i < 80 && room.state === 'live'; i++) matches.tick();
    assert.equal(registry.get(mb.serial).owner, A, 'the winner holds the loser\'s Monstar');
    const [c] = (await call('/api/soul/mine', tb)).claims; assert.equal(c.you, 'loser'); assert.equal(c.feeSol, '0.10'); assert.equal(c.canSol, false, 'accounts pay by card');
    assert.match((await call('/api/soul/fee', tb, { id: c.id, feeSol: 0.3 })).error, /winner/);
    assert.match((await call('/api/soul/fee', ta, { id: c.id, feeSol: 0.9 })).error, /0\.1 to 0\.5/);
    await call('/api/payouts/connect', ta, {});
    assert.ok((await call('/api/soul/fee', ta, { id: c.id, feeSol: 0.3, feeUsd: 12 })).ok);
    assert.throws(() => matches.create(A, { immortal: true, serial: mb.serial }), /soul claim/, 'a held Monstar cannot be put on the line again');
    assert.match((await call('/api/usd/list', ta, { serial: mb.serial, priceUsd: 5 })).error, /buy this Monstar back/);
    const co = await call('/api/card/soul', tb, { id: c.id }); assert.match(co.url, /checkout/);
    const id = [...fs.sessions.keys()].at(-1); assert.equal(fs.sessions.get(id).amount, 1200); fs.pay(id);
    const r = await call('/api/card/confirm', tb, { session: id }); assert.ok(r.ok, r.error);
    assert.equal(registry.get(mb.serial).owner, B, 'bought back');
    assert.equal(fs.calls.filter(x => x.path === '/v1/transfers').at(-1).body.amount, '1140', 'winner gets 95%');
    // a claim nobody buys back expires: the winner keeps it
    const id2 = players.newSoulClaim({ matchId: 'x', serial: ma.serial, winner: B, loser: A, feeLamports: 100_000_000n, hours: 24 });
    assert.equal(players.soulClaim(id2, Date.now() + 25 * 3600_000).state, 'kept');
  } finally { server.close(); }
});

test('Immortal Combat with Phantom: both sign before the fight; the SOL buy-back pays the winner 95% and PocketMonstars 5%', async () => {
  const { Keypair } = await import('@solana/web3.js'), bs58 = (await import('bs58')).default, { ed25519 } = await import('@noble/curves/ed25519');
  const { checkPayments } = await import('../server/escrow.mjs');
  const { server, matches, registry } = createServer({ dbFile: ':memory:', config: { ...CONFIG, rebuildDrops: false } });
  try {
    const ka = Keypair.generate(), kb = Keypair.generate(), A = ka.publicKey.toBase58(), B = kb.publicKey.toBase58();
    const [ma] = registry.claimAll(A), [mb] = registry.claimAll(B);
    const room = matches.create(A, { immortal: true, serial: ma.serial }); matches.join(B, { code: room.code, serial: mb.serial, immortalOk: true });
    assert.equal(room.state, 'lock', 'Phantom players must sign first');
    const sign = (kp, w) => bs58.encode(ed25519.sign(new TextEncoder().encode(matches.consentMessage(room, w)), kp.secretKey.slice(0, 32)));
    assert.match(matches.publicRoom(room, A).consent, /winner takes this Monstar/);
    assert.throws(() => matches.signConsent(A, sign(kb, A)), /does not match/, 'only your own wallet can sign for you');
    matches.signConsent(A, sign(ka, A)); assert.equal(room.state, 'lock');
    matches.signConsent(B, sign(kb, B)); assert.equal(room.state, 'countdown', 'the fight starts once both signed');
    for (let i = 0; i < 200 && room.state !== 'live'; i++) matches.tick();
    room.sim.fighters[0].hp = 0; for (let i = 0; i < 80 && room.state === 'live'; i++) matches.tick(); // B wins
    assert.equal(registry.get(ma.serial).owner, B);
    // the SOL buy-back must pay both the winner (95%) and the company (5%)
    const T = CONFIG.treasury, ix = (to, l) => ({ program: 'system', parsed: { type: 'transfer', info: { source: A, destination: to, lamports: String(l) } } }), memo = { program: 'spl-memo', parsed: 'PMSOUL:1' };
    const tx = ixs => ({ meta: {}, transaction: { message: { instructions: ixs } } });
    assert.equal(checkPayments(tx([ix(B, 95_000_000), ix(T, 5_000_000), memo]), { from: A, pays: [{ to: B, lamports: 95_000_000n }, { to: T, lamports: 5_000_000n }], memo: 'PMSOUL:1' }), A);
    assert.throws(() => checkPayments(tx([ix(B, 95_000_000), memo]), { from: A, pays: [{ to: B, lamports: 95_000_000n }, { to: T, lamports: 5_000_000n }], memo: 'PMSOUL:1' }), /soul fee/);
  } finally { server.close(); }
});
