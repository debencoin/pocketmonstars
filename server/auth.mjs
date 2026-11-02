// Phantom sign-in: the wallet signs a one-time message (no transaction, no fee); the server checks the Ed25519 signature.
import { randomBytes, createPublicKey, verify, createHmac, timingSafeEqual } from 'node:crypto';
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
  // Session tokens are signed with `secret` (HMAC), so they stay valid across server restarts and redeploys.
  constructor({ challengeTtlMs = 5 * 60 * 1000, sessionTtlMs = 12 * 60 * 60 * 1000, domain = 'PocketMonstars', secret = randomBytes(32).toString('hex') } = {}) {
    this.challenges = new Map(); this.sessions = new Map();
    Object.assign(this, { challengeTtlMs, sessionTtlMs, domain, secret });
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
    const exp = now + this.sessionTtlMs, body = `${wallet}.${exp}`;
    const token = body + '.' + createHmac('sha256', this.secret).update(body).digest('base64url');
    return { token, wallet };
  }
  wallet(token, now = Date.now()) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const [w, exp, mac] = parts, good = createHmac('sha256', this.secret).update(`${w}.${exp}`).digest('base64url');
    if (mac.length !== good.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
    if (!(Number(exp) > now)) return null;
    return w;
  }
}
