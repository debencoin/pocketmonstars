// Paper trading accounts for manual orders (practice mode, no API key needed), one per user.
// The owner's account is the original 'paper' file; other users live in 'paperusers'.
import crypto from 'node:crypto';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';
import { events } from './bots.mjs';

const FEE = 0.001;
const fresh = () => ({ balances: { USDT: 10000, USD: 10000 }, orders: [], fills: [] });
const owner = load('paper', fresh());
const others = load('paperusers', {});
const acctOf = (uid = 'owner') => (uid === 'owner' ? owner : (others[uid] ||= fresh()));
const persist = (uid = 'owner') => (uid === 'owner' ? save('paper', owner) : save('paperusers', others));

function helpers(a) {
  const bal = (x) => a.balances[x] || 0;
  const add = (x, v) => { a.balances[x] = bal(x) + v; if (Math.abs(a.balances[x]) < 1e-12) delete a.balances[x]; };
  const reserved = (asset) => a.orders.filter((o) => o.status === 'open').reduce((s, o) => {
    const [b, q] = o.symbol.split('/');
    if (o.side === 'buy' && q === asset) return s + o.amount * o.price * (1 + FEE);
    if (o.side === 'sell' && b === asset) return s + o.amount;
    return s;
  }, 0);
  return { bal, add, reserved };
}

export function account(uid = 'owner') {
  const a = acctOf(uid), { reserved } = helpers(a);
  return { balances: Object.entries(a.balances).map(([asset, total]) => ({ asset, total, free: total - reserved(asset), used: reserved(asset) })), orders: a.orders.filter((o) => o.status === 'open'), fills: a.fills.slice(0, 100) };
}

function fill(uid, o, price) {
  const a = acctOf(uid), { add } = helpers(a);
  const [b, q] = o.symbol.split('/');
  const cost = o.amount * price, fee = cost * FEE;
  if (o.side === 'buy') { add(q, -(cost + fee)); add(b, o.amount); } else { add(b, -o.amount); add(q, cost - fee); }
  o.status = 'closed'; o.filled = o.amount; o.average = price; o.closedAt = Date.now();
  a.fills.unshift({ ...o, fee });
  if (a.fills.length > 300) a.fills.length = 300;
  events.emit('notify', { uid, kind: 'fill', title: `Paper ${o.side} filled`, body: `${o.amount} ${o.symbol} @ ${price}`, tag: `fill-${o.id}` });
}

export async function order({ exchange, symbol, side, type = 'limit', amount, price, stopPrice }, uid = 'owner') {
  amount = Number(amount);
  if (!(amount > 0)) throw X.httpError(400, 'Amount must be > 0');
  const a = acctOf(uid), { bal, reserved } = helpers(a);
  const t = await X.ticker(exchange, symbol);
  const [b, q] = symbol.split('/');
  const px = type === 'market' ? (side === 'buy' ? t.ask || t.p : t.bid || t.p) : Number(price);
  if (!(px > 0)) throw X.httpError(400, 'Price required');
  if (side === 'buy' && amount * px * (1 + FEE) > bal(q) - reserved(q) + 1e-9) throw X.httpError(400, `Not enough ${q} in the paper account`);
  if (side === 'sell' && amount > bal(b) - reserved(b) + 1e-12) throw X.httpError(400, `Not enough ${b} in the paper account`);
  const o = { id: crypto.randomUUID().slice(0, 8), exchange, symbol, side, type, amount, price: px, stopPrice: stopPrice ? Number(stopPrice) : null, status: 'open', time: Date.now(), paper: true };
  a.orders.unshift(o);
  if (type === 'market') fill(uid, o, px);
  persist(uid);
  return o;
}

export function cancel(id, uid = 'owner') { const o = acctOf(uid).orders.find((x) => x.id === id && x.status === 'open'); if (o) { o.status = 'canceled'; persist(uid); } return { ok: true }; }

export function reset(amount = 10000, uid = 'owner') { const a = acctOf(uid); a.balances = { USDT: amount, USD: amount }; a.orders = []; a.fills = []; persist(uid); return account(uid); }

async function checkOne(uid) {
  const a = acctOf(uid);
  const open = a.orders.filter((o) => o.status === 'open');
  for (const o of open) {
    const p = (await X.ticker(o.exchange, o.symbol).catch(() => null))?.p;
    if (!p) continue;
    if (o.type === 'stop') {
      if (!o.triggered && ((o.side === 'buy' && p >= o.stopPrice) || (o.side === 'sell' && p <= o.stopPrice))) o.triggered = true;
      if (!o.triggered) continue;
    }
    if ((o.side === 'buy' && p <= o.price) || (o.side === 'sell' && p >= o.price)) fill(uid, o, o.price);
  }
  if (open.length) persist(uid);
  a.orders = a.orders.filter((o) => o.status === 'open' || Date.now() - o.time < 7 * 864e5).slice(0, 300);
}

export function start() {
  setInterval(async () => { for (const uid of ['owner', ...Object.keys(others)]) await checkOne(uid).catch(() => {}); }, 3000);
}
