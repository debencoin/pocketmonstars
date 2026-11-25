// Herd / correlation agent.
//
// Big players (funds, market makers, ETF flows, liquidation cascades) move baskets of tokens at
// the same time. We cannot see who is trading, but we can see the footprint:
//   1. Correlation clusters: which tokens move as a group (7 days of 15-minute returns).
//   2. Synchronized moves ("herd events"): moments when many tokens jump or drop together,
//      who moved first (leaders), and what happened 1 h / 4 h later.
//   3. Live detection every minute: when a cluster starts pumping or dumping, which members
//      have not moved yet (laggards that usually follow).
//   4. Learning: every live prediction is graded 30 and 60 minutes later; the hit rates per
//      cluster, direction and leader, and the breadth needed to fire, keep adapting.
import { EventEmitter } from 'node:events';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';

export const herdEvents = new EventEmitter();
const EX = process.env.CT_HERD_EXCHANGE || 'mexc';
const CORE = ['ZEC', 'BTC', 'ETH', 'SOL', 'XRP'];
const STABLE = new Set(['USDC', 'USDT', 'FDUSD', 'DAI', 'TUSD', 'USD1', 'USDE', 'PYUSD', 'RLUSD', 'BUSD', 'XAUT', 'PAXG']);
const N_UNIVERSE = Number(process.env.CT_HERD_UNIVERSE || 45);

const db = load('herd', {
  analysis: null,
  events: [],          // historical + live herd events
  predictions: [],     // live predictions waiting to be graded / graded
  model: {
    breadthThr: 0.3,   // share of a cluster that must move together to fire (learned)
    zThr: 2,           // how unusual a move must be per token (std devs)
    follow: {},        // `${cluster}|${dir}` -> { a, b } beta counts of laggards following
    leaders: {},       // token -> { a, b } did the cluster follow when this token moved first
    graded: 0, hits: 0, history: [], // overall track record
  },
});
const persist = () => save('herd', db);
let botTokens = new Set();
export const setBotTokens = (l) => { botTokens = new Set(l); };

// ---------------- maths ----------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
function pearson(x, y) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = y[i];
    if (a == null || b == null) continue;
    n++; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b;
  }
  if (n < 30) return null;
  const v = (n * sxx - sx * sx) * (n * syy - sy * sy);
  return v > 0 ? (n * sxy - sx * sy) / Math.sqrt(v) : null;
}
const decay = (c, k = 0.995) => { c.a = 1 + (c.a - 1) * k; c.b = 1 + (c.b - 1) * k; };
const rate = (c) => (c ? c.a / (c.a + c.b) : 0.5);

// average-linkage clustering on correlation distance
function clusterize(tokens, C, thr) {
  let groups = tokens.map((t) => [t]);
  const link = (g1, g2) => { let s = 0, n = 0; for (const a of g1) for (const b of g2) { const v = C[a]?.[b]; if (v != null) { s += v; n++; } } return n ? s / n : -1; };
  for (;;) {
    let best = null;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) { const l = link(groups[i], groups[j]); if (l >= thr && (!best || l > best.l)) best = { i, j, l }; }
    if (!best) break;
    groups[best.i] = [...groups[best.i], ...groups[best.j]];
    groups.splice(best.j, 1);
  }
  return groups.filter((g) => g.length >= 2).map((g) => ({ tokens: g, avgCorr: +link(g, g).toFixed(3) })).sort((a, b) => b.tokens.length - a.tokens.length);
}

// ---------------- weekly analysis ----------------
async function universe() {
  const m = await X.markets(EX);
  const rows = m.markets.filter((r) => r.q === 'USDT' && !STABLE.has(r.b) && !r.st && /^[A-Z0-9]{2,12}$/.test(r.b) && !/^(GOLD|SILVER|XAU|PAXG)/.test(r.b));
  const set = new Set(rows.slice(0, N_UNIVERSE).map((r) => r.b));
  for (const t of [...CORE, ...botTokens]) if (rows.find((r) => r.b === t)) set.add(t);
  const vol = Object.fromEntries(rows.map((r) => [r.b, r.v || 0]));
  return { tokens: [...set], vol };
}

