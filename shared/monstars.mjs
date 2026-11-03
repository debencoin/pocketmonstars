import { kitFor, GUARD_KINDS } from './abilities.mjs';
import { FRONTIER, MYTHIC, ANUNNAKI, WATCHERS, ASCENDANTS, ROYALS, HEROES, BENDERS, LEGEND_HEROES, SKY_BENDERS, FINAL_BENDERS, STARTER_BENDERS, TIERS } from './frontier.mjs';
// PocketMonstars species, classes, evolution stages, EXP and DNA traits.
// Pure ES module: runs in the browser (rendering) and in Node (authoritative server).
// The server derives DNA; this file only turns a DNA hex string into traits and stats.

export const STAT_KEYS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
export const STAT_LABELS = { hp: 'HP', attack: 'Attack', defense: 'Defense', spAttack: 'Sp. Atk', spDefense: 'Sp. Def', speed: 'Speed' };

export const TYPE_CHART = {
  EMBER: ['GROVE', 'FROST'], TIDE: ['EMBER', 'STONE'], GROVE: ['TIDE', 'STONE'], SPARK: ['TIDE'],
  STONE: ['SPARK', 'EMBER', 'GALE'], FROST: ['GROVE', 'DRACO', 'GALE'], SHADE: ['ASTRAL', 'PSYCHIC'], ASTRAL: ['SHADE', 'DRACO'],
  PSYCHIC: ['STONE', 'EMBER', 'VENOM'],
  // Frontier types
  VENOM: ['GROVE', 'TIDE'], STEEL: ['FROST', 'STONE'], GALE: ['GROVE', 'VENOM'], DRACO: ['DRACO', 'STEEL'],
  // Anunnaki and Watcher types
  ANCIENT: ['DRACO', 'STEEL', 'WATCHER'], WATCHER: ['SHADE', 'PSYCHIC', 'ANCIENT'],
};
TYPE_CHART.EMBER.push('STEEL'); TYPE_CHART.SPARK.push('GALE', 'STEEL'); TYPE_CHART.ASTRAL.push('ANCIENT'); TYPE_CHART.SHADE.push('WATCHER');
export function effectiveness(attackType, defendType) {
  if (TYPE_CHART[attackType]?.includes(defendType)) return 1.5;
  if (TYPE_CHART[defendType]?.includes(attackType)) return 0.7;
  return 1;
}

// ---------- Evolution stages ----------
// Every Monstar hatches as an Infant and evolves at levels 3, 10, 25, 50 and 80.
export const STAGES = [
  { id: 0, name: 'Infant', minLevel: 1, scale: 0.6, mult: 1.0 },
  { id: 1, name: 'Rookie', minLevel: 3, scale: 0.72, mult: 1.08 },
  { id: 2, name: 'Champion', minLevel: 10, scale: 0.85, mult: 1.18 },
  { id: 3, name: 'Ultimate', minLevel: 25, scale: 1.0, mult: 1.32 },
  { id: 4, name: 'Mega', minLevel: 50, scale: 1.12, mult: 1.5 },
  { id: 5, name: 'Ascended', minLevel: 80, scale: 1.25, mult: 1.75 },
];
export const MAX_LEVEL = 100;
export function stageFor(level) { let s = STAGES[0]; for (const st of STAGES) if (level >= st.minLevel) s = st; return s; }
/** EXP needed to go from `level` to `level + 1`. */
export function expToNext(level) { return Math.round(12 * Math.pow(level, 1.5)); }
/** Total EXP needed to reach `level` from level 1. */
export function expForLevel(level) { let t = 0; for (let l = 1; l < level; l++) t += expToNext(l); return t; }
export function levelForExp(exp) { let l = 1, need = expToNext(1), left = exp; while (l < MAX_LEVEL && left >= need) { left -= need; l++; need = expToNext(l); } return l; }
/** Progress inside the current level: { level, into, need }. */
export function levelProgress(exp) { const level = levelForExp(exp); return { level, into: exp - expForLevel(level), need: level >= MAX_LEVEL ? 1 : expToNext(level) }; }

