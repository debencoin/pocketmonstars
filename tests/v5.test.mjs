// Accounts, one starter, capture in the red, referrals (5% of a referred winner's profit), Superhero Drop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { openDb } from '../server/db.mjs';
import { Registry } from '../server/registry.mjs';
import { Players } from '../server/players.mjs';
import { MatchManager, captureChance } from '../server/matches.mjs';
import { createServer } from '../server/index.mjs';
import { CONFIG } from '../server/config.mjs';
import { SPECIES, HERO_IDS, WILD_IDS } from '../shared/monstars.mjs';

const wallet = () => Keypair.generate().publicKey.toBase58();
class MockChain {
  constructor() { this.balances = new Map(); this.sent = []; this.payments = new Map(); }
  async verifyDeposit(sig, { to, lamports }) { this.balances.set(to, (this.balances.get(to) || 0n) + BigInt(lamports)); return true; }
  async verifyPayment(sig, want) { const p = this.payments.get(sig); if (!p || p.from !== want.from || p.to !== want.to || BigInt(p.lamports) !== BigInt(want.lamports) || p.memo !== want.memo) throw Error('That payment does not match this purchase.'); return p.from; }
  async balance(a) { return this.balances.get(a) ?? 10_000_000n; }
  async rentExemptMinimum() { return 890_880n; }
  async latestBlockhash() { return { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100 }; }
  async sendRaw(b) { this.sent.push(b); return 'x'; }
  async status() { return { confirmationStatus: 'confirmed', err: null }; }
}

test('accounts: sign up with a username and password, log in, wrong password refused, names unique', () => {
  const p = new Players(openDb(':memory:'));
  assert.equal(p.register('Ace_Trainer', 'hunter2hunter2'), '@ace_trainer');
  assert.throws(() => p.register('ace_trainer', 'whatever123'), /taken/);
  assert.throws(() => p.register('a!', 'whatever123'), /username/);
  assert.throws(() => p.register('shorty', '123'), /8 characters/);
  assert.equal(p.login('ACE_TRAINER', 'hunter2hunter2'), '@ace_trainer');
  assert.throws(() => p.login('ace_trainer', 'nope-nope'), /Wrong/);
  const row = p.db.prepare('SELECT * FROM accounts').get(); assert.ok(!JSON.stringify(row).includes('hunter2'), 'password is never stored');
});

