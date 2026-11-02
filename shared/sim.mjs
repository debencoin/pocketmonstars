// Authoritative 1v1 arena simulation. The server runs it (and the browser runs it for guest practice);
// clients only send inputs and draw snapshots.
//
// Monstars move on their own in their species' style (pounce, dart, glide, stomp, blink, skate, prance,
// charge, hover). The player taps A / B to attack and can drag to take over movement at any time.
//
// Every species has two powers with their own shape, timing and hit area:
//   projectile  thrown attack that travels           bolt    instant line strike
//   whip        short-range lash                     cone    sustained spray, hits several times
//   beam        charge, then a long wide ray          strike  marks the rival's spot, erupts after a delay
//   levitate    lifts debris with psychic force, hurls it, then finishes with chained lightning
//
// Landing hits earns EXP. Monstars level up and evolve mid-match (Infant 1, Rookie 3, Champion 10,
// Ultimate 25, Mega 50, Ascended 80) and their stats grow immediately.
import { Monstar, effectiveness, statsAt, stageFor, expForLevel, expToNext, MAX_LEVEL } from './monstars.mjs';

export const ARENA = Object.freeze({ w: 960, h: 540, radius: 30, roundSeconds: 60,
  rocks: [{ x: 300, y: 170, r: 24 }, { x: 660, y: 380, r: 24 }] });
export const TICK = 1 / 30;
// Overall pace: lower = slower battles. Applied to movement, dashes and projectile speed.
export const PACE = 0.8;
// Whole-game speed: every timer, move and animation runs at 0.7x real time (the round clock stays real).
export const GAME_SPEED = 0.7;
// All damage is 30% lower than the base formula, so battles last most of the minute.
export const DAMAGE_SCALE = 0.7;
export const ARENA_COUNT = 6; // 0 ruins coliseum, 1 dust bowl, 2 grass, 3 cosmic, 4 volcano, 5 ice
// What a power does to the Monstar it hits (special moves always, basic moves 15% of the time).
// stop = can't move, act = can't attack, slow = speed multiplier, dot = % max HP per second, lift = carried around in the air.
export const STATUS = Object.freeze({
  paralyze: { label: 'PARALYZED', dur: 1.8, slow: 0.35, fail: 0.4 },
  freeze: { label: 'FROZEN', dur: 1.3, stop: true, act: true },
  burn: { label: 'BURNED', dur: 3.5, dot: 0.02 },
  poison: { label: 'POISONED', dur: 4.5, dot: 0.022, slow: 0.85 },
  root: { label: 'ENTANGLED', dur: 1.6, stop: true },
  stun: { label: 'STUNNED', dur: 1.1, stop: true, act: true },
  confuse: { label: 'CONFUSED', dur: 2.6, confuse: true },
  lift: { label: 'LEVITATED', dur: 1.7, stop: true, act: true, lift: true },
  soak: { label: 'SWEPT AWAY', dur: 1.5, slow: 0.55, push: 1.8 },
  dazzle: { label: 'DAZZLED', dur: 2.0, slow: 0.7, fail: 0.25 },
});
export const TYPE_STATUS = Object.freeze({ SPARK: 'paralyze', FROST: 'freeze', EMBER: 'burn', DRACO: 'burn', VENOM: 'poison', GROVE: 'root',
  STONE: 'stun', STEEL: 'stun', SHADE: 'confuse', PSYCHIC: 'lift', TIDE: 'soak', GALE: 'soak', ASTRAL: 'dazzle' });
export const ULT_GAIN = 1.4; // ULT meter per point of damage dealt (and 0.6 per point taken); a full meter powers up the next special
export const BATTLE_HP = 1.7; // battle HP multiplier so a fight lasts close to the full minute
export const PICKUP = Object.freeze({ every: 14, heal: 0.2, r: 34, life: 12 });
export const BOUNDS = Object.freeze({ x0: 60, x1: 900, y0: 150, y1: 500 });
export const EXP_RULES = Object.freeze({ perDamage: 1.2, critBonus: 1.5, koBonus: 40, finishBonus: 15 });

