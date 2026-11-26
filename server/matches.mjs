// 1v1 Stake Duel rooms: lobby, escrow deposits, authoritative 30 Hz simulation, live per-hit pot shares, settlement.
import { randomBytes } from 'node:crypto';
import { createMatch, step, snapshot, sanitizeInput, forfeit, aiInput, TICK, ARENA_COUNT } from '../shared/sim.mjs';
import { Monstar, GENESIS_IDS, STARTER_IDS, SPECIES, TIERS, rollWild, stageFor, wildLevel } from '../shared/monstars.mjs';
import { stageOf, bossLevel, BOSS_COOP } from '../shared/bosses.mjs';

export const WILD_ZONE_MIN = [1, 6, 14, 26];
import { createHash } from 'node:crypto';
import { Players } from './players.mjs';

/** Username (free) accounts catch 2 wild Monstars free; after that each catch needs a catch pass (bought with a card). Phantom wallets pay SOL per wild run instead. */
export const FREE_CATCHES = 2;
/** Red HP: a wild Monstar at or below 25% HP can be captured. */
export const CAPTURE_HP = 0.25;
const TIER_CATCH = { Common: 1.15, Uncommon: 1.0, Rare: 0.85, Epic: 0.7, Mythic: 0.45, Divine: 0.3 };
/** Each species has its own base catch rate (25-65%), scaled by rarity, how low its HP is, and a fresh random roll every throw. */
export function captureChance(speciesId, hpFrac, rand = Math.random()) {
  const h = createHash('sha256').update('pocketmonstars:catch:' + speciesId).digest()[0];
  const base = 0.25 + (h % 41) / 100, tier = TIER_CATCH[SPECIES[speciesId].tier] ?? 0.8;
  const low = 1 + Math.max(0, CAPTURE_HP - hpFrac) * 2; // lower HP, better odds (up to x1.5)
  return Math.max(0.03, Math.min(0.9, base * tier * low * (0.7 + rand * 0.6)));
}
import { StakeLedger, STAKE_POLICY, validateStake, settlementSplit, formatSol } from '../shared/stake.mjs';
import { newEscrow, buildSettlement, buildDeposit } from './escrow.mjs';
import { verifyWalletSignature } from './auth.mjs';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => [...randomBytes(6)].map(b => CODE_CHARS[b % CODE_CHARS.length]).join('');

export class MatchManager {
  constructor({ db, registry, chain, config, players = null, policy = STAKE_POLICY, now = () => Date.now() }) {
    Object.assign(this, { db, registry, chain, config, players, policy, now });
    this.rooms = new Map(); // code -> room
    this.byWallet = new Map(); // wallet -> code
  }

  // ---------- lobby ----------
  resolveMonstar(wallet, { serial, speciesId }, staked) {
    if (serial != null) {
      const m = this.registry.get(Number(serial));
      if (!m || m.owner !== wallet) throw Error('You do not own that Monstar.');
      return m;
    }
    if (staked) throw Error('Staked duels need one of your own registered Monstars.');
    const sid = Number(speciesId) || 0;
    if (!GENESIS_IDS.includes(sid) && !STARTER_IDS.includes(sid)) throw Error('Pick one of your own Monstars for that species.'); // free play: the Genesis nine and the four starters
    return new Monstar({ speciesId: sid }); // free play: plain species stats
  }

  /** 1v1 picks one Monstar; 3v3 sends `serials` (or `speciesIds` for free play) with up to three. */
  resolveTeam(wallet, msg, staked) {
    if (msg.mode !== '3v3') return [this.resolveMonstar(wallet, msg, staked)]; // 3v3 covers both tag team and squad (msg.squad)
    const serials = Array.isArray(msg.serials) ? msg.serials.slice(0, 3) : [], sids = Array.isArray(msg.speciesIds) ? msg.speciesIds.slice(0, 3) : [];
    const team = serials.length ? serials.map(serial => this.resolveMonstar(wallet, { serial }, staked)) : sids.map(speciesId => this.resolveMonstar(wallet, { speciesId }, staked));
    if (team.length !== 3) throw Error('Pick three Monstars for a 3v3.');
    if (serials.length && new Set(serials.map(Number)).size !== 3) throw Error('Pick three different Monstars.');
    return team;
  }

  /** Practice vs AI run by the server, so the EXP your Monstars earn is saved to them. */
  createAi(wallet, msg) {
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const team = this.resolveTeam(wallet, msg, false), monstar = team[0];
    const pick = () => { const pool = GENESIS_IDS.filter(id => !team.some(t => t.species.id === id)); return pool[Math.floor(Math.random() * pool.length)]; };
    const lvl = () => Math.max(1, monstar.level + Math.floor(Math.random() * 3) - 1);
    const bots = team.map(() => new Monstar({ speciesId: pick(), level: lvl() })), bot = bots[0], sid = bot.species.id;
    return this.aiRoom(wallet, team, bots, { level: ['easy', 'normal', 'hard'].includes(msg.level) ? msg.level : 'normal', squad: !!msg.squad && team.length > 1 });
  }

