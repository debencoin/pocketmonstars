// Boss Arena: the fallen monsters' levels. Every level pits your team (1, 2 or 3 Monstars, or 2-3 players online together)
// against two bosses at once: a serpent and another monster. Solo, the bosses are 1-2 levels above your strongest Monstar;
// online with other players they are 3-5 levels above, hit harder and have more HP, so the team has to plan together.
// Beating a level earns an ancient Anunnaki seal (a badge) for that level, kept on the account.
import { SPECIES } from './monstars.mjs';

const id = n => { const s = SPECIES.find(x => x.name === n); if (!s) throw Error('Unknown boss ' + n); return s.id; };
// [title, serpent, monster, arena]  arenas: 0 Thunderstorm Citadel, 1 Inferno Rift, 2 Earthquake Dominion, 3 Frozen Abyss, 4 Tempest Coast
const RAW = [
  ['The Bramble Nest', 'Briarcoil', 'Thornmaw', 2],
  ['Cinder Shallows', 'Brine Viper', 'Cinderwing', 1],
  ['Blood Tide', 'Abyss Siren', 'Crimson Harrow', 4],
  ['Gilded Void', 'Gilded Asp', 'Null Lancer', 0],
  ['The Rift Coil', 'Briarcoil', 'Rift Talon', 2],
  ['Glacier Fangs', 'Brine Viper', 'Iceback Ravager', 3],
  ['Pale Depths', 'Abyss Siren', 'Paleclaw', 4],
  ['Ossuary Sands', 'Gilded Asp', 'Sable Ossuary', 0],
  ['Lantern Marsh', 'Briarcoil', 'Lantern Reaper', 2],
  ['Chains of the Deep', 'Abyss Siren', 'Briar Inquisitor', 4],
  ['Ashen Brine', 'Brine Viper', 'Ashscale Bulwark', 1],
  ['Rime Throne', 'Gilded Asp', 'Rimeforged Sentinel', 3],
  ['Storm of Scales', 'Hydra Matron', 'Stormhorn Revenant', 0],
  ['White Ruin', 'Hydra Matron', 'Whitehorn Colossus', 3],
  ['The Fallen Sun', 'Hydra Matron', 'Golden Dread Chimera', 1],
];
export const BOSS_STAGES = RAW.map(([title, a, b, arena], i) => ({ stage: i + 1, title, bosses: [id(a), id(b)], arena }));
export const BOSS_COOP = Object.freeze({ maxPlayers: 3, levelUp: [3, 5], hpPerExtraPlayer: 0.45, soloLevelUp: [1, 2], waitMs: 5 * 60_000 });

/** The bosses' level: above the strongest Monstar on your side (solo +1..2, online together +3..5). */
export function bossLevel(teamLevels, coop, rand = Math.random) {
  const [a, b] = coop ? BOSS_COOP.levelUp : BOSS_COOP.soloLevelUp, top = Math.max(1, ...teamLevels);
  return Math.min(100, top + a + Math.floor(rand() * (b - a + 1)));
}
export const stageOf = n => BOSS_STAGES[Math.max(0, Math.min(BOSS_STAGES.length - 1, (Number(n) || 1) - 1))];