// 7.5 days of 15-minute candles, paged (some exchanges return at most 500 per call)
async function weekOf(sym) {
  const since = Math.floor((Date.now() - 7.5 * 864e5) / 900e3) * 900e3;
  let out = await X.ohlcv(EX, sym, '15m', 1000, since);
  for (let i = 0; i < 2 && out.length && out[out.length - 1].time * 1000 < Date.now() - 30 * 60e3; i++) {
    const more = await X.ohlcv(EX, sym, '15m', 1000, (out[out.length - 1].time + 900) * 1000);
    if (!more.length) break;
    out = [...out, ...more.filter((k) => k.time > out[out.length - 1].time)];
  }
  return out;
}

export async function analyze() {
  const { tokens, vol } = await universe();
  const candles = {};
  for (let i = 0; i < tokens.length; i += 6) {
    await Promise.allSettled(tokens.slice(i, i + 6).map(async (t) => { const c = await weekOf(`${t}/USDT`); if (c.length > 200) candles[t] = c; }));
  }
  const toks = Object.keys(candles);
  const ref = candles.BTC || candles[toks[0]];
  const times = ref.map((k) => k.time);
  const idx = Object.fromEntries(times.map((t, i) => [t, i]));
  // aligned close prices and 15m log returns
  const R = {}, P = {};
  for (const t of toks) {
    const px = new Array(times.length).fill(null);
    for (const k of candles[t]) if (idx[k.time] != null) px[idx[k.time]] = k.close;
    P[t] = px;
    R[t] = px.map((v, i) => (i && v && px[i - 1] ? Math.log(v / px[i - 1]) : null));
  }
  // correlation matrix
  const C = {};
  for (const a of toks) { C[a] = {}; for (const b of toks) C[a][b] = a === b ? 1 : (C[b]?.[a] ?? pearson(R[a], R[b])); }
  const clusters = clusterize(toks, C, 0.6).map((c, i) => {
    const lead = [...c.tokens].sort((x, y) => (vol[y] || 0) - (vol[x] || 0))[0];
    return { id: `c${i + 1}`, name: `${lead} group`, leader: lead, ...c };
  });
  // volatility per token (std of 15m returns) and beta to BTC
  const sd = {}, beta = {};
  for (const t of toks) {
    const r = R[t].filter((v) => v != null); const m = mean(r);
    sd[t] = Math.sqrt(mean(r.map((v) => (v - m) ** 2))) || 1e-4;
    if (R.BTC) { const cv = pearson(R[t], R.BTC); beta[t] = cv != null && sd.BTC ? +(cv * sd[t] / sd.BTC).toFixed(2) : null; }
  }
  // Hidden groups: remove Bitcoin's influence from every token, then see what still moves together.
  // Tokens that co-move beyond the market are the ones a single big player or theme is pushing.
  const E = {}, C2 = {};
  for (const t of toks) E[t] = R[t].map((v, i) => (v == null || R.BTC?.[i] == null || beta[t] == null ? null : v - beta[t] * R.BTC[i]));
  const nonBtc = toks.filter((t) => t !== 'BTC');
  for (const a2 of nonBtc) { C2[a2] = {}; for (const b2 of nonBtc) C2[a2][b2] = a2 === b2 ? 1 : (C2[b2]?.[a2] ?? pearson(E[a2], E[b2])); }
  const subgroups = clusterize(nonBtc, C2, 0.35).map((c, i) => {
    const lead = [...c.tokens].sort((x, y) => (vol[y] || 0) - (vol[x] || 0))[0];
    return { id: `g${i + 1}`, name: `${lead} pack`, leader: lead, hidden: true, ...c };
  });
  const clusterOf = {};
  for (const c of clusters) for (const t of c.tokens) clusterOf[t] = c.id;
  for (const g of subgroups) for (const t of g.tokens) clusterOf[t] = g.id; // the tighter group wins
  const allGroups = [...subgroups, ...clusters];
  // leaders: does this token's move predict its cluster's next 15 minutes?
  const leaderScore = {};
  for (const c of allGroups) {
    const avg = times.map((_, i) => { const v = c.tokens.map((t) => R[t][i]).filter((x) => x != null); return v.length ? mean(v) : null; });
    for (const t of c.tokens) leaderScore[`${c.id}:${t}`] = +(pearson(R[t].slice(0, -1), avg.slice(1)) ?? 0).toFixed(3);
  }
  // herd events: many tokens moving unusually in the same direction within 30 minutes
  const zThr = db.model.zThr;
  const evs = [];
  let lastUp = -99, lastDown = -99;
  for (let i = 2; i < times.length; i++) {
    const up = [], down = [];
    for (const t of toks) {
      const a = R[t][i], b = R[t][i - 1];
      if (a == null || b == null) continue;
      const z = (a + b) / (sd[t] * Math.SQRT2);
      if (z >= zThr) up.push({ t, z, pct: (Math.exp(a + b) - 1) * 100, early: b / sd[t] >= 1 });
      else if (z <= -zThr) down.push({ t, z, pct: (Math.exp(a + b) - 1) * 100, early: b / sd[t] <= -1 });
    }
    for (const [dir, list] of [['pump', up], ['dump', down]]) {
      const breadth = list.length / toks.length;
      if (breadth < 0.25 || list.length < 4) continue;
      if (dir === 'pump' ? i - lastUp < 4 : i - lastDown < 4) continue;
      if (dir === 'pump') lastUp = i; else lastDown = i;
      list.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      const fwd = (h) => { const v = list.map(({ t }) => (P[t][i + h] && P[t][i] ? ((P[t][i + h] - P[t][i]) / P[t][i]) * 100 : null)).filter((x) => x != null); return v.length ? +mean(v).toFixed(3) : null; };
      const movers = new Set(list.map((x) => x.t));
      // laggards: members of the movers' clusters that had not moved yet; did they follow in the next hour?
      const lagCl = new Set(list.map((x) => clusterOf[x.t]).filter(Boolean));
      const lag = toks.filter((t) => !movers.has(t) && lagCl.has(clusterOf[t]));
      const lagNext = lag.map((t) => (P[t][i + 4] && P[t][i] ? ((P[t][i + 4] - P[t][i]) / P[t][i]) * 100 : null)).filter((x) => x != null);
      evs.push({
        id: `h${times[i]}-${dir}`, time: times[i] * 1000, dir, breadth: +breadth.toFixed(3), count: list.length,
        tokens: list.slice(0, 20).map((x) => ({ t: x.t, pct: +x.pct.toFixed(2) })), leaders: list.filter((x) => x.early).slice(0, 6).map((x) => x.t),
        avgMove: +mean(list.map((x) => x.pct)).toFixed(2), after1h: fwd(4), after4h: fwd(16),
        laggardsFollow: lagNext.length ? +((lagNext.filter((v) => (dir === 'pump' ? v > 0 : v < 0)).length / lagNext.length) * 100).toFixed(0) : null,
        clusters: [...lagCl], source: 'history',
      });
    }
  }
  // seed learning from history once per event (so the agent starts with a week of experience)
  const known = new Set(db.events.map((e) => e.id));
  for (const e of evs) {
    if (known.has(e.id)) continue;
    db.events.push(e);
    if (e.laggardsFollow != null) for (const c of e.clusters) {
      const k = `${c}|${e.dir}`; const f = (db.model.follow[k] ||= { a: 1, b: 1 });
      const n = Math.max(1, Math.round(e.count / 4)); const hit = e.laggardsFollow / 100;
      f.a += hit * n * 0.5; f.b += (1 - hit) * n * 0.5;
    }
    for (const L of e.leaders) { const s = (db.model.leaders[L] ||= { a: 1, b: 1 }); if (e.after1h != null) { if (Math.sign(e.after1h) === (e.dir === 'pump' ? 1 : -1)) s.a += 0.5; else s.b += 0.5; } }
  }
  db.events.sort((a, b) => b.time - a.time);
  db.events = db.events.filter((e) => Date.now() - e.time < 14 * 864e5).slice(0, 400);
  // a compact matrix for the heat map: the 16 most traded tokens + core
  const top = [...new Set([...CORE.filter((t) => toks.includes(t)), ...toks.sort((a, b) => (vol[b] || 0) - (vol[a] || 0))])].slice(0, 16);
  db.analysis = {
    at: Date.now(), exchange: EX, tokens: toks, days: +((times[times.length - 1] - times[0]) / 86400).toFixed(1), clusters: allGroups, clusterOf, sd, beta, leaderScore,
    heat: { tokens: top, m: top.map((a) => top.map((b) => (C[a][b] == null ? null : +C[a][b].toFixed(2)))) },
    pairs: toks.flatMap((a) => toks.filter((b) => a < b && C[a][b] != null).map((b) => ({ a, b, c: +C[a][b].toFixed(3) }))).sort((x, y) => y.c - x.c).slice(0, 40),
  };
  persist();
  return db.analysis;
}

