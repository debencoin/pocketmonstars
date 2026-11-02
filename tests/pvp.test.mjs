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
  assert.equal(SPECIES.length, 9); assert.equal(new Set(SPECIES.map(s => s.cls)).size, 9); assert.equal(CLASSES.length, 9);
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
  assert.deepEqual(sanitizeInput({ mx: 5, my: 0, ax: NaN }), { mx: 1, my: 0, ax: 0, ay: 0, atk: false, sp: false, dash: false, guard: false });
  const m = createMatch(new Monstar({ speciesId: 0 }), new Monstar({ speciesId: 1 }));
  m.fighters[0].y = 60; m.fighters[1].y = 60; // clear line of fire above the centre rock
  m.fighters[0].input = sanitizeInput({ atk: true, sp: true, ax: 1, ay: 0 }); m.fighters[1].input = sanitizeInput({ mx: -0.3 });
  let hits = 0; for (let i = 0; i < 30 * 90 && !m.over; i++) hits += step(m).length;
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
  mm.input(room.players[0].wallet, { atk: true, sp: true, ax: 1, ay: 0 }); mm.input(room.players[1].wallet, { mx: -0.3 });
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
      const m = createMatch(new Monstar({ speciesId: sp.id }), new Monstar({ speciesId: 5 }));
      const [a, b] = m.fighters; a.x = 300; a.y = 70; b.x = 480; b.y = 70; a.cd.special = 0;
      a.input = sanitizeInput({ [key]: true, ax: 1, ay: 0 });
      step(m); a.input = sanitizeInput({ ax: 1, ay: 0 });
      let hits = 0; for (let i = 0; i < 45; i++) { b.x = 480; b.y = 70; b.vx = b.vy = 0; hits += step(m).length; }
      assert.ok(hits >= 1, `${sp.name} ${key === 'atk' ? sp.basicStyle : sp.specialStyle} should hit`);
    }
  }
});
