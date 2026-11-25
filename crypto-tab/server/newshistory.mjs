// Two years of headlines per coin (Google News search with date ranges, one query per month).
// Older headlines usually carry only a date, so links to price moves are made per day; the live
// news engine adds exact times going forward. Closed months are cached on disk for good.
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { DATA_DIR } from './store.mjs';
import { analyze, stripHtml } from '../public/shared/sentiment.mjs';

const DIR = path.join(DATA_DIR, 'newshistory');
fs.mkdirSync(DIR, { recursive: true });
const parser = new XMLParser({ ignoreAttributes: false });
export const QUERY = { ZEC: 'Zcash', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP Ripple', MARKET: 'crypto market', BNB: 'BNB Binance coin', DOGE: 'Dogecoin', ADA: 'Cardano', LINK: 'Chainlink', AVAX: 'Avalanche crypto', LTC: 'Litecoin', SUI: 'Sui crypto', HYPE: 'Hyperliquid' };
const pad = (n) => String(n).padStart(2, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function month(name, y, m) {
  const ym = `${y}-${pad(m + 1)}`;
  const file = path.join(DIR, `${name.replace(/\W+/g, '_')}-${ym}.json`);
  const now = new Date();
  const closed = y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m < now.getUTCMonth());
  if (fs.existsSync(file) && (closed || Date.now() - fs.statSync(file).mtimeMs < 6 * 3600e3)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = new Date(Date.UTC(y, m + 1, 1));
  const q = `${name} after:${ym}-01 before:${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; CryptoTab news history)' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`news history HTTP ${r.status}`);
  const x = parser.parse(await r.text());
  let items = x?.rss?.channel?.item || [];
  if (!Array.isArray(items)) items = [items];
  const rows = items.map((it) => {
    const t = Date.parse(it.pubDate);
    const d = new Date(t);
    const raw = stripHtml(typeof it.title === 'object' ? it.title['#text'] : it.title);
    const source = (typeof it.source === 'object' ? it.source['#text'] : it.source) || raw.split(' - ').pop();
    const title = raw.replace(/ - [^-]+$/, '');
    const a = analyze(title);
    return { t, title, source, url: it.link, label: a.label, sentiment: a.sentiment, category: a.category, importance: a.importance, dayOnly: d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 };
  }).filter((a) => Number.isFinite(a.t));
  fs.writeFileSync(file, JSON.stringify(rows));
  return rows;
}

export async function newsHistory(token, months = 24) {
  const name = QUERY[token] || token;
  const now = new Date();
  const out = [];
  for (let k = months; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    try { out.push(...(await month(name, d.getUTCFullYear(), d.getUTCMonth()))); } catch { await wait(1500); }
    await wait(120);
  }
  const seen = new Set();
  return out.filter((a) => !seen.has(a.title) && seen.add(a.title)).sort((a, b) => a.t - b.t);
}