// ---------------- live detection ----------------
const hist = new Map(); // token -> [{t, p}] one per minute, last 2 hours
let live = { at: 0, clusters: [], signals: [] };

async function sample() {
  const a = db.analysis; if (!a) return;
  const m = await X.markets(EX);
  const now = Date.now();
  for (const r of m.markets) {
    if (r.q !== 'USDT' || !a.tokens.includes(r.b)) continue;
    const h = hist.get(r.b) || []; h.push({ t: now, p: r.p }); while (h.length && now - h[0].t > 125 * 60e3) h.shift(); hist.set(r.b, h);
  }
}

const moveSince = (t, mins) => { const h = hist.get(t); if (!h || h.length < 2) return null; const now = h[h.length - 1]; const old = h.find((x) => now.t - x.t <= mins * 60e3 + 30e3); return old && old !== now ? ((now.p - old.p) / old.p) * 100 : null; };

async function detect() {
  const a = db.analysis; if (!a) return;
  const M = db.model; const now = Date.now();
  const status = [];
  for (const c of a.clusters) {
    const moves = c.tokens.map((t) => { const m = moveSince(t, 15); const sdPct = (a.sd[t] || 0.005) * 100; return m == null ? null : { t, m: +m.toFixed(3), z: m / sdPct }; }).filter(Boolean);
    if (moves.length < Math.max(3, c.tokens.length * 0.5)) continue;
    const up = moves.filter((x) => x.z >= M.zThr * 0.75), down = moves.filter((x) => x.z <= -M.zThr * 0.75);
    const bu = up.length / moves.length, bd = down.length / moves.length;
    const dir = bu >= M.breadthThr && up.length >= 3 ? 'pump' : bd >= M.breadthThr && down.length >= 3 ? 'dump' : null;
    status.push({ cluster: c.id, name: c.name, tokens: c.tokens.length, breadthUp: +bu.toFixed(2), breadthDown: +bd.toFixed(2), avg15: +mean(moves.map((x) => x.m)).toFixed(3), state: dir || 'calm' });
    if (!dir) continue;
    const movers = (dir === 'pump' ? up : down).sort((x, y) => Math.abs(y.z) - Math.abs(x.z));
    const moved = new Set(movers.map((x) => x.t));
    const laggards = moves.filter((x) => !moved.has(x.t) && (dir === 'pump' ? x.z < 0.5 : x.z > -0.5)).map((x) => x.t);
    const key = `${c.id}|${dir}`;
    const recent = db.predictions.find((p) => p.key === key && now - p.time < 45 * 60e3);
    if (recent) continue; // one signal per cluster move
    const conf = +rate(M.follow[key]).toFixed(2);
    const leaderConf = movers.slice(0, 3).map((x) => rate(M.leaders[x.t]));
    const confidence = +Math.min(0.95, conf * 0.7 + mean(leaderConf) * 0.3).toFixed(2);
    const p = {
      id: `p${now}-${c.id}-${dir}`, key, time: now, cluster: c.id, name: c.name, dir, breadth: +(dir === 'pump' ? bu : bd).toFixed(2),
      movers: movers.slice(0, 10).map((x) => ({ t: x.t, m: x.m })), laggards: laggards.map((t) => ({ t, p0: hist.get(t)?.at(-1)?.p })),
      confidence, graded: false,
    };
    db.predictions.unshift(p);
    db.events.unshift({ id: `live-${p.id}`, time: now, dir, breadth: p.breadth, count: movers.length, tokens: p.movers.map((x) => ({ t: x.t, pct: x.m })), leaders: movers.slice(0, 3).map((x) => x.t), avgMove: +mean(movers.map((x) => x.m)).toFixed(2), clusters: [c.id], source: 'live' });
    herdEvents.emit('signal', p);
    const ours = [...CORE, ...botTokens].filter((t) => c.tokens.includes(t));
    if (ours.length) herdEvents.emit('notify', { kind: 'herd', title: `${dir === 'pump' ? '🚀' : '🩸'} ${c.name} ${dir} (${Math.round(p.breadth * 100)}% moving)`, body: `${movers.slice(0, 5).map((x) => `${x.t} ${x.m > 0 ? '+' : ''}${x.m.toFixed(2)}%`).join(', ')}. Not moved yet: ${laggards.slice(0, 5).join(', ') || 'none'}. Follow rate ${Math.round(confidence * 100)}%.`, tag: `herd-${c.id}` });
  }
  live = { at: now, clusters: status, signals: db.predictions.filter((p) => now - p.time < 60 * 60e3) };
}

