// AI analyst.
// Layer 1 (always on, free): the quantitative engine in public/shared/optimizer.mjs - regime,
//   zones, walk-forward backtested parameter search, forecast.
// Layer 2 (when ANTHROPIC_API_KEY is set): Claude reads that evidence as a small trading desk
//   (technical analyst, risk manager, head trader - the TradingAgents pattern) and returns a
//   structured verdict with concrete parameter changes the app can apply with one tap.
import Anthropic from '@anthropic-ai/sdk';
import * as X from './exchanges.mjs';
import * as Bots from './bots.mjs';
import { optimize, zones, marketStats, suggestGrid } from '../public/shared/optimizer.mjs';
import { forecast } from '../public/shared/forecast.mjs';
import { STRATEGIES } from '../public/shared/strategies.mjs';
import { tfSeconds } from '../public/shared/optimizer.mjs';

const MODEL = process.env.CT_AI_MODEL || 'claude-opus-5-5';
let client = null;
const hasKey = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
function anthropic() { if (!client) client = new Anthropic(); return client; }
export const status = () => ({ claude: hasKey(), model: hasKey() ? MODEL : null });

const DESK = `You are the trading desk inside Crypto Tab, a mobile crypto trading terminal.
You work as three roles and merge their views into one answer:
1. Technical analyst: reads the regime, indicators, support/resistance and forecast.
2. Risk manager: protects capital first. Flags ranges that price is likely to leave, grids with steps too small to beat fees (round-trip fees are about 0.2%), DCA settings whose safety orders could exhaust the wallet, and missing stop losses in trending-down markets.
3. Head trader: decides and proposes concrete, numeric parameter changes.

Rules:
- Base every number on the evidence provided (backtests, stats, zones). Never invent prices.
- Prefer the optimizer's walk-forward "best" parameters when its test result beats the current settings, but adjust them if the regime makes them risky.
- Only propose keys that exist in the bot's parameter list. Values are strings of plain numbers, booleans or option names.
- Compounding: for DCA and signal bots, keep "repeat" on so profits are reinvested; size orders as a fraction of the wallet.
- Be direct and brief. The user reads this on a phone. No hype, and remind them that results are not guaranteed only once, in "risks".`;

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'confidence', 'headline', 'summary', 'changes', 'risks', 'entry_zone', 'exit_zone'],
  properties: {
    verdict: { type: 'string', enum: ['keep', 'adjust', 'pause', 'stop', 'start', 'wait'] },
    confidence: { type: 'integer', description: '0-100' },
    headline: { type: 'string', description: 'one line, under 90 characters' },
    summary: { type: 'string', description: '2-5 short sentences' },
    changes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value', 'reason'], properties: { key: { type: 'string' }, value: { type: 'string' }, reason: { type: 'string' } } } },
    risks: { type: 'array', items: { type: 'string' } },
    entry_zone: { type: 'string', description: 'price range to get in, e.g. "61200 - 62050"' },
    exit_zone: { type: 'string', description: 'price range to take profit' },
  },
};

