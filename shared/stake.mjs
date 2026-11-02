// Stake Duel economics. All amounts are integer lamports (BigInt). 1 lamport = 0.000000001 SOL,
// the smallest unit a Solana balance can move by.
//
// How a staked 1v1 works:
//  - Both players deposit the same stake S into a match escrow. Pot = 2S.
//  - Each player's live "share" of the pot starts at S.
//  - Every landed hit moves a tiny amount from the victim's share to the attacker's share, sized by how
//    strong the attacker is (see hitFee): about 0.0000003 SOL for a Lv1 jab, up to 0.00001 SOL for a
//    high-level Ultimate. Stronger, more developed Monstars take more per hit.
//  - A KO moves the loser's remaining share to the winner, so the winner takes the whole pot.
//  - Settlement is ONE on-chain transaction from the escrow; it pays the network fee from the pot,
//    a 1-lamport company fee, and the rest to the players by their final shares.

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export const STAKE_POLICY = Object.freeze({
  minStake: 1_000_000n,          // 0.001 SOL. Must be above the rent-exempt minimum for the escrow account (~890,880 lamports).
  maxStake: 1_000_000_000n,      // 1 SOL cap while on devnet.
  companyFeeLamports: 1n,        // Smallest possible company fee: 1 lamport per match.
  companyFeeBps: 0,              // Optional percentage fee, off by default.
  networkFeeLamports: 5_000n,    // Base fee for the one-signature settlement transaction.
  minHitFee: 1n,                 // Every landed hit transfers at least 1 lamport.
});

export function toLamports(sol) {
  const [w, f = ''] = String(sol).trim().split('.');
  if (!/^\d+$/.test(w || '0') || !/^\d*$/.test(f) || f.length > 9) throw Error('Invalid SOL amount');
  return BigInt(w || '0') * LAMPORTS_PER_SOL + BigInt((f + '000000000').slice(0, 9));
}
export function formatSol(lamports, digits = 9) {
  const v = BigInt(lamports), neg = v < 0n, a = neg ? -v : v;
  const s = (a / LAMPORTS_PER_SOL).toString() + '.' + (a % LAMPORTS_PER_SOL).toString().padStart(9, '0').slice(0, digits);
  return (neg ? '-' : '') + s;
}

export function validateStake(stake, policy = STAKE_POLICY) {
  if (typeof stake !== 'bigint') throw Error('Stake must be a BigInt lamport amount');
  if (stake === 0n) return 0n; // free match, no escrow
  if (stake < policy.minStake) throw Error(`Minimum stake is ${formatSol(policy.minStake)} SOL`);
  if (stake > policy.maxStake) throw Error(`Maximum stake is ${formatSol(policy.maxStake)} SOL`);
  return stake;
}

/**
 * SOL moved by one hit, in lamports. It grows with the attacker's level (1-80+), its attack stat for that
 * move, and how heavy the move is (basic, special, Ultimate, crit). Damage over time moves half as much.
 * Range: 100 lamports (0.0000001 SOL) to 10,000 lamports (0.00001 SOL).
 */
export const HIT_FEE = Object.freeze({ base: 400, perLevel: 60, min: 100, max: 10_000 });
export function hitFee({ level = 1, attack = 80, power = 9, crit = false, dot = false } = {}) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lv = HIT_FEE.base + HIT_FEE.perLevel * (Math.max(1, level) - 1);
  const attr = clamp(Math.sqrt(Math.max(1, attack) / 80), 0.7, 1.4);
  const pw = clamp(power / 12, 0.5, 2.2) * (crit ? 1.5 : 1) * (dot ? 0.5 : 1);
  return BigInt(clamp(Math.round(lv * attr * pw), HIT_FEE.min, HIT_FEE.max));
}

/** Live pot ledger for one match. Shares always sum to the pot. */
export class StakeLedger {
  constructor(stake, policy = STAKE_POLICY) {
    this.stake = validateStake(stake, policy);
    this.policy = policy;
    this.pot = this.stake * 2n;
    this.shares = [this.stake, this.stake];
    this.hits = [0, 0];
    this.events = [];
  }
  /** Attacker index lands `damage` on victim with `victimMaxHp`. Returns lamports moved. */
  /** Pass the hit event from the simulation; the amount comes from hitFee (or an explicit `fee`). */
  hit(attacker, damage, victimMaxHp, ev = null) {
    if (attacker !== 0 && attacker !== 1) throw Error('Bad attacker');
    const victim = 1 - attacker;
    this.hits[attacker]++;
    if (this.stake === 0n || damage <= 0) return 0n;
    let fee = ev ? hitFee({ level: ev.lvl, attack: ev.atk, power: ev.pw, crit: ev.crit, dot: ev.kind === 'status' })
      : this.stake * BigInt(Math.round(damage * 1000)) / (BigInt(Math.round(victimMaxHp)) * 1000n);
    if (fee < this.policy.minHitFee) fee = this.policy.minHitFee;
    if (fee > this.shares[victim]) fee = this.shares[victim];
    this.shares[victim] -= fee;
    this.shares[attacker] += fee;
    this.events.push({ attacker, damage, fee });
    return fee;
  }
  /** Winner takes everything that is left. winner = 0, 1 or null for a draw. */
  finish(winner) {
    if (winner === 0 || winner === 1) {
      const rest = this.shares[1 - winner];
      this.shares[winner] += rest;
      this.shares[1 - winner] = 0n;
    }
    return this.shares.slice();
  }
  check() { if (this.shares[0] + this.shares[1] !== this.pot) throw Error('Pot not conserved'); return true; }
}

/**
 * Split an escrow balance at settlement. Every lamport is accounted for and the escrow drains to 0,
 * which avoids the rent-exempt rule (an account must end at 0 or above the rent minimum).
 * Returns per-player payouts plus company and network fees.
 */
export function settlementSplit({ escrowBalance, shares, winner, policy = STAKE_POLICY }) {
  const balance = BigInt(escrowBalance), total = shares[0] + shares[1];
  if (total <= 0n) throw Error('Empty pot');
  const network = policy.networkFeeLamports;
  let company = policy.companyFeeLamports + balance * BigInt(policy.companyFeeBps) / 10_000n;
  const distributable = balance - network - company;
  if (distributable <= 0n) throw Error('Escrow balance too small to settle');
  const payouts = shares.map(s => distributable * s / total);
  const rest = distributable - payouts[0] - payouts[1];
  payouts[winner === 1 ? 1 : 0] += rest; // rounding dust goes to the winner (player 0 on a draw)
  if (payouts[0] + payouts[1] + company + network !== balance) throw Error('Settlement not conserved');
  return { payouts, company, network, distributable };
}
