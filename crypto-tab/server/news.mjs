// News & sentiment engine (CryptoPanic-style aggregator + a trading agent on top).
//
//  1. Pulls 20+ crypto news sources every 90 s (RSS + Binance listing announcements, plus
//     Zcash sources: Electric Coin Co, Zcash Foundation, Zcash forum).
//  2. Tags each article with the tokens it is about, scores sentiment / importance / category
//     (lexicon always; Claude on top when ANTHROPIC_API_KEY is set).
//  3. Measures what each token's price did 15 min, 1 h, 4 h and 24 h after the article came out
//     (from 5-minute candles), and keeps statistics per sentiment and per category.
//  4. Turns fresh news into trade signals sized from those statistics and the token's volatility,
//     feeds them to bots (News Sentiment bot, news guard on grids) and sends notifications.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { XMLParser } from 'fast-xml-parser';
import Anthropic from '@anthropic-ai/sdk';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';
import * as I from '../public/shared/indicators.mjs';
import { analyze, tagTokens, stripHtml } from '../public/shared/sentiment.mjs';

export const newsEvents = new EventEmitter();
const EX = process.env.CT_NEWS_EXCHANGE || 'mexc';
const WATCH = new Set((process.env.CT_NEWS_WATCH || 'ZEC,BTC,ETH,SOL,XRP').split(',').map((s) => s.trim().toUpperCase()));
const UA = 'Mozilla/5.0 (compatible; CryptoTab news reader)';
const HORIZONS = [15, 60, 240, 1440]; // minutes after the news

