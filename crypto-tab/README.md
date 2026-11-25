# Crypto Tab

A phone-first crypto trading terminal. Black theme, one-thumb controls, installable as an app on iPhone and Android.

| Screen | What it does |
|---|---|
| **Markets** | 30+ exchanges, live prices, favorites, USDT/USDC/USD/BTC tabs, a **Stocks** tab for tokenized stocks (xStocks, Ondo `…ON`, `…X` tokens on Gate, MEXC, KuCoin, Bybit), sortable by volume, price and 24h change |
| **Chart** | Pro candlestick chart: 7 chart types, 8 timeframes, 22 indicators, 17 drawing tools, and a **Future** layer that projects the next 30 bars with a probability band. Order book, trades, AI levels and one-tap Buy/Sell underneath |
| **Trade** | Exchange-style split screen: order form on the left (limit / market / stop-limit, steppers, 25-50-75-Max), live order book with depth bars and grouping on the right. Paper trading by default, live trading with your API key |
| **Bots** | Spot Grid (run **as many grids on the same pair as you like**, each with its own wallet), DCA, Step Grid (ATR), Bollinger Bounce, EMA Cross, RSI Reversal, Gain, SuperTrend, MACD. **Pause → edit → resume** at any time, **drag any grid line on the chart while the bot runs** (one line, stretch the range, or shift the whole grid), duplicate, stop (keep or sell coins) |
| **AI** | Entry and exit ranges for any token, an opportunity scanner, and a bot reviewer that backtests alternatives and lets you apply better settings with one tap |
| **Alerts** | Price above / below / cross / ±% alerts. A triggered alert **keeps ringing until you press STOP**. The default sound is a synthesized "cha-ching + coins" money sound (also played on profitable bot trades). Siren, beep and chime are options |

## Run it

```bash
cd crypto-tab
npm install
npm start
```

Open `http://localhost:8787` (or your server's address on your phone). The server prints a **passcode**. Enter it once in the app. Without a server the app still opens with demo data.

| Environment variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 8787) |
| `CT_TOKEN` | Your passcode. If unset, one is generated into `data/.token` |
| `CT_SECRET` | Key used to encrypt exchange API keys. If unset, one is generated into `data/.secret` |
| `ANTHROPIC_API_KEY` | Turns on the Claude analyst (`CT_AI_MODEL`, default `claude-opus-5-5`). Without it the built-in quant engine still works |
| `KRONOS_URL` | Optional Kronos forecast service (see below) |
| `CT_RENOTIFY_S` / `CT_MAX_RING_MIN` | How often a ringing alarm re-sends its push (default 30 s) and when it gives up (default 120 min) |
| `CT_TICK_MS` | Bot engine tick (default 5000 ms) |
| `CT_DATA_DIR` | Where bots, alerts, keys and the paper account are stored (default `crypto-tab/data`, git-ignored) |

Docker: `docker build -t crypto-tab crypto-tab && docker run -p 8787:8787 -v ct-data:/app/data -e CT_TOKEN=... crypto-tab`

**Where to host it:** bots, alarms and push notifications run on the server, so it has to stay on (a small VPS is enough). Choose its region with care. Binance and Bybit refuse API connections from US servers, while Binance.US, Coinbase, Kraken, OKX, KuCoin, Gate.io, MEXC and Bitget work from there.

## On your phone

- **iPhone:** open the address in Safari, then Share → **Add to Home Screen**, and launch Crypto Tab from the icon. Then Settings → **Enable notifications** (iOS 16.4+).
- **Android:** open in Chrome, then menu → **Install app**, and enable notifications.

### How the persistent alarm works

1. While the app is open, a triggered alert takes over the screen with a looping siren, vibration (Android) and the screen kept awake, until you press **STOP ALARM**.
2. While the app is closed or the phone is locked, the server re-sends a high-priority notification every 30 seconds until you tap **Stop alarm** on it, open the app and press STOP, or 2 hours pass.
3. Alerts can re-arm after you stop them ("Re-arm after I stop it").

A web app cannot loop sound in the background or override silent mode. For a true alarm-clock style ring on a locked phone (Android full-screen alarm, iOS Critical Alerts), the app needs a native wrapper such as Capacitor. That is the recommended next step.

## Exchange API keys

Settings → Exchange API keys. Keys are encrypted with AES-256-GCM on your server and never sent back to the phone. Create keys with **trade permission only, no withdrawals**, and restrict them to your server's IP. OKX, KuCoin, Bitget, Crypto.com, BloFin and WOO also need the passphrase. A testnet toggle is available where the exchange offers one.

Supported (through CCXT): Binance, Binance.US, Coinbase Advanced, Kraken, OKX, Bybit, KuCoin, Gate.io, MEXC, Bitget, HTX, Crypto.com, Bitfinex, Bitstamp, Gemini, BingX, LBank, WhiteBIT, Poloniex, Upbit, Phemex, XT.com, Hyperliquid, Bitvavo, Bitrue, DigiFinex, WOO X, BloFin, Bithumb, Deribit, Toobit, WEEX.

## Bots

All strategies live in `public/shared/strategies.mjs`. The same code runs the live engine, the backtester and the AI optimizer, so a backtest behaves like the real bot.

