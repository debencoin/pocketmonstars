// PocketMonstars species, classes and DNA traits.
// Pure ES module: runs in the browser (rendering) and in Node (authoritative server).
// The server derives DNA; this file only turns a DNA hex string into traits and stats.

export const STAT_KEYS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
export const STAT_LABELS = { hp: 'HP', attack: 'Attack', defense: 'Defense', spAttack: 'Sp. Atk', spDefense: 'Sp. Def', speed: 'Speed' };

export const TYPE_CHART = {
  EMBER: ['GROVE', 'FROST'], TIDE: ['EMBER', 'STONE'], GROVE: ['TIDE', 'STONE'], SPARK: ['TIDE'],
  STONE: ['SPARK', 'EMBER'], FROST: ['GROVE'], SHADE: ['ASTRAL'], ASTRAL: ['SHADE'],
};
export function effectiveness(attackType, defendType) {
  if (TYPE_CHART[attackType]?.includes(defendType)) return 1.5;
  if (TYPE_CHART[defendType]?.includes(attackType)) return 0.7;
  return 1;
}

// ---------- Classes ----------
// Each class sets base stats and a combat passive that the authoritative simulation applies.
export class MonstarClass {
  static id = 'base';
  static label = 'Monstar';
  static base = [100, 60, 60, 60, 60, 60];
  static passive = '';
  // Combat modifiers read by shared/sim.mjs
  static mods = { damage: 1, taken: 1, dashCd: 1, specialCd: 1, projectileSpeed: 1, energyRegen: 1, guardTime: 1, knockback: 1, regen: 0 };
}
export class Striker extends MonstarClass {
  static id = 'striker'; static label = 'Striker'; static base = [105, 71, 48, 82, 51, 74];
  static passive = 'Hits 12% harder with every attack.';
  static mods = { ...MonstarClass.mods, damage: 1.12 };
}
export class Warden extends MonstarClass {
  static id = 'warden'; static label = 'Warden'; static base = [125, 61, 79, 74, 72, 56];
  static passive = 'Takes 15% less damage.';
  static mods = { ...MonstarClass.mods, taken: 0.85 };
}
export class Skirmisher extends MonstarClass {
  static id = 'skirmisher'; static label = 'Skirmisher'; static base = [96, 66, 52, 79, 62, 92];
  static passive = 'Dash recharges 35% faster.';
  static mods = { ...MonstarClass.mods, dashCd: 0.65 };
}
export class Ranger extends MonstarClass {
  static id = 'ranger'; static label = 'Ranger'; static base = [90, 70, 47, 86, 54, 99];
  static passive = 'Projectiles fly 25% faster.';
  static mods = { ...MonstarClass.mods, projectileSpeed: 1.25 };
}
export class Mystic extends MonstarClass {
  static id = 'mystic'; static label = 'Mystic'; static base = [99, 55, 54, 97, 71, 79];
  static passive = 'Regenerates energy 30% faster.';
  static mods = { ...MonstarClass.mods, energyRegen: 1.3 };
}
export class Sentinel extends MonstarClass {
  static id = 'sentinel'; static label = 'Sentinel'; static base = [140, 88, 94, 44, 64, 38];
  static passive = 'Guard lasts twice as long.';
  static mods = { ...MonstarClass.mods, guardTime: 2 };
}
export class Arcanist extends MonstarClass {
  static id = 'arcanist'; static label = 'Arcanist'; static base = [108, 52, 61, 93, 83, 65];
  static passive = 'Special recharges 25% faster.';
  static mods = { ...MonstarClass.mods, specialCd: 0.75 };
}
export class Support extends MonstarClass {
  static id = 'support'; static label = 'Support'; static base = [110, 59, 65, 80, 88, 76];
  static passive = 'Slowly regenerates HP (0.8% per second).';
  static mods = { ...MonstarClass.mods, regen: 0.008 };
}
export class Titan extends MonstarClass {
  static id = 'titan'; static label = 'Titan'; static base = [155, 95, 85, 110, 92, 72];
  static passive = 'Immune to knockback.';
  static mods = { ...MonstarClass.mods, knockback: 0 };
}
export const CLASSES = [Striker, Warden, Skirmisher, Ranger, Mystic, Sentinel, Arcanist, Support, Titan];