export const FEEDS = [
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { id: 'theblock', name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { id: 'decrypt', name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { id: 'blockworks', name: 'Blockworks', url: 'https://blockworks.co/feed' },
  { id: 'defiant', name: 'The Defiant', url: 'https://thedefiant.io/feed' },
  { id: 'bitcoinmagazine', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/' },
  { id: 'cryptoslate', name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { id: 'cryptopotato', name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' },
  { id: 'newsbtc', name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/' },
  { id: 'bitcoinist', name: 'Bitcoinist', url: 'https://bitcoinist.com/feed/' },
  { id: 'utoday', name: 'U.Today', url: 'https://u.today/rss' },
  { id: 'beincrypto', name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { id: 'ambcrypto', name: 'AMBCrypto', url: 'https://ambcrypto.com/feed/' },
  { id: 'dailyhodl', name: 'The Daily Hodl', url: 'https://dailyhodl.com/feed/' },
  { id: 'cryptonews', name: 'Cryptonews', url: 'https://cryptonews.com/news/feed/' },
  { id: 'coinjournal', name: 'CoinJournal', url: 'https://coinjournal.net/feed/' },
  { id: 'binance', name: 'Binance Announcements', url: 'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=20', kind: 'binance', boost: 0.35 },
  { id: 'ecc', name: 'Electric Coin Co (Zcash)', url: 'https://electriccoin.co/feed/', token: 'ZEC', boost: 0.15 },
  { id: 'zfnd', name: 'Zcash Foundation', url: 'https://zfnd.org/feed/', token: 'ZEC', boost: 0.1 },
  { id: 'zforum', name: 'Zcash Forum', url: 'https://forum.zcashcommunity.com/latest.rss', token: 'ZEC', boost: -0.1 },
];

const db = load('news', { articles: [], feeds: {} });
const persist = () => save('news', db);
const byId = new Map(db.articles.map((a) => [a.id, a]));
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
let bases = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ZEC']);
let botTokens = new Set();
export const setBotTokens = (list) => { botTokens = new Set(list); };

async function refreshBases() {
  try { const m = await X.markets(EX); bases = new Set(m.markets.filter((r) => r.q === 'USDT').map((r) => r.b)); } catch { /* keep last */ }
}

function idOf(link, title) { return crypto.createHash('sha1').update(String(link || title)).digest('hex').slice(0, 14); }

function itemsFrom(feed, body) {
  if (feed.kind === 'binance') {
    const j = JSON.parse(body);
    return (j.data?.catalogs?.[0]?.articles || []).map((a) => ({ title: a.title, link: `https://www.binance.com/en/support/announcement/${a.code}`, published: a.releaseDate, summary: '' }));
  }
  const x = parser.parse(body);
  const items = x?.rss?.channel?.item || x?.feed?.entry || x?.['rdf:RDF']?.item || [];
  return (Array.isArray(items) ? items : [items]).map((it) => {
    const link = typeof it.link === 'string' ? it.link : it.link?.['@href'] || (Array.isArray(it.link) ? it.link[0]?.['@href'] : '') || it.guid?.['#text'] || it.guid;
    const date = it.pubDate || it.published || it.updated || it['dc:date'];
    return { title: stripHtml(typeof it.title === 'object' ? it.title['#text'] : it.title), link, published: date ? Date.parse(date) : Date.now(), summary: stripHtml(it.description || it.summary || it['content:encoded'] || '').slice(0, 400) };
  });
}

async function pollFeed(feed) {
  const st = (db.feeds[feed.id] ||= { ok: 0, fail: 0 });
  try {
    const r = await fetch(feed.url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, application/json, text/xml, */*' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const items = itemsFrom(feed, await r.text());
    let added = 0;
    for (const it of items.slice(0, 40)) {
      if (!it.title) continue;
      const id = idOf(it.link, it.title);
      if (byId.has(id)) continue;
      const a = makeArticle(feed, it, id);
      if (!a) continue;
      if (st.ok === 0) a.backfill = true; // loaded at startup, not detected live
      byId.set(id, a); db.articles.unshift(a); added++;
      if (st.ok > 0) onFresh(a); // first poll of a feed only backfills, no alerts
    }
    st.ok++; st.last = Date.now(); st.lastCount = items.length; st.error = null;
    return added;
  } catch (e) { st.fail++; st.error = String(e.message).slice(0, 80); st.last = Date.now(); return 0; }
}

function makeArticle(feed, it, id) {
  const published = Number.isFinite(it.published) ? Math.min(it.published, Date.now()) : Date.now();
  if (Date.now() - published > 7 * 864e5) return null;
  const text = `${it.title} ${it.summary}`;
  let tokens = tagTokens(text, bases);
  if (!tokens.length && feed.token) tokens = [feed.token];
  const an = analyze(it.title, it.summary);
  return {
    id, title: it.title, url: it.link, source: feed.name, sourceId: feed.id, published, seen: Date.now(),
    summary: it.summary.slice(0, 280), tokens, ...an, importance: +Math.max(0, Math.min(1, an.importance + (feed.boost || 0))).toFixed(2),
    reactions: {}, votes: { bullish: 0, bearish: 0, important: 0, toxic: 0 },
  };
}

// ---------------- what the price did after the news ----------------
const candleCache = new Map();
async function candles5m(sym) {
  const hit = candleCache.get(sym);
  if (hit && Date.now() - hit.t < 4 * 60e3) return hit.c;
  const c = await X.ohlcv(EX, sym, '5m', 1000);
  candleCache.set(sym, { t: Date.now(), c });
  return c;
}
const priceAt = (c, tSec) => { let lo = 0, hi = c.length - 1, ans = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (c[m].time <= tSec) { ans = c[m]; lo = m + 1; } else hi = m - 1; } return ans; };

async function updateReactions() {
  const now = Date.now();
  const todo = db.articles.filter((a) => a.tokens.length && now - a.published < 26 * 3600e3 && now - a.published > 4 * 60e3);
  const bySym = new Map();
  for (const a of todo) for (const t of a.tokens.slice(0, 3)) { if (!bases.has(t)) continue; const sym = `${t}/USDT`; if (!bySym.has(sym)) bySym.set(sym, []); bySym.get(sym).push(a); }
  for (const [sym, arts] of bySym) {
    const need = arts.filter((a) => { const r = a.reactions[sym.split('/')[0]]; return !r || HORIZONS.some((h) => r[`m${h}`] == null && a.published + h * 60e3 <= now) || now - (r.at || 0) > 5 * 60e3; });
    if (!need.length) continue;
    let c;
    try { c = await candles5m(sym); } catch { continue; }
    if (!c.length) continue;
    const last = c[c.length - 1];
    for (const a of need) {
      const pubSec = Math.floor(a.published / 1000);
      if (pubSec < c[0].time + 300) continue; // older than the candle history
      const before = priceAt(c, pubSec - 300);
      if (!before) continue;
      const p0 = before.close;
      const r = { sym, p0, at: now, now: +(((last.close - p0) / p0) * 100).toFixed(3) };
      for (const h of HORIZONS) {
        const t = pubSec + h * 60;
        if (t * 1000 > now) continue;
        const k = priceAt(c, t);
        if (k) r[`m${h}`] = +(((k.close - p0) / p0) * 100).toFixed(3);
      }
      // biggest move in the first hour, both ways (did the news give a tradeable spike?)
      const win = c.filter((k) => k.time >= pubSec && k.time <= pubSec + 3600);
      if (win.length) { r.maxUp60 = +(((Math.max(...win.map((k) => k.high)) - p0) / p0) * 100).toFixed(3); r.maxDown60 = +(((Math.min(...win.map((k) => k.low)) - p0) / p0) * 100).toFixed(3); }
      a.reactions[sym.split('/')[0]] = r;
    }
  }
  persist();
}

// ---------------- statistics: what usually happens after this kind of news ----------------
function summarize(moves) {
  if (!moves.length) return null;
  const s = [...moves].sort((a, b) => a - b);
  const avg = moves.reduce((x, y) => x + y, 0) / moves.length;
  return { n: moves.length, avg: +avg.toFixed(3), median: +s[Math.floor(s.length / 2)].toFixed(3), upShare: +((moves.filter((m) => m > 0).length / moves.length) * 100).toFixed(0) };
}

export function stats({ token } = {}) {
  const groups = {};
  const add = (key, a, r) => { const g = (groups[key] ||= { m15: [], m60: [], m240: [], maxUp60: [], maxDown60: [] }); for (const k of Object.keys(g)) if (r[k] != null) g[k].push(r[k]); };
  for (const a of db.articles) {
    for (const [t, r] of Object.entries(a.reactions || {})) {
      if (token && t !== token) continue;
      add(`label:${a.label}`, a, r);
      add(`cat:${a.category}:${a.label}`, a, r);
      if (a.importance >= 0.4 || Math.abs(a.sentiment) >= 0.4) add(`strong:${a.label}`, a, r);
      add(`token:${t}:${a.label}`, a, r);
    }
  }
  const out = {};
  for (const [k, g] of Object.entries(groups)) out[k] = Object.fromEntries(Object.entries(g).map(([h, v]) => [h, summarize(v)]));
  return out;
}

// ---------------- trade signals from fresh news ----------------
const volCache = new Map();
async function atrPct(t) {
  const hit = volCache.get(t);
  if (hit && Date.now() - hit.t < 10 * 60e3) return hit.v;
  const c = await X.ohlcv(EX, `${t}/USDT`, '15m', 200);
  const v = (I.atr(c, 14).filter((x) => x != null).pop() / c[c.length - 1].close) * 100;
  volCache.set(t, { t: Date.now(), v });
  return v;
}

let signalCache = { t: 0, list: [] }, computing = null;
// Signals are recomputed in the background every 30 s; callers get the latest list instantly.
export async function signals() {
  if (Date.now() - signalCache.t > 30e3 && !computing) computing = computeSignals().finally(() => { computing = null; });
  if (!signalCache.t && computing) await computing; // very first call waits once
  return signalCache.list;
}

async function computeSignals({ maxAgeH = 6 } = {}) {
  const st = stats();
  const now = Date.now();
  const list = [];
  const toks = new Set(); for (const a of db.articles) if (now - a.published < maxAgeH * 3600e3) for (const t of a.tokens.slice(0, 3)) if (bases.has(t)) toks.add(t);
  await Promise.allSettled([...toks].map((t) => atrPct(t)));
  for (const a of db.articles) {
    if (now - a.published > maxAgeH * 3600e3) continue;
    const sent = a.ai?.sentiment ?? a.sentiment;
    if (a.label === 'neutral' || !(a.importance >= 0.3 || Math.abs(sent) >= 0.45)) continue;
    for (const t of a.tokens.slice(0, 3)) {
      if (!bases.has(t)) continue;
      const pick = (k) => st[k]?.m60?.n >= 5 ? { key: k, ...st[k] } : null;
      const ref = pick(`token:${t}:${a.label}`) || pick(`cat:${a.category}:${a.label}`) || pick(`strong:${a.label}`) || pick(`label:${a.label}`);
      let vol = 1;
      try { vol = await atrPct(t); } catch { /* default */ }
      const r = a.reactions[t];
      const bull = a.label === 'bullish';
      const expected = ref?.m60?.avg ?? null;
      const spike = bull ? ref?.maxUp60?.median : ref?.maxDown60?.median;
      const tp = +Math.max(vol * 2, Math.abs(spike ?? 0) * 0.8, 0.6).toFixed(2);
      const sl = +Math.max(vol * 1.5, 0.5).toFixed(2);
      const moved = r?.now ?? 0;
      const ageMin = (now - a.published) / 60e3;
      const pricedIn = bull ? moved >= tp * 0.7 : moved <= -tp * 0.7;
      // history check: does this kind of news usually move the price the way the headline suggests?
      const dir = bull ? 1 : -1;
      const agree60 = ref?.m60 ? Math.sign(ref.m60.avg) === dir : null;
      const agree240 = ref?.m240?.n >= 5 ? Math.sign(ref.m240.avg) === dir : null;
      const historyAdj = agree60 == null ? 0 : agree60 || agree240 ? 0.1 : ref.m60.n >= 10 ? -0.2 : -0.1;
      const score = +Math.max(0, Math.min(1, Math.abs(sent) * 0.45 + a.importance * 0.45 + (a.ai?.impact === 'high' ? 0.15 : a.ai?.impact === 'medium' ? 0.07 : 0) + historyAdj)).toFixed(2);
      const bestH = ref ? (agree240 && !agree60 ? 240 : 60) : 60;
      list.push({
        id: `${a.id}:${t}`, article: a.id, token: t, symbol: `${t}/USDT`, exchange: EX, side: bull ? 'buy' : 'avoid / sell',
        label: a.label, score, title: a.title, source: a.source, published: a.published, ageMin: +ageMin.toFixed(1), latencySec: a.backfill ? null : Math.max(0, Math.round((a.seen - a.published) / 1000)),
        movedSincePct: +moved.toFixed(2), tpPct: tp, slPct: sl, volPct: +vol.toFixed(2), pricedIn, status: pricedIn ? 'priced in' : ageMin < 30 ? 'fresh' : 'active',
        evidence: ref ? { basis: ref.key, n: ref.m60.n, avg15: ref.m15?.avg, avg60: ref.m60.avg, upShare60: ref.m60.upShare, avg240: ref.m240?.avg, upShare240: ref.m240?.upShare, spikeMedian: spike, agrees: agree60 || agree240 || false, bestHorizonMin: bestH } : null,
        take: a.ai?.take || null,
      });
    }
  }
  list.sort((x, y) => (y.status === 'fresh') - (x.status === 'fresh') || y.score - x.score);
  signalCache = { t: Date.now(), list };
  return list;
}

export async function signalsFor(token, sinceMs = 6 * 3600e3) {
  return (await signals()).filter((s) => s.token === token && Date.now() - s.published < sinceMs);
}

function onFresh(a) {
  signalCache.t = 0;
  newsEvents.emit('article', brief(a));
  const watched = a.tokens.filter((t) => WATCH.has(t) || botTokens.has(t));
  const strong = a.importance >= 0.4 || Math.abs(a.sentiment) >= 0.5;
  if (watched.length && strong && a.label !== 'neutral') {
    newsEvents.emit('notify', { kind: 'news', title: `${a.label === 'bullish' ? '🟢' : '🔴'} ${watched.join(', ')} · ${a.label} news`, body: `${a.source}: ${a.title}`, tag: `news-${a.id}` });
  }
}

// ---------------- Claude reads the headlines (optional) ----------------
const MODEL = process.env.CT_AI_MODEL || 'claude-opus-5-5';
let claude = null;
const hasKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const AI_SCHEMA = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'sentiment', 'impact', 'tokens', 'summary', 'take'], properties: {
  id: { type: 'string' }, sentiment: { type: 'number', description: '-1 very bearish .. 1 very bullish for the tokens named' }, impact: { type: 'string', enum: ['low', 'medium', 'high'] },
  tokens: { type: 'array', items: { type: 'string' } }, summary: { type: 'string', description: 'one plain sentence' }, take: { type: 'string', description: 'one sentence: what a short-term trader should do' } } } } } };

async function aiEnrich() {
  if (!hasKey()) return;
  const batch = db.articles.filter((a) => !a.ai && Date.now() - a.published < 6 * 3600e3).slice(0, 12);
  if (!batch.length) return;
  try {
    claude ||= new Anthropic();
    const res = await claude.beta.messages.create({
      model: MODEL, max_tokens: 6000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_SCHEMA } },
      system: 'You are the news desk of a crypto trading app. For each headline, judge the likely short-term (minutes to hours) price impact on the tokens it concerns. Use upper-case tickers. Be calibrated: most news is low impact.',
      messages: [{ role: 'user', content: JSON.stringify(batch.map((a) => ({ id: a.id, source: a.source, title: a.title, summary: a.summary, tokens_found: a.tokens }))) }],
    });
    if (res.stop_reason === 'refusal') return;
    const j = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    for (const it of j.items || []) {
      const a = byId.get(it.id); if (!a) continue;
      a.ai = { sentiment: it.sentiment, impact: it.impact, summary: it.summary, take: it.take, model: res.model };
      a.sentiment = +(a.sentiment * 0.35 + it.sentiment * 0.65).toFixed(3);
      a.label = a.sentiment >= 0.15 ? 'bullish' : a.sentiment <= -0.15 ? 'bearish' : 'neutral';
      a.importance = +Math.min(1, a.importance + (it.impact === 'high' ? 0.3 : it.impact === 'medium' ? 0.12 : 0)).toFixed(2);
      for (const t of it.tokens || []) if (bases.has(t) && !a.tokens.includes(t)) a.tokens.push(t);
    }
    for (const a of batch) a.ai ||= { skipped: true };
    signalCache.t = 0;
    persist();
  } catch { /* try again next round */ }
}

