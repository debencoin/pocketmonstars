// Every Monstar has its own five abilities: basic attack, special, dash, guard and a Mega Shot (fired when the
// ULT meter is full). Each slot is built from a mechanic plus tuning taken from the species, so no two species
// share an ability (same mechanic always comes with different numbers) and every full kit is unique.

export const DASH_KINDS = {
  dash: { label: 'Dash', note: 'Fast dash through attacks.' },
  blink: { label: 'Blink', note: 'Teleports a short way instantly.' },
  charge: { label: 'Rush', note: 'Charges forward and slams the rival on contact.' },
  leap: { label: 'Leap', note: 'Jumps over attacks and lands with a shockwave.' },
  shadow: { label: 'Shadow Step', note: 'Appears right behind the rival.' },
  burst: { label: 'Sprint', note: 'Runs much faster for a moment.' },
  trail: { label: 'Trail', note: 'Leaves its type effect on the rival if it passes close.' },
  shock: { label: 'Quake Step', note: 'Knocks the rival back where it lands.' },
  mend: { label: 'Mending Step', note: 'Heals a little while dashing.' },
  phase: { label: 'Phase Shift', note: 'Becomes untouchable for longer.' },
};
export const GUARD_KINDS = {
  shield: { label: 'Ward', note: 'Shield that can block a hit completely.' },
  reflect: { label: 'Mirror Shell', note: 'Sends thrown attacks back at the rival.' },
  counter: { label: 'Riposte', note: 'Strikes back when hit while guarding.' },
  mend: { label: 'Renewal', note: 'Heals while guarding.' },
  thorns: { label: 'Thorn Guard', note: 'Hurts the rival when it hits the guard.' },
  evade: { label: 'Vanish', note: 'Briefly can\'t be touched at all.' },
  absorb: { label: 'Siphon Guard', note: 'Blocked hits charge the ULT meter.' },
  fortress: { label: 'Bastion', note: 'Long, heavy guard; can\'t move.' },
  barrier: { label: 'Repulse', note: 'Blasts the rival away when raised.' },
  mirror: { label: 'Hex Mirror', note: 'Bounces status effects back.' },
};
export const MEGA_KINDS = {
  barrage: { label: 'Barrage', note: 'A fan of seven shots.' },
  nova: { label: 'Nova', note: 'Huge blast all around itself.' },
  meteors: { label: 'Meteor Rain', note: 'Four impacts around the rival.' },
  vortex: { label: 'Vortex', note: 'Drags the rival in, then erupts.' },
  chain: { label: 'Chain Storm', note: 'Three strikes in a row on the rival.' },
  lance: { label: 'Grand Lance', note: 'A giant piercing beam.' },
  freeze: { label: 'Stasis Field', note: 'Erupts under the rival and freezes it.' },
  drain: { label: 'Soul Drain', note: 'A beam that heals by half the damage.' },
  pillars: { label: 'Pillar Line', note: 'Five eruptions in a line toward the rival.' },
  judgment: { label: 'Judgment', note: 'Lifts the rival, then smites it.' },
};
const DK = Object.keys(DASH_KINDS), GK = Object.keys(GUARD_KINDS), MK = Object.keys(MEGA_KINDS);
const TYPE_WORD = { EMBER: 'Flame', TIDE: 'Tide', GROVE: 'Thorn', SPARK: 'Volt', SHADE: 'Shade', STONE: 'Rock', FROST: 'Frost', ASTRAL: 'Star',
  PSYCHIC: 'Mind', VENOM: 'Venom', STEEL: 'Iron', GALE: 'Gale', DRACO: 'Dragon', ANCIENT: 'Elder', WATCHER: 'Seer' };

function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (h, n, k) => Math.floor(h / Math.pow(n, k)) % n;

/** The full kit for a species. `id` keeps it stable; numbers are tuned per species. */
export function kitFor(sp, used = null) {
  const h = hash(sp.name + ':' + sp.id), id = sp.id, r = sp.name;
  const dash = DK[(id + pick(h, 3, 0)) % DK.length];
  const guard = GK[(Math.floor(id / DK.length) + id * 3 + pick(h, 2, 1)) % GK.length];
  let mi = (id * 7 + Math.floor(id / 13)) % MK.length;
  if (used) { while (used.has(dash + guard + MK[mi])) mi = (mi + 1) % MK.length; used.add(dash + guard + MK[mi]); } // no two kits share the same three mechanics
  const mega = MK[mi];
  const t = k => 1 + ((hash(sp.name + '#' + k) % 41) - 20) / 100; // per-species tuning, 0.80-1.20
  const kit = {
    basic: { name: sp.move, power: +(t(1)).toFixed(2), cd: +(1 / t(2) * 0.95 + 0.05).toFixed(2), speed: +t(3).toFixed(2),
      shots: sp.basicStyle === 'projectile' && pick(h, 5, 2) === 0 ? 2 : 1, homing: sp.basicStyle === 'projectile' && pick(h, 4, 3) === 1 },
    special: { name: sp.special, power: +t(4).toFixed(2), cd: +(1 / t(5)).toFixed(2), reach: +t(6).toFixed(2) },
    dash: { kind: dash, name: `${r} ${DASH_KINDS[dash].label}`, note: DASH_KINDS[dash].note, dist: +t(7).toFixed(2), cd: +(1.6 / t(8)).toFixed(2) },
    guard: { kind: guard, name: `${r} ${GUARD_KINDS[guard].label}`, note: GUARD_KINDS[guard].note, time: +t(9).toFixed(2), cd: +(6 / t(10)).toFixed(1) },
    mega: { kind: mega, name: `${r} ${MEGA_KINDS[mega].label}`, note: MEGA_KINDS[mega].note, power: +(t(11) * 1.1).toFixed(2), size: +t(12).toFixed(2) },
  };
  if (used) { // guarantee no two species share the same tuned dash, guard or Mega Shot
    const bump = (key, o, f) => { while (used.has(key())) o[f] = +(o[f] + 0.01).toFixed(2); used.add(key()); };
    bump(() => 'd' + kit.dash.kind + kit.dash.dist + ':' + kit.dash.cd, kit.dash, 'dist');
    bump(() => 'g' + kit.guard.kind + kit.guard.time + ':' + kit.guard.cd, kit.guard, 'time');
    bump(() => 'm' + kit.mega.kind + kit.mega.power + ':' + kit.mega.size, kit.mega, 'size');
  }
  return kit;
}
/** A string that identifies everything about a kit (used to prove kits never repeat). */
export function kitSignature(k) {
  return [k.basic.name, k.basic.power, k.basic.cd, k.special.name, k.special.power, k.dash.kind, k.dash.dist, k.guard.kind, k.guard.time, k.mega.kind, k.mega.power, k.mega.size].join('|');
}
