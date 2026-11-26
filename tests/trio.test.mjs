// COVO, COVA and Kena: three wallets each hold a copy, only the master wallet may sell them, and the 5% royalty is the master's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.mjs';
import { Registry } from '../server/registry.mjs';
import { CONFIG } from '../server/config.mjs';
import { SPECIES, BOSS_IDS } from '../shared/monstars.mjs';
import fs from 'node:fs';

const NAMES = ['COVO', 'COVA', 'Kena'], ID = n => SPECIES.find(s => s.name === n).id;
const MASTER = 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ', SECOND = '54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr', ASHLEY = 'HgPy9avE7tMVTgpehYwFQRQYGPUPbZKGzKPAuLNoeD3U';

test('the three are playable masters, not for sale in the store, with 24 frames of art each', () => {
  for (const n of NAMES) {
    const sp = SPECIES.find(s => s.name === n); assert.ok(sp.master && !sp.retired && sp.unique && !sp.drop, n);
    for (let st = 0; st < 6; st++) assert.ok(fs.existsSync(`dist/art/walk/${sp.art}_s${st}.png`), `${n} stage ${st}`);
  }
});

test('master, the second founder wallet and Ashley each get a copy; only the master can list; the master gets the royalty', () => {
  for (const w of [MASTER, SECOND, ASHLEY]) for (const n of NAMES) assert.ok(CONFIG.gifts[w].includes(ID(n)), `${w.slice(0, 4)} holds ${n}`);
  const db = openDb(':memory:'), reg = new Registry(db, { legendaryOwner: MASTER, royalOwner: SECOND, gifts: CONFIG.gifts, creators: CONFIG.creators, masterOnly: CONFIG.masterOnly });
  for (const w of [ASHLEY, SECOND, MASTER]) reg.claimAll(w);
  for (const n of NAMES) for (const w of [MASTER, SECOND, ASHLEY]) {
    const m = reg.ownedBy(w).find(x => x.species.id === ID(n)); assert.ok(m, `${n} in ${w.slice(0, 4)}`);
    assert.equal(m.originOwner, MASTER, 'the master earns the 5% royalty on every sale');
  }
  assert.deepEqual(Object.keys(CONFIG.masterOnly).map(Number).sort(), [...NAMES.map(ID), ID('Rikkolo'), ...BOSS_IDS].sort()); // + the Boss Monsters
  assert.ok(Object.values(CONFIG.masterOnly).every(w => w === MASTER));
});

test('COVO, COVA and Kena play frame-by-frame animation with 8 turnaround views and their own sheet effects', () => {
  for (const n of ['covo', 'cova', 'kena']) {
    const J = JSON.parse(fs.readFileSync(`dist/art/anim/${n}.json`, 'utf8'));
    for (const q of ['idle', 'run', 'dash', 'guard', 'hit', 'knock', 'light', 'heavy', 'earth', 'wind', 'fire', 'water', 'lightning', 'mega', 'forms']) assert.ok(J.seqs[q]?.length, `${n} ${q}`);
    assert.equal(J.seqs.dirs.length, 8, `${n} turnaround`);
    for (const el of ['earth', 'wind', 'fire', 'water', 'lightning']) assert.ok(fs.existsSync(`dist/art/fx/${n}_${el}.png`), `${n} ${el} effect`);
  }
});
