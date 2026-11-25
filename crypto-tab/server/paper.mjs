// Paper trading account for manual orders (practice mode, no API key needed).
import crypto from 'node:crypto';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';
import { events } from './bots.mjs';

const FEE = 0.001;
const acct = load('paper', { balances: { USDT: 10000, USDC: 0, USD: 10000 }, orders: [], fills: [] });
const persist = () => save('paper', acct);
const bal = (a) => acct.balances[a] || 0;
const add = (a, v) => { acct.balances[a] = bal(a) + v; if (Math.abs(acct.balances[a]) < 1e-12) delete acct.balances[a]; };

export const account = () => ({ balances: Object.entries(acct.balances).map(([asset, total]) => ({ asset, total, free: total - reserved(asset), used: reserved(asset) })), orders: acct.orders.filter((o) => o.status === 'open'), fills: acct.fills.slice(0, 100) });

function reserved(asset) {
  return acct.orders.filter((o) => o.status === 'open').reduce((s, o) => {
    const [b, q] = o.symbol.split('/');
    if (o.side === 'buy' && q === asset) return s + o.amount * o.price * (1 + FEE);
    if (o.side === 'sell' && b === asset) return s + o.amount;
    return s;
  }, 0);
}

function fill(o, price) {
  const [b, q] = o.symbol.split('/');
  const cost = o.amount * price, fee = cost * FEE;
  if (o.side === 'buy') { add(q, -(cost + fee)); add(b, o.amount); } else { add(b, -o.amount); add(q, cost - fee); }
  o.status = 'closed'; o.filled = o.amount; o.average = price; o.closedAt = Date.now();
  acct.fills.unshift({ ...o, fee });
  if (acct.fills.length > 300) acct.fills.length = 300;
  events.emit('notify', { kind: 'fill', title: `Paper ${o.side} filled`, body: `${o.amount} ${o.symbol} @ ${price}`, tag: `fill-${o.id}` });
}

export async function order({ exchange, symbol, side, type = 'limit', amount, price, stopPrice }) {
  amount = Number(amount);
  if (!(amount > 0)) throw X.httpError(400, 'Amount must be > 0');
  const t = await X.ticker(exchange, symbol);
  const [b, q] = symbol.split('/');
  const px = type === 'market' ? (side === 'buy' ? t.ask || t.p : t.bid || t.p) : Number(price);
  if (!(px > 0)) throw X.httpError(400, 'Price required');
  if (side === 'buy' && amount * px * (1 + FEE) > bal(q) - reserved(q) + 1e-9) throw X.httpError(400, `Not enough ${q} in the paper account`);
  if (side === 'sell' && amount > bal(b) - reserved(b) + 1e-12) throw X.httpError(400, `Not enough ${b} in the paper account`);
  const o = { id: crypto.randomUUID().slice(0, 8), exchange, symbol, side, type, amount, price: px, stopPrice: stopPrice ? Number(stopPrice) : null, status: 'open', time: Date.now(), paper: true };
  acct.orders.unshift(o);
  if (type === 'market') fill(o, px);
  persist();
  return o;
}

export function cancel(id) { const o = acct.orders.find((x) => x.id === id && x.status === 'open'); if (o) { o.status = 'canceled'; persist(); } return { ok: true }; }

export function reset(amount = 10000) { acct.balances = { USDT: amount, USD: amount }; acct.orders = []; acct.fills = []; persist(); return account(); }

async function check() {
  const open = acct.orders.filter((o) => o.status === 'open');
  for (const o of open) {
    const p = (await X.ticker(o.exchange, o.symbol).catch(() => null))?.p;
    if (!p) continue;
    if (o.type === 'stop') {
      if (!o.triggered && ((o.side === 'buy' && p >= o.stopPrice) || (o.side === 'sell' && p <= o.stopPrice))) o.triggered = true;
      if (!o.triggered) continue;
    }
    if ((o.side === 'buy' && p <= o.price) || (o.side === 'sell' && p >= o.price)) fill(o, o.price);
  }
  if (open.length) persist();
  acct.orders = acct.orders.filter((o) => o.status === 'open' || Date.now() - o.time < 7 * 864e5).slice(0, 300);
}

export function start() { setInterval(() => check().catch(() => {}), 3000); }
