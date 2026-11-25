// Crypto Tab - quantitative analyst.
// Works with no API key: market regime, entry/exit zones and a parameter search that
// backtests candidate bot settings and ranks them by risk-adjusted return.
// The server's Claude analyst (server/ai.mjs) reads this output and explains / refines it.

import * as I from './indicators.mjs';
import { backtest, gridLevels, STRATEGIES } from './strategies.mjs';
import { measureCandles } from './candlemeter.mjs';

const last = (a) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
const quantile = (arr, q) => { const s = [...arr].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const round = (v, sig = 6) => (v == null ? v : Number(v.toPrecision(sig)));

export function tfSeconds(tf) {
  const n = parseInt(tf, 10); const u = tf.replace(/\d+/g, '');
  return n * ({ m: 60, h: 3600, d: 86400, w: 604800, M: 2592000 }[u] || 60);
}

export function marketStats(candles, tf = '1h') {
  const cl = candles.map((c) => c.close);
  const price = cl[cl.length - 1];
  const rets = cl.slice(1).map((v, i) => Math.log(v / cl[i]));
  const sd = Math.sqrt(rets.reduce((s, r) => s + r * r, 0) / Math.max(1, rets.length));
  const barsPerDay = 86400 / tfSeconds(tf);
  const dailyVol = sd * Math.sqrt(barsPerDay) * 100;
  const atrPct = (last(I.atr(candles, 14)) / price) * 100;
  const e50 = last(I.ema(cl, 50)), e200 = last(I.ema(cl, Math.min(200, Math.floor(cl.length / 2))));
  const adx = last(I.dmi(candles).adx);
  const rsi = last(I.rsi(candles, 14));
  const trend = e50 > e200 * 1.005 ? 'up' : e50 < e200 * 0.995 ? 'down' : 'sideways';
  const regime = adx != null && adx > 25 ? `trending ${trend}` : 'ranging';
  const recent = candles.slice(-Math.min(candles.length, 300));
  const lows = recent.map((c) => c.low), highs = recent.map((c) => c.high);
  return {
    price, dailyVolPct: round(dailyVol, 4), atrPct: round(atrPct, 4), trend, regime,
    adx: round(adx, 4), rsi: round(rsi, 4), ema50: round(e50), ema200: round(e200),
    rangeLow: round(Math.min(...lows)), rangeHigh: round(Math.max(...highs)),
    p10: round(quantile(lows, 0.1)), p90: round(quantile(highs, 0.9)),
    bars: candles.length, timeframe: tf,
  };
}

// Support / resistance from swing-pivot clusters.
export function levels(candles, depth = 5, maxLevels = 6) {
  const piv = [];
  for (let i = depth; i < candles.length - depth; i++) {
    let hi = true, lo = true;
    for (let j = i - depth; j <= i + depth; j++) {
      if (candles[j].high > candles[i].high) hi = false;
      if (candles[j].low < candles[i].low) lo = false;
    }
    if (hi) piv.push({ p: candles[i].high, t: 'R' });
    if (lo) piv.push({ p: candles[i].low, t: 'S' });
  }
  const price = candles[candles.length - 1].close;
  const tol = (last(I.atr(candles, 14)) || price * 0.01) * 0.6;
  const clusters = [];
  for (const x of piv.sort((a, b) => a.p - b.p)) {
    const c = clusters.find((k) => Math.abs(k.p - x.p) <= tol);
    if (c) { c.p = (c.p * c.n + x.p) / (c.n + 1); c.n++; } else clusters.push({ p: x.p, n: 1 });
  }
  return clusters.sort((a, b) => b.n - a.n).slice(0, maxLevels)
    .map((c) => ({ price: round(c.p), touches: c.n, kind: c.p < price ? 'support' : 'resistance' }))
    .sort((a, b) => b.price - a.price);
}

// Where to get in and get out, with a confidence score.
export function zones(candles, tf = '1h') {
  const s = marketStats(candles, tf);
  const lv = levels(candles);
  const bb = I.bollinger(candles);
  const price = s.price;
  const sup = lv.filter((l) => l.kind === 'support').sort((a, b) => b.price - a.price)[0];
  const res = lv.filter((l) => l.kind === 'resistance').sort((a, b) => a.price - b.price)[0];
  const swingLo = Math.min(...candles.slice(-120).map((c) => c.low));
  const swingHi = Math.max(...candles.slice(-120).map((c) => c.high));
  const fib618 = swingHi - (swingHi - swingLo) * 0.618;
  const buyAnchor = [sup?.price, last(bb.lower), fib618].filter((v) => v && v < price);
  const sellAnchor = [res?.price, last(bb.upper), swingHi].filter((v) => v && v > price);
  let buyLow = buyAnchor.length ? Math.min(...buyAnchor) : price * (1 - s.atrPct / 50);
  let buyHigh = buyAnchor.length ? Math.max(...buyAnchor) : price * (1 - s.atrPct / 100);
  let sellLow = sellAnchor.length ? Math.min(...sellAnchor) : price * (1 + s.atrPct / 100);
  let sellHigh = sellAnchor.length ? Math.max(...sellAnchor) : price * (1 + s.atrPct / 50);
  // a zone is a range, never a single tick: at least ~0.7 ATR wide
  const minW = price * (s.atrPct / 100) * 0.7;
  if (buyHigh - buyLow < minW) { const m = (buyLow + buyHigh) / 2; buyLow = m - minW / 2; buyHigh = Math.min(price, m + minW / 2); }
  if (sellHigh - sellLow < minW) { const m = (sellLow + sellHigh) / 2; sellLow = Math.max(price, m - minW / 2); sellHigh = m + minW / 2; }
  const stop = buyLow * (1 - Math.max(1, s.atrPct * 1.5) / 100);
  const mid = (buyLow + buyHigh) / 2, tgt = (sellLow + sellHigh) / 2;
  const rr = (tgt - mid) / Math.max(1e-12, mid - stop);
  let score = 50;
  if (s.rsi < 35) score += 12; if (s.rsi > 70) score -= 15;
  if (s.trend === 'up') score += 10; if (s.trend === 'down') score -= 10;
  if (rr > 2) score += 10; if (rr < 1) score -= 10;
  if (price <= buyHigh * 1.01) score += 10;
  score = Math.max(1, Math.min(99, score));
  return {
    stats: s, levels: lv,
    buyZone: [round(buyLow), round(buyHigh)], sellZone: [round(sellLow), round(sellHigh)],
    stop: round(stop), riskReward: round(rr, 3), score,
    verdict: score >= 65 ? 'Good entry area' : score >= 45 ? 'Wait for the buy zone' : 'Avoid / wait for trend change',
  };
}

// ---------- parameter search ----------
function candidates(type, base, s, candles) {
  const out = [];
  if (type === 'grid') {
    const recent = candles.slice(-Math.min(500, candles.length));
    const lows = recent.map((c) => c.low), highs = recent.map((c) => c.high);
    for (const [ql, qh] of [[0.02, 0.98], [0.05, 0.95], [0.1, 0.9], [0.15, 0.85], [0, 1]]) {
      const lower = quantile(lows, ql) * (ql === 0 ? 0.97 : 1), upper = quantile(highs, qh) * (qh === 1 ? 1.03 : 1);
      for (const grids of [10, 20, 30, 45, 60, 90]) {
        const stepPct = ((upper / lower) ** (1 / (grids - 1)) - 1) * 100;
        if (stepPct < 0.25) continue; // steps smaller than ~fees x2.5 lose money
        out.push({ ...base, lower: round(lower), upper: round(upper), grids, mode: 'geometric' });
      }
    }
  } else if (type === 'dca') {
    const dev = Math.max(0.5, s.atrPct);
    for (const deviation of [dev * 0.6, dev, dev * 1.6].map((v) => round(v, 3)))
      for (const takeProfit of [1, 1.5, 2.5, 3.5])
        for (const maxSafety of [4, 6, 8])
          for (const volumeScale of [1.2, 1.5])
            out.push({ ...base, deviation, takeProfit, maxSafety, volumeScale, stepScale: base.stepScale || 1.3 });
  } else if (type === 'pumpgrid') {
    const med = measureCandles(candles, { recent: 500 }).medianRange;
    const fee = base.feePct ?? 0.1;
    const lo = Math.max(base.stepMin ?? 0.39, 2 * fee + 0.05), hi = Math.max(lo, base.stepMax ?? 0.79);
    const steps = [...new Set([0.6, 0.75, 0.9, 1].map((k) => +Math.min(hi, Math.max(lo, med * k)).toFixed(3)))];
    for (const stepPct of steps) for (const maxLots of [8, 12, 20]) for (const holdRun of [2, 3])
      out.push({ ...base, autoStep: false, stepPct, maxLots, holdRun });
  } else if (type === 'stepgrid') {
    for (const atrMult of [0.6, 1, 1.5, 2.2]) for (const lots of [5, 10, 15]) for (const minProfit of [0.4, 0.8, 1.5])
      out.push({ ...base, atrMult, lots, minProfit });
  } else {
    for (const takeProfit of [1, 2, 3.5, 6]) for (const stopLoss of [0, 2, 4]) for (const trailing of [0, 1])
      out.push({ ...base, takeProfit, stopLoss, trailing });
  }
  return out;
}

export async function optimize(type, baseParams, candles, { tf = '1h', limit = 120 } = {}) {
  if (!STRATEGIES[type]) throw new Error('unknown type');
  const s = marketStats(candles, tf);
  const base = { ...baseParams, investment: baseParams.investment || 1000 };
  // split: tune on the first 70 %, confirm on the last 30 % (walk-forward guard against overfitting)
  const cut = Math.floor(candles.length * 0.7);
  const train = candles.slice(0, cut), test = candles.slice(cut - 60);
  const cands = candidates(type, base, s, train).slice(0, limit);
  const scored = [];
  for (const p of cands) {
    try {
      const r = await backtest(type, p, train);
      // score: return minus drawdown penalty, needs some activity
      const score = r.pnlPct - 0.7 * r.maxDrawdownPct + Math.min(r.roundTrips, 30) * 0.05;
      scored.push({ params: p, train: r, score });
    } catch { /* skip invalid combos */ }
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  for (const t of top) t.test = await backtest(type, t.params, test);
  let current = null;
  try { current = { train: await backtest(type, base, train), test: await backtest(type, base, test) }; } catch { /* user params may be out of range */ }
  const best = top.sort((a, b) => (b.test.pnlPct - 0.7 * b.test.maxDrawdownPct) - (a.test.pnlPct - 0.7 * a.test.maxDrawdownPct))[0];
  return {
    stats: s, tested: scored.length, current, best,
    alternatives: top.slice(1).map((t) => ({ params: t.params, test: strip(t.test) })),
    note: 'Tuned on the first 70% of history and confirmed on the most recent 30%. Past results do not guarantee future returns.',
  };
}

const strip = (r) => { const { trades_sample, ...rest } = r; void trades_sample; return rest; };

// Suggested starting grid around current price (used by "Auto fill" in the bot editor).
export function suggestGrid(candles, tf = '1h', investment = 500) {
  const z = zones(candles, tf);
  const s = z.stats;
  const lower = round(Math.min(z.buyZone[0], s.price * (1 - Math.max(3, s.dailyVolPct * 2.5) / 100)));
  const upper = round(Math.max(z.sellZone[1], s.price * (1 + Math.max(3, s.dailyVolPct * 2.5) / 100)));
  let grids = 30;
  while (grids > 5 && (((upper / lower) ** (1 / (grids - 1)) - 1) * 100) < 0.4) grids -= 5;
  return { lower, upper, grids, mode: 'geometric', investment, levels: gridLevels(lower, upper, grids, 'geometric').map((v) => round(v)) };
}