export const STYLES = Object.freeze({
  projectile: { cd: 0.6, cost: 0, power: 9, speed: 520 * PACE, r: 12, life: 1.15 / PACE },
  bolt: { cd: 0.78, cost: 0, power: 9, range: 420, width: 26, hitAt: 0.08, dur: 0.22 },
  whip: { cd: 0.66, cost: 0, power: 11, range: 220, width: 34, hitAt: 0.12, dur: 0.3 },
  cone: { cd: 5, cost: 40, power: 6, range: 230, angle: 0.5, dur: 0.95, tick: 0.19, root: true },
  beam: { cd: 5, cost: 40, power: 25, range: 640, width: 44, hitAt: 0.42, dur: 0.85, root: true },
  strike: { cd: 5, cost: 40, power: 25, range: 460, radius: 74, hitAt: 0.6, dur: 1.0 },
  levitate: { cd: 5.5, cost: 45, power: 9, dur: 1.5, throws: [0.7, 0.86, 1.02], boltAt: 1.22, boltPower: 11, range: 560, root: true },
  debris: { power: 9, speed: 720 * PACE, r: 16, life: 0.9 / PACE },
});

const MOTION = {
  pounce: { speed: 1.0, keep: 1.0, flip: 0.9, dash: 0.035, pause: 0.35 },
  dart: { speed: 1.15, keep: 1.1, flip: 0.35, dash: 0.05, pause: 0 },
  glide: { speed: 0.95, keep: 1.05, flip: 2.2, dash: 0.012, pause: 0, wave: true },
  stomp: { speed: 0.75, keep: 0.8, flip: 2.5, dash: 0.006, pause: 0.25 },
  blink: { speed: 0.85, keep: 1.1, flip: 1.2, dash: 0, pause: 0.1, blink: 0.012 },
  skate: { speed: 1.05, keep: 1.0, flip: 1.6, dash: 0.015, pause: 0, slide: true },
  prance: { speed: 1.0, keep: 1.0, flip: 0.8, dash: 0.02, pause: 0.12, wave: true },
  charge: { speed: 1.05, keep: 0.6, flip: 1.4, dash: 0.03, pause: 0.2, rush: true },
  hover: { speed: 0.9, keep: 1.15, flip: 1.8, dash: 0.015, pause: 0, wave: true, float: true },
};
const PREFERRED_RANGE = { whip: 170, cone: 200, bolt: 320, projectile: 300 };

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
  const sw = Number.isInteger(i.sw) && i.sw >= 0 && i.sw < 3 ? i.sw : -1; // 3v3: switch to team slot
  return { mx, my, ax, ay, atk: !!i.atk, sp: !!i.sp, dash: !!i.dash, guard: !!i.guard, sw };
}

function makeFighter(monstar, side, teamMax = 0) {
  const s = monstar.stats, sp = monstar.species;
  return {
    side, teamMax: Math.round((teamMax || s.hp) * BATTLE_HP), mon: monstar, speciesId: sp.id, type: monstar.type, mods: monstar.cls.mods, stats: s,
    styles: { basic: sp.basicStyle || 'projectile', special: sp.specialStyle || 'beam' },
    motion: MOTION[sp.motion] ? sp.motion : 'pounce',
    level: monstar.level, exp: monstar.exp, expGained: 0,
    x: side === 0 ? 170 : ARENA.w - 170, y: ARENA.h / 2 + 20, vx: 0, vy: 0,
    fx: side === 0 ? 1 : -1, fy: 0, hp: Math.round(s.hp * BATTLE_HP), maxHp: Math.round(s.hp * BATTLE_HP), energy: 100,
    cd: { basic: 0, special: 1.5, dash: 0, guard: 0 }, iframes: 0, dashT: 0, dvx: 0, dvy: 0, guardT: 0,
    rootT: 0, castT: 9, castKind: null, hurtT: 0, moving: false, blinkT: 0, levT: 0, recT: 0, status: null, ult: 0, ultOn: false,
    auto: { t: 0, strafe: side ? -1 : 1, pause: 0, slide: [0, 0], phase: side * 1.7 },
    input: sanitizeInput(), hits: 0, actions: 0,
  };
}

