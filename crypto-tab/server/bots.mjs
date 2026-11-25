// Bot engine: runs every bot on the server so they keep trading while the phone is locked.
// Each bot has its own wallet slice, so any number of grid bots can share one pair.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { STRATEGIES, newState, paperExec, normalizeParams, gridLevels, equity, DEFAULT_FEE } from '../public/shared/strategies.mjs';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';

export const events = new EventEmitter();
const TICK_MS = Number(process.env.CT_TICK_MS || 5000);
const bots = load('bots', []);
const busy = new Set();
const candleCache = new Map();

const now = () => Date.now();
const persist = () => save('bots', bots);
export const list = () => bots.map(view);
export const get = (id) => { const b = bots.find((x) => x.id === id); if (!b) throw X.httpError(404, 'Bot not found'); return b; };

export function view(b) {
  const price = b.state.lastPrice;
  const eq = price ? equity(b.state, price) : b.params.investment;
  const inv = Number(b.params.investment);
  return {
    id: b.id, name: b.name, type: b.type, label: STRATEGIES[b.type]?.label, exchange: b.exchange, symbol: b.symbol,
    mode: b.mode, status: b.status, params: b.params, createdAt: b.createdAt, updatedAt: b.updatedAt, error: b.error,
    stopReason: b.stopReason, aiTuned: b.aiTuned || null,
    stats: {
      price, equity: eq, investment: inv, pnl: eq - inv, pnlPct: ((eq - inv) / inv) * 100, realized: b.state.realized,
      fees: b.state.fees, trades: b.state.tradeCount, wins: b.state.wins, base: b.state.base, quote: b.state.quote,
      maxDrawdownPct: b.state.maxDrawdown * 100, runtimeH: (now() - b.createdAt) / 3.6e6,
      apr: b.createdAt && now() - b.createdAt > 3.6e6 ? (((eq - inv) / inv) * 100 * 8760) / ((now() - b.createdAt) / 3.6e6) : null,
    },
    levels: b.type === 'grid' ? b.state.custom.levels : undefined,
    slots: b.type === 'grid' ? b.state.custom.slots?.map((s) => (s ? 1 : 0)) : undefined,
    deal: b.state.custom.deal || b.state.custom.pos || null,
    lots: b.state.custom.lots?.length,
    trades: b.state.trades.slice(0, 60),
  };
}

export async function create({ name, type, exchange, symbol, mode = 'paper', params }) {
  if (!STRATEGIES[type]) throw X.httpError(400, `Unknown bot type ${type}`);
  if (mode === 'live') await X.privateClient(exchange); // fails early if no key
  const t = await X.ticker(exchange, symbol);
  const p = normalizeParams(type, params);
  const b = {
    id: crypto.randomUUID().slice(0, 8), name: name || `${STRATEGIES[type].label} ${symbol}`, type, exchange, symbol, mode,
    status: 'running', params: p, createdAt: now(), updatedAt: now(), error: null,
  };
  b.state = newState(b);
  STRATEGIES[type].init(b, t.p, b.state);
  b.state.lastPrice = t.p;
  bots.push(b);
  persist();
  events.emit('bot', view(b));
  return view(b);
}

export function pause(id) { const b = get(id); if (b.status === 'running') b.status = 'paused'; b.updatedAt = now(); persist(); return view(b); }

export function resume(id) {
  const b = get(id);
  if (b.status === 'stopped') throw X.httpError(400, 'Stopped bots cannot resume. Duplicate it instead.');
  b.status = 'running'; b.error = null; b.updatedAt = now(); persist();
  return view(b);
}

