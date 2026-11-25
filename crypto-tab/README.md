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

## Live deployment

**https://crypto-tab.onrender.com** is a Render web service named `crypto-tab`.

- **Source:** it deploys from this repo's `claude/crypto-trading-terminal-1wkcyx` branch, and every push redeploys it automatically.
- **Commands:** build `cd crypto-tab && npm ci`, start `cd crypto-tab && node server/index.mjs`.
- **Settings:** `CT_TOKEN` (the passcode), `CT_SECRET` (encrypts API keys and the Telegram token), `NODE_VERSION=22`, `CT_NEWS_WATCH`.
- **Free plan limits:**
  - The service sleeps after about 15 minutes with no visitors and wakes on the next visit, which takes about a minute. While asleep, bots, alarms and the news and herd agents pause.
  - Saved data (bots, alerts, keys, learning) resets on every redeploy.
  - For 24/7 bots and alarms, switch the service to the **Starter** plan and add a **persistent disk** mounted at `/opt/render/project/src/crypto-tab/data` (or set `CT_DATA_DIR` to the disk path).
- **Region:** the service runs in Oregon (US), where Binance.com and Bybit block API access. MEXC, Coinbase, Kraken, OKX, KuCoin, Gate.io, Bitget and Binance.US work there.

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

## Accounts & Crypto Tab Pro ($10/month)

Anyone can create an account (email + password). The server owner still unlocks with the passcode (`CT_TOKEN`) and always has full access.

| | Free | Pro |
|---|---|---|
| Charts, indicators, drawings, news, herd, bubbles, pump clock | ✓ | ✓ |
| Manual trading (paper, or live with your own API keys) | ✓ | ✓ |
| Spot Grid & DCA bots (paper) | ✓ | ✓ |
| Every other bot (Pump Rider, Herd, News, Phoenix, Step Grid, signal bots) | | ✓ |
| Live bot trading on your exchange | | ✓ |
| AI bot tuning / auto-fill | | ✓ |

Each user has their own bots, alerts, paper account and encrypted exchange keys; nobody sees anyone else's.

**Payments**
- **Card (Stripe):** set `STRIPE_SECRET_KEY` on the server. Checkout creates a $10/month subscription. Optional webhook: point Stripe at `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`. Without the webhook, subscriptions are confirmed on return and re-checked every 6 hours.
- **Crypto (ZEC, BTC, SOL, XRP):** set your receiving addresses as `CT_PAY_ZEC`, `CT_PAY_BTC`, `CT_PAY_SOL`, `CT_PAY_XRP`, or in the app under Settings → Owner dashboard. Each invoice has a unique amount (XRP uses a destination tag) and the server checks the blockchain every 45 s. Once it's paid, Pro is extended by 30 days per month bought (1, 3 or 12). Use a **transparent (t1…) Zcash address**; shielded payments can't be seen by the server.
- **Free access:** list emails in `CT_COMP_EMAILS` (comma separated), or use Owner dashboard → Free access. It works even before the person signs up.
- Price: `CT_PRICE_USD` (default 10).

