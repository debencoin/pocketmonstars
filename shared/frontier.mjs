// Frontier collection: 50 original Monstars (ids 11-60). Pure data, shared by the game, the server and
// the sprite generator (scripts/make_frontier.py reads `look` to draw each one).
// plan = body plan; main/belly/accent = colours; the rest are drawn features.
const F = (name, type, cls, move, special, basicStyle, specialStyle, motion, plan, main, belly, accent, look = {}) =>
  ({ name, type, cls, move, special, basicStyle, specialStyle, motion, look: { plan, main, belly, accent, ...look } });

export const FRONTIER = [
  // EMBER
  F('Blazebuck', 'EMBER', 'titan', 'Cinder kick', 'Wildfire stampede', 'projectile', 'cone', 'charge', 'quad', '#d8642c', '#f6d2a0', '#ffd23f', { horns: 'antlers', tail: 'flame', back: 'mane', ears: 'pointy' }),
  F('Cinderwyrm', 'EMBER', 'mystic', 'Ash spit', 'Magma coil', 'projectile', 'cone', 'glide', 'serpent', '#c8402c', '#f8c070', '#ffb030', { back: 'spikes', horns: 'two' }),
  F('Pyrofinch', 'EMBER', 'ranger', 'Spark feather', 'Phoenix dive', 'projectile', 'strike', 'dart', 'bird', '#f0782c', '#ffe0a0', '#ffd23f', { crest: 'flame', tail: 'flame' }),
  F('Magmole', 'EMBER', 'sentinel', 'Lava glob', 'Eruption', 'projectile', 'strike', 'prance', 'blob', '#a8381e', '#f89a3a', '#ffd23f', { top: 'flame', pattern: 'cracks' }),
  F('Emberjack', 'EMBER', 'striker', 'Flare bite', 'Blaze rush', 'projectile', 'cone', 'pounce', 'quad', '#b8481e', '#f0c080', '#ffcf40', { ears: 'long', tail: 'flame', pattern: 'stripes' }),
  // TIDE
  F('Coralisk', 'TIDE', 'warden', 'Reef shard', 'Coral tide', 'projectile', 'beam', 'glide', 'quad', '#2a8ac8', '#bfe8f4', '#ff8aa8', { back: 'coral', tail: 'fin', ears: 'fins' }),
  F('Bubblyn', 'TIDE', 'support', 'Bubble burst', 'Rain dance', 'projectile', 'strike', 'prance', 'blob', '#5ec2ff', '#dff6ff', '#ffffff', { top: 'droplet', pattern: 'bubbles' }),
  F('Clawtide', 'TIDE', 'sentinel', 'Pincer snap', 'Riptide crush', 'whip', 'strike', 'skate', 'bug', '#d84a3a', '#f8c8a8', '#2b7be0', { claws: true, legs: 'crab' }),
  F('Abyssquid', 'TIDE', 'arcanist', 'Ink jet', 'Deep vortex', 'projectile', 'beam', 'hover', 'floater', '#3a3aa8', '#a8b8ff', '#5ef0ff', { tentacles: 8, pattern: 'spots' }),
  F('Wavewing', 'TIDE', 'skirmisher', 'Spray dart', 'Tsunami glide', 'projectile', 'beam', 'dart', 'bird', '#2b7be0', '#e0f6ff', '#ffffff', { crest: 'wave', tail: 'fork' }),
  // GROVE
  F('Thornox', 'GROVE', 'titan', 'Bramble horn', 'Forest quake', 'whip', 'strike', 'charge', 'quad', '#4f8a3a', '#d8e8a8', '#a86a3a', { horns: 'curved', back: 'leaves', tail: 'leaf' }),
  F('Fernling', 'GROVE', 'support', 'Leaf toss', 'Overgrowth', 'projectile', 'strike', 'prance', 'plant', '#5fbf3a', '#f0f8c8', '#ff9cc2', { top: 'fern' }),
  F('Mantiseed', 'GROVE', 'striker', 'Scythe leaf', 'Harvest storm', 'whip', 'strike', 'dart', 'bug', '#7ac84a', '#e0f8b0', '#f0e060', { claws: 'scythe', wings: true, antennae: true }),
  F('Acornaut', 'GROVE', 'sentinel', 'Nut shot', 'Oak fortress', 'projectile', 'strike', 'stomp', 'golem', '#8a5a2e', '#e8c890', '#5fbf3a', { top: 'acorn', back: 'leaves' }),
  F('Lilypadra', 'GROVE', 'mystic', 'Lily spin', 'Pond bloom', 'projectile', 'beam', 'prance', 'biped', '#3aa86a', '#f0f8d0', '#ff9cc2', { top: 'lily', ears: 'none', tail: 'none' }),
  // SPARK
  F('Zapurr', 'SPARK', 'skirmisher', 'Static paw', 'Thunder pounce', 'bolt', 'strike', 'pounce', 'quad', '#f0c830', '#fff4c0', '#4a3a8a', { ears: 'pointy', tail: 'bolt', pattern: 'stripes' }),
  F('Ohmoth', 'SPARK', 'mystic', 'Dust spark', 'Storm wings', 'bolt', 'beam', 'hover', 'bug', '#e8d040', '#fff8d0', '#6a5ad8', { wings: 'moth', antennae: true, pattern: 'eyes' }),
  F('Voltusk', 'SPARK', 'titan', 'Charge gore', 'Megavolt crash', 'bolt', 'strike', 'charge', 'quad', '#c8a020', '#f8e8a0', '#3a8ae0', { horns: 'tusks', back: 'spikes', tail: 'bolt' }),
  F('Joltail', 'SPARK', 'ranger', 'Shock whip', 'Coil current', 'bolt', 'beam', 'glide', 'serpent', '#2a5ac8', '#fff4a0', '#ffe14a', { back: 'fins', pattern: 'stripes' }),
  // SHADE
  F('Gloomwisp', 'SHADE', 'mystic', 'Wisp flame', 'Night veil', 'projectile', 'strike', 'blink', 'floater', '#5a3aa8', '#c8b0ff', '#7af0ff', { tentacles: 3, top: 'wisp' }),
  F('Nocturrow', 'SHADE', 'ranger', 'Hush feather', 'Moonless dive', 'projectile', 'strike', 'dart', 'bird', '#3a2e6a', '#b8a8d8', '#ffd23f', { crest: 'tufts', eyes: 'big' }),
  F('Shadefang', 'SHADE', 'striker', 'Shadow bite', 'Eclipse howl', 'projectile', 'strike', 'pounce', 'quad', '#2e2448', '#8a7ab0', '#e04a8a', { ears: 'pointy', tail: 'bushy', back: 'mane' }),
  F('Hexmask', 'SHADE', 'arcanist', 'Curse orb', 'Hex circle', 'projectile', 'strike', 'blink', 'golem', '#4a3a6a', '#e8e0f0', '#b040e0', { top: 'mask', pattern: 'runes' }),
  // STONE
  F('Quarrox', 'STONE', 'sentinel', 'Boulder fist', 'Landslide', 'projectile', 'strike', 'stomp', 'golem', '#8f7a5a', '#c8b088', '#58c8e8', { top: 'crystals', back: 'crystals' }),
  F('Fossilith', 'STONE', 'titan', 'Bone club', 'Fossil quake', 'whip', 'strike', 'stomp', 'biped', '#b8a888', '#efe2c0', '#7a5a3a', { back: 'plates', tail: 'club', horns: 'one' }),
  F('Geodillo', 'STONE', 'warden', 'Rollout', 'Geode burst', 'projectile', 'strike', 'charge', 'quad', '#7a6a58', '#d8c8a8', '#c060e0', { back: 'shell', ears: 'round', tail: 'spike' }),
  F('Cragcrab', 'STONE', 'warden', 'Rock pinch', 'Cliff crush', 'whip', 'strike', 'skate', 'bug', '#6e665c', '#b0a690', '#e0a040', { claws: true, legs: 'crab', top: 'crystals' }),
  // FROST
  F('Glacielk', 'FROST', 'titan', 'Ice antler', 'Glacier charge', 'projectile', 'beam', 'charge', 'quad', '#9be6ff', '#ffffff', '#4ab0e0', { horns: 'antlers', back: 'crystals', ears: 'pointy' }),
  F('Snowpuff', 'FROST', 'support', 'Snowball', 'Blizzard hug', 'projectile', 'strike', 'prance', 'blob', '#eef8ff', '#ffffff', '#7ac8f0', { top: 'snow', pattern: 'flakes' }),
  F('Icicrow', 'FROST', 'ranger', 'Hail peck', 'Frozen gale', 'projectile', 'beam', 'dart', 'bird', '#5a8ac8', '#dff8ff', '#bfefff', { crest: 'icicles', tail: 'fork' }),
  F('Rimewyrm', 'FROST', 'arcanist', 'Frost breath', 'Absolute zero', 'projectile', 'beam', 'glide', 'serpent', '#bfe8ff', '#ffffff', '#4a90e0', { back: 'crystals', horns: 'two' }),
  // ASTRAL
  F('Cometail', 'ASTRAL', 'skirmisher', 'Star shot', 'Comet trail', 'bolt', 'beam', 'pounce', 'quad', '#2a2a6a', '#ffe8a0', '#ffd23f', { ears: 'long', tail: 'comet', pattern: 'stars' }),
  F('Lunaroo', 'ASTRAL', 'striker', 'Moon kick', 'Lunar leap', 'bolt', 'strike', 'pounce', 'biped', '#c8c8f0', '#ffffff', '#ffd97a', { ears: 'long', tail: 'thick', top: 'moon' }),
  F('Orbitron', 'ASTRAL', 'arcanist', 'Orbit ray', 'Gravity well', 'bolt', 'beam', 'hover', 'floater', '#f0a030', '#fff3c4', '#4a3aa8', { tentacles: 0, top: 'rings' }),
  // PSYCHIC
  F('Mindmoth', 'PSYCHIC', 'mystic', 'Mind dust', 'Dream wings', 'projectile', 'beam', 'hover', 'bug', '#c08cff', '#f0e0ff', '#ff9cc2', { wings: 'moth', antennae: true, pattern: 'eyes' }),
  F('Oracub', 'PSYCHIC', 'arcanist', 'Foresight', 'Third eye', 'projectile', 'beam', 'blink', 'biped', '#e0a8f0', '#fff0ff', '#8a4ae0', { ears: 'round', top: 'gem', tail: 'thick' }),
  F('Prismeye', 'PSYCHIC', 'mystic', 'Prism beam', 'Kaleidoscope', 'projectile', 'beam', 'hover', 'floater', '#8a4ae0', '#ead8ff', '#7af0ff', { tentacles: 0, eyes: 'cyclops', top: 'shards' }),
  // VENOM (new type)
  F('Toxitoad', 'VENOM', 'warden', 'Sludge spit', 'Toxic flood', 'projectile', 'cone', 'pounce', 'biped', '#7a3ab0', '#d8f0a0', '#9ad040', { ears: 'none', tail: 'none', pattern: 'spots', eyes: 'big' }),
  F('Mycospore', 'VENOM', 'support', 'Spore puff', 'Fungal bloom', 'projectile', 'strike', 'prance', 'plant', '#b04a8a', '#f8e8d8', '#c8f070', { top: 'mushroom', pattern: 'spots' }),
  F('Stingrex', 'VENOM', 'striker', 'Venom sting', 'Neurotoxin', 'whip', 'cone', 'skate', 'bug', '#5a2a7a', '#c8f070', '#e04a8a', { claws: true, tail: 'stinger', legs: 'crab' }),
  F('Viperoot', 'VENOM', 'ranger', 'Fang dart', 'Poison coil', 'projectile', 'cone', 'glide', 'serpent', '#4a8a2a', '#f0e080', '#7a3ab0', { back: 'leaves', pattern: 'diamonds' }),
  // STEEL (new type)
  F('Gearhound', 'STEEL', 'skirmisher', 'Gear toss', 'Overdrive', 'projectile', 'beam', 'pounce', 'quad', '#8a96aa', '#d8e0ec', '#ff9a3a', { ears: 'pointy', tail: 'gear', pattern: 'rivets' }),
  F('Rivetbot', 'STEEL', 'sentinel', 'Rivet gun', 'Iron press', 'projectile', 'strike', 'stomp', 'golem', '#6a7890', '#c8d0dc', '#48d0ff', { top: 'antenna', pattern: 'rivets' }),
  F('Bladewing', 'STEEL', 'striker', 'Razor quill', 'Steel cyclone', 'projectile', 'beam', 'dart', 'bird', '#a8b4c8', '#eef2f8', '#e04a4a', { crest: 'blades', tail: 'fork' }),
  F('Ironshell', 'STEEL', 'warden', 'Horn ram', 'Fortress shell', 'whip', 'strike', 'stomp', 'bug', '#4a5a78', '#a8b4c8', '#ffd23f', { horns: 'one', legs: 'six', pattern: 'rivets' }),
  // GALE (new type)
  F('Zephyrkit', 'GALE', 'skirmisher', 'Gust swipe', 'Tailwind', 'projectile', 'beam', 'pounce', 'quad', '#a8f0d8', '#ffffff', '#58c8a8', { ears: 'long', tail: 'swirl', back: 'mane' }),
  F('Galeon', 'GALE', 'ranger', 'Air slash', 'Hurricane', 'projectile', 'beam', 'dart', 'bird', '#58c8a8', '#e8fff4', '#2a6a8a', { crest: 'long', tail: 'long' }),
  F('Whirlwisp', 'GALE', 'mystic', 'Twister', 'Cyclone eye', 'projectile', 'beam', 'hover', 'floater', '#c8f8e8', '#ffffff', '#58c8a8', { tentacles: 3, top: 'swirl' }),
  // DRACO (new type)
  F('Drakelet', 'DRACO', 'striker', 'Dragon ember', 'Draco blaze', 'projectile', 'cone', 'stomp', 'biped', '#e85a5a', '#ffe0b0', '#8a2ab0', { horns: 'two', wings: true, tail: 'spike', back: 'spikes' }),
  F('Skyrex', 'DRACO', 'titan', 'Sky claw', 'Meteor roar', 'projectile', 'strike', 'charge', 'biped', '#5a3ab0', '#f0d8ff', '#ffd23f', { horns: 'curved', wings: true, tail: 'thick', back: 'plates' }),
];