// Edit parameters. Works while running or paused; the bot keeps its wallet and open positions.
export function update(id, { name, params, aiTuned }) {
  const b = get(id);
  if (name) b.name = name;
  if (params) {
    const next = { ...b.params, ...params };
    // editing range / line count / spacing from the form rebuilds evenly spaced lines
    if (!params.levels && ['lower', 'upper', 'grids', 'mode'].some((k) => k in params && params[k] != null && String(params[k]) !== String(b.params[k]))) delete next.levels;
    const merged = normalizeParams(b.type, next);
    const oldInv = Number(b.params.investment);
    b.params = merged;
    // investment change tops up / withdraws quote from the bot wallet
    const delta = Number(merged.investment) - oldInv;
    if (delta) { b.state.quote = Math.max(0, b.state.quote + delta); b.state.peakEquity += delta; }
    reconfigure(b);
  }
  if (aiTuned) b.aiTuned = { at: now(), note: aiTuned };
  b.updatedAt = now();
  persist();
  events.emit('bot', view(b));
  return view(b);
}

// Rebuild a grid around new bounds, re-assigning coins it already holds to the new sell levels.
function reconfigure(b) {
  if (b.type !== 'grid') return;
  const st = b.state, c = st.custom, p = b.params;
  const held = (c.slots || []).filter(Boolean);
  const heldAmt = held.reduce((s, x) => s + x.amount, 0);
  const heldCost = held.reduce((s, x) => s + x.cost, 0);
  const avg = heldAmt ? heldCost / heldAmt : 0;
  const newLevels = p.levels?.length >= 2 ? [...p.levels] : gridLevels(p.lower, p.upper, p.grids, p.mode);
  // Same number of lines (lines dragged on the chart): keep every open slot where it is,
  // the bot simply buys / sells at the new prices from the next tick on.
  if (c.slots && c.slots.length === newLevels.length - 1) {
    c.levels = newLevels;
    c.perGrid = Number(p.investment) / (c.levels.length - 1);
    return;
  }
  c.levels = newLevels;
  c.slots = new Array(c.levels.length - 1).fill(null);
  c.perGrid = Number(p.investment) / (c.levels.length - 1);
  const price = st.lastPrice ?? c.levels[0];
  let left = Math.min(heldAmt, st.base);
  // held coins only go to sell levels above both the market and their breakeven (cost + 2 fees + margin)
  const floor = Math.max(price, avg * (1 + 2 * DEFAULT_FEE + 0.0015));
  for (let i = 0; i < c.slots.length && left > 1e-12; i++) {
    if (c.levels[i + 1] <= floor) continue;
    const amt = Math.min(left, c.perGrid / c.levels[i + 1]);
    c.slots[i] = { amount: amt, cost: amt * avg };
    left -= amt;
  }
  if (left > 1e-12) { const i = c.slots.length - 1; const s = c.slots[i] || { amount: 0, cost: 0 }; c.slots[i] = { amount: s.amount + left, cost: s.cost + left * avg }; }
}

export async function stop(id, { sell = false } = {}) {
  const b = get(id);
  if (sell && b.state.base > 0) {
    const price = (await X.ticker(b.exchange, b.symbol)).p;
    const ex = await execFor(b);
    await ex.sell(b.state.base, price * 0.998, 'stop: sell all');
  }
  b.status = 'stopped'; b.stopReason = sell ? 'Stopped, coins sold' : 'Stopped, coins kept'; b.updatedAt = now();
  persist();
  events.emit('bot', view(b));
  return view(b);
}

export function remove(id) {
  const i = bots.findIndex((x) => x.id === id);
  if (i < 0) throw X.httpError(404, 'Bot not found');
  if (bots[i].status === 'running' && bots[i].mode === 'live') throw X.httpError(400, 'Stop the live bot first');
  bots.splice(i, 1); persist();
  return { ok: true };
}

export async function duplicate(id) {
  const b = get(id);
  return create({ name: `${b.name} copy`, type: b.type, exchange: b.exchange, symbol: b.symbol, mode: 'paper', params: b.params });
}

