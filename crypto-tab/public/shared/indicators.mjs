// Crypto Tab - technical indicators.
// Pure functions over candle arrays: {time, open, high, low, close, volume}.
// Shared by the browser chart, the bot engine and the AI analyst.
// Every function returns arrays aligned with the input (null where not yet defined).

const nz = (v) => (v == null || Number.isNaN(v) ? null : v);

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v;
      if (i === period - 1) { prev = seed / period; out[i] = prev; }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// Wilder's smoothing (RMA), used by RSI / ATR / DMI.
export function rma(values, period) {
  const out = new Array(values.length).fill(null);
  let prev = null, seed = 0, count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v; count++;
      if (count === period) { prev = seed / period; out[i] = prev; }
      continue;
    }
    prev = (prev * (period - 1) + v) / period;
    out[i] = prev;
  }
  return out;
}

export function wma(values, period) {
  const out = new Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += values[i - j] * (period - j);
    out[i] = s / denom;
  }
  return out;
}

export function stdev(values, period) {
  const out = new Array(values.length).fill(null);
  const m = sma(values, period);
  for (let i = period - 1; i < values.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += (values[i - j] - m[i]) ** 2;
    out[i] = Math.sqrt(s / period);
  }
  return out;
}

const closes = (c) => c.map((x) => x.close);
const trueRange = (c) => c.map((x, i) => (i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close))));

export function bollinger(c, period = 20, mult = 2) {
  const cl = closes(c);
  const mid = sma(cl, period);
  const sd = stdev(cl, period);
  return {
    mid,
    upper: mid.map((m, i) => (m == null ? null : m + mult * sd[i])),
    lower: mid.map((m, i) => (m == null ? null : m - mult * sd[i])),
  };
}

export function rsi(c, period = 14) {
  const cl = closes(c);
  const gains = cl.map((v, i) => (i === 0 ? 0 : Math.max(v - cl[i - 1], 0)));
  const losses = cl.map((v, i) => (i === 0 ? 0 : Math.max(cl[i - 1] - v, 0)));
  const g = rma(gains.slice(1), period), l = rma(losses.slice(1), period);
  const out = [null];
  for (let i = 0; i < g.length; i++) out.push(g[i] == null ? null : l[i] === 0 ? 100 : 100 - 100 / (1 + g[i] / l[i]));
  return out;
}

export function macd(c, fast = 12, slow = 26, signal = 9) {
  const cl = closes(c);
  const f = ema(cl, fast), s = ema(cl, slow);
  const dif = cl.map((_, i) => (f[i] == null || s[i] == null ? null : f[i] - s[i]));
  const firstIdx = dif.findIndex((v) => v != null);
  const sigPart = firstIdx < 0 ? [] : ema(dif.slice(firstIdx), signal);
  const dea = dif.map((_, i) => (i < firstIdx || firstIdx < 0 ? null : sigPart[i - firstIdx]));
  const hist = dif.map((d, i) => (d == null || dea[i] == null ? null : d - dea[i]));
  return { dif, dea, hist };
}

export function atr(c, period = 14) { return rma(trueRange(c), period); }

export function kdj(c, n = 9, m1 = 3, m2 = 3) {
  const K = [], D = [], J = [];
  let k = 50, d = 50;
  for (let i = 0; i < c.length; i++) {
    if (i < n - 1) { K.push(null); D.push(null); J.push(null); continue; }
    let hh = -Infinity, ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hh = Math.max(hh, c[j].high); ll = Math.min(ll, c[j].low); }
    const rsv = hh === ll ? 50 : ((c[i].close - ll) / (hh - ll)) * 100;
    k = (k * (m1 - 1) + rsv) / m1;
    d = (d * (m2 - 1) + k) / m2;
    K.push(k); D.push(d); J.push(3 * k - 2 * d);
  }
  return { k: K, d: D, j: J };
}

export function stochRsi(c, rsiLen = 14, stochLen = 14, kLen = 3, dLen = 3) {
  const r = rsi(c, rsiLen);
  const raw = r.map((v, i) => {
    if (v == null || i < stochLen) return null;
    const win = r.slice(i - stochLen + 1, i + 1).filter((x) => x != null);
    if (win.length < stochLen) return null;
    const hi = Math.max(...win), lo = Math.min(...win);
    return hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
  });
  const first = raw.findIndex((v) => v != null);
  const kPart = first < 0 ? [] : sma(raw.slice(first), kLen);
  const k = raw.map((_, i) => (first < 0 || i < first ? null : kPart[i - first]));
  const kFirst = k.findIndex((v) => v != null);
  const dPart = kFirst < 0 ? [] : sma(k.slice(kFirst), dLen);
  const d = k.map((_, i) => (kFirst < 0 || i < kFirst ? null : dPart[i - kFirst]));
  return { k, d };
}

