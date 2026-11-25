// Crypto Tab - bot strategies, paper executor and backtester.
// The same strategy code runs in three places:
//   1. the live/paper bot engine on the server (one tick every few seconds)
//   2. the backtester (one tick per candle path point)
//   3. the AI optimizer (many backtests with different parameters)
// A strategy never talks to an exchange directly: it calls exec.buy / exec.sell.

import * as I from './indicators.mjs';
import { measureCandles, recommendStep } from './candlemeter.mjs';

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
      const levels = p.levels?.length >= 2 ? [...p.levels] : gridLevels(p.lower, p.upper, p.grids, p.mode);
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
        if (p.levels) p.levels = [...c.levels];
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

// ---------------------------------------------------------------------------------------
// Pump Rider Grid: sideways FIFO grid -> rides pumps with the whole bag -> sells the top ->
// waits through the dump -> restarts after the bottom is confirmed by green candles.
// ---------------------------------------------------------------------------------------
function pumpGridTick() {
  return async function tick(bot, ctx, exec, st) {
    const p = bot.params, c = st.custom, price = ctx.price, K = ctx.candles;
    if (!K || K.length < 40) return;
    const closed = K.slice(0, -1); // the last candle is still forming
    const meter = measureCandles(closed, { recent: 120 });
    const A = Math.max(0.02, meter.medianRange); // typical candle swing in %
    const fee = (p.feePct ?? 0.1);
    const note = (msg) => { c.events.unshift({ t: ctx.now, msg }); c.events.length = Math.min(c.events.length, 40); return msg; };
    const out = {};
    const notify = (title, body) => { out.notify = { title, body }; note(`${title}: ${body}`); };
    const lotsAmt = () => c.lots.reduce((s, l) => s + l.amount, 0);
    const lotsCost = () => c.lots.reduce((s, l) => s + l.cost, 0);
    const cl = closed.map((k) => k.close);
    const ema9 = last(I.ema(cl, 9)), ema20 = last(I.ema(cl, 20));

    // step: measured from the candles (just under the median swing), inside the user's band
    if (!c.step || (p.autoStep && c.mode === 'grid' && ctx.now - c.measuredAt > 3600e3)) {
      const band = { fee, min: p.stepMin ?? 0.39, max: p.stepMax ?? 0.79 };
      c.step = p.autoStep ? recommendStep(meter, band).step : Math.max(Number(p.stepPct) || 0.5, 2 * fee + 0.05);
      c.measuredAt = ctx.now;
      c.candlePct = A;
    }
    const step = c.step / 100;
    c.candlePct = A;
    const pumpPct = p.pumpPct > 0 ? p.pumpPct : Math.max(1.5, A * 5);
    const trail = p.trailPct > 0 ? p.trailPct : Math.max(1.2, A * 3);
    c.trail = trail;

    const sellBag = async (why) => {
      if (st.base <= 1e-12) { c.lots = []; return null; }
      const t = await exec.sell(st.base, price, why, c.lots.length ? lotsCost() : null);
      c.lots = [];
      return t;
    };
    const buyLot = async (tag) => {
      const lotQuote = Math.min(st.quote, equity(st, price) / Math.max(1, p.maxLots)); // compounds with profits
      if (lotQuote <= 0) return null;
      const t = await exec.buy(lotQuote / price, price, tag);
      if (t) c.lots.push({ id: Math.random().toString(36).slice(2, 8), price, amount: t.amount, cost: t.cost + t.fee });
      return t;
    };
    const restartGrid = async (why) => {
      c.mode = 'grid'; c.ref = price; c.gridHigh = price; c.top = null; c.low = null; c.peak = null; c.measuredAt = 0; c.upRun = 0; c.runBase = null; c.stopPrice = null; c.restart = null;
      if (c.lots.length < p.maxLots) await buyLot('restart lot');
      notify('Grid restarted', why);
    };
    // FIFO: the oldest lot that is at least one step in profit is sold first
    const sellFifo = async () => {
      const lot = c.lots.find((l) => price >= l.price * (1 + step));
      if (!lot) return null;
      const t = await exec.sell(lot.amount, price, 'grid sell (FIFO)', lot.cost);
      if (t) c.lots.splice(c.lots.indexOf(lot), 1);
      return t;
    };

    if (!st.started) { st.started = true; c.ref = price; c.gridHigh = price; await buyLot('first lot'); note(`Started: step ${c.step}% (candles move ${A.toFixed(3)}%)`); return; }

    // Lines you dragged on the chart: a lot with your own sell price sells there, in any phase.
    for (const lot of [...c.lots]) {
      if (lot.target && price >= lot.target) {
        const t = await exec.sell(lot.amount, price, 'your sell line', lot.cost);
        if (t) { c.lots.splice(c.lots.indexOf(lot), 1); note(`Sold a lot at your line ${+lot.target.toPrecision(8)}`); }
      }
    }

    // ---------------- GRID: sideways, high frequency ----------------
    if (c.mode === 'grid') {
      c.gridHigh = Math.max(c.gridHigh ?? price, price);
      const avg = c.lots.length ? lotsCost() / lotsAmt() : null;
      if (p.stopLoss > 0 && avg && price <= avg * (1 - p.stopLoss / 100)) {
        await sellBag('stop loss');
        c.mode = 'wait'; c.top = c.gridHigh; c.low = price;
        notify('Stop loss', `Sold the bag at ${price}. Waiting for the bottom.`);
        return out;
      }
      // pump: strong move off the recent low, green candle, above the fast averages
      const look = closed.slice(-15);
      const base = Math.min(...look.map((k) => k.low));
      const k1 = closed[closed.length - 1];
      const move = ((price - base) / base) * 100;
      if (move >= pumpPct && k1.close > k1.open && price > ema9 && ema9 > ema20) {
        c.mode = 'ride'; c.peak = price; c.stopPrice = null; c.nextBuy = null; c.nextSell = null;
        if (p.rideAdd > 0 && st.quote > 0) {
          const t = await exec.buy((st.quote * Math.min(100, p.rideAdd)) / 100 / price, price, 'ride add');
          if (t) c.lots.push({ id: Math.random().toString(36).slice(2, 8), price, amount: t.amount, cost: t.cost + t.fee });
        }
        notify('Pump detected', `+${move.toFixed(2)}% from the low. Holding ${c.lots.length} lots, trailing ${trail.toFixed(2)}% from the top.`);
        return out;
      }
      // dump guard: stop buying all the way down; wait for the bottom instead.
      // Fires on a set % drop from the grid high, or (auto) when every lot is used and
      // price keeps falling 3 more steps under the last buy.
      const lowestLot = c.lots.length ? Math.min(...c.lots.map((l) => l.price)) : null;
      const pctHit = p.dumpPct > 0 && price < c.gridHigh * (1 - p.dumpPct / 100);
      const fullHit = c.lots.length >= p.maxLots && lowestLot && price < lowestLot * (1 - 3 * step);
      if ((pctHit || fullHit) && price < ema20) {
        const why = pctHit ? `-${p.dumpPct}% from the grid high` : `all ${p.maxLots} lots used and still falling`;
        c.mode = 'wait'; c.top = c.gridHigh; c.low = price;
        if (p.dumpSell) { await sellBag('dump guard'); notify('Dump guard', `${why}. Sold the bag; waiting for the bottom.`); }
        else notify('Dump guard', `${why}. Buying paused, holding ${c.lots.length} lots until the bottom is confirmed.`);
        return out;
      }
      const buyAt = c.nextBuy ?? c.ref * (1 - step);
      const sellAt = c.nextSell ?? c.ref * (1 + step);
      if (price <= buyAt) {
        const manual = c.nextBuy != null;
        if (c.lots.length < p.maxLots) await buyLot(manual ? 'your buy line' : 'grid buy');
        if (manual) note(`Bought at your buy line ${+c.nextBuy.toPrecision(8)}`);
        c.nextBuy = null; c.ref = price; c.upRun = 0; c.runBase = null;
      } else if (c.nextSell != null && price >= sellAt) {
        // your sell line: sell the oldest lot there (first in, first out), profit or not
        const lot = c.lots[0];
        if (lot) { const t = await exec.sell(lot.amount, price, 'your sell line', lot.cost); if (t) c.lots.shift(); }
        note(`Sold at your sell line ${+c.nextSell.toPrecision(8)}`);
        c.nextSell = null; c.ref = price; c.upRun = 0;
      } else if (price >= sellAt) {
        // Price walking up step after step without a dip = a pump forming.
        // Sell the first step (normal sideways scalp), then HOLD the remaining lots.
        c.upRun = (c.upRun || 0) + 1;
        if (c.upRun === 1) c.runBase = c.ref;
        const holdFrom = Math.max(2, p.holdRun || 2);
        const ripping = k1.close > k1.open && ((k1.close - k1.open) / k1.open) * 100 >= A * 1.5 && price > ema9;
        if (c.upRun < holdFrom && !ripping) await sellFifo();
        else if (c.upRun === holdFrom) note(`Up-run of ${c.upRun} steps: holding ${c.lots.length} lots instead of scalping`);
        c.ref = price;
        // a long enough run is a pump: switch to riding even before the candle-based trigger
        if (c.lots.length && c.runBase && ((price - c.runBase) / c.runBase) * 100 >= pumpPct) {
          c.mode = 'ride'; c.peak = price; c.stopPrice = null; c.nextBuy = null; c.nextSell = null;
          notify('Pump detected', `${c.upRun} steps up without a dip (+${(((price - c.runBase) / c.runBase) * 100).toFixed(2)}%). Riding ${c.lots.length} lots, trailing ${trail.toFixed(2)}% from the top.`);
          return out;
        }
      }
      if (!c.lots.length && price > c.ref) c.ref = price; // flat: follow price up, buy the next dip
      return out.notify ? out : undefined;
    }

    // ---------------- RIDE: hold the whole bag, trail the top ----------------
    if (c.mode === 'ride') {
      c.peak = Math.max(c.peak, price);
      const r = I.rsi(closed, 14);
      const hot = r.slice(-4).some((v) => v != null && v > 78);
      const k1 = closed[closed.length - 1];
      const topCandle = hot && k1.close < k1.open && k1.close < ema9;
      const off = ((c.peak - price) / c.peak) * 100;
      const manualStop = c.stopPrice != null && price <= c.stopPrice;
      if (off >= trail || topCandle || manualStop) {
        const cost = lotsCost();
        const t = await sellBag(manualStop ? 'your sell-bag line' : topCandle ? 'pump top (reversal candle)' : 'pump top (trailing)');
        c.mode = 'wait'; c.top = c.peak; c.low = price; c.stopPrice = null;
        const gain = t && cost ? t.cost - t.fee - cost : 0;
        notify('Sold the top', `Bag sold at ${price} (${off.toFixed(2)}% under the ${c.peak} high)${gain ? `, ${gain >= 0 ? '+' : ''}${gain.toFixed(2)}` : ''}. Grid off until the bottom is confirmed.`);
        return out;
      }
      return;
    }

    // ---------------- WAIT: no buying during the dump ----------------
    if (c.mode === 'wait') {
      c.low = Math.min(c.low ?? price, price);
      if (c.lots.length && price >= c.ref * (1 + step)) { await sellFifo(); c.ref = price; } // lots kept by the dump guard still sell at profit
      if (c.restart && ((c.restart.dir < 0 && price <= c.restart.price) || (c.restart.dir > 0 && price >= c.restart.price))) {
        await restartGrid(`Your restart line ${+c.restart.price.toPrecision(8)} was reached.`);
        return out;
      }
      const n = Math.max(1, p.confirmCandles || 3);
      const lastN = closed.slice(-n);
      const greens = lastN.length === n && lastN.every((k, i) => k.close > k.open && (i === 0 || k.close > lastN[i - 1].close));
      const dropped = c.top ? ((c.top - c.low) / c.top) * 100 : 0;
      const bounced = price >= c.low * (1 + A / 100);
      if (greens && price > ema9 && bounced && (dropped >= (p.resumeDrop ?? 3) || price > (c.top ?? Infinity))) {
        await restartGrid(`Bottom ${c.low} confirmed by ${n} green candles (down ${dropped.toFixed(2)}% from the top).`);
        return out;
      }
    }
    return out.notify ? out : undefined;
  };
}

