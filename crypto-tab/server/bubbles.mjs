// Performance for the Bubbles / Matrix / List views: hour, day, week, month and year change for
// the top coins on an exchange. Day change comes from the live tickers; the others from cached
// candles refreshed in the background (hourly candles every 5 min, daily candles every hour).
import * as X from './exchanges.mjs';

const STABLE = new Set(['USDC', 'USDT', 'FDUSD', 'DAI', 'TUSD', 'USD1', 'USDE', 'PYUSD', 'RLUSD', 'BUSD', 'EUR', 'EURC', 'USDD']);
const hourly = new Map(), daily = new Map();
const queue = []; let running = 0;

function enqueue(job) { queue.push(job); pump(); }
function pump() {
  while (running < 6 && queue.length) {
    const job = queue.shift(); running++;
    job().catch(() => {}).finally(() => { running--; pump(); });
  }
}

function refresh(exchange, sym) {
  const k = `${exchange}|${sym}`;
  const h = hourly.get(k);
  if (!h || (Date.now() - h.at > 5 * 60e3 && !h.busy)) {
    hourly.set(k, { ...(h || {}), busy: true, at: h?.at || 0 });
    enqueue(async () => { const c = await X.ohlcv(exchange, sym, '1h', 3); hourly.set(k, { at: Date.now(), c }); });
  }
  const d = daily.get(k);
  if (!d || (Date.now() - d.at > 60 * 60e3 && !d.busy)) {
    daily.set(k, { ...(d || {}), busy: true, at: d?.at || 0 });
    enqueue(async () => { const c = await X.ohlcv(exchange, sym, '1d', 370); daily.set(k, { at: Date.now(), c }); });
  }
}

const pct = (now, then) => (now && then ? +(((now - then) / then) * 100).toFixed(2) : null);

export async function bubbles({ exchange = 'mexc', quote = 'USDT', page = 1, size = 100 } = {}) {
  const m = await X.markets(exchange);
  const all = m.markets.filter((r) => r.q === quote && !STABLE.has(r.b) && r.v > 0 && /^[A-Z0-9]{1,12}$/.test(r.b) && !/^(GOLD|SILVER|XAU|PAXG)/.test(r.b));
  const rows = all.slice((page - 1) * size, page * size);
  const out = rows.map((r, i) => {
    const sym = r.s;
    refresh(exchange, sym);
    const h = hourly.get(`${exchange}|${sym}`)?.c, d = daily.get(`${exchange}|${sym}`)?.c;
    const back = (n) => (d && d.length > n ? d[d.length - 1 - n].close : null);
    return {
      rank: (page - 1) * size + i + 1, s: sym, b: r.b, p: r.p, v: r.v, st: r.st,
      h1: h && h.length >= 2 ? pct(r.p, h[h.length - 2].close) : null,
      d1: r.c != null ? +r.c.toFixed(2) : null,
      w1: pct(r.p, back(7)), m1: pct(r.p, back(30)), y1: pct(r.p, back(365)),
    };
  });
  return { exchange, quote, page, total: all.length, time: Date.now(), loading: queue.length + running, rows: out };
}
