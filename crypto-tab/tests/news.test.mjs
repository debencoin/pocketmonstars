import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, tagTokens } from '../public/shared/sentiment.mjs';
import { STRATEGIES, newState, paperExec, normalizeParams, defaultsFor } from '../public/shared/strategies.mjs';

const bases = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ZEC', 'ZRO', 'NEAR', 'THE', 'ONE']);

test('tags tokens by name, $ticker and ticker, ignores look-alike words', () => {
  assert.deepEqual(tagTokens('Zcash (ZEC) jumps as Gemini adds shielded deposits', bases).sort(), ['ZEC']);
  assert.deepEqual(tagTokens('Bitcoin and Ethereum slide; $SOL holds', bases).sort(), ['BTC', 'ETH', 'SOL']);
  assert.ok(!tagTokens('THE SEC says ONE thing about the ETF', bases).length);
  assert.ok(!tagTokens('USDT supply grows', new Set(['USDT'])).length, 'stablecoins are not trade targets');
});

test('scores the headlines that move markets', () => {
  const list = analyze('Binance Will List Zcash (ZEC)');
  assert.equal(list.label, 'bullish'); assert.equal(list.category, 'listing'); assert.ok(list.importance >= 0.5);
  const hack = analyze('Major DeFi protocol hacked, $40M drained');
  assert.equal(hack.label, 'bearish'); assert.equal(hack.category, 'hack'); assert.ok(hack.importance >= 0.4);
  assert.equal(analyze('SEC sues exchange over unregistered securities').label, 'bearish');
  assert.equal(analyze('Bitcoin is struggling around $60,000').label, 'bearish');
  assert.equal(analyze('Ethereum Foundation publishes quarterly report').label, 'neutral');
});

function newsBot(over = {}) {
  const bot = { type: 'newsbot', params: normalizeParams('newsbot', { ...defaultsFor('newsbot'), investment: 1000, ...over }) };
  const st = newState(bot); const exec = paperExec(st, 0.001, () => 0);
  STRATEGIES.newsbot.init(bot, 100, st);
  return { bot, st, tick: (price, news, now = 1e6) => STRATEGIES.newsbot.tick(bot, { price, news, now }, exec, st) };
}
const sig = (o) => ({ id: 'a1:ZEC', token: 'ZEC', label: 'bullish', score: 0.7, ageMin: 3, pricedIn: false, movedSincePct: 0.2, tpPct: 2, slPct: 1, title: 'Binance will list ZEC', source: 'Binance', published: 1e6 - 3 * 60e3, ...o });

test('news bot buys fresh strong bullish news and takes profit at the news target', async () => {
  const { st, tick } = newsBot();
  const r = await tick(100, [sig()]);
  assert.equal(st.trades[0].side, 'buy'); assert.ok(r.notify);
  await tick(101, [sig()]); assert.equal(st.custom.pos != null, true);
  await tick(102.2, [sig()]);
  assert.equal(st.custom.pos, null); assert.equal(st.trades[0].tag, 'news target hit'); assert.ok(st.trades[0].pnl > 0);
  await tick(102, [sig()]); assert.equal(st.custom.pos, null, 'the same news is never traded twice');
});

test('news bot skips weak, old or already priced-in news', async () => {
  for (const s of [sig({ score: 0.3 }), sig({ ageMin: 90 }), sig({ pricedIn: true }), sig({ movedSincePct: 3 }), sig({ label: 'bearish' })]) {
    const { st, tick } = newsBot(); await tick(100, [s]); assert.equal(st.tradeCount, 0, JSON.stringify(s));
  }
});

test('news bot exits on bearish news and on its stop', async () => {
  const a = newsBot(); await a.tick(100, [sig()]);
  await a.tick(100.3, [sig(), sig({ id: 'b2:ZEC', label: 'bearish', score: 0.8, published: 2e6 })], 2e6);
  assert.equal(a.st.trades[0].tag, 'bearish news');
  const b = newsBot(); await b.tick(100, [sig()]); await b.tick(98.9, [sig()]);
  assert.equal(b.st.trades[0].tag, 'news stop hit');
});

test('pump rider news guard: bearish news stops buying, bullish news holds lots', async () => {
  const bot = { type: 'pumpgrid', params: normalizeParams('pumpgrid', { ...defaultsFor('pumpgrid'), investment: 1000, autoStep: false, stepPct: 0.5 }) };
  const st = newState(bot); const exec = paperExec(st, 0.001, () => 0);
  STRATEGIES.pumpgrid.init(bot, 100, st);
  const flat = Array.from({ length: 80 }, (_, i) => ({ time: i * 60, open: 100, high: 100.05, low: 99.95, close: 100 + (i % 2 ? 0.01 : -0.01), volume: 1 }));
  const tick = (price, news) => STRATEGIES.pumpgrid.tick(bot, { price, candles: flat, news, now: 5e6 }, exec, st);
  await tick(100, []);
  await tick(100, [sig({ label: 'bullish', score: 0.7 })]);
  assert.ok(st.custom.holdUntil > 5e6);
  const before = st.custom.lots.length;
  await tick(100.6, []); // a normal up-step would sell a lot, but bullish news says hold
  assert.equal(st.custom.lots.length, before);
  const r = await tick(100.2, [sig({ id: 'x:ZEC', label: 'bearish', score: 0.8, title: 'ZEC delisted' })]);
  assert.equal(st.custom.mode, 'wait'); assert.match(r.notify.title, /News guard/);
});