// ---------- Classes ----------
// Each class sets base stats and a combat passive that the authoritative simulation applies.
export class MonstarClass {
  static id = 'base';
  static label = 'Monstar';
  static base = [100, 60, 60, 60, 60, 60];
  static passive = '';
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
  static passive = 'Guards last 40% longer and energy refills 20% faster.';
  static mods = { ...MonstarClass.mods, guardTime: 1.4, energyRegen: 1.2 };
}
export class Titan extends MonstarClass {
  static id = 'titan'; static label = 'Titan'; static base = [155, 95, 85, 110, 92, 72];
  static passive = 'Immune to knockback.';
  static mods = { ...MonstarClass.mods, knockback: 0 };
}
// Legendary classes
export class Seraph extends MonstarClass {
  static id = 'seraph'; static label = 'Seraph'; static base = [150, 92, 88, 118, 104, 96];
  static passive = 'Four wings: takes 10% less damage and its special recharges 15% faster.';
  static mods = { ...MonstarClass.mods, taken: 0.9, specialCd: 0.85 };
}
export class Psion extends MonstarClass {
  static id = 'psion'; static label = 'Psion'; static base = [132, 80, 76, 126, 98, 104];
  static passive = 'Levitates: immune to knockback, special recharges 20% faster.';
  static mods = { ...MonstarClass.mods, knockback: 0, specialCd: 0.8, energyRegen: 1.15 };
}
export class Deity extends MonstarClass {
  static id = 'deity'; static label = 'Deity'; static base = [170, 110, 100, 135, 120, 110];
  static passive = 'Divine: immune to knockback and takes 15% less damage.';
  static mods = { ...MonstarClass.mods, knockback: 0, taken: 0.85, specialCd: 0.85 };
}
export const CLASSES = [Striker, Warden, Skirmisher, Ranger, Mystic, Sentinel, Arcanist, Support, Titan, Seraph, Psion, Deity];
const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]));