// ---------- Species (order matches dist/art and the existing game) ----------
export const SPECIES = [
  { id: 0, name: 'Cindercub', type: 'EMBER', art: 'cindercub', cls: Striker, move: 'Ember volley', special: 'Inferno bloom', basicStyle: 'projectile', specialStyle: 'cone', color: '#ec975b' },
  { id: 1, name: 'Mossprout', type: 'GROVE', art: 'mossprout', cls: Warden, move: 'Vine lash', special: 'Ancient roots', basicStyle: 'whip', specialStyle: 'strike', color: '#a7c76d' },
  { id: 2, name: 'Ripplefin', type: 'TIDE', art: 'ripplefin', cls: Skirmisher, move: 'Tidal pulse', special: 'Maelstrom', basicStyle: 'projectile', specialStyle: 'beam', color: '#7dc8d4' },
  { id: 3, name: 'Voltwing', type: 'SPARK', art: 'voltwing', cls: Ranger, move: 'Arc flash', special: 'Thunder crown', basicStyle: 'bolt', specialStyle: 'strike', color: '#e4cc68' },
  { id: 4, name: 'Duskhorn', type: 'SHADE', art: 'duskhorn', cls: Mystic, move: 'Dusk bolt', special: 'Eclipse fall', basicStyle: 'projectile', specialStyle: 'strike', color: '#b8a1d5' },
  { id: 5, name: 'Pebblit', type: 'STONE', art: 'pebblit', cls: Sentinel, move: 'Stone barrage', special: 'Meteor break', basicStyle: 'projectile', specialStyle: 'strike', color: '#bbb19a' },
  { id: 6, name: 'Frostuft', type: 'FROST', art: 'frostuft', cls: Arcanist, move: 'Frost lance', special: 'Polar nova', basicStyle: 'projectile', specialStyle: 'beam', color: '#b8dce8' },
  { id: 7, name: 'Bloomtail', type: 'GROVE', art: 'bloomtail', cls: Support, move: 'Petal storm', special: 'Spring eruption', basicStyle: 'projectile', specialStyle: 'strike', color: '#e5a4b8' },
  { id: 8, name: 'Soloryx', type: 'ASTRAL', art: 'soloryx', cls: Titan, move: 'Solar ray', special: 'Supernova', basicStyle: 'bolt', specialStyle: 'beam', color: '#e9c779' },
];

// ---------- DNA traits ----------
export const RARITIES = [
  { name: 'Common', weight: 600, bonus: 0 }, { name: 'Uncommon', weight: 250, bonus: 2 },
  { name: 'Rare', weight: 100, bonus: 4 }, { name: 'Epic', weight: 40, bonus: 7 }, { name: 'Legendary', weight: 10, bonus: 10 },
];
export const AURAS = ['Jade', 'Amber', 'Rose', 'Azure', 'Violet', 'Opal', 'Obsidian', 'Solar'];
export const PATTERNS = ['Starlit', 'Striped', 'Freckled', 'Crescent', 'Runed', 'Spotted', 'Banded', 'Prism'];
// Each nature boosts one stat by 10% and lowers another by 10% (index into STAT_KEYS, -1 = none).
export const NATURES = [
  { name: 'Bold', up: 2, down: 1 }, { name: 'Serene', up: 4, down: 3 }, { name: 'Swift', up: 5, down: 2 },
  { name: 'Curious', up: 3, down: 1 }, { name: 'Steady', up: 0, down: 5 }, { name: 'Spirited', up: 1, down: 4 },
  { name: 'Fierce', up: 1, down: 2 }, { name: 'Balanced', up: -1, down: -1 },
];

function byteAt(hex, i) { return parseInt(hex.slice(i * 2, i * 2 + 2), 16); }

