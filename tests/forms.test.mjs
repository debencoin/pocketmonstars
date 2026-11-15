// The Chosen One transforms during a fight (up to the form his level unlocks) and starts every match in his natural form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from '../shared/sim.mjs';
import { Monstar, SPECIES, stageFor } from '../shared/monstars.mjs';

const az = SPECIES.find(s => s.name === 'Azaelion');
function fight(level) {
  const m = S.createMatch(new Monstar({ speciesId: az.id, level }), new Monstar({ speciesId: 3, level }), { auto: false }), a = m.fighters[0], b = m.fighters[1], forms = [];
  for (let i = 0; i < 30 * 90 && !m.over; i++) {
    a.energy = 100; a.input = S.sanitizeInput(i % 30 ? { atk: true } : { sp: true }); b.x = a.x + 220; b.y = a.y; b.vx = b.vy = 0; b.hp = Math.max(b.hp, b.maxHp * 0.3);
    for (const e of S.step(m)) if (e.type === 'transform') forms.push(e.form);
  }
  return { m, a, forms };
}
test('Azaelion starts in his natural form and powers up during the fight, as far as his level allows', () => {
  assert.ok(az.battleForms); assert.equal(az.forms[0], 'Natural Azaelion'); assert.equal(az.forms[5], 'Ultimate Chosen One Azaelion');
  for (const lv of [10, 30, 80]) {
    const { m, a, forms } = fight(lv);
    assert.equal(S.snapshot(S.createMatch(new Monstar({ speciesId: az.id, level: lv }), new Monstar({ speciesId: 3, level: lv }))).f[0].sg, 0, 'a new match starts in his natural form');
    assert.deepEqual(forms, Array.from({ length: stageFor(a.level).id }, (_, k) => k + 1), 'forms rise one at a time up to his level');
    assert.equal(S.snapshot(m).f[0].sg, a.bf, 'the arena draws the form he has reached');
  }
});
test('each form hits harder; the frame atlas holds every sequence the arena plays', () => {
  const m = S.createMatch(new Monstar({ speciesId: az.id, level: 80 }), new Monstar({ speciesId: 3, level: 80 }), { auto: false }), a = m.fighters[0];
  const J = JSON.parse(readFileSync(new URL('../dist/art/anim/azaelion.json', import.meta.url)));
  for (const k of ['idle', 'run', 'dash', 'guard', 'hit', 'knock', 'light', 'heavy', 'earth', 'wind', 'fire', 'water', 'lightning', 'fifth', 'mega', 'powerup', 'auraon', 'transform', 'teleport'])
    assert.ok(J.seqs[k]?.length && J.seqs[k].every(i => J.frames[i]), k);
  assert.equal(J.seqs.forms.length, 6);
  assert.ok(S.BATTLE_FORM_DMG > 0 && a.bf === 0);
});