// Mythic wild encounters: three angels and one god. Very rare, very strong, hard to catch.
export const MYTHIC = [
  F('Aurielle', 'ASTRAL', 'seraph', 'Dawn lance', 'Solar choir', 'bolt', 'beam', 'hover', 'angel', '#fff3c4', '#ffffff', '#ffd23f', { wings: 2, robe: '#f0a030', weapon: 'staff' }),
  F('Valkyra', 'STEEL', 'seraph', 'Blade of dawn', 'Judgment wings', 'whip', 'strike', 'hover', 'angel', '#d8e0ec', '#ffffff', '#e04a4a', { wings: 4, robe: '#4a5a78', weapon: 'sword' }),
  F('Nimbiel', 'GALE', 'seraph', 'Feather gale', 'Heaven\'s breath', 'projectile', 'beam', 'hover', 'angel', '#e8fff4', '#ffffff', '#58c8a8', { wings: 2, robe: '#58c8a8', weapon: 'none', small: true }),
  F('Aeonox', 'ASTRAL', 'deity', 'Creation ray', 'Genesis judgment', 'bolt', 'strike', 'hover', 'god', '#fff8e0', '#ffffff', '#ffd23f', { wings: 6 }),
];

// Anunnaki collection: 20 Monstars inspired by the Anunnaki of ancient Mesopotamian myth
// (sky lords, winged genies, bull-men guardians, fish-cloaked sages, storm and chaos dragons).
export const ANUNNAKI = [
  F('Anuvax', 'ANCIENT', 'deity', 'Sky decree', 'Heaven\'s tablet', 'bolt', 'beam', 'hover', 'god', '#ffd97a', '#ffffff', '#2a4ab0', { wings: 4, crown: 'horned' }),
  F('Enlilor', 'GALE', 'seraph', 'Wind edict', 'Great storm', 'projectile', 'beam', 'hover', 'genie', '#e0d0a0', '#fff6e0', '#2a4ab0', { head: 'human', wings: 4, crown: 'horned' }),
  F('Enkiryn', 'TIDE', 'arcanist', 'Abzu spring', 'Deep waters', 'projectile', 'beam', 'glide', 'fishman', '#3a8ac8', '#f0e0c0', '#ffd23f', { crown: 'horned' }),
  F('Inannox', 'ASTRAL', 'striker', 'Morning star', 'Descent of light', 'bolt', 'strike', 'pounce', 'genie', '#f0a8c8', '#fff0f6', '#ffd23f', { head: 'human', wings: 2, crown: 'star' }),
  F('Utuflare', 'EMBER', 'titan', 'Sun saw', 'Noon judgment', 'projectile', 'cone', 'charge', 'lamassu', '#f0a030', '#fff0c0', '#ff6a1f', { crown: 'sun' }),
  F('Nannamoth', 'ASTRAL', 'mystic', 'Crescent dust', 'Moon tide', 'projectile', 'beam', 'hover', 'bug', '#a8b8f0', '#f0f4ff', '#ffd97a', { wings: 'moth', antennae: true, pattern: 'stars' }),
  F('Marduzar', 'SPARK', 'titan', 'Storm mace', 'Fifty names', 'bolt', 'strike', 'stomp', 'genie', '#3a5ab0', '#f0e0c0', '#ffe14a', { head: 'human', wings: 2, crown: 'horned', weapon: 'bolt' }),
  F('Tiamaw', 'DRACO', 'arcanist', 'Chaos bite', 'Primordial sea', 'projectile', 'beam', 'glide', 'serpent', '#2a6a7a', '#c8f0e0', '#c040e0', { back: 'spikes', horns: 'curved' }),
  F('Ninhurra', 'GROVE', 'support', 'Mountain bloom', 'Mother earth', 'whip', 'strike', 'prance', 'plant', '#6a9a3a', '#f8f0d0', '#c89a40', { top: 'lily' }),
  F('Lamassor', 'STONE', 'sentinel', 'Gate stomp', 'Palace guard', 'projectile', 'strike', 'stomp', 'lamassu', '#c8b090', '#f0e6d0', '#2a4ab0', { crown: 'horned' }),
  F('Shedulon', 'STEEL', 'warden', 'Bronze hoof', 'Threshold ward', 'whip', 'strike', 'stomp', 'lamassu', '#b0884a', '#f0d8a8', '#3a8ac8', { crown: 'cap' }),
  F('Apkalith', 'TIDE', 'support', 'Sage blessing', 'Seven sages', 'projectile', 'beam', 'stomp', 'fishman', '#5aa8c8', '#e8e0c8', '#c89a40', { crown: 'none' }),
  F('Anzurok', 'GALE', 'ranger', 'Talon gust', 'Tablet theft', 'projectile', 'beam', 'dart', 'bird', '#8a5a2e', '#f0d8a8', '#e04a2a', { crest: 'long', tail: 'fork', head: 'lion' }),
  F('Humbaroth', 'GROVE', 'sentinel', 'Cedar roar', 'Forest warden', 'whip', 'strike', 'stomp', 'golem', '#6a7a3a', '#c8b888', '#e04a2a', { top: 'mask', back: 'leaves' }),
  F('Pazuzar', 'SHADE', 'mystic', 'Plague wind', 'Southwest gale', 'projectile', 'cone', 'hover', 'genie', '#5a4a3a', '#c8b898', '#a040e0', { head: 'beast', wings: 4, crown: 'horned' }),
  F('Mushussar', 'DRACO', 'striker', 'Serpent claw', 'Gate of Ishtar', 'projectile', 'cone', 'pounce', 'quad', '#2a5ab0', '#ffd97a', '#ffd23f', { horns: 'curved', tail: 'spike', back: 'plates', pattern: 'diamonds', ears: 'none' }),
  F('Nergalith', 'VENOM', 'striker', 'Fever touch', 'Underworld plague', 'projectile', 'cone', 'stomp', 'biped', '#6a3a2a', '#d8c0a0', '#9ad040', { horns: 'two', tail: 'thick', pattern: 'spots' }),
  F('Ereshkyl', 'SHADE', 'arcanist', 'Seven gates', 'Land of no return', 'projectile', 'strike', 'blink', 'floater', '#2a1e3a', '#8a7ab0', '#c89a40', { tentacles: 4, top: 'wisp' }),
  F('Nabuscribe', 'PSYCHIC', 'arcanist', 'Clay tablet', 'Written fate', 'projectile', 'beam', 'blink', 'genie', '#c8a878', '#fff0d8', '#8a4ae0', { head: 'human', wings: 2, crown: 'cap', weapon: 'tablet' }),
  F('Ziggurok', 'ANCIENT', 'sentinel', 'Brick toss', 'Temple rise', 'projectile', 'strike', 'stomp', 'golem', '#c8a060', '#f0dcb0', '#2a4ab0', { top: 'ziggurat' }),
];