export function cci(c, period = 20) {
  const tp = c.map((x) => (x.high + x.low + x.close) / 3);
  const m = sma(tp, period);
  return tp.map((v, i) => {
    if (m[i] == null) return null;
    let md = 0;
    for (let j = 0; j < period; j++) md += Math.abs(tp[i - j] - m[i]);
    md /= period;
    return md === 0 ? 0 : (v - m[i]) / (0.015 * md);
  });
}

export function williamsR(c, period = 14) {
  return c.map((x, i) => {
    if (i < period - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) { hh = Math.max(hh, c[j].high); ll = Math.min(ll, c[j].low); }
    return hh === ll ? -50 : ((hh - x.close) / (hh - ll)) * -100;
  });
}

export function obv(c) {
  let v = 0;
  return c.map((x, i) => {
    if (i > 0) v += x.close > c[i - 1].close ? x.volume : x.close < c[i - 1].close ? -x.volume : 0;
    return v;
  });
}

export function mfi(c, period = 14) {
  const tp = c.map((x) => (x.high + x.low + x.close) / 3);
  return c.map((_, i) => {
    if (i < period) return null;
    let pos = 0, neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const flow = tp[j] * c[j].volume;
      if (tp[j] > tp[j - 1]) pos += flow; else if (tp[j] < tp[j - 1]) neg += flow;
    }
    return neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
  });
}

export function roc(c, period = 12) {
  return c.map((x, i) => (i < period ? null : ((x.close - c[i - period].close) / c[i - period].close) * 100));
}

export function dmi(c, period = 14) {
  const plusDM = [0], minusDM = [0];
  for (let i = 1; i < c.length; i++) {
    const up = c[i].high - c[i - 1].high, down = c[i - 1].low - c[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = rma(trueRange(c), period), p = rma(plusDM, period), m = rma(minusDM, period);
  const pdi = tr.map((t, i) => (t ? (100 * p[i]) / t : null));
  const mdi = tr.map((t, i) => (t ? (100 * m[i]) / t : null));
  const dx = pdi.map((v, i) => (v == null || mdi[i] == null || v + mdi[i] === 0 ? null : (100 * Math.abs(v - mdi[i])) / (v + mdi[i])));
  const first = dx.findIndex((v) => v != null);
  const adxPart = first < 0 ? [] : rma(dx.slice(first), period);
  const adx = dx.map((_, i) => (first < 0 || i < first ? null : adxPart[i - first]));
  return { pdi, mdi, adx };
}

// Parabolic SAR
export function sar(c, step = 0.02, max = 0.2) {
  if (c.length < 2) return c.map(() => null);
  const out = [null];
  let up = c[1].close >= c[0].close;
  let af = step, ep = up ? c[0].high : c[0].low, s = up ? c[0].low : c[0].high;
  for (let i = 1; i < c.length; i++) {
    s = s + af * (ep - s);
    if (up) {
      s = Math.min(s, c[i - 1].low, i > 1 ? c[i - 2].low : c[i - 1].low);
      if (c[i].low < s) { up = false; s = ep; ep = c[i].low; af = step; }
      else if (c[i].high > ep) { ep = c[i].high; af = Math.min(af + step, max); }
    } else {
      s = Math.max(s, c[i - 1].high, i > 1 ? c[i - 2].high : c[i - 1].high);
      if (c[i].high > s) { up = true; s = ep; ep = c[i].high; af = step; }
      else if (c[i].low < ep) { ep = c[i].low; af = Math.min(af + step, max); }
    }
    out.push(s);
  }
  return out;
}

export function vwap(c) {
  let pv = 0, vol = 0, day = null;
  return c.map((x) => {
    const d = Math.floor(x.time / 86400);
    if (d !== day) { day = d; pv = 0; vol = 0; }
    const tp = (x.high + x.low + x.close) / 3;
    pv += tp * x.volume; vol += x.volume;
    return vol ? pv / vol : tp;
  });
}

export function supertrend(c, period = 10, mult = 3) {
  const a = atr(c, period);
  const line = [], dir = [];
  let fu = null, fl = null, trend = 1;
  for (let i = 0; i < c.length; i++) {
    if (a[i] == null) { line.push(null); dir.push(null); continue; }
    const hl2 = (c[i].high + c[i].low) / 2;
    const bu = hl2 + mult * a[i], bl = hl2 - mult * a[i];
    const pc = i > 0 ? c[i - 1].close : c[i].close;
    fu = fu == null || bu < fu || pc > fu ? bu : fu;
    fl = fl == null || bl > fl || pc < fl ? bl : fl;
    if (c[i].close > fu) trend = 1; else if (c[i].close < fl) trend = -1;
    line.push(trend === 1 ? fl : fu); dir.push(trend);
  }
  return { line, dir };
}

export function ichimoku(c, conv = 9, base = 26, spanB = 52, disp = 26) {
  const mid = (i, n) => {
    if (i < n - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) { hh = Math.max(hh, c[j].high); ll = Math.min(ll, c[j].low); }
    return (hh + ll) / 2;
  };
  const tenkan = c.map((_, i) => mid(i, conv));
  const kijun = c.map((_, i) => mid(i, base));
  const spanA = tenkan.map((t, i) => (t == null || kijun[i] == null ? null : (t + kijun[i]) / 2));
  const spanBv = c.map((_, i) => mid(i, spanB));
  // spans are displaced forward by `disp` bars (into the future)
  return { tenkan, kijun, spanA, spanB: spanBv, chikou: closes(c), disp };
}

export function donchian(c, period = 20) {
  const upper = [], lower = [];
  for (let i = 0; i < c.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue; }
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) { hh = Math.max(hh, c[j].high); ll = Math.min(ll, c[j].low); }
    upper.push(hh); lower.push(ll);
  }
  return { upper, lower, mid: upper.map((u, i) => (u == null ? null : (u + lower[i]) / 2)) };
}

