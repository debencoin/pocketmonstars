import test from 'node:test';
import assert from 'node:assert/strict';

test('Chosen Ones: 14 saber-bearers, all as strong as Element Masters, each with its own powers that grow at levels 10, 25 and 50', async () => {
  const { SPECIES, kitAt } = await import('../shared/monstars.mjs');
  const names = ['AKENA', 'Amyah', 'Aurelia', 'Azaelion Void', 'Azmara', 'Kaelion', 'Malakar', 'Nymara', 'Solarius', 'Zayron', 'Pyrelion', 'Glacion', 'Rosalis', 'Thalassa'];
  const cs = names.map(n => SPECIES.find(s => s.name === n)); assert.ok(cs.every(Boolean));
  assert.ok(cs.every(s => s.master && !s.retired && s.walker !== undefined));
  assert.equal(new Set(cs.map(s => s.kit.special.name)).size, 14); assert.equal(new Set(cs.map(s => s.kit.basic.name)).size, 14);
  for (const s of cs) { assert.ok(kitAt(s, 50).special.power > kitAt(s, 1).special.power, s.name + ' grows'); assert.notEqual(kitAt(s, 50).special.name, kitAt(s, 1).special.name); }
  assert.ok(['AKENA', 'Amyah', 'Aurelia', 'Azmara', 'Nymara', 'Rosalis', 'Thalassa'].every(n => SPECIES.find(s => s.name === n).female));
});

test('Elemental benders charge: a held shot grows and hits harder, a tap fires the normal shot', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES } = await import('../shared/monstars.mjs');
  const bl = SPECIES.find(s => s.name === 'Blazen'), other = SPECIES.find(s => s.name === 'Kaelion');
  const run = hold => {
    const m = S.createMatch(new Monstar({ speciesId: bl.id, level: 30 }), new Monstar({ speciesId: other.id, level: 30 }), { auto: false });
    const a = m.fighters[0]; a.x = 200; a.y = 300; m.fighters[1].x = 700; m.fighters[1].y = 300; a.fx = 1; a.fy = 0; let shot = null;
    for (let i = 0; i < 30 * 4 && !shot; i++) { a.input = S.sanitizeInput({ atk: i < hold }); S.step(m); m.fighters[1].hp = m.fighters[1].maxHp; shot = m.projectiles.find(p => p.owner === 0 && p.kind === 'basic') || null; }
    return shot;
  };
  const tap = run(2), held = run(42);
  assert.ok(tap && held); assert.ok(!tap.chg); assert.ok(held.chg > 0.9 && held.r > tap.r * 1.5 && held.pw > (tap.pw ?? 0));
  const m = S.createMatch(new Monstar({ speciesId: bl.id, level: 30 }), new Monstar({ speciesId: other.id, level: 30 }), { auto: false });
  m.fighters[0].input = S.sanitizeInput({ atk: true }); for (let i = 0; i < 20; i++) S.step(m);
  assert.ok(S.snapshot(m).f[0].cg > 0, 'the snapshot shows the charge');
});
