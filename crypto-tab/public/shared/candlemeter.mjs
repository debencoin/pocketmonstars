// Candle meter: measures how far price really travels inside each candle, per timeframe,
// and turns that into a grid step that sits just under the typical candle swing, so a
// high-frequency grid can buy near the low and sell near the high of as many candles as possible.

const quant = (sorted, q) => { if (!sorted.length) return 0; const i = (sorted.length - 1) * q; const lo = Math.floor(i); return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo); };
const r4 = (v) => Math.round(v * 10000) / 10000;

export const TF_SECONDS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 };

// Per-candle statistics. range% = (high - low) / low; body% = |close - open| / open.
export function measureCandles(candles, { recent = 300 } = {}) {
  const c = candles.slice(-recent);
  const ranges = c.map((k) => ((k.high - k.low) / k.low) * 100);
  const bodies = c.map((k) => (Math.abs(k.close - k.open) / k.open) * 100);
  const upWicks = c.map((k) => ((k.high - Math.max(k.open, k.close)) / k.low) * 100);
  const downWicks = c.map((k) => ((Math.min(k.open, k.close) - k.low) / k.low) * 100);
  const sr = [...ranges].sort((a, b) => a - b);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  return {
    candles: c.length,
    avgRange: r4(mean(ranges)),
    medianRange: r4(quant(sr, 0.5)),
    p25Range: r4(quant(sr, 0.25)),
    p75Range: r4(quant(sr, 0.75)),
    p90Range: r4(quant(sr, 0.9)),
    avgBody: r4(mean(bodies)),
    avgUpWick: r4(mean(upWicks)),
    avgDownWick: r4(mean(downWicks)),
    greenShare: r4((c.filter((k) => k.close >= k.open).length / Math.max(1, c.length)) * 100),
    ranges, // raw, for coverage calculations
  };
}

// Share of candles whose swing is at least `step` % (they can complete a buy-low / sell-high).
export function coverage(stats, step) {
  if (!stats.ranges.length) return 0;
  return (stats.ranges.filter((r) => r >= step).length / stats.ranges.length) * 100;
}

// Grid step "right under" the typical candle swing, clamped to the user's band and to fees.
// fee is the per-fill fee in % (0.1 = 0.1 %). A round trip pays it twice.
export function recommendStep(stats, { fee = 0.1, min = 0.39, max = 0.79, under = 0.9 } = {}) {
  const feeFloor = 2 * fee + 0.05; // anything tighter loses to fees
  const raw = stats.medianRange * under;
  const step = Math.min(max, Math.max(min, feeFloor, raw));
  const net = step - 2 * fee;
  const cov = coverage(stats, step);
  return {
    step: r4(step),
    rawStep: r4(raw),
    feeFloor: r4(feeFloor),
    netPerTrip: r4(net),
    coverage: r4(cov),
    clamped: step !== raw ? (raw < step ? (raw < feeFloor ? 'raised to beat fees' : 'raised to your minimum') : 'lowered to your maximum') : null,
  };
}

// Rough expectation, used only to rank timeframes before a real backtest confirms it.
export function estimate(stats, tf, rec) {
  const perDay = 86400 / (TF_SECONDS[tf] || 60);
  const trips = perDay * (rec.coverage / 100) * 0.5; // about half of reachable swings line up with an open lot
  return { candlesPerDay: Math.round(perDay), tripsPerDay: r4(trips), grossPctPerDayPerLot: r4(trips * rec.netPerTrip) };
}

export function strip(stats) { const { ranges, ...rest } = stats; void ranges; return rest; }
