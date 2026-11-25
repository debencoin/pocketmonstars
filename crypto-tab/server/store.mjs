// Tiny JSON-file persistence + AES-256-GCM encryption for exchange API keys.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.CT_DATA_DIR || path.join(here, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

function secretKey() {
  if (process.env.CT_SECRET) return crypto.createHash('sha256').update(process.env.CT_SECRET).digest();
  const f = path.join(DATA_DIR, '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return crypto.createHash('sha256').update(fs.readFileSync(f, 'utf8').trim()).digest();
}
const KEY = secretKey();

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decrypt(box) {
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(box.iv, 'base64'));
  d.setAuthTag(Buffer.from(box.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
}

const cache = new Map();
const timers = new Map();

export function load(name, fallback) {
  if (cache.has(name)) return cache.get(name);
  const f = path.join(DATA_DIR, `${name}.json`);
  let v = fallback;
  try { v = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* first run */ }
  cache.set(name, v);
  return v;
}

// Debounced atomic write.
export function save(name, value) {
  cache.set(name, value);
  clearTimeout(timers.get(name));
  timers.set(name, setTimeout(() => flush(name), 250));
}

export function flush(name) {
  const f = path.join(DATA_DIR, `${name}.json`);
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache.get(name), null, 1), { mode: 0o600 });
  fs.renameSync(tmp, f);
}

export function flushAll() { for (const n of cache.keys()) { clearTimeout(timers.get(n)); flush(n); } }

export function accessToken() {
  if (process.env.CT_TOKEN) return process.env.CT_TOKEN;
  const f = path.join(DATA_DIR, '.token');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(9).toString('base64url'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}