// grade predictions: did the laggards follow within 60 minutes?
function grade() {
  const M = db.model; const now = Date.now();
  for (const p of db.predictions) {
    if (p.graded || now - p.time < 60 * 60e3) continue;
    const res = p.laggards.map((l) => { const h = hist.get(l.t); if (!h || !l.p0) return null; const at = h.find((x) => x.t >= p.time + 60 * 60e3) || h[h.length - 1]; const mv = ((at.p - l.p0) / l.p0) * 100; return { t: l.t, mv: +mv.toFixed(3), hit: p.dir === 'pump' ? mv > 0.15 : mv < -0.15 }; }).filter(Boolean);
    p.graded = true; p.result = res;
    if (!res.length) continue;
    const hits = res.filter((r) => r.hit).length;
    const f = (M.follow[p.key] ||= { a: 1, b: 1 }); decay(f); f.a += hits; f.b += res.length - hits;
    for (const mv of p.movers.slice(0, 3)) { const s = (M.leaders[mv.t] ||= { a: 1, b: 1 }); decay(s); if (hits / res.length >= 0.5) s.a += 1; else s.b += 1; }
    M.graded += res.length; M.hits += hits;
    M.history.unshift({ t: now, key: p.key, hits, n: res.length }); M.history = M.history.slice(0, 200);
    // adapt the breadth needed to fire: stricter when recent precision is poor, looser when good
    const last = M.history.slice(0, 20); const prec = last.reduce((s, h) => s + h.hits, 0) / Math.max(1, last.reduce((s, h) => s + h.n, 0));
    if (last.length >= 5) M.breadthThr = +Math.min(0.6, Math.max(0.2, M.breadthThr + (prec < 0.5 ? 0.02 : prec > 0.65 ? -0.02 : 0))).toFixed(2);
  }
  db.predictions = db.predictions.filter((p) => now - p.time < 3 * 864e5).slice(0, 300);
}

