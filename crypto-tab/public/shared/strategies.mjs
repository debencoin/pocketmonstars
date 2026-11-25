// Crypto Tab - bot strategies, paper executor and backtester.
// The same strategy code runs in three places:
//   1. the live/paper bot engine on the server (one tick every few seconds)
//   2. the backtester (one tick per candle path point)
//   3. the AI optimizer (many backtests with different parameters)
// A strategy never talks to an exchange directly: it calls exec.buy / exec.sell.

import * as I from './indicators.mjs';

export const DEFAULT_FEE = 0.001; // 0.1% per fill

// ---------- bot wallet / accounting ----------
export function newState(bot) {
  return {
    quote: Number(bot.params.investment) || 0,
    base: 0,
    realized: 0,
    fees: 0,
    trades: [],
    tradeCount: 0,
    wins: 0,
    started: false,
    lastPrice: null,
    peakEquity: Number(bot.params.investment) || 0,
    maxDrawdown: 0,
    custom: {},
  };
}

export function equity(state, price) { return state.quote + state.base * price; }

function record(state, t) {
  state.trades.unshift(t);
  if (state.trades.length > 300) state.trades.length = 300;
  state.tradeCount++;
}

// Paper executor: fills instantly at the requested price, pays fee, respects wallet balance.
export function paperExec(state, fee = DEFAULT_FEE, clock = () => Date.now()) {
  return {
    async buy(amount, price, tag = '') {
      let cost = amount * price;
      if (cost * (1 + fee) > state.quote + 1e-9) {
        amount = state.quote / (price * (1 + fee));
        cost = amount * price;
      }
      if (amount <= 0 || cost < 1e-8) return null;
      const f = cost * fee;
      state.quote -= cost + f;
      state.base += amount;
      state.fees += f;
      const t = { side: 'buy', price, amount, cost, fee: f, tag, time: clock() };
      record(state, t);
      return t;
    },
    async sell(amount, price, tag = '', costBasis = null) {
      amount = Math.min(amount, state.base);
      if (amount <= 1e-12) return null;
      const proceeds = amount * price;
      const f = proceeds * fee;
      state.base -= amount;
      state.quote += proceeds - f;
      state.fees += f;
      let pnl = null;
      if (costBasis != null) {
        pnl = proceeds - f - costBasis;
        state.realized += pnl;
        if (pnl > 0) state.wins++;
      }
      const t = { side: 'sell', price, amount, cost: proceeds, fee: f, tag, pnl, time: clock() };
      record(state, t);
      return t;
    },
  };
}

// ---------- helpers ----------
export function gridLevels(lower, upper, n, mode = 'arithmetic') {
  lower = Number(lower); upper = Number(upper); n = Math.max(2, Math.floor(n));
  const levels = [];
  if (mode === 'geometric') {
    const r = Math.pow(upper / lower, 1 / (n - 1));
    for (let i = 0; i < n; i++) levels.push(lower * Math.pow(r, i));
  } else {
    const step = (upper - lower) / (n - 1);
    for (let i = 0; i < n; i++) levels.push(lower + step * i);
  }
  return levels;
}

const pct = (a, b) => ((a - b) / b) * 100;