// Watchers collection: 20 Monstars inspired by the Watchers (Grigori) of the Book of Enoch:
// many-eyed, many-winged sky sentinels, fallen teachers of the stars, and their giant offspring.
export const WATCHERS = [
  F('Semyazar', 'WATCHER', 'deity', 'Oath of Hermon', 'Two hundred eyes', 'bolt', 'beam', 'hover', 'ophan', '#f0e8ff', '#ffffff', '#ffd23f', { rings: 3 }),
  F('Azazelith', 'SHADE', 'seraph', 'Forged blade', 'Desert exile', 'whip', 'strike', 'hover', 'angel', '#4a3a5a', '#d8c8e0', '#ff6a1f', { wings: 4, robe: '#2a1e3a', weapon: 'sword', fallen: true }),
  F('Armarok', 'PSYCHIC', 'mystic', 'Spell knot', 'Enchantment', 'projectile', 'beam', 'hover', 'angel', '#c8b0f0', '#ffffff', '#8a4ae0', { wings: 2, robe: '#6a4ab0', weapon: 'staff' }),
  F('Baraqion', 'SPARK', 'ranger', 'Lightning sign', 'Storm reading', 'bolt', 'strike', 'hover', 'angel', '#f0e0a0', '#ffffff', '#ffe14a', { wings: 4, robe: '#3a5ab0', weapon: 'bolt' }),
  F('Kokabyx', 'ASTRAL', 'arcanist', 'Star chart', 'Constellation', 'bolt', 'beam', 'hover', 'seer', '#2a2a6a', '#e0e0ff', '#ffd23f', { eyes: 7, wings: 2 }),
  F('Tamiren', 'WATCHER', 'skirmisher', 'Vigil strike', 'Night watch', 'projectile', 'strike', 'hover', 'angel', '#b0b8d8', '#ffffff', '#48d0ff', { wings: 2, robe: '#4a5a78', weapon: 'none' }),
  F('Ramielon', 'WATCHER', 'titan', 'Thunder gaze', 'Mercy of god', 'bolt', 'strike', 'hover', 'ophan', '#d8e0ff', '#ffffff', '#ffe14a', { rings: 2 }),
  F('Danelith', 'PSYCHIC', 'support', 'Omen', 'Judgment sign', 'projectile', 'beam', 'blink', 'seer', '#8a6ab0', '#f0e8ff', '#ffd23f', { eyes: 5, wings: 4 }),
  F('Ezeqor', 'GALE', 'skirmisher', 'Cloud lore', 'Sky veil', 'projectile', 'beam', 'hover', 'seer', '#c8e8f0', '#ffffff', '#58c8a8', { eyes: 3, wings: 2 }),
  F('Sarielle', 'ASTRAL', 'seraph', 'Moon course', 'Lunar law', 'bolt', 'beam', 'hover', 'angel', '#e8e8ff', '#ffffff', '#a8b8f0', { wings: 4, robe: '#a8b8f0', weapon: 'staff' }),
  F('Shamsor', 'EMBER', 'striker', 'Sun sign', 'Solar witness', 'projectile', 'cone', 'hover', 'ophan', '#ffd97a', '#fff6c0', '#ff6a1f', { rings: 2 }),
  F('Arakor', 'STONE', 'warden', 'Earth sign', 'Ground truth', 'projectile', 'strike', 'stomp', 'golem', '#7a6a58', '#c8b8a0', '#c8a0ff', { top: 'eye', pattern: 'runes' }),
  F('Penemyr', 'PSYCHIC', 'mystic', 'Ink and reed', 'Bitter knowledge', 'projectile', 'beam', 'blink', 'seer', '#5a4a3a', '#e8d8c0', '#8a4ae0', { eyes: 3, wings: 2 }),
  F('Nephilox', 'STONE', 'titan', 'Giant fist', 'Earthshaker', 'projectile', 'strike', 'stomp', 'biped', '#a87858', '#e8c8a8', '#4a3a6a', { horns: 'one', tail: 'none', ears: 'none', giant: true }),
  F('Grigoran', 'WATCHER', 'warden', 'Sentinel light', 'Watcher\'s wall', 'projectile', 'strike', 'hover', 'angel', '#c8c8d8', '#ffffff', '#ffd23f', { wings: 2, robe: '#6a6a8a', weapon: 'sword' }),
  F('Ophanex', 'WATCHER', 'arcanist', 'Wheel spin', 'Wheels within wheels', 'projectile', 'beam', 'hover', 'ophan', '#c8a860', '#fff0d0', '#48d0ff', { rings: 3 }),
  F('Irinyx', 'WATCHER', 'ranger', 'Wakeful eye', 'Holy vigil', 'bolt', 'beam', 'hover', 'seer', '#e0e8ff', '#ffffff', '#48d0ff', { eyes: 4, wings: 2 }),
  F('Eyelurk', 'WATCHER', 'mystic', 'Stare', 'Thousand-eye gaze', 'projectile', 'beam', 'blink', 'floater', '#6a5ab0', '#e8e0ff', '#ffd23f', { tentacles: 3, eyes: 'cyclops', pattern: 'eyes' }),
  F('Gazewing', 'WATCHER', 'skirmisher', 'Glare dive', 'All-seeing', 'projectile', 'beam', 'dart', 'bird', '#d8d8f0', '#ffffff', '#6a5ab0', { crest: 'long', tail: 'fork', pattern: 'eyes' }),
  F('Vigilon', 'WATCHER', 'sentinel', 'Lantern beam', 'Unsleeping', 'projectile', 'strike', 'stomp', 'golem', '#8a96aa', '#e0e6f0', '#ffd23f', { top: 'eye', pattern: 'rivets' }),
];

