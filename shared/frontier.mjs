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

// Superhero Drop: 30 original hero Monstars sold once each in the 30-day launch drop (never wild).
// The top five cost 1 SOL and are stronger; the other 25 cost 0.5 SOL. All hatch at level 1 and evolve.
const HERO_RUN = { titan: 'charge', sentinel: 'stomp', warden: 'stomp', striker: 'dart', skirmisher: 'dart', ranger: 'skate', mystic: 'prance', arcanist: 'prance', support: 'skate', seraph: 'hover', psion: 'hover', deity: 'hover' };
const H = (name, type, cls, move, special, basicStyle, specialStyle, main, top = false) =>
  ({ ...F(name, type, cls, move, special, basicStyle, specialStyle, HERO_RUN[cls] || 'dart', 'walker', main, '#ffffff', main, {}), hero: true,
    drop: { priceLamports: top ? '1000000000' : '500000000', top },
    forms: [`Kid ${name}`, `${name} Cadet`, name, `${name} Prime`, `Mega ${name}`, `Ascended ${name}`] });
export const HEROES = [
  H('Solarch', 'ASTRAL', 'deity', 'Sunfire palm', 'Solar crown', 'bolt', 'beam', '#ffb020', true),
  H('Voltaris', 'SPARK', 'titan', 'Arc punch', 'Thunder dome', 'bolt', 'strike', '#2a6aff', true),
  H('Gravitas', 'PSYCHIC', 'psion', 'Mass pulse', 'Gravity well', 'projectile', 'levitate', '#7a3ac8', true),
  H('Aegiron', 'STEEL', 'sentinel', 'Shield bash', 'Fortress wall', 'projectile', 'strike', '#3aa88a', true),
  H('Nightvale', 'SHADE', 'striker', 'Shadow jab', 'Midnight cascade', 'projectile', 'cone', '#2a2a4a', true),
  H('Blazewing', 'EMBER', 'skirmisher', 'Flare dart', 'Phoenix dive', 'projectile', 'cone', '#e0482a'),
  H('Magmara', 'EMBER', 'mystic', 'Lava orb', 'Caldera burst', 'projectile', 'cone', '#c83a5a'),
  H('Tidebreaker', 'TIDE', 'warden', 'Wave fist', 'Seawall slam', 'projectile', 'strike', '#1a7ac8'),
  H('Coralon', 'TIDE', 'support', 'Coral spark', 'Reef shelter', 'projectile', 'beam', '#ff7a6a'),
  H('Hailstrike', 'FROST', 'ranger', 'Ice arrow', 'Blizzard volley', 'bolt', 'cone', '#5ac8f0'),
  H('Frostbyte', 'FROST', 'arcanist', 'Frost code', 'Absolute zero', 'projectile', 'beam', '#a0e8ff'),
  H('Quakefist', 'STONE', 'titan', 'Rock punch', 'Fault line', 'projectile', 'strike', '#a0703a'),
  H('Bouldra', 'STONE', 'sentinel', 'Pebble barrage', 'Granite guard', 'projectile', 'strike', '#8a8a6a'),
  H('Galeforce', 'GALE', 'skirmisher', 'Wind cutter', 'Cyclone kick', 'projectile', 'cone', '#58c8a8'),
  H('Vortexa', 'GALE', 'seraph', 'Air lance', 'Eye of the storm', 'bolt', 'levitate', '#b8e8f8'),
  H('Thornheart', 'GROVE', 'warden', 'Thorn whip', 'Bramble fortress', 'whip', 'strike', '#3a8a3a'),
  H('Verdantia', 'GROVE', 'support', 'Leaf glide', 'Bloom field', 'projectile', 'beam', '#7ad84a'),
  H('Nebulor', 'ASTRAL', 'ranger', 'Star shot', 'Nebula rain', 'bolt', 'cone', '#5a4ad8'),
  H('Comettra', 'ASTRAL', 'seraph', 'Comet tail', 'Meteor halo', 'bolt', 'beam', '#ff9ad8'),
  H('Mindlock', 'PSYCHIC', 'arcanist', 'Psi bolt', 'Thought prison', 'projectile', 'levitate', '#c08cff'),
  H('Psyra', 'PSYCHIC', 'mystic', 'Mind spark', 'Dream storm', 'projectile', 'beam', '#e05ad8'),
  H('Steelbrand', 'STEEL', 'titan', 'Hammer arm', 'Iron quake', 'projectile', 'strike', '#8a98b0'),
  H('Ferronix', 'STEEL', 'ranger', 'Rivet shot', 'Magnet storm', 'bolt', 'cone', '#c87a3a'),
  H('Shadowstep', 'SHADE', 'skirmisher', 'Blink slash', 'Umbra rush', 'projectile', 'strike', '#4a3a6a'),
  H('Duskara', 'SHADE', 'striker', 'Dusk dagger', 'Twilight bloom', 'projectile', 'cone', '#8a2a6a'),
  H('Joltrix', 'SPARK', 'striker', 'Static jab', 'Overcharge', 'bolt', 'strike', '#ffd23f'),
  H('Ampere', 'SPARK', 'ranger', 'Current shot', 'Power surge', 'bolt', 'beam', '#ffe86a'),
  H('Drakonis', 'DRACO', 'titan', 'Dragon claw', 'Wyrmfire', 'projectile', 'cone', '#c82a2a'),
  H('Runeguard', 'ANCIENT', 'sentinel', 'Rune stone', 'Glyph barrier', 'projectile', 'strike', '#c89a40'),
  H('Sentrion', 'WATCHER', 'psion', 'Watchful eye', 'All-seeing beam', 'bolt', 'beam', '#ffffff'),
];

// Elemental Benders: original martial artists who command water, earth, fire, air and thunder.
// Gifted to chosen wallets only (never wild). Tempestro, the elite thunder bender, calls down lightning strikes.
const BEND_RUN = { titan: 'stomp', sentinel: 'stomp', warden: 'stomp', striker: 'dart', skirmisher: 'dart', ranger: 'skate', mystic: 'prance', arcanist: 'prance', support: 'skate', seraph: 'dart', psion: 'dart', deity: 'charge' };
const BE = (name, type, cls, move, special, basicStyle, specialStyle, main, title, elite = false) =>
  ({ ...F(name, type, cls, move, special, basicStyle, specialStyle, BEND_RUN[cls] || 'dart', 'walker', main, '#ffffff', main, {}), legendary: true, legendFor: 'benders', bender: true, elite,
    forms: [`Young ${name}`, `${name} the Apprentice`, name, `Master ${name}`, `Mega ${name}`, `${title} ${name}`] });
export const BENDERS = [
  BE('Tidewen', 'TIDE', 'mystic', 'Water whip', 'Ice balls', 'whip', 'projectile', '#2b6fd0', 'Ocean Sage'),
  BE('Marovek', 'TIDE', 'support', 'Ice shard', 'Healing tide', 'projectile', 'beam', '#1e5aa8', 'Ocean Sage'),
  BE('Granitus', 'STONE', 'titan', 'Boulder throw', 'Slab slide', 'projectile', 'projectile', '#4f7a2a', 'Mountain Lord'),
  BE('Terrala', 'STONE', 'sentinel', 'Stone fist', 'Rock wall', 'projectile', 'strike', '#6a8a3a', 'Mountain Lady'),
  BE('Pyreska', 'EMBER', 'striker', 'Fire dart', 'Blaze kick', 'projectile', 'cone', '#b8241c', 'Phoenix'),
  BE('Emberon', 'EMBER', 'warden', 'Flame jab', 'Inferno wheel', 'projectile', 'cone', '#8a1a14', 'Phoenix'),
  BE('Zephyrine', 'GALE', 'skirmisher', 'Air blade', 'Cyclone spin', 'projectile', 'cone', '#e8902a', 'Sky Sage'),
  BE('Aerokai', 'GALE', 'seraph', 'Gale push', 'Gust volley', 'projectile', 'projectile', '#d0782a', 'Sky Sage'),
  BE('Voltessa', 'SPARK', 'ranger', 'Spark lance', 'Storm burst', 'bolt', 'beam', '#3a2a7a', 'Storm Queen'),
  BE('Thundrik', 'SPARK', 'arcanist', 'Static jab', 'Thunderclap', 'bolt', 'strike', '#2a2a6a', 'Storm King'),
  BE('Tempestro', 'SPARK', 'deity', 'Lightning bolt', 'Sky splitter', 'bolt', 'beam', '#1a1a24', 'Elite Stormlord', true),
];

// Legend Heroes: 15 original superheroes gifted to chosen wallets (never wild, never sold). Each has its own signature powers (`sig`).
const LH = (name, type, cls, move, special, basicStyle, specialStyle, main, sig) =>
  ({ ...F(name, type, cls, move, special, basicStyle, specialStyle, HERO_RUN[cls] || 'dart', 'walker', main, '#ffffff', main, {}), legendary: true, legendFor: 'gift', giftHero: true, sig,
    forms: [`Kid ${name}`, `${name} Cadet`, name, `${name} Prime`, `Mega ${name}`, `Ascended ${name}`] });
const M = (kind, name, note, power = 1.15, size = 1) => ({ kind, name, note, power, size });
export const LEGEND_HEROES = [
  // founder
  LH('Aurorex', 'ASTRAL', 'deity', 'Aurora lance', 'Starlight crown', 'bolt', 'beam', '#ffcf3a', { mega: M('meteors', 'Aurorex Star Fall', 'Four blazing stars fall around the rival.', 1.35, 1.2) }),
  LH('Titanor', 'STEEL', 'titan', 'Titan punch', 'Iron rampart', 'projectile', 'strike', '#7a8aa8', { basic: { knock: 5, note: 'A heavy punch that knocks the rival back.' }, mega: M('pillars', 'Titanor Iron Quake', 'Five steel pillars burst out of the ground toward the rival.', 1.3) }),
  LH('Phantomir', 'SHADE', 'striker', 'Phantom slash', 'Night cascade', 'projectile', 'cone', '#3a2a6a', { dash: { kind: 'shadow', name: 'Phantom Step', note: 'Vanishes and reappears right behind the rival.' }, mega: M('barrage', 'Phantomir Shadow Barrage', 'Seven homing shadow blades.', 1.3) }),
  LH('Pyronyx', 'EMBER', 'skirmisher', 'Fire fist', 'Inferno rush', 'projectile', 'projectile', '#ff5a1f', { special: { name: 'Fireball Trio', shots: 2, look: 'fire', status: 'burn', note: 'Throws 2 or 3 fireballs that set the rival on fire.' }, mega: M('meteors', 'Pyronyx Meteor Rain', 'Burning meteors crash around the rival.', 1.3, 1.2) }),
  LH('Chronar', 'PSYCHIC', 'psion', 'Time pulse', 'Time stop', 'projectile', 'strike', '#5ad8c8', { special: { name: 'Time Stop', note: 'Holds the rival still in time where it lands.' }, mega: M('freeze', 'Chronar Frozen Hour', 'Stops time over a wide area: the rival is frozen solid.', 1.3, 1.3) }),
  // 7psx
  LH('Stormvane', 'GALE', 'ranger', 'Wind arrow', 'Storm wall', 'bolt', 'beam', '#3ab8d8', { mega: M('thunderstrike', 'Stormvane Sky Strike', 'Lightning strikes crash on the rival one after another; the first one stuns.', 1.15) }),
  LH('Bulwarkus', 'STEEL', 'sentinel', 'Shield throw', 'Fortress dome', 'projectile', 'strike', '#4a8a6a', { guard: { kind: 'fortress', name: 'Bulwark Dome', note: 'A huge dome shield that lasts twice as long.' }, mega: M('nova', 'Bulwarkus Shock Dome', 'The dome explodes outward and hits everything near it.', 1.35, 1.25) }),
  LH('Venomaw', 'VENOM', 'striker', 'Venom claw', 'Toxic spit', 'projectile', 'projectile', '#6ad83a', { special: { name: 'Toxic Spit', shots: 2, status: 'poison', note: 'Spits 2 or 3 poison globs.' }, mega: M('barrage', 'Venomaw Venom Swarm', 'Seven homing venom darts.', 1.25) }),
  LH('Quasarion', 'ASTRAL', 'seraph', 'Quasar ray', 'Light burst', 'bolt', 'beam', '#a07aff', { mega: M('lightning', 'Quasarion Star Orbs', 'Seven star orbs chase the rival; the first one stuns.', 1.1) }),
  LH('Gorrath', 'DRACO', 'titan', 'Dragon fist', 'Dragon roar', 'projectile', 'cone', '#c83a2a', { basic: { knock: 4 }, mega: M('meteors', 'Gorrath Dragon Fall', 'Dragon fire falls from the sky around the rival.', 1.35, 1.2) }),
  // 54y4 (heroines)
  LH('Starlara', 'ASTRAL', 'seraph', 'Star dart', 'Nova halo', 'bolt', 'beam', '#ffd6f0', { mega: M('lightning', 'Starlara Starlight Orbs', 'Seven glowing orbs chase the rival; the first one stuns.', 1.15) }),
  LH('Lumivra', 'PSYCHIC', 'mystic', 'Light spark', 'Mind lift', 'projectile', 'levitate', '#e07aff', { mega: M('judgment', 'Lumivra Light Judgment', 'Lifts the rival into the air, then a pillar of light slams down.', 1.3, 1.2) }),
  LH('Frostelle', 'FROST', 'arcanist', 'Frost bolt', 'Ice balls', 'projectile', 'projectile', '#8ad8ff', { special: { name: 'Ice Balls', shots: 2, look: 'ice', status: 'freeze', note: 'Shoots 2 or 3 ice balls that freeze.' }, mega: M('hailstorm', 'Frostelle Hailstorm', 'Sharp ice storms over a big area: frozen and 30% HP.', 1, 1.2) }),
  LH('Blazara', 'EMBER', 'striker', 'Blaze kick', 'Fire fan', 'projectile', 'projectile', '#ff7a3a', { special: { name: 'Fire Fan', shots: 3, look: 'fire', status: 'burn', note: 'Fans out 3 or 4 fireballs.' }, mega: M('meteors', 'Blazara Phoenix Rain', 'Phoenix fire rains around the rival.', 1.3, 1.2) }),
  LH('Sylphra', 'GALE', 'skirmisher', 'Wind slice', 'Gust volley', 'projectile', 'projectile', '#7ae8c8', { special: { name: 'Gust Volley', shots: 3, look: 'gust', note: 'Fires 3 or 4 wind balls.' }, mega: M('tornado', 'Sylphra Tornado', 'A tornado grabs the rival, spins it up and slams it down (dazed).', 1.15) }),
];