// ---------- strategy definitions ----------
// fields drive the bot editor UI: [key, label, type, default, hint]
export const STRATEGIES = {
  grid: {
    label: 'Spot Grid',
    desc: 'Buys low and sells high inside a price range. Run as many grids on the same pair as you want; each has its own wallet.',
    needsCandles: false,
    fields: [
      ['lower', 'Lower price', 'number', null, 'Bottom of the range'],
      ['upper', 'Upper price', 'number', null, 'Top of the range'],
      ['grids', 'Grid lines', 'int', 20, '2 - 200'],
      ['mode', 'Spacing', 'select:arithmetic,geometric', 'geometric', 'Geometric = equal % per step'],
      ['investment', 'Investment (quote)', 'number', 500, 'Allocated to this bot only'],
      ['stopLoss', 'Stop loss price', 'number', null, 'Optional: sell all and stop'],
      ['takeProfit', 'Take profit price', 'number', null, 'Optional: sell all and stop'],
      ['trailingUp', 'Trail range up', 'bool', false, 'Shift grid up when price breaks the top'],
    ],
    init(bot, price, st) {
      const p = bot.params;
      const levels = gridLevels(p.lower, p.upper, p.grids, p.mode);
      st.custom.levels = levels;
      st.custom.slots = new Array(levels.length - 1).fill(null); // slot i: bought at levels[i], sells at levels[i+1]
      st.custom.perGrid = (Number(p.investment) / (levels.length - 1));
    },
    async tick(bot, ctx, exec, st) {
      const p = bot.params, c = st.custom;
      const price = ctx.price, prev = st.lastPrice ?? price;
      if (!st.started) {
        // Seed: buy the coin needed for every sell level above the current price.
        st.started = true;
        for (let i = 0; i < c.slots.length; i++) {
          if (c.levels[i] > price) {
            const amt = c.perGrid / c.levels[i + 1];
            const t = await exec.buy(amt, price, `seed L${i}`);
            if (t) c.slots[i] = { amount: t.amount, cost: t.cost + t.fee };
          }
        }
        return;
      }
      if (p.stopLoss && price <= p.stopLoss) return { stop: 'Stop loss hit', sellAll: true };
      if (p.takeProfit && price >= p.takeProfit) return { stop: 'Take profit hit', sellAll: true };
      const lo = Math.min(prev, price), hi = Math.max(prev, price);
      // Falling through a level: open that slot.
      if (price < prev) {
        for (let i = c.slots.length - 1; i >= 0; i--) {
          const L = c.levels[i];
          if (L <= hi && L >= lo && !c.slots[i]) {
            const t = await exec.buy(c.perGrid / L, L, `buy L${i}`);
            if (t) c.slots[i] = { amount: t.amount, cost: t.cost + t.fee };
          }
        }
      }
      // Rising through a level: close the slot below it.
      if (price > prev) {
        for (let i = 0; i < c.slots.length; i++) {
          const L = c.levels[i + 1];
          if (L <= hi && L >= lo && c.slots[i]) {
            const s = c.slots[i];
            const t = await exec.sell(s.amount, L, `sell L${i + 1}`, s.cost);
            if (t) c.slots[i] = null;
          }
        }
      }
      if (p.trailingUp && price > c.levels[c.levels.length - 1] * 1.002) {
        // shift the whole grid up one step, keeping the same number of lines
        const step = c.levels[c.levels.length - 1] / c.levels[c.levels.length - 2];
        c.levels = c.levels.map((l) => (p.mode === 'geometric' ? l * step : l + (c.levels[1] - c.levels[0])));
        p.lower = c.levels[0]; p.upper = c.levels[c.levels.length - 1];
        const freed = c.slots.shift();
        c.slots.push(null);
        if (freed) c.slots[c.slots.length - 1] = freed;
      }
    },
  },

  dca: {
    label: 'DCA Bot',
    desc: 'Base order, then safety orders as price drops (scaled by step and volume multipliers). Sells the whole position at take profit, optionally trailing.',
    needsCandles: true,
    fields: [
      ['investment', 'Max investment (quote)', 'number', 1000, 'Wallet for this bot'],
      ['baseOrder', 'Base order (quote)', 'number', 50, ''],
      ['safetyOrder', 'Safety order (quote)', 'number', 50, ''],
      ['maxSafety', 'Max safety orders', 'int', 6, ''],
      ['deviation', 'Price deviation %', 'number', 1.5, 'Drop before first safety order'],
      ['stepScale', 'Step scale', 'number', 1.3, 'Each step widens by this'],
      ['volumeScale', 'Volume scale', 'number', 1.5, 'Each safety order grows by this'],
      ['takeProfit', 'Take profit %', 'number', 1.8, 'From average entry'],
      ['trailing', 'Trailing TP %', 'number', 0.4, '0 = off'],
      ['stopLoss', 'Stop loss %', 'number', 0, '0 = off'],
      ['startOn', 'Start condition', 'select:immediate,rsi,bb', 'immediate', 'rsi = RSI below 35, bb = under lower band'],
      ['timeframe', 'Signal timeframe', 'select:5m,15m,1h,4h', '15m', ''],
      ['repeat', 'Restart after TP', 'bool', true, 'Compound: next deal reuses profits'],
    ],
    init(bot, price, st) { st.custom.deal = null; st.custom.dealsClosed = 0; },
    async tick(bot, ctx, exec, st) {
      const p = bot.params, c = st.custom, price = ctx.price;
      if (!c.deal) {
        if (c.dealsClosed > 0 && !p.repeat) return { stop: 'Deal finished' };
        if (!startOk(p.startOn, ctx)) return;
        const scale = p.repeat ? Math.max(0.2, equity(st, price) / Number(p.investment)) : 1; // compounding
        const t = await exec.buy((p.baseOrder * scale) / price, price, 'base order');
        if (!t) return;
        c.deal = { amount: t.amount, cost: t.cost + t.fee, firstPrice: price, filledSO: 0, nextDrop: Number(p.deviation), scale, peak: null };
        st.started = true;
        return;
      }
      const d = c.deal;
      // safety orders
      if (d.filledSO < p.maxSafety && pct(price, d.firstPrice) <= -d.nextDrop) {
        const vol = p.safetyOrder * Math.pow(p.volumeScale, d.filledSO) * d.scale;
        const t = await exec.buy(vol / price, price, `safety ${d.filledSO + 1}`);
        if (t) {
          d.amount += t.amount; d.cost += t.cost + t.fee; d.filledSO++;
          d.nextDrop += p.deviation * Math.pow(p.stepScale, d.filledSO);
        }
      }
      const gain = pct(price, d.cost / d.amount);
      if (p.stopLoss > 0 && gain <= -p.stopLoss) {
        await exec.sell(d.amount, price, 'stop loss', d.cost);
        c.deal = null; c.dealsClosed++;
        return { stop: 'Stop loss hit' };
      }
      if (gain >= p.takeProfit) {
        if (p.trailing > 0) {
          d.peak = Math.max(d.peak ?? price, price);
          if (pct(price, d.peak) > -p.trailing) return;
        }
        await exec.sell(d.amount, price, 'take profit', d.cost);
        c.deal = null; c.dealsClosed++;
      }
    },
  },

  stepgrid: {
    label: 'Step Grid (ATR)',
    desc: 'Rangeless grid: buys each time price falls one ATR step below the last buy, sells each lot one step above its entry. Adapts the step to volatility.',
    needsCandles: true,
    fields: [
      ['investment', 'Investment (quote)', 'number', 1000, ''],
      ['lots', 'Max open lots', 'int', 10, ''],
      ['atrMult', 'Step (x ATR)', 'number', 1.2, ''],
      ['minProfit', 'Min profit per lot %', 'number', 0.6, ''],
      ['timeframe', 'ATR timeframe', 'select:5m,15m,1h,4h', '15m', ''],
    ],
    init(bot, price, st) { st.custom.lots = []; st.custom.lastBuy = null; },
    async tick(bot, ctx, exec, st) {
      const p = bot.params, c = st.custom, price = ctx.price;
      const a = last(I.atr(ctx.candles, 14)) ?? price * 0.01;
      const step = a * p.atrMult;
      const lotQuote = p.investment / p.lots;
      for (const lot of [...c.lots]) {
        const target = Math.max(lot.price + step, lot.price * (1 + p.minProfit / 100));
        if (price >= target) {
          const t = await exec.sell(lot.amount, price, 'step sell', lot.cost);
          if (t) c.lots.splice(c.lots.indexOf(lot), 1);
        }
      }
      const ref = c.lots.length ? Math.min(...c.lots.map((l) => l.price)) : c.lastSell ?? null;
      if (c.lots.length < p.lots && (ref == null || price <= ref - step)) {
        const t = await exec.buy(lotQuote / price, price, 'step buy');
        if (t) { c.lots.push({ price, amount: t.amount, cost: t.cost + t.fee }); st.started = true; }
      }
      if (!c.lots.length) c.lastSell = price + step; // re-enter after one step of pullback
    },
  },

  bb: signalStrategy('Bollinger Bounce', 'Buys a close under the lower band (RSI filter), sells at the upper band or take profit.', (ctx, p) => {
    const b = I.bollinger(ctx.candles, p.period, p.mult), r = I.rsi(ctx.candles, 14);
    const close = ctx.price;
    return { buy: close < last(b.lower) && last(r) < p.rsiMax, sell: close > last(b.upper) };
  }, [['period', 'BB period', 'int', 20, ''], ['mult', 'BB deviation', 'number', 2, ''], ['rsiMax', 'Buy only if RSI below', 'number', 40, '']]),

  emacross: signalStrategy('EMA Cross', 'Buys when the fast EMA crosses above the slow EMA, exits on the cross back down.', (ctx, p) => {
    const cl = ctx.candles.map((x) => x.close);
    const f = I.ema(cl, p.fast), s = I.ema(cl, p.slow);
    const n = cl.length - 1;
    return { buy: f[n - 1] <= s[n - 1] && f[n] > s[n], sell: f[n - 1] >= s[n - 1] && f[n] < s[n] };
  }, [['fast', 'Fast EMA', 'int', 9, ''], ['slow', 'Slow EMA', 'int', 21, '']]),

  rsi: signalStrategy('RSI Reversal', 'Buys oversold, sells overbought.', (ctx, p) => {
    const r = last(I.rsi(ctx.candles, p.period));
    return { buy: r < p.low, sell: r > p.high };
  }, [['period', 'RSI period', 'int', 14, ''], ['low', 'Buy below', 'number', 30, ''], ['high', 'Sell above', 'number', 70, '']]),

  gain: signalStrategy('Gain (buy the dip under EMA)', 'Buys when price is a set % under its EMA, sells at a fixed gain.', (ctx, p) => {
    const e = last(I.ema(ctx.candles.map((x) => x.close), p.ema));
    return { buy: pct(ctx.price, e) <= -p.below, sell: false };
  }, [['ema', 'EMA length', 'int', 50, ''], ['below', 'Buy when below EMA %', 'number', 1.5, '']]),

  supertrend: signalStrategy('SuperTrend Rider', 'Rides SuperTrend: buys on the flip to up-trend, sells on the flip to down-trend.', (ctx, p) => {
    const st = I.supertrend(ctx.candles, p.period, p.mult).dir;
    const n = st.length - 1;
    return { buy: st[n - 1] === -1 && st[n] === 1, sell: st[n - 1] === 1 && st[n] === -1 };
  }, [['period', 'ATR period', 'int', 10, ''], ['mult', 'Multiplier', 'number', 3, '']]),

  macd: signalStrategy('MACD Momentum', 'Buys on a MACD cross above signal below zero, sells on the cross back down.', (ctx) => {
    const m = I.macd(ctx.candles);
    const n = m.hist.length - 1;
    return { buy: m.hist[n - 1] <= 0 && m.hist[n] > 0 && m.dif[n] < 0, sell: m.hist[n - 1] >= 0 && m.hist[n] < 0 };
  }, []),
};

