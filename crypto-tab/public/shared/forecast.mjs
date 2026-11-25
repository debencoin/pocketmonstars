// Crypto Tab - "look into the future".
// An ensemble of two lightweight forecasters that run anywhere (browser or server):
//   1. Analog matcher: finds the past windows whose shape best matches the latest bars
//      (z-normalised, nearest-neighbour) and averages what happened next. Same idea as
//      candle-sequence models such as Kronos, at a fraction of the cost.
//   2. Bootstrapped Monte Carlo: resamples recent returns to build a probability cone.
// If a Kronos model server is configured on the backend (KRONOS_URL) its forecast is used instead.

function znorm(a) {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1;
  return a.map((v) => (v - m) / sd);
}

function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function analogForecast(candles, horizon = 30, win = 40, k = 12) {
  const cl = candles.map((c) => Math.log(c.close));
  const n = cl.length;
  if (n < win + horizon + 50) return null;
  const target = znorm(cl.slice(n - win));
  const matches = [];
  for (let s = 0; s + win + horizon < n - win; s += 1) {
    const w = znorm(cl.slice(s, s + win));
    let d = 0;
    for (let i = 0; i < win; i++) d += (w[i] - target[i]) ** 2;
    matches.push({ s, d });
  }
  matches.sort((a, b) => a.d - b.d);
  const best = matches.slice(0, k);
  const path = new Array(horizon).fill(0);
  let wsum = 0;
  for (const m of best) {
    const w = 1 / (1e-6 + m.d);
    wsum += w;
    const base = cl[m.s + win - 1];
    for (let h = 0; h < horizon; h++) path[h] += w * (cl[m.s + win + h] - base);
  }
  return path.map((v) => v / wsum); // cumulative log-return per step
}

export function monteCarlo(candles, horizon = 30, sims = 400, lookback = 300, seed = 7) {
  const cl = candles.map((c) => c.close).slice(-lookback - 1);
  const rets = cl.slice(1).map((v, i) => Math.log(v / cl[i]));
  const rnd = mulberry32(seed);
  const paths = [];
  for (let s = 0; s < sims; s++) {
    let acc = 0; const p = [];
    for (let h = 0; h < horizon; h++) { acc += rets[Math.floor(rnd() * rets.length)]; p.push(acc); }
    paths.push(p);
  }
  const q = (h, qq) => { const col = paths.map((p) => p[h]).sort((a, b) => a - b); return col[Math.floor(qq * (col.length - 1))]; };
  return Array.from({ length: horizon }, (_, h) => ({ p10: q(h, 0.1), p50: q(h, 0.5), p90: q(h, 0.9) }));
}

// Returns future points: [{time, mid, upper, lower}] in price units.
export function forecast(candles, tfSec, horizon = 30) {
  const lastC = candles[candles.length - 1];
  const p0 = lastC.close;
  const mc = monteCarlo(candles, horizon);
  const an = analogForecast(candles, horizon);
  const out = [];
  for (let h = 0; h < horizon; h++) {
    // remove Monte Carlo drift (noise-centred) and use analog path as the expected drift
    const center = an ? an[h] * 0.6 + mc[h].p50 * 0.4 : mc[h].p50;
    const spreadHi = mc[h].p90 - mc[h].p50, spreadLo = mc[h].p50 - mc[h].p10;
    out.push({
      time: lastC.time + tfSec * (h + 1),
      mid: p0 * Math.exp(center),
      upper: p0 * Math.exp(center + spreadHi),
      lower: p0 * Math.exp(center - spreadLo),
    });
  }
  const end = out[out.length - 1];
  return {
    model: an ? 'analog+montecarlo' : 'montecarlo',
    horizon, points: out,
    expectedMovePct: ((end.mid - p0) / p0) * 100,
    rangePct: [((end.lower - p0) / p0) * 100, ((end.upper - p0) / p0) * 100],
    bias: end.mid > p0 * 1.002 ? 'bullish' : end.mid < p0 * 0.998 ? 'bearish' : 'neutral',
  };
}
