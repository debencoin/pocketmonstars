// Plain-language help for every bot setting, with a live example that uses the coin's real
// price and the values currently typed in the form. Shared by the app and the AI agent.
//
// Each entry: { what: 'one or two short sentences', example: (x) => 'a concrete example' }
// x = { price, base, quote, p (current form values), money(v), px(v) }

const pct = (v, d = 2) => `${Number(v).toFixed(d)}%`;

export const HELP = {
  // ---------- shared ----------
  investment: {
    what: 'How much money this bot may use. It only trades with this amount, so other bots and your other coins are never touched.',
    example: (x) => `With ${x.money(x.p.investment || 1000)}, the bot can buy at most ${x.money(x.p.investment || 1000)} worth of ${x.base}. Profits it makes are added back in.`,
  },
  timeframe: {
    what: 'The candle size the bot reads (1m = one-minute candles, 15m = fifteen-minute candles). Smaller = faster, more trades. Bigger = calmer, fewer trades.',
    example: (x) => `On ${x.p.timeframe || '15m'}, every ${x.p.timeframe || '15m'} the bot gets a new candle to measure. ${x.base} usually moves more inside a 15m candle than a 1m candle, so the step can be bigger there.`,
  },
  feePct: {
    what: 'The fee your exchange charges on each buy and each sell. A round trip pays it twice, so every step must be bigger than 2 × fee to make money.',
    example: (x) => `At ${pct(x.p.feePct ?? 0.1)} per fill, a buy plus a sell costs ${pct(2 * (x.p.feePct ?? 0.1))}. A 0.5% step then keeps ${pct(0.5 - 2 * (x.p.feePct ?? 0.1))} per trade. The bot fills orders instantly, so use your exchange’s taker fee (tap “Ask the AI agent” to look it up).`,
  },
  stopLoss: {
    what: 'Safety exit. If the price falls this far below what the bot paid on average, it sells everything to stop the loss. 0 turns it off.',
    example: (x) => { const s = Number(x.p.stopLoss) || 5; return `With ${pct(s, 1)}: if the bot paid ${x.px(x.price)} on average for ${x.base}, it sells everything at ${x.px(x.price * (1 - s / 100))}.`; },
  },
  takeProfit: {
    what: 'Sell when the position is up this much from the average buy price.',
    example: (x) => { const t = Number(x.p.takeProfit) || 2; return `With ${pct(t, 1)}: bought at ${x.px(x.price)} → sells at ${x.px(x.price * (1 + t / 100))}.`; },
  },
  trailing: {
    what: 'Instead of selling at the first target, the bot follows the price up and sells only when it drops this much from the highest point. Lets winners run. 0 turns it off.',
    example: (x) => { const t = Number(x.p.trailing) || 0.5; const top = x.price * 1.04; return `With ${pct(t, 1)}: ${x.base} climbs to ${x.px(top)}, so the bot sells when it dips to ${x.px(top * (1 - t / 100))}.`; },
  },
  orderSize: {
    what: 'How much of the bot wallet goes into each trade.',
    example: (x) => `${pct(x.p.orderSize ?? 100, 0)} of ${x.money(x.p.investment || 500)} = ${x.money(((x.p.orderSize ?? 100) / 100) * (x.p.investment || 500))} per trade.`,
  },

  // ---------- spot grid ----------
  lower: {
    what: 'Bottom of the price range. The bot buys as the price falls toward it and stops buying below it.',
    example: (x) => `Lower ${x.px(x.p.lower || x.price * 0.9)}: if ${x.base} drops under it the grid waits (or the stop loss fires, if set).`,
  },
  upper: {
    what: 'Top of the price range. The bot sells as the price rises toward it.',
    example: (x) => `Upper ${x.px(x.p.upper || x.price * 1.1)}: above it the bot holds only cash and waits, unless "Trail range up" is on.`,
  },
  grids: {
    what: 'How many buy/sell lines sit inside the range. More lines = smaller steps and more, smaller trades.',
    example: (x) => { const lo = x.p.lower || x.price * 0.9, hi = x.p.upper || x.price * 1.1, n = x.p.grids || 20; const step = ((hi / lo) ** (1 / (n - 1)) - 1) * 100; return `${n} lines between ${x.px(lo)} and ${x.px(hi)} ≈ ${pct(step)} apart. Each up-and-down between two lines earns about ${pct(step - 0.2)} after fees.`; },
  },
  mode: {
    what: 'How lines are spaced. Geometric = same % apart (best for crypto). Arithmetic = same $ apart.',
    example: (x) => `Geometric: every line is the same % apart, so a line at ${x.px(x.price)} and the next at ${x.px(x.price * 1.005)} are 0.5% apart, same as lines lower down.`,
  },
  'grid.stopLoss': {
    what: 'A price (not a %). If the price falls to it, the bot sells everything and stops. Empty = off.',
    example: (x) => `Stop loss ${x.px(x.price * 0.85)}: if ${x.base} hits it, the bot sells all its ${x.base} and stops.`,
  },
  'grid.takeProfit': {
    what: 'A price (not a %). When the price reaches it, the bot sells everything and stops with the profit.',
    example: (x) => `Take profit ${x.px(x.price * 1.25)}: the bot cashes out everything if ${x.base} gets there.`,
  },
  trailingUp: {
    what: 'If the price breaks above the top line, the whole grid moves up one step so it keeps trading instead of sitting in cash.',
    example: (x) => `Grid top is ${x.px(x.price)}. ${x.base} goes to ${x.px(x.price * 1.01)}, so the grid shifts up and keeps buying and selling around the new price.`,
  },

  // ---------- DCA ----------
  baseOrder: {
    what: 'The first buy when a deal starts.',
    example: (x) => `${x.money(x.p.baseOrder || 50)} buys about ${((x.p.baseOrder || 50) / x.price).toFixed(4)} ${x.base} at ${x.px(x.price)}.`,
  },
  safetyOrder: {
    what: 'Extra buys if the price keeps falling. They lower your average price so a smaller bounce gets you to profit.',
    example: (x) => `First safety order ${x.money(x.p.safetyOrder || 50)}; with volume scale ${x.p.volumeScale || 1.5} the next ones are ${x.money((x.p.safetyOrder || 50) * (x.p.volumeScale || 1.5))}, ${x.money((x.p.safetyOrder || 50) * (x.p.volumeScale || 1.5) ** 2)}…`,
  },
  maxSafety: {
    what: 'The most extra buys one deal can make. Caps how much money goes into a falling coin.',
    example: (x) => `Max ${x.p.maxSafety || 6}: after ${x.p.maxSafety || 6} extra buys the bot stops adding and just waits for the bounce (or the stop loss).`,
  },
  deviation: {
    what: 'How far the price must fall from the first buy before the first safety order.',
    example: (x) => `${pct(x.p.deviation || 1.5, 1)}: first buy at ${x.px(x.price)} → first safety order at ${x.px(x.price * (1 - (x.p.deviation || 1.5) / 100))}.`,
  },
  stepScale: {
    what: 'Each next safety order waits for a bigger drop than the one before (multiplied by this).',
    example: (x) => { const d = x.p.deviation || 1.5, s = x.p.stepScale || 1.3; return `Drops needed: ${pct(d, 1)}, then ${pct(d + d * s, 1)}, then ${pct(d + d * s + d * s * s, 1)} from the first buy.`; },
  },
  volumeScale: {
    what: 'Each next safety order is bigger than the one before (multiplied by this).',
    example: (x) => { const so = x.p.safetyOrder || 50, v = x.p.volumeScale || 1.5; return `${x.money(so)} → ${x.money(so * v)} → ${x.money(so * v * v)}.`; },
  },
  'dca.takeProfit': {
    what: 'Sell the whole deal when it is up this much from your average buy price.',
    example: (x) => `Average buy ${x.px(x.price)}, take profit ${pct(x.p.takeProfit || 1.8, 1)} → sells everything at ${x.px(x.price * (1 + (x.p.takeProfit || 1.8) / 100))}.`,
  },
  'dca.trailing': {
    what: 'After take profit is reached, keep riding up and sell only when price drops this much from the top. 0 = sell right at take profit.',
    example: (x) => `Take profit hits at +${x.p.takeProfit || 1.8}%. ${x.base} keeps going to +4%, so the bot sells after a ${pct(x.p.trailing || 0.4, 1)} dip from that high.`,
  },
  'dca.stopLoss': {
    what: 'Sell the whole deal if it is down this much from your average buy price. 0 = off.',
    example: (x) => `Average ${x.px(x.price)}, stop ${pct(x.p.stopLoss || 10, 0)} → sells at ${x.px(x.price * (1 - (x.p.stopLoss || 10) / 100))}.`,
  },
  startOn: {
    what: 'When a new deal may start: right away, when RSI says the coin is oversold, or when price is under the lower Bollinger band.',
    example: (x) => `"rsi": the bot waits until ${x.base} has dropped enough that RSI is under 35, so it buys dips instead of tops.`,
  },
  repeat: {
    what: 'Start a new deal after each take profit. Each new deal is sized from the bot’s current balance, so profits compound.',
    example: (x) => `Deal 1 turns ${x.money(1000)} into ${x.money(1018)}. Deal 2 then uses 1.8% bigger orders, and so on.`,
  },

  // ---------- step grid ----------
  lots: { what: 'How many separate buys the bot can hold at once.', example: (x) => `${x.p.lots || 10} lots of ${x.money((x.p.investment || 1000) / (x.p.lots || 10))} each.` },
  atrMult: {
    what: 'Step size measured in ATR (the coin’s average candle range). Bigger = fewer, larger trades.',
    example: (x) => `If ${x.base} normally moves ${x.px(x.price * 0.01)} per candle, ${x.p.atrMult || 1.2} × ATR = steps of ${x.px(x.price * 0.01 * (x.p.atrMult || 1.2))}.`,
  },
  minProfit: { what: 'Never sell a lot for less than this gain, even if the ATR step is smaller.', example: (x) => `Bought at ${x.px(x.price)} → sells no lower than ${x.px(x.price * (1 + (x.p.minProfit || 0.6) / 100))}.` },

  // ---------- signal bots ----------
  period: { what: 'How many candles the indicator looks back over. Smaller reacts faster but gives more false signals.', example: (x) => `${x.p.period || 14} on ${x.p.timeframe || '15m'} candles = the last ${x.p.period || 14} candles.` },
  mult: { what: 'How wide the bands are (in standard deviations or ATRs). Wider = fewer, stronger signals.', example: () => 'Bollinger 2 = about 95% of prices stay inside the bands; a close outside is unusual.' },
  rsiMax: { what: 'Only buy if RSI is below this, i.e. the coin is cheap compared to its recent moves.', example: (x) => `${x.p.rsiMax || 40}: no buying when ${x.base} is already hot.` },
  fast: { what: 'Short moving average: reacts quickly to price.', example: (x) => `EMA ${x.p.fast || 9} follows the last ~${x.p.fast || 9} candles.` },
  slow: { what: 'Long moving average: the trend. A buy happens when the fast line crosses above it.', example: (x) => `EMA ${x.p.slow || 21} crossing under EMA ${x.p.fast || 9} = trend turning up.` },
  low: { what: 'Buy when RSI drops below this (oversold).', example: (x) => `RSI under ${x.p.low || 30} → buy.` },
  high: { what: 'Sell when RSI rises above this (overbought).', example: (x) => `RSI over ${x.p.high || 70} → sell.` },
  ema: { what: 'The moving average the bot compares the price with.', example: (x) => `EMA ${x.p.ema || 50} is the average of roughly the last ${x.p.ema || 50} candles.` },
  below: { what: 'Buy when price is this far under the moving average.', example: (x) => `EMA at ${x.px(x.price)} → buys at ${x.px(x.price * (1 - (x.p.below || 1.5) / 100))}.` },

  // ---------- Pump Rider Grid ----------
  autoStep: {
    what: 'Let the bot measure how much each candle really moves and set the step just under that, re-checked every hour. Recommended.',
    example: (x) => `If ${x.base}'s ${x.p.timeframe || '15m'} candles usually swing 0.80% from low to high, the bot uses about 0.72%, so most candles reach a buy and a sell.`,
  },
  stepPct: {
    what: 'Distance between buys and sells when auto step is off. Smaller = more trades, less profit each.',
    example: (x) => { const s = Number(x.p.stepPct) || 0.5; return `${pct(s)} at ${x.px(x.price)}: buys at ${x.px(x.price * (1 - s / 100))}, sells that lot at ${x.px(x.price * (1 - s / 100) * (1 + s / 100))}.`; },
  },
  stepMin: { what: 'The smallest step auto mode may use.', example: (x) => `${pct(x.p.stepMin ?? 0.39)}: even on calm candles the bot never trades for less than this.` },
  stepMax: { what: 'The biggest step auto mode may use.', example: (x) => `${pct(x.p.stepMax ?? 0.79)}: on wild candles the bot still trades at most this far apart, so it keeps catching moves.` },
  maxLots: {
    what: 'How many buys the bot may hold at once. This is what stops it from buying all the way down.',
    example: (x) => `${x.p.maxLots || 12} lots of ${x.money((x.p.investment || 1000) / (x.p.maxLots || 12))}. After ${x.p.maxLots || 12} buys in a row it stops adding.`,
  },
  pumpPct: {
    what: 'How big a run-up counts as a pump. Then the bot stops selling small pieces and rides the whole bag. 0 = automatic (about 5 typical candle moves).',
    example: (x) => `Pump trigger 2%: ${x.base} goes from ${x.px(x.price)} to ${x.px(x.price * 1.02)} without dipping, so the bot switches to riding.`,
  },
  trailPct: {
    what: 'While riding a pump, sell everything when the price falls this far from the top. 0 = automatic (about 3 typical candle moves).',
    example: (x) => { const t = Number(x.p.trailPct) || 1.5; const top = x.price * 1.08; return `${x.base} pumps to ${x.px(top)}. With ${pct(t, 1)} the bot sells the whole bag at ${x.px(top * (1 - t / 100))}, then stops buying.`; },
  },
  holdRun: {
    what: 'After this many steps up in a row, stop selling small lots: a pump may be starting.',
    example: (x) => `2: ${x.base} rises one step (bot sells a lot), then another step with no dip, so the bot keeps its remaining lots for the pump.`,
  },
  rideAdd: {
    what: 'When a pump is detected, put this % of the bot’s free cash in too. 0 = only ride what it already holds.',
    example: (x) => `20% with ${x.money(500)} free → buys ${x.money(100)} more ${x.base} at the start of the pump.`,
  },
  confirmCandles: {
    what: 'After selling the top, how many green candles in a row (each closing higher) prove the bottom is in before the grid restarts.',
    example: (x) => `3: ${x.base} stops falling, prints 3 green candles in a row and moves above its 9-period average, so the grid starts again.`,
  },
  resumeDrop: {
    what: 'The price must fall at least this much from the top before a restart counts as a real bottom.',
    example: (x) => `3%: top was ${x.px(x.price * 1.1)}, so no restart above ${x.px(x.price * 1.1 * 0.97)}.`,
  },
  dumpPct: {
    what: 'Dump guard: if price falls this far from the grid’s high, stop buying and wait for the bottom. It also stops when every lot is used and price keeps falling.',
    example: (x) => `${pct(x.p.dumpPct ?? 4, 0)}: grid high ${x.px(x.price)} → no more buys under ${x.px(x.price * (1 - (x.p.dumpPct ?? 4) / 100))} until the bottom is confirmed.`,
  },
  dumpSell: {
    what: 'When the dump guard fires: off = keep the coins and sell them at a profit after the bounce; on = sell everything and buy back at the bottom.',
    example: (x) => `On: ${x.base} breaks down 5%, the bot sells the bag, waits, and rebuys lower, so you end up with more ${x.base} for the same money.`,
  },

  // ---------- news ----------
  newsGuard: {
    what: 'Lets the news agent protect the bot: bearish news about the coin stops new buying until the bottom is confirmed; strong bullish news makes it hold its lots for 30 minutes so a news pump can run.',
    example: (x) => `"${x.base} exchange hack" headline: the bot stops buying ${x.base} right away instead of buying the drop. "${x.base} listed on a big exchange": it keeps its coins instead of selling them too early.`,
  },
  minScore: {
    what: 'How strong a news item must be to trade on it (0 to 1). The score mixes how bullish it is, how important it is, and how this kind of news moved prices before.',
    example: (x) => `0.55: "${x.base} listed on Binance" scores high and trades; "${x.base} price analysis" scores low and is ignored.`,
  },
  maxAgeMin: {
    what: 'Only trade news younger than this. The first minutes after big news are where the edge is; later the move is usually already in the price.',
    example: (x) => `30: news about ${x.base} published 10 minutes ago can trade; news from 2 hours ago cannot.`,
  },
  maxChase: {
    what: 'Skip the trade if the price already moved this much since the news came out, because chasing a finished pump is how people buy the top.',
    example: (x) => `1%: news hits at ${x.px(x.price)}; if ${x.base} is already at ${x.px(x.price * 1.012)} the bot skips it.`,
  },
  'newsbot.takeProfit': {
    what: 'Sell when up this much. 0 = automatic: the target comes from how far this token usually spikes after this kind of news, and its volatility.',
    example: (x) => `Auto: if ${x.base} usually spikes about 2% in the hour after bullish news, the target is about 1.6–2%.`,
  },
  'newsbot.stopLoss': {
    what: 'Sell if down this much. 0 = automatic: 1.5 × the token’s typical 15-minute move.',
    example: (x) => `Auto: ${x.base} usually moves about 0.8% per 15 minutes, so the stop is about 1.2% under the entry.`,
  },
  'newsbot.trailing': {
    what: 'Once the trade is in profit, sell if price falls this much from its best point.',
    example: (x) => `0.6%: ${x.base} runs to ${x.px(x.price * 1.02)}, so the bot sells at ${x.px(x.price * 1.02 * 0.994)}.`,
  },
  holdMax: { what: 'News effects fade. Close the trade after this many minutes even if the target was not reached.', example: () => '240 = sell after 4 hours at most.' },
  exitOnBearish: { what: 'Sell immediately if bearish news about the coin comes out while holding it.', example: (x) => `Holding ${x.base}, then "${x.base} delisted" appears: the bot sells at once.` },
};