test('username accounts play free: no staking, free wild runs with a cooldown', async () => {
  const db = openDb(':memory:'), registry = new Registry(db);
  const mm = new MatchManager({ db, registry, chain: new MockChain(), config: { treasury: wallet(), freeWildCooldownMs: 45_000, disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const [m] = registry.claimAll('@kid');
  assert.throws(() => mm.create('@kid', { stakeLamports: '5000000', serial: m.serial }), /Phantom/);
  const free = mm.create('@kid', { stakeLamports: '0', serial: m.serial }); assert.equal(free.stake, 0n); mm.leave('@kid');
  const room = await mm.createWild('@kid', { serial: m.serial }); assert.ok(room.wild);
  mm.leave('@kid'); await assert.rejects(mm.createWild('@kid', { serial: m.serial }), /free wild run is ready/);
});

test('capture: only when the wild Monstar is in the red; odds differ per species and every throw; a catch is saved', async () => {
  const db = openDb(':memory:'), registry = new Registry(db);
  const mm = new MatchManager({ db, registry, chain: new MockChain(), config: { treasury: wallet(), freeWildCooldownMs: 0, disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const [m] = registry.claimAll('@catcher');
  const rates = new Set(WILD_IDS.map(id => Math.round(captureChance(id, 0.2, 0.5) * 100))); assert.ok(rates.size > 20, 'species have different odds');
  assert.notEqual(captureChance(20, 0.2, 0.1), captureChance(20, 0.2, 0.9), 'each throw rolls new odds');
  assert.ok(WILD_IDS.filter(id => captureChance(id, 0.1, 0.5) >= 0.15).length / WILD_IDS.length > 0.8, 'most Monstars are catchable');
  let caught = null;
  for (let tries = 0; tries < 40 && !caught; tries++) {
    const room = await mm.createWild('@catcher', { serial: m.serial }); mm.attach('@catcher', { send() {} });
    for (let i = 0; i < 100 && room.state !== 'live'; i++) mm.tick();
    assert.throws(() => mm.capture('@catcher'), /red/);
    const foe = room.sim.fighters[1]; foe.hp = foe.maxHp * 0.1;
    for (let t = 0; t < 3 && room.state === 'live'; t++) { room.lastThrow = 0; const r = mm.capture('@catcher'); if (r.ok) caught = room; }
    if (room.state === 'live') mm.leave('@catcher');
  }
  assert.ok(caught, 'a red-HP capture eventually works');
  assert.ok(registry.ownedBy('@catcher').some(x => x.species.id === caught.wild.speciesId));
});

test('referrals: the referrer gets 5% of what a referred player wins, paid in the same settlement', async () => {
  const db = openDb(':memory:'), registry = new Registry(db), players = new Players(db), chain = new MockChain();
  const mm = new MatchManager({ db, registry, chain, players, config: { treasury: wallet(), disconnectGraceMs: 1e9, depositTimeoutMs: 1e9 } });
  const ref = wallet(), a = wallet(), b = wallet();
  assert.ok(players.setReferrer(a, ref)); assert.equal(players.setReferrer(a, wallet()), false, 'first referrer only'); assert.equal(players.setReferrer(ref, ref), false);
  const [ma] = registry.claimAll(a), [mb] = registry.claimAll(b), stake = 5_000_000n;
  const room = mm.create(a, { stakeLamports: String(stake), serial: ma.serial }); mm.join(b, { code: room.code, serial: mb.serial });
  await mm.confirmDeposit(a, 'da'); await mm.confirmDeposit(b, 'db');
  for (let i = 0; i < 100 && room.state === 'countdown'; i++) mm.tick();
  const seen = []; room.players[0].sockets.add({ send: s => seen.push(JSON.parse(s)) });
  const { forfeit } = await import('../shared/sim.mjs'); forfeit(room.sim, 1); mm.tick();
  for (let i = 0; i < 50 && !seen.some(x => x.t === 'settlement'); i++) await new Promise(r => setTimeout(r, 10));
  const st = seen.find(x => x.t === 'settlement'); assert.ok(st.ok);
  const stats = players.referralStats(ref); assert.equal(stats.referred, 1); assert.equal(stats.payouts, 1);
  const won = BigInt(st.payouts[0]) + BigInt(stats.earnedLamports) - stake;
  assert.equal(BigInt(stats.earnedLamports), won * 500n / 10_000n);
});

test('Superhero Drop: 30 heroes, top five 1 SOL, others 0.5 SOL; each sells once; never wild or a starter', async () => {
  assert.equal(HERO_IDS.length, 30);
  assert.equal(HERO_IDS.filter(id => SPECIES[id].drop.top && SPECIES[id].drop.priceLamports === '1000000000').length, 5);
  assert.equal(HERO_IDS.filter(id => !SPECIES[id].drop.top && SPECIES[id].drop.priceLamports === '500000000').length, 25);
  assert.ok(!HERO_IDS.some(id => WILD_IDS.includes(id)));
  const chain = new MockChain(), { server, players, registry } = createServer({ chain, dbFile: ':memory:', config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, token) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then(async r => ({ ok: r.ok, ...(await r.json()) }));
  try {
    const acct = await post('/api/account/register', { username: 'dropfan', password: 'password123' });
    assert.equal(acct.wallet, '@dropfan');
    const no = await post('/api/drop/tx', { speciesId: HERO_IDS[0] }, acct.token); assert.ok(!no.ok && /Phantom/.test(no.error));
    const kp = Keypair.generate(), buyer = kp.publicKey.toBase58();
    const { message } = await post('/api/auth/challenge', { wallet: buyer });
    const { ed25519 } = await import('@noble/curves/ed25519'), bs58 = (await import('bs58')).default;
    const { token } = await post('/api/auth/verify', { wallet: buyer, signature: bs58.encode(ed25519.sign(new TextEncoder().encode(message), kp.secretKey.slice(0, 32))) });
    const sid = HERO_IDS[0];
    const tx = await post('/api/drop/tx', { speciesId: sid }, token); assert.ok(tx.transaction, tx.error);
    chain.payments.set('sig1', { from: buyer, to: CONFIG.dropTreasury, lamports: SPECIES[sid].drop.priceLamports, memo: 'PMDROP:' + sid });
    const bad = await post('/api/drop/confirm', { speciesId: HERO_IDS[1], signature: 'sig1' }, token); assert.ok(!bad.ok, 'a payment for one hero cannot buy another');
    const got = await post('/api/drop/confirm', { speciesId: sid, signature: 'sig1' }, token); assert.equal(got.speciesId, sid, got.error); assert.equal(got.level, 1);
    const again = await post('/api/drop/tx', { speciesId: sid }, token); assert.ok(!again.ok && /sold/.test(again.error));
    const list = await fetch(base + '/api/drop').then(r => r.json()); assert.equal(list.heroes.find(h => h.speciesId === sid).sold, true);
    assert.equal(players.sale(sid).buyer, buyer);
    assert.ok(registry.ownedBy(buyer).some(m => m.species.id === sid));
  } finally { server.close(); }
});

test('3v3 squad: all six fight at once, teammates act on their own, switching takes control, KO of all three ends it', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar } = await import('../shared/monstars.mjs');
  const team = ids => ids.map(i => new Monstar({ speciesId: i, level: 12 }));
  const m = S.createMatch(team([0, 1, 2]), team([3, 4, 5]), { squad: true }); assert.ok(m.squad);
  const hpStart = m.roster[1].map(f => f.hp), mem = [{}, {}];
  let switched = false, mateHits = 0;
  for (let i = 0; i < 30 * 200 && !m.over; i++) {
    m.fighters[1].input = S.sanitizeInput(S.aiInput(m, 1, mem[1]));
    m.fighters[0].input = S.sanitizeInput(i === 90 ? { sw: 2 } : {}); // the player does nothing but switch once
    for (const e of S.step(m)) { if (e.type === 'switch' && e.side === 0 && e.control) switched = true; if (e.type === 'hit' && e.attacker === 0) mateHits++; }
    if (i === 1) assert.equal(S.snapshot(m).x.length, 4, 'the four Monstars not being controlled are on the field too');
  }
  assert.ok(switched && m.slot[0] !== 0 || m.over, 'switching control works');
  assert.ok(mateHits > 0, 'teammates deal damage while not controlled');
  assert.ok(m.roster[1].some((f, i) => f.hp < hpStart[i]));
  assert.ok(m.over && ['ko', 'time'].includes(m.reason));
  if (m.reason === 'ko') assert.ok(m.roster[m.winner === 0 ? 1 : 0].every(f => f.hp <= 0), 'a squad loses only when all three are down');
  const one = S.createMatch(new Monstar({ speciesId: 0 }), new Monstar({ speciesId: 1 })); assert.ok(!one.squad); assert.equal(S.snapshot(one).x, null);
});

test('profile avatars: the founder wallet holds Gilded Voyager; others cannot use it; any owned Monstar can be an avatar', async () => {
  const { server, auth, registry } = createServer({ chain: new MockChain(), dbFile: ':memory:', config: { ...CONFIG, rebuildDrops: false } });
  await new Promise(r => server.listen(0, r)); const base = 'http://127.0.0.1:' + server.address().port;
  const call = (path, t, b) => fetch(base + path, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined }).then(r => r.json());
  try {
    const f = auth.issue(CONFIG.legendaryOwner).token, o = auth.issue('@fan').token; registry.claimAll('@fan');
    assert.equal((await call('/api/profile/me', f)).avatar.id, 'gilded-voyager');
    const me = await call('/api/profile/me', o); assert.equal(me.photos.length, 0); assert.equal(me.avatar.kind, 'monstar');
    assert.match((await call('/api/profile/avatar', o, { avatar: 'a:gilded-voyager' })).error, /do not own/);
    assert.equal((await call('/api/profile/avatar', o, { avatar: 'm:' + me.monstars[0].serial })).avatar.serial, me.monstars[0].serial);
  } finally { server.close(); }
});

test('Neferion Storm Orbs: 7 homing lightning balls; the first hit stuns; a rival that stands still takes all 7', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES } = await import('../shared/monstars.mjs');
  const nef = SPECIES.find(s => s.name === 'Neferion'); assert.equal(nef.kit.mega.kind, 'lightning');
  const m = S.createMatch(new Monstar({ speciesId: nef.id, level: 20 }), new Monstar({ speciesId: 3, level: 20 }), { auto: false });
  const a = m.fighters[0], b = m.fighters[1]; a.x = 300; a.y = 300; b.x = 650; b.y = 300; a.ult = 100; a.input = S.sanitizeInput({ mega: true });
  let hits = 0, stuns = 0;
  for (let i = 0; i < 30 * 7 && !m.over; i++) {
    for (const e of S.step(m)) { if (e.type === 'hit' && e.attacker === 0 && e.kind === 'special') hits++; if (e.type === 'status' && e.k === 'stun') stuns++; }
    a.input = S.sanitizeInput({}); b.x = 650; b.y = 300; b.vx = b.vy = 0;
    if (i === 2) assert.equal(m.projectiles.filter(p => p.lt).length, 7);
  }
  assert.equal(hits, 7); assert.equal(stuns, 1, 'only the first ball stuns');
});

test('Elemental Benders: gifted wallets get their benders (Tempestro only to q2xb…); Sky Splitter strikes all land on a still rival', async () => {
  const { gifts } = CONFIG, reg = new Registry(openDb(':memory:'), { gifts });
  // every earlier bender is retired: no wallet is given one any more; the founder holds the four Element Masters and COVO
  for (const w of Object.keys(gifts)) assert.ok(!reg.claimAll(w).some(m => m.species.retired), 'no retired benders are given');
  const f = reg.claimAll(CONFIG.legendaryOwner).filter(m => m.species.master).map(m => m.species.name).sort();
  assert.deepEqual(f, ['Aerix', 'Azaelion', 'Bouldar', 'Ignar', 'Nerin', 'Terrok', 'Tydal', 'Verdex', 'Zephar', 'Zuri']); // COVO was released to the wild
  assert.ok(reg.claimAll('HgPy9avE7tMVTgpehYwFQRQYGPUPbZKGzKPAuLNoeD3U').length > 5, 'Ashley keeps her wallet and her other Monstars');
  const S = await import('../shared/sim.mjs'), t = SPECIES.find(s => s.name === 'Tempestro'); assert.equal(t.kit.mega.kind, 'thunderstrike');
  const { Monstar } = await import('../shared/monstars.mjs');
  const m = S.createMatch(new Monstar({ speciesId: t.id, level: 20 }), new Monstar({ speciesId: 3, level: 20 }), { auto: false });
  const a = m.fighters[0], b = m.fighters[1]; a.x = 300; a.y = 300; b.x = 650; b.y = 300; a.ult = 100; a.input = S.sanitizeInput({ mega: true });
  let hits = 0; for (let i = 0; i < 30 * 8 && !m.over; i++) { for (const e of S.step(m)) if (e.type === 'hit' && e.attacker === 0 && e.kind === 'special') hits++; a.input = S.sanitizeInput({}); b.x = 650; b.y = 300; b.vx = b.vy = 0; }
  assert.equal(hits, 6);
});

test('Aerokai: Tornado Gust grabs every rival, slams them (damage) and dazes them; Gale Push knocks back; Gust Volley fires 3-4 balls; bred benders fuse powers', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar } = await import('../shared/monstars.mjs');
  const A = SPECIES.find(s => s.name === 'Aerokai'); assert.equal(A.kit.mega.kind, 'tornado'); assert.equal(SPECIES.find(s => s.name === 'Zephyrine').kit.mega.kind, 'tornado');
  const m = S.createMatch([A.id, 3, 4].map(i => new Monstar({ speciesId: i, level: 1 })), [0, 1, 2].map(i => new Monstar({ speciesId: i, level: 1 })), { squad: true, auto: false });
  m.fighters[0].ult = 100; m.fighters[0].input = S.sanitizeInput({ mega: true });
  let whirl = 0, slams = 0, dazed = 0;
  for (let i = 0; i < 30 * 8; i++) { for (const e of S.step(m)) { if (e.type === 'status' && e.k === 'whirl') whirl++; if (e.type === 'status' && e.k === 'daze') dazed++; if (e.type === 'hit' && e.attacker === 0 && e.style === 'strike') slams++; }
    for (const f of m.roster[0]) f.input = S.sanitizeInput({}); }
  assert.equal(whirl, 3, 'all three rivals caught'); assert.equal(slams, 3, 'each slam does damage'); assert.equal(dazed, 3);
  const shots = []; for (let r = 0; r < 12; r++) { const m2 = S.createMatch(new Monstar({ speciesId: A.id, level: 1 }), new Monstar({ speciesId: 3, level: 1 }), { auto: false }); const f = m2.fighters[0]; f.cd.special = 0; f.energy = 100; f.input = S.sanitizeInput({ sp: true }); S.step(m2); shots.push(m2.projectiles.length); }
  assert.ok(shots.every(n => n === 3 || n === 4));
  assert.ok(new Monstar({ speciesId: A.id, level: 1 }).stats.attack > new Monstar({ speciesId: 3, level: 1 }).stats.attack * 1.5, 'benders are powerful at level 1');
  const reg = new Registry(openDb(':memory:'), { gifts: { '@a': [A.id], '@b': [SPECIES.find(s => s.name === 'Pyreska').id] } });
  const [pa] = reg.claimAll('@a').filter(x => x.species.collection === 'benders'), [pb] = reg.claimAll('@b').filter(x => x.species.collection === 'benders');
  const kids = reg.breed({ a: pa, b: pb }); assert.ok(kids.every(k => k.species.bender && k.fusion != null));
  const pyKid = kids.find(k => k.species.name === 'Pyreska'); if (pyKid) assert.equal(reg.get(pyKid.serial).kit.mega.kind, 'tornado', 'the fire baby inherits the tornado');
});