// Ascendants: 20 legendary portraits supplied by the founder (dist/art/src/ascendants). Held by the founder
// wallet as elite level 1 Infants, never found in the wild. Drawn as animated pixel characters (scripts/make_walkers.py).
// Ascendants run around the field (animated walk cycles) instead of floating.
const RUN = { Nyxara: 'dart', Serqeth: 'skate', Kaelor: 'charge', Lumiyah: 'dart', Thothex: 'prance', Khonsar: 'pounce', Selenox: 'stomp', Amunrah: 'charge', Azarath: 'pounce', Setekh: 'dart',
  Horuskai: 'dart', Neferion: 'prance', Ptahmos: 'stomp', Khepron: 'pounce', Osirak: 'stomp', Isisra: 'skate', Rasolar: 'prance', Anuket: 'charge', Anupex: 'pounce', Nefertek: 'skate' };
const A = (name, file, type, cls, move, special, basicStyle, specialStyle, accent) =>
  ({ ...F(name, type, cls, move, special, basicStyle, specialStyle, RUN[name] || 'pounce', 'walker', accent, '#ffffff', accent, { file }), legendary: true, legendFor: 'founder' });
export const ASCENDANTS = [
  A('Nyxara', '5e80ff12', 'SHADE', 'psion', 'Violet tear', 'Gilded night', 'projectile', 'strike', '#8a4ae0'),
  A('Serqeth', 'd376a656', 'PSYCHIC', 'psion', 'Serpent gaze', 'Mind lock', 'projectile', 'levitate', '#a060ff'),
  A('Kaelor', 'fb262407', 'STEEL', 'titan', 'Diamond staff', 'Feathered fortress', 'whip', 'strike', '#d8e0ec'),
  A('Lumiyah', '8a8c0c70', 'FROST', 'seraph', 'Crystal blade', 'Frozen radiance', 'whip', 'beam', '#bfefff'),
  A('Thothex', 'a8a9208a', 'PSYCHIC', 'deity', 'Glyph ray', 'Book of breath', 'bolt', 'beam', '#3ad8c8'),
  A('Khonsar', 'c82db54b', 'ASTRAL', 'seraph', 'Circuit crescent', 'Moon engine', 'bolt', 'beam', '#ffd23f'),
  A('Selenox', '00bc3a2d', 'WATCHER', 'deity', 'Pearl gaze', 'Full moon vigil', 'bolt', 'strike', '#e8eeff'),
  A('Amunrah', 'e241bf18', 'ANCIENT', 'deity', 'Ram horn', 'Hidden sun', 'projectile', 'beam', '#3ad8c8'),
  A('Azarath', 'bb532a8b', 'ANCIENT', 'seraph', 'Gold mask', 'Halo of names', 'bolt', 'strike', '#ffd23f'),
  A('Setekh', 'ef070189', 'EMBER', 'striker', 'Ember eyes', 'Red desert', 'projectile', 'cone', '#ff8a1f'),
  A('Horuskai', '08afa93c', 'GALE', 'seraph', 'Falcon gust', 'Eye of the sky', 'projectile', 'beam', '#ffd23f'),
  A('Neferion', '75a6e1ec', 'SPARK', 'psion', 'Third eye bolt', 'Solar circuit', 'bolt', 'strike', '#ffb030'),
  A('Ptahmos', 'e0c09d02', 'TIDE', 'titan', 'Lapis wave', 'Nile flood', 'projectile', 'beam', '#3a8ae0'),
  A('Khepron', '11012862', 'GROVE', 'sentinel', 'Emerald stare', 'Scarab dawn', 'whip', 'strike', '#3ad87a'),
  A('Osirak', '73897098', 'WATCHER', 'deity', 'Star glyph', 'Underworld throne', 'bolt', 'beam', '#3ad8c8'),
  A('Isisra', '95b511a4', 'TIDE', 'seraph', 'Veiled wave', 'Throne of waters', 'projectile', 'beam', '#3ad8c8'),
  A('Rasolar', '26c73386', 'ASTRAL', 'deity', 'Sun disc', 'Solar barque', 'bolt', 'strike', '#ffd23f'),
  A('Anuket', 'eb2159af', 'STONE', 'titan', 'Copper fist', 'Buried city', 'projectile', 'strike', '#3ad8c8'),
  A('Anupex', '9ad7ad3b', 'SHADE', 'psion', 'Jackal fang', 'Weighing of hearts', 'whip', 'strike', '#3a5ad8'),
  A('Nefertek', 'e8c84bd3', 'PSYCHIC', 'seraph', 'Circuit glance', 'Queen of code', 'projectile', 'beam', '#e8a040'),
];

