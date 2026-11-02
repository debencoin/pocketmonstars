// Authoritative 1v1 arena simulation. The server runs it; clients only send inputs and draw snapshots.
import { Monstar, effectiveness } from './monstars.mjs';

export const ARENA = Object.freeze({ w: 960, h: 540, radius: 34, roundSeconds: 90,
  rocks: [{ x: 480, y: 270, r: 46 }, { x: 250, y: 150, r: 30 }, { x: 710, y: 390, r: 30 }] });
export const TICK = 1 / 30;

const MOVES = {
  basic: { power: 9, cd: 0.42, cost: 0, speed: 560, r: 10, life: 1.1 },
  special: { power: 22, cd: 5, cost: 40, speed: 430, r: 24, life: 1.6, pierce: true, knock: 260 },
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function norm(x, y) { const d = Math.hypot(x, y); return d > 1e-6 ? [x / d, y / d] : [0, 0]; }

export function sanitizeInput(i = {}) {
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  let mx = clamp(num(i.mx), -1, 1), my = clamp(num(i.my), -1, 1);
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  const [ax, ay] = norm(num(i.ax), num(i.ay));
  return { mx, my, ax, ay, atk: !!i.atk, sp: !!i.sp, dash: !!i.dash, guard: !!i.guard };
}

function makeFighter(monstar, side) {
  const s = monstar.stats;
  return {
    side, speciesId: monstar.species.id, type: monstar.type, mods: monstar.cls.mods, stats: s,
    x: side === 0 ? 150 : ARENA.w - 150, y: ARENA.h / 2, vx: 0, vy: 0,
    fx: side === 0 ? 1 : -1, fy: 0, hp: s.hp, maxHp: s.hp, energy: 100,
    cd: { basic: 0, special: 1.5, dash: 0, guard: 0 }, iframes: 0, dashT: 0, dvx: 0, dvy: 0, guardT: 0,
    input: sanitizeInput(), hits: 0, actions: 0,
  };
}

export function createMatch(monstarA, monstarB) {
  return { t: 0, over: false, winner: null, reason: null,
    fighters: [makeFighter(monstarA, 0), makeFighter(monstarB, 1)], projectiles: [], nextId: 1 };
}

function collide(f) {
  const R = ARENA.radius;
  f.x = clamp(f.x, R, ARENA.w - R); f.y = clamp(f.y, R, ARENA.h - R);
  for (const r of ARENA.rocks) {
    const dx = f.x - r.x, dy = f.y - r.y, d = Math.hypot(dx, dy), min = r.r + R * 0.8;
    if (d < min && d > 0) { f.x = r.x + dx / d * min; f.y = r.y + dy / d * min; }
  }
}

function damageFor(att, vic, kind) {
  const mv = MOVES[kind];
  const A = kind === 'special' ? att.stats.spAttack : att.stats.attack;
  const D = kind === 'special' ? vic.stats.spDefense : vic.stats.defense;
  const eff = effectiveness(att.type, vic.type);
  let d = mv.power * Math.sqrt(A / D) * eff * att.mods.damage * vic.mods.taken;
  if (vic.guardT > 0) d *= 0.3;
  return { damage: Math.max(1, Math.round(d)), eff };
}

/** Advance one tick. Returns the hit events this tick: [{attacker, victim, damage, kind, eff}]. */
export function step(m, dt = TICK) {
  if (m.over) return [];
  const events = [];
  m.t += dt;
  for (const f of m.fighters) {
    const inp = f.input, mods = f.mods;
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    f.iframes = Math.max(0, f.iframes - dt); f.guardT = Math.max(0, f.guardT - dt); f.dashT = Math.max(0, f.dashT - dt);
    f.energy = Math.min(100, f.energy + 14 * mods.energyRegen * dt);
    if (mods.regen) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * mods.regen * dt);
    if (inp.ax || inp.ay) { f.fx = inp.ax; f.fy = inp.ay; } else if (inp.mx || inp.my) { [f.fx, f.fy] = norm(inp.mx, inp.my); }
    const speed = 140 + f.stats.speed * 1.6;
    if (inp.dash && f.cd.dash === 0) {
      const [dx, dy] = (inp.mx || inp.my) ? norm(inp.mx, inp.my) : [f.fx, f.fy];
      f.dashT = 0.16; f.iframes = 0.26; f.cd.dash = 1.4 * mods.dashCd; f.dvx = dx; f.dvy = dy; f.actions++;
    }
    if (f.dashT > 0) { f.x += f.dvx * speed * 3.4 * dt; f.y += f.dvy * speed * 3.4 * dt; }
    else { f.x += inp.mx * speed * dt; f.y += inp.my * speed * dt; }
    f.x += f.vx * dt; f.y += f.vy * dt; const damp = Math.pow(0.02, dt); f.vx *= damp; f.vy *= damp;
    collide(f);
    if (inp.guard && f.cd.guard === 0 && f.energy >= 20) { f.energy -= 20; f.cd.guard = 6; f.guardT = 1.2 * mods.guardTime; f.actions++; }
    for (const kind of ['basic', 'special']) {
      const want = kind === 'basic' ? inp.atk : inp.sp, mv = MOVES[kind];
      if (!want || f.cd[kind] > 0 || f.energy < mv.cost) continue;
      f.energy -= mv.cost; f.cd[kind] = mv.cd * (kind === 'special' ? mods.specialCd : 1); f.actions++;
      const sp = mv.speed * mods.projectileSpeed;
      m.projectiles.push({ id: m.nextId++, owner: f.side, kind, type: f.type, x: f.x + f.fx * 40, y: f.y + f.fy * 40,
        vx: f.fx * sp, vy: f.fy * sp, r: mv.r, life: mv.life, hitDone: false });
    }
  }
  for (const p of m.projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < 0 || p.x > ARENA.w || p.y < 0 || p.y > ARENA.h) p.life = 0;
    for (const r of ARENA.rocks) if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + p.r * 0.5) p.life = 0;
    const vic = m.fighters[1 - p.owner], att = m.fighters[p.owner];
    if (p.life > 0 && !p.hitDone && vic.iframes === 0 && Math.hypot(p.x - vic.x, p.y - vic.y) < p.r + ARENA.radius * 0.85) {
      const { damage, eff } = damageFor(att, vic, p.kind);
      vic.hp = Math.max(0, vic.hp - damage); att.hits++;
      const kb = (MOVES[p.kind].knock || 80) * vic.mods.knockback, [nx, ny] = norm(p.vx, p.vy);
      vic.vx += nx * kb; vic.vy += ny * kb;
      events.push({ attacker: p.owner, victim: vic.side, damage, kind: p.kind, eff, victimMaxHp: vic.maxHp });
      p.hitDone = true; if (!MOVES[p.kind].pierce) p.life = 0;
    }
  }
  m.projectiles = m.projectiles.filter(p => p.life > 0);
  const [a, b] = m.fighters;
  if (a.hp <= 0 || b.hp <= 0) {
    m.over = true; m.reason = 'ko';
    m.winner = a.hp <= 0 && b.hp <= 0 ? null : a.hp <= 0 ? 1 : 0;
  } else if (m.t >= ARENA.roundSeconds) {
    m.over = true; m.reason = 'time';
    const pa = a.hp / a.maxHp, pb = b.hp / b.maxHp;
    m.winner = Math.abs(pa - pb) < 1e-9 ? null : pa > pb ? 0 : 1;
  }
  return events;
}

/** Forfeit (disconnect or quit): the other side wins. */
export function forfeit(m, side) { if (!m.over) { m.over = true; m.reason = 'forfeit'; m.winner = 1 - side; } }

/** Compact snapshot for clients. */
export function snapshot(m) {
  const r = v => Math.round(v * 10) / 10;
  return { t: r(m.t), over: m.over, winner: m.winner, reason: m.reason,
    f: m.fighters.map(f => ({ s: f.speciesId, x: r(f.x), y: r(f.y), fx: r(f.fx), fy: r(f.fy), hp: r(f.hp), max: f.maxHp, en: Math.round(f.energy),
      cd: { b: r(f.cd.basic), s: r(f.cd.special), d: r(f.cd.dash), g: r(f.cd.guard) }, i: f.iframes > 0, g: f.guardT > 0 })),
    p: m.projectiles.map(p => ({ id: p.id, o: p.owner, k: p.kind, ty: p.type, x: r(p.x), y: r(p.y), r: p.r })) };
}

export { Monstar };
