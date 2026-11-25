// Exchange connectivity through ccxt (MIT): one unified API for 100+ exchanges.
import ccxt from 'ccxt';
import { load, save, encrypt, decrypt } from './store.mjs';

// Major exchanges with public + trading APIs (roughly the top 30 by spot volume).
export const EXCHANGES = [
  ['binance', 'Binance'], ['binanceus', 'Binance.US'], ['coinbase', 'Coinbase Advanced'], ['kraken', 'Kraken'],
  ['okx', 'OKX'], ['bybit', 'Bybit'], ['kucoin', 'KuCoin'], ['gate', 'Gate.io'], ['mexc', 'MEXC'],
  ['bitget', 'Bitget'], ['htx', 'HTX'], ['cryptocom', 'Crypto.com'], ['bitfinex', 'Bitfinex'],
  ['bitstamp', 'Bitstamp'], ['gemini', 'Gemini'], ['bingx', 'BingX'], ['lbank', 'LBank'],
  ['whitebit', 'WhiteBIT'], ['poloniex', 'Poloniex'], ['upbit', 'Upbit'], ['phemex', 'Phemex'],
  ['xt', 'XT.com'], ['hyperliquid', 'Hyperliquid'], ['bitvavo', 'Bitvavo'], ['bitrue', 'Bitrue'],
  ['digifinex', 'DigiFinex'], ['woo', 'WOO X'], ['blofin', 'BloFin'], ['bithumb', 'Bithumb'],
  ['deribit', 'Deribit'], ['toobit', 'Toobit'], ['weex', 'WEEX'],
].filter(([id]) => ccxt.exchanges.includes(id));

// Exchanges whose API keys need a passphrase / password as well.
export const NEEDS_PASSWORD = new Set(['okx', 'kucoin', 'bitget', 'cryptocom', 'blofin', 'woo']);

// Tokenised stocks / ETFs listed on crypto exchanges (xStocks, Ondo, Bitget/Gate/MEXC stock tokens...)
const STOCKS = 'AAPL TSLA NVDA MSFT AMZN GOOGL GOOG META NFLX AMD COIN MSTR HOOD SPY QQQ PLTR INTC BABA CRCL GME ORCL AVGO LLY JPM UNH XOM DIS PYPL UBER SHOP IBM CRM ABNB SQ RIOT MARA IAU GLD TLT VTI DFDV'.split(' ');
export function isStock(base) {
  const b = base.toUpperCase().replace(/(X|ON|ST|\.?B)$/i, '');
  return STOCKS.includes(b) || STOCKS.includes(base.toUpperCase());
}

const pub = new Map();
const marketsLoaded = new Map();

export function publicClient(id) {
  if (!EXCHANGES.find(([x]) => x === id)) throw httpError(400, `Unsupported exchange ${id}`);
  if (!pub.has(id)) pub.set(id, new ccxt[id]({ enableRateLimit: true, timeout: 15000, options: { defaultType: 'spot' } }));
  return pub.get(id);
}

async function ready(ex) {
  if (!marketsLoaded.has(ex.id)) marketsLoaded.set(ex.id, ex.loadMarkets().catch((e) => { marketsLoaded.delete(ex.id); throw e; }));
  await marketsLoaded.get(ex.id);
  return ex;
}

export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

// --- small TTL cache so many phones can share one exchange call ---
const ttl = new Map();
async function cached(key, ms, fn) {
  const hit = ttl.get(key);
  if (hit && Date.now() - hit.t < ms) return hit.p;
  const p = fn();
  ttl.set(key, { t: Date.now(), p });
  p.catch(() => ttl.delete(key));
  return p;
}

const QUOTES = ['USDT', 'USDC', 'USD', 'EUR', 'FDUSD', 'BTC', 'ETH', 'USD1', 'TRY', 'KRW', 'GBP'];

export async function markets(id) {
  return cached(`m:${id}`, 8000, async () => {
    const ex = await ready(publicClient(id));
    let tickers = {};
    try { tickers = await ex.fetchTickers(); }
    catch { // some exchanges need symbols: fall back to the top USDT pairs
      const syms = Object.values(ex.markets).filter((m) => m.spot && m.active !== false && m.quote === 'USDT').slice(0, 80).map((m) => m.symbol);
      tickers = await ex.fetchTickers(syms);
    }
    const rows = [];
    for (const t of Object.values(tickers)) {
      const m = ex.markets[t.symbol];
      if (!m || !m.spot || m.active === false || !QUOTES.includes(m.quote)) continue;
      if (t.last == null) continue;
      const pctChange = t.percentage ?? (t.open ? ((t.last - t.open) / t.open) * 100 : null);
      rows.push({
        s: t.symbol, b: m.base, q: m.quote, p: t.last, c: pctChange,
        h: t.high, l: t.low, v: t.quoteVolume ?? (t.baseVolume && t.last ? t.baseVolume * t.last : 0),
        bid: t.bid, ask: t.ask, st: isStock(m.base) ? 1 : 0,
        pp: m.precision?.price, ap: m.precision?.amount, min: m.limits?.cost?.min ?? null,
      });
    }
    rows.sort((a, b) => (b.v || 0) - (a.v || 0));
    return { exchange: id, time: Date.now(), count: rows.length, markets: rows };
  });
}

