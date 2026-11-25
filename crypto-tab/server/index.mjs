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
import { bubbles, topCoins } from './bubbles.mjs';
import * as TG from './telegram.mjs';
import * as Acc from './accounts.mjs';
import * as Bill from './billing.mjs';
import { accessToken, flushAll } from './store.mjs';
import { STRATEGIES, backtest, normalizeParams, defaultsFor } from '../public/shared/strategies.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const VENDOR = { '/vendor/lightweight-charts.js': path.join(here, '..', 'node_modules', 'lightweight-charts', 'dist', 'lightweight-charts.standalone.production.mjs') };
const PORT = Number(process.env.PORT || 8787);
const TOKEN = accessToken();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

const routes = [];
// options: open = no login needed · owner = owner only · pro = paid plan (or owner / free access)
const route = (method, pattern, handler, { open = false, owner = false, pro = null } = {}) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler, open, owner, pro });
};

// ---------- public market data ----------
route('GET', '/api/health', () => ({ ok: true, time: Date.now(), ai: AI.status(), bots: Bots.all().filter((b) => b.status === 'running').length }), { open: true });
route('GET', '/api/exchanges', () => X.EXCHANGES.map(([id, name]) => ({ id, name, password: X.NEEDS_PASSWORD.has(id) })), { open: true });
route('GET', '/api/markets', (q) => X.markets(q.ex || 'mexc'), { open: true });
route('GET', '/api/ticker', (q) => X.ticker(q.ex, q.symbol), { open: true });
route('GET', '/api/ohlcv', (q) => X.ohlcv(q.ex, q.symbol, q.tf || '1h', q.limit || 500, q.since), { open: true });
route('GET', '/api/book', (q) => X.orderbook(q.ex, q.symbol, Number(q.depth || 40)), { open: true });
route('GET', '/api/trades', (q) => X.trades(q.ex, q.symbol), { open: true });
route('GET', '/api/timeframes', (q) => X.timeframes(q.ex), { open: true });
route('GET', '/api/forecast', (q) => AI.forecastFor(q.ex, q.symbol, q.tf || '1h', Math.min(120, Number(q.h || 30))), { open: true });
route('GET', '/api/bubbles', async (q) => {
  const page = Number(q.page) || 1;
  if (q.source !== 'exchange') { try { return await topCoins({ page }); } catch { /* CoinGecko down: fall back to the exchange */ } }
  return bubbles({ exchange: q.ex || 'mexc', quote: q.quote || 'USDT', page });
}, { open: true });
route('GET', '/api/strategies', () => Object.fromEntries(Object.entries(STRATEGIES).map(([k, s]) => [k, { label: s.label, desc: s.desc, fields: s.fields, needsCandles: s.needsCandles }])), { open: true });
route('GET', '/api/push/key', () => ({ key: Alerts.vapidPublicKey() }), { open: true });
route('POST', '/api/login', (q, body) => { if (body.token !== TOKEN) throw X.httpError(401, 'Wrong passcode'); return { ok: true, token: TOKEN, user: Acc.view(Acc.OWNER) }; }, { open: true });

// ---------- accounts & subscription ----------
route('POST', '/api/auth/signup', (q, body) => Acc.signup(body), { open: true });
route('POST', '/api/auth/login', (q, body) => Acc.login(body), { open: true });
route('POST', '/api/auth/logout', (q, b, p, u, req) => Acc.logout(req.headers['x-ct-token']));
route('GET', '/api/me', (q, b, p, u) => ({ user: Acc.view(u), billing: Bill.config(), freeBots: [...Acc.FREE_BOTS] }));
route('GET', '/api/billing', () => Bill.config(), { open: true });
route('POST', '/api/billing/card', (q, b, p, u, req) => Bill.cardCheckout(u, originOf(req)));
route('POST', '/api/billing/card/confirm', (q, body, p, u) => Bill.cardConfirm(u, body.session));
route('POST', '/api/billing/card/cancel', (q, b, p, u) => Bill.cardCancel(u));
route('POST', '/api/billing/crypto', (q, body, p, u) => Bill.createInvoice(u, body.coin, body.months));
route('GET', '/api/billing/invoice/:id', async (q, b, p, u) => { await Bill.checkInvoices().catch(() => {}); return Bill.invoiceFor(u, p.id); });
// owner dashboard
route('GET', '/api/admin', () => ({ stats: Acc.stats(), users: Acc.adminList(), invoices: Bill.adminInvoices(), billing: Bill.config() }), { owner: true });
route('POST', '/api/admin/comp', (q, body) => Acc.adminComp(body.email, body.on !== false), { owner: true });
route('POST', '/api/admin/password', (q, body) => Acc.adminResetPassword(body.email, body.password), { owner: true });
route('POST', '/api/admin/grant', (q, body) => { const t = Acc.adminList().find((x) => x.email === String(body.email || '').toLowerCase()); if (!t) throw X.httpError(404, 'No such user'); return Acc.addPro(t.id, Number(body.days) || 30, { method: 'manual', usd: 0, ref: 'owner' }); }, { owner: true });
route('POST', '/api/admin/addresses', (q, body) => Bill.setAddresses(body), { owner: true });

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

