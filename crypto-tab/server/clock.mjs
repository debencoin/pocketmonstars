// "Pump clock": when do pumps and dumps actually happen, by hour of day and weekday, in the
// user's time zone, over up to 2 years of hourly candles, with an out-of-sample check
// (an hour only counts as an edge if it holds on data the pattern was not found on).
import { history } from './history.mjs';
import { hourIn, weekdayIn, sessions, label, fmtTime } from '../public/shared/tz.mjs';
import { newsHistory } from './newshistory.mjs';
import * as News from './news.mjs';

const BASKET = ['BTC', 'ETH', 'SOL', 'XRP', 'ZEC', 'BNB', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'SUI'];
const cache = new Map();
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
const pearson = (x, y) => { const mx = mean(x), my = mean(y); let n = 0, a = 0, b = 0; for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return a && b ? n / Math.sqrt(a * b) : 0; };

function buckets() { return { h: Array.from({ length: 24 }, () => ({ r: [], pumps: 0, dumps: 0 })), wh: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ r: [], pumps: 0, dumps: 0 }))) }; }

// hourly returns of one token; a pump/dump hour = a move of at least 2 standard deviations
function tokenHours(candles) {
  const rows = [];
  for (let i = 1; i < candles.length; i++) {
    const k = candles[i], p = candles[i - 1];
    if (k.time - p.time !== 3600) continue;
    rows.push({ t: k.time * 1000 - 3600e3, r: ((k.close - p.close) / p.close) * 100 }); // the hour in which the move happened (its open time)
  }
  // rolling 30-day volatility so a calm year and a wild year are judged fairly
  const win = 720;
  for (let i = 0; i < rows.length; i++) {
    const a = rows.slice(Math.max(0, i - win), i).map((x) => x.r);
    rows[i].z = a.length > 100 ? rows[i].r / (sd(a) || 1) : 0;
  }
  return rows;
}

function fill(rows, tz, from, to) {
  const B = buckets();
  for (const x of rows) {
    if (x.t < from || x.t >= to) continue;
    const h = hourIn(x.t, tz), w = weekdayIn(x.t, tz);
    for (const b of [B.h[h], B.wh[w][h]]) { b.r.push(x.r); if (x.z >= 2) b.pumps++; if (x.z <= -2) b.dumps++; }
  }
  return B;
}

const summary = (b) => {
  const n = b.r.length, m = mean(b.r), s = sd(b.r);
  return { n, avg: +m.toFixed(4), up: n ? +((b.r.filter((v) => v > 0).length / n) * 100).toFixed(1) : 0, absMove: +mean(b.r.map(Math.abs)).toFixed(3), pumps: b.pumps, dumps: b.dumps, pumpRate: n ? +((b.pumps / n) * 100).toFixed(2) : 0, dumpRate: n ? +((b.dumps / n) * 100).toFixed(2) : 0, t: n > 1 && s ? +((m / (s / Math.sqrt(n))).toFixed(2)) : 0 };
};

// Market-wide moves: hours when most of the basket jumped / dropped together.
function marketHours(perToken) {
  const byT = new Map();
  for (const rows of Object.values(perToken)) for (const x of rows) { const e = byT.get(x.t) || []; e.push(x); byT.set(x.t, e); }
  const out = [];
  for (const [t, xs] of byT) {
    if (xs.length < Math.max(4, Object.keys(perToken).length * 0.6)) continue;
    const up = xs.filter((x) => x.z >= 1.5).length / xs.length, dn = xs.filter((x) => x.z <= -1.5).length / xs.length;
    const r = mean(xs.map((x) => x.r));
    out.push({ t, r, z: up >= 0.5 ? 2.5 : dn >= 0.5 ? -2.5 : 0 });
  }
  return out.sort((a, b) => a.t - b.t);
}