test('founder benders: Ice Balls freeze, Hailstorm takes 30% and freezes, Slab Slide fires 3-4 slabs, Boulder Storm dazes, Soul Storm heals 40-50%', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar } = await import('../shared/monstars.mjs'), sp = n => SPECIES.find(s => s.name === n);
  function mega(name) {
    const m = S.createMatch(new Monstar({ speciesId: sp(name).id, level: 10 }), new Monstar({ speciesId: 3, level: 10 }), { auto: false });
    const a = m.fighters[0], b = m.fighters[1]; a.x = 300; a.y = 300; b.x = 620; b.y = 300; a.ult = 100; a.hp = a.maxHp / 2; a.input = S.sanitizeInput({ mega: true });
    const out = { dmg: 0, hits: 0, k: new Set(), heal: 0 }, hp0 = a.hp;
    for (let i = 0; i < 30 * 8; i++) { for (const e of S.step(m)) { if (e.type === 'hit' && e.attacker === 0 && e.kind === 'special') { out.dmg += e.damage; out.hits++; } if (e.type === 'status') out.k.add(e.k); }
      a.input = S.sanitizeInput({}); b.x = 620; b.y = 300; b.vx = b.vy = 0; }
    out.pct = out.dmg / b.maxHp; out.heal = (a.hp - hp0) / out.dmg; return out;
  }
  const hail = mega('Tidewen'); assert.ok(Math.abs(hail.pct - 0.3) < 0.03 && hail.k.has('freeze'), 'Hailstorm: about 30% and frozen');
  const rocks = mega('Granitus'); assert.equal(rocks.hits, 7); assert.ok(rocks.k.has('daze'));
  const soul = mega('Thundrik'); assert.ok(soul.heal >= 0.4 && soul.heal <= 0.5, 'Soul Storm heals 40-50% of its damage');
  const shots = n => { const m = S.createMatch(new Monstar({ speciesId: sp(n).id, level: 1 }), new Monstar({ speciesId: 3, level: 1 }), { auto: false }); const f = m.fighters[0]; f.cd.special = 0; f.energy = 100; f.input = S.sanitizeInput({ sp: true }); S.step(m); return m.projectiles; };
  const slabs = shots('Granitus'); assert.ok(slabs.length >= 3 && slabs.length <= 4 && slabs.every(p => p.look === 'boulder'));
  assert.ok(new Set(slabs.map(p => Math.round(Math.hypot(p.vx, p.vy)))).size > 1, 'slabs come out at different speeds');
  const ice = shots('Tidewen'); assert.ok(ice.length >= 2 && ice.every(p => p.onHit === 'freeze'));
});