/** 1v1: pass two Monstars. 3v3: pass two arrays of up to three; the next one comes in when one faints. */
export function createMatch(monstarA, monstarB, opts = {}) {
  const teams = [monstarA, monstarB].map(x => (Array.isArray(x) ? x.slice(0, 3) : [x]));
  const teamMax = teams.map(t => t.reduce((n, mo) => n + mo.stats.hp, 0));
  const fighters = [makeFighter(teams[0][0], 0, teamMax[0]), makeFighter(teams[1][0], 1, teamMax[1])];
  return { t: 0, over: false, winner: null, reason: null, auto: opts.auto !== false, arena: opts.arena ?? 0,
    teams, teamMax, roster: teams.map((t, side) => t.map((_, i) => (i === 0 ? fighters[side] : null))), slot: [0, 0], swCd: [0, 0],
    limit: teams[0].length > 1 || teams[1].length > 1 ? 150 : ARENA.roundSeconds, fighters, projectiles: [], effects: [], nextId: 1, finished: false, pickups: [], nextPickup: PICKUP.every, cpu: opts.cpu || null };
}
const alive = (m, side, i) => { const f = m.roster[side][i]; return !f || f.hp > 0; };
function switchIn(m, side, slot, events, reason) {
  const old = m.fighters[side];
  const nf = (m.roster[side][slot] ||= makeFighter(m.teams[side][slot], side, m.teamMax[side]));
  nf.x = old.x; nf.y = old.y; nf.vx = nf.vy = 0; nf.iframes = Math.max(nf.iframes, 1.0); nf.input = old.input; nf.castT = 9;
  if (reason === 'faint') nf.x = side === 0 ? 170 : ARENA.w - 170;
  m.fighters[side] = nf; m.slot[side] = slot; m.swCd[side] = 3;
  events.push({ type: 'switch', side, slot, speciesId: nf.speciesId, reason });
}
function updatePickups(m, dt, events) {
  m.nextPickup -= dt;
  if (m.nextPickup <= 0 && m.pickups.length < 1) {
    m.nextPickup = PICKUP.every;
    let x, y, tries = 0;
    do { x = BOUNDS.x0 + 80 + Math.random() * (BOUNDS.x1 - BOUNDS.x0 - 160); y = BOUNDS.y0 + 40 + Math.random() * (BOUNDS.y1 - BOUNDS.y0 - 80); }
    while (tries++ < 20 && ARENA.rocks.some(r => Math.hypot(r.x - x, r.y - y) < r.r + 50));
    m.pickups.push({ id: m.nextId++, x, y, life: PICKUP.life, k: 'heal' });
  }
  for (const p of m.pickups) {
    p.life -= dt;
    for (const f of m.fighters) if (p.life > 0 && f.hp > 0 && Math.hypot(f.x - p.x, f.y - p.y) < PICKUP.r + ARENA.radius) {
      const heal = Math.round(f.maxHp * PICKUP.heal); f.hp = Math.min(f.maxHp, f.hp + heal); p.life = 0;
      events.push({ type: 'pickup', side: f.side, k: 'heal', amount: heal, x: p.x, y: p.y });
    }
  }
  m.pickups = m.pickups.filter(p => p.life > 0);
}
function teamHpFrac(m, side) { return m.roster[side].reduce((n, f, i) => n + (f ? f.hp : m.teams[side][i].stats.hp * BATTLE_HP), 0) / (m.teamMax[side] * BATTLE_HP); }

function collide(f) {
  const R = ARENA.radius;
  f.x = clamp(f.x, BOUNDS.x0, BOUNDS.x1); f.y = clamp(f.y, BOUNDS.y0, BOUNDS.y1);
  for (const r of ARENA.rocks) {
    const dx = f.x - r.x, dy = f.y - r.y, d = Math.hypot(dx, dy), min = r.r + R * 0.8;
    if (d < min && d > 0) { f.x = r.x + dx / d * min; f.y = r.y + dy / d * min; }
  }
}

// ---------- EXP and evolution ----------
function gainExp(m, f, amount, events) {
  if (amount <= 0) return;
  f.exp += amount; f.expGained += amount;
  while (f.level < MAX_LEVEL && f.exp >= expForLevel(f.level + 1)) {
    const before = stageFor(f.level), ratio = f.hp / f.maxHp;
    f.level++;
    f.stats = statsAt(f.mon, f.level);
    f.maxHp = Math.round(f.stats.hp * BATTLE_HP); f.hp = Math.min(f.maxHp, Math.round(f.maxHp * ratio + f.maxHp * 0.1));
    const after = stageFor(f.level), evolved = after.id !== before.id;
    if (evolved) { f.iframes = Math.max(f.iframes, 0.8); f.energy = 100; }
    events.push({ type: 'level', side: f.side, level: f.level, stage: after.name, stageId: after.id, evolved });
  }
}
export function expProgress(f) { const base = expForLevel(f.level); return { into: f.exp - base, need: f.level >= MAX_LEVEL ? 1 : expToNext(f.level) }; }

function damageFor(att, vic, kind, style, powerOverride) {
  const A = kind === 'special' ? att.stats.spAttack : att.stats.attack;
  const D = kind === 'special' ? vic.stats.spDefense : vic.stats.defense;
  const eff = effectiveness(att.type, vic.type);
  const crit = Math.random() < 0.08;
  let d = (powerOverride ?? STYLES[style].power) * (1 + (att.level - 1) * 0.03) * Math.sqrt(A / D) * eff * att.mods.damage * vic.mods.taken * DAMAGE_SCALE;
  if (kind === 'special' && att.ultOn) d *= 1.7;
  if (crit) d *= 1.5;
  if (vic.guardT > 0) d *= 0.3;
  return { damage: Math.max(1, Math.round(d)), eff, crit };
}

