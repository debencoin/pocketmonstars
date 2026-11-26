// Boss Arena: the Boss Monsters (founder-only, never wild), solo 1v2 / 2v2 / 3v2, online raids where each player drives
// their own Monstar against harder bosses, and the ancient seal (badge) every winner earns for the level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { openDb } from '../server/db.mjs';
import { Registry } from '../server/registry.mjs';
import { MatchManager } from '../server/matches.mjs';
import { CONFIG } from '../server/config.mjs';
import { SPECIES, BOSS_IDS, WILD_IDS, SHOP_IDS, Monstar } from '../shared/monstars.mjs';
import { BOSS_STAGES, bossLevel } from '../shared/bosses.mjs';
import { TICK } from '../shared/sim.mjs';

const wallet = () => Keypair.generate().publicKey.toBase58();
const MASTER = 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ';
const mgr = () => { const db = openDb(':memory:'), registry = new Registry(db, { gifts: CONFIG.gifts, masterOnly: CONFIG.masterOnly, legendaryOwner: MASTER });
  return { db, registry, mm: new MatchManager({ db, registry, chain: {}, config: { disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } }) }; };

test('20 Boss Monsters with their own powers: never in the wild or the shop, in the founder wallet, only the founder may sell', () => {
  assert.equal(BOSS_IDS.length, 20);
  for (const id of BOSS_IDS) { const s = SPECIES[id]; assert.ok(s.boss && s.aura, s.name); assert.ok(!WILD_IDS.includes(id) && !SHOP_IDS.includes(id), s.name + ' is never met in the wild or sold in the shop');
    assert.ok(CONFIG.gifts[MASTER].includes(id), s.name + ' is in the founder wallet'); assert.equal(CONFIG.masterOnly[id], MASTER); }
  const specials = new Set(BOSS_IDS.map(id => SPECIES[id].kit.special.name)), looks = new Set(BOSS_IDS.map(id => SPECIES[id].kit.basic.look));
  assert.equal(specials.size, 20, 'every boss has its own special'); assert.equal(looks.size, 20, 'and its own shot');
  for (const id of BOSS_IDS) assert.ok(String(SPECIES[id].kit.basic.look).startsWith('bx_'), 'boss shots look like nothing else');
  assert.equal(BOSS_STAGES.length, 15); for (const st of BOSS_STAGES) assert.ok(SPECIES[st.bosses[0]].serpent, `level ${st.stage} has a serpent`);
});

test('bosses level above the team: solo +1..2, online together +3..5', () => {
  for (let i = 0; i < 50; i++) { const s = bossLevel([4, 7], false), c = bossLevel([4, 7], true); assert.ok(s >= 8 && s <= 9, 'solo ' + s); assert.ok(c >= 10 && c <= 12, 'online ' + c); }
});

test('solo 1v2: your Monstar against two bosses; a win earns the level badge', () => {
  const { registry, mm } = mgr(), w = wallet(), [m] = registry.claimAll(w);
  assert.throws(() => mm.createBoss(w, { stage: 1, serials: [BOSS_IDS[0]], coop: false }), /own|Boss/);
  const room = mm.createBoss(w, { stage: 1, serials: [m.serial] });
  assert.equal(room.players[1].team.length, 2); for (let i = 0; i < 200; i++) mm.tick(TICK);
  assert.equal(room.state, 'live'); assert.equal(room.sim.roster[1].length, 2); assert.equal(room.sim.roster[0].length, 1);
  for (const f of room.sim.roster[1]) f.hp = 0; mm.tick(TICK);
  assert.deepEqual(mm.badges(w).map(b => b.stage), [1]);
});

test('online raid: Phantom only, players join with one Monstar each and drive their own; everyone gets the badge', () => {
  const { registry, mm } = mgr(), a = wallet(), b = wallet(), c = wallet(), ma = registry.claimAll(a)[0], mb = registry.claimAll(b)[0], mc = registry.claimAll(c)[0];
  assert.throws(() => mm.createBoss('@kid', { stage: 2, serials: [1], coop: true }), /Phantom/);
  const room = mm.createBoss(a, { stage: 2, serials: [ma.serial], coop: true, size: 3 });
  assert.equal(room.state, 'waiting'); assert.equal(mm.openRaids().length, 1);
  mm.joinBoss(b, { code: room.code, serial: mb.serial }); assert.equal(room.state, 'waiting');
  mm.joinBoss(c, { code: room.code, serial: mc.serial }); assert.equal(room.state, 'countdown', 'full raids start by themselves');
  assert.throws(() => mm.joinBoss(wallet(), { code: room.code, serial: 1 }), /not open|full/);
  for (let i = 0; i < 200; i++) mm.tick(TICK);
  assert.equal(room.state, 'live'); assert.equal(room.sim.roster[0].length, 3); assert.ok(room.sim.roster[0].every(f => f.human));
  const solo = new Monstar({ speciesId: BOSS_IDS[0], level: room.boss.level }).stats.hp * 1.3;
  assert.ok(room.sim.roster[1][0].maxHp > solo * 1.5, 'online bosses have more HP for every extra player');
  mm.input(b, { mx: 1, my: 0 }); assert.equal(room.sim.roster[0][1].input.mx, 1, "b drives b's own Monstar");
  for (const f of room.sim.roster[1]) f.hp = 0; mm.tick(TICK);
  for (const w of [a, b, c]) assert.deepEqual(mm.badges(w).map(x => x.stage), [2]);
});