test('arena hazards: water and lava hurt (their own element is safe), cracks drop you in, barriers block shots', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES } = await import('../shared/monstars.mjs');
  const id = n => SPECIES.find(s => s.name === n).id;
  const layout = { hz: [{ k: 'water', x: 480, y: 270, rx: 90, ry: 60 }, { k: 'lava', x: 480, y: 450, rx: 90, ry: 40 }], wl: [{ k: 'pillar', x: 600, y: 120, r: 26 }] };
  const run = (name, y) => { const m = S.createMatch(new Monstar({ speciesId: id(name), level: 5 }), new Monstar({ speciesId: 0, level: 5 }), { auto: false, layout });
    const f = m.fighters[0]; f.x = 480; f.y = y; const hp0 = f.hp, evs = []; for (let i = 0; i < 90; i++) { f.x = 480; f.y = y; evs.push(...S.step(m)); } return { lost: hp0 - f.hp, evs }; };
  assert.ok(run('Cindercub', 270).lost > 0, 'a fire Monstar is hurt by water'); assert.equal(run('Ripplefin', 270).lost, 0, 'a water Monstar swims safely');
  assert.ok(run('Ripplefin', 450).lost > run('Cindercub', 270).lost, 'lava hurts more than water'); assert.equal(run('Cindercub', 450).lost, 0, 'fire is safe in lava');
  assert.equal(run('COVO', 450).lost, 0, 'COVO commands every element');
  assert.ok(run('Cindercub', 270).evs.some(e => e.type === 'hazard' && e.k === 'water'));
  // a shot into the pillar stops there
  const m = S.createMatch(new Monstar({ speciesId: 0, level: 5 }), new Monstar({ speciesId: 1, level: 5 }), { auto: false, layout });
  m.projectiles.push({ id: 99, owner: 0, by: m.fighters[0], kind: 'basic', style: 'projectile', x: 560, y: 120, vx: 600, vy: 0, r: 10, life: 2, hitDone: false, missDone: false });
  const ev = []; for (let i = 0; i < 10; i++) ev.push(...S.step(m)); assert.ok(ev.some(e => e.type === 'wallhit')); assert.equal(m.projectiles.length, 0);
  // earthquakes open cracks
  m.quakeT = 0; ev.length = 0; ev.push(...S.step(m)); assert.ok(ev.some(e => e.type === 'earthquake')); assert.equal(m.cracks.length, 1);
  for (let i = 0; i < 50; i++) { const L = S.makeLayout(); assert.ok(L.wl.length >= 1 && L.wl.length <= 2, 'only 1 or 2 barriers'); assert.ok(L.hz.every(o => o.k === 'lava'), 'no water'); }
  assert.equal(S.snapshot(m).lay.ck.length, 1);
});