**Storage:** accounts and subscriptions live in `CT_DATA_DIR`. On a host without a persistent disk (e.g. Render's free plan), they are wiped on every redeploy.

## Exchange API keys

Settings → Exchange API keys. Keys are encrypted with AES-256-GCM on your server and never sent back to the phone. Create keys with **trade permission only, no withdrawals**, and restrict them to your server's IP. OKX, KuCoin, Bitget, Crypto.com, BloFin and WOO also need the passphrase. A testnet toggle is available where the exchange offers one.

Supported (through CCXT): Binance, Binance.US, Coinbase Advanced, Kraken, OKX, Bybit, KuCoin, Gate.io, MEXC, Bitget, HTX, Crypto.com, Bitfinex, Bitstamp, Gemini, BingX, LBank, WhiteBIT, Poloniex, Upbit, Phemex, XT.com, Hyperliquid, Bitvavo, Bitrue, DigiFinex, WOO X, BloFin, Bithumb, Deribit, Toobit, WEEX.

## News & sentiment agent

A CryptoPanic-style news feed with an AI trading agent on top (**News** tab).

- **Sources** (refreshed every 90 s):
  - **Crypto news sites:** CoinDesk, Cointelegraph, The Block, Decrypt, Blockworks, The Defiant, Bitcoin Magazine, CryptoSlate, CryptoPotato, NewsBTC, Bitcoinist, U.Today, BeInCrypto, AMBCrypto, The Daily Hodl, Cryptonews and CoinJournal.
  - **Binance listing announcements.**
  - **Zcash sources:** Electric Coin Co, the Zcash Foundation and the Zcash forum.
- **Each article** is tagged with the tokens it mentions (ticker, `$TICKER` or name, matched against every token the exchange lists). It also gets a bullish/bearish score, an importance score and a category (listing, hack, regulation, ETF, macro, partnership, upgrade, flows, price). With `ANTHROPIC_API_KEY` set, Claude also reads the headlines and adds an impact rating, a one-line summary and a short trading take.
- **What happened after the news:** for every tagged token the server records the price when the article came out, then the move 15 minutes, 1 hour, 4 hours and 24 hours later, plus the biggest spike in the first hour. Older articles are measured from 5-minute candles. This is shown on each article and gathered into statistics per sentiment, category and token ("What happens after news").
- **Signals:** fresh news (up to 6 h old) on a token the exchange lists becomes a signal.
  - **Score:** combines sentiment, importance, Claude's impact rating, and whether history agrees. When this kind of news usually moved price the other way, the score is cut.
  - **Target and stop:** sized from the token's typical spike after news and its volatility.
  - **Labels:** "priced in" once the move already happened; WATCH or CAUTION when the score is below 0.55.
- **The agent trades on it:**
  - **News Sentiment Bot** (new bot type): buys fresh strong bullish news before it is priced in, and sells at the target or stop, on a trailing stop, after a time limit, or on bearish news.
  - **News guard** on the Pump Rider: bearish news switches it to "wait for the bottom", and strong bullish news makes it hold its lots for 30 minutes.
  - **Notifications** for strong news on ZEC, BTC, ETH, SOL, XRP and every token a bot is trading (`CT_NEWS_WATCH`).
- **Chart:** 📰 arrows mark news on the chart (green bullish, red bearish). Tap one to read the articles and see the price then and now.
- **The news agent keeps learning:** every live signal is graded 4 hours later from real candles (did it hit the target before the stop?). Those results update how much it trusts each source, category and coin, which feeds back into future signal scores. Its track record is shown in the News tab.
- `CT_NEWS_EXCHANGE` (default `mexc`) is the exchange used to price news reactions. `CT_HERD_EXCHANGE` / `CT_HERD_UNIVERSE` set the herd agent's exchange and how many coins it watches.

## Herd agent: coins that pump and tank together

Big players (funds, market makers, ETF flows, liquidation cascades) move baskets of tokens at the same moment. The agent can't see who is trading, but it detects the footprint and follows it (AI → Herd agent).

- **Groups:** every 30 minutes it re-measures the most-traded ~45 tokens plus ZEC, BTC, ETH, SOL, XRP and every token a bot trades. It uses 7.5 days of 15-minute prices and finds:
  - **Market groups:** coins that move with Bitcoin.
  - **Hidden groups:** coins that still move together once Bitcoin's influence is removed, a sign of one player or theme pushing them. On 2026-11-25 these were a 24-coin altcoin pack (SOL, SUI, DOGE, LINK…), **HYPE + ZEC + LIT**, and ETH + BNB.
- **Leaders:** which coins' moves predict the rest of their group's next 15 minutes.
- **Pumps & dumps together:** every moment in the last week when a big share of the coins moved unusually in the same direction within 30 minutes. For each it records who moved first, the average move, what happened 1 h and 4 h later, and how many group members that hadn't moved yet followed.
- **Live:** every minute it checks each group. When enough of a group moves together, it signals which members haven't moved yet (laggards that usually follow), with a learned confidence. You get a notification if the group contains ZEC, BTC, ETH, SOL, XRP or a bot's coin.
- **It keeps learning:** it starts with a week of history, then grades every live call 60 minutes later (did the laggards follow?). The result updates the follow rate per group and direction and each leader's reliability, with older results slowly fading. It also raises or lowers how much of a group must move before it fires, depending on its recent hit rate.
- **Herd Follower bot** (new bot type): buys a coin when its group starts pumping together and it hasn't moved yet, and sells at a target sized from the group move, on a trailing stop, after a time limit, or as soon as the group starts dumping together.
- **Herd guard** on the Pump Rider: a group dump stops buying (and sells the bag if "sell the bag on a dump" is on); a group pump holds lots.
- ⚡ markers on the chart show the group moves a coin took part in.

## Pump clock: when do pumps and dumps happen? (AI → Pump clock)

- **Data:** up to 2 years of hourly candles per coin from Binance's public archive (data.binance.vision, cached), or a 12-coin market basket.
- **When:** pumps and dumps (moves of 2× the normal size) by hour and weekday, in **your time zone**, next to when world markets open (Tokyo, Hong Kong, London, New York open and close, the UTC daily close, the CME reopen).
- **Repeat check:** the first 70% of the history finds the pattern and the last 30% checks it. "Timing repeats" and "direction repeats" are reported separately.
- **News:** two years of headlines per coin (Google News date-range search) matched to the biggest pump and dump days. It shows how price moved on bullish and bearish news days, and what hour news breaks.
- **ZEC, measured on 2026-11-25 in Phoenix time:**
  - The biggest moves, up and down, happen **6–9 AM MST**, around the US stock open at 7:30 AM.
  - Nights from 11 PM to 2 AM are the quietest, and Saturday has about half the dumps of other days.
  - Timing repeats on the unseen data; direction by hour does not, so no hour is a buy or sell signal on its own.
  - 81% of ZEC's biggest-move days had news that day or the day before (63% of quiet days). On bullish-news days ZEC averaged +1.8%.

## Time zone

Settings → Time zone sets the zone used by every time in the app: chart axis, crosshair, news, herd moves, the pump clock and bot call logs. The default is the phone's own zone. Phoenix = Mountain Standard Time all year (Arizona has no daylight saving).

## Bubbles, Matrix, List (Markets tab)

- **Bubbles:** a live physics field of the top 200 coins on the exchange. Each bubble is sized by its move (or volume) and colored green or red by its hour, day, week, month or year performance. Drag and fling the bubbles, and tap one for details.
- **Matrix:** tiles sized by trading volume, colored by performance.
- **List:** a sortable performance table for all five periods.

The coin detail sheet shows all the changes and a mini chart, with buttons for Chart, Trade, Alert, Pump Rider and Profile.

## From the ZORA Zcash agent

- **Phoenix Reversal bot:** the WAIT → WATCH → READY state machine from ZORA's strategy spec.
  - **WATCH** after a sharp drop measured in ATR, with RSI weak and heavy volume.
  - **READY** only after a higher low, a closed candle back above EMA20 and a retest that holds, with BTC not dumping and a tight order-book spread.
  - **Risk:** the position is sized so the stop loses at most your max loss, with a minimum stop of 0.8× ATR. A third is sold at +1%, a third at +2% (stop moves to break-even), and the rest trails.
  - **Call log:** every call is logged with time-zone timestamps.
  - **Backtest (86 days of 5m candles, falling market):** ZEC −1.1% vs holding −19.8%. BTC and SOL took many small capped losses, roughly matching buy-and-hold. The live BTC and order-book filters, which a backtest cannot model, are meant to skip those, so try it on paper first.
- **Telegram:** alerts (alarms repeat while ringing, plus profits, bot events, news and herd moves) and commands: `/price ZEC`, `/bots`, `/pause all`, `/resume all`, `/stop` (silences alarms), `/alerts`, `/news ZEC`, `/herd`. Set it up in Settings → Telegram, or with `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`. The token is stored encrypted, and only your chat is answered.
- **Google News** for Zcash and for crypto in general, as live news sources.
- **Order-book health** on the Trade screen: spread and ±1% depth.

## Buy / sell arrows

The chart shows your real fills: green ▲ buys and red ▼ sells, with the arrow tip on the exact fill price, placed on the candle the trade happened in, on every timeframe. Fills come from bots, the paper account, and your exchange's trade history when an API key is saved. Each bot's chart shows its own trades. The ▲▼ button turns them off.

## Token profiles (any token)

Every token on every exchange can be measured on its own (AI → Token profile, or automatically when you pick a coin for a Pump Rider bot). The profile measures:
- its candle swing on 1m–1h;
- the exchange's real taker fee;
- backtests on every timeframe, both holding and selling on dumps.

The settings are then derived from the token's own volatility:

| Setting | How it is set |
|---|---|
| Timeframe | Best profit per day in the backtests |
| Step | Just under the typical candle swing |
| Dump guard | 7.5 typical candle swings |
| Max lots | Dump guard ÷ step |
| Restart drop | 5 typical candle swings |
| Fee | The exchange's taker fee for that pair |
| On dumps | Hold or sell the bag, whichever earned more |

**Best tokens for the grid** ranks every liquid token by how well its candles fit the step band, how much it trades, and how sideways it is. Measured separately on MEXC on 2026-11-25:

| Token | Best candles | Swing | Step | Dump guard | Backtest | Holding |
|---|---|---|---|---|---|---|
| ZEC | 15m | 0.81% | 0.73% | 6.1% (sell the bag) | +2.0% | −8.6% |
| BTC | 15m | 0.39% | 0.39% | 3.0% | +1.5% | −1.6% |
| ETH | 30m | 0.61% | 0.55% | 4.6% | +2.2% | −9.7% |
| SOL | 30m | 0.71% | 0.64% | 5.4% | +0.1% | −6.2% |
| XRP | 5m | 0.26% | 0.39% | 3.0% | −1.3% | −6.3% (candles below the band right now) |

## Locking lines

The 🔓/🔒 button on a bot's chart locks its lines, so they can't be dragged by accident. It is unlocked by default, and once you lock a bot it stays locked. The drawing bar has a matching lock for chart drawings.

## Bots

All strategies live in `public/shared/strategies.mjs`. The same code runs the live engine, the backtester and the AI optimizer, so a backtest behaves like the real bot.

- **Pump Rider Grid** (new default): a high-frequency, rangeless grid with three phases:
  1. **Grid (sideways):** buys a lot every step down and sells the oldest profitable lot every step up (first in, first out). Once price climbs two steps in a row without a dip, it stops scalping small lots and holds them.
  2. **Ride (pump):** when the run reaches the pump size (or a strong candle breaks out above the 9/20 EMAs), it holds the whole bag and trails the high. It sells everything when price falls the trail % from the top or a reversal candle prints after RSI > 78.
  3. **Wait (dump):** no buying while price falls. It restarts the grid once the bottom is confirmed: N green candles with rising closes, price back above the 9 EMA and off the low, after at least the minimum drop from the top.

  **Move its lines while it runs:** in the bot's detail view its live lines sit on the chart: NEXT BUY, NEXT SELL, one sell line per open lot, SELL BAG while riding a pump, and RESTART while waiting. Drag any of them up or down and the running bot acts at exactly that price. A buy line dragged above the market buys on the next tick; a sell line dragged below it sells the oldest lot. Lines you set are marked ✋ and logged, and **Reset to auto** returns them to the measured step.
  A dump guard also stops it buying all the way down: it pauses at a set % under the grid high, or when every lot is used and price keeps falling. "Sell the bag on a dump" is optional. Every phase change is logged and sent as a notification.
- **Candle meter** (`public/shared/candlemeter.mjs`, AI screen and bot editor): measures how far each candle moves from low to high on 1m, 5m, 15m, 30m and 1h (average, median, quartiles). It then sets the grid step just under the median swing, kept inside your band (default 0.39–0.79%) and above the fee floor (2 × fee + 0.05%). For each timeframe it shows the share of candles that step catches and the trips per day, backtests it (holding vs selling the bag on a dump), and ranks the timeframes by profit per day. Auto step re-measures every hour while the bot runs. On real BTC, SOL and DOGE data, 1-minute candles only move about 0.08–0.10%. A 0.39% step therefore suits 15m–1h candles; to scalp 1m candles you need about a 0.08% step and a 0% maker-fee exchange.
- **Every bot can be set up before it starts:** "Save as draft" keeps it switched off. In a draft you can change the coin, the exchange's quote currency, the bot type, paper or live, and every setting, then press **Start**. Running bots stay editable too (pause → edit → resume).
- **Help for every setting:** the **i** next to each setting explains it in plain words, with an example using the coin's live price. **Ask the AI agent** suggests a value for that coin from measured data (candle swings, the exchange's real fee, backtests) and **Use** fills it in. Each bot also shows a short "How it works with ZEC" walkthrough.
- **Zcash (ZEC) is the main coin:** the app opens on ZEC/USDT (MEXC, 15m), and ZEC is first in favorites, the top strip and the bot coin picker, followed by BTC, ETH, SOL and XRP. Measured on 2026-11-25:
  - **Candle swing:** ZEC's 15m candles swing about 0.8%, roughly twice BTC/ETH/SOL/XRP. The 0.39–0.79% step band therefore fits ZEC on 5m–15m candles, and the others on 15m–30m.
  - **Exchange:** MEXC is the cheapest place to grid ZEC (0.05% taker). OKX charges 0.15%, Gate 0.2%, Kraken 0.26% and Coinbase 1.2%, which is too expensive for small steps. ZEC trades on 23 of the supported exchanges, including Binance.US, Coinbase, Kraken, OKX, KuCoin, Gate.io, MEXC and Bitget; Crypto.com, Upbit and Bitvavo don't list it.
  - **Presets** (`public/shared/presets.mjs`) hold these starting settings per coin. A 4.6-day backtest of the ZEC preset on MEXC 15m returned +2.0% while ZEC fell 7.8%. That is a short, recent window, not a promise.
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