- **Pump Rider Grid** (new default): a high-frequency, rangeless grid with three phases:
  1. **Grid (sideways):** buys a lot every step down and sells the oldest profitable lot every step up (first in, first out). Once price climbs two steps in a row without a dip, it stops scalping small lots and holds them.
  2. **Ride (pump):** when the run reaches the pump size (or a strong candle breaks out above the 9/20 EMAs), it holds the whole bag and trails the high. It sells everything when price falls the trail % from the top or a reversal candle prints after RSI > 78.
  3. **Wait (dump):** no buying while price falls. It restarts the grid once the bottom is confirmed: N green candles with rising closes, price back above the 9 EMA and off the low, after at least the minimum drop from the top.

  **Move its lines while it runs:** in the bot's detail view its live lines sit on the chart: NEXT BUY, NEXT SELL, one sell line per open lot, SELL BAG while riding a pump, and RESTART while waiting. Drag any of them up or down and the running bot acts at exactly that price. A buy line dragged above the market buys on the next tick; a sell line dragged below it sells the oldest lot. Lines you set are marked ✋ and logged, and **Reset to auto** returns them to the measured step.
  A dump guard also stops it buying all the way down: it pauses at a set % under the grid high, or when every lot is used and price keeps falling. "Sell the bag on a dump" is optional. Every phase change is logged and sent as a notification.
- **Candle meter** (`public/shared/candlemeter.mjs`, AI screen and bot editor): measures how far each candle moves from low to high on 1m, 5m, 15m, 30m and 1h (average, median, quartiles). It then sets the grid step just under the median swing, kept inside your band (default 0.39–0.79%) and above the fee floor (2 × fee + 0.05%). For each timeframe it shows the share of candles that step catches and the trips per day, backtests it (holding vs selling the bag on a dump), and ranks the timeframes by profit per day. Auto step re-measures every hour while the bot runs. On real BTC, SOL and DOGE data, 1-minute candles only move about 0.08–0.10%. A 0.39% step therefore suits 15m–1h candles; to scalp 1m candles you need about a 0.08% step and a 0% maker-fee exchange.
- **Spot Grid**: arithmetic or geometric levels, seeds the coin for the sell levels above the price, optional stop loss, take profit and trailing range. Each grid has its own wallet, so several grids on BTC/USDT never touch each other's funds. Editing the range keeps the coins it holds and only re-assigns them to sell levels above breakeven. Dragging lines on the chart (same number of lines) keeps every open position on its slot. The bot simply buys and sells at the new prices from its next tick, without pausing.
- **DCA**: base order, safety orders with step scale and volume scale, take profit with optional trailing, stop loss, RSI or Bollinger start condition. With "Restart after TP" on, each new deal is sized from the bot's current equity, so profits compound.
- **Step Grid (ATR)**: a rangeless grid whose step follows volatility.
- **Signal bots** (Bollinger, EMA cross, RSI, Gain, SuperTrend, MACD): one position at a time with take profit, stop loss and trailing stop.

Paper bots simulate fills with a 0.1% fee. Live bots place marketable limit orders and book only what actually filled.

## AI

1. **Quant engine** (always on, `public/shared/optimizer.mjs`): market regime (EMA, ADX, RSI, volatility), support and resistance from pivot clusters, buy, take-profit and stop zones with a risk/reward score, and a parameter search. The search tunes settings on the first 70% of history and confirms them on the most recent 30%, to avoid overfitting.
2. **Claude desk** (`server/ai.mjs`, with `ANTHROPIC_API_KEY`): three roles (technical analyst, risk manager, head trader) read that evidence and return a structured verdict, concrete parameter changes, risks, and entry and exit ranges. The app applies the changes with one tap.
3. **Future forecast** (`public/shared/forecast.mjs`): an ensemble of an analog matcher (finds past candle sequences shaped like the current one) and bootstrapped Monte Carlo. If you run a [Kronos](https://github.com/shiyu-coder/Kronos) model service and set `KRONOS_URL`, the server asks it first. It POSTs `{candles, horizon, interval}` and expects `{points: [{time, mid, upper, lower}]}`.

Forecasts and AI suggestions are estimates, not guarantees.

## What came from the referenced projects

The projects were studied for ideas and design. Their code was not copied, and the strategies are original implementations.

- **TabTrader / TabGreater**: the market list and chart layout, the indicator set (MA, EMA, BOLL, SAR, VOL, MACD, RSI, KDJ, CCI, DMI, OBV and more), drawing tools that are tap-to-select, drag, lock, and saved per market with a magnet, and price flashes.
- **MEXC app**: the split order form and order book, the buy/sell pressure bar, and depth grouping.
- **goodcrypto.app / Gunbot**: bot types (grid, DCA, step grid, Bollinger, EMA, Gain, trailing exits) and pause/edit/resume control.
- **Kronos**: the K-line forecasting idea and an optional hook for the real model.
- **TradingAgents**: the multi-role analyst, risk manager and trader desk.
- **Vibe-Trading / daily_stock_analysis / last30days**: AI-written decision cards with entry and exit points and a scanner.
- **Freqtrade**: walk-forward backtesting before trusting parameters.
- **FinceptTerminal / OpenBB**: a single terminal over many data sources, here 30+ exchanges through CCXT.

## Project layout

```
crypto-tab/
  server/          index.mjs (HTTP + SSE), exchanges.mjs (CCXT), bots.mjs (engine),
                   alerts.mjs (alarms + web push), paper.mjs, ai.mjs (Claude + quant), store.mjs
  public/          PWA: index.html, styles.css, sw.js, manifest
    js/            app, markets, chartview, chart, drawings, trade, book, bots, ai, alerts, settings
    shared/        indicators, strategies (+ backtester), optimizer, forecast  (used by server and browser)
  tests/           node --test
```

Tests: `npm test`.

Credits: charts by [TradingView Lightweight Charts™](https://www.tradingview.com/) (Apache-2.0), exchange connectivity by [CCXT](https://github.com/ccxt/ccxt) (MIT).

**Risk:** crypto and tokenized-stock trading can lose money. Start in paper mode, use small amounts live, and never give an API key withdrawal rights.
