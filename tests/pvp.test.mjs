import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ed25519 } from '@noble/curves/ed25519';
import { SPECIES, CLASSES, Monstar, traitsFromDna, traitSignature } from '../shared/monstars.mjs';
import { StakeLedger, settlementSplit, toLamports, formatSol, validateStake, STAKE_POLICY } from '../shared/stake.mjs';
import { createMatch, step, sanitizeInput } from '../shared/sim.mjs';
import { openDb } from '../server/db.mjs';
import { Registry, deriveDna } from '../server/registry.mjs';
import { Auth, verifyWalletSignature } from '../server/auth.mjs';
import { MatchManager } from '../server/matches.mjs';
import { saleSplit } from '../server/nft.mjs';

const wallet = () => Keypair.generate().publicKey.toBase58();

test('nine species map to nine distinct classes with six stats', () => {
  assert.equal(SPECIES.filter(s => s.collection === 'genesis').length, 9); assert.equal(new Set(SPECIES.map(s => s.cls)).size, 12); assert.equal(CLASSES.length, 12);
  assert.equal(SPECIES.filter(s => s.collection === 'frontier').length, 50); assert.equal(SPECIES.filter(s => s.collection === 'mythic').length, 4);
  const m = new Monstar({ speciesId: 8, dna: deriveDna(wallet(), 8, 0), serial: 1 });
  assert.deepEqual(Object.keys(m.stats), ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed']);
  assert.equal(m.className, 'Titan'); assert.ok(m.toAttributes().some(a => a.trait_type === 'DNA' && a.value === m.dna));
});

test('DNA traits are deterministic and differ between wallets', () => {
  const a = wallet(), b = wallet();
  assert.deepEqual(traitsFromDna(deriveDna(a, 0, 0)), traitsFromDna(deriveDna(a, 0, 0)));
  assert.notEqual(traitSignature(0, traitsFromDna(deriveDna(a, 0, 0))), traitSignature(0, traitsFromDna(deriveDna(b, 0, 0))));
  assert.throws(() => traitsFromDna('xyz'));
});

test('registry gives each wallet nine one-of-a-kind Monstars and refuses duplicates', () => {
  const reg = new Registry(openDb(':memory:'));
  const a = wallet(), b = wallet();
  const mineA = reg.claimAll(a), mineB = reg.claimAll(b);
  assert.equal(mineA.length, 9); assert.equal(reg.claimAll(a)[0].serial, mineA[0].serial); // idempotent
  const all = [...mineA, ...mineB];
  assert.equal(new Set(all.map(m => m.dna)).size, 18);
  assert.equal(new Set(all.map(m => traitSignature(m.species.id, m.traits))).size, 18);
  // a forced duplicate is rejected by the database
  const row = reg.db.prepare('SELECT * FROM monstars WHERE serial=1').get();
  assert.throws(() => reg.db.prepare('INSERT INTO monstars(species,origin_owner,owner,dna,trait_sig,nonce,genesis,created_at) VALUES(?,?,?,?,?,?,0,?)')
    .run(row.species, b, b, deriveDna(b, 99, 99), row.trait_sig, 0, 0), /UNIQUE/);
  reg.bindAsset(1, wallet(), 'sig'); assert.throws(() => reg.bindAsset(1, wallet(), 'sig2'), /already minted/);
});

test('per-hit fees move lamports between shares and the pot is always conserved', () => {
  const L = new StakeLedger(toLamports('0.01'));
  for (let i = 0; i < 500; i++) { L.hit(i % 3 ? 0 : 1, 1 + (i % 17), 120); L.check(); }
  assert.ok(L.shares[0] > L.shares[1]);
  const tiny = new StakeLedger(STAKE_POLICY.minStake); assert.equal(tiny.hit(0, 0.0001, 150), 1n); // minimum 1 lamport per hit
  const ko = new StakeLedger(toLamports('0.05')); ko.hit(1, 30, 100); assert.deepEqual(ko.finish(0), [toLamports('0.1'), 0n]);
  assert.throws(() => validateStake(1000n), /Minimum/); assert.equal(validateStake(0n), 0n);
  assert.equal(formatSol(1n), '0.000000001'); assert.equal(toLamports('1.5'), 1_500_000_000n);
});

test('settlement drains the escrow exactly: players + 1 lamport company + network fee', () => {
  const s = settlementSplit({ escrowBalance: 20_000_000n, shares: [20_000_000n, 0n], winner: 0 });
  assert.equal(s.payouts[0] + s.payouts[1] + s.company + s.network, 20_000_000n);
  assert.equal(s.company, 1n); assert.equal(s.payouts[1], 0n);
  const d = settlementSplit({ escrowBalance: 2_000_007n, shares: [1_300_000n, 700_000n], winner: null });
  assert.equal(d.payouts[0] + d.payouts[1] + d.company + d.network, 2_000_007n);
});

test('Phantom sign-in verifies Ed25519 signatures and is single-use', () => {
  const kp = Keypair.generate(), w = kp.publicKey.toBase58(), auth = new Auth();
  const msg = auth.challenge(w);
  const sig = bs58.encode(ed25519.sign(Buffer.from(msg), kp.secretKey.slice(0, 32)));
  assert.ok(verifyWalletSignature(w, msg, sig));
  assert.ok(!verifyWalletSignature(wallet(), msg, sig));
  const { token } = auth.verify(w, sig); assert.equal(auth.wallet(token), w);
  assert.throws(() => auth.verify(w, sig), /expired/);
});

test('simulation sanitises inputs and produces hits and a result', () => {
  assert.deepEqual(sanitizeInput({ mx: 5, my: 0, ax: NaN }), { mx: 1, my: 0, ax: 0, ay: 0, atk: false, sp: false, dash: false, guard: false, sw: -1 });
  const m = createMatch(new Monstar({ speciesId: 0 }), new Monstar({ speciesId: 1 }), { auto: false });
  m.fighters[0].y = 60; m.fighters[1].y = 60; // clear line of fire above the centre rock
  m.fighters[0].input = sanitizeInput({ atk: true, sp: true, ax: 1, ay: 0 }); m.fighters[1].input = sanitizeInput({ mx: -0.3 });
  let hits = 0; for (let i = 0; i < 30 * 90 && !m.over; i++) hits += step(m).filter(e => e.type === 'hit').length;
  assert.ok(hits > 5); assert.ok(m.over); assert.equal(m.winner, 0);
});

class MockChain {
  constructor() { this.balances = new Map(); this.sent = []; }
  async verifyDeposit(sig, { to, lamports }) { if (sig.startsWith('bad')) throw Error('bad deposit'); this.balances.set(to, (this.balances.get(to) || 0n) + BigInt(lamports)); return true; }
  async balance(a) { return this.balances.get(a) ?? 10_000_000n; }
  async rentExemptMinimum() { return 890_880n; }
  async latestBlockhash() { return { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 }; }
  async sendRaw(b) { this.sent.push(b); return 'x'; }
  async status() { return { confirmationStatus: 'confirmed', err: null }; }
}

async function playOut(mm, room) {
  room.sim.fighters[0].y = room.sim.fighters[1].y = 60;
  mm.input(room.players[0].wallet, { atk: true, sp: true }); mm.input(room.players[1].wallet, { mx: -0.3, my: 0.01 });
  for (let i = 0; i < 30 * 95 && room.state === 'live'; i++) mm.tick();
}

test('staked 1v1: deposits, live per-hit shares, KO winner takes the pot, one settlement tx', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), chain = new MockChain();
  const treasury = wallet();
  const mm = new MatchManager({ db, registry, chain, config: { treasury, disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const a = wallet(), b = wallet();
  const [ma] = registry.claimAll(a), mb = registry.claimAll(b)[1];
  const stake = '5000000';
  const room = mm.create(a, { stakeLamports: stake, serial: ma.serial });
  assert.throws(() => mm.join(b, { code: room.code, serial: ma.serial }), /do not own/);
  mm.join(b, { code: room.code, serial: mb.serial });
  assert.equal(room.state, 'deposit');
  await assert.rejects(mm.confirmDeposit(a, 'bad-sig'));
  await mm.confirmDeposit(a, 'dep-a'); await mm.confirmDeposit(b, 'dep-b');
  assert.equal(room.state, 'countdown');
  for (let i = 0; i < 100 && room.state === 'countdown'; i++) mm.tick();
  assert.equal(room.state, 'live');
  const seen = []; room.players[0].sockets.add({ send: s => seen.push(JSON.parse(s)) });
  await playOut(mm, room);
  const hits = seen.filter(m => m.t === 'hit');
  assert.ok(hits.length > 3 && hits.every(h => BigInt(h.fee) >= 1n));
  assert.ok(hits.every(h => BigInt(h.shares[0]) + BigInt(h.shares[1]) === 10_000_000n));
  const end = seen.find(m => m.t === 'end'); assert.equal(end.winner, 0); assert.deepEqual(end.shares, ['10000000', '0']);
  for (let i = 0; i < 50 && !seen.some(m => m.t === 'settlement'); i++) await new Promise(r => setTimeout(r, 10));
  const st = seen.find(m => m.t === 'settlement');
  assert.ok(st.ok); assert.equal(st.company, '1'); assert.equal(BigInt(st.payouts[0]) + 1n + 5000n, 10_000_000n);
  assert.equal(chain.sent.length, 1);
  assert.equal(db.prepare('SELECT state FROM matches WHERE id=?').get(room.id).state, 'settled');
  assert.ok(db.prepare('SELECT COUNT(*) n FROM hit_log WHERE match_id=?').get(room.id).n > 3);
});

test('free 1v1 needs no escrow; unpaired deposits are refunded with no company fee', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), chain = new MockChain();
  const mm = new MatchManager({ db, registry, chain, config: { treasury: wallet(), disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const a = wallet(), b = wallet(), c = wallet(), d = wallet();
  const free = mm.create(a, { stakeLamports: '0', speciesId: 3 }); mm.join(b, { code: free.code, speciesId: 5 });
  for (let i = 0; i < 100 && free.state !== 'live'; i++) mm.tick();
  assert.equal(free.state, 'live'); assert.equal(free.escrow, null);
  const [mc] = registry.claimAll(c), [md] = registry.claimAll(d);
  const r = mm.create(c, { stakeLamports: '2000000', serial: mc.serial }); mm.join(d, { code: r.code, serial: md.serial });
  await mm.confirmDeposit(c, 'dep-c');
  const seen = []; r.players[0].sockets.add({ send: s => seen.push(JSON.parse(s)) });
  mm.leave(d);
  for (let i = 0; i < 50 && !seen.some(m => m.t === 'settlement'); i++) await new Promise(r2 => setTimeout(r2, 10));
  const st = seen.find(m => m.t === 'settlement');
  assert.ok(st.refund); assert.equal(st.company, '0'); assert.equal(st.payouts[0], String(2_000_000n - 5000n));
});

test('marketplace sale split pays seller, origin-owner royalty and a 1-lamport company fee exactly', () => {
  const creator = wallet(), price = 123_456_789n;
  const s = saleSplit(price, 500, [{ address: creator, percentage: 100 }], true);
  assert.equal(s.seller + s.royalty + s.company, price); assert.equal(s.company, 1n); assert.equal(s.royalty, 6_172_839n);
  assert.throws(() => saleSplit(10n, 10000, [{ address: creator, percentage: 100 }], true), /too small/);
});

test('mint transaction is co-signed by the asset key and collection authority, paid by the player', async () => {
  const { NftService } = await import('../server/nft.mjs');
  const { Transaction } = await import('@solana/web3.js');
  const keys = { collectionAuthority: Keypair.generate(), marketAuthority: Keypair.generate() };
  const owner = wallet(), reg = new Registry(openDb(':memory:')), m = reg.claimGenesis(owner, 4);
  const nft = new NftService({ config: { rpc: 'http://127.0.0.1:1', publicUrl: 'https://pocketmonstars.example', royaltyBps: 500, collection: null }, keys, chain: new MockChain() });
  const out = await nft.mintTransaction({ monstar: m, owner });
  const tx = Transaction.from(Buffer.from(out.transaction, 'base64'));
  assert.equal(tx.feePayer.toBase58(), owner);
  const signed = tx.signatures.filter(s => s.signature).map(s => s.publicKey.toBase58()).sort();
  assert.deepEqual(signed, [out.asset, keys.collectionAuthority.publicKey.toBase58()].sort());
  assert.ok(tx.signatures.some(s => s.publicKey.toBase58() === owner && !s.signature)); // player still has to approve in Phantom
  assert.equal(tx.instructions[0].programId.toBase58(), 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');
});

test('every species lands both of its powers (projectile, bolt, whip, cone, beam, strike)', () => {
  for (const sp of SPECIES) {
    for (const key of ['atk', 'sp']) {
      const m = createMatch(new Monstar({ speciesId: sp.id }), new Monstar({ speciesId: 5 }), { auto: false });
      const [a, b] = m.fighters; a.x = 300; a.y = 300; b.x = 480; b.y = 300; a.cd.special = 0;
      a.input = sanitizeInput({ [key]: true, ax: 1, ay: 0 });
      step(m); a.input = sanitizeInput({ ax: 1, ay: 0 });
      let hits = 0; for (let i = 0; i < 60; i++) { b.x = 480; b.y = 300; b.vx = b.vy = 0; hits += step(m).filter(e => e.type === 'hit').length; }
      assert.ok(hits >= 1, `${sp.name} ${key === 'atk' ? sp.basicStyle : sp.specialStyle} should hit`);
    }
  }
});


import { STAGES, stageFor, expForLevel, levelForExp, LEGENDARY_IDS } from '../shared/monstars.mjs';

test('six stages evolve at 1, 3, 10, 25, 50, 80 and stats grow with level', () => {
  assert.deepEqual(STAGES.map(s => s.minLevel), [1, 3, 10, 25, 50, 80]);
  assert.equal(stageFor(2).name, 'Infant'); assert.equal(stageFor(3).name, 'Rookie'); assert.equal(stageFor(80).name, 'Ascended');
  for (const l of [1, 3, 10, 25, 50, 80]) assert.equal(levelForExp(expForLevel(l)), l);
  const a = new Monstar({ speciesId: 0, level: 1 }), b = new Monstar({ speciesId: 0, level: 25 });
  assert.ok(b.stats.hp > a.stats.hp * 1.8 && b.stats.attack > a.stats.attack * 1.8);
});

test('hits earn EXP, and a Monstar levels up and evolves during the match', () => {
  const m = createMatch(new Monstar({ speciesId: 0, level: 2 }), new Monstar({ speciesId: 5, level: 30 }), { auto: false });
  const [a, b] = m.fighters; a.x = 300; a.y = 300; b.x = 420; b.y = 300;
  const evs = [];
  for (let i = 0; i < 30 * 20 && !m.over; i++) { a.input = sanitizeInput({ atk: true }); b.x = 420; b.y = 300; b.vx = b.vy = 0; evs.push(...step(m)); }
  const hit = evs.find(e => e.type === 'hit'); assert.ok(hit.exp >= 1);
  const lvl = evs.find(e => e.type === 'level' && e.evolved); assert.ok(lvl, 'should evolve from Infant to Rookie'); assert.equal(lvl.stage, 'Rookie');
  assert.ok(a.level >= 3 && a.maxHp > new Monstar({ speciesId: 0, level: 2 }).stats.hp);
});

test('Monstars move on their own when the player is not steering', () => {
  const m = createMatch(new Monstar({ speciesId: 3 }), new Monstar({ speciesId: 5 }));
  const x0 = m.fighters[0].x, y0 = m.fighters[0].y;
  for (let i = 0; i < 60; i++) step(m);
  assert.ok(Math.hypot(m.fighters[0].x - x0, m.fighters[0].y - y0) > 30);
});

test('legendaries go only to the founder wallet, fully evolved; breeding gives each player a mixed Infant', () => {
  const founder = 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ';
  const reg = new Registry(openDb(':memory:'), { legendaryOwner: founder });
  const mine = reg.claimAll(founder), legends = mine.filter(m => m.species.legendary);
  assert.equal(legends.length, LEGENDARY_IDS.length);
  for (const l of legends) { assert.equal(l.level, 80); assert.equal(l.stage.name, 'Ascended'); assert.equal(l.traits.rarity, 'Legendary'); assert.equal(l.collection, 'legendary'); }
  const other = wallet(); assert.equal(reg.claimAll(other).filter(m => m.species.legendary).length, 0);
  const pa = reg.claimGenesis(founder, 0), pb = reg.claimGenesis(other, 6);
  const [ca, cb] = reg.breed({ a: pa, b: pb, seed: 'test-seed' });
  assert.equal(ca.owner, founder); assert.equal(cb.owner, other); assert.equal(ca.level, 1); assert.equal(ca.collection, 'bred');
  assert.ok([0, 6].includes(ca.species.id) && [0, 6].includes(cb.species.id));
  ca.traits.ivs.forEach((v, k) => assert.ok(Math.abs(v - (pa.traits.ivs[k] + pb.traits.ivs[k]) / 2) <= 3.5));
  assert.throws(() => reg.breed({ a: pa, b: reg.claimGenesis(founder, 1) }), /two different players/);
});

test('AI practice on the server saves the EXP the Monstar earned', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), chain = new MockChain();
  const mm = new MatchManager({ db, registry, chain, config: { disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const w = wallet(), [m0] = registry.claimAll(w);
  const room = mm.create ? mm.createAi(w, { serial: m0.serial }) : null;
  room.players[0].sockets.add({ send() {} });
  for (let i = 0; i < 200 && room.state !== 'live'; i++) mm.tick();
  assert.equal(room.state, 'live');
  for (let i = 0; i < 30 * 95 && room.state === 'live'; i++) { mm.input(w, { atk: true, sp: true }); mm.tick(); }
  assert.notEqual(room.state, 'live');
  assert.ok(registry.get(m0.serial).exp > 0);
});

test('3v3: next team member comes in on a faint, match ends when a whole team is out, fees use team HP', async () => {
  const { createMatch, step, sanitizeInput } = await import('../shared/sim.mjs');
  const { Monstar } = await import('../shared/monstars.mjs');
  const team = ids => ids.map(id => new Monstar({ speciesId: id, level: 3 }));
  const m = createMatch(team([0, 1, 2]), team([3, 4, 5]), { auto: false });
  assert.equal(m.teamMax[1], m.teams[1].reduce((n, x) => n + x.stats.hp, 0));
  let switches = 0, firstMax = null;
  for (let i = 0; i < 30 * 400 && !m.over; i++) {
    m.fighters[0].input = sanitizeInput({ atk: true, sp: true }); m.fighters[1].input = sanitizeInput({});
    m.fighters[1].x = m.fighters[0].x + 200; m.fighters[1].y = m.fighters[0].y;
    for (const e of step(m)) { if (e.type === 'switch') switches++; if (e.type === 'hit' && e.attacker === 0) firstMax ??= e.victimMaxHp; }
  }
  assert.equal(firstMax, m.teamMax[1]);
  assert.ok(switches >= 1, 'a replacement came in');
  if (m.reason === 'ko') assert.equal(m.winner, 0);
});
test('wild: rarity tiers are weighted and rarer species are stronger', async () => {
  const { rollWild, SPECIES, Monstar, TIERS } = await import('../shared/monstars.mjs');
  const n = {}; for (let i = 0; i < 4000; i++) { const t = SPECIES[rollWild(i / 4000)].tier; n[t] = (n[t] || 0) + 1; }
  assert.ok(n.Common > n.Rare && n.Rare > n.Mythic && n.Mythic > n.Divine);
  const god = new Monstar({ speciesId: SPECIES.find(s => s.tier === 'Divine').id, level: 1 });
  const common = new Monstar({ speciesId: SPECIES.find(s => s.tier === 'Common').id, level: 1 });
  assert.ok(god.stats.hp > common.stats.hp * 1.5 && god.level === 1 && TIERS.Divine.catch < TIERS.Common.catch);
});

test('wild: paid entry is checked once, the server runs the battle, a win can catch the wild Monstar as an Infant', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), chain = new MockChain();
  const mm = new MatchManager({ db, registry, chain, config: { treasury: wallet(), wildFeeLamports: 100_000n, disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const a = wallet(), [ma] = registry.claimAll(a);
  await assert.rejects(mm.createWild(a, { serial: ma.serial, signature: 'bad-fee' }));
  let caught = null;
  for (let run = 0; run < 40 && !caught; run++) {
    const room = await mm.createWild(a, { serial: ma.serial, signature: 'fee-' + run, zone: 0 });
    assert.ok(room.wild && room.players[1].monstar.species.collection !== 'genesis');
    if (run === 0) await assert.rejects(mm.createWild(a, { serial: ma.serial, signature: 'fee-0' }), /already used/);
    const seen = []; room.players[0].sockets.add({ send: s => seen.push(JSON.parse(s)) });
    for (let i = 0; i < 100 && room.state === 'countdown'; i++) mm.tick();
    room.sim.fighters[1].hp = 1; room.sim.fighters[1].iframes = 0; // let the player win quickly
    room.sim.fighters[0].x = room.sim.fighters[1].x - 200; room.sim.fighters[0].y = room.sim.fighters[1].y;
    for (let i = 0; i < 30 * 95 && room.state === 'live'; i++) { mm.input(a, { atk: true }); mm.tick(); }
    const end = seen.find(m => m.t === 'end');
    if (end?.caught?.ok) caught = end.caught;
  }
  assert.ok(caught, 'caught something within 40 wins');
  const m = registry.get(caught.monstar.serial);
  assert.equal(m.owner, a); assert.equal(m.level, 1); assert.equal(m.stage.name, 'Infant'); assert.ok(['frontier', 'mythic'].includes(m.collection));
});

test('3v3 rooms: both players bring three, the server runs a team match and saves EXP for every member used', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), chain = new MockChain();
  const mm = new MatchManager({ db, registry, chain, config: { disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const a = wallet(), b = wallet(), ta = registry.claimAll(a).slice(0, 3), tb = registry.claimAll(b).slice(3, 6);
  assert.throws(() => mm.create(a, { mode: '3v3', serials: [ta[0].serial] }), /three/);
  const room = mm.create(a, { mode: '3v3', serials: ta.map(m => m.serial) });
  mm.join(b, { code: room.code, serials: tb.map(m => m.serial) });
  for (let i = 0; i < 200 && room.state !== 'live'; i++) mm.tick();
  assert.equal(room.sim.teams[0].length, 3); assert.equal(room.sim.teams[1].length, 3);
  const pub = mm.publicRoom(room, a); assert.equal(pub.mode, '3v3'); assert.equal(pub.players[1].team.length, 3);
  for (let i = 0; i < 30 * 200 && room.state === 'live'; i++) {
    room.sim.fighters[1].x = room.sim.fighters[0].x + 200; room.sim.fighters[1].y = room.sim.fighters[0].y;
    mm.input(a, { atk: true, sp: true }); mm.tick();
  }
  assert.notEqual(room.state, 'live');
  assert.ok(registry.get(ta[0].serial).exp > 0);
});
