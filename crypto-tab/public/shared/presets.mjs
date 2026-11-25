// Coin presets for the Pump Rider Grid. ZEC (Zcash) is the main coin.
// Starting points measured with the candle meter on MEXC on 2026-11-25. Auto step keeps
// re-measuring while the bot runs, and "Measure candle %" refreshes them any time.
export const MAIN_COIN = 'ZEC';
export const COINS = ['ZEC', 'BTC', 'ETH', 'SOL', 'XRP'];

export const PRESETS = {
  ZEC: { note: 'Zcash moves about 2× more per candle than BTC (15m swing ≈ 0.8%). Best tested: 15m candles, ~0.73% step, sell the bag on dumps. Cheapest to trade on MEXC (0.05% taker vs 1.2% on Coinbase).', params: { timeframe: '15m', autoStep: true, stepMin: 0.39, stepMax: 0.79, maxLots: 8, dumpPct: 6, dumpSell: true, confirmCandles: 3, resumeDrop: 4, feePct: 0.05 } },
  BTC: { note: 'Bitcoin 15m swing ≈ 0.39%. Best tested: 15m candles at the 0.39% minimum step.', params: { timeframe: '15m', autoStep: true, stepMin: 0.39, stepMax: 0.79, maxLots: 12, dumpPct: 4, dumpSell: false, confirmCandles: 3, resumeDrop: 3 } },
  ETH: { note: 'Ethereum 15m swing ≈ 0.43%, 30m ≈ 0.61%. Best tested: 30m candles, ~0.55% step.', params: { timeframe: '30m', autoStep: true, stepMin: 0.39, stepMax: 0.79, maxLots: 12, dumpPct: 4, dumpSell: false, confirmCandles: 3, resumeDrop: 3 } },
  SOL: { note: 'Solana 15m swing ≈ 0.49%, 30m ≈ 0.71%. Best tested: 30m candles, ~0.64% step.', params: { timeframe: '30m', autoStep: true, stepMin: 0.39, stepMax: 0.79, maxLots: 12, dumpPct: 5, dumpSell: false, confirmCandles: 3, resumeDrop: 3 } },
  XRP: { note: 'XRP 15m swing ≈ 0.46%, 30m ≈ 0.69%. Best tested: 30m candles, ~0.62% step.', params: { timeframe: '30m', autoStep: true, stepMin: 0.39, stepMax: 0.79, maxLots: 12, dumpPct: 5, dumpSell: false, confirmCandles: 3, resumeDrop: 3 } },
};

export const presetFor = (symbol) => PRESETS[symbol.split('/')[0]] || null;