function applyStatus(m, vic, k, att, events, mult = 1) {
  const S = STATUS[k];
  if (vic.status && vic.status.t > 0.4 && vic.status.k === k) { vic.status.t = Math.max(vic.status.t, S.dur * mult * 0.6); return; }
  vic.status = { k, t: S.dur * mult, max: S.dur * mult, src: att.side, ax: vic.x, ay: vic.y, ph: Math.random() * 6, acc: 0 };
  events.push({ type: 'status', side: vic.side, k, label: S.label });
}
function land(m, att, vic, kind, style, events, dirx, diry, knock = 90, power) {
  if (vic.iframes > 0) { events.push({ type: 'miss', attacker: att.side, victim: vic.side, style }); return false; }
  const { damage, eff, crit } = damageFor(att, vic, kind, style, power);
  vic.hp = Math.max(0, vic.hp - damage); att.hits++; vic.hurtT = 0.35;
  const heavy = style === 'beam' || style === 'strike' || style === 'levitate' || crit;
  if (heavy) vic.recT = Math.max(vic.recT, 0.35); // "recovering": a short stagger after a big hit
  att.ult = Math.min(100, att.ult + damage * ULT_GAIN); vic.ult = Math.min(100, vic.ult + damage * 0.6);
  // what this power does to the Monstar it hit
  const sk = style === 'levitate' ? 'lift' : TYPE_STATUS[att.type];
  if (sk && (kind === 'special' || style === 'levitate' || Math.random() < 0.15)) applyStatus(m, vic, sk, att, events, kind === 'special' && att.ultOn ? 1.5 : 1);
  const push = vic.status && STATUS[vic.status.k].push || 1;
  const kb = knock * vic.mods.knockback * push; vic.vx += dirx * kb; vic.vy += diry * kb;
  const exp = Math.max(1, Math.round(damage * EXP_RULES.perDamage * (crit ? EXP_RULES.critBonus : 1)));
  events.push({ type: 'hit', attacker: att.side, victim: vic.side, damage, kind, style, eff, crit, exp, victimMaxHp: vic.teamMax || vic.maxHp });
  gainExp(m, att, exp, events);
  return true;
}

function cast(m, f, kind) {
  const style = f.styles[kind], S = STYLES[style];
  f.energy -= S.cost; f.cd[kind] = S.cd * (kind === 'special' ? f.mods.specialCd : 1); f.actions++;
  f.castT = 0; f.castKind = kind;
  const id = m.nextId++;
  if (style === 'projectile') {
    const sp = S.speed * f.mods.projectileSpeed;
    m.projectiles.push({ id, owner: f.side, kind, style, type: f.type, sid: f.speciesId, x: f.x + f.fx * 36, y: f.y + f.fy * 36,
      vx: f.fx * sp, vy: f.fy * sp, r: S.r, life: S.life, hitDone: false, missDone: false });
    return;
  }
  const e = { id, owner: f.side, kind, style, type: f.type, sid: f.speciesId, x: f.x, y: f.y, dx: f.fx, dy: f.fy,
    gx: 0, gy: 0, t: 0, dur: S.dur, hit: false, nextTick: 0, thrown: 0, bolted: false };
  if (style === 'strike') {
    const vic = m.fighters[1 - f.side];
    const along = clamp((vic.x - f.x) * f.fx + (vic.y - f.y) * f.fy, 90, S.range);
    e.gx = clamp(f.x + f.fx * along, 30, ARENA.w - 30); e.gy = clamp(f.y + f.fy * along, 60, ARENA.h - 30);
  }
  if (style === 'levitate') f.levT = S.dur;
  if (S.root) f.rootT = S.dur;
  m.effects.push(e);
}