// ---------- Species ----------
// `motion` is how the Monstar moves on its own when the player isn't steering.
export const COLLECTIONS = {
  genesis: { name: 'Genesis', note: 'The original nine. Every wallet hatches its own version of each.' },
  legendary: { name: 'Legendary', note: 'One-of-a-kind legends held by the founder wallet.' },
  bred: { name: 'Bred', note: 'Infants hatched by breeding two players\' Monstars.' },
  frontier: { name: 'Frontier', note: 'Fifty wild Monstars caught in the Wild Expedition. Rarer ones are stronger.' },
  mythic: { name: 'Mythic', note: 'Three angels and a god. Very rare in the wild and very hard to beat.' },
  anunnaki: { name: 'Anunnaki', note: 'Twenty ancient sky lords, winged genies and guardians from Mesopotamian myth.' },
  royals: { name: 'Royal Anunnaki', note: 'Queen Ninshara and her court: eight legendaries held by the second founder wallet. Never found in the wild.' },
  benders: { name: 'Elemental Benders', note: 'Masters of water, earth, fire, air and thunder. Gifted to chosen players only. Never found in the wild.' },
  legendheroes: { name: 'Legend Heroes', note: 'Fifteen superheroes with their own signature powers, gifted to chosen players. Never found in the wild.' },
  starters: { name: 'Starter Benders', note: 'Every new player starts with one of these five, one per element, picked at random. They also roam the wild.' },
  skybenders: { name: 'Sky Benders', note: 'Air benders. Some are gifted, 25 are sold in the market (each also bends fire, water, earth or thunder), and COVO and COVA bend all five elements.' },
  heroes: { name: 'Superhero Drop', note: 'Thirty original heroes sold once each in the 30-day launch drop. The top five are stronger. Never found in the wild.' },
  ascendants: { name: 'Ascendants', note: 'Twenty legendary portraits held by the founder wallet. Never found in the wild.' },
  watchers: { name: 'Watchers', note: 'Twenty many-eyed, many-winged sentinels of the sky, from the Book of Enoch.' },
};
export const SPECIES = [
  { id: 0, name: 'Cindercub', type: 'EMBER', art: 'cindercub', cls: Striker, move: 'Ember volley', special: 'Inferno bloom', basicStyle: 'projectile', specialStyle: 'cone', motion: 'pounce', collection: 'genesis', color: '#ec975b' },
  { id: 1, name: 'Mossprout', type: 'GROVE', art: 'mossprout', cls: Warden, move: 'Vine lash', special: 'Ancient roots', basicStyle: 'whip', specialStyle: 'strike', motion: 'stomp', collection: 'genesis', color: '#a7c76d' },
  { id: 2, name: 'Ripplefin', type: 'TIDE', art: 'ripplefin', cls: Skirmisher, move: 'Tidal pulse', special: 'Maelstrom', basicStyle: 'projectile', specialStyle: 'beam', motion: 'glide', collection: 'genesis', color: '#7dc8d4' },
  { id: 3, name: 'Voltwing', type: 'SPARK', art: 'voltwing', cls: Ranger, move: 'Arc flash', special: 'Thunder crown', basicStyle: 'bolt', specialStyle: 'strike', motion: 'dart', collection: 'genesis', color: '#e4cc68' },
  { id: 4, name: 'Duskhorn', type: 'SHADE', art: 'duskhorn', cls: Mystic, move: 'Dusk bolt', special: 'Eclipse fall', basicStyle: 'projectile', specialStyle: 'strike', motion: 'blink', collection: 'genesis', color: '#b8a1d5' },
  { id: 5, name: 'Pebblit', type: 'STONE', art: 'pebblit', cls: Sentinel, move: 'Stone barrage', special: 'Meteor break', basicStyle: 'projectile', specialStyle: 'strike', motion: 'stomp', collection: 'genesis', color: '#bbb19a' },
  { id: 6, name: 'Frostuft', type: 'FROST', art: 'frostuft', cls: Arcanist, move: 'Frost lance', special: 'Polar nova', basicStyle: 'projectile', specialStyle: 'beam', motion: 'skate', collection: 'genesis', color: '#b8dce8' },
  { id: 7, name: 'Bloomtail', type: 'GROVE', art: 'bloomtail', cls: Support, move: 'Petal storm', special: 'Spring eruption', basicStyle: 'projectile', specialStyle: 'strike', motion: 'prance', collection: 'genesis', color: '#e5a4b8' },
  { id: 8, name: 'Soloryx', type: 'ASTRAL', art: 'soloryx', cls: Titan, move: 'Solar ray', special: 'Supernova', basicStyle: 'bolt', specialStyle: 'beam', motion: 'charge', collection: 'genesis', color: '#e9c779' },
  { id: 9, name: 'Seraphon', type: 'ASTRAL', art: 'seraphon', cls: Seraph, move: 'Holy lance', special: 'Heaven\'s judgment', basicStyle: 'bolt', specialStyle: 'strike', motion: 'hover', collection: 'legendary', legendary: true, color: '#f4f0ff' },
  { id: 10, name: 'Psyvolt', type: 'PSYCHIC', art: 'psyvolt', cls: Psion, move: 'Psy orb', special: 'Levitation storm', basicStyle: 'projectile', specialStyle: 'levitate', motion: 'hover', collection: 'legendary', legendary: true, color: '#c9a6ff' },
];
for (const [list, coll] of [[FRONTIER, 'frontier'], [MYTHIC, 'mythic'], [ANUNNAKI, 'anunnaki'], [WATCHERS, 'watchers'], [ASCENDANTS, 'ascendants'], [ROYALS, 'royals'], [HEROES, 'heroes'], [BENDERS, 'benders'], [LEGEND_HEROES, 'legendheroes'], [SKY_BENDERS, 'skybenders'], [FINAL_BENDERS, 'skybenders'], [STARTER_BENDERS, 'starters']]) for (const f of list) {
  SPECIES.push({ id: SPECIES.length, name: f.name, type: f.type, art: f.name.toLowerCase(), cls: CLASS_BY_ID[f.cls], move: f.move, special: f.special,
    basicStyle: f.basicStyle, specialStyle: f.specialStyle, motion: f.motion, collection: coll, tier: f.tier, mythic: ['Mythic', 'Divine'].includes(f.tier) || undefined, legendary: f.legendary || undefined, legendFor: f.legendFor, portrait: f.look.plan === 'portrait' || undefined, walker: f.look.plan === 'walker' || undefined, forms: f.forms || (f.look.plan === 'walker' ? walkerForms(f.name) : undefined), hero: f.hero, drop: f.drop, bender: f.bender, elite: f.elite, giftHero: f.giftHero, sky: f.sky, el2: f.el2, female: f.female, unique: f.unique, starter: f.starter, speedBoost: f.speedBoost, sig: f.sig, color: f.look.main });
}
export { TIERS };
/** Ascendants evolve into a different character at every stage, each with its own name. */
function walkerForms(name) { const r = name.replace(/[aeiouy]+[a-z]?$/i, '') || name; return [r + 'kit', r + 'ling', name, name + ' Prime', 'Mega ' + name, 'Ascended ' + name]; }
/** Every other Monstar also becomes a new, differently named character at each stage. */
function stageForms(name) {
  let r = name.split(' ')[0].slice(0, Math.max(3, Math.ceil(name.length * 0.6))).replace(/[aeiouy]+$/i, '');
  while (r.length > 4 && !/[aeiouy]/i.test(r.at(-1)) && !/[aeiouy]/i.test(r.at(-2))) r = r.slice(0, -1);
  if (r.length > 4 && /[bwvqjhcgk]/i.test(r.at(-1)) && /[aeiouy]/i.test(r.at(-2))) r = r.slice(0, -1); // Blazeb -> Blaze, Wavew -> Wave
  return [r + 'kit', r + 'ling', name, name + ' Prime', 'Mega ' + name, 'Ascended ' + name];
}
/** What a Monstar gains each time it evolves (cumulative). Shown in battle when it evolves. */
export const STAGE_PERKS = [null, 'Attack upgrade: +10% attack power', 'Dash upgrade: 25% farther, recharges 20% faster', 'Special upgrade: +20% power and reach, effects last 30% longer', 'Guard upgrade: lasts 40% longer, shield +10%', 'Mega Shot upgrade: +35% power, ULT fills 25% faster'];
/** Name of a species in a given evolution stage (0 Infant ... 5 Ascended). */
export function formName(species, stageId = 2) { return (species.forms ||= stageForms(species.name))[stageId] || species.name; }
{ const used = new Set(); for (const sp of SPECIES) sp.kit = kitFor(sp, used); } // every species gets its own ability kit
// Signature abilities designed for specific Monstars (they replace the generated ones).
const KIT_SIGNATURE = {
  Aerokai: { basic: { name: 'Gale Push', knock: 6, note: 'A wind blast that knocks the rival back as it hits.' },
    special: { name: 'Gust Volley', shots: 3, note: 'Fires 3 or 4 wind-gust balls at once.' },
    mega: { kind: 'tornado', name: 'Aerokai Tornado Gust', note: 'A tornado grabs every rival, spins them up and slams them to the ground (damage), leaving them dazed for your follow-up attacks.', power: 1.2, size: 1 } },
  Tidewen: { special: { name: 'Ice Balls', shots: 2, look: 'ice', status: 'freeze', note: 'Shoots 2 or 3 ice balls; each one that hits freezes the rival.' },
    mega: { kind: 'hailstorm', name: 'Tidewen Hailstorm', note: 'A storm of sharp ice crashes down over a big area: rivals inside are frozen and lose 30% of their HP.', power: 1, size: 1.2 } },
  Granitus: { special: { name: 'Slab Slide', shots: 3, look: 'boulder', note: 'Launches 3 or 4 tall stone slabs that slide out at different angles and speeds.' },
    mega: { kind: 'boulderstorm', name: 'Granitus Boulder Storm', note: 'Boulders rain down over a big area: 3 to 7 can smash the rival, then it is dazed.', power: 1.15, size: 1.2 } },
  Thundrik: { mega: { kind: 'stormdrain', name: 'Thundrik Soul Storm', note: 'Lightning rains down over a big area. 40-50% of the damage it deals comes back to you as HP.', power: 1.2, size: 1.2 } },
  Zephyrine: { mega: { kind: 'tornado', name: 'Zephyrine Cyclone Gust', note: 'A cyclone grabs every rival, spins them up and slams them down (damage), leaving them dazed.', power: 1.15, size: 1.05 } },
};
for (const sp of SPECIES) for (const [part, o] of Object.entries(KIT_SIGNATURE[sp.name] || {})) sp.kit[part] = { ...sp.kit[part], ...o };
const MEGA_SIGNATURE = {
  Tempestro: { kind: 'thunderstrike', name: 'Tempestro Sky Splitter', note: 'Lightning strikes crash down on the rival one after another. The first one stuns it so the rest land.', power: 1.25, size: 1 },
  Neferion: { kind: 'lightning', name: 'Neferion Storm Orbs', note: 'Seven lightning balls chase the rival. The first one to hit stuns it so the rest can zap it.', power: 1.1, size: 1 },
};
for (const sp of SPECIES) if (MEGA_SIGNATURE[sp.name]) sp.kit.mega = { ...sp.kit.mega, ...MEGA_SIGNATURE[sp.name] };
for (const sp of SPECIES) for (const [part, o] of Object.entries(sp.sig || {})) sp.kit[part] = { ...sp.kit[part], ...o }; // Legend Heroes, Sky Benders, COVO and COVA
{ // keep every Mega Shot tuning and every dash/guard/Mega combination one of a kind (signature kits can share a kind)
  const megaKey = k => [k.mega.kind, k.mega.power, k.mega.size].join(), combo = k => k.dash.kind + k.guard.kind + k.mega.kind;
  const megas = new Set(), combos = new Set(), GK = Object.keys(GUARD_KINDS);
  for (const sp of SPECIES) {
    const k = sp.kit;
    if (sp.sig) { while (megas.has(megaKey(k))) k.mega.power = +(k.mega.power + 0.01).toFixed(2);
      for (let i = 0; combos.has(combo(k)) && i < GK.length; i++) { const o = GUARD_KINDS[k.guard.kind].label, g = GK[(GK.indexOf(k.guard.kind) + 1) % GK.length];
        const root = k.guard.name.endsWith(o) ? k.guard.name.slice(0, -o.length).trim() : sp.name;
        k.guard = { ...k.guard, kind: g, name: root + ' ' + GUARD_KINDS[g].label, note: GUARD_KINDS[g].note }; } }
    megas.add(megaKey(k)); combos.add(combo(k));
  }
}
{ const seen = new Set(), names = new Set(SPECIES.map(x => x.name)); for (const sp of SPECIES) { // six uniquely named forms per species
  let f = sp.forms || stageForms(sp.name), n = 0;
  while ((seen.has(f[0]) || seen.has(f[1]) || names.has(f[0]) || names.has(f[1])) && n++ < 6) { const r = sp.name.slice(0, f[0].length - 3 + 1); f = [r + 'kit', r + 'ling', ...f.slice(2)]; }
  sp.forms = f; f.forEach(x => seen.add(x)); } }
