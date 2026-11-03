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
