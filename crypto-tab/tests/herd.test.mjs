import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGIES, newState, paperExec, normalizeParams, defaultsFor } from '../public/shared/strategies.mjs';

const sig = (o) => ({ id: 'p1', dir: 'pump', confidence: 0.7, breadth: 0.6, name: 'SOL pack', ageMin: 2, role: 'laggard', tokenMove: 0.1, clusterMove: 2, ...o });
function herdBot(over = {}) {
  const bot = { type: 'herd', params: normalizeParams('herd', { ...defaultsFor('herd'), investment: 1000, ...over }) };
  const st = newState(bot); const exec = paperExec(st, 0.001, () => 0);
  STRATEGIES.herd.init(bot, 100, st);
  return { st, tick: (price, herd, now = 1e6) => STRATEGIES.herd.tick(bot, { price, herd, now }, exec, st) };
}

test('herd bot buys a laggard when its group pumps together and takes profit', async () => {
  const { st, tick } = herdBot();
  const r = await tick(100, [sig()]);
  assert.equal(st.trades[0].side, 'buy'); assert.match(r.notify.title, /Herd buy/);
  assert.equal(st.custom.pos.tp, 1.6); // 80% of the 2% group move
  await tick(101.8, [sig()]); // +1.6% after the buy fee
  assert.equal(st.custom.pos, null); assert.equal(st.trades[0].tag, 'herd target hit');
});

test('herd bot ignores movers (laggard mode), weak or stale calls, and chases', async () => {
  for (const s of [sig({ role: 'mover' }), sig({ confidence: 0.4 }), sig({ ageMin: 45 }), sig({ tokenMove: 2 }), sig({ dir: 'dump' })]) {
    const { st, tick } = herdBot(); await tick(100, [s]); assert.equal(st.tradeCount, 0, JSON.stringify(s));
  }
  const any = herdBot({ entryMode: 'any' }); await any.tick(100, [sig({ role: 'mover' })]); assert.equal(any.st.tradeCount, 1);
});

test('herd bot sells when the group starts dumping together', async () => {
  const { st, tick } = herdBot();
  await tick(100, [sig()]);
  await tick(100.2, [sig(), sig({ id: 'p2', dir: 'dump', confidence: 0.6 })]);
  assert.equal(st.trades[0].tag, 'group dumping');
});

test('pump rider herd guard pauses buying on a group dump', async () => {
  const bot = { type: 'pumpgrid', params: normalizeParams('pumpgrid', { ...defaultsFor('pumpgrid'), investment: 1000, autoStep: false, stepPct: 0.5 }) };
  const st = newState(bot); const exec = paperExec(st, 0.001, () => 0);
  STRATEGIES.pumpgrid.init(bot, 100, st);
  const flat = Array.from({ length: 80 }, (_, i) => ({ time: i * 60, open: 100, high: 100.05, low: 99.95, close: 100, volume: 1 }));
  await STRATEGIES.pumpgrid.tick(bot, { price: 100, candles: flat, now: 1 }, exec, st);
  const r = await STRATEGIES.pumpgrid.tick(bot, { price: 99.9, candles: flat, herd: [sig({ dir: 'dump' })], now: 2 }, exec, st);
  assert.equal(st.custom.mode, 'wait'); assert.match(r.notify.title, /Herd guard/);
});
