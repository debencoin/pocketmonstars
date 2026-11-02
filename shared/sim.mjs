// Authoritative 1v1 arena simulation. The server runs it (and the browser runs it for Practice vs AI);
// clients only send inputs and draw snapshots.
//
// Every species has two powers with their own shape, timing and hit area:
//   projectile  a thrown attack that travels (fireball, water pulse, shadow orb, rock, ice shard, petals)
//   bolt        instant line strike (lightning arc, solar ray)
//   whip        short-range lash (vines)
//   cone        sustained spray in front of the user, hits several times (flamethrower)
//   beam        charge up, then a long wide ray (hydro jet, ice beam, supernova)
//   strike      marks the ground at the rival's spot, then erupts after a delay (lightning from the sky,
//               roots, meteor, eclipse pillar, petal eruption). Dodgeable if you move off the mark.
import { Monstar, effectiveness } from './monstars.mjs';

export const ARENA = Object.freeze({ w: 960, h: 540, radius: 34, roundSeconds: 90,
  rocks: [{ x: 480, y: 270, r: 40 }, { x: 250, y: 150, r: 26 }, { x: 710, y: 390, r: 26 }] });
export const TICK = 1 / 30;

export const STYLES = Object.freeze({
  projectile: { cd: 0.5, cost: 0, power: 9, speed: 520, r: 12, life: 1.15 },
  bolt: { cd: 0.65, cost: 0, power: 9, range: 420, width: 26, hitAt: 0.08, dur: 0.22 },
  whip: { cd: 0.55, cost: 0, power: 11, range: 220, width: 34, hitAt: 0.12, dur: 0.3 },
  cone: { cd: 5, cost: 40, power: 6, range: 230, angle: 0.5, dur: 0.95, tick: 0.19, root: true },
  beam: { cd: 5, cost: 40, power: 25, range: 640, width: 44, hitAt: 0.42, dur: 0.85, root: true },
  strike: { cd: 5, cost: 40, power: 25, range: 460, radius: 74, hitAt: 0.6, dur: 1.0 },
});

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function norm(x, y) { const d = Math.hypot(x, y); return d > 1e-6 ? [x / d, y / d] : [0, 0]; }
function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1, L = vx * vx + vy * vy || 1;
  const t = clamp(((px - x1) * vx + (py - y1) * vy) / L, 0, 1);
  return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
}

export function sanitizeInput(i = {}) {
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  let mx = clamp(num(i.mx), -1, 1), my = clamp(num(i.my), -1, 1);
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  const [ax, ay] = norm(num(i.ax), num(i.ay));
  return { mx, my, ax, ay, atk: !!i.atk, sp: !!i.sp, dash: !!i.dash, guard: !!i.guard };
}

function makeFighter(monstar, side) {
  const s = monstar.stats, sp = monstar.species;
  return {
    side, speciesId: sp.id, type: monstar.type, mods: monstar.cls.mods, stats: s,
    styles: { basic: sp.basicStyle || 'projectile', special: sp.specialStyle || 'beam' },
    x: side === 0 ? 150 : ARENA.w - 150, y: ARENA.h / 2, vx: 0, vy: 0,
    fx: side === 0 ? 1 : -1, fy: 0, hp: s.hp, maxHp: s.hp, energy: 100,
    cd: { basic: 0, special: 1.5, dash: 0, guard: 0 }, iframes: 0, dashT: 0, dvx: 0, dvy: 0, guardT: 0,
    rootT: 0, castT: 9, castKind: null, hurtT: 0, moving: false,
    input: sanitizeInput(), hits: 0, actions: 0,
  };
}

export function createMatch(monstarA, monstarB) {
  return { t: 0, over: false, winner: null, reason: null,
    fighters: [makeFighter(monstarA, 0), makeFighter(monstarB, 1)], projectiles: [], effects: [], nextId: 1 };
}

function collide(f) {
  const R = ARENA.radius;
  // keep the whole sprite on screen: sprites are drawn above the feet, so the top margin is larger
  f.x = clamp(f.x, 75, ARENA.w - 75); f.y = clamp(f.y, 110, ARENA.h - 35);
  for (const r of ARENA.rocks) {
    const dx = f.x - r.x, dy = f.y - r.y, d = Math.hypot(dx, dy), min = r.r + R * 0.8;
    if (d < min && d > 0) { f.x = r.x + dx / d * min; f.y = r.y + dy / d * min; }
  }
}

function damageFor(att, vic, kind, style) {
  const A = kind === 'special' ? att.stats.spAttack : att.stats.attack;
  const D = kind === 'special' ? vic.stats.spDefense : vic.stats.defense;
  const eff = effectiveness(att.type, vic.type);
  let d = STYLES[style].power * Math.sqrt(A / D) * eff * att.mods.damage * vic.mods.taken;
  if (vic.guardT > 0) d *= 0.3;
  return { damage: Math.max(1, Math.round(d)), eff };
}