test('Aura Warriors: stronger than benders; power up into an Aura form by level (gold Lv3 ... white Lv80) and turn back to normal', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES, SHOP_IDS } = await import('../shared/monstars.mjs');
  const aw = SPECIES.filter(s => s.aura); assert.equal(aw.length, 10); assert.ok(aw.every(s => SHOP_IDS.includes(s.id) && s.collection === 'aurawarriors'));
  const bender = SPECIES.find(s => s.name === 'Pyreska'), d = SPECIES.find(s => s.name === 'Dashi'); // both strikers
  const st = sp => Object.values(new Monstar({ speciesId: sp.id, level: 1 }).stats).reduce((a, b) => a + b, 0);
  assert.ok(st(d) > st(bender), 'stronger than a bender of the same class');
  assert.deepEqual([1, 3, 10, 25, 50, 80].map(S.auraTier), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(aw.map(s => s.kit.mega.kind)).size >= 5, true, 'different powers');
  const m = S.createMatch(new Monstar({ speciesId: d.id, level: 12 }), new Monstar({ speciesId: 0, level: 12 }), { auto: false });
  const f = m.fighters[0]; f.cd.asc = 0; f.input = S.sanitizeInput({ asc: true });
  const ev = S.step(m); assert.ok(ev.some(e => e.type === 'ascend' && e.tier === 2)); assert.equal(S.snapshot(m).f[0].as, 2);
  f.input = S.sanitizeInput({}); let back = false; for (let i = 0; i < 30 * 40 && !back; i++) back = S.step(m).some(e => e.type === 'descend');
  assert.ok(back, 'turns back to normal'); assert.equal(S.snapshot(m).f[0].as, 0);
  const low = S.createMatch(new Monstar({ speciesId: d.id, level: 1 }), new Monstar({ speciesId: 0, level: 1 }), { auto: false });
  low.fighters[0].cd.asc = 0; low.fighters[0].input = S.sanitizeInput({ asc: true }); S.step(low); assert.equal(low.fighters[0].asc, 0, 'needs level 3');
});