export const GENESIS_IDS = SPECIES.filter(s => s.collection === 'genesis').map(s => s.id);
export const FRONTIER_IDS = SPECIES.filter(s => s.collection === 'frontier').map(s => s.id);
export const MYTHIC_IDS = SPECIES.filter(s => s.collection === 'mythic').map(s => s.id);
export const ANUNNAKI_IDS = SPECIES.filter(s => s.collection === 'anunnaki').map(s => s.id);
export const WATCHER_IDS = SPECIES.filter(s => s.collection === 'watchers').map(s => s.id);
// Genesis species roam the wild too, so players can catch the ones they didn't start with.
for (const id of GENESIS_IDS) SPECIES[id].tier = 'Uncommon';
/** Benders roam the wild too: the five Starter Benders (Rare) and the Elemental Benders (Epic; Tempestro stays one of a kind). */
export const STARTER_IDS = SPECIES.filter(s => s.collection === 'starters').map(s => s.id);
for (const id of STARTER_IDS) SPECIES[id].tier = 'Rare';
export const WILD_BENDER_IDS = SPECIES.filter(s => s.collection === 'benders' && !s.elite).map(s => s.id);
for (const id of WILD_BENDER_IDS) SPECIES[id].tier = 'Epic';
export const WILD_IDS = [...GENESIS_IDS, ...FRONTIER_IDS, ...MYTHIC_IDS, ...ANUNNAKI_IDS, ...WATCHER_IDS, ...STARTER_IDS, ...WILD_BENDER_IDS];
/** "Special" wild Monstars (Anunnaki, benders, mythics): always above your level, except a 1% chance of a level 1 one. */
export const isSpecialWild = sp => ['anunnaki', 'benders', 'starters', 'mythic'].includes(sp.collection);
/**
 * Level of a wild Monstar met by a player whose Monstar is level `myLevel`. Always above you: usually 1-3 levels up,
 * sometimes much more. Special ones are always at least 2 up, except a rare (1%) level 1 one. `rand` is () => 0..1.
 */