export function helpFor(type, key) { return HELP[`${type}.${key}`] || HELP[key] || null; }

// How each bot works, told as a short story with the coin's real price.
export const STORY = {
  pumpgrid: (x) => [
    `${x.base} is at ${x.px(x.price)}. The bot buys a small lot, then buys again every step down and sells the oldest lot every step up (${x.p.autoStep === false ? `${x.p.stepPct || 0.5}% each` : `each step sized just under ${x.base}'s typical ${x.p.timeframe || '15m'} candle move, kept between ${x.p.stepMin ?? 0.39}% and ${x.p.stepMax ?? 0.79}%`}), many times a day while ${x.base} moves sideways.`,
    `${x.base} suddenly runs up 3% without dipping, so the bot stops selling small pieces and holds everything to ride the pump.`,
    `${x.base} tops out at ${x.px(x.price * 1.1)} and drops back to ${x.px(x.price * 1.1 * 0.985)}, so the bot sells the whole bag. It does not buy the dump.`,
    `${x.base} bottoms at ${x.px(x.price * 0.97)} and prints 3 green candles, so the grid starts again from there.`,
  ],
  grid: (x) => [
    `You pick a range, e.g. ${x.px(x.price * 0.9)} to ${x.px(x.price * 1.1)}, with lines inside it.`,
    `Every time ${x.base} drops to a line the bot buys a little; when it rises to the next line up it sells that piece for a small profit.`,
    `Sideways markets = many small wins. If ${x.base} leaves the range the bot waits (or moves up with "Trail range up").`,
  ],
  dca: (x) => [
    `The bot buys ${x.base} at ${x.px(x.price)} (base order).`,
    `If it falls ${x.p.deviation || 1.5}% it buys more (safety order), lowering the average price. It does this up to ${x.p.maxSafety || 6} times.`,
    `When the whole position is up ${x.p.takeProfit || 1.8}% from the average, it sells everything and starts a new deal.`,
  ],
  stepgrid: (x) => [`Like a grid with no range: it buys each time ${x.base} falls one "ATR step" under its last buy, and sells each piece one step above its own price.`],
  bb: (x) => [`Buys when ${x.base} closes under its lower Bollinger band (unusually cheap) and sells at the upper band or at take profit.`],
  emacross: (x) => [`Buys when the fast average of ${x.base} crosses above the slow one (trend turning up) and sells on the cross back down.`],
  rsi: (x) => [`Buys ${x.base} when RSI says it is oversold and sells when RSI says it is overbought.`],
  gain: (x) => [`Buys ${x.base} when it is a set % under its moving average, sells at a fixed gain.`],
  supertrend: (x) => [`Buys when SuperTrend flips green on ${x.base} and sells when it flips red.`],
  macd: (x) => [`Buys when MACD momentum turns up below zero and sells when it turns back down.`],
  newsbot: (x) => [
    `The news agent reads 20+ crypto news sources every 90 seconds, including Binance listings and the Zcash teams' blogs.`,
    `Bullish ${x.base} news appears, e.g. "${x.base} to be listed on a major exchange". The agent scores it and checks how ${x.base} moved after similar news before.`,
    `If the score is high and the price has not run yet, the bot buys ${x.base} at about ${x.px(x.price)} within seconds.`,
    `It sells at a target sized from that history (e.g. +1.8%), on a trailing stop, after 4 hours, or right away if bearish news follows.`,
  ],
};

export function ctxFor(price, symbol, p) {
  const [base, quote] = symbol.split('/');
  const d = price >= 1000 ? 2 : price >= 1 ? 3 : 6;
  return {
    price, base, quote, p: p || {},
    money: (v) => `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${quote}`,
    px: (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`,
  };
}
