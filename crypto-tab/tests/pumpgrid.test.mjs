import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRATEGIES, newState, paperExec, normalizeParams, defaultsFor, backtest, equity } from '../public/shared/strategies.mjs';
import { measureCandles, recommendStep, coverage } from '../public/shared/candlemeter.mjs';

// 1-minute market: sideways chop -> pump -> dump -> bottom -> sideways
function scenario(seed = 11) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = []; let p = 100; const t0 = 1_700_000_000;
  const phases = [['side', 300, 0], ['pump', 60, 0.0025], ['top', 15, 0], ['dump', 90, -0.0022], ['bottom', 25, 0], ['recover', 15, 0.0012], ['side', 300, 0]];
  for (const [name, n, drift] of phases) for (let i = 0; i < n; i++) {
    const o = p; p = o * (1 + drift + (r() - 0.5) * 0.006);
    const hi = Math.max(o, p) * (1 + r() * 0.0025), lo = Math.min(o, p) * (1 - r() * 0.0025);
    out.push({ time: t0 + out.length * 60, open: o, high: hi, low: lo, close: p, volume: 100, phase: name });
  }
  return out;
}
const C = scenario();

test('candle meter measures swing % and sets the step just under it', () => {
  const m = measureCandles(C);
  assert.ok(m.avgRange > 0.2 && m.avgRange < 1.5, `avg ${m.avgRange}`);
  const rec = recommendStep(m, { fee: 0.1, min: 0.39, max: 0.79 });
  assert.ok(rec.step >= 0.39 && rec.step <= 0.79);
  assert.ok(rec.step <= Math.max(0.39, m.medianRange)); // never above the typical swing unless the band forces it
  assert.ok(coverage(m, rec.step) >= 40, `coverage ${coverage(m, rec.step)}`);
});

test('pump rider: grids sideways, rides the pump, sells the top, waits, restarts after the bottom', async () => {
  const bot = { type: 'pumpgrid', params: normalizeParams('pumpgrid', { ...defaultsFor('pumpgrid'), investment: 1000 }) };
  const st = newState(bot);
  let clock = 0;
  const exec = paperExec(st, 0.001, () => clock);
  STRATEGIES.pumpgrid.init(bot, C[60].close, st);
  const modes = [];
  for (let i = 60; i < C.length; i++) {
    clock = C[i].time * 1000;
    const k = C[i];
    for (const price of (k.close >= k.open ? [k.open, k.low, k.high, k.close] : [k.open, k.high, k.low, k.close])) {
      await STRATEGIES.pumpgrid.tick(bot, { price, candles: C.slice(Math.max(0, i - 200), i + 1), now: clock }, exec, st);
      st.lastPrice = price;
    }
    if (modes[modes.length - 1]?.mode !== st.custom.mode) modes.push({ mode: st.custom.mode, phase: k.phase, i });
  }
  const seq = modes.map((m) => m.mode).join('>');
  console.log('phases:', modes.map((m) => `${m.mode}@${m.phase}`).join(' > '));
  console.log('events:', st.custom.events.slice().reverse().map((e) => e.msg).join('\n  '));
  assert.ok(seq.includes('grid>ride>wait>grid'), seq);
  const ride = modes.find((m) => m.mode === 'ride'); assert.equal(ride.phase, 'pump');
  const wait = modes.find((m) => m.mode === 'wait'); assert.ok(['top', 'pump', 'dump'].includes(wait.phase));
  const back = modes.filter((m) => m.mode === 'grid')[1]; assert.ok(['bottom', 'recover', 'side'].includes(back.phase), back.phase);
  // it must not have bought during the dump
  const dumpBuys = st.trades.filter((t) => t.side === 'buy' && C.find((k) => k.time * 1000 === t.time)?.phase === 'dump');
  assert.equal(dumpBuys.length, 0);
  const sideSells = st.trades.filter((t) => t.side === 'sell' && t.tag.includes('FIFO'));
  assert.ok(sideSells.length > 10, `fifo sells ${sideSells.length}`);
  assert.ok(sideSells.every((t) => t.pnl > 0), 'every FIFO grid sell is profitable');
  console.log('equity', equity(st, C[C.length - 1].close).toFixed(2), 'trades', st.tradeCount);
});

test('pump rider beats a plain step grid through a pump and dump', async () => {
  const pr = await backtest('pumpgrid', normalizeParams('pumpgrid', { ...defaultsFor('pumpgrid'), investment: 1000 }), C);
  const sg = await backtest('stepgrid', normalizeParams('stepgrid', { ...defaultsFor('stepgrid'), investment: 1000, timeframe: '1m' }), C);
  console.log(`pump rider ${pr.pnlPct.toFixed(2)}% (DD ${pr.maxDrawdownPct.toFixed(1)}%) vs step grid ${sg.pnlPct.toFixed(2)}% (DD ${sg.maxDrawdownPct.toFixed(1)}%) vs hold ${pr.buyHoldPct.toFixed(2)}%`);
  assert.ok(pr.pnlPct > sg.pnlPct);
});