// Royal Anunnaki: 8 legendaries held by the second founder wallet, led by Queen Ninshara. Animated walkers.
const ROYAL_RUN = { Ninshara: 'prance', Kingaru: 'charge', Lahmuron: 'stomp', Gulani: 'skate', Zababor: 'charge', Shalira: 'dart', Nisabel: 'prance', Ninurtax: 'dart' };
const RY = (name, type, cls, move, special, basicStyle, specialStyle, accent) =>
  ({ ...F(name, type, cls, move, special, basicStyle, specialStyle, ROYAL_RUN[name] || 'pounce', 'walker', accent, '#ffffff', accent, {}), legendary: true, legendFor: 'royal' });
export const ROYALS = [
  RY('Ninshara', 'ANCIENT', 'deity', 'Queen\'s decree', 'Crown of heaven', 'bolt', 'beam', '#ffd23f'),
  RY('Kingaru', 'DRACO', 'titan', 'Tablet of fates', 'Dragon general', 'projectile', 'cone', '#e04a4a'),
  RY('Lahmuron', 'STONE', 'sentinel', 'Gatekeeper fist', 'Six curls guard', 'projectile', 'strike', '#c89a40'),
  RY('Gulani', 'GROVE', 'support', 'Healing star', 'Great physician', 'projectile', 'beam', '#3ad87a'),
  RY('Zababor', 'STEEL', 'titan', 'War mace', 'Eagle standard', 'whip', 'strike', '#a8b4c8'),
  RY('Shalira', 'GALE', 'seraph', 'Grain storm', 'Harvest tempest', 'projectile', 'beam', '#58c8a8'),
  RY('Nisabel', 'PSYCHIC', 'arcanist', 'Reed stylus', 'Tablet of stars', 'projectile', 'levitate', '#c08cff'),
  RY('Ninurtax', 'SPARK', 'ranger', 'Thunder arrow', 'Sharur strike', 'bolt', 'strike', '#ffe14a'),
];

