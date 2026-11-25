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

// ---------- Top coins by market cap (CoinGecko, like Crypto Bubbles) ----------
// One call returns the top 250 with 1h/24h/7d/30d/1y change and a logo. Stablecoins and wrapped
// / staked copies are dropped so the 100 bubbles are 100 different coins. Cached for 90 s.
const SKIP = /^(W|ST|WE|CB|R|J|M|BS|LS|SO|EZ|RS|PU|SAV|S)?(BTC|ETH|SOL)$/;
let topCache = { at: 0, rows: null, p: null };
// Backup source when CoinGecko is rate-limited: CoinPaprika (no key; 1y change comes from the 1y ATH-free field set, so it may be missing).
export async function fetchPaprika() {
  const r = await fetch('https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=300', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`CoinPaprika ${r.status}`);
  const seen = new Set(), rows = [];
  for (const c of (await r.json()).sort((a, b) => a.rank - b.rank)) {
    const b = String(c.symbol || '').toUpperCase(), q = c.quotes?.USD || {};
    if (!b || !q.market_cap || STABLE.has(b) || seen.has(b) || /usd|euro|gold|wrapped|staked|bridged|restaked/i.test(c.name) || (SKIP.test(b) && !['BTC', 'ETH', 'SOL'].includes(b))) continue;
    seen.add(b);
    const f = (x) => (x == null ? null : +Number(x).toFixed(2));
    rows.push({ rank: rows.length + 1, mcRank: c.rank, s: `${b}/USDT`, b, name: c.name, img: `https://static.coinpaprika.com/coin/${c.id}/logo.png`, p: q.price, v: q.volume_24h, mc: q.market_cap,
      h1: f(q.percent_change_1h), d1: f(q.percent_change_24h), w1: f(q.percent_change_7d), m1: f(q.percent_change_30d), y1: f(q.percent_change_1y) });
  }
  return rows;
}

// Stablecoins, tokenised T-bills / funds and pegged assets barely move: they'd just be grey dots.
const pegged = (r) => /^USD|USD$|^EUR|^XAU|^PAXG/.test(r.b) || /treasury|fund|heloc|yield|t-?bill|money market/i.test(r.name)
  || (Math.abs(r.d1 ?? 0) < 0.2 && Math.abs(r.w1 ?? 0) < 0.6 && Math.abs(r.m1 ?? 0) < 1.2);
async function fetchTop() {
  let rows;
  try { rows = await fetchGecko(); } catch { rows = await fetchPaprika(); }
  return rows.filter((r) => !pegged(r)).map((r, i) => ({ ...r, rank: i + 1 }));
}

async function fetchGecko() {
  const u = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d,1y';
  const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': 'crypto-tab' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const j = await r.json();
  const seen = new Set();
  const rows = [];
  for (const c of j) {
    const b = String(c.symbol || '').toUpperCase();
    if (!b || STABLE.has(b) || seen.has(b) || /usd|euro|gold|wrapped|staked|bridged|restaked/i.test(c.name) || (SKIP.test(b) && !['BTC', 'ETH', 'SOL'].includes(b))) continue;
    seen.add(b);
    const f = (x) => (x == null ? null : +Number(x).toFixed(2));
    rows.push({
      rank: rows.length + 1, mcRank: c.market_cap_rank, s: `${b}/USDT`, b, name: c.name, img: c.image, p: c.current_price, v: c.total_volume, mc: c.market_cap,
      h1: f(c.price_change_percentage_1h_in_currency), d1: f(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h),
      w1: f(c.price_change_percentage_7d_in_currency), m1: f(c.price_change_percentage_30d_in_currency), y1: f(c.price_change_percentage_1y_in_currency),
    });
  }
  return rows;
}

export async function topCoins({ page = 1, size = 100 } = {}) {
  if (!topCache.rows || Date.now() - topCache.at > 90e3) {
    topCache.p ||= fetchTop().then((rows) => { topCache = { at: Date.now(), rows, p: null }; }).catch((e) => { topCache.p = null; if (!topCache.rows) throw e; });
    if (!topCache.rows) await topCache.p;
  }
  const all = topCache.rows;
  return { source: 'top', page, total: all.length, time: topCache.at, loading: 0, rows: all.slice((page - 1) * size, page * size) };
}
