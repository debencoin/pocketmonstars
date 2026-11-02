// 1v1 Stake Duel rooms: lobby, escrow deposits, authoritative 30 Hz simulation, live per-hit pot shares, settlement.
import { randomBytes } from 'node:crypto';
import { createMatch, step, snapshot, sanitizeInput, forfeit, aiInput, TICK } from '../shared/sim.mjs';
import { Monstar, GENESIS_IDS, stageFor } from '../shared/monstars.mjs';
import { StakeLedger, STAKE_POLICY, validateStake, settlementSplit, formatSol } from '../shared/stake.mjs';
import { newEscrow, buildSettlement, buildDeposit } from './escrow.mjs';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => [...randomBytes(6)].map(b => CODE_CHARS[b % CODE_CHARS.length]).join('');

export class MatchManager {
  constructor({ db, registry, chain, config, policy = STAKE_POLICY, now = () => Date.now() }) {
    Object.assign(this, { db, registry, chain, config, policy, now });
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
    if (!GENESIS_IDS.includes(sid)) throw Error('Pick one of your own Monstars for that species.');
    return new Monstar({ speciesId: sid }); // free play: plain species stats
  }

  /** Practice vs AI run by the server, so the EXP your Monstar earns is saved to it. */
  createAi(wallet, { serial, speciesId }) {
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const monstar = this.resolveMonstar(wallet, { serial, speciesId }, false);
    const pool = GENESIS_IDS.filter(id => id !== monstar.species.id), sid = pool[Math.floor(Math.random() * pool.length)];
    const lvl = Math.max(1, monstar.level + Math.floor(Math.random() * 3) - 1);
    const bot = new Monstar({ speciesId: sid, level: lvl });
    let code; do code = 'AI' + newCode().slice(0, 4); while (this.rooms.has(code));
    const room = { id: randomBytes(16).toString('hex'), code, stake: 0n, state: 'countdown', countdown: 2.5, createdAt: this.now(), ai: true,
      players: [{ wallet, monstar, deposit: null, sockets: new Set(), lastSeen: this.now() }, { wallet: 'AI', ai: true, monstar: bot, sockets: new Set(), lastSeen: Infinity }],
      escrow: null, sim: null, ledger: null, seq: 0, aiMem: {} };
    this.rooms.set(code, room); this.byWallet.set(wallet, code);
    this.db.prepare('INSERT INTO matches(id,code,stake,player_a,player_b,monstar_a,monstar_b,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(room.id, code, '0', wallet, 'AI', String(monstar.serial ?? 'species:' + monstar.species.id), 'species:' + sid, 'countdown', room.createdAt);
    return room;
  }

  create(wallet, { stakeLamports = '0', serial, speciesId }) {
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const stake = validateStake(BigInt(stakeLamports), this.policy);
    const monstar = this.resolveMonstar(wallet, { serial, speciesId }, stake > 0n);
    let code; do code = newCode(); while (this.rooms.has(code));
    const escrow = stake > 0n ? newEscrow() : null;
    const room = { id: randomBytes(16).toString('hex'), code, stake, state: 'waiting', createdAt: this.now(),
      players: [{ wallet, monstar, deposit: null, sockets: new Set(), lastSeen: this.now() }], escrow, sim: null, ledger: null, seq: 0, countdown: 0 };
    this.rooms.set(code, room); this.byWallet.set(wallet, code);
    this.db.prepare('INSERT INTO matches(id,code,stake,player_a,monstar_a,escrow,escrow_secret,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(room.id, code, stake.toString(), wallet, String(monstar.serial ?? 'species:' + monstar.species.id), escrow?.address ?? null, escrow?.secret ?? null, 'waiting', room.createdAt);
    return room;
  }

  join(wallet, { code, serial, speciesId }) {
    const room = this.rooms.get(String(code || '').toUpperCase());
    if (!room) throw Error('No match with that code.');
    if (room.players.length > 1 || room.state !== 'waiting') throw Error('That match is already full.');
    if (room.players[0].wallet === wallet) throw Error('Use a second wallet to play yourself.');
    if (this.byWallet.has(wallet)) this.leave(wallet);
    const monstar = this.resolveMonstar(wallet, { serial, speciesId }, room.stake > 0n);
    room.players.push({ wallet, monstar, deposit: null, sockets: new Set(), lastSeen: this.now() });
    this.byWallet.set(wallet, room.code);
    room.state = room.stake > 0n ? 'deposit' : 'countdown';
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

  input(wallet, raw) {
    const room = this.roomOf(wallet);
    if (!room || room.state !== 'live') return;
    const idx = room.players.findIndex(p => p.wallet === wallet);
    room.sim.fighters[idx].input = sanitizeInput(raw);
  }

  leave(wallet) {
    const room = this.roomOf(wallet);
    if (!room) return;
    const idx = room.players.findIndex(p => p.wallet === wallet);
    if (room.state === 'live') { forfeit(room.sim, idx); return; } // the tick loop ends and settles it
    if (['waiting', 'deposit', 'countdown'].includes(room.state)) this.cancel(room, 'left');
  }

  roomOf(wallet) { const c = this.byWallet.get(wallet); return c ? this.rooms.get(c) : null; }

  // ---------- loop ----------
  tick(dt = TICK) {
    const now = this.now();
    for (const room of this.rooms.values()) {
      if (room.state === 'countdown') {
        room.countdown -= dt;
        if (room.countdown <= 0) this.start(room);
      } else if (room.state === 'live') {
        for (const [i, p] of room.players.entries()) {
          if (!p.ai && p.sockets.size === 0 && now - p.lastSeen > this.config.disconnectGraceMs) forfeit(room.sim, i);
        }
        if (room.ai) room.sim.fighters[1].input = sanitizeInput(aiInput(room.sim, 1, room.aiMem));
        for (const ev of step(room.sim, dt)) this.onHit(room, ev);
        if (room.sim.over) this.end(room);
      } else if (['waiting', 'deposit'].includes(room.state) && now - room.createdAt > this.config.depositTimeoutMs) {
        this.cancel(room, 'timeout');
      }
    }
  }

  start(room) {
    room.sim = createMatch(room.players[0].monstar, room.players[1].monstar, { arena: Math.floor(Math.random() * 4) });
    room.ledger = new StakeLedger(room.stake, this.policy);
    room.state = 'live'; room.startedAt = this.now();
    this.persistState(room);
  }

  onHit(room, ev) {
    if (ev.type === 'miss') return this.emit(room, { t: 'miss', attacker: ev.attacker, style: ev.style });
    if (ev.type === 'level') return this.emit(room, { t: 'level', side: ev.side, level: ev.level, stage: ev.stage, stageId: ev.stageId, evolved: ev.evolved });
    if (ev.type === 'bonus') return this.emit(room, { t: 'bonus', side: ev.side, exp: ev.exp });
    const fee = room.ledger.hit(ev.attacker, ev.damage, ev.victimMaxHp);
    const seq = room.seq++;
    this.db.prepare('INSERT INTO hit_log(match_id,seq,t,attacker,damage,fee) VALUES(?,?,?,?,?,?)').run(room.id, seq, room.sim.t, ev.attacker, ev.damage, fee.toString());
    this.emit(room, { t: 'hit', attacker: ev.attacker, damage: ev.damage, kind: ev.kind, style: ev.style, eff: ev.eff, crit: ev.crit, exp: ev.exp, fee: fee.toString(), shares: room.ledger.shares.map(String) });
  }

  end(room) {
    const sim = room.sim;
    const shares = room.ledger.finish(sim.winner);
    room.ledger.check();
    room.state = room.stake > 0n ? 'settling' : 'done';
    this.db.prepare('UPDATE matches SET state=?, winner=?, reason=?, shares=?, hits=?, ended_at=? WHERE id=?')
      .run(room.state, sim.winner, sim.reason, JSON.stringify(shares.map(String)), JSON.stringify(room.ledger.hits), this.now(), room.id);
    // Save the EXP each registered Monstar earned (levels and evolutions persist).
    const progress = sim.fighters.map((f, i) => {
      const p = room.players[i], m = p.monstar;
      if (!p.ai && m.serial != null && this.registry.get(m.serial)?.owner === p.wallet) this.registry.setExp(m.serial, f.exp);
      return { gained: f.expGained, level: f.level, stage: stageFor(f.level).name, saved: !p.ai && m.serial != null };
    });
    this.emit(room, { t: 'end', winner: sim.winner, reason: sim.reason, shares: shares.map(String), stake: room.stake.toString(), progress });
    if (room.stake > 0n) this.settle(room, shares, sim.winner).catch(e => this.emit(room, { t: 'settlement', ok: false, error: e.message }));
    else this.close(room);
  }

  cancel(room, reason) {
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
    const transfers = room.players.map((p, i) => ({ to: p.wallet, lamports: split.payouts[i] }));
    if (split.company > 0n) transfers.push({ to: treasury, lamports: split.company });
    return { split, transfers, balance };
  }

  async settle(room, shares, winner, opts = {}) {
    const { split, transfers } = await this.payoutPlan(room, shares, winner, opts);
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
    this.persistState(room);
    this.emit(room, { t: 'settlement', ok, refund: !!opts.refund, signature: signed.signature,
      payouts: split.payouts.map(String), company: split.company.toString(), network: split.network.toString(),
      summary: room.players.map((p, i) => `${p.wallet.slice(0, 4)}… receives ${formatSol(split.payouts[i])} SOL`).join(' · ') });
    this.close(room);
  }

  persistState(room, reason = null) { this.db.prepare('UPDATE matches SET state=?, reason=COALESCE(?,reason) WHERE id=?').run(room.state, reason, room.id); }
  close(room) {
    for (const p of room.players) if (this.byWallet.get(p.wallet) === room.code) this.byWallet.delete(p.wallet);
    setTimeout(() => this.rooms.delete(room.code), 30_000).unref?.();
  }

  // ---------- sockets ----------
  attach(wallet, ws) { const room = this.roomOf(wallet); const p = room?.players.find(q => q.wallet === wallet); if (p) { p.sockets.add(ws); p.lastSeen = this.now(); } }
  detach(wallet, ws) { const room = this.roomOf(wallet); const p = room?.players.find(q => q.wallet === wallet); if (p) { p.sockets.delete(ws); p.lastSeen = this.now(); } }
  emit(room, msg) { const s = JSON.stringify(msg); for (const p of room.players) for (const ws of p.sockets) { try { ws.send(s); } catch {} } }

  publicRoom(room, wallet) {
    return { t: 'room', code: room.code, state: room.state, stake: room.stake.toString(), escrow: room.escrow?.address ?? null,
      you: room.players.findIndex(p => p.wallet === wallet), countdown: Math.max(0, Math.ceil(room.countdown || 0)),
      ai: !!room.ai, players: room.players.map(p => ({ wallet: p.wallet, ai: !!p.ai, deposited: !!p.deposit, monstar: p.monstar.toJSON() })),
      shares: room.ledger ? room.ledger.shares.map(String) : room.players.map(() => room.stake.toString()) };
  }
  broadcastStates() {
    for (const room of this.rooms.values()) {
      if (room.state === 'live') this.emit(room, { t: 'state', s: snapshot(room.sim), shares: room.ledger.shares.map(String) });
      else for (const p of room.players) for (const ws of p.sockets) { try { ws.send(JSON.stringify(this.publicRoom(room, p.wallet))); } catch {} }
    }
  }
}