// ---------- execution ----------
async function execFor(b) {
  const paper = paperExec(b.state, DEFAULT_FEE);
  if (b.mode !== 'live') return paper;
  // Live: marketable limit orders at the strategy's price, then book what actually filled.
  const fill = async (side, amount, price, tag, basis) => {
    const o = await X.placeOrder(b.exchange, { symbol: b.symbol, side, type: 'limit', amount, price });
    let order = o;
    for (let i = 0; i < 6 && order.status !== 'closed'; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const f = await X.fetchOrder(b.exchange, o.id, b.symbol);
      order = { ...o, status: f.status, filled: f.filled, average: f.average };
    }
    if (order.status !== 'closed') await X.cancelOrder(b.exchange, o.id, b.symbol).catch(() => {});
    const filled = Number(order.filled || 0);
    if (filled <= 0) return null;
    const avgPx = Number(order.average || price);
    return side === 'buy' ? paper.buy(filled, avgPx, tag) : paper.sell(filled, avgPx, tag, basis != null ? (basis * filled) / amount : null);
  };
  return { buy: (a, p, t) => fill('buy', a, p, t), sell: (a, p, t, basis) => fill('sell', a, p, t, basis) };
}

async function candlesFor(b) {
  const tf = b.params.timeframe || '15m';
  const key = `${b.exchange}|${b.symbol}|${tf}`;
  const hit = candleCache.get(key);
  if (hit && now() - hit.t < 30000) return hit.c;
  const c = await X.ohlcv(b.exchange, b.symbol, tf, 300);
  candleCache.set(key, { t: now(), c });
  return c;
}

async function tickBot(b) {
  if (busy.has(b.id)) return;
  busy.add(b.id);
  try {
    const strat = STRATEGIES[b.type];
    const t = await X.ticker(b.exchange, b.symbol);
    const price = t.p;
    const candles = strat.needsCandles ? await candlesFor(b) : null;
    const exec = await execFor(b);
    const before = b.state.tradeCount;
    const r = await strat.tick(b, { price, candles, now: now() }, exec, b.state);
    b.state.lastPrice = price;
    const eq = equity(b.state, price);
    b.state.peakEquity = Math.max(b.state.peakEquity, eq);
    b.state.maxDrawdown = Math.max(b.state.maxDrawdown, (b.state.peakEquity - eq) / b.state.peakEquity);
    if (r?.stop) {
      if (r.sellAll && b.state.base > 0) await exec.sell(b.state.base, price, r.stop);
      b.status = 'stopped'; b.stopReason = r.stop;
      events.emit('notify', { kind: 'bot', title: `${b.name} stopped`, body: r.stop, tag: `bot-${b.id}` });
    }
    if (b.state.tradeCount !== before) {
      for (const tr of b.state.trades.slice(0, b.state.tradeCount - before)) {
        events.emit('trade', { bot: b.id, name: b.name, ...tr });
        if (tr.side === 'sell' && tr.pnl > 0) {
          events.emit('notify', { kind: 'profit', title: `+${tr.pnl.toFixed(2)} ${b.symbol.split('/')[1]} · ${b.name}`, body: `Sold ${fmt(tr.amount)} ${b.symbol} @ ${fmt(tr.price)} (${tr.tag})`, tag: `profit-${b.id}` });
        }
      }
      persist();
    }
    b.error = null;
  } catch (e) {
    b.error = String(e.message || e).slice(0, 200);
    if (b.mode === 'live' && /insufficient|balance|permission|auth/i.test(b.error)) {
      b.status = 'paused';
      events.emit('notify', { kind: 'bot', title: `${b.name} paused`, body: b.error, tag: `bot-${b.id}` });
    }
  } finally {
    busy.delete(b.id);
  }
}

const fmt = (v) => (v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toPrecision(4));

let timer = null;
let lastSave = 0;
export function start() {
  if (timer) return;
  timer = setInterval(async () => {
    const running = bots.filter((b) => b.status === 'running');
    await Promise.allSettled(running.map(tickBot));
    if (now() - lastSave > 30000) { lastSave = now(); persist(); }
    events.emit('tick', running.length);
  }, TICK_MS);
}
export function stopEngine() { clearInterval(timer); timer = null; }