// ---------- keys / account (every user has their own) ----------
const uidOf = (u) => u.id;
route('GET', '/api/keys', (q, b, p, u) => X.listKeys(uidOf(u)));
route('POST', '/api/keys/:ex', (q, body, p, u) => { X.saveKey(p.ex, body, uidOf(u)); return { ok: true }; });
route('DELETE', '/api/keys/:ex', (q, body, p, u) => { X.deleteKey(p.ex, uidOf(u)); return { ok: true }; });
route('GET', '/api/balance', (q, b, p, u) => (q.ex === 'paper' ? Paper.account(uidOf(u)) : X.balance(q.ex, uidOf(u))));
route('GET', '/api/orders', (q, b, p, u) => (q.ex === 'paper' ? Paper.account(uidOf(u)).orders : X.openOrders(q.ex, q.symbol, uidOf(u))));
route('POST', '/api/order', (q, body, p, u) => (body.mode === 'live' ? X.placeOrder(body.exchange, body, uidOf(u)) : Paper.order(body, uidOf(u))));
route('DELETE', '/api/order/:id', (q, body, p, u) => (q.ex === 'paper' ? Paper.cancel(p.id, uidOf(u)) : X.cancelOrder(q.ex, p.id, q.symbol, uidOf(u))));
// Fills for the buy/sell arrows: your bots + your paper account + your real exchange trades
route('GET', '/api/fills', async (q, b, p, u) => {
  const uid = uidOf(u);
  if (q.bot) return Bots.tradesFor({ bot: q.bot }, uid);
  const out = Bots.tradesFor({ exchange: q.ex, symbol: q.symbol }, uid);
  for (const f of Paper.account(uid).fills) if (f.symbol === q.symbol && f.exchange === q.ex) out.push({ time: f.closedAt || f.time, side: f.side, price: f.average || f.price, amount: f.amount, pnl: null, tag: f.type, source: 'paper' });
  if (X.listKeys(uid).some((k) => k.exchange === q.ex)) {
    try { for (const t of await X.myTrades(q.ex, q.symbol, uid)) out.push({ time: t.timestamp, side: t.side, price: t.price, amount: t.amount, pnl: null, tag: t.takerOrMaker || '', source: 'exchange' }); }
    catch { /* exchange may not support it for this pair */ }
  }
  return out.sort((a, b2) => a.time - b2.time);
});
route('POST', '/api/paper/reset', (q, body, p, u) => Paper.reset(Number(body.amount) || 10000, uidOf(u)));

// ---------- bots (your own; premium bots and live bots need Pro) ----------
const botGate = (u, type, mode) => {
  if (!Acc.FREE_BOTS.has(type)) Acc.requirePro(u, `The ${STRATEGIES[type]?.label || type} bot`);
  if (mode === 'live') Acc.requirePro(u, 'Live bot trading');
};
route('GET', '/api/bots', (q, b, p, u) => Bots.list(uidOf(u)));
route('POST', '/api/bots', (q, body, p, u) => { botGate(u, body.type, body.mode); return Bots.create(body, uidOf(u)); });
route('GET', '/api/bots/:id', (q, b, p, u) => Bots.view(Bots.get(p.id, uidOf(u))));
route('PATCH', '/api/bots/:id', (q, body, p, u) => { const bot = Bots.get(p.id, uidOf(u)); botGate(u, body.type || bot.type, body.mode || bot.mode); return Bots.update(p.id, body); });
route('POST', '/api/bots/:id/start', (q, b, p, u) => { const bot = Bots.get(p.id, uidOf(u)); botGate(u, bot.type, bot.mode); return Bots.startDraft(p.id); });
route('POST', '/api/bots/:id/pause', (q, b, p, u) => { Bots.get(p.id, uidOf(u)); return Bots.pause(p.id); });
route('POST', '/api/bots/:id/resume', (q, b, p, u) => { const bot = Bots.get(p.id, uidOf(u)); botGate(u, bot.type, bot.mode); return Bots.resume(p.id); });
route('POST', '/api/bots/:id/stop', (q, body, p, u) => { Bots.get(p.id, uidOf(u)); return Bots.stop(p.id, body); });
route('POST', '/api/bots/:id/lines', (q, body, p, u) => { Bots.get(p.id, uidOf(u)); return Bots.setLines(p.id, body); });
route('POST', '/api/bots/:id/duplicate', (q, b, p, u) => Bots.duplicate(p.id, uidOf(u)));
route('DELETE', '/api/bots/:id', (q, b, p, u) => { Bots.get(p.id, uidOf(u)); return Bots.remove(p.id); });
route('POST', '/api/backtest', async (q, body) => {
  const candles = await X.ohlcv(body.exchange, body.symbol, body.tf || body.params?.timeframe || '1h', 1000);
  const params = normalizeParams(body.type, { ...defaultsFor(body.type), ...body.params });
  return backtest(body.type, params, candles);
});