/** Turn a 64-char DNA hex into visual and stat traits. Deterministic and identical on client and server. */
export function traitsFromDna(dna) {
  if (!/^[a-f0-9]{64}$/.test(dna)) throw Error('DNA must be 64 lowercase hex characters');
  const roll = (byteAt(dna, 0) << 8 | byteAt(dna, 1)) % 1000;
  let acc = 0, rarity = RARITIES[0];
  for (const r of RARITIES) { acc += r.weight; if (roll < acc) { rarity = r; break; } }
  const ivs = STAT_KEYS.map((_, k) => byteAt(dna, 6 + k) % 16); // 0..15 per stat
  return {
    rarity: rarity.name, rarityBonus: rarity.bonus,
    aura: AURAS[byteAt(dna, 2) % AURAS.length],
    pattern: PATTERNS[byteAt(dna, 3) % PATTERNS.length],
    nature: NATURES[byteAt(dna, 4) % NATURES.length].name,
    hue: (byteAt(dna, 5) % 81) - 40, // -40..40 degrees
    markings: 2 + (byteAt(dna, 12) % 4),
    ivs,
  };
}

/** Canonical string of everything a player can see or feel. The registry keeps it UNIQUE. */
export function traitSignature(speciesId, t) {
  return [speciesId, t.rarity, t.aura, t.pattern, t.nature, t.hue, t.markings, t.ivs.join('.')].join('|');
}

/** A specific, owned Monstar: species + class + DNA. */
export class Monstar {
  constructor({ speciesId, dna = null, serial = null, originOwner = null, owner = null, asset = null, level = 1 }) {
    const sp = SPECIES[speciesId];
    if (!sp) throw Error('Unknown species ' + speciesId);
    this.species = sp; this.cls = sp.cls; this.dna = dna; this.serial = serial;
    this.originOwner = originOwner; this.owner = owner; this.asset = asset; this.level = level;
    this.traits = dna ? traitsFromDna(dna) : { rarity: 'Unclaimed', rarityBonus: 0, aura: '—', pattern: '—', nature: 'Balanced', hue: 0, markings: 2, ivs: [0, 0, 0, 0, 0, 0] };
  }
  get type() { return this.species.type; }
  get className() { return this.cls.label; }
  get stats() {
    const nat = NATURES.find(n => n.name === this.traits.nature) || NATURES[7];
    const out = {};
    STAT_KEYS.forEach((k, i) => {
      let v = this.cls.base[i] + this.traits.ivs[i] + this.traits.rarityBonus + (this.level - 1) * (i === 0 ? 5 : 2);
      if (nat.up === i) v *= 1.1;
      if (nat.down === i) v *= 0.9;
      out[k] = Math.round(v);
    });
    return out;
  }
  get displayName() { return this.serial != null ? `${this.species.name} #${this.serial}` : this.species.name; }
  /** Metaplex-style attribute list for NFT metadata. */
  toAttributes() {
    const s = this.stats, t = this.traits;
    return [
      { trait_type: 'Species', value: this.species.name }, { trait_type: 'Type', value: this.type },
      { trait_type: 'Class', value: this.className }, { trait_type: 'Rarity', value: t.rarity },
      { trait_type: 'Aura', value: t.aura }, { trait_type: 'Pattern', value: t.pattern },
      { trait_type: 'Nature', value: t.nature }, { trait_type: 'Hue', value: String(t.hue) },
      ...STAT_KEYS.map(k => ({ trait_type: STAT_LABELS[k], value: String(s[k]) })),
      { trait_type: 'DNA', value: this.dna || '' }, { trait_type: 'Serial', value: String(this.serial ?? '') },
    ];
  }
  toJSON() {
    return { speciesId: this.species.id, name: this.displayName, type: this.type, className: this.className, passive: this.cls.passive,
      dna: this.dna, serial: this.serial, originOwner: this.originOwner, owner: this.owner, asset: this.asset, traits: this.traits, stats: this.stats };
  }
}