// ---------------- API helpers ----------------
function brief(a) {
  const { summary, ...rest } = a;
  return { ...rest, summary: a.ai?.summary || summary };
}

export function list({ token, filter = 'all', q, limit = 80, before } = {}) {
  let arts = db.articles;
  if (token) { const ts = new Set(String(token).toUpperCase().split(',')); arts = arts.filter((a) => a.tokens.some((t) => ts.has(t))); }
  if (filter === 'bullish' || filter === 'bearish') arts = arts.filter((a) => a.label === filter);
  if (filter === 'important') arts = arts.filter((a) => a.importance >= 0.4 || a.votes.important > 0);
  if (filter === 'listing') arts = arts.filter((a) => a.category === 'listing');
  if (filter === 'hot') { const cut = Date.now() - 6 * 3600e3; const cnt = {}; for (const a of db.articles) if (a.published > cut) for (const t of a.tokens) cnt[t] = (cnt[t] || 0) + 1; arts = arts.filter((a) => a.published > cut && a.tokens.some((t) => cnt[t] >= 3)); }
  if (q) { const s = String(q).toLowerCase(); arts = arts.filter((a) => a.title.toLowerCase().includes(s) || a.tokens.includes(String(q).toUpperCase())); }
  if (before) arts = arts.filter((a) => a.published < Number(before));
  return arts.slice().sort((a, b) => b.published - a.published).slice(0, Math.min(200, Number(limit) || 80)).map(brief);
}

