// Accounts, plans, Pro gating and crypto invoices against a real local server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const B = `http://127.0.0.1:${PORT}`;
const OWNER = 'owner-pass-123';
let srv;

async function call(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(B + path, { method, headers: { 'content-type': 'application/json', 'x-ct-token': token || '' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json() };
}

test.before(async () => {
  srv = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, PORT: String(PORT), CT_TOKEN: OWNER, CT_DATA_DIR: mkdtempSync(join(tmpdir(), 'ct-acc-')), CT_COMP_EMAILS: 'friend@example.com', CT_PAY_BTC: 'bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxx', CT_NO_FEEDS: '1' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('server did not start');
});
test.after(() => srv?.kill());

test('free user: grid paper OK, premium & live bots need Pro', async () => {
  const { j: s } = await call('/api/auth/signup', { method: 'POST', body: { email: 'Alice@Example.com', password: 'password1' } });
  assert.ok(s.token); assert.equal(s.user.plan.pro, false);
  const t = s.token;
  const me = await call('/api/me', { token: t });
  assert.equal(me.j.user.email, 'alice@example.com');
  assert.equal((await call('/api/bots', { method: 'POST', token: t, body: { type: 'pumpgrid', exchange: 'mexc', symbol: 'ZEC/USDT', mode: 'paper', draft: true, params: {} } })).status, 402);
  assert.equal((await call('/api/bots', { method: 'POST', token: t, body: { type: 'grid', exchange: 'mexc', symbol: 'ZEC/USDT', mode: 'live', draft: true, params: {} } })).status, 402);
  const ok = await call('/api/bots', { method: 'POST', token: t, body: { type: 'grid', exchange: 'mexc', symbol: 'ZEC/USDT', mode: 'paper', draft: true, params: { lower: 20, upper: 40, grids: 10, investment: 100 } } });
  assert.equal(ok.status, 200, JSON.stringify(ok.j));
  // other users can't see or touch it
  const { j: s2 } = await call('/api/auth/signup', { method: 'POST', body: { email: 'bob@example.com', password: 'password2' } });
  assert.equal((await call('/api/bots', { token: s2.token })).j.length, 0);
  assert.equal((await call(`/api/bots/${ok.j.id}/pause`, { method: 'POST', token: s2.token, body: {} })).status, 404);
  // owner-only routes
  assert.equal((await call('/api/admin', { token: t })).status, 403);
  assert.equal((await call('/api/telegram', { token: t })).status, 403);
});

test('comp email from env gets everything; owner can grant comp before signup', async () => {
  const { j } = await call('/api/auth/signup', { method: 'POST', body: { email: 'friend@example.com', password: 'password3' } });
  assert.equal(j.user.plan.pro, true);
  const r = await call('/api/admin/comp', { method: 'POST', token: OWNER, body: { email: 'later@example.com' } });
  assert.equal(r.status, 200);
  const { j: l } = await call('/api/auth/signup', { method: 'POST', body: { email: 'later@example.com', password: 'password4' } });
  assert.equal(l.user.plan.pro, true);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'later@example.com', password: 'password4' } })).status, 200);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'later@example.com', password: 'wrong-pass' } })).status, 401);
});

test('owner has full access and an admin view', async () => {
  const me = await call('/api/me', { token: OWNER });
  assert.equal(me.j.user.plan.tier, 'owner');
  const a = await call('/api/admin', { token: OWNER });
  assert.equal(a.status, 200);
  assert.ok(a.j.stats.users >= 4);
  assert.equal(a.j.billing.coins.find((c) => c.coin === 'BTC').enabled, true);
});

test('owner grant adds 30 days of Pro', async () => {
  await call('/api/admin/grant', { method: 'POST', token: OWNER, body: { email: 'bob@example.com', days: 30 } });
  const { j } = await call('/api/auth/login', { method: 'POST', body: { email: 'bob@example.com', password: 'password2' } });
  assert.equal(j.user.plan.pro, true);
  assert.ok(j.user.plan.until > Date.now() + 29 * 864e5);
});