function runEffect(m, e, dt, events) {
  const att = m.fighters[e.owner], vic = m.fighters[1 - e.owner], S = STYLES[e.style];
  const prevT = e.t; e.t += dt;
  if (S.root) { e.x = att.x; e.y = att.y; }
  const R = ARENA.radius * 0.9;
  if (e.style === 'cone') {
    while (e.nextTick <= e.t && e.nextTick < S.dur) {
      const dx = vic.x - e.x, dy = vic.y - e.y, d = Math.hypot(dx, dy);
      const ang = Math.acos(clamp((dx * e.dx + dy * e.dy) / (d || 1), -1, 1));
      if (d < S.range + R && ang < S.angle + 0.15) land(m, att, vic, e.kind, e.style, events, e.dx, e.dy, 40);
      e.nextTick += S.tick;
    }
  } else if (e.style === 'levitate') {
    // debris orbits the user, then is hurled at the rival one piece at a time
    while (e.thrown < S.throws.length && e.t >= S.throws[e.thrown]) {
      const k = e.thrown++, a = k * 2.1 + 0.6, ox = att.x + Math.cos(a) * 46, oy = att.y - 30 + Math.sin(a) * 24;
      const [nx, ny] = norm(vic.x - ox, vic.y - oy), D = STYLES.debris;
      m.projectiles.push({ id: m.nextId++, owner: att.side, kind: 'special', style: 'debris', type: att.type, sid: att.speciesId, x: ox, y: oy,
        vx: nx * D.speed, vy: ny * D.speed, r: D.r, life: D.life, hitDone: false, missDone: false });
    }
    if (!e.bolted && e.t >= S.boltAt) {
      e.bolted = true; e.gx = vic.x; e.gy = vic.y;
      if (Math.hypot(vic.x - att.x, vic.y - att.y) < S.range) { const [nx, ny] = norm(vic.x - att.x, vic.y - att.y); land(m, att, vic, 'special', 'levitate', events, nx, ny, 120, S.boltPower); }
      else events.push({ type: 'miss', attacker: att.side, victim: vic.side, style: 'levitate' });
    }
  } else if (!e.hit && prevT < S.hitAt && e.t >= S.hitAt) {
    e.hit = true;
    if (e.style === 'strike') {
      if (Math.hypot(vic.x - e.gx, vic.y - e.gy) < S.radius + R * 0.6) { const [nx, ny] = norm(vic.x - e.gx, vic.y - e.gy); land(m, att, vic, e.kind, e.style, events, nx, ny, 200); }
      else events.push({ type: 'miss', attacker: att.side, victim: vic.side, style: e.style });
    } else {
      const x2 = e.x + e.dx * S.range, y2 = e.y + e.dy * S.range;
      if (segDist(vic.x, vic.y, e.x, e.y, x2, y2) < S.width / 2 + R) land(m, att, vic, e.kind, e.style, events, e.dx, e.dy, e.style === 'beam' ? 280 : 90);
      else if (e.style !== 'whip' || Math.hypot(vic.x - e.x, vic.y - e.y) < S.range + 60) events.push({ type: 'miss', attacker: att.side, victim: vic.side, style: e.style });
    }
  }
}

// ---------- autopilot movement ----------
function autoMove(m, f, foe) {
  const M = MOTION[f.motion], A = f.auto;
  const T = TICK * GAME_SPEED; A.t -= T; A.phase += T;
  const dx = foe.x - f.x, dy = foe.y - f.y, d = Math.hypot(dx, dy), [nx, ny] = norm(dx, dy);
  if (A.t <= 0) {
    A.t = M.flip * (0.6 + Math.random() * 0.8);
    if (Math.random() < 0.55) A.strafe *= -1;
    A.pause = Math.random() < M.pause ? 0.25 + Math.random() * 0.35 : 0;
    if (M.slide) { const a = Math.random() * Math.PI * 2; A.slide = [Math.cos(a), Math.sin(a)]; }
  }
  if (A.pause > 0) { A.pause -= T; return { mx: 0, my: 0, dash: false }; }
  const want = (PREFERRED_RANGE[f.styles.basic] || 280) * M.keep * (M.rush && (A.phase % 3) < 1.1 ? 0.35 : 1);
  const radial = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
  let wave = M.wave ? Math.sin(A.phase * 2.2) * 0.7 : 0;
  let mx = nx * radial + (-ny) * A.strafe * (0.85 + wave), my = ny * radial + nx * A.strafe * (0.85 + wave);
  if (M.slide) { mx = mx * 0.4 + A.slide[0] * 0.8; my = my * 0.4 + A.slide[1] * 0.8; }
  // steer back toward the middle near walls
  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2, cy = (BOUNDS.y0 + BOUNDS.y1) / 2;
  if (f.x < BOUNDS.x0 + 60 || f.x > BOUNDS.x1 - 60) { mx += Math.sign(cx - f.x) * 0.9; if (M.slide) A.slide[0] = Math.sign(cx - f.x); }
  if (f.y < BOUNDS.y0 + 50 || f.y > BOUNDS.y1 - 40) { my += Math.sign(cy - f.y) * 0.9; if (M.slide) A.slide[1] = Math.sign(cy - f.y); }
  let dash = Math.random() < M.dash;
  const pk = m.pickups?.[0]; // hurt Monstars go for the heal
  if (pk && f.hp / f.maxHp < 0.65 && Math.hypot(pk.x - f.x, pk.y - f.y) < 420) { [mx, my] = norm(pk.x - f.x, pk.y - f.y); }
  // dodge incoming attacks
  for (const p of m.projectiles) {
    if (p.owner === f.side) continue;
    const px = f.x - p.x, py = f.y - p.y, pd = Math.hypot(px, py);
    if (pd < 150 && (p.vx * px + p.vy * py) > 0 && Math.random() < 0.08 * M.speed) { mx = -p.vy; my = p.vx; if (Math.random() < 0.5) { mx = -mx; my = -my; } dash = dash || Math.random() < 0.4; }
  }
  for (const e of m.effects) if (e.owner !== f.side && e.style === 'strike' && Math.hypot(e.gx - f.x, e.gy - f.y) < 120) { mx = f.x - e.gx; my = f.y - e.gy; }
  if (M.blink && f.blinkT === 0 && Math.random() < M.blink) { // teleport a short hop sideways
    const a = Math.atan2(ny, nx) + (Math.random() < 0.5 ? 1.6 : -1.6);
    f.x += Math.cos(a) * 140; f.y += Math.sin(a) * 90; f.blinkT = 0.35; f.iframes = Math.max(f.iframes, 0.2); collide(f);
  }
  const [ux, uy] = norm(mx, my);
  return { mx: ux * M.speed, my: uy * M.speed, dash };
}