export async function ticker(id, symbol) {
  return cached(`t:${id}:${symbol}`, 2000, async () => {
    const ex = await ready(publicClient(id));
    const t = await ex.fetchTicker(symbol);
    return { s: symbol, p: t.last, c: t.percentage, h: t.high, l: t.low, v: t.quoteVolume, bid: t.bid, ask: t.ask, time: t.timestamp };
  });
}

export async function ohlcv(id, symbol, tf = '1h', limit = 500, since) {
  return cached(`o:${id}:${symbol}:${tf}:${limit}:${since || ''}`, since ? 60000 : 4000, async () => {
    const ex = await ready(publicClient(id));
    if (ex.timeframes && !ex.timeframes[tf]) throw httpError(400, `${id} does not support ${tf}`);
    const raw = await ex.fetchOHLCV(symbol, tf, since ? Number(since) : undefined, Math.min(Number(limit) || 500, 1000));
    return raw.map(([t, o, h, l, c, v]) => ({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c, volume: v || 0 }));
  });
}

export async function orderbook(id, symbol, depth = 50) {
  return cached(`b:${id}:${symbol}`, 1000, async () => {
    const ex = await ready(publicClient(id));
    const ob = await ex.fetchOrderBook(symbol, depth > 20 ? (id === 'kraken' ? 100 : 50) : 20).catch(() => ex.fetchOrderBook(symbol));
    return { bids: ob.bids.slice(0, depth).map(([p, a]) => [p, a]), asks: ob.asks.slice(0, depth).map(([p, a]) => [p, a]), time: ob.timestamp || Date.now() };
  });
}

export async function trades(id, symbol) {
  return cached(`tr:${id}:${symbol}`, 1500, async () => {
    const ex = await ready(publicClient(id));
    const t = await ex.fetchTrades(symbol, undefined, 50);
    return t.slice(-50).reverse().map((x) => ({ p: x.price, a: x.amount, s: x.side, t: x.timestamp }));
  });
}

export function timeframes(id) {
  const ex = publicClient(id);
  return Object.keys(ex.timeframes || { '1m': 1, '5m': 1, '15m': 1, '1h': 1, '4h': 1, '1d': 1 });
}

// ---------------- private (API key) side ----------------
const priv = new Map();

export function listKeys() {
  const keys = load('keys', {});
  return Object.entries(keys).map(([id, v]) => ({ exchange: id, label: v.label, added: v.added, sandbox: !!v.sandbox }));
}

export function saveKey(id, { apiKey, secret, password, label, sandbox }) {
  if (!apiKey || !secret) throw httpError(400, 'API key and secret are required');
  publicClient(id);
  const keys = load('keys', {});
  keys[id] = { box: encrypt({ apiKey, secret, password }), label: label || id, added: Date.now(), sandbox: !!sandbox };
  save('keys', keys);
  priv.delete(id);
}

export function deleteKey(id) {
  const keys = load('keys', {});
  delete keys[id];
  save('keys', keys);
  priv.delete(id);
}

export async function privateClient(id) {
  if (priv.has(id)) return priv.get(id);
  const rec = load('keys', {})[id];
  if (!rec) throw httpError(400, `No API key saved for ${id}. Add one in Settings.`);
  const creds = decrypt(rec.box);
  const ex = new ccxt[id]({ ...creds, enableRateLimit: true, timeout: 20000, options: { defaultType: 'spot' } });
  if (rec.sandbox && ex.urls?.test) ex.setSandboxMode(true);
  await ex.loadMarkets();
  priv.set(id, ex);
  return ex;
}

export async function balance(id) {
  const ex = await privateClient(id);
  const b = await ex.fetchBalance();
  const rows = Object.entries(b.total || {}).filter(([, v]) => v > 0).map(([asset, total]) => ({ asset, total, free: b.free?.[asset] ?? 0, used: b.used?.[asset] ?? 0 }));
  return { exchange: id, balances: rows };
}

export async function placeOrder(id, { symbol, side, type = 'limit', amount, price, stopPrice, postOnly }) {
  const ex = await privateClient(id);
  const m = ex.market(symbol);
  amount = Number(ex.amountToPrecision(symbol, amount));
  if (price != null) price = Number(ex.priceToPrecision(symbol, price));
  if (!(amount > 0)) throw httpError(400, 'Amount too small for this market');
  if (m.limits?.cost?.min && price && amount * price < m.limits.cost.min) throw httpError(400, `Order value below exchange minimum of ${m.limits.cost.min} ${m.quote}`);
  const params = {};
  if (postOnly) params.postOnly = true;
  if (stopPrice) { params.stopPrice = Number(stopPrice); params.triggerPrice = Number(stopPrice); }
  const o = await ex.createOrder(symbol, type === 'stop' ? 'limit' : type, side, amount, type === 'market' ? undefined : price, params);
  return { id: o.id, status: o.status, symbol, side, type, amount: o.amount ?? amount, price: o.price ?? price, filled: o.filled, average: o.average };
}

export async function openOrders(id, symbol) {
  const ex = await privateClient(id);
  const os = await ex.fetchOpenOrders(symbol || undefined);
  return os.map((o) => ({ id: o.id, symbol: o.symbol, side: o.side, type: o.type, price: o.price, amount: o.amount, filled: o.filled, status: o.status, time: o.timestamp }));
}

export async function cancelOrder(id, orderId, symbol) {
  const ex = await privateClient(id);
  await ex.cancelOrder(orderId, symbol);
  return { ok: true };
}

export async function fetchOrder(id, orderId, symbol) {
  const ex = await privateClient(id);
  return ex.fetchOrder(orderId, symbol);
}