export function wildLevel(sp, myLevel = 1, rand = Math.random, floor = 1) {
  const extra = Math.min(12, Math.floor(-Math.log(1 - rand() * 0.999) * 1.4)); // 0 most often, a few big jumps
  if (isSpecialWild(sp)) return rand() < 0.01 ? 1 : Math.max(floor, myLevel + 2 + extra + (TIERS[sp.tier]?.lvl > 6 ? 1 : 0));
  return Math.max(floor, myLevel + 1 + extra);
}
/** Weighted random wild species (rarer tiers show up less often). `rand` is 0..1. */
export function rollWild(rand = Math.random()) {
  const total = WILD_IDS.reduce((t, id) => t + TIERS[SPECIES[id].tier].weight / tierCount(SPECIES[id].tier), 0);
  let r = rand * total;
  for (const id of WILD_IDS) { r -= TIERS[SPECIES[id].tier].weight / tierCount(SPECIES[id].tier); if (r <= 0) return id; }
  return WILD_IDS[0];
}
const _tc = {}; function tierCount(t) { return (_tc[t] ??= WILD_IDS.filter(id => SPECIES[id].tier === t).length); }
for (const s of SPECIES) if (s.legendary) s.legendFor ||= 'founder';
export const LEGENDARY_IDS = SPECIES.filter(s => s.legendary).map(s => s.id);
export const HERO_IDS = SPECIES.filter(s => s.hero).map(s => s.id);
/** Species sold once each for SOL: the drop heroes (time-limited) and the market Sky Benders (no time limit). */
export const SALE_IDS = SPECIES.filter(s => s.drop).map(s => s.id);
export const SHOP_IDS = SPECIES.filter(s => s.drop?.shop).map(s => s.id);
/** Legendary species held by each founder wallet ('founder' = first wallet, 'royal' = second). */
export const legendaryIdsFor = key => SPECIES.filter(s => s.legendary && s.legendFor === key).map(s => s.id);
/** File name of a species' NFT / market picture in dist/art/nft (portraits are .jpg). */
export const nftArt = sp => sp.art + (sp.portrait ? '.jpg' : '.png');

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
export function rarityIndex(name) { return Math.max(0, RARITIES.findIndex(r => r.name === name)); }

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
    // Guard shield strength (55-98%): the chance a guarded hit is blocked completely. Comes from the wallet-derived DNA, so every Monstar's shield is different.
    shield: 55 + (byteAt(dna, 13) % 44),
    ivs,
  };
}