// ---------- AI (tuning a bot is Pro) ----------
route('GET', '/api/ai/status', () => AI.status());
route('POST', '/api/ai/bot/:id', (q, b, p, u) => { Bots.get(p.id, uidOf(u)); return AI.analyzeBot(p.id); }, { pro: 'AI bot tuning' });
route('POST', '/api/ai/draft', (q, body) => AI.analyzeDraft(body), { pro: 'AI auto-fill' });
route('POST', '/api/ai/symbol', (q, body) => AI.analyzeSymbol(body));
route('POST', '/api/ai/scan', (q, body) => AI.scan(body));
route('POST', '/api/ai/candles', (q, body) => AI.candleMeterScan(body));
route('POST', '/api/ai/explain', (q, body) => AI.explainSetting(body));
route('POST', '/api/ai/profile', (q, body) => AI.tokenProfile(body));
route('POST', '/api/ai/gridscan', (q, body) => AI.gridScan(body));

// ---------- alerts (your own) ----------
route('GET', '/api/alerts', (q, b, p, u) => Alerts.list(uidOf(u)));
route('POST', '/api/alerts', (q, body, p, u) => Alerts.create(body, uidOf(u)));
route('DELETE', '/api/alerts/:id', (q, b, p, u) => Alerts.remove(p.id, uidOf(u)));
route('POST', '/api/alerts/:id/ack', (q, b, p, u) => Alerts.ack(p.id, uidOf(u)));
route('POST', '/api/alerts/ack-all', (q, b, p, u) => Alerts.ackAll(uidOf(u)));
route('POST', '/api/push/subscribe', (q, body, p, u) => Alerts.subscribe(body, uidOf(u)));
route('GET', '/api/telegram', () => TG.status(), { owner: true });
route('POST', '/api/telegram', (q, body) => TG.configure(body), { owner: true });
route('POST', '/api/telegram/test', async () => { const ok = await TG.send('✅ <b>Crypto Tab</b> is connected. Alerts, profits, news and herd moves will arrive here. Try /price ZEC'); if (!ok) throw X.httpError(400, 'Add your chat id first (message your bot /start to get it)'); return { ok }; }, { owner: true });
route('POST', '/api/push/test', async (q, b, p, u) => { await Alerts.push({ uid: uidOf(u), kind: 'test', title: 'Crypto Tab', body: 'Notifications are working', tag: 'test' }); return { ok: true }; });

// ---------- server-sent events: alarms, trades, bot updates ----------
const clients = new Set();
function sse(req, res, user) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write(`event: hello\ndata: ${JSON.stringify({ ringing: Alerts.ringing(user.id) })}\n\n`);
  res.uid = user.id;
  clients.add(res);
  req.on('close', () => clients.delete(res));
}
// data.uid set → only that user's open apps get it; no uid → market-wide (news, herd) for everyone
const broadcast = (event, data) => { const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) if (data?.uid == null || c.uid === data.uid) c.write(msg); };
const originOf = (req) => process.env.CT_PUBLIC_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
Bots.events.on('alarm', (a) => broadcast('alarm', a));
Bots.events.on('alarm-stop', (a) => broadcast('alarm-stop', a));
Bots.events.on('trade', (t) => broadcast('trade', t));
Bots.events.on('bot', (b) => broadcast('bot', b));
Bots.events.on('notify', (n) => { broadcast('notify', n); if ((n.uid || 'owner') === 'owner') TG.notify(n); });
News.newsEvents.on('article', (a) => broadcast('news', a));
Herd.herdEvents.on('signal', (p) => broadcast('herd', p));
Herd.herdEvents.on('notify', (n) => { broadcast('notify', n); Alerts.push(n).catch(() => {}); TG.notify(n); });
News.newsEvents.on('notify', (n) => { broadcast('notify', n); Alerts.push(n).catch(() => {}); TG.notify(n); });
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
  const user = Acc.userFor(req.headers['x-ct-token'] || q.token);
  if (url.pathname === '/api/events') { if (!user) return sendJSON(res, 401, { error: 'Login required' }); return sse(req, res, user); }
  if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') { // raw body for the signature check
    let raw = ''; req.on('data', (d) => { raw += d; }); req.on('end', async () => { try { sendJSON(res, 200, await Bill.webhook(raw, req.headers['stripe-signature'])); } catch (e) { sendJSON(res, e.status || 400, { error: e.message }); } });
    return;
  }
  const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
  if (!r) return sendJSON(res, 404, { error: 'No such endpoint' });
  if (!r.open && !user) return sendJSON(res, 401, { error: 'Login required' });
  if (r.owner && user?.role !== 'owner') return sendJSON(res, 403, { error: 'Owner only' });
  try {
    if (r.pro) Acc.requirePro(user, r.pro);
    const m = url.pathname.match(r.re);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const body = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    sendJSON(res, 200, await r.handler(q, body, params, user, req));
  } catch (e) {
    const status = e.status || (/ccxt|Exchange|Network|Request/i.test(e.constructor?.name || '') ? 502 : 500);
    sendJSON(res, status, { error: String(e.message || e).replace(/\s+/g, ' ').slice(0, 300) });
  }
});

