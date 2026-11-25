// Crypto Tab server: static PWA + market data proxy + bot engine + alarms + AI analyst.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as X from './exchanges.mjs';
import * as Bots from './bots.mjs';
import * as Alerts from './alerts.mjs';
import * as Paper from './paper.mjs';
import * as AI from './ai.mjs';
import * as News from './news.mjs';
import * as Herd from './herd.mjs';
import { pumpClock } from './clock.mjs';
import { accessToken, flushAll } from './store.mjs';
import { STRATEGIES, backtest, normalizeParams, defaultsFor } from '../public/shared/strategies.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const VENDOR = { '/vendor/lightweight-charts.js': path.join(here, '..', 'node_modules', 'lightweight-charts', 'dist', 'lightweight-charts.standalone.production.mjs') };
const PORT = Number(process.env.PORT || 8787);
const TOKEN = accessToken();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const routes = [];
const route = (method, pattern, handler, { open = false } = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, open });
};

// ---------- public market data ----------
route('GET', '/api/health', () => ({ ok: true, time: Date.now(), ai: AI.status(), bots: Bots.list().filter((b) => b.status === 'running').length }), { open: true });
route('GET', '/api/exchanges', () => X.EXCHANGES.map(([id, name]) => ({ id, name, password: X.NEEDS_PASSWORD.has(id) })), { open: true });
route('GET', '/api/markets', (q) => X.markets(q.ex || 'mexc'), { open: true });
route('GET', '/api/ticker', (q) => X.ticker(q.ex, q.symbol), { open: true });
route('GET', '/api/ohlcv', (q) => X.ohlcv(q.ex, q.symbol, q.tf || '1h', q.limit || 500, q.since), { open: true });
route('GET', '/api/book', (q) => X.orderbook(q.ex, q.symbol, Number(q.depth || 40)), { open: true });
route('GET', '/api/trades', (q) => X.trades(q.ex, q.symbol), { open: true });
route('GET', '/api/timeframes', (q) => X.timeframes(q.ex), { open: true });
route('GET', '/api/forecast', (q) => AI.forecastFor(q.ex, q.symbol, q.tf || '1h', Math.min(120, Number(q.h || 30))), { open: true });
route('GET', '/api/strategies', () => Object.fromEntries(Object.entries(STRATEGIES).map(([k, s]) => [k, { label: s.label, desc: s.desc, fields: s.fields, needsCandles: s.needsCandles }])), { open: true });
route('GET', '/api/push/key', () => ({ key: Alerts.vapidPublicKey() }), { open: true });
route('POST', '/api/login', (q, body) => { if (body.token !== TOKEN) throw X.httpError(401, 'Wrong passcode'); return { ok: true }; }, { open: true });

// ---------- news & sentiment ----------
route('GET', '/api/news', (q) => News.list(q), { open: true });
route('GET', '/api/news/sentiment', (q) => News.sentimentIndex(q.tokens ? q.tokens.split(',') : undefined), { open: true });
route('GET', '/api/news/stats', (q) => News.stats({ token: q.token }), { open: true });
route('GET', '/api/news/signals', () => News.signals(), { open: true });
route('GET', '/api/news/markers', (q) => News.markers(String(q.token || '').toUpperCase(), Number(q.from) || 0), { open: true });
route('GET', '/api/news/feeds', () => News.feedStatus(), { open: true });
route('GET', '/api/news/learning', () => News.learning(), { open: true });
route('GET', '/api/news/brief', (q) => News.tokenBrief(q.token || 'ZEC'), { open: true });
route('POST', '/api/news/:id/vote', (q, body, p) => News.vote(p.id, body.kind));

// ---------- herd / correlation agent ----------
route('GET', '/api/herd', () => Herd.overview(), { open: true });
route('GET', '/api/herd/events', (q) => Herd.events({ days: Number(q.days) || 7, token: q.token ? String(q.token).toUpperCase() : undefined }), { open: true });
route('POST', '/api/herd/analyze', () => Herd.analyze());
route('GET', '/api/clock', (q) => pumpClock({ token: String(q.token || 'ZEC').toUpperCase(), months: q.months, tz: q.tz || 'America/Phoenix' }), { open: true });