test('Aura Warrior powers: the Halo Disc follows the rival until it hits; Drain Sting heals its user', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES } = await import('../shared/monstars.mjs');
  const mk = n => new Monstar({ speciesId: SPECIES.find(s => s.name === n).id, level: 20 });
  const run = (name, setup) => { const m = S.createMatch(mk(name), mk('Dashi'), { auto: false }); const [a, b] = m.fighters; setup(a, b);
    a.cd.special = 0; a.energy = 100; a.input = S.sanitizeInput({ sp: true, ax: 1, ay: 0 });
    for (let i = 0; i < 240; i++) { S.step(m); a.input = S.sanitizeInput({}); b.input = S.sanitizeInput({}); b.vx = b.vy = 0; } return { m, a, b }; };
  // the rival stands off to the side, behind the shooter's aim: only a disc that follows can reach it
  const d = run('Bolo', (a, b) => { a.x = 300; a.y = 300; a.fx = 1; a.fy = 0; b.x = 300; b.y = 520; });
  assert.ok(d.b.hp < d.b.maxHp, 'the disc curved round and hit');
  const v = run('Verdo', (a, b) => { a.x = 300; a.y = 300; a.fx = 1; a.fy = 0; b.x = 460; b.y = 300; a.hp = Math.round(a.maxHp / 2); });
  assert.ok(v.b.hp < v.b.maxHp && v.a.hp > Math.round(v.a.maxHp / 2), 'the sting hit and healed its user');
});