function land(m, att, vic, kind, style, events, dirx, diry, knock = 90) {
  if (vic.iframes > 0) return false;
  const { damage, eff } = damageFor(att, vic, kind, style);
  vic.hp = Math.max(0, vic.hp - damage); att.hits++; vic.hurtT = 0.35;
  const kb = knock * vic.mods.knockback; vic.vx += dirx * kb; vic.vy += diry * kb;
  events.push({ attacker: att.side, victim: vic.side, damage, kind, style, eff, victimMaxHp: vic.maxHp });
  return true;
}

function cast(m, f, kind) {
  const style = f.styles[kind], S = STYLES[style];
  f.energy -= S.cost; f.cd[kind] = S.cd * (kind === 'special' ? f.mods.specialCd : 1); f.actions++;
  f.castT = 0; f.castKind = kind;
  const id = m.nextId++;
  if (style === 'projectile') {
    const sp = S.speed * f.mods.projectileSpeed;
    m.projectiles.push({ id, owner: f.side, kind, style, type: f.type, sid: f.speciesId, x: f.x + f.fx * 40, y: f.y + f.fy * 40,
      vx: f.fx * sp, vy: f.fy * sp, r: S.r, life: S.life, hitDone: false });
    return;
  }
  const e = { id, owner: f.side, kind, style, type: f.type, sid: f.speciesId, x: f.x, y: f.y, dx: f.fx, dy: f.fy,
    gx: 0, gy: 0, t: 0, dur: S.dur, hit: false, nextTick: 0 };
  if (style === 'strike') {
    // Lands on the rival's position along your aim, within range. Moving off the mark dodges it.
    const vic = m.fighters[1 - f.side];
    const along = clamp((vic.x - f.x) * f.fx + (vic.y - f.y) * f.fy, 90, S.range);
    e.gx = clamp(f.x + f.fx * along, 30, ARENA.w - 30); e.gy = clamp(f.y + f.fy * along, 50, ARENA.h - 30);
  }
  if (S.root) f.rootT = S.dur;
  m.effects.push(e);
}

function runEffect(m, e, dt, events) {
  const att = m.fighters[e.owner], vic = m.fighters[1 - e.owner], S = STYLES[e.style];
  const prevT = e.t; e.t += dt;
  if (S.root) { e.x = att.x; e.y = att.y; } // beams and sprays come from the user as they hold position
  const R = ARENA.radius * 0.85;
  if (e.style === 'cone') {
    while (e.nextTick <= e.t && e.nextTick < S.dur) {
      const dx = vic.x - e.x, dy = vic.y - e.y, d = Math.hypot(dx, dy);
      const ang = Math.acos(clamp((dx * e.dx + dy * e.dy) / (d || 1), -1, 1));
      if (d < S.range + R && ang < S.angle + 0.15) land(m, att, vic, e.kind, e.style, events, e.dx, e.dy, 40);
      e.nextTick += S.tick;
    }
  } else if (!e.hit && prevT < S.hitAt && e.t >= S.hitAt) {
    e.hit = true;
    if (e.style === 'strike') {
      if (Math.hypot(vic.x - e.gx, vic.y - e.gy) < S.radius + R * 0.6) { const [nx, ny] = norm(vic.x - e.gx, vic.y - e.gy); land(m, att, vic, e.kind, e.style, events, nx, ny, 200); }
    } else {
      const x2 = e.x + e.dx * S.range, y2 = e.y + e.dy * S.range;
      if (segDist(vic.x, vic.y, e.x, e.y, x2, y2) < S.width / 2 + R) land(m, att, vic, e.kind, e.style, events, e.dx, e.dy, e.style === 'beam' ? 280 : 90);
    }
  }
}

