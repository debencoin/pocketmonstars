// Match escrow on Solana. Each staked match gets its own escrow account; players deposit by a normal
// System Program transfer signed in Phantom. Settlement is a single transaction signed by the escrow key.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

export class SolanaChain {
  constructor(rpc) { this.conn = new Connection(rpc, 'confirmed'); }

  /** Confirm that `signature` is a successful transfer of exactly `lamports` from `from` to `to`. */
  async verifyDeposit(signature, { from, to, lamports }) {
    const tx = await this.conn.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) throw Error('Deposit not found yet. Wait a few seconds and try again.');
    if (tx.meta?.err) throw Error('Deposit transaction failed on-chain.');
    const ok = tx.transaction.message.instructions.some(ix => ix.program === 'system' && ix.parsed?.type === 'transfer'
      && ix.parsed.info.source === from && ix.parsed.info.destination === to && BigInt(ix.parsed.info.lamports) === BigInt(lamports));
    if (!ok) throw Error('Deposit must be one transfer of the exact stake from your wallet to this match escrow.');
    return true;
  }
  /** A transfer of exactly `lamports` from `from` to `to` that also carries `memo` (used for drop purchases). */
  async verifyPayment(signature, { from, to, lamports, memo }) {
    const tx = await this.conn.getParsedTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) throw Error('Payment not found yet. Wait a few seconds and try again.');
    return checkPayment(tx, { from, to, lamports, memo });
  }
  /** Drop purchases found on-chain (memo PMDROP:<species>), oldest first, so sales survive a server reset. */
  async memoPayments(to, prefix, limit = 1000) {
    const sigs = await this.conn.getSignaturesForAddress(new PublicKey(to), { limit }, 'confirmed');
    const hits = sigs.filter(x => !x.err && x.memo && x.memo.includes(prefix)).reverse(), out = [];
    for (const h of hits) {
      const tx = await this.conn.getParsedTransaction(h.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 }).catch(() => null);
      if (tx) out.push({ signature: h.signature, tx });
    }
    return out;
  }
  async balance(address) { return BigInt(await this.conn.getBalance(new PublicKey(address), 'confirmed')); }
  async rentExemptMinimum(bytes = 0) { return BigInt(await this.conn.getMinimumBalanceForRentExemption(bytes)); }
  async latestBlockhash() { return this.conn.getLatestBlockhash('confirmed'); }
  async sendRaw(bytesB64) { return this.conn.sendRawTransaction(Buffer.from(bytesB64, 'base64'), { skipPreflight: false }); }
  async status(signature) { return (await this.conn.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0]; }
}

export function newEscrow() {
  const kp = Keypair.generate();
  return { address: kp.publicKey.toBase58(), secret: bs58.encode(kp.secretKey) };
}

/** Build and sign the settlement. The escrow pays the network fee itself, so the pot drains to exactly zero. */
export function buildSettlement({ escrowSecret, blockhash, transfers }) {
  const kp = Keypair.fromSecretKey(bs58.decode(escrowSecret));
  const tx = new Transaction({ feePayer: kp.publicKey, recentBlockhash: blockhash });
  for (const { to, lamports } of transfers) {
    if (BigInt(lamports) > 0n) tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports: BigInt(lamports) }));
  }
  if (!tx.instructions.length) throw Error('Nothing to settle');
  tx.sign(kp);
  return { bytes: tx.serialize().toString('base64'), signature: bs58.encode(tx.signature) };
}

/** Unsigned deposit for the player to approve in Phantom. */
export function buildDeposit({ from, escrow, lamports, blockhash }) {
  const tx = new Transaction({ feePayer: new PublicKey(from), recentBlockhash: blockhash })
    .add(SystemProgram.transfer({ fromPubkey: new PublicKey(from), toPubkey: new PublicKey(escrow), lamports: BigInt(lamports) }));
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
/** Check a parsed transaction: one transfer from -> to of `lamports` plus a memo instruction equal to `memo`. Returns the payer. */
export function checkPayment(tx, { from, to, lamports, memo }) {
  if (tx.meta?.err) throw Error('Payment transaction failed on-chain.');
  const ixs = tx.transaction.message.instructions;
  const pay = ixs.find(ix => ix.program === 'system' && ix.parsed?.type === 'transfer' && ix.parsed.info.destination === to
    && (!from || ix.parsed.info.source === from) && BigInt(ix.parsed.info.lamports) === BigInt(lamports));
  const note = ixs.find(ix => (ix.program === 'spl-memo' || ix.programId?.toBase58?.() === MEMO_PROGRAM) && (typeof ix.parsed === 'string' ? ix.parsed : '') === memo);
  if (!pay || !note) throw Error('That payment does not match this purchase.');
  return pay.parsed.info.source;
}