test('Aura Warrior creator: gifts and the market copy are born to the creator wallet (royalty), the founder keeps one of each, no duplicates', async () => {
  const { createServer } = await import('../server/index.mjs'), { CONFIG } = await import('../server/config.mjs'), { SPECIES } = await import('../shared/monstars.mjs');
  const { server, registry } = createServer({ dbFile: ':memory:', config: { ...CONFIG, rebuildDrops: false } });
  try {
    const creator = CONFIG.creators.aurawarriors, founder = CONFIG.legendaryOwner, aw = SPECIES.filter(s => s.aura).map(s => s.id);
    const first = registry.claimAll(founder).filter(m => aw.includes(m.species.id));
    assert.equal(first.length, 10); assert.ok(first.every(m => m.owner === founder && m.originOwner === creator));
    const again = registry.claimAll(founder).filter(m => aw.includes(m.species.id));
    assert.deepEqual(again.map(m => m.serial).sort(), first.map(m => m.serial).sort(), 'signing in again gives no second copies');
    const bought = registry.grantHero('54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr', aw[0], 'sig-test');
    assert.equal(bought.originOwner, creator); assert.equal(bought.owner, '54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr');
    assert.ok(!first.some(m => m.serial === bought.serial), 'the market copy is its own Monstar, not the founder\'s');
  } finally { server.close(); }
});