// What the news said around the biggest moves, over the whole period.
async function newsLayer(token, rows, tz, months) {
  let hist = [];
  try { hist = await newsHistory(token === 'MARKET' ? 'MARKET' : token, months); } catch { /* offline */ }
  const live = token === 'MARKET' ? News.list({ limit: 200 }) : News.list({ token, limit: 200 });
  const arts = [...hist, ...live.map((a) => ({ t: a.published, title: a.title, source: a.source, url: a.url, label: a.label, sentiment: a.sentiment, category: a.category, importance: a.importance, dayOnly: false }))];
  const dayKey = (ms) => fmtTime(ms, tz, { year: 'numeric', month: '2-digit', day: '2-digit' });
  // daily moves (in the user's zone) from the hourly rows
  const days = new Map();
  for (const x of rows) { const k = dayKey(x.t); const d = days.get(k) || { k, t: x.t, r: 0 }; d.r = (1 + d.r / 100) * (1 + x.r / 100) * 100 - 100; days.set(k, d); }
  const dl = [...days.values()].sort((a, b) => a.t - b.t);
  const sdd = sd(dl.map((d) => d.r)) || 1;
  const byDay = new Map();
  for (const a of arts) { const k = dayKey(a.t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(a); }
  const prevKey = (i) => (i > 0 ? dl[i - 1].k : null);
  const withNews = (i) => (byDay.get(dl[i].k)?.length || 0) + (byDay.get(prevKey(i))?.length || 0) > 0;
  const big = dl.map((d, i) => ({ ...d, i, z: d.r / sdd })).filter((d) => Math.abs(d.z) >= 2);
  const normal = dl.map((d, i) => ({ ...d, i })).filter((d) => Math.abs(d.r / sdd) < 1);
  const share = (list) => (list.length ? +((list.filter((d) => withNews(d.i)).length / list.length) * 100).toFixed(0) : 0);
  // average move on the day of / the day after bullish vs bearish headlines
  const react = (label) => {
    const same = [], next = [];
    for (let i = 0; i < dl.length; i++) {
      const n = (byDay.get(dl[i].k) || []).filter((a) => a.label === label);
      if (!n.length) continue;
      same.push(dl[i].r); if (dl[i + 1]) next.push(dl[i + 1].r);
    }
    return { days: same.length, sameDay: +mean(same).toFixed(2), nextDay: +mean(next).toFixed(2), sameDayUp: same.length ? +((same.filter((v) => v > 0).length / same.length) * 100).toFixed(0) : 0 };
  };
  const story = (d) => ({ day: d.k, t: d.t, move: +d.r.toFixed(2), headlines: [...(byDay.get(prevKey(d.i)) || []).map((a) => ({ ...a, when: 'day before' })), ...(byDay.get(d.k) || []).map((a) => ({ ...a, when: 'same day' }))].sort((a, b) => b.importance - a.importance).slice(0, 4) });
  const byHour = new Array(24).fill(0);
  for (const a of arts) if (!a.dayOnly) byHour[hourIn(a.t, tz)]++;
  return {
    articles: arts.length, exactTime: arts.filter((a) => !a.dayOnly).length, from: arts[0]?.t, to: arts[arts.length - 1]?.t,
    bigMoveDaysWithNews: share(big), normalDaysWithNews: share(normal), bigDays: big.length,
    bullish: react('bullish'), bearish: react('bearish'),
    topPumpDays: big.filter((d) => d.r > 0).sort((a, b) => b.r - a.r).slice(0, 8).map(story),
    topDumpDays: big.filter((d) => d.r < 0).sort((a, b) => a.r - b.r).slice(0, 8).map(story),
    byHour,
  };
}

export async function pumpClock({ token = 'ZEC', months = 24, tz = 'America/Phoenix' } = {}) {
  months = Math.max(3, Math.min(36, Number(months) || 24));
  const key = `${token}|${months}|${tz}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3 * 3600e3) return hit;
  let rows, source;
  if (token === 'MARKET') {
    const per = {};
    for (const b of BASKET) { try { const h = await history(b, { months }); if (h.candles.length > 1000) per[b] = tokenHours(h.candles); } catch { /* skip token */ } }
    rows = marketHours(per); source = `Binance archive · ${Object.keys(per).length} coins (${Object.keys(per).join(', ')})`;
  } else {
    const h = await history(token, { months });
    rows = tokenHours(h.candles); source = h.source;
  }
  if (rows.length < 500) throw new Error(`Not enough hourly history for ${token}`);
  const first = rows[0].t, last = rows[rows.length - 1].t;
  const cut = first + (last - first) * 0.7; // first 70 % finds the pattern, last 30 % checks it
  const all = fill(rows, tz, 0, Infinity), train = fill(rows, tz, 0, cut), test = fill(rows, tz, cut, Infinity);
  const hours = all.h.map((b, h) => {
    const s = summary(b), tr = summary(train.h[h]), te = summary(test.h[h]);
    const sameSign = Math.sign(tr.avg) === Math.sign(te.avg) && tr.avg !== 0;
    return { hour: h, ...s, train: { avg: tr.avg, pumpRate: tr.pumpRate, t: tr.t }, test: { avg: te.avg, pumpRate: te.pumpRate, t: te.t }, holds: sameSign && Math.abs(tr.t) >= 2 && Math.abs(te.t) >= 1 };
  });
  const grid = all.wh.map((row) => row.map((b) => { const s = summary(b); return { n: s.n, avg: s.avg, pumpRate: s.pumpRate, dumpRate: s.dumpRate, absMove: s.absMove }; }));
  const days = all.wh.map((row, w) => { const r = row.flatMap((b) => b.r); return { day: w, avg: +mean(r).toFixed(4), absMove: +mean(r.map(Math.abs)).toFixed(3), pumps: row.reduce((s, b) => s + b.pumps, 0), dumps: row.reduce((s, b) => s + b.dumps, 0) }; });
  // does the shape of the day repeat? correlation of the 24 hourly values, first part vs last part
  const consistency = {
    avg: +pearson(train.h.map((b) => mean(b.r)), test.h.map((b) => mean(b.r))).toFixed(2),
    pumps: +pearson(train.h.map((b) => b.pumps / (b.r.length || 1)), test.h.map((b) => b.pumps / (b.r.length || 1))).toFixed(2),
    volatility: +pearson(train.h.map((b) => mean(b.r.map(Math.abs))), test.h.map((b) => mean(b.r.map(Math.abs)))).toFixed(2),
  };
  const byPump = [...hours].sort((a, b) => b.pumpRate - a.pumpRate), byDump = [...hours].sort((a, b) => b.dumpRate - a.dumpRate), byVol = [...hours].sort((a, b) => b.absMove - a.absMove);
  const news = await newsLayer(token, rows, tz, months).catch(() => null);
  const res = {
    news,
    at: Date.now(), token, tz, tzLabel: label(tz), months, source, hoursAnalyzed: rows.length,
    from: first, to: last, testFrom: cut,
    hours, grid, days, sessions: sessions(tz), consistency,
    top: { pumpHours: byPump.slice(0, 3).map((h) => h.hour), dumpHours: byDump.slice(0, 3).map((h) => h.hour), busiestHours: byVol.slice(0, 3).map((h) => h.hour), quietHours: byVol.slice(-3).map((h) => h.hour), edges: hours.filter((h) => h.holds).map((h) => ({ hour: h.hour, avg: h.avg, t: h.t })) },
  };
  cache.set(key, res);
  return res;
}