// Shared shape for single-position signal bots (one entry at a time, TP / SL / trailing).
function signalStrategy(label, desc, signal, extraFields) {
  return {
    label, desc, needsCandles: true,
    fields: [
      ['investment', 'Investment (quote)', 'number', 500, ''],
      ['orderSize', 'Order size % of wallet', 'number', 100, ''],
      ...extraFields,
      ['takeProfit', 'Take profit %', 'number', 2, '0 = signal exit only'],
      ['stopLoss', 'Stop loss %', 'number', 3, '0 = off'],
      ['trailing', 'Trailing stop %', 'number', 0, '0 = off'],
      ['timeframe', 'Timeframe', 'select:1m,5m,15m,1h,4h,1d', '15m', ''],
    ],
    init(bot, price, st) { st.custom.pos = null; },
    async tick(bot, ctx, exec, st) {
      const p = bot.params, c = st.custom, price = ctx.price;
      if (!ctx.candles || ctx.candles.length < 60) return;
      const sig = signal(ctx, p);
      if (!c.pos) {
        if (sig.buy) {
          const quote = (equity(st, price) * Math.min(100, p.orderSize)) / 100;
          const t = await exec.buy(quote / price, price, 'signal buy');
          if (t) { c.pos = { amount: t.amount, cost: t.cost + t.fee, entry: price, peak: price }; st.started = true; }
        }
        return;
      }
      const pos = c.pos;
      pos.peak = Math.max(pos.peak, price);
      const g = pct(price, pos.cost / pos.amount);
      let why = null;
      if (p.takeProfit > 0 && g >= p.takeProfit) why = 'take profit';
      else if (p.stopLoss > 0 && g <= -p.stopLoss) why = 'stop loss';
      else if (p.trailing > 0 && g > 0 && pct(price, pos.peak) <= -p.trailing) why = 'trailing stop';
      else if (sig.sell) why = 'signal sell';
      if (why) {
        const t = await exec.sell(pos.amount, price, why, pos.cost);
        if (t) c.pos = null;
      }
    },
  };
}

