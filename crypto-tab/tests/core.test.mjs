import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../public/shared/indicators.mjs';
import { backtest, STRATEGIES, defaultsFor, normalizeParams, gridLevels } from '../public/shared/strategies.mjs';
import { optimize, zones, suggestGrid } from '../public/shared/optimizer.mjs';
import { forecast } from '../public/shared/forecast.mjs';

function synth(n = 1500, seed = 3) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = []; let p = 100; const t0 = 1_700_000_000;
  for (let i = 0; i < n; i++) {
    const o = p; const ch = (r() - 0.5) * 0.02 + Math.sin(i / 60) * 0.002; p = o * (1 + ch);
    const hi = Math.max(o, p) * (1 + r() * 0.004), lo = Math.min(o, p) * (1 - r() * 0.004);
    out.push({ time: t0 + i * 3600, open: o, high: hi, low: lo, close: p, volume: 100 + r() * 50 });
  }
  return out;
}
const C = synth();

test('indicators align with input and stay in range', () => {
  const r = I.rsi(C); assert.equal(r.length, C.length);
  assert.ok(r.filter((v) => v != null).every((v) => v >= 0 && v <= 100));
  const m = I.macd(C); assert.equal(m.hist.length, C.length);
  const k = I.kdj(C); assert.equal(k.k.length, C.length);
  assert.ok(I.sma([1, 2, 3, 4], 2)[3] === 3.5);
  assert.ok(Math.abs(I.ema([1, 1, 1, 1], 2)[3] - 1) < 1e-12);
  for (const fn of ['cci', 'williamsR', 'obv', 'mfi', 'roc', 'sar', 'vwap']) assert.equal(I[fn](C).length, C.length, fn);
  assert.equal(I.dmi(C).adx.length, C.length);
  assert.equal(I.stochRsi(C).k.length, C.length);
});

test('grid levels', () => {
  const g = gridLevels(100, 200, 5, 'arithmetic'); assert.deepEqual(g, [100, 125, 150, 175, 200]);
  const q = gridLevels(100, 400, 3, 'geometric'); assert.ok(Math.abs(q[1] - 200) < 1e-9);
});

test('every strategy backtests without throwing and keeps the wallet sane', async () => {
  for (const type of Object.keys(STRATEGIES)) {
    const p = defaultsFor(type);
    if (type === 'grid') Object.assign(p, { lower: 80, upper: 125, grids: 25 });
    const r = await backtest(type, normalizeParams(type, p), C);
    assert.ok(Number.isFinite(r.finalEquity), type);
    assert.ok(r.finalEquity > 0, type);
    assert.ok(r.fees >= 0, type);
  }
});

test('grid makes round trips in a ranging market', async () => {
  const r = await backtest('grid', normalizeParams('grid', { lower: 80, upper: 125, grids: 30, investment: 1000 }), C);
  assert.ok(r.roundTrips > 10, `round trips ${r.roundTrips}`);
});

test('two grids on the same pair keep separate wallets', async () => {
  const a = await backtest('grid', normalizeParams('grid', { lower: 80, upper: 125, grids: 30, investment: 1000 }), C);
  const b = await backtest('grid', normalizeParams('grid', { lower: 95, upper: 110, grids: 10, investment: 300 }), C);
  assert.notEqual(a.finalEquity, b.finalEquity);
  assert.equal(b.investment, 300);
});

test('optimizer, zones, forecast', async () => {
  const o = await optimize('grid', { investment: 1000 }, C);
  assert.ok(o.best && o.best.params.lower < o.best.params.upper);
  const d = await optimize('dca', defaultsFor('dca'), C);
  assert.ok(d.best);
  const z = zones(C);
  assert.ok(z.buyZone[0] <= z.buyZone[1] && z.sellZone[0] <= z.sellZone[1]);
  const g = suggestGrid(C);
  assert.ok(g.lower < g.upper);
  const f = forecast(C, 3600, 30);
  assert.equal(f.points.length, 30);
  assert.ok(f.points.every((p) => p.lower <= p.mid && p.mid <= p.upper));
});