/** Build a DNA string that decodes to the given rarity and stat rolls (used for breeding and legendaries). */
export function composeDna(baseHex, { rarity, ivs }) {
  const bytes = baseHex.match(/../g).map(h => parseInt(h, 16));
  if (rarity) {
    const idx = rarityIndex(rarity); let lo = 0; for (let i = 0; i < idx; i++) lo += RARITIES[i].weight;
    const roll = lo + (bytes[0] % RARITIES[idx].weight); // any value inside the rarity's band
    bytes[0] = (roll >> 8) & 0xff; bytes[1] = roll & 0xff;
  }
  if (ivs) ivs.forEach((v, k) => { bytes[6 + k] = (bytes[6 + k] & 0xf0) | (v & 0x0f); });
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Canonical string of everything a player can see or feel. The registry keeps it UNIQUE. */
export function traitSignature(speciesId, t) {
  return [speciesId, t.rarity, t.aura, t.pattern, t.nature, t.hue, t.markings, t.ivs.join('.')].join('|');
}

/** A specific, owned Monstar: species + class + DNA + level. */
export class Monstar {
  constructor({ speciesId, dna = null, serial = null, originOwner = null, owner = null, asset = null, level = null, exp = 0, collection = null, parents = null, fusion = null }) {
    const sp = SPECIES[speciesId];
    if (!sp) throw Error('Unknown species ' + speciesId);
    this.species = sp; this.cls = sp.cls; this.dna = dna; this.serial = serial;
    this.originOwner = originOwner; this.owner = owner; this.asset = asset;
    this.exp = Math.max(0, Math.floor(exp || 0));
    this.level = level ?? levelForExp(this.exp);
    if (level != null && this.exp < expForLevel(level)) this.exp = expForLevel(level);
    this.collection = collection || sp.collection; this.parents = parents;
    this.fusion = fusion != null && SPECIES[fusion] && fusion !== speciesId ? fusion : null; // bred benders carry the other parent's powers
    this.traits = dna ? traitsFromDna(dna) : { rarity: 'Unclaimed', rarityBonus: 0, aura: '—', pattern: '—', nature: 'Balanced', hue: 0, markings: 2, ivs: [0, 0, 0, 0, 0, 0] };
  }
  get type() { return this.species.type; }
  /** Ability kit. A bred bender combines both parents: its own attack, the other parent's special and (if that parent is a bender) its Mega Shot, all a bit stronger. */
  get kit() {
    if (!this.fusion) return this.species.kit;
    const own = this.species.kit, o = SPECIES[this.fusion], ok = o.kit;
    return { ...own, fused: o.name, special: { ...ok.special, power: +(ok.special.power * 1.15).toFixed(2), name: `Fused ${ok.special.name}` },
      mega: o.bender && !o.unique ? { ...ok.mega, power: +(Math.max(ok.mega.power, own.mega.power) * 1.15).toFixed(2), name: `${this.species.name} × ${o.name} ${ok.mega.name.split(' ').slice(1).join(' ')}` } : own.mega };
  }
  get specialStyle() { return this.fusion ? SPECIES[this.fusion].specialStyle : this.species.specialStyle; }
  get className() { return this.cls.label; }
  get stage() { return stageFor(this.level); }
  get stats() { return statsAt(this, this.level); }
  get displayName() { return this.serial != null ? `${this.species.name} #${this.serial}` : this.species.name; }
  /** Metaplex-style attribute list for NFT metadata. */
  toAttributes() {
    const s = this.stats, t = this.traits;
    return [
      { trait_type: 'Species', value: this.species.name }, { trait_type: 'Type', value: this.type },
      { trait_type: 'Class', value: this.className }, { trait_type: 'Rarity', value: t.rarity },
      { trait_type: 'Collection', value: COLLECTIONS[this.collection]?.name || this.collection },
      { trait_type: 'Stage', value: this.stage.name }, { trait_type: 'Level', value: String(this.level) },
      { trait_type: 'Aura', value: t.aura }, { trait_type: 'Pattern', value: t.pattern },
      { trait_type: 'Nature', value: t.nature }, { trait_type: 'Hue', value: String(t.hue) },
      ...STAT_KEYS.map(k => ({ trait_type: STAT_LABELS[k], value: String(s[k]) })),
      { trait_type: 'DNA', value: this.dna || '' }, { trait_type: 'Serial', value: String(this.serial ?? '') },
    ];
  }
  toJSON() {
    const p = levelProgress(this.exp);
    return { fusion: this.fusion, fusedWith: this.fusion != null ? SPECIES[this.fusion].name : null, form: formName(this.species, this.stage.id), speciesId: this.species.id, tier: this.species.tier || null, name: this.displayName, type: this.type, className: this.className, passive: this.cls.passive,
      dna: this.dna, serial: this.serial, originOwner: this.originOwner, owner: this.owner, asset: this.asset, traits: this.traits, stats: this.stats,
      level: this.level, exp: this.exp, expInto: p.into, expNeed: p.need, stage: this.stage.name, stageId: this.stage.id,
      collection: this.collection, legendary: !!this.species.legendary, parents: this.parents };
  }
}

/** Stats for a Monstar at any level: base + DNA rolls, grown by level and evolution stage, shaped by nature. */
export function statsAt(m, level) {
  const nat = NATURES.find(n => n.name === m.traits.nature) || NATURES[7];
  const elite = m.species.starter ? 1.2 : m.species.bender ? (m.species.elite ? 1.8 : 1.55) : m.species.giftHero ? 1.45 : m.species.legendary ? 1.2 : m.species.drop ? (m.species.drop.top ? 1.25 : 1.15) : 1; // founder legendaries: elite Infants, 20% stronger at every level
  const st = stageFor(level), growth = (1 + (level - 1) * 0.03) * (m.species.bender ? 1 : TIERS[m.species.tier]?.mult || 1) * elite; // benders' wild tier only sets how often they show up // rarer wild species are stronger
  const out = {};
  STAT_KEYS.forEach((k, i) => {
    let v = (m.cls.base[i] + m.traits.ivs[i] + m.traits.rarityBonus) * growth * st.mult;
    if (nat.up === i) v *= 1.1;
    if (nat.down === i) v *= 0.9;
    if (k === 'speed' && m.species.speedBoost) v *= m.species.speedBoost; // COVO and COVA are very fast
    out[k] = Math.round(v);
  });
  return out;
}
