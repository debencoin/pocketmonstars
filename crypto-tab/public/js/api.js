// API client. Talks to the Crypto Tab server; falls back to demo data for public market
// endpoints when no server is reachable (so the UI still works as a preview).
import { store } from './ui.js';

const listeners = new Set();
export const conn = { state: 'idle', demo: false, ai: null };
const setConn = (s, demo = false) => { conn.state = s; conn.demo = demo; listeners.forEach((f) => f(conn)); };
export const onConn = (f) => { listeners.add(f); f(conn); };

export const base = () => (store.get('server') || '').replace(/\/$/, '');
export const token = () => store.get('token') || '';

export async function api(path, { method = 'GET', body, quiet } = {}) {
  if (conn.demo && demo.handles(path)) return demo.handle(path, method, body);
  let res;
  try {
    res = await fetch(base() + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-ct-token': token() },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (demo.handles(path)) { setConn('demo', true); return demo.handle(path, method, body); }
    setConn('err');
    throw new Error('Server unreachable. Check Settings → Server.');
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('json')) {
    if (demo.handles(path)) { setConn('demo', true); return demo.handle(path, method, body); }
    throw new Error(`Unexpected response (${res.status})`);
  }
  const j = await res.json();
  if (conn.state !== 'ok') setConn('ok');
  if (!res.ok) {
    const err = new Error(j.error || `Error ${res.status}`);
    err.status = res.status;
    if (res.status === 401 && !quiet) window.dispatchEvent(new CustomEvent('ct:login'));
    throw err;
  }
  return j;
}

export const qs = (o) => '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();

export async function probe() {
  try {
    const h = await api('/api/health', { quiet: true });
    if (h && h.ok && !h.demo) { conn.ai = h.ai; setConn('ok'); return h; }
  } catch { /* handled below */ }
  setConn('demo', true);
  return null;
}

// Server-sent events (alarms, trades, bot changes). Reconnects automatically.
export function events(handlers) {
  if (conn.demo || !token()) return () => {};
  let es, closed = false, retry = 1000;
  const open = () => {
    es = new EventSource(`${base()}/api/events?token=${encodeURIComponent(token())}`);
    for (const [ev, fn] of Object.entries(handlers)) es.addEventListener(ev, (m) => { try { fn(JSON.parse(m.data)); } catch { /* ignore */ } });
    es.onopen = () => { retry = 1000; };
    es.onerror = () => { es.close(); if (!closed) setTimeout(open, (retry = Math.min(retry * 2, 30000))); };
  };
  open();
  return () => { closed = true; es?.close(); };
}

// ---------------- demo data ----------------
const demo = (() => {
  const coins = [['BTC', 58700], ['ETH', 1640], ['SOL', 67.2], ['XRP', 0.52], ['BNB', 520], ['DOGE', 0.092], ['ADA', 0.29], ['HYPE', 57.3], ['SUI', 1.45], ['LINK', 9.8], ['AVAX', 15.4], ['TON', 3.1], ['PEPE', 0.0000071], ['NVDAON', 182.4], ['TSLAON', 318], ['AAPLX', 231]];
  const seedOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tfSec = (tf) => parseInt(tf, 10) * ({ m: 60, h: 3600, d: 86400, w: 604800 }[tf.replace(/\d+/g, '')] || 60);
  function candles(symbol, tf, limit = 500) {
    const base = coins.find((c) => symbol.startsWith(c[0] + '/'))?.[1] ?? 10;
    const r = rng(seedOf(symbol + tf));
    const step = tfSec(tf);
    const now = Math.floor(Date.now() / 1000 / step) * step;
    const out = []; let p = base * (0.85 + r() * 0.3);
    const vol = Math.min(0.03, 0.004 * Math.sqrt(step / 3600) + 0.002);
    for (let i = limit - 1; i >= 0; i--) {
      const o = p; const c = o * (1 + (r() - 0.5) * vol * 2 + Math.sin(i / 37) * vol * 0.15);
      out.push({ time: now - i * step, open: o, high: Math.max(o, c) * (1 + r() * vol * 0.6), low: Math.min(o, c) * (1 - r() * vol * 0.6), close: c, volume: 50 + r() * 300 });
      p = c;
    }
    const k = base / out[out.length - 1].close; // end at the reference price
    return out.map((x) => ({ ...x, open: x.open * k, high: x.high * k, low: x.low * k, close: x.close * k }));
  }
  const last = (s) => { const c = candles(s, '1h', 30); const live = c[c.length - 1].close * (1 + Math.sin(Date.now() / 9000) * 0.0008); return { c, live }; };
  const routes = {
    '/api/health': () => ({ ok: true, demo: true }),
    '/api/exchanges': () => [['mexc', 'MEXC'], ['binance', 'Binance'], ['coinbase', 'Coinbase Advanced'], ['kraken', 'Kraken'], ['okx', 'OKX'], ['bybit', 'Bybit'], ['gate', 'Gate.io'], ['kucoin', 'KuCoin'], ['bitget', 'Bitget']].map(([id, name]) => ({ id, name })),
    '/api/markets': () => ({ markets: coins.map(([b]) => { const { c, live } = last(b + '/USDT'); const o = c[c.length - 25].close; return { s: `${b}/USDT`, b, q: 'USDT', p: live, c: ((live - o) / o) * 100, v: live * 1e6 * (1 + (seedOf(b) % 50)), h: live * 1.03, l: live * 0.97, st: /ON$|X$/.test(b) ? 1 : 0 }; }) }),
    '/api/ticker': (q) => { const { c, live } = last(q.symbol); const o = c[c.length - 25].close; return { s: q.symbol, p: live, c: ((live - o) / o) * 100, h: live * 1.03, l: live * 0.97, v: 1e7 }; },
    '/api/ohlcv': (q) => { const c = candles(q.symbol, q.tf || '1h', Number(q.limit) || 500); const { live } = last(q.symbol); const lc = c[c.length - 1]; lc.close = live * (lc.close / c[c.length - 1].close); return c; },
    '/api/book': (q) => { const { live } = last(q.symbol); const r = rng(Math.floor(Date.now() / 1500)); const step = live * 0.0001; return { bids: Array.from({ length: 30 }, (_, i) => [live - step * (i + 1), r() * 3]), asks: Array.from({ length: 30 }, (_, i) => [live + step * (i + 1), r() * 3]) }; },
    '/api/trades': (q) => { const { live } = last(q.symbol); const r = rng(Math.floor(Date.now() / 2000)); return Array.from({ length: 30 }, (_, i) => ({ p: live * (1 + (r() - 0.5) * 0.0006), a: r() * 0.5, s: r() > 0.5 ? 'buy' : 'sell', t: Date.now() - i * 4000 })); },
    '/api/timeframes': () => ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
  };
  return {
    handles: (path) => Object.keys(routes).some((r) => path.split('?')[0] === r),
    handle: (path) => {
      const [p, query] = path.split('?');
      return Promise.resolve(routes[p](Object.fromEntries(new URLSearchParams(query || ''))));
    },
  };
})();