// Sentiment index -100..100 per token over the last 24 h (importance- and recency-weighted).
export function sentimentIndex(tokens = [...WATCH]) {
  const now = Date.now();
  const calc = (filterFn) => {
    let w = 0, s = 0, n = 0, bull = 0, bear = 0;
    for (const a of db.articles) {
      if (now - a.published > 864e5 || !filterFn(a)) continue;
      const wt = (0.4 + a.importance) * Math.exp(-(now - a.published) / (12 * 3600e3));
      w += wt; s += wt * a.sentiment; n++;
      if (a.label === 'bullish') bull++; if (a.label === 'bearish') bear++;
    }
    return { index: w ? Math.round((s / w) * 100) : 0, articles: n, bullish: bull, bearish: bear };
  };
  const out = { ALL: calc(() => true) };
  for (const t of tokens) out[t] = calc((a) => a.tokens.includes(t));
  return out;
}

export function markers(token, fromSec) {
  return db.articles.filter((a) => a.tokens.includes(token) && (!fromSec || a.published / 1000 >= fromSec)).slice(0, 150).map((a) => ({ time: Math.floor(a.published / 1000), label: a.label, title: a.title, source: a.source, importance: a.importance, url: a.url }));
}

export function vote(id, kind) {
  const a = byId.get(id);
  if (!a || !(kind in a.votes)) throw X.httpError(400, 'Bad vote');
  a.votes[kind]++; persist();
  return brief(a);
}