/** Advance one tick. Returns events: hit, miss and level ({type:'level', evolved}). */
export function step(m, realDt = TICK) {
  if (m.over) return [];
  const events = [];
  m.t += realDt;
  const dt = realDt * GAME_SPEED; // everything below runs at game speed
  updatePickups(m, dt, events);
  for (const side of [0, 1]) { // 3v3 manual switch
    m.swCd[side] = Math.max(0, m.swCd[side] - dt);
    const want = m.fighters[side].input.sw;
    if (want >= 0 && want < m.teams[side].length && want !== m.slot[side] && m.swCd[side] === 0 && alive(m, side, want)) switchIn(m, side, want, events, 'switch');
  }
  for (const f of m.fighters) {
    const foe = m.fighters[1 - f.side];
    const inp = f.input, mods = f.mods;
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    for (const k of ['iframes', 'guardT', 'dashT', 'rootT', 'hurtT', 'blinkT', 'levT', 'recT']) f[k] = Math.max(0, f[k] - dt);
    const st = f.status, SS = st ? STATUS[st.k] : null;
    if (st) {
      st.t -= dt;
      if (SS.dot) { st.acc += f.maxHp * SS.dot * dt; if (st.acc >= 2) { const dmg = Math.min(Math.floor(st.acc), Math.max(0, Math.ceil(f.hp) - 1)); st.acc -= Math.floor(st.acc);
        if (dmg > 0) { f.hp -= dmg; const src = m.fighters[st.src]; events.push({ type: 'hit', attacker: st.src, victim: f.side, damage: dmg, kind: 'status', style: st.k, eff: 1, crit: false, exp: 0, victimMaxHp: f.teamMax || f.maxHp }); if (src) src.ult = Math.min(100, src.ult + dmg * 0.5); } } }
      if (SS.lift) { // carried around in the air by psychic force, can't do anything
        st.ph += dt * 4.2; const holder = m.fighters[st.src];
        const cx = holder ? (st.ax + (holder.x + holder.fx * 160 - st.ax) * Math.min(1, (st.max - st.t) * 0.8)) : st.ax;
        f.x = cx + Math.cos(st.ph) * 70; f.y = st.ay + Math.sin(st.ph * 1.3) * 40; f.vx = f.vy = 0; collide(f);
        if (st.t <= 0) { f.recT = 0.5; f.vy = 160; } // slammed down at the end
      }
      if (st.t <= 0) f.status = null;
    }
    const stopped = !!(f.status && SS.stop) || f.recT > 0, noAct = !!(f.status && SS.act) || f.recT > 0;
    f.castT += dt;
    f.energy = Math.min(100, f.energy + 14 * mods.energyRegen * dt);
    if (mods.regen) f.hp = Math.min(f.maxHp, f.hp + f.maxHp * mods.regen * dt);
    // movement: player steering wins, otherwise the Monstar moves on its own
    let mx = inp.mx, my = inp.my, wantDash = inp.dash;
    if (m.auto && !mx && !my) { const a = autoMove(m, f, foe); mx = a.mx; my = a.my; wantDash = wantDash || a.dash; }
    if (f.status && SS.confuse) { mx = -mx; my = -my * 0.6 + Math.sin(m.t * 7) * 0.5; } // stumbles the wrong way
    if (stopped) { mx = 0; my = 0; wantDash = false; }
    // aim: player's aim if given, otherwise straight at the rival with a little lead
    if (f.rootT === 0) {
      if (inp.ax || inp.ay) { f.fx = inp.ax; f.fy = inp.ay; }
      else { const lead = 0.18; [f.fx, f.fy] = norm(foe.x + foe.vx * lead - f.x, foe.y + foe.vy * lead - f.y); }
    }
    const speed = (140 + f.stats.speed * 1.4) * PACE * (f.rootT > 0 ? 0.2 : 1) * (f.status && SS.slow || 1);
    if (wantDash && f.cd.dash === 0 && f.rootT === 0) {
      const [dx, dy] = (mx || my) ? norm(mx, my) : [f.fx, f.fy];
      f.dashT = 0.18; f.iframes = 0.28; f.cd.dash = 1.6 * mods.dashCd; f.dvx = dx; f.dvy = dy; f.actions++;
    }
    const ox = f.x, oy = f.y;
    if (f.dashT > 0) { f.x += f.dvx * speed * 3.0 * dt; f.y += f.dvy * speed * 3.0 * dt; }
    else { f.x += mx * speed * dt; f.y += my * speed * dt; }
    f.x += f.vx * dt; f.y += f.vy * dt; const damp = Math.pow(0.02, dt); f.vx *= damp; f.vy *= damp;
    collide(f);
    f.moving = Math.hypot(f.x - ox, f.y - oy) > 0.5;
    if (inp.guard && !noAct && f.cd.guard === 0 && f.energy >= 20) { f.energy -= 20; f.cd.guard = 6; f.guardT = 1.2 * mods.guardTime; f.actions++; }
    if (f.rootT === 0 && !noAct) for (const kind of ['special', 'basic']) {
      const want = kind === 'basic' ? inp.atk : inp.sp;
      if (want && f.cd[kind] === 0 && f.energy >= STYLES[f.styles[kind]].cost) {
        if (f.status && SS.fail && Math.random() < SS.fail) { f.cd[kind] = 0.5; events.push({ type: 'status', side: f.side, k: f.status.k, label: "CAN'T MOVE!" }); break; }
        f.ultOn = kind === 'special' && f.ult >= 100; if (f.ultOn) { f.ult = 0; events.push({ type: 'ult', side: f.side }); }
        cast(m, f, kind); break;
      }
    }
  }
  for (const p of m.projectiles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < 0 || p.x > ARENA.w || p.y < 0 || p.y > ARENA.h) p.life = 0;
    for (const r of ARENA.rocks) if (Math.hypot(p.x - r.x, p.y - r.y) < r.r + p.r * 0.5) p.life = 0;
    const vic = m.fighters[1 - p.owner], att = m.fighters[p.owner];
    const near = Math.hypot(p.x - vic.x, p.y - vic.y) < p.r + ARENA.radius * 0.9;
    if (p.life > 0 && !p.hitDone && near) {
      if (vic.iframes > 0) { if (!p.missDone) { p.missDone = true; events.push({ type: 'miss', attacker: att.side, victim: vic.side, style: p.style }); } }
      else { const [nx, ny] = norm(p.vx, p.vy); if (land(m, att, vic, p.kind, p.style, events, nx, ny, p.style === 'debris' ? 160 : 90)) { p.hitDone = true; p.life = 0; } }
    }
  }
  m.projectiles = m.projectiles.filter(p => p.life > 0);
  for (const e of m.effects) runEffect(m, e, dt, events);
  m.effects = m.effects.filter(e => e.t < e.dur);
  const out = [false, false];
  for (const side of [0, 1]) if (m.fighters[side].hp <= 0) { // fainted: send in the next team member, if any
    const next = m.teams[side].findIndex((_, i) => i !== m.slot[side] && alive(m, side, i));
    if (next >= 0) switchIn(m, side, next, events, 'faint'); else out[side] = true;
  }
  if (out[0] || out[1]) {
    m.over = true; m.reason = 'ko';
    m.winner = out[0] && out[1] ? null : out[0] ? 1 : 0;
  } else if (m.t >= m.limit) {
    m.over = true; m.reason = 'time';
    const pa = teamHpFrac(m, 0), pb = teamHpFrac(m, 1);
    m.winner = Math.abs(pa - pb) < 1e-9 ? null : pa > pb ? 0 : 1;
  }
  if (m.over) finishExp(m, events);
  return events;
}