async function askClaude(evidence) {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    system: DESK,
    messages: [{ role: 'user', content: `Evidence (JSON):\n${JSON.stringify(evidence)}` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('The AI declined this request');
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ...JSON.parse(text), model: res.model };
}

function heuristicVerdict(kind, ev) {
  // Used when no Claude key is configured: turn the optimizer output into the same shape.
  const best = ev.optimizer?.best;
  const cur = ev.optimizer?.current?.test;
  const changes = [];
  const bestLoses = best ? best.test.pnlPct < 0 : (cur ? cur.pnlPct < 0 : false);
  if (best && (!cur || best.test.pnlPct - 0.7 * best.test.maxDrawdownPct > cur.pnlPct - 0.7 * cur.maxDrawdownPct + 0.25)) {
    for (const [k, v] of Object.entries(best.params)) if (ev.bot?.params?.[k] !== v && k !== 'investment') changes.push({ key: k, value: String(v), reason: 'Higher walk-forward score' });
  }
  const z = ev.zones;
  const risks = ['Backtests and forecasts are estimates; results are not guaranteed.'];
  if (ev.stats.regime.startsWith('trending down')) risks.push('Market is trending down: consider a stop loss or smaller allocation.');
  if (ev.bot?.type === 'grid' && (ev.stats.price < ev.bot.params.lower || ev.stats.price > ev.bot.params.upper)) risks.push('Price is outside the grid range, so the grid is idle.');
  return {
    verdict: kind === 'bot'
      ? (bestLoses && ev.stats.regime.startsWith('trending down') ? 'pause' : changes.length ? 'adjust' : 'keep')
      : z.score >= 65 ? 'start' : 'wait',
    confidence: Math.round(z.score),
    headline: kind === 'bot' && bestLoses && ev.stats.regime.startsWith('trending down') ? 'Downtrend: even the best settings lost money. Consider pausing.' : changes.length ? `${changes.length} setting change(s) tested better` : z.verdict,
    summary: `Regime: ${ev.stats.regime}, RSI ${ev.stats.rsi?.toFixed(1)}, daily volatility ${ev.stats.dailyVolPct?.toFixed(2)}%. Forecast bias ${ev.forecast?.bias} (${ev.forecast?.expectedMovePct?.toFixed(2)}% over ${ev.forecast?.horizon} bars).` + (best ? ` Best tested settings returned ${best.test.pnlPct.toFixed(2)}% on recent data (max drawdown ${best.test.maxDrawdownPct.toFixed(2)}%).` : ''),
    changes, risks,
    entry_zone: `${z.buyZone[0]} - ${z.buyZone[1]}`, exit_zone: `${z.sellZone[0]} - ${z.sellZone[1]}`,
    model: 'quant engine',
  };
}

async function evidenceFor(exchange, symbol, tf, type, params) {
  const candles = await X.ohlcv(exchange, symbol, tf, 1000);
  if (candles.length < 150) throw X.httpError(400, 'Not enough price history for analysis');
  const z = zones(candles, tf);
  const fc = forecast(candles, tfSeconds(tf), 30);
  const opt = type ? await optimize(type, params, candles, { tf }) : null;
  const strip = (r) => r && (({ trades_sample, ...rest }) => (void trades_sample, rest))(r);
  return {
    exchange, symbol, timeframe: tf, stats: z.stats, levels: z.levels,
    zones: { buyZone: z.buyZone, sellZone: z.sellZone, stop: z.stop, riskReward: z.riskReward, score: z.score, verdict: z.verdict },
    forecast: { model: fc.model, horizon: fc.horizon, bias: fc.bias, expectedMovePct: fc.expectedMovePct, rangePct: fc.rangePct },
    optimizer: opt && {
      tested: opt.tested, note: opt.note,
      current: opt.current && { train: strip(opt.current.train), test: strip(opt.current.test) },
      best: opt.best && { params: opt.best.params, train: strip(opt.best.train), test: strip(opt.best.test) },
      alternatives: opt.alternatives,
    },
    candles,
  };
}

// Analyse a running bot and propose better parameters.
export async function analyzeBot(id) {
  const b = Bots.view(Bots.get(id));
  const tf = b.params.timeframe || (b.type === 'grid' ? '1h' : '15m');
  const ev = await evidenceFor(b.exchange, b.symbol, tf, b.type, b.params);
  const { candles, ...evidence } = ev; void candles;
  evidence.bot = { type: b.type, label: b.label, params: b.params, fields: STRATEGIES[b.type].fields.map((f) => f[0]), live: b.stats };
  const ai = hasKey() ? await askClaude({ task: 'Review this running bot and propose parameter changes that improve risk-adjusted, compounding returns.', ...evidence }).catch((e) => ({ ...heuristicVerdict('bot', evidence), error: e.message })) : heuristicVerdict('bot', evidence);
  ai.changes = (ai.changes || []).filter((c) => evidence.bot.fields.includes(c.key));
  return { ai, evidence };
}

// Analyse a bot *before* it is created (from the bot editor).
export async function analyzeDraft({ exchange, symbol, type, params }) {
  const tf = params?.timeframe || (type === 'grid' ? '1h' : '15m');
  const ev = await evidenceFor(exchange, symbol, tf, type, params || {});
  const { candles, ...evidence } = ev;
  evidence.bot = { type, params, fields: STRATEGIES[type].fields.map((f) => f[0]) };
  const ai = hasKey() ? await askClaude({ task: 'The user is about to start this bot. Propose the best starting parameters.', ...evidence }).catch((e) => ({ ...heuristicVerdict('bot', evidence), error: e.message })) : heuristicVerdict('bot', evidence);
  ai.changes = (ai.changes || []).filter((c) => evidence.bot.fields.includes(c.key));
  return { ai, evidence, suggestion: type === 'grid' ? suggestGrid(candles, tf, params?.investment || 500) : null };
}

// Entry / exit ranges for a token.
export async function analyzeSymbol({ exchange, symbol, tf = '1h' }) {
  const ev = await evidenceFor(exchange, symbol, tf, null, null);
  const { candles, ...evidence } = ev; void candles;
  const ai = hasKey() ? await askClaude({ task: 'Give the best entry and exit ranges for this token and say whether to buy now, wait, or avoid.', ...evidence }).catch((e) => ({ ...heuristicVerdict('symbol', evidence), error: e.message })) : heuristicVerdict('symbol', evidence);
  return { ai, evidence };
}

// Scan the most liquid pairs on an exchange and rank opportunities.
export async function scan({ exchange, quote = 'USDT', top = 25, tf = '1h' }) {
  const m = await X.markets(exchange);
  const picks = m.markets.filter((r) => r.q === quote).slice(0, Math.min(40, top));
  const rows = [];
  for (let i = 0; i < picks.length; i += 5) {
    const batch = await Promise.allSettled(picks.slice(i, i + 5).map(async (r) => {
      const c = await X.ohlcv(exchange, r.s, tf, 300);
      if (c.length < 120) return null;
      const z = zones(c, tf);
      const f = forecast(c, tfSeconds(tf), 24);
      return { symbol: r.s, price: r.p, change24h: r.c, volume: r.v, score: z.score, verdict: z.verdict, buyZone: z.buyZone, sellZone: z.sellZone, stop: z.stop, riskReward: z.riskReward, regime: z.stats.regime, rsi: z.stats.rsi, forecastPct: f.expectedMovePct, bias: f.bias, gridFit: z.stats.regime === 'ranging' && z.stats.dailyVolPct > 1.5 };
    }));
    for (const b of batch) if (b.status === 'fulfilled' && b.value) rows.push(b.value);
  }
  rows.sort((a, b) => b.score - a.score || b.riskReward - a.riskReward);
  return { exchange, timeframe: tf, time: Date.now(), results: rows };
}

export async function symbolStats(exchange, symbol, tf) {
  const c = await X.ohlcv(exchange, symbol, tf, 500);
  return marketStats(c, tf);
}

// Kronos (https://github.com/shiyu-coder/Kronos) can be served next to the app; if KRONOS_URL
// is set, the forecast endpoint asks it first and falls back to the built-in ensemble.
export async function forecastFor(exchange, symbol, tf, horizon = 30) {
  const candles = await X.ohlcv(exchange, symbol, tf, 1000);
  if (process.env.KRONOS_URL) {
    try {
      const r = await fetch(process.env.KRONOS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candles: candles.slice(-400), horizon, interval: tfSeconds(tf) }), signal: AbortSignal.timeout(20000) });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.points)) return { model: 'kronos', ...j }; }
    } catch { /* fall through */ }
  }
  return forecast(candles, tfSeconds(tf), horizon);
}