export function feedStatus() { return FEEDS.map((f) => ({ id: f.id, name: f.name, ...(db.feeds[f.id] || {}) })); }

// Plain-language brief for one token: mood, what news usually does to it, live signals.
export async function tokenBrief(token) {
  token = String(token).toUpperCase();
  const arts = list({ token, limit: 30 });
  const idx = sentimentIndex([token])[token];
  const st = stats({ token });
  const sig = (await signals()).filter((s) => s.token === token);
  const g = (k) => st[`token:${token}:${k}`]?.m60;
  const lines = [];
  lines.push(`${token} news mood (24 h): ${idx.index > 15 ? 'bullish' : idx.index < -15 ? 'bearish' : 'mixed'} (${idx.index}) from ${idx.articles} articles (${idx.bullish} bullish, ${idx.bearish} bearish).`);
  if (g('bullish')?.n) lines.push(`After bullish ${token} news, price moved ${g('bullish').avg >= 0 ? '+' : ''}${g('bullish').avg}% on average 1 h later (up ${g('bullish').upShare}% of the time, ${g('bullish').n} cases).`);
  if (g('bearish')?.n) lines.push(`After bearish ${token} news: ${g('bearish').avg >= 0 ? '+' : ''}${g('bearish').avg}% on average 1 h later (${g('bearish').n} cases).`);
  const fresh = sig.find((s) => s.status === 'fresh') || sig[0];
  if (fresh) lines.push(`Signal: ${fresh.label} "${fresh.title}" (${fresh.source}, ${Math.round(fresh.ageMin)} min ago). ${fresh.pricedIn ? 'The move already happened; chasing it is risky.' : fresh.label === 'bullish' ? `Possible entry now, take profit about +${fresh.tpPct}%, stop about -${fresh.slPct}%.` : 'Consider pausing buys on this token until the news settles.'}`);
  else lines.push(`No strong ${token} news in the last 6 hours: let the grid work the normal range.`);
  return { token, index: idx, stats: st, signals: sig, articles: arts.slice(0, 10), text: lines.join(' '), model: 'news engine' };
}

// ---------------- loop ----------------
let started = false;
export function start() {
  if (started) return; started = true;
  const pollAll = async () => {
    let added = 0;
    for (let i = 0; i < FEEDS.length; i += 6) added += (await Promise.all(FEEDS.slice(i, i + 6).map(pollFeed))).reduce((s, v) => s + v, 0);
    db.articles.sort((a, b) => b.published - a.published);
    if (db.articles.length > 2000) { for (const a of db.articles.splice(2000)) byId.delete(a.id); }
    if (added) persist();
  };
  refreshBases().then(pollAll).then(updateReactions).then(() => signals()).then(aiEnrich).catch(() => {});
  setInterval(() => pollAll().catch(() => {}), 90e3);
  setInterval(() => updateReactions().catch(() => {}), 120e3);
  setInterval(() => aiEnrich().catch(() => {}), 180e3);
  setInterval(() => signals().catch(() => {}), 30e3);
  setInterval(() => refreshBases().catch(() => {}), 3600e3);
}

export { WATCH };