function startOk(cond, ctx) {
  if (cond === 'immediate' || !ctx.candles || ctx.candles.length < 30) return cond === 'immediate' || !ctx.candles;
  if (cond === 'rsi') return last(I.rsi(ctx.candles, 14)) < 35;
  if (cond === 'bb') return ctx.price < last(I.bollinger(ctx.candles).lower);
  return true;
}

export function last(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
}

export function defaultsFor(type) {
  const s = STRATEGIES[type];
  const out = {};
  for (const [k, , , d] of s.fields) out[k] = d;
  return out;
}

export function normalizeParams(type, params) {
  const s = STRATEGIES[type];
  if (!s) throw new Error(`Unknown bot type ${type}`);
  const out = {};
  for (const [k, , kind, d] of s.fields) {
    let v = params?.[k] ?? d;
    if (kind === 'number') v = v === '' || v == null ? null : Number(v);
    else if (kind === 'int') v = v == null ? null : Math.round(Number(v));
    else if (kind === 'bool') v = v === true || v === 'true' || v === 'on';
    out[k] = v;
  }
  if (type === 'grid') {
    if (!(out.lower > 0 && out.upper > out.lower)) throw new Error('Grid needs lower > 0 and upper > lower');
    out.grids = Math.min(200, Math.max(2, out.grids || 20));
  }
  if (!(out.investment > 0)) throw new Error('Investment must be more than 0');
  return out;
}