Bots.start();
Alerts.start();
Paper.start();
Bill.start();
News.start();
Herd.start();
// Telegram commands
TG.onCommand('price', async ([sym = 'ZEC']) => { const s = sym.toUpperCase().includes('/') ? sym.toUpperCase() : `${sym.toUpperCase()}/USDT`; const t = await X.ticker('mexc', s); return `<b>${s}</b> ${t.p} (${t.c > 0 ? '+' : ''}${(t.c ?? 0).toFixed(2)}% 24h)\nH ${t.h} · L ${t.l}`; });
TG.onCommand('bots', async () => { const l = Bots.list(); return l.length ? l.map((b) => `${b.status === 'running' ? '🟢' : b.status === 'paused' ? '⏸' : '⚪'} <b>${TG.esc(b.name)}</b> ${b.symbol}\n   P&L ${b.stats.pnl >= 0 ? '+' : ''}${b.stats.pnl.toFixed(2)} (${b.stats.pnlPct.toFixed(2)}%) · ${b.stats.trades} trades`).join('\n') : 'No bots yet.'; });
TG.onCommand('pause', async ([which = 'all']) => { const l = Bots.list().filter((b) => b.status === 'running' && (which === 'all' || b.id === which || b.symbol.startsWith(which.toUpperCase()))); l.forEach((b) => Bots.pause(b.id)); return `Paused ${l.length} bot(s).`; });
TG.onCommand('resume', async ([which = 'all']) => { const l = Bots.list().filter((b) => b.status === 'paused' && (which === 'all' || b.id === which || b.symbol.startsWith(which.toUpperCase()))); l.forEach((b) => Bots.resume(b.id)); return `Resumed ${l.length} bot(s).`; });
TG.onCommand('stop', async () => { const n = Alerts.ringing('owner').length; Alerts.ackAll('owner'); return n ? `🔕 Stopped ${n} alarm(s).` : 'No alarm is ringing.'; });
TG.onCommand('alerts', async () => { const l = Alerts.list().filter((a) => a.status !== 'done'); return l.length ? l.map((a) => `${a.status === 'ringing' ? '⏰' : '•'} ${a.symbol} ${a.condition} ${a.price ?? a.pct + '%'}`).join('\n') : 'No active alerts.'; });
TG.onCommand('news', async ([t = 'ZEC']) => { const b = await News.tokenBrief(t.toUpperCase()); return `📰 ${TG.esc(b.text)}\n\n${b.articles.slice(0, 4).map((a) => `• ${TG.esc(a.title)} (${TG.esc(a.source)})`).join('\n')}`; });
TG.onCommand('herd', async () => { const o = Herd.overview(); const s = o.live?.signals || []; return s.length ? s.map((p) => `${p.dir === 'pump' ? '🚀' : '🩸'} ${TG.esc(p.name)} ${p.dir}ing (${Math.round(p.breadth * 100)}%) · not moved yet: ${p.laggards.slice(0, 5).map((l) => l.t).join(', ') || 'none'}`).join('\n') : `No group is moving together right now. ${o.learning.learnedEvents} moves learned.`; });
TG.startPolling();
Alerts.setSink((n) => { if (n.kind === 'alarm') TG.notify(n); });
server.listen(PORT, () => {
  console.log(`Crypto Tab running on http://localhost:${PORT}`);
  console.log(`Passcode: ${TOKEN}   (set CT_TOKEN to choose your own)`);
  console.log(`AI analyst: ${AI.status().claude ? `Claude (${AI.status().model})` : 'quant engine only (set ANTHROPIC_API_KEY for Claude)'}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushAll(); process.exit(0); });