// ---------------- API ----------------
export function overview() {
  const a = db.analysis, M = db.model;
  return {
    analysis: a && { at: a.at, exchange: a.exchange, days: a.days, tokens: a.tokens.length, clusters: a.clusters.map((c) => ({ ...c, follow: { pump: +rate(M.follow[`${c.id}|pump`]).toFixed(2), dump: +rate(M.follow[`${c.id}|dump`]).toFixed(2) }, leaders: [...c.tokens].sort((x, y) => (a.leaderScore[`${c.id}:${y}`] || 0) - (a.leaderScore[`${c.id}:${x}`] || 0)).slice(0, 3).map((t) => ({ t, score: a.leaderScore[`${c.id}:${t}`], reliability: +rate(M.leaders[t]).toFixed(2) })) })), heat: a.heat, pairs: a.pairs.slice(0, 15), beta: a.beta },
    live,
    learning: { breadthThr: M.breadthThr, graded: M.graded, hits: M.hits, precision: M.graded ? +(M.hits / M.graded).toFixed(3) : null, learnedEvents: db.events.length, recent: M.history.slice(0, 10) },
  };
}

export function events({ days = 7, token } = {}) {
  return db.events.filter((e) => Date.now() - e.time < days * 864e5 && (!token || e.tokens.some((x) => x.t === token))).slice(0, 150);
}

// What a bot trading `token` should know right now.
export function signalsFor(token) {
  const a = db.analysis; if (!a) return [];
  const mine = new Set(a.clusters.filter((c) => c.tokens.includes(token)).map((c) => c.id));
  return live.signals.filter((p) => mine.has(p.cluster) && Date.now() - p.time < 45 * 60e3).map((p) => ({
    id: p.id, dir: p.dir, confidence: p.confidence, breadth: p.breadth, name: p.name, ageMin: +((Date.now() - p.time) / 60e3).toFixed(1),
    role: p.laggards.some((l) => l.t === token) ? 'laggard' : p.movers.some((m) => m.t === token) ? 'mover' : 'member',
    tokenMove: moveSince(token, 15), clusterMove: +mean(p.movers.map((m) => m.m)).toFixed(3),
  }));
}

export function clusterOfToken(token) { const a = db.analysis; return a ? a.clusters.find((c) => c.tokens.includes(token)) || null : null; }

let started = false;
export function start() {
  if (started) return; started = true;
  const run = () => analyze().catch((e) => console.error('herd analyze:', e.message));
  run();
  setInterval(run, 30 * 60e3);
  setInterval(() => sample().then(detect).then(grade).catch(() => {}), 60e3);
  setInterval(persist, 5 * 60e3);
}