// ---------- backtester ----------
// Replays candles; each candle is walked open -> low -> high -> close (red candles: open -> high -> low -> close)
export async function backtest(type, params, candles, { fee = DEFAULT_FEE, warmup = 60 } = {}) {
  const strat = STRATEGIES[type];
  const bot = { type, params: { ...params } };
  const st = newState(bot);
  let clockT = 0;
  const exec = paperExec(st, fee, () => clockT);
  const startIdx = strat.needsCandles ? Math.min(warmup, candles.length - 1) : 0;
  const startPrice = candles[startIdx].close;
  strat.init(bot, startPrice, st);
  st.lastPrice = startPrice;
  let stopped = null;
  for (let i = startIdx; i < candles.length && !stopped; i++) {
    const k = candles[i];
    clockT = k.time * 1000;
    const window = strat.needsCandles ? candles.slice(Math.max(0, i - 200), i + 1) : null;
    const path = k.close >= k.open ? [k.open, k.low, k.high, k.close] : [k.open, k.high, k.low, k.close];
    for (const price of path) {
      const r = await strat.tick(bot, { price, candles: window, now: clockT }, exec, st);
      st.lastPrice = price;
      const eq = equity(st, price);
      st.peakEquity = Math.max(st.peakEquity, eq);
      st.maxDrawdown = Math.max(st.maxDrawdown, (st.peakEquity - eq) / st.peakEquity);
      if (r?.stop) { if (r.sellAll && st.base > 0) await exec.sell(st.base, price, r.stop); stopped = r.stop; break; }
    }
  }
  const endPrice = candles[candles.length - 1].close;
  const inv = Number(params.investment);
  const eq = equity(st, endPrice);
  const sells = st.trades.filter((t) => t.side === 'sell' && t.pnl != null);
  return {
    investment: inv,
    finalEquity: eq,
    pnl: eq - inv,
    pnlPct: ((eq - inv) / inv) * 100,
    realized: st.realized,
    fees: st.fees,
    trades: st.tradeCount,
    roundTrips: sells.length,
    winRate: sells.length ? (sells.filter((t) => t.pnl > 0).length / sells.length) * 100 : 0,
    maxDrawdownPct: st.maxDrawdown * 100,
    buyHoldPct: ((endPrice - startPrice) / startPrice) * 100,
    stopped,
    days: (candles[candles.length - 1].time - candles[startIdx].time) / 86400,
    trades_sample: st.trades.slice(0, 50),
  };
}
