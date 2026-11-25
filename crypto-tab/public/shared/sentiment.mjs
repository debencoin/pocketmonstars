// News analysis without an API key: which tokens an article is about, how bullish or
// bearish it is, how important it is, and what kind of news it is. The server adds Claude's
// reading on top when ANTHROPIC_API_KEY is set.

// Names people write instead of tickers.
export const NAMES = {
  bitcoin: 'BTC', btc: 'BTC', ethereum: 'ETH', ether: 'ETH', solana: 'SOL', ripple: 'XRP', xrp: 'XRP',
  zcash: 'ZEC', 'z cash': 'ZEC', zec: 'ZEC', zashi: 'ZEC', 'electric coin': 'ZEC', 'zcash foundation': 'ZEC',
  cardano: 'ADA', dogecoin: 'DOGE', 'shiba inu': 'SHIB', polkadot: 'DOT', avalanche: 'AVAX', chainlink: 'LINK',
  litecoin: 'LTC', 'bitcoin cash': 'BCH', monero: 'XMR', tron: 'TRX', toncoin: 'TON', polygon: 'POL',
  stellar: 'XLM', cosmos: 'ATOM', near: 'NEAR', aptos: 'APT', arbitrum: 'ARB', optimism: 'OP', sui: 'SUI',
  hyperliquid: 'HYPE', bnb: 'BNB', 'binance coin': 'BNB', pepe: 'PEPE', uniswap: 'UNI', aave: 'AAVE',
  'internet computer': 'ICP', filecoin: 'FIL', kaspa: 'KAS', render: 'RENDER', injective: 'INJ', celestia: 'TIA',
  ethena: 'ENA', ondo: 'ONDO', bittensor: 'TAO', 'world liberty': 'WLFI', worldcoin: 'WLD', dash: 'DASH',
  'ethereum classic': 'ETC', hedera: 'HBAR', algorand: 'ALGO', vechain: 'VET', sei: 'SEI', jupiter: 'JUP', bonk: 'BONK',
};

// Upper-case words that look like tickers but usually are not.
const STOP = new Set('SEC ETF ETFS CEO CTO CFO USA USD EUR GBP JPY CNY AI NFT NFTS DEX CEX API THE FOR AND NEW ALL ONE YOU ARE NOT BUT HAS HIS HER OUT WHO WHY HOW NOW TOP BIG IPO GDP CPI PPI FED FOMC IMF DOJ CFTC FBI IRS OTC ATH ATL TVL APY APR KYC AML DAO DEFI CBDC FUD FOMO HODL LLC INC LTD NYSE NASDAQ BTCUSD UTC GMT EST PST Q1 Q2 Q3 Q4 H1 H2 YOY MOM US UK EU UAE ID OK TV PR AMA RWA L1 L2 ZK POW POS EVM SDK OS IT VS GET SET RUN WIN BUY SELL HOLD LONG SHORT PUMP DUMP'.split(' '));
const STABLES = new Set(['USDT', 'USDC', 'DAI', 'FDUSD', 'TUSD', 'USDE', 'PYUSD', 'USD1', 'BUSD', 'USDD', 'RLUSD']);

export function tagTokens(text, bases) {
  const found = new Set();
  const low = ` ${text.toLowerCase()} `;
  for (const [name, t] of Object.entries(NAMES)) {
    if (low.includes(` ${name} `) || low.includes(` ${name}'`) || low.includes(` ${name},`) || low.includes(` ${name}.`) || low.includes(`(${name})`) || low.includes(` ${name}:`)) found.add(t);
  }
  for (const m of text.matchAll(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/g)) { const t = m[1].toUpperCase(); if (!bases || bases.has(t)) found.add(t); }
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]{2,9})\b/g)) { const t = m[1]; if (!STOP.has(t) && bases && bases.has(t)) found.add(t); }
  for (const s of STABLES) found.delete(s);
  return [...found].slice(0, 8);
}