test('Watcher Gods: ten gods as strong as Aura Warriors, temple arenas, levitation, creator royalty with a 1% company fee, the creator holds a set', async () => {
  const S = await import('../shared/sim.mjs'), { Monstar, SPECIES } = await import('../shared/monstars.mjs'), { saleSplit } = await import('../server/nft.mjs');
  const { createServer } = await import('../server/index.mjs'), { CONFIG } = await import('../server/config.mjs');
  const gods = SPECIES.filter(s => s.god); assert.equal(gods.length, 10); assert.ok(gods.every(g => g.collection === 'watchergods' && g.lineage.length === 4 && g.forms.length === 6));
  const st = sp => Object.values(new Monstar({ speciesId: sp.id, level: 1 }).stats).reduce((a, b) => a + b, 0);
  assert.ok(st(gods[1]) > st(SPECIES.find(s => s.name === 'Pyreska')), 'stronger than a bender of the same class');
  const m = S.createMatch(new Monstar({ speciesId: gods[3].id, level: 20 }), new Monstar({ speciesId: 3, level: 20 }), { auto: false, arena: 2 });
  assert.ok(m.arena === 6 || m.arena === 7, 'gods fight in the temple arenas'); assert.equal(S.ARENA_COUNT, 8);
  const [a, b] = m.fighters; a.x = 300; a.y = 300; b.x = 420; b.y = 300; a.cd.special = 0; a.energy = 100; a.input = S.sanitizeInput({ sp: true, ax: 1, ay: 0 }); let lifted = false;
  for (let i = 0; i < 120; i++) { S.step(m); a.input = S.sanitizeInput({}); b.vx = b.vy = 0; if (b.status?.k === 'lift') lifted = true; }
  assert.ok(lifted && b.hp < b.maxHp, 'Gravity Lift raises the rival and hurts it');
  const sp = saleSplit(1_000_000_000n, 500, [{ address: CONFIG.creators.watchergods, percentage: 100 }], true, CONFIG.companyFeeBps.watchergods);
  assert.equal(sp.royalty, 50_000_000n); assert.equal(sp.company, 10_000_000n); assert.equal(sp.seller, 940_000_000n);
  const { server, registry } = createServer({ dbFile: ':memory:', config: { ...CONFIG, rebuildDrops: false } });
  try { const w = CONFIG.creators.watchergods, mine = registry.claimAll(w).filter(x => x.species.god); // the creator keeps a set; the founder released theirs to the wild
    assert.equal(mine.length, 10); assert.ok(mine.every(x => x.owner === w && x.originOwner === CONFIG.creators.watchergods)); assert.equal(registry.claimAll(w).filter(x => x.species.god).length, 10);
    assert.equal(registry.claimAll(CONFIG.legendaryOwner).filter(x => x.species.god).length, 0);
  } finally { server.close(); }
});

test('Element Masters: a new player chooses an element once; stronger powers take over the same buttons with level', async () => {
  const { Registry, STARTER_POOL } = await import('../server/registry.mjs'), { openDb } = await import('../server/db.mjs'), { Monstar, SPECIES, kitAt } = await import('../shared/monstars.mjs'), S = await import('../shared/sim.mjs');
  const reg = new Registry(openDb(':memory:')), [first] = reg.claimAll('@newbie'), want = STARTER_POOL.find(id => id !== first.species.id);
  assert.equal(reg.starterState('@newbie').canChoose, true);
  const got = reg.chooseStarter('@newbie', want); assert.equal(got.species.id, want);
  const mine = reg.claimAll('@newbie'); assert.equal(mine.length, 1); assert.equal(mine[0].species.id, want, 'the starter was swapped, not added');
  assert.throws(() => reg.chooseStarter('@newbie', first.species.id), /already chosen/);
  const t = SPECIES.find(s => s.name === 'Tydal');
  assert.deepEqual([1, 10, 25, 50].map(l => kitAt(t, l).special.name), ['Water Whip', 'Water Wave', 'Water Whirlpool', 'Water Dragon']);
  assert.equal(new Monstar({ speciesId: t.id, level: 50 }).kit.special.look, 'dragon');
  const m = S.createMatch(new Monstar({ speciesId: t.id, level: 50 }), new Monstar({ speciesId: 3, level: 50 }), { auto: false }), [a, b] = m.fighters;
  assert.equal(a.styles.special, 'projectile'); a.x = 300; a.y = 300; b.x = 300; b.y = 500; a.cd.special = 0; a.energy = 100; a.input = S.sanitizeInput({ sp: true, ax: 1, ay: 0 });
  for (let i = 0; i < 240; i++) { S.step(m); a.input = S.sanitizeInput({}); b.vx = b.vy = 0; }
  assert.ok(b.hp < b.maxHp, 'the Water Dragon hunted the rival down');
});