export function keltner(c, period = 20, mult = 2) {
  const mid = ema(closes(c), period), a = atr(c, period);
  return { mid, upper: mid.map((m, i) => (m == null || a[i] == null ? null : m + mult * a[i])), lower: mid.map((m, i) => (m == null || a[i] == null ? null : m - mult * a[i])) };
}

// Catalogue used by the chart UI. `overlay` = drawn on price pane; otherwise a sub-pane.
export const INDICATORS = {
  MA:    { name: 'MA',    overlay: true,  params: { p1: 7, p2: 25, p3: 99 } },
  EMA:   { name: 'EMA',   overlay: true,  params: { p1: 9, p2: 21, p3: 55 } },
  WMA:   { name: 'WMA',   overlay: true,  params: { p1: 20 } },
  BOLL:  { name: 'BOLL',  overlay: true,  params: { period: 20, mult: 2 } },
  SAR:   { name: 'SAR',   overlay: true,  params: { step: 0.02, max: 0.2 } },
  VWAP:  { name: 'VWAP',  overlay: true,  params: {} },
  ST:    { name: 'SuperTrend', overlay: true, params: { period: 10, mult: 3 } },
  ICHI:  { name: 'Ichimoku', overlay: true, params: { conv: 9, base: 26, spanB: 52 } },
  DC:    { name: 'Donchian', overlay: true, params: { period: 20 } },
  KC:    { name: 'Keltner', overlay: true, params: { period: 20, mult: 2 } },
  VOL:   { name: 'VOL',   overlay: false, params: { ma: 20 } },
  MACD:  { name: 'MACD',  overlay: false, params: { fast: 12, slow: 26, signal: 9 } },
  RSI:   { name: 'RSI',   overlay: false, params: { period: 14 } },
  KDJ:   { name: 'KDJ',   overlay: false, params: { n: 9, m1: 3, m2: 3 } },
  STOCHRSI: { name: 'StochRSI', overlay: false, params: { rsi: 14, stoch: 14, k: 3, d: 3 } },
  CCI:   { name: 'CCI',   overlay: false, params: { period: 20 } },
  DMI:   { name: 'DMI',   overlay: false, params: { period: 14 } },
  OBV:   { name: 'OBV',   overlay: false, params: {} },
  ATR:   { name: 'ATR',   overlay: false, params: { period: 14 } },
  WR:    { name: 'WR',    overlay: false, params: { period: 14 } },
  MFI:   { name: 'MFI',   overlay: false, params: { period: 14 } },
  ROC:   { name: 'ROC',   overlay: false, params: { period: 12 } },
};

export { nz };