// Sky Benders: air benders. Ten gifted (5 + 5), 25 sold in the market (each also bends a second element), and the final two.
const ELEMENT_SIG = {
  air: (n, top) => ({ special: { name: 'Gust Volley', shots: 3, look: 'gust', note: 'Fires 3 or 4 wind balls at once.' }, mega: M('tornado', `${n} Tornado Gust`, 'A tornado grabs the rival, spins it up and slams it down (dazed).', top ? 1.15 : 1.05) }),
  water: (n, top) => ({ special: { name: 'Ice Balls', shots: 2, look: 'ice', status: 'freeze', note: 'Shoots 2 or 3 ice balls that freeze.' }, mega: M('hailstorm', `${n} Hailstorm`, 'An ice storm over a big area: frozen and 30% HP.', 1, top ? 1.2 : 1.05) }),
  earth: (n, top) => ({ special: { name: 'Slab Slide', shots: 3, look: 'boulder', note: 'Launches 3 or 4 stone slabs.' }, mega: M('boulderstorm', `${n} Boulder Storm`, 'Boulders rain over a big area, then the rival is dazed.', top ? 1.15 : 1.05, 1.1) }),
  fire: (n, top) => ({ special: { name: 'Fire Gust', shots: 2, look: 'fire', status: 'burn', note: 'Blows 2 or 3 balls of fire on the wind.' }, mega: M('meteors', `${n} Fire Storm`, 'Wind-fed fire falls around the rival.', top ? 1.3 : 1.15, 1.15) }),
  thunder: (n, top) => ({ special: { name: 'Storm Gust', shots: 2, status: 'paralyze', note: 'Two or three charged wind balls that paralyze.' }, mega: M('thunderstrike', `${n} Sky Strike`, 'Lightning strikes crash down; the first one stuns.', top ? 1.2 : 1.05) }),
};
const ELEM_TYPE = { air: 'GALE', water: 'TIDE', earth: 'STONE', fire: 'EMBER', thunder: 'SPARK' };
const SB = (name, el, cls, main, f, { gift = false, price = null, top = false } = {}) => {
  const b = BE(name, 'GALE', cls, 'Air blast', ELEMENT_SIG[el](name, top).special.name, 'projectile', 'projectile', main, f ? 'Sky Queen' : 'Sky Lord');
  return { ...b, el2: el, female: f, legendary: gift || undefined, legendFor: gift ? 'gift' : undefined, sky: true,
    drop: price ? { priceLamports: price, shop: true } : undefined,
    sig: { basic: { name: 'Air Blast', look: 'gust', knock: 4, note: 'A wind blast that pushes the rival back.' }, ...ELEMENT_SIG[el](name, top) } };
};
const ONE = '1000000000';
export const SKY_BENDERS = [
  // 7psx: five air benders, each with its own look
  SB('Galdris', 'air', 'seraph', '#2a8ad8', false, { gift: true, top: true }), SB('Skyvar', 'thunder', 'ranger', '#4a3ab8', false, { gift: true, top: true }),
  SB('Windrik', 'fire', 'striker', '#c84a2a', false, { gift: true, top: true }), SB('Aeromar', 'water', 'mystic', '#2ab8b8', false, { gift: true, top: true }),
  SB('Cyrran', 'earth', 'titan', '#6a8a3a', false, { gift: true, top: true }),
  // 54y4: five air bender women
  SB('Aerisa', 'air', 'seraph', '#e85a9a', true, { gift: true, top: true }), SB('Sylvane', 'water', 'mystic', '#3a7ad8', true, { gift: true, top: true }),
  SB('Zephra', 'fire', 'skirmisher', '#e8702a', true, { gift: true, top: true }), SB('Windara', 'thunder', 'ranger', '#7a3ac8', true, { gift: true, top: true }),
  SB('Skylis', 'earth', 'sentinel', '#5a9a5a', true, { gift: true, top: true }),
  // Market: 25 air benders (12 boys, 13 girls), five for each element, 1 SOL each
  ...[['Breezo', 'air', 'skirmisher', '#4ac8e8', 0], ['Nimbra', 'air', 'seraph', '#c8e8ff', 1], ['Cirrus', 'air', 'ranger', '#7ab8e8', 0], ['Aeralyn', 'air', 'support', '#f0a0c8', 1], ['Zephyl', 'air', 'mystic', '#a8e8d8', 1],
      ['Tidegale', 'water', 'warden', '#2a6ab8', 0], ['Mistral', 'water', 'support', '#5ab8e8', 1], ['Rainor', 'water', 'striker', '#3a8ab8', 0], ['Oceara', 'water', 'mystic', '#1a9ac8', 1], ['Glacia', 'water', 'arcanist', '#a0d8f8', 1],
      ['Dustan', 'earth', 'titan', '#a07a4a', 0], ['Rockwen', 'earth', 'sentinel', '#8a8a5a', 1], ['Sandor', 'earth', 'warden', '#c8a060', 0], ['Terrai', 'earth', 'striker', '#7a6a3a', 1], ['Quarra', 'earth', 'support', '#9a8a6a', 1],
      ['Emberwind', 'fire', 'striker', '#e0482a', 0], ['Ashra', 'fire', 'mystic', '#c83a5a', 1], ['Blazor', 'fire', 'titan', '#d85a1a', 0], ['Flarissa', 'fire', 'skirmisher', '#ff8a3a', 1], ['Pyrrin', 'fire', 'ranger', '#c8301a', 0],
      ['Voltair', 'thunder', 'ranger', '#4a4ad8', 0], ['Sparra', 'thunder', 'skirmisher', '#ffd23f', 1], ['Thundro', 'thunder', 'titan', '#2a2a7a', 0], ['Zappira', 'thunder', 'arcanist', '#9a6aff', 1], ['Boltan', 'thunder', 'striker', '#e8c83a', 0]]
    .map(([n, el, cls, col, f]) => SB(n, el, cls, col, !!f, { price: ONE })),
];
// COVO, the final air bender: commands all five elements, teleports and is very fast. COVA, his counterpart, is sold for 10 SOL.
const FINAL_SIG = (n, v = 0) => ({
  basic: { name: 'Fire Gust', look: 'fire', status: 'burn', knock: 4, note: 'A gust of wind full of fire that burns.' },
  special: { name: 'Ice Balls', shots: 2, look: 'ice', status: 'freeze', note: 'Shoots 2 or 3 ice balls that freeze the rival.' },
  dash: { kind: 'blink', name: `${n} Teleport`, note: 'Teleports a long way in a blink (very short recharge).', dist: 1.7 - v * 0.05, cd: 0.75 + v * 0.05 },
  mega: { kind: 'omnistorm', name: `${n} Five Element Storm`, note: 'A wind grab, a fire gust, lightning strikes, hail and an ice wave: 60% of the rival\'s HP in all. Then a lightning bolt comes back to you and heals 10% of your HP.', power: 1.4 - v * 0.02, size: 1.2 },
});
export const FINAL_BENDERS = [
  { ...BE('COVO', 'GALE', 'deity', 'Fire gust', 'Ice balls', 'projectile', 'projectile', '#4a1a8a', 'Final Air Bender', true), master: true, forms: ['COVO Initiate', 'Elemental COVO', 'Harmonic COVO', 'Ascendant COVO', 'Transcendent COVO', 'COVO the Chosen One'], el2: 'all', sky: true, unique: true, legendFor: 'gift', speedBoost: 1.35, sig: { ...FINAL_SIG('COVO'),
    // COVO's own: a fire tornado that chases the rival, and ice balls that crackle with lightning
    basic: { name: 'Fire Tornado', look: 'firenado', homing: true, status: 'burn', knock: 3, note: 'A whirlwind of fire that follows the rival until it hits, and burns.' },
    special: { name: 'Thunder Ice Balls', shots: 2, look: 'icezap', status: 'freeze', zap: true, note: 'Shoots 2 or 3 ice balls crackling with lightning: they freeze, and an electric zap jumps out.' } } },
  { ...BE('COVA', 'GALE', 'deity', 'Fire gust', 'Ice balls', 'projectile', 'projectile', '#14141a', 'Final Air Bender', true), el2: 'all', sky: true, unique: true, female: true, master: true, legendFor: 'gift', speedBoost: 1.35, sig: FINAL_SIG('COVA', 1) },
];

// Starter Benders: every new player (username account or Phantom wallet) starts with ONE of these, picked at random:
// one per element. Each player's copy is their own (unique DNA). They also roam the wild, so they can be caught.
const ST = (name, el, cls, main, f) => {
  const b = BE(name, ELEM_TYPE[el], cls, 'Element jab', ELEMENT_SIG[el](name).special.name, 'projectile', 'projectile', main, 'Grand');
  return { ...b, legendary: undefined, legendFor: undefined, starter: true, el2: el, female: f,
    sig: { basic: { name: { water: 'Water Jab', earth: 'Pebble Shot', fire: 'Ember Jab', air: 'Air Blast', thunder: 'Spark Jab' }[el], look: el === 'fire' ? 'fire' : el === 'air' ? 'gust' : el === 'water' ? 'ice' : undefined, note: 'A quick bending strike.' }, ...ELEMENT_SIG[el](name) } };
};
export const STARTER_BENDERS = [
  ST('Aquari', 'water', 'mystic', '#2a8ad8', true), ST('Rokko', 'earth', 'titan', '#7a6a3a', false), ST('Blazen', 'fire', 'striker', '#d8401a', false),
  ST('Gusti', 'air', 'skirmisher', '#e8a03a', true), ST('Voltz', 'thunder', 'ranger', '#4a3ac8', false),
];

// KENA: a final air bender like COVA (all five elements, teleport, very fast), gifted to Ashley's wallet. Appended last so no species id moves.
export const GIFT_FINALS = [
  { ...BE('Kena', 'GALE', 'deity', 'Fire gust', 'Ice balls', 'projectile', 'projectile', '#2a1440', 'Final Air Bender', true), el2: 'all', sky: true, unique: true, female: true, master: true, legendFor: 'gift', speedBoost: 1.35, sig: FINAL_SIG('Kena', 2) },
];

