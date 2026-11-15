// One-of-a-kind wild Monstars: released from the founder's wallet, Rare, caught once, then never spawn again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { openDb } from '../server/db.mjs';
import { Registry } from '../server/registry.mjs';
import { SPECIES, WILD_IDS, WILD_ONE_IDS, LEGENDARY_IDS, rollWild, markWildOne } from '../shared/monstars.mjs';

test('a released Monstar leaves the founder wallet, rolls in the wild as Rare, and only the first catch gets it', () => {
  const founder = Keypair.generate().publicKey.toBase58(), a = Keypair.generate().publicKey.toBase58(), b = Keypair.generate().publicKey.toBase58();
  const sp = SPECIES.find(s => s.name === 'Verdex'), db = openDb(':memory:');
  const before = new Registry(db, { gifts: { [founder]: [sp.id] } });
  assert.ok(before.claimAll(founder).some(m => m.species.id === sp.id), 'the founder held it as a gift');

  markWildOne(['Verdex']);
  assert.equal(sp.tier, 'Rare'); assert.ok(sp.wildOne && WILD_IDS.includes(sp.id) && WILD_ONE_IDS.includes(sp.id) && !LEGENDARY_IDS.includes(sp.id));
  const reg = new Registry(db, { gifts: { [founder]: [sp.id] } }); // restart: the unminted gift is released
  assert.ok(!reg.claimAll(founder).some(m => m.species.id === sp.id), 'gone from the founder wallet and never re-gifted');
  assert.equal(reg.wildOneTaken(sp.id), false);

  const seen = new Set(); for (let i = 0; i < 4000; i++) seen.add(rollWild(Math.random()));
  assert.ok(seen.has(sp.id), 'it can be met in the wild');

  const mine = reg.catchWild(a, sp.id, 30);
  assert.equal(mine.owner, a); assert.equal(reg.wildOneTaken(sp.id), true);
  assert.throws(() => reg.catchWild(b, sp.id, 30), /one of a kind/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM monstars WHERE species=?').get(sp.id).n, 1, 'exactly one exists');
  for (let i = 0; i < 4000; i++) assert.notEqual(rollWild(Math.random(), id => SPECIES[id].wildOne && reg.wildOneTaken(id)), sp.id, 'caught: never spawns again');
});