function finishExp(m, events) {
  if (m.finished) return; m.finished = true;
  for (const f of m.roster.flat().filter(Boolean)) { // every team member that took part
    let bonus = m.reason === 'forfeit' && m.winner !== f.side ? 0 : EXP_RULES.finishBonus;
    if (m.winner === f.side) bonus += EXP_RULES.koBonus;
    const active = m.fighters[f.side] === f;
    if (bonus) { if (active) events.push({ type: 'bonus', side: f.side, exp: bonus }); gainExp(m, f, bonus, active ? events : []); }
  }
}

/** Forfeit (disconnect or quit): the other side wins. Leaving never avoids paying the pot. */
export function forfeit(m, side) { if (!m.over) { m.over = true; m.reason = 'forfeit'; m.winner = 1 - side; return finishExp(m, []); } }

/** Compact snapshot for clients. */
export function snapshot(m) {
  const r = v => Math.round(v * 10) / 10;
  const tm = m.teams[0].length > 1 || m.teams[1].length > 1
    ? m.teams.map((t, side) => t.map((mo, i) => { const f = m.roster[side][i]; return { s: mo.species.id, hp: f ? Math.max(0, Math.round(f.hp)) : mo.stats.hp * BATTLE_HP, mx: f ? f.maxHp : mo.stats.hp * BATTLE_HP, lv: f ? f.level : mo.level }; })) : null;
  return { t: r(m.t), over: m.over, winner: m.winner, reason: m.reason, ar: m.arena, tm, sl: m.slot.slice(), sc: m.swCd.map(r),
    f: m.fighters.map(f => { const p = expProgress(f); return { s: f.speciesId, x: r(f.x), y: r(f.y), fx: r(f.fx), fy: r(f.fy), hp: r(f.hp), max: f.maxHp, en: Math.round(f.energy),
      cd: { b: r(f.cd.basic), s: r(f.cd.special), d: r(f.cd.dash), g: r(f.cd.guard) }, i: f.iframes > 0, g: f.guardT > 0,
      mv: f.moving, ds: f.dashT > 0, ct: r(Math.min(f.castT, 9)), ck: f.castKind, hu: r(f.hurtT),
      lv: f.level, sg: stageFor(f.level).id, xi: p.into, xn: p.need, xg: f.expGained, fl: MOTION[f.motion].float || f.levT > 0, lt: r(f.levT), bk: r(f.blinkT), mo: f.motion,
      st: f.status?.k || null, stt: f.status ? r(f.status.t / f.status.max) : 0, rc: f.recT > 0, ul: Math.round(f.ult), uo: f.ultOn && f.castT < 1.2 }; }),
    lim: m.limit, pk: m.pickups.map(q => ({ id: q.id, x: r(q.x), y: r(q.y), k: q.k, l: r(q.life) })), gs: GAME_SPEED,
    p: m.projectiles.map(p => ({ id: p.id, o: p.owner, k: p.kind, st: p.style, ty: p.type, sid: p.sid, x: r(p.x), y: r(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), r: p.r })),
    e: m.effects.map(e => ({ id: e.id, o: e.owner, k: e.kind, st: e.style, ty: e.type, sid: e.sid, x: r(e.x), y: r(e.y), dx: r(e.dx * 100) / 100, dy: r(e.dy * 100) / 100,
      gx: r(e.gx), gy: r(e.gy), t: Math.round(e.t * 100) / 100, d: e.dur })) };
}

/** Opponent brain for AI matches: movement is the autopilot; this decides when to attack. */
export function aiInput(m, side, mem = {}) {
  const me = m.fighters[side], foe = m.fighters[1 - side];
  const d = Math.hypot(foe.x - me.x, foe.y - me.y);
  const reach = { whip: 230, bolt: 430, cone: 230, projectile: 560 }[me.styles.basic] || 500;
  const sst = me.styles.special, inRange = sst === 'cone' ? d < 230 : sst === 'beam' ? d < 600 : d < 480;
  const hard = mem.hard ? 1.6 : mem.level === 'easy' ? 0.55 : mem.level === 'hard' ? 1.45 : 1; // CPU difficulty; mythic wild Monstars fight smarter
  return { mx: 0, my: 0, ax: 0, ay: 0, atk: d < reach && Math.random() < 0.45 * hard, sp: inRange && Math.random() < 0.05 * hard, dash: hard > 1.2 && foe.castT < 0.15 && Math.random() < 0.3,
    guard: me.hurtT > 0.3 && Math.random() < 0.03 * hard, sw: -1 };
}

export { Monstar };
export const applyStatusForTest = applyStatus;