  // ---------- Boss Arena ----------
  /** Solo: 1, 2 or 3 of your Monstars against a level's two bosses (1v2, 2v2, 3v2). Online together (`coop`): you bring one
   *  Monstar, open a raid for `size` players (2 or 3), and other players join with theirs; the bosses are 3-5 levels higher. */
  createBoss(wallet, msg) {
    const st = stageOf(msg.stage), coop = !!msg.coop;
    if (coop && wallet.startsWith('@')) throw Error('Raiding together online needs a Phantom wallet. Sign in with Phantom.');
    const serials = (Array.isArray(msg.serials) ? msg.serials : [msg.serial]).filter(x => x != null).map(Number).slice(0, coop ? 1 : 3);
    if (!serials.length) throw Error('Pick your Monstar first.');
    if (new Set(serials).size !== serials.length) throw Error('Pick different Monstars.');
    const team = serials.map(serial => this.resolveMonstar(wallet, { serial }, false));
    if (team.some(m => m.species.boss)) throw Error('Boss Monsters guard the levels: fight them with your other Monstars.');
    if (this.byWallet.has(wallet)) this.leave(wallet);
    let code; do code = 'BS' + newCode().slice(0, 4); while (this.rooms.has(code));
    const size = coop ? Math.max(2, Math.min(BOSS_COOP.maxPlayers, Number(msg.size) || 2)) : team.length;
    const room = { id: randomBytes(16).toString('hex'), code, stake: 0n, state: coop ? 'waiting' : 'countdown', countdown: 2.5, createdAt: this.now(), ai: true, mode: '3v3', squad: true,
      boss: { stage: st.stage, coop, size }, allies: [],
      players: [{ wallet, monstar: team[0], team, deposit: null, sockets: new Set(), lastSeen: this.now() }, { wallet: 'AI', ai: true, monstar: null, team: [], sockets: new Set(), lastSeen: Infinity }],
      escrow: null, sim: null, ledger: null, seq: 0, aiMem: { hard: true, level: 'hard' } };
    this.bossBots(room);
    this.rooms.set(code, room); this.byWallet.set(wallet, code); this.release(wallet);
    this.db.prepare('INSERT INTO matches(id,code,stake,player_a,player_b,monstar_a,monstar_b,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(room.id, code, '0', wallet, 'BOSS', String(team[0].serial), 'boss:' + st.stage, room.state, room.createdAt);
    return room;
  }
  /** The two bosses of the level, levelled above the strongest Monstar on the team (rebuilt when a player joins). */
  bossBots(room) {
    const st = stageOf(room.boss.stage), team = [...room.players[0].team, ...room.allies.map(a => a.monstar)], lvl = bossLevel(team.map(m => m.level), room.boss.coop);
    room.players[1].team = st.bosses.map(sid => new Monstar({ speciesId: sid, level: lvl })); room.players[1].monstar = room.players[1].team[0]; room.boss.level = lvl;
  }
  /** Join an open online raid with one of your Monstars. It starts by itself when the raid is full. */
  joinBoss(wallet, { code, serial }) {
    const room = this.rooms.get(String(code || '').toUpperCase());
    if (!room?.boss?.coop || room.state !== 'waiting') throw Error('That raid is not open any more.');
    if (wallet.startsWith('@')) throw Error('Raiding together online needs a Phantom wallet. Sign in with Phantom.');
    if (this.members(room).some(p => p.wallet === wallet)) return room;
    if (1 + room.allies.length >= room.boss.size) throw Error('That raid is full.');
    const monstar = this.resolveMonstar(wallet, { serial }, false);
    if (monstar.species.boss) throw Error('Boss Monsters guard the levels: fight them with your other Monstars.');
    if (this.byWallet.has(wallet)) this.leave(wallet);
    room.allies.push({ wallet, monstar, slot: 1 + room.allies.length, sockets: new Set(), lastSeen: this.now() });
    this.byWallet.set(wallet, room.code); this.release(wallet); this.bossBots(room);
    if (1 + room.allies.length >= room.boss.size) { room.state = 'countdown'; room.countdown = 3; this.persistState(room); }
    return room;
  }
  /** The raid leader starts now with whoever has joined. */
  bossGo(wallet) {
    const room = this.roomOf(wallet);
    if (!room?.boss || room.state !== 'waiting' || room.players[0].wallet !== wallet) throw Error('Only the raid leader can start the raid.');
    this.bossBots(room); room.state = 'countdown'; room.countdown = 3; this.persistState(room); return room;
  }
  openRaids() {
    return [...this.rooms.values()].filter(r => r.boss?.coop && r.state === 'waiting').map(r => ({ code: r.code, stage: r.boss.stage, size: r.boss.size, level: r.boss.level, createdAt: r.createdAt,
      players: this.members(r).map(p => ({ wallet: p.wallet, monstar: p.monstar.toJSON() })) })).sort((a, b) => b.createdAt - a.createdAt);
  }
  badges(wallet) { return this.db.prepare('SELECT stage, at FROM boss_badges WHERE wallet=? ORDER BY stage').all(wallet); }
  /** Everyone on the players' side: the room's two seats plus raid allies (Boss Arena online). */
  members(room) { return [...room.players, ...(room.allies || [])]; }

  /** Wild Expedition: a paid (0.0001 SOL) battle against a random wild Monstar. Win it for a chance to catch it. */
  async createWild(wallet, { serial, signature, zone = 0 }) {
    let sig;
    const monstar = this.resolveMonstar(wallet, { serial }, true);
    if (wallet.startsWith('@')) { // username accounts: free runs with a short cooldown
      const last = this.db.prepare('SELECT MAX(created_at) t FROM wild_runs WHERE wallet=?').get(wallet)?.t || 0, wait = last + this.config.freeWildCooldownMs - this.now();
      if (wait > 0) throw Error(`Your next free wild run is ready in ${Math.ceil(wait / 1000)} s.`);
      sig = `free:${wallet}:${this.now()}:${randomBytes(4).toString('hex')}`;
    } else {
      if (!this.config.treasury) throw Error('The company fee wallet is not set up yet, so the wild is closed.');
      sig = String(signature || '');
      if (this.db.prepare('SELECT 1 FROM wild_runs WHERE signature=?').get(sig)) throw Error('That entry fee was already used.');
      await this.chain.verifyDeposit(sig, { from: wallet, to: this.config.treasury, lamports: this.config.wildFeeLamports });
    }
    const z = Math.max(0, Math.min(WILD_ZONE_MIN.length - 1, Number(zone) || 0)), sid = rollWild(Math.random(), id => SPECIES[id].wildOne && this.wildOneBusy(id)), tier = TIERS[SPECIES[sid].tier];
    const level = wildLevel(SPECIES[sid], monstar.level, Math.random, WILD_ZONE_MIN[z]); // always above your Monstar (special ones: 1% chance of a level 1)
    this.db.prepare('INSERT INTO wild_runs(signature,wallet,species,level,created_at) VALUES(?,?,?,?,?)').run(sig, wallet, sid, level, this.now());
    if (this.byWallet.has(wallet)) this.leave(wallet);
    return this.aiRoom(wallet, [monstar], [new Monstar({ speciesId: sid, level })], { wild: { signature: sig, speciesId: sid, level, tier: SPECIES[sid].tier }, hard: tier.lvl >= 12 });
  }

  /** A one-of-a-kind wild Monstar is met by one player at a time, and never again once it has been caught. */
  wildOneBusy(sid) { return this.registry.wildOneTaken(sid) || [...this.rooms.values()].some(r => r.wild?.speciesId === sid && ['countdown', 'live'].includes(r.state)); }

  aiRoom(wallet, team, bots, { wild = null, hard = false, level = 'normal', squad = false }) {
    const monstar = team[0], bot = bots[0], sid = bot.species.id;
    let code; do code = 'AI' + newCode().slice(0, 4); while (this.rooms.has(code));
    const room = { id: randomBytes(16).toString('hex'), code, stake: 0n, state: 'countdown', countdown: 2.5, createdAt: this.now(), ai: true, wild, mode: team.length > 1 ? '3v3' : '1v1', squad,
      players: [{ wallet, monstar, team, deposit: null, sockets: new Set(), lastSeen: this.now() }, { wallet: 'AI', ai: true, monstar: bot, team: bots, sockets: new Set(), lastSeen: Infinity }],
      escrow: null, sim: null, ledger: null, seq: 0, aiMem: { hard, level } };
    this.rooms.set(code, room); this.byWallet.set(wallet, code); this.release(wallet);
    this.db.prepare('INSERT INTO matches(id,code,stake,player_a,player_b,monstar_a,monstar_b,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(room.id, code, '0', wallet, 'AI', String(monstar.serial ?? 'species:' + monstar.species.id), 'species:' + sid, 'countdown', room.createdAt);
    return room;
  }

  create(wallet, msg) {
    const { stakeLamports = '0' } = msg;
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const immortal = !!msg.immortal;
    const stake = immortal ? 0n : validateStake(BigInt(stakeLamports), this.policy);
    if (stake > 0n && wallet.startsWith('@')) throw Error('Sign in with Phantom to stake SOL. Username accounts play free matches.');
    if (immortal && msg.mode === '3v3') throw Error('Immortal Combat is 1v1 only.');
    const team = this.resolveTeam(wallet, { ...msg, mode: immortal ? '1v1' : msg.mode }, stake > 0n || immortal), monstar = team[0];
    if (immortal) this.checkImmortal(monstar);
    // Simulated SOL: Phantom players stake play money from their in-game balance (no transactions, no real SOL)
    const simSol = !!msg.simSol && stake > 0n;
    if (simSol) this.checkSimBalance(wallet, stake);
    let code; do code = newCode(); while (this.rooms.has(code));
    const escrow = stake > 0n && !simSol ? newEscrow() : null;
    const room = { id: randomBytes(16).toString('hex'), code, stake, immortal, simSol, state: 'waiting', createdAt: this.now(), mode: team.length > 1 ? '3v3' : '1v1', squad: !!msg.squad && team.length > 1,
      players: [{ wallet, monstar, team, deposit: null, locked: wallet.startsWith('@'), sockets: new Set(), lastSeen: this.now() }], escrow, sim: null, ledger: null, seq: 0, countdown: 0 };
    this.rooms.set(code, room); this.byWallet.set(wallet, code); this.release(wallet);
    this.db.prepare('INSERT INTO matches(id,code,stake,player_a,monstar_a,escrow,escrow_secret,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(room.id, code, simSol ? '0' : stake.toString(), wallet, String(monstar.serial ?? 'species:' + monstar.species.id), escrow?.address ?? null, escrow?.secret ?? null, 'waiting', room.createdAt);
    return room;
  }
  checkSimBalance(wallet, stake) {
    if (!this.players) throw Error('Simulated SOL is not available right now.');
    const b = this.players.simBalance(wallet);
    if (b < stake) throw Error(`Not enough simulated SOL: you have ${formatSol(b, 4)}. Top up free on the Arena tab (once a day when you're low).`);
  }

  join(wallet, msg) {
    const { code } = msg;
    const room = this.rooms.get(String(code || '').toUpperCase());
    if (!room) throw Error('No match with that code.');
    if (room.players.length > 1 || room.state !== 'waiting') throw Error('That match is already full.');
    if (room.players[0].wallet === wallet) throw Error('Use a second wallet to play yourself.');
    if (room.stake > 0n && wallet.startsWith('@')) throw Error('This match is for SOL. Sign in with Phantom to join it.');
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const team = this.resolveTeam(wallet, { ...msg, mode: room.mode }, room.stake > 0n || room.immortal), monstar = team[0];
    if (room.immortal) { if (!msg.immortalOk) throw Error('IMMORTAL_CONFIRM'); this.checkImmortal(monstar); }
    if (room.simSol) this.checkSimBalance(wallet, room.stake);
    room.players.push({ wallet, monstar, team, deposit: null, locked: wallet.startsWith('@'), sockets: new Set(), lastSeen: this.now() });
    this.byWallet.set(wallet, room.code); this.release(wallet);
    if (room.simSol) { for (const p of room.players) this.players.simAdd(p.wallet, -room.stake); room.debited = true; } // both stakes go into the (simulated) pot
    // Immortal Combat: Phantom players sign before the fight (a consent signature, or moving a minted NFT into the match escrow)
    room.state = room.stake > 0n && !room.simSol ? 'deposit' : room.immortal && !room.players.every(p => p.locked) ? 'lock' : 'countdown';
    if (room.state === 'countdown') room.countdown = 3;
    this.db.prepare('UPDATE matches SET player_b=?, monstar_b=?, state=? WHERE id=?')
      .run(wallet, String(monstar.serial ?? 'species:' + monstar.species.id), room.state, room.id);
    return room;
  }

  async depositTransaction(wallet) {
    const room = this.roomOf(wallet);
    if (!room?.escrow) throw Error('This match has no stake.');
    const { blockhash } = await this.chain.latestBlockhash();
    return buildDeposit({ from: wallet, escrow: room.escrow.address, lamports: room.stake, blockhash });
  }

  async confirmDeposit(wallet, signature) {
    const room = this.roomOf(wallet);
    if (!room || room.state !== 'deposit') throw Error('Not waiting for deposits.');
    const idx = room.players.findIndex(p => p.wallet === wallet);
    if (room.players[idx].deposit) return room;
    await this.chain.verifyDeposit(signature, { from: wallet, to: room.escrow.address, lamports: room.stake });
    this.db.prepare(`UPDATE matches SET deposit_${idx ? 'b' : 'a'}=? WHERE id=?`).run(signature, room.id); // UNIQUE: a deposit can't be reused
    room.players[idx].deposit = signature;
    if (room.players.every(p => p.deposit)) { room.state = 'countdown'; room.countdown = 3; this.persistState(room); }
    return room;
  }

  /** Immortal Combat puts your Monstar on the line: it must be yours, not minted as an NFT and not already held in a soul claim. */
  checkImmortal(m) {
    if (m.serial == null) throw Error('Immortal Combat needs one of your own Monstars.');
    if (m.asset && m.owner.startsWith('@')) throw Error('Minted NFT Monstars need Phantom for Immortal Combat.');
    if (this.players?.openSoulClaimFor(m.serial)) throw Error('That Monstar is held in a soul claim right now. Pick another one.');
  }
  /** The exact text a Phantom player signs to put an (unminted) Monstar on the line. */
  consentMessage(room, wallet) {
    const p = room.players.find(x => x.wallet === wallet), m = p.monstar;
    return `PocketMonstars Immortal Combat\nMatch ${room.code} · ${room.id.slice(0, 12)}\nMy Monstar: ${m.toJSON().form || m.species.name} #${m.serial}\nI agree: if I lose this match, the winner takes this Monstar. I can only get it back by paying the winner's soul fee within 24 hours.`;
  }
  signConsent(wallet, signature) {
    const room = this.roomOf(wallet), p = room?.players.find(x => x.wallet === wallet);
    if (!room?.immortal || room.state !== 'lock' || !p) throw Error('Nothing to sign right now.');
    if (p.monstar.asset) throw Error('This Monstar is an NFT: move it into the match escrow instead.');
    if (!verifyWalletSignature(wallet, this.consentMessage(room, wallet), String(signature || ''))) throw Error('That signature does not match.');
    p.locked = true; p.consent = signature; this.maybeStart(room); return room;
  }
  markLocked(wallet) { const room = this.roomOf(wallet), p = room?.players.find(x => x.wallet === wallet); if (!p || room.state !== 'lock') throw Error('Nothing to lock right now.'); p.locked = true; this.maybeStart(room); return room; }
  maybeStart(room) { if (room.state === 'lock' && room.players.length === 2 && room.players.every(p => p.locked)) { room.state = 'countdown'; room.countdown = 3; this.persistState(room); } }
  input(wallet, raw) {
    const room = this.roomOf(wallet);
    if (!room || room.state !== 'live') return;
    if (room.boss) { // Boss Arena: each player drives their own Monstar (no switching onto a teammate's)
      const ally = room.allies.find(a => a.wallet === wallet), f = ally ? room.sim.roster[0][ally.slot] : room.boss.coop ? room.sim.roster[0][0] : room.sim.fighters[0];
      if (f && f.hp > 0) f.input = sanitizeInput(room.boss.coop ? { ...raw, sw: -1 } : raw); return; }
    const idx = room.players.findIndex(p => p.wallet === wallet);
    room.sim.fighters[idx].input = sanitizeInput(raw);
  }

  /** Throw a capture at a wild Monstar whose HP is in the red. Odds differ per species and change every throw. */
  /** Can this player catch right now? { ok, free, credits, pass } — `pass` = this catch uses a catch pass. */
  catchAllowance(wallet) {
    if (!wallet.startsWith('@') || !this.players) return { ok: true, pass: false };
    const used = this.db.prepare('SELECT COUNT(*) n FROM wild_runs WHERE wallet=? AND caught_serial IS NOT NULL').get(wallet).n, credits = this.players.catchCredits(wallet);
    const free = Math.max(0, FREE_CATCHES - used); return { ok: free > 0 || credits > 0, free, credits, pass: free <= 0 };
  }
  takeCatch(wallet) { const a = this.catchAllowance(wallet); if (a.pass && !this.players.useCatchCredit(wallet)) throw Error('NEED_PASS'); }
  capture(wallet) {
    const room = this.roomOf(wallet);
    if (!room?.wild || room.state !== 'live') throw Error('You can only capture in a wild battle.');
    if (!this.catchAllowance(wallet).ok) throw Error('You used your 2 free catches. Get catch passes (card) to keep catching.');
    const foe = room.sim.fighters[1], frac = foe.hp / foe.maxHp, now = this.now();
    if (frac > CAPTURE_HP) throw Error('Get its HP into the red first.');
    room.throws ??= 0; if (room.throws >= 3) throw Error('No capture tries left this battle. KO it for one last chance.');
    if (now - (room.lastThrow || 0) < 1500) throw Error('Wait a moment before throwing again.');
    room.throws++; room.lastThrow = now;
    const chance = captureChance(room.wild.speciesId, frac), ok = Math.random() < chance;
    const msg = { t: 'capture', ok, chance: Math.round(chance * 100), left: 3 - room.throws, code: room.code };
    if (ok) {
      try { room.captured = this.registry.catchWild(room.players[0].wallet, room.wild.speciesId, room.wild.level); }
      catch (e) { const gone = { ...msg, ok: false, taken: true, error: e.message }; this.emit(room, gone); return gone; } // a one-of-a-kind someone else just caught
      this.takeCatch(wallet); forfeit(room.sim, 1); this.end(room); }
    else this.emit(room, msg);
    return msg;
  }

  leave(wallet) {
    const room = this.roomOf(wallet);
    if (!room) return;
    const ally = room.allies?.find(a => a.wallet === wallet);
    if (ally) { // a raid ally leaves: the AI takes over their Monstar (or they simply drop out before the start)
      if (room.state === 'live') { const f = room.sim.roster[0][ally.slot]; if (f) f.human = false; }
      else { room.allies = room.allies.filter(a => a !== ally); room.allies.forEach((a, i) => (a.slot = i + 1)); this.bossBots(room); }
      this.byWallet.delete(wallet); return; }
    const idx = room.players.findIndex(p => p.wallet === wallet);
    if (room.state === 'live' && room.boss?.coop && room.allies.some(a => room.sim.roster[0][a.slot]?.human)) { const f = room.sim.roster[0][0]; if (f) f.human = false; this.byWallet.delete(wallet); room.leaderGone = true; return; }
    if (room.state === 'live') { forfeit(room.sim, idx); this.byWallet.delete(wallet); return; } // the tick loop ends and settles it
    if (['waiting', 'deposit', 'lock', 'countdown'].includes(room.state)) this.cancel(room, 'left');
  }

  /** A player starting or joining another match stops receiving anything from their previous one. */
  release(wallet) { for (const room of this.rooms.values()) for (const p of this.members(room)) if (p.wallet === wallet && this.byWallet.get(wallet) !== room.code) p.sockets.clear(); }
  roomOf(wallet) { const c = this.byWallet.get(wallet); return c ? this.rooms.get(c) : null; }

  // ---------- loop ----------
  tick(dt = TICK) {
    for (const room of this.rooms.values()) {
      try { this.tickRoom(room, dt); }
      catch (e) { // one broken match must never take the server down for everyone
        console.error('match', room.code, 'error:', e?.stack || e);
        try { if (room.state === 'live') { forfeit(room.sim, 1); this.end(room); } else this.cancel(room, 'error'); } catch { this.rooms.delete(room.code); }
      }
    }
  }
  tickRoom(room, dt) {
    const now = this.now();
    {
      if (room.state === 'countdown') {
        room.countdown -= dt;
        if (room.countdown <= 0) this.start(room);
      } else if (room.state === 'live') {
        if (room.boss?.coop) { // online raid: a player who drops keeps their Monstar fighting, driven by the AI
          for (const a of room.allies) if (a.sockets.size === 0 && now - a.lastSeen > this.config.disconnectGraceMs) { const f = room.sim.roster[0][a.slot]; if (f) f.human = false; }
          const lead = room.players[0]; if (room.leaderGone || (lead.sockets.size === 0 && now - lead.lastSeen > this.config.disconnectGraceMs)) { const f = room.sim.roster[0][0]; if (f) f.human = false; }
          if (!room.sim.fighters[0].human) room.sim.fighters[0].input = sanitizeInput(aiInput(room.sim, 0, {}));
        } else for (const [i, p] of room.players.entries()) {
          if (!p.ai && p.sockets.size === 0 && now - p.lastSeen > this.config.disconnectGraceMs) forfeit(room.sim, i);
        }
        if (room.ai) room.sim.fighters[1].input = sanitizeInput(aiInput(room.sim, 1, room.aiMem));
        for (const ev of step(room.sim, dt)) this.onHit(room, ev);
        if (room.sim.over) this.end(room);
      } else if (['waiting', 'deposit', 'lock'].includes(room.state) && now - room.createdAt > (room.boss ? BOSS_COOP.waitMs : this.config.depositTimeoutMs)) {
        this.cancel(room, 'timeout');
      }
    }
  }

  start(room) {
    if (room.boss) { // Boss Arena: the team (leader + raid allies) against the level's two bosses
      this.bossBots(room); const st = stageOf(room.boss.stage), team = [...room.players[0].team, ...room.allies.map(a => a.monstar)], humans = room.boss.coop ? [0, ...room.allies.map(a => a.slot)] : [];
      room.players[0].fullTeam = team;
      room.sim = createMatch(team, room.players[1].team, { arena: st.arena, squad: true, intro: true, boss: { hp: room.boss.coop ? 1 + BOSS_COOP.hpPerExtraPlayer * room.allies.length : 1.15, humans } });
      room.ledger = new StakeLedger(room.stake, this.policy); room.state = 'live'; room.startedAt = this.now(); this.persistState(room); return; }
    const side = p => (p.team?.length > 1 ? p.team : p.monstar);
    room.sim = createMatch(side(room.players[0]), side(room.players[1]), { arena: room.wild ? Math.floor(Math.random() * ARENA_COUNT) : Math.floor(Math.random() * ARENA_COUNT), squad: !!room.squad, intro: true });
    room.ledger = new StakeLedger(room.stake, this.policy);
    room.state = 'live'; room.startedAt = this.now();
    this.persistState(room);
  }

  onHit(room, ev) {
    if (ev.type === 'miss') return this.emit(room, { t: 'miss', attacker: ev.attacker, style: ev.style });
    if (ev.type === 'level') return this.emit(room, { t: 'level', side: ev.side, level: ev.level, stage: ev.stage, stageId: ev.stageId, evolved: ev.evolved, perk: ev.perk });
    if (ev.type === 'bonus') return this.emit(room, { t: 'bonus', side: ev.side, exp: ev.exp });
    if (ev.type === 'blocked') return this.emit(room, { t: 'blocked', attacker: ev.attacker, victim: ev.victim, shield: ev.shield });
    if (ev.type === 'status') return this.emit(room, { t: 'status', side: ev.side, k: ev.k, label: ev.label });
    if (ev.type === 'ult') return this.emit(room, { t: 'ult', side: ev.side });
    if (ev.type === 'pickup') return this.emit(room, { t: 'pickup', side: ev.side, k: ev.k, amount: ev.amount, x: ev.x, y: ev.y });
    if (['dash', 'guard', 'mega', 'quake', 'hazard', 'earthquake', 'wallhit', 'ascend', 'descend', 'transform'].includes(ev.type)) return this.emit(room, { ...ev, t: ev.type, type: undefined });
    if (ev.type !== 'hit') return;
    if (ev.type === 'switch') return this.emit(room, { t: 'switch', side: ev.side, slot: ev.slot, speciesId: ev.speciesId, reason: ev.reason });
    const fee = room.ledger.hit(ev.attacker, ev.damage, ev.victimMaxHp, ev);
    const seq = room.seq++;
    this.db.prepare('INSERT INTO hit_log(match_id,seq,t,attacker,damage,fee) VALUES(?,?,?,?,?,?)').run(room.id, seq, room.sim.t, ev.attacker, ev.damage, fee.toString());
    this.emit(room, { t: 'hit', attacker: ev.attacker, victim: ev.victim, vx: ev.vx, vy: ev.vy, victimMaxHp: ev.victimMaxHp, lvl: ev.lvl, atk: ev.atk, pw: ev.pw, damage: ev.damage, kind: ev.kind, style: ev.style, eff: ev.eff, crit: ev.crit, exp: ev.exp, fee: fee.toString(), shares: room.ledger.shares.map(String) });
  }

  end(room) {
    const sim = room.sim;
    const shares = room.ledger.finish(sim.winner);
    room.ledger.check();
    room.state = room.stake > 0n && !room.simSol ? 'settling' : 'done';
    this.db.prepare('UPDATE matches SET state=?, winner=?, reason=?, shares=?, hits=?, ended_at=? WHERE id=?')
      .run(room.state, sim.winner, sim.reason, JSON.stringify(shares.map(String)), JSON.stringify(room.ledger.hits), this.now(), room.id);
    // Save the EXP each registered Monstar earned (levels and evolutions persist).
    const progress = sim.fighters.map((active, i) => {
      const p = room.players[i];
      const owners = i === 0 ? this.members(room).filter(x => !x.ai).map(x => x.wallet) : [p.wallet]; // raid allies' Monstars level up for their own owners
      for (const f of sim.roster[i]) { const m = f?.mon; if (f && !p.ai && m.serial != null && owners.includes(this.registry.get(m.serial)?.owner)) this.registry.setExp(m.serial, f.exp); }
      const f = sim.roster[i][0] || active;
      return { gained: sim.roster[i].reduce((n, x) => n + (x?.expGained || 0), 0), level: f.level, stage: stageFor(f.level).name, saved: !p.ai && p.monstar.serial != null };
    });
    let caught;
    if (room.wild && room.captured) { // captured while its HP was in the red
      caught = { won: true, captured: true, chance: 1, speciesId: room.wild.speciesId, tier: room.wild.tier, ok: true, monstar: room.captured.toJSON() };
      this.db.prepare('UPDATE wild_runs SET won=1, caught_serial=? WHERE signature=?').run(room.captured.serial, room.wild.signature);
    } else if (room.wild) { // win a wild battle for a chance to catch it (as an Infant)
      const won = sim.winner === 0, chance = TIERS[room.wild.tier].catch;
      caught = { won, chance, speciesId: room.wild.speciesId, tier: room.wild.tier, ok: false };
      const allow = this.catchAllowance(room.players[0].wallet); if (won && !allow.ok) caught.needPass = true;
      if (won && allow.ok && Math.random() < chance) {
        try { const c = this.registry.catchWild(room.players[0].wallet, room.wild.speciesId, room.wild.level); this.takeCatch(room.players[0].wallet); caught.ok = true; caught.monstar = c.toJSON(); }
        catch (e) { caught.taken = true; caught.error = e.message; } }
      this.db.prepare('UPDATE wild_runs SET won=?, caught_serial=? WHERE signature=?').run(won ? 1 : 0, caught.monstar?.serial ?? null, room.wild.signature);
    }
    let badge = null;
    if (room.boss && sim.winner === 0) { // every player on the winning raid earns this level's ancient Anunnaki seal
      const wallets = this.members(room).filter(x => !x.ai).map(x => x.wallet), team = JSON.stringify(wallets);
      for (const w of wallets) this.db.prepare('INSERT OR IGNORE INTO boss_badges(wallet, stage, at, team) VALUES(?,?,?,?)').run(w, room.boss.stage, this.now(), team);
      badge = { stage: room.boss.stage, wallets };
    }
    let immortal = null;
    if (room.immortal && (sim.winner === 0 || sim.winner === 1) && room.players.length === 2) { // the winner takes the loser's Monstar
      const W = room.players[sim.winner], L = room.players[1 - sim.winner], m = this.registry.get(L.monstar.serial);
      const esc = m?.asset ? this.players?.escrowFor(room.code, m.serial) : null, wesc = W.monstar.asset ? this.players?.escrowFor(room.code, W.monstar.serial) : null;
      if (wesc?.state === 'held') this.players.updateEscrow(wesc.id, { release_to: W.wallet }); // the winner collects their own NFT back
      if (m && m.owner === L.wallet && (!m.asset || esc?.state === 'held')) {
        this.registry.setOwner(m.serial, W.wallet);
        const id = this.players?.newSoulClaim({ matchId: room.id, serial: m.serial, winner: W.wallet, loser: L.wallet, feeLamports: 100_000_000n });
        if (esc) this.players.updateEscrow(esc.id, { claim: id }); // stays in escrow during the buy-back time
        immortal = { claim: id, serial: m.serial, speciesId: m.species.id, name: m.toJSON().form || m.species.name, winner: W.wallet, loser: L.wallet, hours: 24 };
      }
    }
    this.emit(room, { t: 'end', winner: sim.winner, reason: sim.reason, shares: shares.map(String), stake: room.stake.toString(), progress, caught, immortal, badge });
    if (room.simSol) { // pay the simulated pot out by the final shares
      room.players.forEach((p, i) => this.players.simAdd(p.wallet, shares[i]));
      this.emit(room, { t: 'settlement', ok: true, sim: true, payouts: shares.map(String), company: '0', network: '0', balances: room.players.map(p => this.players.simBalance(p.wallet).toString()),
        summary: room.players.map((p, i) => `${p.wallet.slice(0, 4)}… receives ${formatSol(shares[i])} simulated SOL`).join(' · ') });
      this.close(room);
    } else if (room.stake > 0n) this.settle(room, shares, sim.winner).catch(e => this.emit(room, { t: 'settlement', ok: false, error: e.message }));
    else this.close(room);
  }

  cancel(room, reason) {
    for (const e of this.players?.escrowsOfRoom(room.code) || []) if (e.state === 'held') this.players.updateEscrow(e.id, { release_to: e.owner }); // NFTs go back to their owners
    if (room.simSol && room.debited) { room.debited = false; for (const p of room.players) this.players.simAdd(p.wallet, room.stake); } // simulated stakes go back
    const deposited = room.players.map(p => (p.deposit ? room.stake : 0n));
    room.state = 'cancelled';
    this.persistState(room, reason);
    this.emit(room, { t: 'cancelled', reason });
    if (deposited.some(d => d > 0n)) {
      const winner = deposited[0] > 0n ? 0 : 1;
      this.settle(room, deposited, winner, { refund: true }).catch(e => this.emit(room, { t: 'settlement', ok: false, error: e.message }));
    } else this.close(room);
  }

  // ---------- settlement ----------
  async payoutPlan(room, shares, winner, { refund = false } = {}) {
    const balance = await this.chain.balance(room.escrow.address);
    let treasury = this.config.treasury;
    if (treasury) {
      const [tb, min] = await Promise.all([this.chain.balance(treasury), this.chain.rentExemptMinimum(0)]);
      if (tb < min) treasury = null; // a 1-lamport transfer into an unfunded account would fail
    }
    const policy = { ...this.policy, companyFeeLamports: refund || !treasury ? 0n : this.policy.companyFeeLamports, companyFeeBps: refund || !treasury ? 0 : this.policy.companyFeeBps };
    const split = settlementSplit({ escrowBalance: balance, shares, winner, policy });
    // Referrals: whoever referred the winner gets 5% of what the winner won (their payout minus their stake).
    let referral = null;
    if (!refund && this.players && winner != null && room.players[winner]) {
      const w = room.players[winner].wallet, ref = this.players.referrerOf(w), cut = Players.cutOf(split.payouts[winner] - room.stake);
      if (ref && !ref.startsWith('@') && cut > 0n) {
        const [rb, min] = await Promise.all([this.chain.balance(ref), this.chain.rentExemptMinimum(0)]).catch(() => [0n, 1n]);
        if (rb + cut >= min) { split.payouts[winner] -= cut; referral = { to: ref, from: w, lamports: cut }; }
      }
    }
    const transfers = room.players.map((p, i) => ({ to: p.wallet, lamports: split.payouts[i] }));
    if (split.company > 0n) transfers.push({ to: treasury, lamports: split.company });
    if (referral) transfers.push({ to: referral.to, lamports: referral.lamports });
    return { split, transfers, balance, referral };
  }

  async settle(room, shares, winner, opts = {}) {
    const { split, transfers, referral } = await this.payoutPlan(room, shares, winner, opts);
    const { blockhash } = await this.chain.latestBlockhash();
    const signed = buildSettlement({ escrowSecret: room.escrow.secret, blockhash, transfers });
    // Persist the exact signed bytes BEFORE broadcasting; retries reuse them, never a new payout.
    this.db.prepare('UPDATE matches SET settlement_bytes=?, settlement_signature=? WHERE id=?').run(signed.bytes, signed.signature, room.id);
    await this.chain.sendRaw(signed.bytes);
    let status = null;
    for (let i = 0; i < 30; i++) {
      status = await this.chain.status(signed.signature);
      if (status?.err) break;
      if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    const ok = !!status && !status.err && ['confirmed', 'finalized'].includes(status.confirmationStatus);
    room.state = ok ? (opts.refund ? 'refunded' : 'settled') : 'settlement-needs-review';
    if (ok && referral) this.players.recordPayout(room.id, referral.to, referral.from, referral.lamports);
    this.persistState(room);
    this.emit(room, { t: 'settlement', ok, refund: !!opts.refund, signature: signed.signature,
      payouts: split.payouts.map(String), company: split.company.toString(), network: split.network.toString(),
      summary: room.players.map((p, i) => `${p.wallet.slice(0, 4)}… receives ${formatSol(split.payouts[i])} SOL`).join(' · ') + (referral ? ` · referrer ${referral.to.slice(0, 4)}… receives ${formatSol(referral.lamports)} SOL` : '') });
    this.close(room);
  }

  persistState(room, reason = null) { this.db.prepare('UPDATE matches SET state=?, reason=COALESCE(?,reason) WHERE id=?').run(room.state, reason, room.id); }
  close(room) {
    for (const p of this.members(room)) if (this.byWallet.get(p.wallet) === room.code) this.byWallet.delete(p.wallet);
    setTimeout(() => this.rooms.delete(room.code), 30_000).unref?.();
  }

  // ---------- sockets ----------
  attach(wallet, ws) { this.release(wallet); const room = this.roomOf(wallet); const p = room && this.members(room).find(q => q.wallet === wallet); if (p) { p.sockets.add(ws); p.lastSeen = this.now(); } }
  detach(wallet, ws) { const room = this.roomOf(wallet); const p = room && this.members(room).find(q => q.wallet === wallet); if (p) { p.sockets.delete(ws); p.lastSeen = this.now(); } }
  emit(room, msg) { const s = JSON.stringify({ ...msg, code: room.code }); for (const p of this.members(room)) for (const ws of p.sockets) { try { ws.send(s); } catch {} } }

  publicRoom(room, wallet) {
    return { t: 'room', code: room.code, state: room.state, stake: room.stake.toString(), escrow: room.escrow?.address ?? null,
      you: room.allies?.some(a => a.wallet === wallet) ? 0 : room.players.findIndex(p => p.wallet === wallet), countdown: Math.max(0, Math.ceil(room.countdown || 0)),
      ai: !!room.ai, immortal: !!room.immortal, simSol: !!room.simSol, mode: room.mode || '1v1', squad: !!room.squad, wild: room.wild ? { speciesId: room.wild.speciesId, level: room.wild.level, tier: room.wild.tier } : null,
      consent: room.immortal && room.state === 'lock' && wallet && !wallet.startsWith('@') && room.players.some(p => p.wallet === wallet && !p.locked && !p.monstar.asset) ? this.consentMessage(room, wallet) : null,
      boss: room.boss ? { ...room.boss, leader: room.players[0].wallet, slot: room.allies.find(a => a.wallet === wallet)?.slot ?? 0, allies: room.allies.map(a => ({ wallet: a.wallet, slot: a.slot, monstar: a.monstar.toJSON() })) } : null,
      players: room.players.map((p, i) => ({ wallet: p.wallet, ai: !!p.ai, deposited: !!p.deposit, locked: !!p.locked, nft: !!p.monstar.asset, monstar: p.monstar.toJSON(), team: (i === 0 && room.boss ? [...p.team, ...room.allies.map(a => a.monstar)] : p.team || [p.monstar]).map(x => x.toJSON()) })),
      shares: room.ledger ? room.ledger.shares.map(String) : room.players.map(() => room.stake.toString()) };
  }
  broadcastStates() {
    for (const room of this.rooms.values()) {
      if (room.state === 'live') this.emit(room, { t: 'state', s: snapshot(room.sim), shares: room.ledger.shares.map(String) });
      else if (['waiting', 'deposit', 'lock', 'countdown'].includes(room.state)) for (const p of this.members(room)) if (this.byWallet.get(p.wallet) === room.code) for (const ws of p.sockets) { try { ws.send(JSON.stringify(this.publicRoom(room, p.wallet))); } catch {} }
    }
  }
}