// Rarity tier of each wild species (how often it appears, how strong it is, how hard to catch).
export const TIERS = {
  Common: { weight: 45, mult: 0.94, catch: 0.6, lvl: 0 }, Uncommon: { weight: 28, mult: 1.0, catch: 0.45, lvl: 1 },
  Rare: { weight: 15, mult: 1.07, catch: 0.3, lvl: 3 }, Epic: { weight: 8, mult: 1.15, catch: 0.18, lvl: 5 },
  Mythic: { weight: 2.4, mult: 1.3, catch: 0.08, lvl: 12 }, Divine: { weight: 0.6, mult: 1.45, catch: 0.03, lvl: 20 },
};
const TIER_OF = {
  Blazebuck: 'Rare', Cinderwyrm: 'Epic', Pyrofinch: 'Uncommon', Magmole: 'Common', Emberjack: 'Common',
  Coralisk: 'Uncommon', Bubblyn: 'Common', Clawtide: 'Common', Abyssquid: 'Rare', Wavewing: 'Uncommon',
  Thornox: 'Rare', Fernling: 'Common', Mantiseed: 'Uncommon', Acornaut: 'Common', Lilypadra: 'Uncommon',
  Zapurr: 'Uncommon', Ohmoth: 'Common', Voltusk: 'Rare', Joltail: 'Uncommon',
  Gloomwisp: 'Uncommon', Nocturrow: 'Common', Shadefang: 'Rare', Hexmask: 'Epic',
  Quarrox: 'Uncommon', Fossilith: 'Epic', Geodillo: 'Common', Cragcrab: 'Common',
  Glacielk: 'Rare', Snowpuff: 'Common', Icicrow: 'Uncommon', Rimewyrm: 'Epic',
  Cometail: 'Rare', Lunaroo: 'Uncommon', Orbitron: 'Epic',
  Mindmoth: 'Uncommon', Oracub: 'Rare', Prismeye: 'Epic',
  Toxitoad: 'Common', Mycospore: 'Common', Stingrex: 'Rare', Viperoot: 'Uncommon',
  Gearhound: 'Uncommon', Rivetbot: 'Common', Bladewing: 'Rare', Ironshell: 'Uncommon',
  Zephyrkit: 'Common', Galeon: 'Rare', Whirlwisp: 'Uncommon',
  Drakelet: 'Epic', Skyrex: 'Epic',
  Aurielle: 'Mythic', Valkyra: 'Mythic', Nimbiel: 'Mythic', Aeonox: 'Divine',
  // Anunnaki
  Anuvax: 'Divine', Enlilor: 'Mythic', Enkiryn: 'Epic', Inannox: 'Epic', Utuflare: 'Rare', Nannamoth: 'Uncommon', Marduzar: 'Epic', Tiamaw: 'Epic',
  Ninhurra: 'Rare', Lamassor: 'Rare', Shedulon: 'Uncommon', Apkalith: 'Rare', Anzurok: 'Rare', Humbaroth: 'Uncommon', Pazuzar: 'Epic', Mushussar: 'Rare',
  Nergalith: 'Uncommon', Ereshkyl: 'Uncommon', Nabuscribe: 'Rare', Ziggurok: 'Common',
  // Watchers
  Semyazar: 'Divine', Azazelith: 'Mythic', Armarok: 'Epic', Baraqion: 'Epic', Kokabyx: 'Epic', Tamiren: 'Rare', Ramielon: 'Rare', Danelith: 'Rare',
  Ezeqor: 'Uncommon', Sarielle: 'Epic', Shamsor: 'Rare', Arakor: 'Uncommon', Penemyr: 'Uncommon', Nephilox: 'Epic', Grigoran: 'Uncommon', Ophanex: 'Rare',
  Irinyx: 'Rare', Eyelurk: 'Common', Gazewing: 'Common', Vigilon: 'Common',
};
for (const s of [...FRONTIER, ...MYTHIC, ...ANUNNAKI, ...WATCHERS]) s.tier = TIER_OF[s.name] || 'Common';