// ---------- keys / account ----------
route('GET', '/api/keys', () => X.listKeys());
route('POST', '/api/keys/:ex', (q, body, p) => { X.saveKey(p.ex, body); return { ok: true }; });
route('DELETE', '/api/keys/:ex', (q, body, p) => { X.deleteKey(p.ex); return { ok: true }; });
route('GET', '/api/balance', (q) => (q.ex === 'paper' ? Paper.account() : X.balance(q.ex)));
route('GET', '/api/orders', (q) => (q.ex === 'paper' ? Paper.account().orders : X.openOrders(q.ex, q.symbol)));
route('POST', '/api/order', (q, body) => (body.mode === 'live' ? X.placeOrder(body.exchange, body) : Paper.order(body)));
route('DELETE', '/api/order/:id', (q, body, p) => (q.ex === 'paper' ? Paper.cancel(p.id) : X.cancelOrder(q.ex, p.id, q.symbol)));
// Fills for the buy/sell arrows: bots + paper account + real exchange trades (when a key is saved)
route('GET', '/api/fills', async (q) => {
  if (q.bot) return Bots.tradesFor({ bot: q.bot });
  const out = Bots.tradesFor({ exchange: q.ex, symbol: q.symbol });
  for (const f of Paper.account().fills) if (f.symbol === q.symbol && f.exchange === q.ex) out.push({ time: f.closedAt || f.time, side: f.side, price: f.average || f.price, amount: f.amount, pnl: null, tag: f.type, source: 'paper' });
  if (X.listKeys().some((k) => k.exchange === q.ex)) {
    try {
      const ex = await X.privateClient(q.ex);
      const mine = await ex.fetchMyTrades(q.symbol, Date.now() - 30 * 864e5, 500);
      for (const t of mine) out.push({ time: t.timestamp, side: t.side, price: t.price, amount: t.amount, pnl: null, tag: t.takerOrMaker || '', source: 'exchange' });
    } catch { /* exchange may not support it for this pair */ }
  }
  return out.sort((a, b) => a.time - b.time);
});
route('POST', '/api/paper/reset', (q, body) => Paper.reset(Number(body.amount) || 10000));

// ---------- bots ----------
route('GET', '/api/bots', () => Bots.list());
route('POST', '/api/bots', (q, body) => Bots.create(body));
route('GET', '/api/bots/:id', (q, b, p) => Bots.view(Bots.get(p.id)));
route('PATCH', '/api/bots/:id', (q, body, p) => Bots.update(p.id, body));
route('POST', '/api/bots/:id/start', (q, b, p) => Bots.startDraft(p.id));
route('POST', '/api/bots/:id/pause', (q, b, p) => Bots.pause(p.id));
route('POST', '/api/bots/:id/resume', (q, b, p) => Bots.resume(p.id));
route('POST', '/api/bots/:id/stop', (q, body, p) => Bots.stop(p.id, body));
route('POST', '/api/bots/:id/lines', (q, body, p) => Bots.setLines(p.id, body));
route('POST', '/api/bots/:id/duplicate', (q, b, p) => Bots.duplicate(p.id));
route('DELETE', '/api/bots/:id', (q, b, p) => Bots.remove(p.id));
route('POST', '/api/backtest', async (q, body) => {
  const candles = await X.ohlcv(body.exchange, body.symbol, body.tf || body.params?.timeframe || '1h', 1000);
  const params = normalizeParams(body.type, { ...defaultsFor(body.type), ...body.params });
  return backtest(body.type, params, candles);
});