/** Advance one tick. Returns the hit events this tick: [{attacker, victim, damage, kind, style, eff}]. */
export function step(m, dt = TICK) {
  if (m.over) return [];
  const events = [];
  m.t += dt;
  for (const f of m.fighters) {
    const inp = f.input, mods = f.mods;
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    f.iframes = Math.max(0, f.iframes - dt); f.guardT = Math.max(0, f.guardT - dt); f.dashT = Math.max(0, f.dashT - dt);
    f.rootT = Math.max(0, f.rootT - dt); f.hurtT = Math.max(0, f.hurtT - dt); f.castT += dt;
    f.energy = Math.min(100, f.energy + 14 * mods.energyRegen * dt);
    if (mods.regen) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * mods.regen * dt);
    if (f.rootT === 0) { if (inp.ax || inp.ay) { f.fx = inp.ax; f.fy = inp.ay; } else if (inp.mx || inp.my) { [f.fx, f.fy] = norm(inp.mx, inp.my); } }
    const speed = (140 + f.stats.speed * 1.6) * (f.rootT > 0 ? 0.2 : 1);
    if (inp.dash && f.cd.dash === 0 && f.rootT === 0) {
      const [dx, dy] = (inp.mx || inp.my) ? norm(inp.mx, inp.my) : [f.fx, f.fy];
      f.dashT = 0.16; f.iframes = 0.26; f.cd.dash = 1.4 * mods.dashCd; f.dvx = dx; f.dvy = dy; f.actions++;
    }
    const ox = f.x, oy = f.y;
    if (f.dashT > 0) { f.x += f.dvx * speed * 3.4 * dt; f.y += f.dvy * speed * 3.4 * dt; }
    else { f.x += inp.mx * speed * dt; f.y += inp.my * speed * dt; }
    f.x += f.vx * dt; f.y += f.vy * dt; const damp = Math.pow(0.02, dt); f.vx *= damp; f.vy *= damp;
    collide(f);
    f.moving = Math.hypot(f.x - ox, f.y - oy) > 0.5;
    if (inp.guard && f.cd.guard === 0 && f.energy >= 20) { f.energy -= 20; f.cd.guard = 6; f.guardT = 1.2 * mods.guardTime; f.actions++; }
    if (f.rootT === 0) for (const kind of ['basic', 'special']) {
      const want = kind === 'basic' ? inp.atk : inp.sp;
      if (want && f.cd[kind] === 0 && f.energy >= STYLES[f.styles[kind]].cost) { cast(m, f, kind); break; }
    }
  }
  for (const p of m.projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < 0 || p.x > ARENA.w || p.y < 0 || p.y > ARENA.h) p.life = 0;
    for (const r of ARENA.rocks) if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + p.r * 0.5) p.life = 0;
    const vic = m.fighters[1 - p.owner], att = m.fighters[p.owner];
    if (p.life > 0 && !p.hitDone && vic.iframes === 0 && Math.hypot(p.x - vic.x, p.y - vic.y) < p.r + ARENA.radius * 0.85) {
      const [nx, ny] = norm(p.vx, p.vy);
      if (land(m, att, vic, p.kind, p.style, events, nx, ny, 90)) { p.hitDone = true; p.life = 0; }
    }
  }
  m.projectiles = m.projectiles.filter(p => p.life > 0);
  for (const e of m.effects) runEffect(m, e, dt, events);
  m.effects = m.effects.filter(e => e.t < e.dur);
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
      cd: { b: r(f.cd.basic), s: r(f.cd.special), d: r(f.cd.dash), g: r(f.cd.guard) }, i: f.iframes > 0, g: f.guardT > 0,
      mv: f.moving, ds: f.dashT > 0, ct: r(Math.min(f.castT, 9)), ck: f.castKind, hu: r(f.hurtT) })),
    p: m.projectiles.map(p => ({ id: p.id, o: p.owner, k: p.kind, ty: p.type, sid: p.sid, x: r(p.x), y: r(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r })),
    e: m.effects.map(e => ({ id: e.id, o: e.owner, k: e.kind, st: e.style, ty: e.type, sid: e.sid, x: r(e.x), y: r(e.y), dx: r(e.dx * 100) / 100, dy: r(e.dy * 100) / 100,
      gx: r(e.gx), gy: r(e.gy), t: Math.round(e.t * 100) / 100, d: e.dur })) };
}

/** Simple opponent for Practice vs AI (runs in the browser). Returns an input object. */
export function aiInput(m, side, mem = {}) {
  const me = m.fighters[side], foe = m.fighters[1 - side];
  const dx = foe.x - me.x, dy = foe.y - me.y, d = Math.hypot(dx, dy), [nx, ny] = norm(dx, dy);
  mem.t = (mem.t || 0) - TICK; mem.strafe ??= 1;
  if (mem.t <= 0) { mem.t = 0.5 + Math.random() * 0.7; if (Math.random() < 0.4) mem.strafe *= -1; }
  const want = me.styles.basic === 'whip' ? 170 : 270;
  let mx = (d > want + 60 ? nx : d < want - 60 ? -nx : 0) - ny * mem.strafe * 0.8;
  let my = (d > want + 60 ? ny : d < want - 60 ? -ny : 0) + nx * mem.strafe * 0.8;
  let dash = false;
  for (const p of m.projectiles) if (p.owner !== side && Math.hypot(p.x - me.x, p.y - me.y) < 120 && Math.random() < 0.06) { dash = true; mx = -p.vy; my = p.vx; }
  for (const e of m.effects) if (e.owner !== side && e.style === 'strike' && Math.hypot(e.gx - me.x, e.gy - me.y) < 110) { mx = me.x - e.gx; my = me.y - e.gy; }
  const sst = me.styles.special, inRange = sst === 'cone' ? d < 230 : sst === 'beam' ? d < 600 : d < 450;
  return { mx, my, ax: nx + (Math.random() - 0.5) * 0.15, ay: ny + (Math.random() - 0.5) * 0.15,
    atk: d < (me.styles.basic === 'whip' ? 230 : me.styles.basic === 'bolt' ? 430 : 560) && Math.random() < 0.5, sp: inRange && Math.random() < 0.05, dash, guard: false };
}

export { Monstar };