test('the four starter Masters and Rikkolo charge; the Masters\' charged blast fires twice as many shots', async () => {
  const S = await import('../shared/sim.mjs'), M = await import('../shared/monstars.mjs');
  for (const n of ['Terrok', 'Zephar', 'Tydal', 'Ignar', 'Rikkolo']) {
    const id = M.SPECIES.find(s => s.name === n).id, m = S.createMatch(new M.Monstar({ speciesId: id, level: 5 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 5 }), { auto: false });
    const shotsFor = holdTicks => { const mm = S.createMatch(new M.Monstar({ speciesId: id, level: 5 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 5 }), { auto: false });
      let n2 = 0; for (let i = 0; i < holdTicks + 3; i++) { mm.fighters[0].input = S.sanitizeInput({ atk: i < holdTicks, ax: 1 }); mm.fighters[1].input = S.sanitizeInput({}); S.step(mm); n2 = Math.max(n2, mm.projectiles.filter(p => p.owner === 0).length); } return n2; };
    const tap = shotsFor(2), held = shotsFor(Math.round(1.4 / S.TICK));
    assert.ok(held >= 1 && tap >= 1, n + ' fires');
    if (n !== 'Rikkolo') assert.equal(held, tap * 2, n + ': a charged blast fires twice as many'); else assert.equal(held, tap);
    void m;
  }
});

test('Ultimate Warriors: Obsidian Nexus is the strongest and fastest, teleports, and his Legion is five of him (5x the damage)', async () => {
  const S = await import('../shared/sim.mjs'), M = await import('../shared/monstars.mjs');
  const id = n => M.SPECIES.find(s => s.name === n).id, ob = M.SPECIES[id('Obsidian Nexus')];
  assert.equal(ob.kit.dash.kind, 'shadow'); assert.equal(ob.kit.mega.count, 4);
  const stats = n => new M.Monstar({ speciesId: id(n), level: 20, dna: '7'.repeat(64) }).stats, total = o => Object.values(o).reduce((a, b) => a + b, 0);
  for (const n of ['Vulkar', 'Karnolith', 'Aeralon', 'COVO', 'Nexus']) assert.ok(total(stats('Obsidian Nexus')) > total(stats(n)), 'stronger than ' + n);
  const m = S.createMatch(new M.Monstar({ speciesId: ob.id, level: 10 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 10 }), { auto: false });
  m.fighters[0].ult = 100; m.fighters[0].input = S.sanitizeInput({ mega: true, ax: 1 }); m.fighters[1].input = S.sanitizeInput({}); const ev = S.step(m);
  const cl = ev.find(e => e.type === 'clones'); assert.equal(cl?.pts.length, 4, 'four copies');
  const shots = m.projectiles.filter(p => p.owner === 0), pw = shots.reduce((n, p) => n + p.pw, 0);
  assert.equal(shots.length, 10); assert.ok(Math.abs(pw / (shots[0].pw / 0.5) - 5) < 1e-6, 'all together: five times a power attack');
  for (const n of ['Vulkar', 'Karnolith', 'Aeralon', 'Obsidian Nexus', 'Terra', 'Pyra', 'Zephyria', 'Nexus']) assert.ok(m && M.SPECIES[id(n)].aura, n);
});

test('Enki: a charged Storm Crown detonates right in front of the rival; ANU: Soul Siphon heals him, his titan fights beside him', async () => {
  const S = await import('../shared/sim.mjs'), M = await import('../shared/monstars.mjs'), id = n => M.SPECIES.find(s => s.name === n).id;
  const m = S.createMatch(new M.Monstar({ speciesId: id('Enki'), level: 10 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 10 }), { auto: false });
  let eb = null; for (let i = 0; i < Math.round(1.6 / S.TICK) + 3 && !eb; i++) { m.fighters[0].input = S.sanitizeInput({ atk: i < Math.round(1.2 / S.TICK), ax: 1 }); m.fighters[1].input = S.sanitizeInput({}); S.step(m); eb = m.effects.find(e => e.eb); }
  assert.ok(eb, 'the storm disc detonates'); const foe = m.fighters[1]; assert.ok(Math.hypot(eb.gx - foe.x, eb.gy - foe.y) < 40, 'right in front of the rival'); assert.ok(eb.rad > 120, 'a big blast');
  const a = S.createMatch(new M.Monstar({ speciesId: id('ANU'), level: 10 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 10 }), { auto: false });
  assert.equal(a.fighters[0].kit.special.leech, 0.8);
  a.fighters[0].ult = 100; a.fighters[0].input = S.sanitizeInput({ mega: true, ax: 1 }); a.fighters[1].input = S.sanitizeInput({}); const ev = S.step(a);
  assert.ok(ev.some(e => e.type === 'summon') && a.summons.length === 1, 'the titan appears');
  a.fighters[0].input = S.sanitizeInput({});
  let shots = 0; for (let i = 0; i < Math.round(4 / S.TICK); i++) { S.step(a); shots = Math.max(shots, a.projectiles.filter(p => p.sid === a.summons[0]?.sid).length); }
  assert.ok(shots >= 1, 'the titan attacks the rival'); assert.ok(S.snapshot(a).sm.length === 1);
});

