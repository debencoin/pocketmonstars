// Long price history (years, not the ~1000 candles an exchange API returns) from Binance's
// public data archive (data.binance.vision): one ZIP of CSV candles per month / per day.
// Closed months never change, so they are cached on disk forever.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DATA_DIR } from './store.mjs';
import * as X from './exchanges.mjs';

const BASE = 'https://data.binance.vision/data/spot';
const DIR = path.join(DATA_DIR, 'history');
fs.mkdirSync(DIR, { recursive: true });

// Minimal ZIP reader: central directory -> first entry -> raw deflate.
function unzipFirst(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('bad zip directory');
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), local = buf.readUInt32LE(cd + 42);
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + csize);
  return method === 0 ? data : zlib.inflateRawSync(data);
}

function parseCsv(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line || line[0] < '0' || line[0] > '9') continue;
    const f = line.split(',');
    let t = Number(f[0]);
    if (t > 1e14) t = Math.floor(t / 1000); // archive switched to microseconds in 2025
    out.push({ time: Math.floor(t / 1000), open: +f[1], high: +f[2], low: +f[3], close: +f[4], volume: +f[5] });
  }
  return out;
}

async function getZip(url, cacheFile) {
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`archive HTTP ${r.status}`);
  const rows = parseCsv(unzipFirst(Buffer.from(await r.arrayBuffer())).toString('utf8'));
  if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(rows));
  return rows;
}

const ym = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const ymd = (d) => `${ym(d)}-${String(d.getUTCDate()).padStart(2, '0')}`;

// Candles for `base`/USDT over the last `months` months. Falls back to the exchange API when
// the token is not on Binance.
export async function history(base, { interval = '1h', months = 24, exchange = 'mexc' } = {}) {
  const sym = `${base}USDT`;
  const now = new Date();
  const all = [];
  let found = false;
  // closed months
  for (let k = months; k >= 1; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const rows = await getZip(`${BASE}/monthly/klines/${sym}/${interval}/${sym}-${interval}-${ym(d)}.zip`, path.join(DIR, `${sym}-${interval}-${ym(d)}.json`)).catch(() => null);
    if (rows) { found = true; all.push(...rows); }
  }
  // this month so far: daily files (cached once the day is over)
  for (let day = 1; day < now.getUTCDate(); day++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
    const rows = await getZip(`${BASE}/daily/klines/${sym}/${interval}/${sym}-${interval}-${ymd(d)}.zip`, path.join(DIR, `${sym}-${interval}-${ymd(d)}.json`)).catch(() => null);
    if (rows) { found = true; all.push(...rows); }
  }
  // today (and the whole range if Binance does not list the token): the live exchange
  try {
    const live = await X.ohlcv(exchange, `${base}/USDT`, interval, 1000);
    const last = all.length ? all[all.length - 1].time : 0;
    all.push(...live.filter((k) => k.time > last));
  } catch { /* archive only */ }
  const seen = new Set();
  return { source: found ? 'binance archive + live' : `${exchange} only`, candles: all.filter((k) => !seen.has(k.time) && seen.add(k.time)).sort((a, b) => a.time - b.time) };
}
