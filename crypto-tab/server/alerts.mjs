// Price alerts with a persistent alarm.
// When an alert fires it goes into the "ringing" state and stays there until the user
// presses Stop. While ringing:
//   - every open app plays a looping alarm + vibration (via the /api/events stream)
//   - the server re-sends a Web Push notification every CT_RENOTIFY_S seconds, so the
//     phone keeps alerting even with the app closed / screen locked.
import crypto from 'node:crypto';
import * as webpush from 'web-push';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';
import { events } from './bots.mjs';

const alerts = load('alerts', []);
const subs = load('push-subs', []);
const RENOTIFY_MS = Number(process.env.CT_RENOTIFY_S || 30) * 1000;
const MAX_RING_MS = Number(process.env.CT_MAX_RING_MIN || 120) * 60000;

let vapid = load('vapid', null);
if (!vapid) { vapid = webpush.generateVAPIDKeys(); save('vapid', vapid); }
webpush.setVapidDetails(process.env.CT_VAPID_SUBJECT || 'mailto:admin@localhost', vapid.publicKey, vapid.privateKey);

export const vapidPublicKey = () => vapid.publicKey;
const persist = () => save('alerts', alerts);
const ownerOf = (a) => a.owner || 'owner';
export const list = (uid = 'owner') => alerts.filter((a) => ownerOf(a) === uid);
export const ringing = (uid) => alerts.filter((a) => a.status === 'ringing' && (uid == null || ownerOf(a) === uid));

export function subscribe(sub, uid = 'owner') {
  if (!sub?.endpoint) throw X.httpError(400, 'Bad subscription');
  const i = subs.findIndex((s) => s.endpoint === sub.endpoint);
  if (i >= 0) subs.splice(i, 1);
  subs.push({ ...sub, owner: uid }); save('push-subs', subs);
  return { ok: true, count: subs.length };
}

export async function create({ exchange, symbol, condition, price, pct, note, repeat = false, sound = 'cash' }, uid = 'owner') {
  if (!['above', 'below', 'cross', 'pctUp', 'pctDown'].includes(condition)) throw X.httpError(400, 'Bad condition');
  const t = await X.ticker(exchange, symbol);
  if (condition.startsWith('pct') && !(Number(pct) > 0)) throw X.httpError(400, 'Percent must be > 0');
  if (!condition.startsWith('pct') && !(Number(price) > 0)) throw X.httpError(400, 'Price must be > 0');
  const a = {
    id: crypto.randomUUID().slice(0, 8), owner: uid, exchange, symbol, condition,
    price: condition.startsWith('pct') ? null : Number(price), pct: pct ? Number(pct) : null,
    refPrice: t.p, lastPrice: t.p, note: note || '', repeat: !!repeat, sound,
    status: 'active', createdAt: Date.now(), triggeredAt: null, rings: 0,
  };
  alerts.unshift(a); persist();
  return a;
}

export function remove(id, uid = 'owner') { const i = alerts.findIndex((a) => a.id === id && ownerOf(a) === uid); if (i >= 0) alerts.splice(i, 1); persist(); return { ok: true }; }

// Stop the alarm. Repeating alerts re-arm; one-shot alerts are marked done.
export function ack(id, uid) {
  const a = alerts.find((x) => x.id === id && (uid == null || ownerOf(x) === uid));
  if (!a) throw X.httpError(404, 'Alert not found');
  a.status = a.repeat ? 'active' : 'done';
  a.refPrice = a.lastPrice;
  a.ackAt = Date.now();
  persist();
  events.emit('alarm-stop', { id, uid: ownerOf(a) });
  return a;
}

export function ackAll(uid) { for (const a of ringing(uid)) ack(a.id); return { ok: true }; }

function hit(a, price, prev) {
  switch (a.condition) {
    case 'above': return price >= a.price;
    case 'below': return price <= a.price;
    case 'cross': return (prev < a.price && price >= a.price) || (prev > a.price && price <= a.price);
    case 'pctUp': return price >= a.refPrice * (1 + a.pct / 100);
    case 'pctDown': return price <= a.refPrice * (1 - a.pct / 100);
    default: return false;
  }
}

function describe(a) {
  const c = { above: '≥', below: '≤', cross: 'crossed' }[a.condition];
  return c ? `${a.symbol} ${c} ${a.price}` : `${a.symbol} ${a.condition === 'pctUp' ? '+' : '-'}${a.pct}%`;
}

let extraSink = null;
export const setSink = (fn) => { extraSink = fn; };
export async function push(payload) {
  try { extraSink?.(payload); } catch { /* ignore */ }
  const body = JSON.stringify(payload);
  const to = payload.uid === '*' || payload.uid == null ? subs : subs.filter((s) => (s.owner || 'owner') === payload.uid);
  const dead = [];
  await Promise.allSettled(to.map((s) => webpush.sendNotification(s, body, { TTL: 120, urgency: 'high' }).catch((e) => { if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.endpoint); })));
  if (dead.length) { for (const d of dead) subs.splice(subs.findIndex((s) => s.endpoint === d), 1); save('push-subs', subs); }
}

async function check() {
  const active = alerts.filter((a) => a.status === 'active');
  const keys = [...new Set(active.map((a) => `${a.exchange}|${a.symbol}`))];
  const prices = {};
  await Promise.allSettled(keys.map(async (k) => { const [ex, s] = k.split('|'); prices[k] = (await X.ticker(ex, s)).p; }));
  let changed = false;
  for (const a of active) {
    const p = prices[`${a.exchange}|${a.symbol}`];
    if (p == null) continue;
    const prev = a.lastPrice ?? p;
    a.lastPrice = p;
    if (hit(a, p, prev)) {
      a.status = 'ringing'; a.triggeredAt = Date.now(); a.triggerPrice = p; a.rings = 0; a.nextRing = 0;
      changed = true;
      events.emit('alarm', { ...a, uid: ownerOf(a) });
    }
  }
  // persistent re-notification for everything still ringing
  for (const a of ringing()) {
    if (Date.now() - a.triggeredAt > MAX_RING_MS) { a.status = a.repeat ? 'active' : 'done'; a.autoStopped = true; changed = true; continue; }
    if (Date.now() >= (a.nextRing || 0)) {
      a.rings++; a.nextRing = Date.now() + RENOTIFY_MS; changed = true;
      push({ uid: ownerOf(a), kind: 'alarm', id: a.id, title: `⏰ ${describe(a)}`, body: `${a.note ? a.note + ' · ' : ''}Now ${a.triggerPrice} · tap to stop the alarm`, tag: `alarm-${a.id}`, ring: a.rings });
    }
  }
  if (changed) persist();
}

export function start() {
  setInterval(() => check().catch(() => {}), 4000);
  // profit / bot notifications go out as normal (non-repeating) pushes
  events.on('notify', (n) => push(n).catch(() => {}));
}