// ---------- The Chosen Ones ----------
// Fourteen saber-bearers from the creator's Chosen Ones pack (3D models in dist/chosen/): Aurelia and Amyah (who join the gifted heroines) and 8 new
// fighters, plus four more (Pyrelion, Glacion, Rosalis, Thalassa) made from the pack's models in new colours. They are as strong as the Element Masters
// (stats +75%), each has its own energy saber and its own set of powers, and the powers grow stronger at levels 10, 25 and 50.
const CHK_SIG = {
  AKENA: { type: 'SHADE', cls: 'skirmisher', title: 'Shadow Ascendant', female: true, main: '#ff2a3a',
    sig: { basic: { name: 'Crimson Lash', look: 'crescent', status: 'weaken', knock: 3, power: 1.25, note: 'The saber cracks out a crimson whip of energy that curses the rival: it deals less damage for a while.' },
      special: { name: 'Gravity Well', style: 'levitate', power: 1.3, note: 'A well of dark gravity opens under the rival: it is lifted, crushed and thrown.' },
      dash: { kind: 'shadow', name: 'Shadow Duplicate', note: 'Splits into a shadow and reappears right behind the rival.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'evade', name: 'Umbral Veil', note: 'Fades into shadow: cannot be touched for a moment.', time: 1.1, cd: 5.2 },
      mega: { kind: 'vortex', name: 'Event Horizon', note: 'A black sun drags the rival in, then erupts.', power: 1.45, size: 1.3 } },
    names: ['Crushing Well', 'Twin Crimson Lash', 'Singularity'] },
  Amyah: { type: 'ASTRAL', cls: 'support', title: 'Astral Harmony', female: true, main: '#3a9bff',
    sig: { basic: { name: 'Light Beam', look: 'ki', knock: 2, power: 1.2, note: 'A lance of white-blue light from the saber.' },
      special: { name: 'Healing Field', style: 'beam', leech: 0.5, power: 1.25, note: 'A beam of harmony light: it hurts the rival and half the damage heals you.' },
      dash: { kind: 'mend', name: 'Star Glide', note: 'Glides through the air and mends a little while dashing.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'mend', name: 'Orbit Guard', note: 'Three orbs of light circle her: they block hits and heal her.', time: 1.3, cd: 5.5 },
      mega: { kind: 'drain', name: 'Astral Harmony', note: 'A huge beam of harmonised light that heals her by half the damage.', power: 1.4, size: 1.3 } },
    names: ['Radiant Field', 'Twin Light Beam', 'Harmony of Stars'] },
  Aurelia: { type: 'EMBER', cls: 'seraph', title: 'Solar Radiance', female: true, main: '#ffd23a',
    sig: { basic: { name: 'Radiant Bolt', look: 'fire', status: 'burn', knock: 3, power: 1.25, note: 'A bolt of golden sunfire from the saber that burns.' },
      special: { name: 'Solar Cyclone', style: 'projectile', look: 'firenado', homing: true, status: 'burn', power: 1.3, note: 'A cyclone of sunfire that hunts the rival until it hits.' },
      dash: { kind: 'burst', name: 'Sun Sprint', note: 'Runs much faster for a moment, trailing light.', dist: 1.6, cd: 0.85 },
      guard: { kind: 'absorb', name: 'Harmony Link', note: 'Ties her to her attackers: hits she blocks charge the ULT meter.', time: 1.2, cd: 5.4 },
      mega: { kind: 'nova', name: 'Radiant Burst', note: 'The sun inside her bursts outward in every direction.', power: 1.5, size: 1.35 } },
    names: ['Solar Twister', 'Twin Radiant Bolt', 'Corona Cyclone'] },
  'Azaelion Void': { type: 'PSYCHIC', cls: 'deity', title: 'Cosmic Equilibrium', female: false, main: '#b45cff',
    sig: { basic: { name: 'Void Pulse', look: 'corb', status: 'daze', knock: 3, power: 1.25, note: 'A pulse of violet void energy that dazes the rival.' },
      special: { name: 'Energy Fusion', shots: 2, look: 'corb', homing: true, status: 'daze', power: 1.3, note: 'Fuses two orbs of void and light: they chase the rival.' },
      dash: { kind: 'blink', name: 'Dimensional Gate', note: 'Steps through a gate and appears a long way off almost at once.', dist: 1.85, cd: 0.7 },
      guard: { kind: 'barrier', name: 'Equilibrium', note: 'Balances the arena: blasts the rival away when raised.', time: 1.2, cd: 5.6 },
      mega: { kind: 'judgment', name: 'Cosmic Equilibrium', note: 'Lifts the rival into the void, then brings the whole sky down on it.', power: 1.5, size: 1.3 } },
    names: ['Void Surge', 'Triple Fusion', 'Collapse Fusion'] },
  Azmara: { type: 'SPARK', cls: 'arcanist', title: 'Celestial Convergence', female: true, main: '#e060ff',
    sig: { basic: { name: 'Polarity Orb', look: 'corb', status: 'paralyze', knock: 2, power: 1.2, note: 'An orb with two poles that paralyses what it touches.' },
      special: { name: 'Reality Ring', style: 'projectile', look: 'ring', homing: true, status: 'stun', power: 1.3, note: 'A ring that bends reality: it curves after the rival and locks it in place.' },
      dash: { kind: 'phase', name: 'Phase Shift', note: 'Slips out of phase: nothing can touch her for longer.', dist: 1.6, cd: 0.85 },
      guard: { kind: 'mirror', name: 'Polarity Mirror', note: 'Bounces every status effect back at the rival.', time: 1.2, cd: 5.4 },
      mega: { kind: 'chain', name: 'Celestial Convergence', note: 'Three arcs of dual-phase light strike the rival one after another.', power: 1.5, size: 1.25 } },
    names: ['Dual-Phase Arc', 'Twin Polarity Orb', 'Convergence Ring'] },
  Kaelion: { type: 'STEEL', cls: 'warden', title: 'Astral Guardian', female: false, main: '#3ac8ff',
    sig: { basic: { name: 'Repulsion Wave', look: 'gust', knock: 7, power: 1.2, note: 'A wave of force that throws the rival back.' },
      special: { name: 'Guardian Burst', style: 'strike', knock: 4, power: 1.3, note: 'Slams the saber down: a burst of blue force erupts under the rival.' },
      dash: { kind: 'mend', name: 'Restoration Step', note: 'Rushes forward and restores a little health.', dist: 1.45, cd: 0.95 },
      guard: { kind: 'fortress', name: 'Blue Barrier', note: 'A long, heavy barrier that almost nothing gets through.', time: 1.5, cd: 5.8 },
      mega: { kind: 'freeze', name: 'Astral Bastion', note: 'A field of blue stasis erupts under the rival and freezes it.', power: 1.45, size: 1.3 } },
    names: ['Guardian Quake', 'Twin Repulsion Wave', 'Astral Judgment'] },
  Malakar: { type: 'SPARK', cls: 'striker', title: 'Crimson Dominion', female: false, main: '#ff1a2a',
    sig: { basic: { name: 'Scarlet Bolt', look: 'crescent', status: 'paralyze', knock: 2, power: 1.25, note: 'A scarlet bolt flung from the saber that can paralyse.' },
      special: { name: 'Scarlet Lightning', style: 'strike', status: 'paralyze', power: 1.35, note: 'Scarlet lightning crashes down on the rival and paralyses it.' },
      dash: { kind: 'charge', name: 'Crimson Rush', note: 'Charges forward and slams the rival on contact.', dist: 1.55, cd: 0.9 },
      guard: { kind: 'evade', name: 'Illusion', note: 'Leaves an illusion behind: cannot be touched for a moment.', time: 1.0, cd: 5.0 },
      mega: { kind: 'thunderstrike', name: 'Void Rupture', note: 'The air tears open and scarlet bolts crash down; the first one stuns.', power: 1.5, size: 1.3 } },
    names: ['Crimson Storm', 'Twin Scarlet Bolt', 'Dominion Lightning'] },
  Nymara: { type: 'GROVE', cls: 'support', title: 'Living Balance', female: true, main: '#3aff6a',
    sig: { basic: { name: 'Thorn Dart', look: 'cthorn', status: 'poison', knock: 2, power: 1.2, note: 'A thorn of living energy that poisons.' },
      special: { name: 'Vine Bind', style: 'projectile', look: 'cthorn', homing: true, status: 'root', power: 1.25, note: 'Vines of energy chase the rival and tie it down.' },
      dash: { kind: 'trail', name: 'Sanctuary Trail', note: 'Leaves a trail of vines that entangle the rival if it passes close.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'mend', name: 'Floral Renewal', note: 'Petals swirl around her and heal her while she guards.', time: 1.3, cd: 5.5 },
      mega: { kind: 'pillars', name: 'Sanctuary Grove', note: 'A grove of giant roots bursts out of the ground in a line toward the rival.', power: 1.45, size: 1.3 } },
    names: ['Thorn Volley', 'Twin Thorn Dart', 'Briar Crown'] },
  Solarius: { type: 'ASTRAL', cls: 'ranger', title: 'Dual Radiance', female: false, main: '#ffb020',
    sig: { basic: { name: 'Twin Arcs', look: 'crescent', shots: 2, status: 'burn', knock: 2, power: 1.2, note: 'Two arcs of solar energy, one from each side of the blade.' },
      special: { name: 'Solar Vortex', style: 'cone', status: 'burn', power: 1.3, note: 'The saber spins up a vortex of sunfire that sweeps in front of him.' },
      dash: { kind: 'blink', name: 'Radiant Gateway', note: 'Opens a gate of light and steps out a good way off.', dist: 1.75, cd: 0.75 },
      guard: { kind: 'counter', name: 'Dawn Riposte', note: 'Strikes back when hit while guarding.', time: 1.1, cd: 5.2 },
      mega: { kind: 'barrage', name: 'Twin Sun Barrage', note: 'Seven blazing arcs from two suns.', power: 1.5, size: 1.25 } },
    names: ['Solar Maelstrom', 'Quad Arcs', 'Eclipse Vortex'] },
  Zayron: { type: 'STONE', cls: 'warden', title: 'Nature Bond', female: false, main: '#8aff3a',
    sig: { basic: { name: 'Root Snare', look: 'cthorn', status: 'root', knock: 2, power: 1.2, note: 'A root of green energy that snares the rival.' },
      special: { name: 'Stone Rise', style: 'strike', power: 1.35, note: 'Stone towers rise under the rival and throw it up.' },
      dash: { kind: 'mend', name: 'Renewal Pulse', note: 'A pulse of green light carries him forward and heals a little.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'thorns', name: 'Bark Guard', note: 'Bark armour that hurts the rival when it hits the guard.', time: 1.2, cd: 5.4 },
      mega: { kind: 'boulderstorm', name: 'Mountain Awakening', note: 'The mountain wakes: boulders rain over a big area.', power: 1.5, size: 1.3 } },
    names: ['Tremor Spires', 'Twin Root Snare', 'World Root'] },
  Pyrelion: { type: 'EMBER', cls: 'striker', title: 'Phoenix Blade', female: false, main: '#ff7a1a',
    sig: { basic: { name: 'Ember Slash', look: 'crescent', status: 'burn', knock: 3, power: 1.25, note: 'A crescent of flame thrown from the saber.' },
      special: { name: 'Phoenix Dive', style: 'cone', status: 'burn', power: 1.35, note: 'Leaps and dives with the blade in a cone of phoenix fire.' },
      dash: { kind: 'charge', name: 'Phoenix Rush', note: 'Charges forward wreathed in fire and slams the rival.', dist: 1.6, cd: 0.85 },
      guard: { kind: 'counter', name: 'Flare Riposte', note: 'Strikes back with a flare when hit while guarding.', time: 1.1, cd: 5.2 },
      mega: { kind: 'meteors', name: 'Phoenix Meteor', note: 'Four fiery meteors crash around the rival.', power: 1.5, size: 1.3 } },
    names: ['Phoenix Wheel', 'Twin Ember Slash', 'Rebirth Dive'] },
  Glacion: { type: 'FROST', cls: 'titan', title: 'Winter Sentinel', female: false, main: '#7af0ff',
    sig: { basic: { name: 'Frost Spear', look: 'ice', status: 'freeze', knock: 3, power: 1.2, note: 'A spear of ice thrown from the saber that can freeze.' },
      special: { name: 'Glacier Rise', style: 'strike', status: 'freeze', power: 1.3, note: 'Glaciers erupt under the rival and freeze it.' },
      dash: { kind: 'trail', name: 'Rime Trail', note: 'Leaves a trail of frost on the rival if it passes close.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'fortress', name: 'Ice Bastion', note: 'A heavy wall of ice. He cannot move, but almost nothing gets through.', time: 1.5, cd: 5.8 },
      mega: { kind: 'hailstorm', name: 'Absolute Winter', note: 'A storm of sharp ice over a big area: frozen and 30% HP.', power: 1.2, size: 1.35 } },
    names: ['Glacier Wall', 'Twin Frost Spear', 'Permafrost'] },
  Rosalis: { type: 'PSYCHIC', cls: 'mystic', title: 'Rose Oracle', female: true, main: '#ff6ad0',
    sig: { basic: { name: 'Heart Pulse', look: 'ki', status: 'confuse', knock: 2, power: 1.2, note: 'A pink pulse that leaves the rival confused.' },
      special: { name: 'Rose Charm', style: 'projectile', look: 'ring', homing: true, status: 'confuse', power: 1.25, note: 'A ring of rose light that curves after the rival and confuses it.' },
      dash: { kind: 'blink', name: 'Petal Step', note: 'Vanishes in petals and reappears a good way off.', dist: 1.75, cd: 0.75 },
      guard: { kind: 'reflect', name: 'Rose Mirror', note: 'A mirror of petals sends thrown attacks back.', time: 1.2, cd: 5.4 },
      mega: { kind: 'lance', name: 'Rose Lance', note: 'A giant beam of rose light pierces the whole arena.', power: 1.5, size: 1.3 } },
    names: ['Thorn Charm', 'Twin Heart Pulse', 'Garden of Visions'] },
  Thalassa: { type: 'TIDE', cls: 'ranger', title: 'Tide Warden', female: true, main: '#1affd0',
    sig: { basic: { name: 'Tide Lash', look: 'ice', status: 'soak', knock: 4, power: 1.2, note: 'A whip of seawater that sweeps the rival away.' },
      special: { name: 'Tidal Surge', style: 'beam', status: 'soak', power: 1.3, note: 'A surge of teal water across the arena.' },
      dash: { kind: 'burst', name: 'Riptide Sprint', note: 'Runs much faster on a riptide.', dist: 1.6, cd: 0.8 },
      guard: { kind: 'shield', name: 'Wave Ward', note: 'A ward of water that can block a hit completely.', time: 1.3, cd: 5.5 },
      mega: { kind: 'stormdrain', name: 'Maelstrom', note: 'A storm over a big area; 45% of the damage heals her.', power: 1.4, size: 1.3 } },
    names: ['Whirlpool', 'Twin Tide Lash', 'Leviathan Surge'] },
};
// ---------- Covo-style fighters (2D art) and the five Girl Elementals (3D) ----------
// Sixteen new fighters from the creator's Covo-style renders. None of them uses an element: each has its own special power
// (crystals, gravity, clones, a king's decree...). The Reactor Alchemist's Replicator Protocol makes duplicates that all attack at once.
// The five Girl Elementals (Nerida, Ignessa, Terrasa, Zephyra, Etheria) command an element, but each does it in her own special way.
Object.assign(CHK_SIG, {
  Dawnward: { type: 'ASTRAL', cls: 'warden', title: 'Crystal Knight', female: false, main: '#58b8ff',
    sig: { basic: { name: 'Crystal Shard', look: 'shard', status: 'weaken', knock: 3, power: 1.25, note: 'A shard of living crystal flies from the sword and saps the rival.' },
      special: { name: 'Prism Cage', style: 'strike', status: 'root', power: 1.3, note: 'Crystal spires close around the rival and pin it in place.' },
      dash: { kind: 'blink', name: 'Prism Step', note: 'Steps through a crystal and appears further on.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'barrier', name: 'Crystal Ward', note: 'A crystal wall that throws the rival back.', time: 1.2, cd: 5.4 },
      mega: { kind: 'pillars', name: 'Crystal Spires', note: 'A line of crystal spires bursts up toward the rival.', power: 1.5, size: 1.3 } }, names: ['Prism Prison', 'Twin Crystal Shard', 'Cathedral of Crystal'] },
  'Verdant Crown': { type: 'DRACO', cls: 'striker', title: 'Golden Rage', female: false, main: '#f2c230',
    sig: { basic: { name: 'Leaf Blade', look: 'crescent', knock: 4, power: 1.3, note: 'A crescent of green energy off the sword.' },
      special: { name: 'Golden Rage', style: 'cone', status: 'daze', power: 1.4, note: 'His hair flares gold and a shockwave blasts the rival dizzy.' },
      dash: { kind: 'charge', name: 'Rage Rush', note: 'Charges and slams the rival on contact.', dist: 1.6, cd: 0.85 },
      guard: { kind: 'thorns', name: 'Leaf Armor', note: 'A coat of leaves that hurts the rival when it hits the guard.', time: 1.2, cd: 5.3 },
      mega: { kind: 'barrage', name: 'Crown Barrage', note: 'Seven homing bursts of green-gold power.', power: 1.5, size: 1.25 } }, names: ['Rage Surge', 'Twin Leaf Blade', 'Crowned Fury'] },
  'Suncrest Tide': { type: 'PSYCHIC', cls: 'mystic', title: 'Tide of Minds', female: true, main: '#5aa8ff',
    sig: { basic: { name: 'Third Eye Ring', look: 'ring', status: 'confuse', knock: 2, power: 1.2, note: 'A ring from her forehead mark that confuses.' },
      special: { name: 'Mind Surge', style: 'beam', status: 'daze', power: 1.3, note: 'A wave of thought crashes over the rival and dazes it.' },
      dash: { kind: 'trail', name: 'Dream Glide', note: 'Glides away and leaves a dreamy trail.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'reflect', name: 'Mirror Mind', note: 'Sends thrown attacks back.', time: 1.2, cd: 5.5 },
      mega: { kind: 'vortex', name: 'Sunrise Tide', note: 'Pulls the rival into a swirl of thought, then bursts.', power: 1.45, size: 1.3 } }, names: ['Deep Surge', 'Twin Third Eye', 'Ocean of Minds'] },
  'Amethyst Lynx': { type: 'SHADE', cls: 'skirmisher', title: 'Nine Lives', female: false, main: '#a050ff',
    sig: { basic: { name: 'Lynx Claw', look: 'crescent', status: 'mark', knock: 2, power: 1.2, note: 'Slashes of violet that mark the rival.' },
      special: { name: 'Phase Pounce', style: 'strike', power: 1.35, note: 'Vanishes and lands on the rival from above.' },
      dash: { kind: 'phase', name: 'Cat Step', note: 'Phases out of the world for a moment.', dist: 1.6, cd: 0.8 },
      guard: { kind: 'evade', name: 'Nine Lives', note: 'Slips away: cannot be touched for a moment.', time: 1.1, cd: 5.0 },
      mega: { kind: 'chain', name: 'Pounce Storm', note: 'Three lightning pounces in a row.', power: 1.5, size: 1.25 } }, names: ['Pounce of Dusk', 'Twin Lynx Claw', 'Eclipse Hunt'] },
  Cinderblade: { type: 'STEEL', cls: 'striker', title: 'Hammer Breaker', female: false, main: '#d83a2a',
    sig: { basic: { name: 'Hammer Shock', look: 'boulder', knock: 7, power: 1.3, note: 'The hammer slams and sends a shockwave that throws the rival.' },
      special: { name: 'Skull Splitter', style: 'strike', status: 'stun', power: 1.4, note: 'A giant overhead smash that stuns.' },
      dash: { kind: 'leap', name: 'Hammer Leap', note: 'Jumps high and lands on the rival.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'fortress', name: 'Hammer Wall', note: 'Plants the hammer: a heavy guard that nothing gets through.', time: 1.5, cd: 5.8 },
      mega: { kind: 'meteors', name: 'Hammerfall', note: 'Four earth-shaking smashes around the rival.', power: 1.5, size: 1.3 } }, names: ['Crater Smash', 'Twin Hammer Shock', 'Worldbreaker'] },
  'Verdant Fang': { type: 'VENOM', cls: 'skirmisher', title: 'Predator', female: false, main: '#3adf5a',
    sig: { basic: { name: 'Fang Dart', look: 'sting', status: 'poison', knock: 2, power: 1.2, shots: 2, note: 'Two venom darts that poison.' },
      special: { name: 'Predator Lash', style: 'whip', status: 'poison', power: 1.3, note: 'A venom whip that wraps the rival.' },
      dash: { kind: 'shock', name: 'Pounce', note: 'Springs forward and shocks what it lands on.', dist: 1.55, cd: 0.85 },
      guard: { kind: 'counter', name: 'Ambush', note: 'Strikes back when hit while guarding.', time: 1.1, cd: 5.1 },
      mega: { kind: 'drain', name: "Predator's Feast", note: 'A beam that heals him by half the damage.', power: 1.4, size: 1.3 } }, names: ['Hunter Lash', 'Quad Fang Dart', 'Apex Predator'] },
  'Lion Regent': { type: 'ANCIENT', cls: 'titan', title: 'Royal Decree', female: false, main: '#e8b030',
    sig: { basic: { name: 'Royal Roar', look: 'roar', status: 'daze', knock: 5, power: 1.3, note: 'A roar that rolls out as a wave and dazes.' },
      special: { name: 'Royal Decree', style: 'cone', status: 'weaken', power: 1.4, note: 'A king\'s command: the rival is weakened and pushed back.' },
      dash: { kind: 'mend', name: 'Royal March', note: 'Strides forward and restores a little health.', dist: 1.4, cd: 0.95 },
      guard: { kind: 'absorb', name: 'Crown Guard', note: 'Blocked hits charge the ULT meter.', time: 1.3, cd: 5.5 },
      mega: { kind: 'judgment', name: 'Royal Judgment', note: 'Lifts the rival and brings the crown down on it.', power: 1.5, size: 1.3 } }, names: ['Regal Decree', 'Twin Royal Roar', 'Pride of Kings'] },
  'Cyan Shade': { type: 'SHADE', cls: 'skirmisher', title: 'Silent Blade', female: false, main: '#28e0ff',
    sig: { basic: { name: 'Cyan Kunai', look: 'disc', shots: 2, status: 'mark', knock: 2, power: 1.2, note: 'Two glowing kunai.' },
      special: { name: 'Silent Strike', style: 'strike', status: 'paralyze', power: 1.35, note: 'Appears over the rival and strikes a pressure point.' },
      dash: { kind: 'shadow', name: 'Shadow Step', note: 'Vanishes and reappears right behind the rival.', dist: 1.7, cd: 0.75 },
      guard: { kind: 'phase', name: 'Smoke Veil', note: 'A veil of smoke: cannot be hit for a moment.', time: 1.0, cd: 4.9 },
      mega: { kind: 'chain', name: 'Thousand Cuts', note: 'Three blindingly fast strikes in a row.', power: 1.5, size: 1.25 } }, names: ['Pressure Point', 'Quad Kunai', 'Night Without Sound'] },
  'Sun Pharaoh': { type: 'ANCIENT', cls: 'sentinel', title: 'Eternal Curse', female: false, main: '#ffd23a',
    sig: { basic: { name: 'Ankh Bolt', look: 'ring', status: 'weaken', knock: 3, power: 1.25, note: 'A golden ankh that saps strength.' },
      special: { name: "Pharaoh's Curse", style: 'projectile', look: 'corb', homing: true, status: 'daze', power: 1.35, note: 'A curse that follows the rival until it lands.' },
      dash: { kind: 'burst', name: 'Sand Rush', note: 'Runs much faster for a moment.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'mirror', name: 'Sarcophagus', note: 'Bounces every status effect back.', time: 1.3, cd: 5.5 },
      mega: { kind: 'lance', name: 'Judgment of Ra', note: 'A giant beam of gold pierces the whole arena.', power: 1.5, size: 1.3 } }, names: ['Cursed Sun', 'Twin Ankh Bolt', 'Eternal Dynasty'] },
  'Orbit Ranger': { type: 'ASTRAL', cls: 'ranger', title: 'Gravity Pilot', female: false, main: '#ff9a3a',
    sig: { basic: { name: 'Laser Rifle', look: 'ki', knock: 2, power: 1.25, shots: 2, note: 'Two bolts from the arm cannon.' },
      special: { name: 'Gravity Anchor', style: 'levitate', power: 1.35, note: 'Switches gravity: the rival floats up, then slams down.' },
      dash: { kind: 'dash', name: 'Jet Pack', note: 'A quick burst of the jet pack.', dist: 1.55, cd: 0.8 },
      guard: { kind: 'shield', name: 'Space Suit', note: 'A suit shield that can block a hit completely.', time: 1.3, cd: 5.4 },
      mega: { kind: 'nova', name: 'Supernova Beacon', note: 'A beacon explodes in every direction.', power: 1.5, size: 1.35 } }, names: ['Zero-G Anchor', 'Quad Laser Rifle', 'Black Hole Drive'] },
  'Reactor Alchemist': { type: 'VENOM', cls: 'arcanist', title: 'Mad Professor', female: false, main: '#76ff2a',
    sig: { basic: { name: 'Toxic Flask', look: 'corb', status: 'poison', knock: 2, power: 1.2, note: 'A flask of glowing green goo that poisons.' },
      special: { name: 'Mutagen Beam', style: 'beam', status: 'weaken', power: 1.3, note: 'A beam of mutagen that weakens the rival.' },
      dash: { kind: 'trail', name: 'Chemical Trail', note: 'Leaves a toxic trail behind.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'shield', name: 'Hazmat Field', note: 'A hazmat shield that can block a hit completely.', time: 1.3, cd: 5.5 },
      mega: { kind: 'clones', name: 'Replicator Protocol', note: 'Makes three duplicates. All four attack with a power attack at the same time.', power: 1.5, size: 1.3 } }, names: ['Gamma Beam', 'Twin Toxic Flask', 'Chain Reaction'] },
  Stormcaller: { type: 'PSYCHIC', cls: 'mystic', title: 'Sky Oracle', female: true, main: '#8ae0ff',
    sig: { basic: { name: 'Spirit Bolt', look: 'icezap', knock: 2, power: 1.2, note: 'A crackling spirit bolt from her hand.' },
      special: { name: 'Oracle Storm', style: 'cone', status: 'confuse', power: 1.3, note: 'A storm of visions that confuses the rival.' },
      dash: { kind: 'blink', name: 'Cloud Step', note: 'Vanishes into a cloud and appears further on.', dist: 1.8, cd: 0.7 },
      guard: { kind: 'reflect', name: 'Sky Veil', note: 'A veil that sends thrown attacks back.', time: 1.2, cd: 5.3 },
      mega: { kind: 'lance', name: 'Heaven Piercer', note: 'A beam of sky light that pierces the arena.', power: 1.5, size: 1.3 } }, names: ['Vision Storm', 'Twin Spirit Bolt', 'Mind of the Sky'] },
  'Crimson Ronin': { type: 'STEEL', cls: 'striker', title: 'Wandering Blade', female: false, main: '#d82a3a',
    sig: { basic: { name: 'Iai Slash', look: 'crescent', knock: 4, power: 1.3, note: 'A lightning draw: a crescent of blade-wind.' },
      special: { name: 'Moonlit Draw', style: 'strike', power: 1.45, note: 'Sheathes the blade; a second later the rival is cut.' },
      dash: { kind: 'dash', name: 'Flash Step', note: 'A blur of a step.', dist: 1.65, cd: 0.75 },
      guard: { kind: 'counter', name: 'Parry', note: 'Strikes back when hit while guarding.', time: 1.1, cd: 5.0 },
      mega: { kind: 'barrage', name: 'Hundred Slashes', note: 'Seven homing blade-waves.', power: 1.5, size: 1.25 } }, names: ['Crescent Draw', 'Twin Iai Slash', 'Blade of the Ronin'] },
  'Crown Street': { type: 'PSYCHIC', cls: 'ranger', title: 'Street Legend', female: false, main: '#f2c230',
    sig: { basic: { name: 'Alley-Oop', look: 'disc', knock: 3, power: 1.25, note: 'A spinning hoop-shot ball.' },
      special: { name: 'Buzzer Beater', style: 'projectile', look: 'disc', homing: true, big: 1.5, power: 1.45, note: 'One huge ball that follows the rival and drops in.' },
      dash: { kind: 'leap', name: 'Euro Step', note: 'A big step and a jump.', dist: 1.5, cd: 0.8 },
      guard: { kind: 'evade', name: 'Handles', note: 'Dribbles out of the way: cannot be touched for a moment.', time: 1.0, cd: 4.8 },
      mega: { kind: 'meteors', name: 'Poster Dunk', note: 'Four crushing dunks around the rival.', power: 1.5, size: 1.3 } }, names: ['Fadeaway Beater', 'Twin Alley-Oop', 'Game Winner'] },
  'Halo Sentinel': { type: 'ASTRAL', cls: 'seraph', title: 'Guardian Angel', female: false, main: '#fff2b0',
    sig: { basic: { name: 'Halo Ring', look: 'ring', knock: 3, power: 1.25, note: 'A spinning ring of light.' },
      special: { name: 'Wings of Mercy', style: 'beam', leech: 0.5, power: 1.3, note: 'A beam of mercy: half the damage heals him.' },
      dash: { kind: 'burst', name: 'Wing Dive', note: 'A fast dive on spread wings.', dist: 1.55, cd: 0.85 },
      guard: { kind: 'mend', name: 'Halo Ward', note: 'A halo of light heals him while guarding.', time: 1.3, cd: 5.5 },
      mega: { kind: 'judgment', name: 'Heaven\'s Verdict', note: 'Lifts the rival to heaven, then brings it down.', power: 1.5, size: 1.3 } }, names: ['Mercy Beam', 'Twin Halo Ring', 'Seraph Descent'] },
  'Ember Warden': { type: 'DRACO', cls: 'warden', title: 'Oath Keeper', female: false, main: '#ff7a1a',
    sig: { basic: { name: 'Oath Flare', look: 'dragon', status: 'burn', knock: 3, power: 1.25, note: 'A flare that burns.' },
      special: { name: "Warden's Brand", style: 'cone', status: 'mark', power: 1.35, note: 'Brands the rival: it takes more from every hit.' },
      dash: { kind: 'charge', name: 'Oathbound Rush', note: 'Charges through whatever is in the way.', dist: 1.55, cd: 0.85 },
      guard: { kind: 'barrier', name: 'Oathshield', note: 'Blasts the rival away when raised.', time: 1.2, cd: 5.2 },
      mega: { kind: 'vortex', name: 'Oath of Fire', note: 'Pulls the rival in, then bursts.', power: 1.5, size: 1.3 } }, names: ['Branded Oath', 'Twin Oath Flare', 'Warden Unbroken'] },
  // the five Girl Elementals: elemental, each in her own special way
  Nerida: { type: 'TIDE', cls: 'mystic', title: 'Water Sovereign', female: true, el2: 'water', main: '#35c8ff', girl: 'water',
    sig: { basic: { name: 'Water Push', look: 'ice', status: 'soak', knock: 4, power: 1.25, note: 'A palm push sends a ring of water that soaks.' },
      special: { name: 'Water Whip', style: 'cone', status: 'soak', power: 1.3, note: 'A whip of water lashes in an arc.' },
      dash: { kind: 'burst', name: 'Water Surge', note: 'Rides a surge of water: very fast.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'shield', name: 'Water Shield', note: 'A sphere of water can block a hit completely.', time: 1.3, cd: 5.4 },
      mega: { kind: 'stormdrain', name: 'Water Dragon', note: 'A dragon of water rises and rains on a big area; 45% of the damage heals her.', power: 1.5, size: 1.35 } }, names: ['Water Wave', 'Water Spear', 'Water Whirlpool'] },
  Ignessa: { type: 'EMBER', cls: 'striker', title: 'Flame Sovereign', female: true, el2: 'fire', main: '#ff5a1a', girl: 'fire',
    sig: { basic: { name: 'Fire Burst', look: 'fire', status: 'burn', knock: 3, power: 1.3, note: 'A burst of flame from the palm.' },
      special: { name: 'Flame Whip', style: 'whip', status: 'burn', power: 1.35, note: 'A whip of flame cracks across the rival.' },
      dash: { kind: 'charge', name: 'Flame Pillar', note: 'Charges forward leaving a pillar of fire.', dist: 1.6, cd: 0.85 },
      guard: { kind: 'counter', name: 'Fire Shield', note: 'A shield of fire that strikes back.', time: 1.1, cd: 5.2 },
      mega: { kind: 'meteors', name: 'Fire Dragon', note: 'A fire dragon dives: four fiery impacts around the rival.', power: 1.55, size: 1.3 } }, names: ['Fire Wave', 'Fire Spear', 'Fire Spin'] },
  Terrasa: { type: 'STONE', cls: 'titan', title: 'Earth Sovereign', female: true, el2: 'earth', main: '#8a6a3a', girl: 'earth',
    sig: { basic: { name: 'Earth Push', look: 'boulder', status: 'root', knock: 5, power: 1.3, note: 'A palm push throws a stone slab.' },
      special: { name: 'Rock Spike', style: 'strike', power: 1.4, note: 'Stone spikes burst under the rival.' },
      dash: { kind: 'leap', name: 'Ground Surge', note: 'Rides the earth in a long leap.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'fortress', name: 'Earth Shield', note: 'A wall of earth: nearly nothing gets through.', time: 1.5, cd: 5.8 },
      mega: { kind: 'boulderstorm', name: 'Earth Titan', note: 'The titan wakes: boulders rain over a big area.', power: 1.55, size: 1.35 } }, names: ['Earth Wave', 'Stone Spear', 'Rock Whirlpool'] },
  Zephyra: { type: 'GALE', cls: 'skirmisher', title: 'Sky Sovereign', female: true, el2: 'air', motion: 'hover', main: '#c8f4ff', girl: 'air',
    sig: { basic: { name: 'Air Push', look: 'gust', knock: 3, power: 1.2, note: 'A palm strike fires a ring of wind.' },
      special: { name: 'Wind Slash', style: 'levitate', power: 1.35, note: 'A slash of wind lifts the rival into the air and drops it.' },
      dash: { kind: 'phase', name: 'Updraft', note: 'Rides an updraft: nothing can touch her for a moment.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'evade', name: 'Air Shield', note: 'A cushion of wind: cannot be touched for a moment.', time: 1.1, cd: 5.0 },
      mega: { kind: 'tornado', name: 'Wind Dragon', note: 'A dragon of wind grabs every rival, spins them up and slams them down.', power: 1.5, size: 1.3 } }, names: ['Wind Wave', 'Air Spear', 'Air Vortex'] },
  Etheria: { type: 'ASTRAL', cls: 'arcanist', title: 'Aether Sovereign', female: true, el2: 'all', main: '#d08aff', girl: 'aether',
    sig: { basic: { name: 'Aether Push', look: 'corb', status: 'mark', knock: 3, power: 1.3, note: 'A pulse of pure aether that marks the rival.' },
      special: { name: 'Aether Slash', style: 'beam', status: 'weaken', power: 1.4, note: 'A slash of aether light that weakens the rival.' },
      dash: { kind: 'blink', name: 'Aether Pillar', note: 'Steps through a pillar of aether to somewhere else.', dist: 1.85, cd: 0.7 },
      guard: { kind: 'mirror', name: 'Aether Shield', note: 'Bounces every status effect back.', time: 1.3, cd: 5.4 },
      mega: { kind: 'omnistorm', name: 'Aether Rift', note: 'Tears a rift in space: every element at once.', power: 1.55, size: 1.35 } }, names: ['Aether Wave', 'Aether Spear', 'Aether Vortex'] },
});


// ---------- The Weavers and the Eclipse Sovereign (hold-to-charge fighters, sold in the market) ----------
// Strong from level 1 (Aura-fighter stats), they charge their basic attack while the button is held (up to 1.5 s: 1.8x damage), have their own guard
// and secondary move, and can ascend into an evolved form and back (the Aura button). Eclipse Sovereign hovers. All six are sold in the market.
Object.assign(CHK_SIG, {
  'Eclipse Sovereign': { type: 'ASTRAL', cls: 'deity', title: 'Twin Eclipse', female: false, motion: 'hover', main: '#7a5aff', market: 2,
    sig: { basic: { name: 'Eclipse Coil', look: 'wsprite', status: 'weaken', knock: 4, power: 1.5, note: 'Hold to charge: blue Radiant and red Umbral energy twist into one helix that saps the rival.' },
      special: { name: 'Umbral Pull', style: 'levitate', power: 1.5, note: 'A red gravity well drags the rival in, lifts it and slams it down.' },
      dash: { kind: 'blink', name: 'Eclipse Drift', note: 'Slides through the eclipse and appears a long way off.', dist: 1.9, cd: 0.7 },
      guard: { kind: 'absorb', name: 'Radiant Guard', note: 'A blue arc absorbs a frontal hit: blocked hits charge the ULT meter.', time: 1.4, cd: 5.2 },
      mega: { kind: 'judgment', name: 'Total Eclipse', note: 'The sun goes dark: the rival is lifted, then crushed by the eclipse.', power: 1.7, size: 1.4 } }, names: ['Dark Pull', 'Twin Coil', 'Eclipse Ascendant'], forms: ['Eclipse Acolyte', 'Eclipse Disciple', 'Eclipse Sovereign', 'Eclipse Knight', 'Eclipse Lord', 'Eclipse Ascendant'] },
  'Tide Weaver': { type: 'TIDE', cls: 'mystic', title: 'Tide Weaver', female: true, el2: 'water', main: '#35b8ff', market: 1,
    sig: { basic: { name: 'Tide Pulse', look: 'wsprite', status: 'soak', knock: 5, power: 1.45, note: 'Hold to charge a compressed blast of water that splashes on impact.' },
      special: { name: 'Undertow Sweep', style: 'cone', status: 'soak', power: 1.45, note: 'A low surge sweeps the rival sideways.' },
      dash: { kind: 'burst', name: 'Tide Slide', note: 'Slides on a surge of water: very fast.', dist: 1.75, cd: 0.78 },
      guard: { kind: 'barrier', name: 'Riptide Guard', note: 'A curved wall of water that throws the rival back.', time: 1.3, cd: 5.3 },
      mega: { kind: 'stormdrain', name: 'Tsunami', note: 'A wave over a big area; 45% of the damage heals her.', power: 1.6, size: 1.4 } }, names: ['Rising Sweep', 'Twin Tide Pulse', 'High Tide'], forms: ['Tide Pup', 'Tide Apprentice', 'Tide Weaver', 'Tide Adept', 'Tide Master', 'High Tide'] },
  'Ember Weaver': { type: 'EMBER', cls: 'striker', title: 'Ember Weaver', female: true, el2: 'fire', main: '#ff6a1a', market: 1,
    sig: { basic: { name: 'Ember Pulse', look: 'wsprite', status: 'burn', knock: 4, power: 1.5, note: 'Hold to charge a molten fireball with a flame trail.' },
      special: { name: 'Flame Lash', style: 'whip', status: 'burn', power: 1.5, note: 'A short curl of fire sweeps across the floor.' },
      dash: { kind: 'charge', name: 'Ember Dash', note: 'Charges ahead in a streak of embers.', dist: 1.65, cd: 0.84 },
      guard: { kind: 'thorns', name: 'Cinder Guard', note: 'A burning screen that hurts the rival when it hits the guard.', time: 1.2, cd: 5.2 },
      mega: { kind: 'meteors', name: 'Wildfire Rain', note: 'Four molten meteors crash around the rival.', power: 1.65, size: 1.35 } }, names: ['Searing Lash', 'Twin Ember Pulse', 'Wildfire Crown'], forms: ['Ember Spark', 'Ember Apprentice', 'Ember Weaver', 'Ember Adept', 'Ember Master', 'Wildfire Crown'] },
  'Volt Weaver': { type: 'SPARK', cls: 'skirmisher', title: 'Volt Weaver', female: true, el2: 'lightning', main: '#ffe23a', market: 1,
    sig: { basic: { name: 'Volt Pulse', look: 'wsprite', status: 'paralyze', knock: 3, power: 1.45, note: 'Hold to charge a branching bolt of lightning.' },
      special: { name: 'Arc Step', style: 'strike', status: 'paralyze', power: 1.5, note: 'Steps along an arc of lightning and strikes the rival where it lands.' },
      dash: { kind: 'shock', name: 'Static Dash', note: 'A crackling dash that shocks what it touches.', dist: 1.7, cd: 0.76 },
      guard: { kind: 'counter', name: 'Static Guard', note: 'Strikes back with a shock when hit while guarding.', time: 1.1, cd: 5.0 },
      mega: { kind: 'thunderstrike', name: 'Storm Crown Strike', note: 'Six lightning strikes from the sky; the first one stuns.', power: 1.6, size: 1.35 } }, names: ['Long Arc', 'Twin Volt Pulse', 'Storm Crown'], forms: ['Volt Spark', 'Volt Apprentice', 'Volt Weaver', 'Volt Adept', 'Volt Master', 'Storm Crown'] },
  'Stone Weaver': { type: 'STONE', cls: 'titan', title: 'Stone Weaver', female: true, el2: 'earth', main: '#a08a60', market: 1,
    sig: { basic: { name: 'Stone Pulse', look: 'wsprite', status: 'root', knock: 6, power: 1.5, note: 'Hold to charge a stone core that shatters on impact.' },
      special: { name: 'Fault Sweep', style: 'cone', status: 'daze', power: 1.5, note: 'A crack runs along the floor and sweeps the rival off its feet.' },
      dash: { kind: 'leap', name: 'Stone Roll', note: 'A heavy leap that lands with a thud.', dist: 1.5, cd: 0.92 },
      guard: { kind: 'fortress', name: 'Basalt Guard', note: 'A wall of basalt: nearly nothing gets through.', time: 1.6, cd: 5.9 },
      mega: { kind: 'boulderstorm', name: 'Bedrock Quake', note: 'Boulders rain over a big area.', power: 1.65, size: 1.4 } }, names: ['Deep Sweep', 'Twin Stone Pulse', 'Bedrock Ascendant'], forms: ['Stone Pebble', 'Stone Apprentice', 'Stone Weaver', 'Stone Adept', 'Stone Master', 'Bedrock Ascendant'] },
  'Halo Slinger': { type: 'ASTRAL', cls: 'ranger', title: 'Halo Slinger', female: false, main: '#ffd23a', market: 1,
    sig: { basic: { name: 'Halo Energy Disk', look: 'wsprite', status: 'mark', knock: 3, power: 1.5, note: 'Hold to charge a disk that grows, then flies as a spinning ring.' },
      special: { name: 'Ring Step', style: 'strike', status: 'mark', power: 1.5, note: 'Steps through a ring of light and strikes from above.' },
      dash: { kind: 'phase', name: 'Halo Glide', note: 'Glides through a halo: nothing can touch him for a moment.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'shield', name: 'Halo Guard', note: 'A ring of light that can block a hit completely.', time: 1.3, cd: 5.3 },
      mega: { kind: 'barrage', name: 'Resonant Rings', note: 'Seven homing rings of light.', power: 1.6, size: 1.3 } }, names: ['Wide Ring', 'Twin Halo Disk', 'Resonant Form'], forms: ['Halo Spark', 'Halo Apprentice', 'Halo Slinger', 'Halo Adept', 'Halo Master', 'Resonant Form'] },
});

// ---- The Ancient Beings (3D): Sariel the Watcher (winged, flies), Nerath the Nephilim (a giant) and Enkar the Anunnaki (an ancient ruler). Strong from level 1
// (Aura stats), hold-to-charge, a guard, a movement power and a mega each; they run, punch and guard like people. Sold in the market.
Object.assign(CHK_SIG, {
  'Sariel the Watcher': { type: 'ASTRAL', cls: 'mystic', title: 'Winged Watcher', female: false, motion: 'hover', main: '#8a6aff', market: 1.5,
    sig: { basic: { name: 'Star Seal', look: 'ring', status: 'root', knock: 2, power: 1.55, note: 'Hold to charge: a ring of stars assembles, then flies out and binds the rival in place for a moment.' },
      special: { name: 'Falling Star', style: 'bolt', status: 'mark', power: 1.55, note: 'A star drops from the night sky onto the rival and marks it.' },
      dash: { kind: 'trail', name: 'Astral Step', note: 'Glides sideways on his wings, leaving a fading trail of stars that burns the rival.', dist: 1.9, cd: 0.72 },
      guard: { kind: 'reflect', name: 'Night Mantle', note: 'Folds both wings forward: ranged hits bounce back.', time: 1.4, cd: 5.3 },
      mega: { kind: 'hailstorm', name: 'Watchers\' Judgment', note: 'The sky opens and a rain of stars falls on the whole arena.', power: 1.7, size: 1.45 } }, names: ['Star Dart', 'Star Seal Twin', 'Astral Watcher'], forms: ['Fledgling Watcher', 'Star Watcher', 'Sariel the Watcher', 'Night Warden', 'Astral Warden', 'Celestial Watcher'] },
  'Nerath the Nephilim': { type: 'STONE', cls: 'titan', title: 'Nephilim Giant', female: false, main: '#c87a3a', market: 1.5,
    sig: { basic: { name: 'Fault Crown', look: 'boulder', status: 'daze', knock: 9, power: 1.6, note: 'Hold to build a ground charge, then stomp: a ridge of rock rolls across the arena.' },
      special: { name: 'Titan Fist', style: 'strike', status: 'stun', power: 1.6, note: 'A giant fist smash that stuns the rival.' },
      dash: { kind: 'charge', name: 'Colossus Rush', note: 'A short, heavy shoulder charge that nothing stops.', dist: 1.5, cd: 0.9 },
      guard: { kind: 'fortress', name: 'Stonehide', note: 'Braces in place: hits barely move him.', time: 1.7, cd: 6.0 },
      mega: { kind: 'pillars', name: 'Ridge of the Giants', note: 'Rock pillars burst out of the ground in a line across the arena.', power: 1.75, size: 1.5 } }, names: ['Ridge Break', 'Twin Fault', 'Titan Ascendant'], forms: ['Stone Child', 'Ridge Born', 'Nerath the Nephilim', 'Fault Giant', 'Colossus', 'Titan Ascendant'] },
  'Enkar the Anunnaki': { type: 'EMBER', cls: 'deity', title: 'Dawn Ruler', female: false, main: '#ffb02a', market: 1.5,
    sig: { basic: { name: 'Dawn Decree', look: 'ki', status: 'burn', knock: 5, power: 1.6, note: 'Hold to widen a rotating solar seal, then release a focused bronze-and-amber pulse.' },
      special: { name: 'Crown of Dawn', style: 'cone', status: 'dazzle', power: 1.55, note: 'A ring of sunlight expands around him and blinds the rival.' },
      dash: { kind: 'blink', name: 'Ziggurat Step', note: 'Steps up an invisible stair of light and appears far away.', dist: 1.9, cd: 0.74 },
      guard: { kind: 'barrier', name: 'Lapis Ward', note: 'A low arc of tessellated blue shields.', time: 1.4, cd: 5.4 },
      mega: { kind: 'nova', name: 'Dawn of the Gods', note: 'The sun rises over the arena and bursts in every direction.', power: 1.75, size: 1.5 } }, names: ['Dawn Spark', 'Twin Seal', 'Dawn Sovereign'], forms: ['Dawn Scribe', 'Seal Bearer', 'Enkar the Anunnaki', 'Ziggurat Lord', 'Solar King', 'Dawn Sovereign'] },
});

const chosenTiers = (k, names) => { // the same buttons get stronger powers at levels 10, 25 and 50
  const { basic: b, special: s, mega: m } = k.sig, up = (v, f) => +((v || 1) * f).toFixed(2);
  return [{ lv: 10, special: { name: names[0], power: up(s.power, 1.12), note: s.note.replace(/\.$/, '') + ', stronger.' } },
    { lv: 25, basic: { name: names[1], power: up(b.power, 1.25), shots: Math.max(2, (b.shots || 1)), note: b.note.replace(/\.$/, '') + ', twice.' }, special: { power: up(s.power, 1.28), reach: 1.15 } },
    { lv: 50, special: { name: names[2], power: up(s.power, 1.5), big: 1.4, note: s.note.replace(/\.$/, '') + ', at full strength.' }, mega: { power: +(m.power + 0.12).toFixed(2), size: +(m.size + 0.1).toFixed(2) } }];
};

// Boss Monsters: the level bosses of the Boss Arena (from the Animated Level Enemies packs). Evil powers no other Monstar has,
// each with its own 3D look. Never met in the wild and can't be caught; the founder holds them and only the founder may sell them.
const BX = (type, cls, main, motion, basic, special, dash, guard, mega, forms) => ({ type, cls, title: 'Boss Monster', female: false, main, motion, boss: true,
  sig: { basic, special, dash, guard, mega }, names: [basic.name + ' II', special.name + ' II', mega.name + ' II'], forms });
Object.assign(CHK_SIG, {
  'Thornmaw': BX('GROVE', 'skirmisher', '#3a8a2a', 'hover',
    { name: 'Thorn Seeds', look: 'bx_thorn', shots: 2, status: 'poison', power: 1.35, note: 'Spits a pair of black thorn seeds that poison.' },
    { name: 'Briar Dive', style: 'strike', status: 'root', power: 1.5, note: 'Dives from the sky: a field of black bramble spikes bursts out of the ground and binds the rival.' },
    { kind: 'leap', name: 'Wing Swoop', note: 'Swoops up and over.', dist: 1.8, cd: 0.75 }, { kind: 'thorns', name: 'Bramble Hide', note: 'Thorns burst from the skin: hitting it hurts.', time: 1.3, cd: 5.2 },
    { kind: 'barrage', name: 'Thorn Rain', note: 'Black thorns rain on the whole arena.', power: 1.5, size: 1.3 }, ['Thornling', 'Thornmaw']),
  'Cinderwing': BX('EMBER', 'striker', '#ff3a1a', 'hover',
    { name: 'Lava Spit', look: 'bx_lava', status: 'burn', power: 1.4, note: 'A glob of molten lava that burns.' },
    { name: 'Hellfire Breath', style: 'cone', status: 'burn', power: 1.55, note: 'Breathes a wide wave of molten lava and burning rock.' },
    { kind: 'burst', name: 'Ember Rush', note: 'Bursts forward on burning wings.', dist: 1.8, cd: 0.72 }, { kind: 'absorb', name: 'Magma Skin', note: 'Its skin turns to magma and soaks up hits.', time: 1.3, cd: 5.4 },
    { kind: 'meteors', name: 'Molten Sky', note: 'Lava meteors crash down all over the arena.', power: 1.6, size: 1.35 }, ['Cinderling', 'Cinderwing']),
  'Crimson Harrow': BX('DRACO', 'striker', '#c8102e', 'hover',
    { name: 'Blood Fang', look: 'bx_fang', status: 'weaken', power: 1.4, note: 'A red fang of blood energy that curses.' },
    { name: 'Crimson Tail', style: 'cone', status: 'weaken', power: 1.55, note: 'Two blood-red crescents sweep from its tail, one after the other.' },
    { kind: 'shadow', name: 'Blood Mist', note: 'Turns to red mist and reappears.', dist: 1.7, cd: 0.8 }, { kind: 'counter', name: 'Crimson Riposte', note: 'Blocks and strikes back.', time: 1.1, cd: 5.2 },
    { kind: 'drain', name: 'Blood Harvest', note: 'Drains the life out of the rival.', power: 1.5, size: 1.2 }, ['Harrowling', 'Crimson Harrow']),
  'Briarcoil': BX('VENOM', 'warden', '#2a7a3a', 'glide',
    { name: 'Venom Spit', look: 'bx_venom', status: 'poison', power: 1.35, note: 'Spits a ball of green venom.' },
    { name: 'Root Snare', style: 'strike', status: 'poison', power: 1.5, note: 'A ring of toxic gas bursts out from the coil and poisons everything inside.' },
    { kind: 'dash', name: 'Coil Slither', note: 'Slithers fast along the ground.', dist: 1.7, cd: 0.7 }, { kind: 'thorns', name: 'Spine Coil', note: 'Coils up behind its spines.', time: 1.3, cd: 5.3 },
    { kind: 'vortex', name: 'Toxic Maelstrom', note: 'A whirl of poison gas drags the rival in.', power: 1.5, size: 1.3 }, ['Coilet', 'Briarcoil']),
  'Abyss Siren': BX('TIDE', 'mystic', '#1a5aa8', 'glide',
    { name: 'Abyss Bubble', look: 'bx_bubble', status: 'soak', power: 1.35, note: 'A dark bubble from the deep that sweeps the rival away.' },
    { name: 'Undertow Spiral', style: 'strike', status: 'whirl', power: 1.55, note: 'A whirlpool from the abyss spins the rival up, then slams it down.' },
    { kind: 'phase', name: 'Tide Slip', note: 'Slips through the water.', dist: 1.8, cd: 0.75 }, { kind: 'reflect', name: 'Siren Veil', note: 'A sheet of water bounces shots back.', time: 1.3, cd: 5.4 },
    { kind: 'stormdrain', name: 'Drowning Deep', note: 'The abyss rises and drags the rival under.', power: 1.55, size: 1.3 }, ['Sirenling', 'Abyss Siren']),
  'Brine Viper': BX('TIDE', 'skirmisher', '#2ab8a8', 'glide',
    { name: 'Brine Fang', look: 'bx_brine', status: 'soak', power: 1.35, note: 'A fang of corrosive brine.' },
    { name: 'Brine Jet', style: 'beam', status: 'poison', power: 1.5, note: 'A corrosive jet of brine that burns through armor.' },
    { kind: 'dash', name: 'Viper Lunge', note: 'Lunges forward like a striking snake.', dist: 1.9, cd: 0.7 }, { kind: 'evade', name: 'Shed Skin', note: 'Sheds its skin and slips away.', time: 1.0, cd: 5.0 },
    { kind: 'freeze', name: 'Salt Tomb', note: 'Crusts the rival in salt.', power: 1.45, size: 1.2 }, ['Viperling', 'Brine Viper']),
  'Gilded Asp': BX('ASTRAL', 'mystic', '#f2b81a', 'glide',
    { name: 'Gold Scarab', look: 'bx_scarab', homing: true, status: 'dazzle', power: 1.35, note: 'A golden scarab that chases the rival.' },
    { name: 'Crown Glare', style: 'cone', status: 'dazzle', power: 1.55, note: 'Its crown flares: a hypnotic cone of gold light dazzles and slows.' },
    { kind: 'blink', name: 'Mirage', note: 'Shimmers away like a desert mirage.', dist: 1.7, cd: 0.78 }, { kind: 'mirror', name: 'Golden Mirror', note: 'A gold mirror turns hits back.', time: 1.2, cd: 5.3 },
    { kind: 'judgment', name: 'Pharaoh\'s Curse', note: 'Gold light falls from above.', power: 1.55, size: 1.3 }, ['Aspling', 'Gilded Asp']),
  'Null Lancer': BX('SHADE', 'striker', '#5a2a9a', 'dart',
    { name: 'Void Shard', look: 'bx_void', status: 'confuse', power: 1.4, note: 'A shard of nothing that scrambles the mind.' },
    { name: 'Void Thrust', style: 'beam', status: 'mark', power: 1.6, reach: 1.1, note: 'A long thrust of black void along a lane.' },
    { kind: 'charge', name: 'Lance Charge', note: 'Charges with the polearm.', dist: 1.9, cd: 0.72 }, { kind: 'shield', name: 'Null Guard', note: 'A wall of void.', time: 1.3, cd: 5.2 },
    { kind: 'lance', name: 'Oblivion Spear', note: 'A giant spear of void pierces the arena.', power: 1.6, size: 1.3 }, ['Null Squire', 'Null Lancer']),
  'Rift Talon': BX('PSYCHIC', 'skirmisher', '#9a3aff', 'dart',
    { name: 'Rift Claw', look: 'bx_rift', status: 'daze', power: 1.4, note: 'A violet claw that tears through space.' },
    { name: 'Rift Rake', style: 'projectile', status: 'daze', power: 1.55, note: 'Rakes the air: two violet rift arcs fly out.' },
    { kind: 'phase', name: 'Rift Step', note: 'Steps through a tear in space.', dist: 1.8, cd: 0.72 }, { kind: 'phase', name: 'Fold Away', note: 'Folds out of reality.', time: 1.0, cd: 5.0 },
    { kind: 'chain', name: 'Shatter Rift', note: 'Rifts crack open all around.', power: 1.55, size: 1.25 }, ['Rift Pup', 'Rift Talon']),
  'Hydra Matron': BX('VENOM', 'deity', '#8a3aa8', 'glide',
    { name: 'Hydra Bite', look: 'bx_hydra', shots: 3, status: 'poison', power: 1.4, note: 'Three serpent heads strike at once.' },
    { name: 'Hydra Crescents', style: 'projectile', status: 'poison', power: 1.65, note: 'A fan of three venom crescents.' },
    { kind: 'dash', name: 'Serpent Surge', note: 'Surges on her coils.', dist: 1.7, cd: 0.75 }, { kind: 'barrier', name: 'Coil Wall', note: 'Coils into a wall of scales.', time: 1.4, cd: 5.4 },
    { kind: 'omnistorm', name: 'Nine Heads', note: 'Every head strikes the arena at once.', power: 1.7, size: 1.4 }, ['Hydra Spawn', 'Hydra Matron']),
  'Iceback Ravager': BX('FROST', 'titan', '#7ad8ff', 'stomp',
    { name: 'Ice Boulder', look: 'bx_iceboulder', status: 'freeze', power: 1.4, note: 'Hurls a boulder of ice.' },
    { name: 'Glacier Pounce', style: 'strike', status: 'freeze', power: 1.6, note: 'Pounces and smashes a crater of jagged ice slabs out of the ground.' },
    { kind: 'leap', name: 'Ravager Leap', note: 'A huge leap.', dist: 1.8, cd: 0.8 }, { kind: 'fortress', name: 'Ice Hide', note: 'Its back freezes over.', time: 1.4, cd: 5.6 },
    { kind: 'hailstorm', name: 'White Ruin', note: 'Ice crashes down everywhere.', power: 1.6, size: 1.35 }, ['Ravager Cub', 'Iceback Ravager']),
  'Paleclaw': BX('SHADE', 'titan', '#e8e8f0', 'stomp',
    { name: 'Blood Claw', look: 'bx_bloodclaw', status: 'weaken', power: 1.4, note: 'A flying slash of blood.' },
    { name: 'Crimson Rake', style: 'cone', status: 'weaken', power: 1.6, note: 'Draws back its crimson arm and rakes three blood gashes through the air.' },
    { kind: 'charge', name: 'Pale Charge', note: 'Charges on all fours.', dist: 1.8, cd: 0.78 }, { kind: 'counter', name: 'Feral Guard', note: 'Guards and lashes back.', time: 1.1, cd: 5.2 },
    { kind: 'drain', name: 'Crimson Feast', note: 'Feeds on the rival\'s life.', power: 1.55, size: 1.2 }, ['Paleling', 'Paleclaw']),
  'Sable Ossuary': BX('ANCIENT', 'arcanist', '#3a7aff', 'prance',
    { name: 'Skull Flame', look: 'bx_skull', status: 'mark', power: 1.4, note: 'A blue-burning skull.' },
    { name: 'Bonefire Crown', style: 'strike', status: 'burn', power: 1.6, note: 'Raises its skull crest: a ring of blue bonefire bursts up around the rival.' },
    { kind: 'blink', name: 'Bone Step', note: 'Crumbles and reforms.', dist: 1.7, cd: 0.78 }, { kind: 'absorb', name: 'Ossuary Ward', note: 'Bones lock into a shield.', time: 1.3, cd: 5.3 },
    { kind: 'pillars', name: 'Bone Pillars', note: 'Pillars of bone burst from the ground.', power: 1.55, size: 1.3 }, ['Bonelet', 'Sable Ossuary']),
  'Lantern Reaper': BX('SHADE', 'psion', '#28e0d8', 'hover',
    { name: 'Lantern Flame', look: 'bx_lantern', homing: true, status: 'mark', power: 1.4, note: 'A ghost flame from its lantern that hunts the rival.' },
    { name: 'Wraith Reap', style: 'cone', status: 'daze', power: 1.6, note: 'Floats back, then sweeps a cyan scythe arc full of shrieking wraiths.' },
    { kind: 'phase', name: 'Wraith Drift', note: 'Drifts through like a ghost.', dist: 1.8, cd: 0.72 }, { kind: 'evade', name: 'Spirit Fade', note: 'Fades into the dark.', time: 1.1, cd: 5.1 },
    { kind: 'clones', name: 'Lantern Souls', note: 'Lost souls pour out of the lantern.', power: 1.55, size: 1.25 }, ['Wisp', 'Lantern Reaper']),
  'Briar Inquisitor': BX('GROVE', 'sentinel', '#b03a5a', 'stomp',
    { name: 'Hook Spike', look: 'bx_hook', status: 'root', power: 1.4, note: 'A barbed hook on a chain.' },
    { name: 'Chainhook Circle', style: 'whip', status: 'root', power: 1.6, note: 'Throws barbed chainhooks out and reels the rival in.' },
    { kind: 'charge', name: 'Inquisition', note: 'Marches forward.', dist: 1.6, cd: 0.8 }, { kind: 'thorns', name: 'Barbed Robe', note: 'Barbs hurt anyone who hits.', time: 1.3, cd: 5.4 },
    { kind: 'chain', name: 'Iron Verdict', note: 'Chains lash out across the arena.', power: 1.55, size: 1.3 }, ['Inquisitor', 'Briar Inquisitor']),
  'Ashscale Bulwark': BX('EMBER', 'titan', '#ff5a10', 'stomp',
    { name: 'Magma Rock', look: 'bx_magma', status: 'burn', power: 1.45, note: 'Hurls a rock of glowing magma.' },
    { name: 'Basalt Breaker', style: 'strike', status: 'burn', power: 1.65, note: 'Brings its arms down: the ground splits and lava geysers erupt.' },
    { kind: 'charge', name: 'Ash Charge', note: 'Charges like a landslide.', dist: 1.6, cd: 0.82 }, { kind: 'fortress', name: 'Basalt Wall', note: 'Turns to stone.', time: 1.5, cd: 5.6 },
    { kind: 'meteors', name: 'Volcano Heart', note: 'The arena erupts with lava.', power: 1.65, size: 1.4 }, ['Ashling', 'Ashscale Bulwark']),
  'Rimeforged Sentinel': BX('FROST', 'sentinel', '#3ab0ff', 'stomp',
    { name: 'Ice Spear', look: 'bx_icespear', status: 'freeze', power: 1.4, note: 'A spear of blue ice.' },
    { name: 'Shatter Guard', style: 'strike', status: 'freeze', power: 1.6, note: 'Braces, then blasts a storm of ice shards out of its armor in every direction.' },
    { kind: 'charge', name: 'Glacier March', note: 'Marches forward.', dist: 1.6, cd: 0.8 }, { kind: 'reflect', name: 'Rime Mirror', note: 'An ice mirror turns shots back.', time: 1.3, cd: 5.4 },
    { kind: 'freeze', name: 'Absolute Zero', note: 'Freezes the whole arena.', power: 1.6, size: 1.35 }, ['Rime Squire', 'Rimeforged Sentinel']),
  'Stormhorn Revenant': BX('SPARK', 'titan', '#3a8aff', 'charge',
    { name: 'Horn Bolt', look: 'bx_hornbolt', status: 'paralyze', power: 1.45, note: 'Lightning crackles off its horns.' },
    { name: 'Thunder Ram', style: 'beam', status: 'paralyze', power: 1.65, reach: 1.1, note: 'Lowers its horns and rams down a lane of lightning.' },
    { kind: 'shock', name: 'Storm Rush', note: 'Rushes in a flash of lightning.', dist: 1.9, cd: 0.75 }, { kind: 'shield', name: 'Storm Hide', note: 'A charged hide.', time: 1.3, cd: 5.3 },
    { kind: 'thunderstrike', name: 'Revenant Storm', note: 'Lightning tears the arena apart.', power: 1.65, size: 1.4 }, ['Stormling', 'Stormhorn Revenant']),
  'Whitehorn Colossus': BX('FROST', 'titan', '#d8e8f0', 'stomp',
    { name: 'Frost Spike', look: 'bx_frostspike', status: 'freeze', power: 1.45, note: 'A spike of permafrost.' },
    { name: 'Permafrost Stomp', style: 'strike', status: 'freeze', power: 1.7, note: 'A huge stomp: a ring of frost spikes races outward.' },
    { kind: 'leap', name: 'Colossus Leap', note: 'Leaps and shakes the ground.', dist: 1.6, cd: 0.85 }, { kind: 'fortress', name: 'Glacier Body', note: 'Turns to solid ice.', time: 1.6, cd: 5.8 },
    { kind: 'boulderstorm', name: 'Avalanche', note: 'An avalanche buries the arena.', power: 1.7, size: 1.4 }, ['Whitehorn', 'Whitehorn Colossus']),
  'Golden Dread Chimera': BX('ASTRAL', 'deity', '#ffc81a', 'hover',
    { name: 'Sun Feather', look: 'bx_sunfeather', shots: 2, status: 'dazzle', power: 1.45, note: 'Throws two burning golden feathers.' },
    { name: 'Sunfang Dive', style: 'bolt', status: 'burn', power: 1.75, note: 'Flaps high, dives and explodes in a burst of sunfire.' },
    { kind: 'leap', name: 'Sky Dive', note: 'Dives from above.', dist: 1.9, cd: 0.75 }, { kind: 'barrier', name: 'Gold Wings', note: 'Wraps itself in golden wings.', time: 1.4, cd: 5.5 },
    { kind: 'nova', name: 'Black Sun', note: 'A dark sun explodes over the arena.', power: 1.75, size: 1.45 }, ['Chimera Cub', 'Golden Dread Chimera']),
});


// Rikkolo: the founder's amber ki warrior. Tap to fire a ki laser; hold and a golden disc hovers in front of him and charges
// into a yellow ball that keeps growing (one hand planted on the ground), then he throws it.
Object.assign(CHK_SIG, {
  'Rikkolo': { type: 'ASTRAL', cls: 'striker', title: 'Amber Ki Warrior', female: false, main: '#ffd23a',
    sig: { basic: { name: 'Solar Disc Blast', look: 'solar', status: 'burn', power: 1.5, note: 'Tap: a fast ki laser shot. Hold: a golden disc hovers and charges into a yellow ball that grows bigger and bigger while one hand stays planted on the ground, then he throws it.' },
      special: { name: 'Piercing Ki Laser', style: 'beam', status: 'stun', power: 1.6, reach: 1.2, note: 'A thin, drilling ki laser fired from two fingers that stuns.' },
      dash: { kind: 'blink', name: 'Afterimage Step', note: 'Moves so fast he leaves an afterimage behind.', dist: 1.9, cd: 0.7 },
      guard: { kind: 'reflect', name: 'Ki Deflect', note: 'Slaps shots back with a burst of ki.', time: 1.2, cd: 5.1 },
      mega: { kind: 'nova', name: 'Solar Supernova', note: 'A sun of ki explodes over the arena.', power: 1.7, size: 1.4 } },
    names: ['Twin Ki Laser', 'Drill Ki Laser', 'Solar Sovereign'], forms: ['Amber Initiate', 'Amber Warden', 'Rikkolo', 'Rikkolo Ascendant', 'Solar Rikkolo', 'Rikkolo, the Amber Sun'] },
});


// The Elemental Quartet: Terra (earth), Pyra (fire), Zephyria (wind) and Nexus (all five elements, in black). Each charges a
// blast (hold to gather, release to fire); Nexus draws water, fire, earth, wind and lightning into one orb. Founder's wallet + market.
Object.assign(CHK_SIG, {
  'Terra': { type: 'STONE', cls: 'warden', title: 'Earth Bender', female: true, main: '#3a8a3a', market: 1,
    sig: { basic: { name: 'Granite Palm', look: 'qt_terra', status: 'stun', power: 1.45, note: 'A palm strike that hurls a slab of granite. Hold to charge: rock and green earth-light gather into a boulder that grows, then she throws it.' },
      special: { name: 'Faultline Kick', style: 'strike', status: 'stun', power: 1.55, note: 'A kick splits the ground: golden rock crystals burst up under the rival.' },
      dash: { kind: 'leap', name: 'Stone Step', note: 'Springs off a rising stone.', dist: 1.7, cd: 0.78 },
      guard: { kind: 'fortress', name: 'Basalt Guard', note: 'A dome of basalt rises around her.', time: 1.5, cd: 5.5 },
      mega: { kind: 'pillars', name: 'Titan Rise', note: 'Giant crystal pillars erupt across the arena.', power: 1.6, size: 1.35 } },
    names: ['Granite Twin Palm', 'Faultline Fury', 'Titan Crown'], forms: ['Terra', 'Terra Initiate', 'Terra', 'Ascended Terra', 'Master Terra', 'Ultimate Terra'] },
  'Pyra': { type: 'EMBER', cls: 'striker', title: 'Fire Bender', female: true, main: '#ff3a1a', market: 1,
    sig: { basic: { name: 'Ember Palm', look: 'qt_pyra', status: 'burn', power: 1.45, note: 'A focused heat strike. Hold to charge: a fireball swells between her hands, then she fires it.' },
      special: { name: 'Flame Whip', style: 'whip', status: 'burn', power: 1.55, note: 'A long lash of fire.' },
      dash: { kind: 'burst', name: 'Cinder Spin', note: 'A spinning flame kick that carries her forward.', dist: 1.8, cd: 0.72 },
      guard: { kind: 'absorb', name: 'Heat Veil', note: 'A veil of heat swallows hits.', time: 1.3, cd: 5.3 },
      mega: { kind: 'nova', name: 'Phoenix Rise', note: 'She rises on phoenix wings and the arena bursts into flame.', power: 1.65, size: 1.4 } },
    names: ['Twin Ember Palm', 'Inferno Whip', 'Phoenix Queen'], forms: ['Pyra', 'Pyra Initiate', 'Pyra', 'Ascended Pyra', 'Master Pyra', 'Ultimate Pyra'] },
  'Zephyria': { type: 'GALE', cls: 'skirmisher', title: 'Wind Bender', female: true, main: '#9ae8ff', market: 1, motion: 'hover',
    sig: { basic: { name: 'Gale Palm', look: 'qt_zephyria', status: 'soak', power: 1.4, note: 'A palm of wind. Hold to charge: a spinning sphere of wind grows, then she blows it out.' },
      special: { name: 'Cyclone Kick', style: 'cone', status: 'soak', power: 1.55, note: 'A spinning kick that throws a cone of cyclone wind.' },
      dash: { kind: 'leap', name: 'Sky Updraft', note: 'An updraft lifts her up and over.', dist: 1.9, cd: 0.7 },
      guard: { kind: 'reflect', name: 'Wind Shield', note: 'A ring of wind turns shots back.', time: 1.3, cd: 5.2 },
      mega: { kind: 'tornado', name: 'Sky Cyclone', note: 'A huge cyclone tears across the arena.', power: 1.6, size: 1.35 } },
    names: ['Twin Gale Palm', 'Cyclone Storm', 'Sky Sovereign'], forms: ['Zephyria', 'Zephyria Initiate', 'Zephyria', 'Ascended Zephyria', 'Master Zephyria', 'Ultimate Zephyria'] },
  'Nexus': { type: 'ANCIENT', cls: 'mystic', title: 'All-Element Bender', female: true, main: '#a050ff', market: 1.5,
    sig: { basic: { name: 'Nexus Blast', look: 'qt_nexus', status: 'mark', power: 1.5, note: 'Hold to charge: water, fire, earth, wind and lightning trails gather into one orb, then she releases the combined Nexus Blast.' },
      special: { name: 'Lightning Arc', style: 'beam', status: 'paralyze', power: 1.6, note: 'A violet arc of lightning.' },
      dash: { kind: 'phase', name: 'Wind Vortex', note: 'Spins away inside a vortex of wind.', dist: 1.8, cd: 0.72 },
      guard: { kind: 'barrier', name: 'Water Spiral', note: 'A spiral of water wraps around her.', time: 1.4, cd: 5.4 },
      mega: { kind: 'omnistorm', name: 'Five Elements Unified', note: 'Water, fire, earth, wind and lightning crash down together.', power: 1.7, size: 1.45 } },
    names: ['Fire Burst', 'Earth Rise', 'Nexus Sovereign'], forms: ['Nexus', 'Nexus Initiate', 'Nexus', 'Ascended Nexus', 'Master Nexus', 'Ultimate Nexus'] },
});


// The Ultimate Warriors (male): Vulkar (fire), Karnolith (earth), Aeralon (wind) and Obsidian Nexus (all five elements, black),
// the strongest and fastest of all: he teleports behind the rival and his Mega Shot splits him into five who all attack at once.
Object.assign(CHK_SIG, {
  'Vulkar': { type: 'EMBER', cls: 'striker', title: 'Ultimate Fire Warrior', female: false, main: '#ff5a10', market: 1.5,
    sig: { basic: { name: 'Solar Forge', look: 'um_vulkar', status: 'burn', power: 1.55, note: 'Tap: a burning fireball. Hold: he raises both hands overhead and forges a solar fireball that keeps growing, then hurls it down on the rival.' },
      special: { name: 'Kiln Breaker', style: 'cone', status: 'burn', power: 1.65, note: 'A heel stomp sends a jet of sparks and flame forward.' },
      dash: { kind: 'trail', name: 'Ember Step', note: 'A rapid sidestep out of a fiery afterimage that burns the rival.', dist: 1.9, cd: 0.68 },
      guard: { kind: 'counter', name: 'Furnace Uppercut', note: 'Blocks, then answers with a rising flame-hook uppercut.', time: 1.15, cd: 5.0 },
      mega: { kind: 'meteors', name: 'Sunfall Forge', note: 'Solar fireballs rain down across the arena.', power: 1.8, size: 1.45 } },
    names: ['Twin Solar Forge', 'Kiln Inferno', 'Forge King'], forms: ['Vulkar', 'Vulkar Initiate', 'Vulkar', 'Ascended Vulkar', 'Master Vulkar', 'Ultimate Vulkar'] },
  'Karnolith': { type: 'STONE', cls: 'titan', title: 'Ultimate Earth Warrior', female: false, main: '#8a6a3a', market: 1.5,
    sig: { basic: { name: 'Shard Volley', look: 'um_karnolith', shots: 3, status: 'stun', power: 1.5, note: 'Tap: tosses a spread of basalt spikes. Hold: a glowing stone orb grows between his fists, then he hurls it.' },
      special: { name: 'Quarry Hammer', style: 'strike', status: 'stun', power: 1.75, note: 'A two-fist overhead slam that cracks the ground under the rival.' },
      dash: { kind: 'charge', name: 'Bedrock Rush', note: 'A shoulder charge behind a moving wall of stone.', dist: 1.7, cd: 0.8 },
      guard: { kind: 'fortress', name: 'Bedrock Wall', note: 'A wall of bedrock rises in front of him.', time: 1.6, cd: 5.6 },
      mega: { kind: 'pillars', name: 'Monolith Drop', note: 'He raises a monolith and drops it forward; pillars burst up across the arena.', power: 1.85, size: 1.5 } },
    names: ['Basalt Storm', 'Quarry Quake', 'Mountain King'], forms: ['Karnolith', 'Karnolith Initiate', 'Karnolith', 'Ascended Karnolith', 'Master Karnolith', 'Ultimate Karnolith'] },
  'Aeralon': { type: 'GALE', cls: 'skirmisher', title: 'Ultimate Wind Warrior', female: false, main: '#bfefff', market: 1.5, motion: 'hover',
    sig: { basic: { name: 'Shear Blade', look: 'um_aeralon', shots: 2, status: 'soak', power: 1.5, note: 'Crossed arms launch two narrow air crescents. Hold: a bright air orb spins up, then he releases it.' },
      special: { name: 'Jetstream Lunge', style: 'beam', status: 'soak', power: 1.65, note: 'A rapid low punch carried forward by a jet of compressed wind.' },
      dash: { kind: 'blink', name: 'Skystep Feint', note: 'A quick aerial sidestep with a white slipstream.', dist: 2.0, cd: 0.62 },
      guard: { kind: 'evade', name: 'Slipstream', note: 'Rides the wind out of reach.', time: 1.15, cd: 5.0 },
      mega: { kind: 'tornado', name: 'Tempest Ladder', note: 'A rising ladder of three air rings becomes a storm.', power: 1.8, size: 1.45 } },
    names: ['Twin Shear Storm', 'Jetstream Fury', 'Sky King'], forms: ['Aeralon', 'Aeralon Initiate', 'Aeralon', 'Ascended Aeralon', 'Master Aeralon', 'Ultimate Aeralon'] },
  'Obsidian Nexus': { type: 'ANCIENT', cls: 'deity', title: 'Ultimate Warrior of All Elements', female: false, main: '#1a1024', market: 3,
    sig: { basic: { name: 'Fivefold Lance', look: 'um_obsidian', status: 'mark', power: 1.7, note: 'Hold: blue water, orange fire, amber earth, white wind and purple lightning gather into a two-handed orb, then he releases a focused five-colour lance.' },
      special: { name: 'Steam Collider', style: 'cone', status: 'burn', power: 1.85, note: 'Water and fire collide into a forward burst of scalding steam.' },
      dash: { kind: 'shadow', name: 'Obsidian Teleport', note: 'Vanishes and reappears right behind the rival.', dist: 2.2, cd: 0.55 },
      guard: { kind: 'barrier', name: 'Pressure Lock', note: 'A white spiralling wind cage compresses around him.', time: 1.6, cd: 5.0 },
      mega: { kind: 'clones', count: 4, each: 0.5, name: 'Obsidian Legion', note: 'Splits into five (himself and four copies) and all five fire his attack at once: five times the damage.', power: 2.0, size: 1.5 } },
    names: ['Storm Shrapnel', 'Steam Cataclysm', 'Obsidian Sovereign'], forms: ['Obsidian Nexus', 'Obsidian Initiate', 'Obsidian Nexus', 'Ascended Obsidian Nexus', 'Master Obsidian Nexus', 'Ultimate Obsidian Nexus'] },
});

const CHK = name => {
  const k0 = CHK_SIG[name], ix = Object.keys(CHK_SIG).indexOf(name), tw = (o, ...f) => { const r = { ...o }; for (const x of f) r[x] = +(r[x] + ix * 0.004).toFixed(3); return r; }; // every Chosen One has its own dash and guard numbers
  const k = { ...k0, sig: { ...k0.sig, dash: tw(k0.sig.dash, 'dist', 'cd'), guard: tw(k0.sig.guard, 'time', 'cd') } };
  const b = BE(name, k.type, k.cls, k.sig.basic.name, k.sig.special.name, k.sig.basic.look === 'crescent' || k.sig.basic.look === 'ki' ? 'projectile' : 'projectile', k.sig.special.style === 'levitate' ? 'projectile' : 'projectile', k.main, k.title, true);
  return { ...b, master: true, battleForms: false, female: k.female, legendary: true, legendFor: 'gift', unique: undefined, bender: true, elite: true, ...(k0.el2 ? { el2: k0.el2 } : {}), ...(k0.motion ? { motion: k0.motion } : {}),
    forms: k0.forms || [`${name} Acolyte`, `${name} Disciple`, name, `${name} Knight`, `${name} Lord`, `${name}, the Chosen`], tiers: chosenTiers(k, k.names), sig: k.sig,
    lore: { pronounce: name, ancientTitle: `${name}, ${k.title}`, meaning: `A Chosen One of the saber order: ${k.title}.` } };
};

// Aurelia and Amyah: elite women benders gifted to Ashley's wallet (appended last so no species id moves).
export const GIFT_ELITES = [
  { ...CHK('Aurelia'), name: 'Aurelia' },
  { ...CHK('Amyah'), name: 'Amyah' },
];

// Aura Warriors: original fighters from the creator's own drawings. Stronger than benders (stats +75%). In battle they can
// power up into Aura forms (I gold Lv3, II purple Lv10, III green Lv25, IV red Lv50, V white Lv80), then turn back to normal.
// Each has its own mix of energy powers (and some element powers). Gifted to the founder and sold once each in the market.
const AW_SPECIALS = [ // one per warrior: every Aura Warrior has its own power, with its own look
  { special: 'Surge Wave', style: 'beam', sig: { note: 'A huge energy wave fired from both hands.' } },
  { special: 'Halo Disc', style: 'projectile', sig: { look: 'disc', homing: true, seek: true, note: 'A spinning energy disc that follows the rival around the arena until it hits.' } },
  { special: 'Ki Volley', style: 'projectile', sig: { shots: 3, look: 'ki', note: 'Fires 3 or 4 energy blasts at once.' } },
  { special: 'Goo Wrap', style: 'projectile', sig: { look: 'goo', shots: 2, leech: 0.25, status: 'stun', note: 'Stretchy pink goo blobs that wrap the rival and hold it still; a little of the damage heals you.' } },
  { special: 'Spiral Beam', style: 'beam', sig: { reach: 1.3, note: 'A drilling spiral beam that reaches very far.' } },
  { special: 'Drain Sting', style: 'projectile', sig: { look: 'sting', homing: true, leech: 0.6, note: 'A green stinger that chases the rival and absorbs its energy: 60% of the damage heals you.' } },
  { special: 'Thunder Roar', style: 'projectile', sig: { look: 'roar', big: 2.2, knock: 3, status: 'stun', note: 'Only Bunzo has it: a roar so loud it becomes a wall of sound that rolls across the arena, throws the rival back and stuns it.' } },
  { special: 'Prism Shards', style: 'projectile', sig: { look: 'shard', shots: 4, note: 'A fan of 4 or 5 razor crystal shards.' } },
  { special: 'Ring Snare', style: 'projectile', sig: { look: 'ring', homing: true, note: 'Glowing energy rings that curve after the rival and lock it in place.' } },
  { special: 'Star Blaster', style: 'beam', sig: { reach: 1.15, note: 'A full-power blaster beam fired from the hip.' } },
];
const AW_MEGAS = [
  ['meteors', 'World Sphere', 'A giant sphere of gathered energy crashes down around the rival.'],
  ['lance', 'Final Surge', 'An enormous energy beam across the whole arena.'],
  ['nova', 'Galaxy Burst', 'Explodes with energy in every direction.'],
  ['barrage', 'Ki Storm', 'Seven homing energy blasts.'],
  ['lightning', 'Spirit Orbs', 'Seven energy orbs chase the rival; the first one stuns.'],
  ['thunderstrike', 'Sky Lightning', 'Lightning strikes crash down; the first one stuns.'],
];
const AW = (i, name, type, cls, main, female, status) => {
  const S2 = AW_SPECIALS[i % AW_SPECIALS.length], [mk, mn, note] = AW_MEGAS[(i * 5 + 1) % AW_MEGAS.length];
  const base = F(name, type, cls, 'Ki blast', S2.special, 'projectile', S2.style, ['dart', 'skate', 'stomp', 'dart', 'prance', 'blink', 'stomp', 'dart', 'stomp', 'dart'][i], 'walker', main, '#ffffff', main, {});
  return { ...base, aura: true, female, drop: { priceLamports: '1500000000', shop: true },
    forms: [`Young ${name}`, `${name} the Fighter`, name, `${name} Prime`, `Mega ${name}`, `Ascended ${name}`],
    sig: { basic: { name: 'Ki Blast', look: 'ki', shots: 2, note: 'Two quick energy blasts.' },
      special: { name: S2.special, ...(status && S2.style === 'projectile' ? { status } : {}), ...S2.sig },
      dash: { kind: 'blink', name: `${name} Flash Step`, note: 'Teleports: vanishes and reappears a good way off in a blink, leaving an after-image behind.', dist: +(1.6 + i * 0.03).toFixed(2), cd: +(0.9 + i * 0.03).toFixed(2) },
      mega: M(mk, `${name} ${mn}`, note, +(1.32 + i * 0.01).toFixed(2), 1.2) } };
};
export const AURA_WARRIORS = [
  AW(0, 'Dashi', 'GALE', 'striker', '#c8a46a', false, null),
  AW(1, 'Bolo', 'SPARK', 'ranger', '#3a8ad8', false, 'paralyze'),
  AW(2, 'Swish', 'STONE', 'titan', '#9aa0aa', false, 'stun'),
  AW(3, 'Kapri', 'EMBER', 'skirmisher', '#e8508a', true, 'burn'),
  AW(4, 'Nyla', 'SPARK', 'mystic', '#a8e0f0', true, 'paralyze'),
  AW(5, 'Verdo', 'VENOM', 'arcanist', '#3aff6a', false, 'poison'),
  AW(6, 'Bunzo', 'STONE', 'warden', '#ff5a1a', false, 'stun'),
  AW(7, 'Tigo', 'DRACO', 'seraph', '#ff8a1f', false, 'burn'),
  AW(8, 'Vikko', 'FROST', 'titan', '#2aa84a', false, 'stun'),
  AW(9, 'Noxx', 'SHADE', 'striker', '#2a3a34', false, null),
];

// Watcher Gods: ten Egyptian / Anunnaki machine-gods from the creator's own pictures. As strong as the Aura Warriors
// (stats +75%). They lift rivals into the air, fire ancient technology (lasers, scarab drones, sun discs) and fight in
// the Egyptian and Mayan temple arenas. Each is the ancestor of a line of other Monstars (see `lineage` in monstars.mjs).
const WG_SPECIALS = [
  { special: 'Soul Scales', style: 'levitate', sig: { note: 'Lifts the rival off the ground with an unseen force, weighs it, and throws it down.' } },
  { special: 'Path Opener', style: 'beam', sig: { reach: 1.3, note: 'A long golden beam that opens a path across the whole arena.' } },
  { special: 'Scarab Drones', style: 'projectile', sig: { look: 'drone', shots: 3, homing: true, note: 'Launches 3 or 4 flying scarab drones that hunt the rival.' } },
  { special: 'Gravity Lift', style: 'levitate', sig: { note: 'Switches off gravity under the rival: it floats up helpless, then drops.' } },
  { special: 'Circuit Web', style: 'projectile', sig: { look: 'ring', homing: true, status: 'stun', note: 'A glowing ring of circuitry that curves after the rival and locks it in place.' } },
  { special: 'Throne Light', style: 'strike', sig: { note: 'A pillar of light comes down on the rival from the sky.' } },
  { special: 'Forge Laser', style: 'beam', sig: { note: 'A white-hot laser from the maker\'s forge.' } },
  { special: 'Sun Disc', style: 'projectile', sig: { look: 'disc', homing: true, seek: true, status: 'burn', note: 'A burning sun disc that follows the rival until it hits.' } },
  { special: 'Bull Quake', style: 'strike', sig: { note: 'Stamps the ground: the earth bursts open under the rival.' } },
  { special: 'Cobra Venom', style: 'projectile', sig: { look: 'sting', homing: true, leech: 0.4, status: 'poison', note: 'A striking venom dart that chases the rival, poisons it and feeds you 40% of the damage.' } },
];
const WG_MEGAS = [
  ['judgment', 'Final Weighing', 'Lifts the rival high into the air, then a pillar of light slams it down.'],
  ['lance', 'Gate of the West', 'An enormous beam across the whole arena.'],
  ['barrage', 'Swarm of Khepri', 'Seven homing scarab drones.'],
  ['nova', 'Duat Collapse', 'Gravity bursts outward in every direction.'],
  ['lightning', 'Net of Stars', 'Seven star orbs chase the rival; the first one stuns.'],
  ['thunderstrike', 'Wrath of the Throne', 'Bolts of light crash down; the first one stuns.'],
  ['meteors', 'Hammer of the Maker', 'Molten metal rains down around the rival.'],
  ['stormdrain', 'Eclipse', 'Strikes rain over a wide area and 45% of the damage heals you.'],
  ['meteors', 'Stampede of Heaven', 'The sky bull\'s herd crashes down around the rival.'],
  ['drain', 'Serpent Crown', 'A draining beam that feeds on the rival.'],
];
const WG = (i, name, type, cls, main, female) => {
  const S2 = WG_SPECIALS[i], [mk, mn, note] = WG_MEGAS[i];
  const base = F(name, type, cls, 'Ankh bolt', S2.special, 'bolt', S2.style, ['stomp', 'dart', 'stomp', 'glide', 'glide', 'glide', 'stomp', 'dart', 'charge', 'glide'][i], 'walker', main, '#ffffff', main, {});
  return { ...base, god: true, female,
    forms: [`${name} Idol`, `${name} Acolyte`, name, `${name} the Watcher`, `High ${name}`, `${name} Eternal`],
    sig: { basic: { name: 'Ankh Bolt', note: 'A bolt of old light from the hand.' }, special: { name: S2.special, ...S2.sig },
      dash: { kind: 'blink', name: `${name} Star Gate`, note: 'Steps through a gate and reappears a good way off.', dist: +(1.5 + i * 0.02).toFixed(2), cd: +(1.0 + i * 0.02).toFixed(2) },
      mega: M(mk, `${name} ${mn}`, note, +(1.34 + i * 0.01).toFixed(2), 1.25) } };
};
export const WATCHER_GODS = [
  WG(0, 'Anpurak', 'SHADE', 'deity', '#e0b028', false),
  WG(1, 'Wepwarr', 'STEEL', 'striker', '#c8ccd4', false),
  WG(2, 'Khemtek', 'ANCIENT', 'arcanist', '#2a3e58', false),
  WG(3, 'Duatron', 'PSYCHIC', 'psion', '#8a8f98', false),
  WG(4, 'Selqira', 'WATCHER', 'mystic', '#c8ccd4', true),
  WG(5, 'Isetra', 'ASTRAL', 'seraph', '#1e2a4a', true),
  WG(6, 'Ptahrex', 'STEEL', 'titan', '#b8643a', false),
  WG(7, 'Khnumek', 'EMBER', 'ranger', '#b8643a', false),
  WG(8, 'Apisor', 'STONE', 'warden', '#e0b028', false),
  WG(9, 'Wadjeth', 'VENOM', 'skirmisher', '#e0d8c0', false),
];

// Element Masters: the creator's four element benders (COVO, above, is the fifth: all five elements). They replace every
// earlier bender. The four buttons never change, but the power on a button is replaced by a stronger one as the bender
// levels up (`tiers`: from that level, these parts of the kit take over). New players choose one of the four; Spira is gifted.
const EM = (name, el, cls, main, forms, tiers) => ({ ...ST(name, el, cls, main, false), master: true, forms, tiers });
export const ELEMENT_MASTERS = [
  EM('Terrok', 'earth', 'titan', '#3a6a1e', ['Terrok', 'Terrok Focused Flow', 'Terrok Stone Armor', 'Terrok Earth Ascendant', 'Terrok Terra Form', 'Terrok Gaia Form'], [
    { lv: 1, basic: { name: 'Triple Slab Slide', look: 'boulder', shots: 3, knock: 2, note: 'A palm strike that sends three stone slabs sliding along the ground at different angles and speeds.' }, special: { name: 'Rock Spike', style: 'strike', note: 'Stone spikes burst up under the rival.' }, guard: { name: 'Earth Shield', note: 'A ring of stone rises around him.' } },
    { lv: 10, special: { name: 'Earth Wave', style: 'cone', power: 1.1, note: 'A wave of rock and earth rolls forward.' } },
    { lv: 25, basic: { name: 'Boulder Toss', look: 'boulder', knock: 3, note: 'Lifts a huge boulder and hurls it.' }, special: { name: 'Stone Pillar', style: 'strike', power: 1.2, note: 'Pillars of stone shoot up under the rival.' }, guard: { name: 'Earth Wall', note: 'A wall of stone columns blocks hits.' } },
    { lv: 50, special: { name: 'Quake Burst', style: 'strike', power: 1.35, note: 'Slams the ground: the whole floor breaks open around the rival.' } } ]),
  EM('Zephar', 'air', 'skirmisher', '#7a4ad8', ['Young Zephar', 'Zephar Enhanced Flow', 'Zephar', 'Zephar Wind Master', 'Zephar Sky Ascendant', 'Zephar Cloud Sage'], [
    { lv: 1, basic: { name: 'Air Push', look: 'gust', knock: 3, note: 'An open-palm strike that fires rings of wind.' }, special: { name: 'Air Slash', style: 'cone', note: 'A low lunge that sweeps a blade of wind.' }, dash: { name: 'Air Dash', note: 'Shoots forward on a stream of wind.' }, guard: { name: 'Air Shield', note: 'A sphere of spinning wind blocks hits.' } },
    { lv: 10, special: { name: 'Air Cyclone', style: 'levitate', note: 'A cyclone spins up, lifts the rival off the ground and throws it.' } },
    { lv: 25, basic: { name: 'Twin Air Push', look: 'gust', shots: 2, knock: 2, note: 'Two palm strikes: two rings of wind.' }, special: { name: 'Air Burst', style: 'strike', power: 1.2, note: 'Drops to the ground: the air explodes around the rival.' }, dash: { name: 'Glider Flight', note: 'Glides a long way on the wind glider.' } },
    { lv: 50, special: { name: 'Sky Levitation', style: 'levitate', power: 1.35, note: 'Rises cross-legged into the air: a huge wind lifts the rival high and drops it.' } } ]),
  EM('Tydal', 'water', 'mystic', '#1e3aa8', ['Tydal', 'Tydal Flowing Form', 'Tydal Tidal Form', 'Tydal Raging Tide', 'Tydal Ocean Form', 'Tydal Divine Current'], [
    { lv: 1, basic: { name: 'Water Push', look: 'ice', knock: 2, note: 'A palm strike that fires a ring of water.' }, special: { name: 'Water Whip', style: 'cone', note: 'A sweeping arm lashes a whip of water.' }, guard: { name: 'Water Shield', note: 'A sphere of water surrounds him.' }, dash: { name: 'Water Surge', note: 'Rides a burst of water a good way off.' } },
    { lv: 10, special: { name: 'Water Wave', style: 'beam', note: 'A great wave rolls across the arena.' } },
    { lv: 25, basic: { name: 'Water Spear', look: 'ice', shots: 2, note: 'Spear-hand thrusts of hard water.' }, special: { name: 'Water Whirlpool', style: 'levitate', power: 1.15, note: 'A whirlpool spins the rival up and around.' } },
    { lv: 50, special: { name: 'Water Dragon', style: 'projectile', look: 'dragon', homing: true, seek: true, big: 1.6, power: 1.4, note: 'A dragon of water that hunts the rival until it bites.' } } ]),
  EM('Ignar', 'fire', 'striker', '#c81e1e', ['Young Ignar', 'Ignar', 'Ascended Ignar', 'Ascended Ignar II', 'Ascended Ignar III', 'Divine Ignar'], [
    { lv: 1, basic: { name: 'Fire Ball', look: 'fire', status: 'burn', note: 'A straight punch that fires a ball of flame.' }, special: { name: 'Flame Stomp', style: 'strike', note: 'A fist to the ground: fire bursts up under the rival.' }, guard: { name: 'Flame Guard' } },
    { lv: 10, special: { name: 'Fire Spiral', style: 'cone', power: 1.1, note: 'A jumping spin kick that throws a spiral of fire.' } },
    { lv: 25, basic: { name: 'Twin Flames', look: 'fire', shots: 2, status: 'burn', note: 'A one-two punch: two balls of flame.' }, special: { name: 'Fire Tornado', style: 'projectile', look: 'firenado', homing: true, power: 1.2, note: 'A whirlwind of fire that follows the rival.' } },
    { lv: 50, special: { name: 'Inferno Wave', style: 'beam', power: 1.4, note: 'Both fists forward: a river of fire across the arena.' } } ]),
  // AZAELION, the Eternal Chosen One: the Fifth Element Bender from the creator's Chosen One sheets. A separate character from COVO:
  // he commands all five elements (earth, wind, fire, water, lightning) and the Fifth Element. One of a kind, gifted to the founder.
  { ...BE('Azaelion', 'GALE', 'deity', 'Fire gust', 'Ice balls', 'projectile', 'projectile', '#5a1ab0', 'Eternal Chosen One', true), master: true, battleForms: true, // starts every fight in his natural form and transforms as he fights (see sim powerUp) el2: 'all', sky: true, unique: true, legendFor: 'gift', speedBoost: 1.35,
    forms: ['Natural Azaelion', 'Elemental Azaelion', 'Harmonic Azaelion', 'Ascendant Azaelion', 'Transcendent Azaelion', 'Ultimate Chosen One Azaelion'],
    lore: { pronounce: 'Ah-ZAY-lee-on', ancientTitle: 'Azaelion, the Firstborn of Eternity', meaning: 'The one who existed before time, commands all elements, and transcends the power of gods.' },
    sig: { ...FINAL_SIG('Azaelion', 2), dash: { kind: 'blink', name: 'Azaelion Teleport', note: 'Teleports a long way in a blink (very short recharge).', dist: 1.83, cd: 0.71 },
      basic: { name: 'Elemental Surge', look: 'firenado', homing: true, status: 'burn', knock: 3, note: 'A whirlwind of the elements that follows the rival until it hits, and burns.' },
      special: { name: 'Fifth Element Bolts', shots: 3, look: 'icezap', status: 'freeze', zap: true, note: 'Shoots 3 orbs of ice and lightning from the staff: they freeze, and an electric zap jumps out.' } } },
  // SPIRA, the Tide-Spiral Bender: the creator's water bender with golden curl buns and the blue spiral on her forehead
  // (art-src/masters/spira/). Every power plays its own animated cast from her sprite sheet. Appended last so no species id moves.
  { ...EM('Spira', 'water', 'mystic', '#1677e8', ['Spira Initiate', 'Spira Ripple Form', 'Spira Current Form', 'Spira Tidal Form', 'Spira Abyssal Form', 'Spira, the Spiral Sovereign'], [
    { lv: 1, basic: { name: 'Droplet Volley', look: 'ice', shots: 2, note: 'Pulls a bead of water from the air and flicks spinning droplets at the rival.' }, special: { name: 'Spiral Lash', style: 'cone', note: 'A water whip cracks forward and coils into a spiral snare.' },
      guard: { name: 'Tidal Mirror', kind: 'reflect', note: 'A spinning disc of water catches shots and sprays them back.' }, dash: { name: 'Undertow Rush', note: 'Rides a jet of current straight through, then flips up with a rising palm.' },
      mega: { name: 'Grand Maelstrom', note: 'Her spiral mark ignites into a crown of water and the whole arena turns into one spinning maelstrom.' } },
    { lv: 10, special: { name: 'Coral Geyser', style: 'strike', power: 1.1, note: 'A stomp sends a ripple along the floor: a pillar of water erupts under the rival.' } },
    { lv: 25, basic: { name: 'Bubble Lock', look: 'ice', status: 'soak', knock: 2, note: 'A bubble swells as it drifts, swallows the rival and seals with her spiral mark.' }, special: { name: 'Rain Needles', style: 'strike', power: 1.2, note: 'Leaps high and rains frozen needles across the floor ahead.' } },
    { lv: 50, special: { name: 'Maelstrom Crown Cannon', style: 'beam', power: 1.4, note: 'A whirlpool halo opens behind her and two spiralling streams braid into one tide cannon across the arena.' } } ]),
    starter: undefined, female: true, legendary: true, legendFor: 'gift',
    lore: { pronounce: 'SPY-ra', ancientTitle: 'Spira, the Spiral Sovereign', meaning: 'The spiral on her brow is the source of every tide she bends.' } },
  // The creator's second set of element benders, cut from their own character sheets (art-src/masters/<name>_sheet.png).
  // Appended last so no species id moves. They are not in the new-player starter choice (that stays the first four).
  ...[EM('Aerix', 'air', 'skirmisher', '#4a8ad8', ['Young Aerix', 'Aerix Enhanced Flow', 'Aerix', 'Aerix Wind Master', 'Aerix Sky Ascendant', 'Aerix Cloud Sage'], [
    { lv: 1, basic: { name: 'Air Push', look: 'gust', knock: 3, note: 'A palm strike that fires rings of wind.' }, special: { name: 'Air Slash', style: 'cone', note: 'A low lunge that sweeps a blade of wind.' }, dash: { name: 'Air Dash', note: 'Shoots forward on a stream of wind.' }, guard: { name: 'Air Shield', note: 'A bubble of spinning wind blocks hits.' } },
    { lv: 10, special: { name: 'Air Cyclone', style: 'levitate', note: 'A cyclone lifts the rival off the ground and throws it.' } },
    { lv: 25, basic: { name: 'Twin Air Push', look: 'gust', shots: 2, knock: 2, note: 'Two palm strikes: two rings of wind.' }, special: { name: 'Air Burst', style: 'strike', power: 1.2, note: 'Drops low: the air explodes around the rival.' }, dash: { name: 'Glider Flight', note: 'Glides a long way on his wind glider.' } },
    { lv: 50, special: { name: 'Air Levitation', style: 'levitate', power: 1.35, note: 'Floats up cross-legged: a huge wind lifts the rival high and drops it.' } } ]),
  EM('Bouldar', 'earth', 'titan', '#4a7a1e', ['Bouldar', 'Bouldar Focused Flow', 'Bouldar Stone Skin', 'Bouldar Earth Awakened', 'Bouldar Terra Form', 'Bouldar Gaia Form'], [
    { lv: 1, basic: { name: 'Triple Slab Slide', look: 'boulder', shots: 3, knock: 2, note: 'A palm strike that sends three stone slabs sliding along the ground at different angles and speeds.' }, special: { name: 'Rock Spike', style: 'strike', note: 'Stone spikes burst up under the rival.' }, guard: { name: 'Earth Shield', note: 'A ring of boulders rises around him.' } },
    { lv: 10, special: { name: 'Earth Wave', style: 'cone', power: 1.1, note: 'A wave of rock and dirt rolls forward.' } },
    { lv: 25, basic: { name: 'Boulder Toss', look: 'boulder', knock: 3, note: 'Lifts a huge boulder over his head and hurls it.' }, special: { name: 'Earth Pillar', style: 'strike', power: 1.2, note: 'Stone pillars shoot up under the rival.' }, guard: { name: 'Earth Wall', note: 'A wall of stone columns blocks hits.' } },
    { lv: 50, special: { name: 'Tremor', style: 'strike', power: 1.35, note: 'Slams the ground: the whole floor shatters around the rival.' } } ]),
  EM('Nerin', 'water', 'mystic', '#1e4ac8', ['Nerin', 'Nerin Flowing Form', 'Nerin Tidal Form', 'Nerin Raging Tide', 'Nerin Ocean Form', 'Nerin Divine Current'], [
    { lv: 1, basic: { name: 'Water Push', look: 'ice', knock: 2, note: 'A palm strike that fires a ring of water.' }, special: { name: 'Water Whip', style: 'cone', note: 'A sweeping arm lashes a whip of water.' }, guard: { name: 'Water Shield', note: 'A sphere of water surrounds him.' }, dash: { name: 'Water Surge', note: 'Rides a burst of water a good way off.' } },
    { lv: 10, special: { name: 'Water Wave', style: 'beam', note: 'A great wave rolls across the arena.' } },
    { lv: 25, basic: { name: 'Water Spear', look: 'ice', shots: 2, note: 'Hurls spears of hard water.' }, special: { name: 'Water Whirlpool', style: 'levitate', power: 1.15, note: 'A whirlpool spins the rival up and around.' } },
    { lv: 50, special: { name: 'Water Dragon', style: 'projectile', look: 'dragon', homing: true, seek: true, big: 1.6, power: 1.4, note: 'A dragon of water hunts the rival until it bites.' } } ]),
  { ...EM('Zuri', 'water', 'mystic', '#2a6ae8', ['Zuri', 'Zuri Rising Tide', 'Golden Zuri', 'Zuri Storm Crown', 'Zuri Radiant Ocean', 'Zuri, Queen of the Tide'], [
    { lv: 1, basic: { name: 'Tide Palm', look: 'ice', knock: 3, note: 'An open palm sends a spiral of water at the rival.' }, special: { name: 'Spiral Orb', style: 'projectile', look: 'ki', homing: true, status: 'soak', note: 'A glowing orb of water and energy that curves after the rival.' }, guard: { name: 'Water Veil', note: 'Rings of water circle her and block hits.' } },
    { lv: 10, special: { name: 'Rising Torrent', style: 'levitate', power: 1.1, note: 'Fists clenched, she powers up: a torrent lifts the rival and throws it down.' } },
    { lv: 25, basic: { name: 'Twin Tide Palm', look: 'ice', shots: 2, knock: 2, note: 'Two palms: two spirals of water.' }, special: { name: 'Golden Spiral Orb', style: 'projectile', look: 'ki', shots: 2, homing: true, status: 'soak', power: 1.2, note: 'Two energy orbs that chase the rival.' } },
    { lv: 50, special: { name: 'Golden Tsunami', style: 'beam', power: 1.4, note: 'A wave of water charged with golden energy across the whole arena.' } } ]), female: true },
  EM('Verdex', 'thunder', 'striker', '#2ad82a', ['Verdex', 'Verdex Charged', 'Verdex Emerald Surge', 'Verdex Storm Blade', 'Verdex Thunder King', 'Verdex Emerald Overlord'], [
    { lv: 1, basic: { name: 'Emerald Orb', look: 'ki', status: 'paralyze', note: 'Throws a crackling ball of green energy that paralyzes.' }, special: { name: 'Energy Blade Slash', style: 'cone', note: 'A low slash with his green energy blade.' }, guard: { name: 'Emerald Barrier', note: 'Green lightning wraps around him and blocks hits.' } },
    { lv: 10, special: { name: 'Blade Wave', style: 'beam', power: 1.1, note: 'Swings the blade: a wave of green energy cuts across the arena.' } },
    { lv: 25, basic: { name: 'Twin Emerald Orbs', look: 'ki', shots: 2, status: 'paralyze', note: 'Two balls of green energy.' }, special: { name: 'Lightning Cleave', style: 'strike', power: 1.25, note: 'Drives the blade into the ground: green lightning bursts up under the rival.' } },
    { lv: 50, special: { name: 'Emerald Overdrive', style: 'beam', power: 1.4, note: 'His hair blazes: a huge green energy beam across the arena.' } } ]),
  ].map(m => ({ ...m, starter: undefined })),
];

// The new Chosen Ones (appended last so no species id moves).
export const NEW_FIGHTERS = ['Dawnward', 'Verdant Crown', 'Suncrest Tide', 'Amethyst Lynx', 'Cinderblade', 'Verdant Fang', 'Lion Regent', 'Cyan Shade', 'Sun Pharaoh', 'Orbit Ranger', 'Reactor Alchemist', 'Stormcaller', 'Crimson Ronin', 'Crown Street', 'Halo Sentinel', 'Ember Warden', 'Nerida', 'Ignessa', 'Terrasa', 'Zephyra', 'Etheria'].map(n => CHK(n));
// Sold in the market (Sky Bender shop) at 1 SOL (Tide, Ember, Volt, Stone Weavers, Halo Slinger) or 2 SOL (Eclipse Sovereign); strong from level 1 and able to ascend
export const WEAVERS = ['Eclipse Sovereign', 'Tide Weaver', 'Ember Weaver', 'Volt Weaver', 'Stone Weaver', 'Halo Slinger'].map(n => { const b = CHK(n), sol = CHK_SIG[n].market;
  return { ...b, master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true, drop: { priceLamports: String(sol * 1_000_000_000), shop: true } }; });
export const CHOSEN_ONES = ['AKENA', 'Azaelion Void', 'Azmara', 'Kaelion', 'Malakar', 'Nymara', 'Solarius', 'Zayron', 'Pyrelion', 'Glacion', 'Rosalis', 'Thalassa'].map(CHK);

export const ANCIENTS = ['Sariel the Watcher', 'Nerath the Nephilim', 'Enkar the Anunnaki'].map(n => { const b = CHK(n), sol = CHK_SIG[n].market;
  return { ...b, master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true, drop: { priceLamports: String(Math.round(sol * 1_000_000_000)), shop: true } }; });

// Boss Monsters (see BX above): founder-only, never wild, never caught. Strong like the founder's own fighters (aura stats).
export const BOSS_NAMES = ['Thornmaw', 'Cinderwing', 'Crimson Harrow', 'Briarcoil', 'Abyss Siren', 'Brine Viper', 'Gilded Asp', 'Null Lancer', 'Rift Talon', 'Hydra Matron',
  'Iceback Ravager', 'Paleclaw', 'Sable Ossuary', 'Lantern Reaper', 'Briar Inquisitor', 'Ashscale Bulwark', 'Rimeforged Sentinel', 'Stormhorn Revenant', 'Whitehorn Colossus', 'Golden Dread Chimera'];
export const BOSSES = BOSS_NAMES.map(n => { const b = CHK(n), k = CHK_SIG[n];
  return { ...b, master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true, boss: true, serpent: k.motion === 'glide' || undefined,
    forms: [n, n, n, n + ' Ascendant', 'Elder ' + n, 'Dread ' + n], /* a boss is always shown by its own name */ lore: { pronounce: n, ancientTitle: n + ', Boss Monster', meaning: 'A boss of the Boss Arena.' } }; });

// Rikkolo (founder only, never wild, only the founder may sell him)
export const RIKKOLO = ['Rikkolo'].map(n => ({ ...CHK(n), master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true }));

// The Elemental Quartet: in the founder's wallet and sold once each in the market (like the Weavers)
export const QUARTET = ['Terra', 'Pyra', 'Zephyria', 'Nexus'].map(n => { const b = CHK(n), sol = CHK_SIG[n].market;
  return { ...b, master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true, boost: 1.15, drop: { priceLamports: String(Math.round(sol * 1_000_000_000)), shop: true } }; });

// The Ultimate Warriors: founder's wallet + sold once each in the market. Obsidian Nexus is the strongest and fastest of all.
export const ULTIMATE_MEN = ['Vulkar', 'Karnolith', 'Aeralon', 'Obsidian Nexus'].map(n => { const b = CHK(n), sol = CHK_SIG[n].market;
  return { ...b, master: undefined, legendary: undefined, legendFor: undefined, bender: undefined, elite: undefined, aura: true, boost: n === 'Obsidian Nexus' ? 1.4 : 1.25, speedBoost: n === 'Obsidian Nexus' ? 1.6 : undefined,
    drop: { priceLamports: String(Math.round(sol * 1_000_000_000)), shop: true } }; });
