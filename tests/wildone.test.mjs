// One-of-a-kind wild Monstars: released from the founder's wallet, Rare, the one wild copy is caught once and never spawns again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { openDb } from '../server/db.mjs';
import { Registry } from '../server/registry.mjs';
import { CONFIG } from '../server/config.mjs';
import { SPECIES, WILD_IDS, WILD_ONE_IDS, WILD_ONE_NAMES, rollWild, markWildOne } from '../shared/monstars.mjs';

test('the founder released 37 Monstars: Seraphon, Psyvolt, the Ascendants, the Legend Heroes and the Watcher Gods (COVO stays)', () => {
  assert.equal(WILD_ONE_NAMES.length, 37); assert.equal(WILD_ONE_IDS.length, 37); assert.ok(!WILD_ONE_NAMES.includes('COVO'), 'COVO is not released');
  for (const id of WILD_ONE_IDS) { const sp = SPECIES[id]; assert.ok(sp.wildOne && sp.tier === 'Rare' && WILD_IDS.includes(id) && !sp.drop, sp.name); }
  assert.ok(!CONFIG.gifts[CONFIG.legendaryOwner].some(id => SPECIES[id].wildOne), 'no longer gifted to the founder');
  assert.ok(CONFIG.gifts['5eKeqSopYotsxwfE2uCJoyFywzqmXFe92NQR8kbHqaGd'].length === 10, 'the gods\' creator keeps their own set');
  assert.throws(() => markWildOne(['Terrok']), /starter/);
});

test('a released Monstar leaves the founder wallet; only the first catch gets the wild copy', () => {
  const founder = Keypair.generate().publicKey.toBase58(), other = Keypair.generate().publicKey.toBase58(), a = Keypair.generate().publicKey.toBase58(), b = Keypair.generate().publicKey.toBase58();
  const sp = SPECIES.find(s => s.name === 'Thothex'), db = openDb(':memory:');
  new Registry(db, { gifts: { [founder]: [sp.id], [other]: [sp.id] } }).claimAll(founder); // copies handed out before the release
  new Registry(db, { gifts: { [other]: [sp.id] } }).claimAll(other);
  const reg = new Registry(db, { legendaryOwner: founder, gifts: { [founder]: [sp.id], [other]: [sp.id] } }); // server restart
  assert.ok(!reg.claimAll(founder).some(m => m.species.id === sp.id), 'gone from the founder wallet and never re-gifted');
  assert.ok(reg.claimAll(other).some(m => m.species.id === sp.id), 'another wallet keeps its own copy');
  assert.equal(reg.wildOneTaken(sp.id), false);

  const seen = new Set(); for (let i = 0; i < 6000; i++) seen.add(rollWild(Math.random()));
  assert.ok(seen.has(sp.id), 'it can be met in the wild');
  const mine = reg.catchWild(a, sp.id, 30);
  assert.equal(mine.owner, a); assert.equal(reg.wildOneTaken(sp.id), true);
  assert.throws(() => reg.catchWild(b, sp.id, 30), /one of a kind/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM monstars WHERE species=? AND owner IN (?,?)').get(sp.id, a, b).n, 1, 'exactly one wild copy');
  for (let i = 0; i < 6000; i++) assert.notEqual(rollWild(Math.random(), id => SPECIES[id].wildOne && reg.wildOneTaken(id)), sp.id, 'caught: never spawns again');
  new Registry(db, { legendaryOwner: a }); assert.equal(reg.get(mine.serial).owner, a, 'a restart never takes the caught copy away, even from the founder wallet');
});

test('the catcher earns the 5% royalty on every resale of a one-of-a-kind, even a Watcher God, and keeps it after a restart', async () => {
  const { saleSplit } = await import('../server/nft.mjs'), { metadataJson } = await import('../server/registry.mjs');
  const catcher = Keypair.generate().publicKey.toBase58(), db = openDb(':memory:'), creators = CONFIG.creators;
  const god = SPECIES.find(s => s.name === 'Anpurak'), reg = new Registry(db, { creators });
  const m = reg.catchWild(catcher, god.id, 5);
  assert.equal(m.originOwner, catcher);
  const again = new Registry(db, { creators }).get(m.serial); // server restart: creator collections move royalties, but not a caught one
  assert.equal(again.originOwner, catcher);
  const meta = metadataJson(again, 'https://x', CONFIG.royaltyBps);
  assert.equal(meta.seller_fee_basis_points, 500); assert.equal(CONFIG.royaltyBps, 500);
  const split = saleSplit(1_000_000_000n, CONFIG.royaltyBps, [{ address: again.originOwner, percentage: 100 }], true);
  assert.equal(split.royalty, 50_000_000n); assert.equal(split.payouts[0].address, catcher, '5% of a 1 SOL resale goes to the catcher');
});
