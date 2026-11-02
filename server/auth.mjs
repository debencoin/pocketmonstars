// Phantom sign-in: the wallet signs a one-time message (no transaction, no fee); the server checks the Ed25519 signature.
import { randomBytes, createPublicKey, verify } from 'node:crypto';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function verifyWalletSignature(wallet, message, signatureB58) {
  const raw = new PublicKey(wallet).toBytes();
  const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(raw)]), format: 'der', type: 'spki' });
  const sig = Buffer.from(bs58.decode(signatureB58));
  if (sig.length !== 64) return false;
  return verify(null, Buffer.from(message, 'utf8'), key, sig);
}

export class Auth {
  constructor({ challengeTtlMs = 5 * 60 * 1000, sessionTtlMs = 12 * 60 * 60 * 1000, domain = 'PocketMonstars' } = {}) {
    this.challenges = new Map(); this.sessions = new Map();
    Object.assign(this, { challengeTtlMs, sessionTtlMs, domain });
  }
  challenge(wallet, now = Date.now()) {
    wallet = new PublicKey(wallet).toBase58();
    const nonce = randomBytes(16).toString('hex');
    const message = `${this.domain} sign-in\n\nSign this message to prove you own this wallet. It does not move funds or cost a fee.\n\nWallet: ${wallet}\nNonce: ${nonce}\nIssued: ${new Date(now).toISOString()}`;
    this.challenges.set(wallet, { message, expires: now + this.challengeTtlMs });
    return message;
  }
  verify(wallet, signatureB58, now = Date.now()) {
    wallet = new PublicKey(wallet).toBase58();
    const c = this.challenges.get(wallet);
    if (!c || c.expires < now) throw Error('Sign-in request expired. Try again.');
    if (!verifyWalletSignature(wallet, c.message, signatureB58)) throw Error('Signature does not match this wallet.');
    this.challenges.delete(wallet); // one use only
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(token, { wallet, expires: now + this.sessionTtlMs });
    return { token, wallet };
  }
  wallet(token, now = Date.now()) {
    const s = token && this.sessions.get(token);
    if (!s || s.expires < now) return null;
    return s.wallet;
  }
}