STRATEGIES.pumpgrid = {
  label: 'Pump Rider Grid',
  desc: 'High-frequency FIFO grid with its step set just under the measured candle swing. Holds the whole bag when a pump starts, sells it at the top, skips the dump, and restarts after the bottom is confirmed by green candles.',
  needsCandles: true,
  fields: [
    ['investment', 'Investment (quote)', 'number', 1000, 'Wallet for this bot; lots compound with profits'],
    ['timeframe', 'Candle timeframe', 'select:1m,3m,5m,15m,30m,1h', '1m', 'Candles used to measure the step'],
    ['autoStep', 'Auto step from candle %', 'bool', true, 'Re-measures hourly: sits just under the median candle swing'],
    ['stepPct', 'Grid step % (when auto is off)', 'number', 0.5, ''],
    ['stepMin', 'Step band min %', 'number', 0.39, ''],
    ['stepMax', 'Step band max %', 'number', 0.79, ''],
    ['maxLots', 'Max open lots', 'int', 12, 'Caps how far it can buy down'],
    ['feePct', 'Fee per fill %', 'number', 0.1, 'Your maker fee (e.g. MEXC spot maker 0)'],
    ['pumpPct', 'Pump trigger %', 'number', 0, '0 = auto (≈5 candle swings, min 1.5%)'],
    ['trailPct', 'Sell the top: trail %', 'number', 0, '0 = auto (≈3 candle swings, min 1.2%)'],
    ['holdRun', 'Hold lots after N up-steps in a row', 'int', 2, 'Stops scalping small lots when a pump starts'],
    ['rideAdd', 'Add on pump (% of free cash)', 'number', 0, '0 = only ride what it holds'],
    ['confirmCandles', 'Green candles to restart', 'int', 3, 'Bottom confirmation'],
    ['resumeDrop', 'Min drop from top before restart %', 'number', 3, ''],
    ['dumpPct', 'Dump guard %', 'number', 4, 'Stop buying after this drop from the grid high (also stops when all lots are used and price keeps falling)'],
    ['dumpSell', 'Sell the bag on a dump', 'bool', false, 'Off = hold lots and sell them at profit after the bottom'],
    ['stopLoss', 'Stop loss %', 'number', 0, 'From average lot cost; 0 = off'],
  ],
  init(bot, price, st) { Object.assign(st.custom, { mode: 'grid', lots: [], ref: price, gridHigh: price, peak: null, top: null, low: null, step: null, measuredAt: 0, events: [] }); },
  tick: pumpGridTick(),
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
    // Custom line positions (set by dragging lines on the chart) override even spacing.
    const lv = Array.isArray(params?.levels) ? [...new Set(params.levels.map(Number))].filter((v) => v > 0).sort((a, b) => a - b) : null;
    if (lv && lv.length >= 2) {
      if (lv.length > 201) throw new Error('Too many grid lines');
      out.levels = lv;
      out.lower = lv[0]; out.upper = lv[lv.length - 1]; out.grids = lv.length;
    }
    if (!(out.lower > 0 && out.upper > out.lower)) throw new Error('Grid needs lower > 0 and upper > lower');
    out.grids = Math.min(200, Math.max(2, out.grids || 20));
  }
  if (!(out.investment > 0)) throw new Error('Investment must be more than 0');
  return out;
}

// ---------- backtester ----------
// Replays candles; each candle is walked open -> low -> high -> close (red candles: open -> high -> low -> close)
export async function backtest(type, params, candles, { fee = params.feePct != null ? params.feePct / 100 : DEFAULT_FEE, warmup = 60 } = {}) {
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
