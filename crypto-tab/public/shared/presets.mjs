// Coin presets for the Pump Rider Grid. ZEC (Zcash) is the main coin.
// These are offline fallbacks. With a server, every token (any coin on any exchange) gets a
// fresh measured profile from /api/ai/profile, so these are only starting points.
// Measured with the token profiler on MEXC on 2026-11-25. Each coin is measured separately.
export const MAIN_COIN = 'ZEC';
export const COINS = ['ZEC', 'BTC', 'ETH', 'SOL', 'XRP'];

export const PRESETS = {
  ZEC: { note: "Main coin. ZEC 15m candles swing 0.81% (median). Step ≈ 0.7275%, 8 lots, dump guard 6.1%, sells the bag on dumps, fee 0.05%. Backtest +2.02% vs hold -8.59% over 4.6 days (good fit).", params: {"timeframe":"15m","autoStep":true,"stepMin":0.39,"stepMax":0.79,"maxLots":8,"dumpPct":6.1,"dumpSell":true,"resumeDrop":4,"confirmCandles":3,"feePct":0.05,"pumpPct":0,"trailPct":0,"holdRun":2,"rideAdd":0,"stopLoss":0} },
  BTC: { note: "BTC 15m candles swing 0.39% (median). Step ≈ 0.39%, 8 lots, dump guard 3%, holds lots through dumps, fee 0.05%. Backtest +1.45% vs hold -1.63% over 4.6 days (good fit).", params: {"timeframe":"15m","autoStep":true,"stepMin":0.39,"stepMax":0.79,"maxLots":8,"dumpPct":3,"dumpSell":false,"resumeDrop":2,"confirmCandles":3,"feePct":0.05,"pumpPct":0,"trailPct":0,"holdRun":2,"rideAdd":0,"stopLoss":0} },
  ETH: { note: "ETH 30m candles swing 0.61% (median). Step ≈ 0.5531%, 8 lots, dump guard 4.6%, holds lots through dumps, fee 0.05%. Backtest +2.16% vs hold -9.68% over 9.1 days (good fit).", params: {"timeframe":"30m","autoStep":true,"stepMin":0.39,"stepMax":0.79,"maxLots":8,"dumpPct":4.6,"dumpSell":false,"resumeDrop":3.1,"confirmCandles":3,"feePct":0.05,"pumpPct":0,"trailPct":0,"holdRun":2,"rideAdd":0,"stopLoss":0} },
  SOL: { note: "SOL 30m candles swing 0.71% (median). Step ≈ 0.6426%, 8 lots, dump guard 5.4%, holds lots through dumps, fee 0.05%. Backtest +0.14% vs hold -6.24% over 9.1 days (good fit).", params: {"timeframe":"30m","autoStep":true,"stepMin":0.39,"stepMax":0.79,"maxLots":8,"dumpPct":5.4,"dumpSell":false,"resumeDrop":3.6,"confirmCandles":3,"feePct":0.05,"pumpPct":0,"trailPct":0,"holdRun":2,"rideAdd":0,"stopLoss":0} },
  XRP: { note: "XRP 5m candles swing 0.26% (median). Step ≈ 0.39%, 8 lots, dump guard 3%, holds lots through dumps, fee 0%. Backtest -1.34% vs hold -6.28% over 1.5 days (beats holding, still negative).", params: {"timeframe":"5m","autoStep":true,"stepMin":0.39,"stepMax":0.79,"maxLots":8,"dumpPct":3,"dumpSell":false,"resumeDrop":2,"confirmCandles":3,"feePct":0,"pumpPct":0,"trailPct":0,"holdRun":2,"rideAdd":0,"stopLoss":0} },
};

export const presetFor = (symbol) => PRESETS[symbol.split('/')[0]] || null;