// ---------- AI ----------
route('GET', '/api/ai/status', () => AI.status());
route('POST', '/api/ai/bot/:id', (q, b, p) => AI.analyzeBot(p.id));
route('POST', '/api/ai/draft', (q, body) => AI.analyzeDraft(body));
route('POST', '/api/ai/symbol', (q, body) => AI.analyzeSymbol(body));
route('POST', '/api/ai/scan', (q, body) => AI.scan(body));
route('POST', '/api/ai/candles', (q, body) => AI.candleMeterScan(body));
route('POST', '/api/ai/explain', (q, body) => AI.explainSetting(body));
route('POST', '/api/ai/profile', (q, body) => AI.tokenProfile(body));
route('POST', '/api/ai/gridscan', (q, body) => AI.gridScan(body));

// ---------- alerts ----------
route('GET', '/api/alerts', () => Alerts.list());
route('POST', '/api/alerts', (q, body) => Alerts.create(body));
route('DELETE', '/api/alerts/:id', (q, b, p) => Alerts.remove(p.id));
route('POST', '/api/alerts/:id/ack', (q, b, p) => Alerts.ack(p.id));
route('POST', '/api/alerts/ack-all', () => Alerts.ackAll());
route('POST', '/api/push/subscribe', (q, body) => Alerts.subscribe(body));
route('POST', '/api/push/test', async () => { await Alerts.push({ kind: 'test', title: 'Crypto Tab', body: 'Notifications are working', tag: 'test' }); return { ok: true }; });

// ---------- server-sent events: alarms, trades, bot updates ----------
const clients = new Set();
function sse(req, res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write(`event: hello\ndata: ${JSON.stringify({ ringing: Alerts.ringing() })}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
}
const broadcast = (event, data) => { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) c.write(msg); };
Bots.events.on('alarm', (a) => broadcast('alarm', a));
Bots.events.on('alarm-stop', (a) => broadcast('alarm-stop', a));
Bots.events.on('trade', (t) => broadcast('trade', t));
Bots.events.on('bot', (b) => broadcast('bot', b));
Bots.events.on('notify', (n) => broadcast('notify', n));
News.newsEvents.on('article', (a) => broadcast('news', a));
Herd.herdEvents.on('signal', (p) => broadcast('herd', p));
Herd.herdEvents.on('notify', (n) => { broadcast('notify', n); Alerts.push(n).catch(() => {}); });
News.newsEvents.on('notify', (n) => { broadcast('notify', n); Alerts.push(n).catch(() => {}); });
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 20000);

// ---------- http plumbing ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 1e6) reject(X.httpError(413, 'Body too large')); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(X.httpError(400, 'Bad JSON')); } });
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let file = VENDOR[pathname];
  if (!file) {
    const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { // SPA fallback
      if (!path.extname(pathname)) return serveStatic(req, res, '/');
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': pathname === '/sw.js' || ext === '.html' ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const q = Object.fromEntries(url.searchParams);
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const authed = req.headers['x-ct-token'] === TOKEN || q.token === TOKEN;
  if (url.pathname === '/api/events') { if (!authed) return sendJSON(res, 401, { error: 'Login required' }); return sse(req, res); }
  const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
  if (!r) return sendJSON(res, 404, { error: 'No such endpoint' });
  if (!r.open && !authed) return sendJSON(res, 401, { error: 'Login required' });
  try {
    const m = url.pathname.match(r.re);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    sendJSON(res, 200, await r.handler(q, body, params));
  } catch (e) {
    const status = e.status || (/ccxt|Exchange|Network|Request/i.test(e.constructor?.name || '') ? 502 : 500);
    sendJSON(res, status, { error: String(e.message || e).replace(/\s+/g, ' ').slice(0, 300) });
  }
});

Bots.start();
Alerts.start();
Paper.start();
News.start();
Herd.start();
server.listen(PORT, () => {
  console.log(`Crypto Tab running on http://localhost:${PORT}`);
  console.log(`Passcode: ${TOKEN}   (set CT_TOKEN to choose your own)`);
  console.log(`AI analyst: ${AI.status().claude ? `Claude (${AI.status().model})` : 'quant engine only (set ANTHROPIC_API_KEY for Claude)'}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushAll(); process.exit(0); });