// Weighted phrases. Multi-word phrases are checked first.
const BULL = [
  ['all-time high', 2], ['record high', 2], ['etf approval', 3], ['etf approved', 3], ['approves etf', 3], ['spot etf', 1], ['will list', 3], ['lists ', 2], ['listing', 2], ['listed on', 2],
  ['partnership', 1.5], ['partners with', 1.5], ['integrates', 1.2], ['integration', 1], ['adoption', 1.2], ['inflows', 1.5], ['inflow', 1.2], ['upgrade', 1], ['mainnet', 1.2], ['launches', 1], ['launch', 0.8],
  ['buyback', 1.5], ['burn', 0.8], ['accumulat', 1.2], ['whales buy', 1.5], ['whale buys', 1.5], ['surge', 2], ['soar', 2], ['rally', 1.8], ['rallies', 1.8], ['jumps', 1.6], ['jump', 1.2], ['gains', 1.2],
  ['climbs', 1.2], ['rises', 1], ['breakout', 1.6], ['breaks out', 1.6], ['bullish', 1.6], ['rebound', 1.2], ['recover', 1], ['outperform', 1.2], ['institutional', 0.8], ['treasury', 0.8], ['raises $', 1], ['funding round', 1],
  ['adds ', 0.8], ['support for', 0.8], ['strong', 0.8], ['buys ', 1.2], ['bought', 1], ['expands', 0.8], ['milestone', 1], ['all-time', 1.2], ['green', 0.4], ['reclaim', 1.2], ['bounce', 1.2],
  ['approval', 1.2], ['approved', 1.2], ['wins', 1], ['victory', 1.2], ['dismiss', 1.2], ['settlement', 0.8], ['green light', 1.5], ['skyrocket', 2.2], ['moon', 1], ['parabolic', 1.6], ['higher', 0.5], ['up ', 0.3], ['privacy demand', 1.2], ['shielded', 0.8],
];
const BEAR = [
  ['sec sues', 3], ['sues', 2], ['lawsuit', 2], ['charged', 1.8], ['charges', 1.2], ['probe', 1.5], ['investigation', 1.5], ['hack', 3], ['hacked', 3], ['exploit', 3], ['breach', 2.5], ['stolen', 2.5], ['drained', 2.5],
  ['delist', 3], ['delisting', 3], ['ban ', 2], ['bans', 2], ['banned', 2], ['crackdown', 2], ['outflows', 1.5], ['outflow', 1.2], ['liquidations', 1.5], ['liquidated', 1.5], ['scam', 2], ['fraud', 2.5], ['rug pull', 3],
  ['bankrupt', 3], ['insolven', 3], ['halts', 1.8], ['halted', 1.8], ['suspend', 1.8], ['warning', 1], ['warns', 1], ['fears', 1.2], ['plunge', 2.2], ['plummet', 2.2], ['crash', 2.2], ['tumble', 1.8], ['slump', 1.8],
  ['dump', 1.5], ['sell-off', 1.8], ['selloff', 1.8], ['drops', 1.3], ['drop', 1], ['falls', 1.3], ['fall', 0.8], ['decline', 1.2], ['slides', 1.2], ['bearish', 1.6], ['lowest', 1.3], ['down ', 0.3], ['loses', 1.2], ['loss', 1],
  ['struggl', 1.2], ['pressure', 0.8], ['worse', 0.8], ['weak', 1], ['sells ', 1.2], ['sold ', 0.8], ['debt', 0.6], ['unload', 1.2], ['dumps', 1.5], ['capitulat', 1.8], ['bleed', 1.5], ['red ', 0.4], ['collapse', 2.2], ['risk', 0.5],
  ['rejected', 1.5], ['rejects', 1.5], ['denied', 1.5], ['delay', 1], ['postpone', 1], ['vulnerability', 2], ['outage', 1.5], ['attack', 2], ['sanction', 2], ['regulators', 0.6], ['tax', 0.4],
];
const IMPORTANT = [
  ['binance will list', 0.6], ['coinbase will list', 0.6], ['will list', 0.45], ['listing', 0.3], ['delist', 0.5], ['etf', 0.3], ['sec', 0.25], ['hack', 0.45], ['exploit', 0.45], ['lawsuit', 0.25], ['fed ', 0.2], ['rate cut', 0.3], ['rate hike', 0.3],
  ['halving', 0.3], ['mainnet', 0.2], ['upgrade', 0.15], ['partnership', 0.15], ['treasury', 0.15], ['blackrock', 0.25], ['trump', 0.2], ['regulation', 0.2], ['ban', 0.25], ['bankrupt', 0.4], ['breaking', 0.3], ['just in', 0.3], ['record', 0.15],
];
const CATEGORY = [
  ['listing', ['will list', 'lists ', 'listing', 'listed on', 'delist']], ['hack', ['hack', 'exploit', 'breach', 'stolen', 'drained', 'vulnerability', 'attack']],
  ['regulation', ['sec ', 'lawsuit', 'sues', 'regulat', 'ban', 'court', 'cftc', 'doj', 'sanction', 'tax']], ['etf', ['etf']], ['macro', ['fed ', 'rate cut', 'rate hike', 'inflation', 'cpi', 'tariff', 'recession', 'treasury yield']],
  ['partnership', ['partner', 'integrat', 'collaborat', 'adopt']], ['upgrade', ['upgrade', 'mainnet', 'hard fork', 'release', 'launch', 'testnet', 'roadmap']], ['flows', ['inflow', 'outflow', 'whale', 'accumulat', 'treasury', 'buyback']],
  ['price', ['price', 'rally', 'surge', 'drop', 'crash', 'plunge', 'soar', 'jump', 'falls', 'rises', 'breakout', 'high', 'low']],
];

function score(text, table) { const t = ` ${text.toLowerCase()} `; let s = 0; const hits = []; for (const [w, k] of table) if (t.includes(w)) { s += k; hits.push(w.trim()); } return { s, hits }; }

// Returns sentiment -1..1, label, importance 0..1, category and the words that drove it.
export function analyze(title, summary = '') {
  const b = score(title, BULL), r = score(title, BEAR);
  const b2 = score(summary, BULL), r2 = score(summary, BEAR);
  const bull = b.s * 2 + b2.s * 0.6, bear = r.s * 2 + r2.s * 0.6;
  const raw = (bull - bear) / (bull + bear + 2.5);
  const sentiment = Math.max(-1, Math.min(1, +raw.toFixed(3)));
  const label = sentiment >= 0.15 ? 'bullish' : sentiment <= -0.15 ? 'bearish' : 'neutral';
  const imp = score(`${title} ${summary}`, IMPORTANT).s + Math.min(0.3, Math.abs(sentiment) * 0.3);
  const low = ` ${`${title} ${summary}`.toLowerCase()} `;
  const category = (CATEGORY.find(([, ws]) => ws.some((w) => low.includes(w))) || ['other'])[0];
  return { sentiment, label, importance: +Math.min(1, imp).toFixed(2), category, words: [...new Set([...b.hits, ...r.hits])].slice(0, 6) };
}

export const stripHtml = (s = '') => String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘').replace(/&#8220;|&#8221;/g, '"').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