test('the paper-thin wild Monstars are deleted: never met in the wild, and unminted copies leave every wallet', async () => {
  const M = await import('../shared/monstars.mjs');
  const ids = M.DELETED_THIN.map(n => M.SPECIES.find(s => s.name === n).id);
  assert.equal(ids.length, 11);
  for (const id of ids) { assert.ok(M.SPECIES[id].retired && !M.WILD_IDS.includes(id)); }
  for (let i = 0; i < 3000; i++) assert.ok(!ids.includes(M.rollWild(Math.random())));
  const db = openDb(':memory:'), reg0 = new Registry(db), w = wallet(); const m = reg0.claimAll(w)[0];
  db.prepare('UPDATE monstars SET species=? WHERE serial=?').run(ids[0], m.serial); db.prepare("DELETE FROM meta WHERE k='delete-thin-v1'").run();
  new Registry(db); assert.equal(db.prepare('SELECT COUNT(*) n FROM monstars WHERE species=?').get(ids[0]).n, 0, 'the unminted copy is gone');
});

test('Jachin and Boaz: fallen angel brothers that fly; Boaz holds the rival in a trance while he attacks, Jachin rises once when he falls', async () => {
  const S = await import('../shared/sim.mjs'), M = await import('../shared/monstars.mjs'), id = n => M.SPECIES.find(s => s.name === n).id;
  for (const n of ['Jachin', 'Boaz']) { const sp = M.SPECIES[id(n)]; assert.equal(sp.motion, 'hover'); assert.ok(!sp.aura, 'no aura: they already glow'); assert.ok(!M.WILD_IDS.includes(sp.id)); assert.ok(CONFIG.masterOnly[sp.id]); }
  // Gravestar Dominion: the rival is pulled to the star and entranced; it can't act, then the star collapses on it
  const b = S.createMatch(new M.Monstar({ speciesId: id('Boaz'), level: 10 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 10 }), { auto: false });
  b.fighters[0].ult = 100; b.fighters[0].input = S.sanitizeInput({ mega: true, ax: 1 }); b.fighters[1].input = S.sanitizeInput({});
  const ev = S.step(b); assert.ok(ev.some(e => e.type === 'gravestar')); const foe = b.fighters[1]; assert.equal(foe.status?.k, 'trance');
  b.fighters[0].input = S.sanitizeInput({}); const hp0 = foe.hp; let held = 0;
  for (let i = 0; i < 400 && foe.status?.k === 'trance'; i++) { foe.input = S.sanitizeInput({ mx: 1, atk: true }); S.step(b); if (foe.status?.k === 'trance') held++; }
  assert.ok(held > 100, 'held in the trance'); assert.ok(foe.hp < hp0, 'the star collapses on it');
  // Trance Eye: a special that entrances, never back to back
  const t = S.createMatch(new M.Monstar({ speciesId: id('Boaz'), level: 10 }), new M.Monstar({ speciesId: M.STARTER_IDS[0], level: 10 }), { auto: false });
  assert.equal(t.fighters[0].kit.special.status, 'trance');
  // Jachin: Skybreak Edict throws the rival away; Second Rising brings him back once
  const j = S.createMatch(new M.Monstar({ speciesId: id('Jachin'), level: 10 }), new M.Monstar({ speciesId: M.WILD_IDS[0], level: 10 }), { auto: false });
  const J = j.fighters[0], R = j.fighters[1]; R.x = J.x + 120; R.y = J.y; const d0 = Math.hypot(R.x - J.x, R.y - J.y);
  J.ult = 100; J.input = S.sanitizeInput({ mega: true, ax: 1 }); R.input = S.sanitizeInput({}); const e2 = S.step(j); J.input = S.sanitizeInput({});
  assert.ok(e2.some(e => e.type === 'skybreak')); for (let i = 0; i < 10; i++) S.step(j); assert.ok(Math.hypot(R.x - J.x, R.y - J.y) > d0 + 60, 'hurled away');
  J.hp = 0; const e3 = S.step(j); assert.ok(e3.some(e => e.type === 'rise')); assert.ok(J.hp >= J.maxHp * 0.45 && !j.over, 'he rises with half his HP');
  J.hp = 0; S.step(j); assert.ok(j.over, 'only once per battle');
});
