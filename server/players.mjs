// Username/password accounts, referrals (5% of a referred player's winnings) and the Superhero Drop sales book.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';

const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const REFERRAL_BPS = 500; // 5%

export class Players {
  constructor(db) {
    this.db = db; this.fails = new Map();
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts(name TEXT PRIMARY KEY, display TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS referrals(user TEXT PRIMARY KEY, referrer TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS referral_payouts(match_id TEXT NOT NULL, referrer TEXT NOT NULL, user TEXT NOT NULL, lamports TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(match_id, referrer));
      CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, avatar TEXT, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS avatar_sales(avatar TEXT PRIMARY KEY, buyer TEXT NOT NULL, signature TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS catch_credits(user TEXT PRIMARY KEY, credits INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS payout_accounts(user TEXT PRIMARY KEY, account TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usd_listings(serial INTEGER PRIMARY KEY, seller TEXT NOT NULL, cents INTEGER NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS card_orders(session TEXT PRIMARY KEY, kind TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS drop_sales(species INTEGER PRIMARY KEY, buyer TEXT NOT NULL, signature TEXT NOT NULL UNIQUE, serial INTEGER, created_at INTEGER NOT NULL);
    `);
  }

  // ---------- accounts ----------
  register(username, password, now = Date.now()) {
    const name = String(username || '').trim();
    if (!NAME_RE.test(name)) throw Error('Pick a username of 3-20 letters, numbers or _.');
    if (typeof password !== 'string' || password.length < 8) throw Error('Use a password of at least 8 characters.');
    if (password.length > 200) throw Error('That password is too long.');
    const key = name.toLowerCase();
    if (this.db.prepare('SELECT 1 FROM accounts WHERE name=?').get(key)) throw Error('That username is taken.');
    const salt = randomBytes(16).toString('hex'), hash = scryptSync(password, salt, 32).toString('hex');
    this.db.prepare('INSERT INTO accounts(name,display,salt,hash,created_at) VALUES(?,?,?,?,?)').run(key, name, salt, hash, now);
    return '@' + key;
  }
  login(username, password, now = Date.now()) {
    const key = String(username || '').trim().toLowerCase(), f = this.fails.get(key);
    if (f && f.n >= 6 && now - f.at < 10 * 60_000) throw Error('Too many tries. Wait 10 minutes and try again.');
    const row = this.db.prepare('SELECT * FROM accounts WHERE name=?').get(key);
    const ok = row && typeof password === 'string' && timingSafeEqual(scryptSync(password, row.salt, 32), Buffer.from(row.hash, 'hex'));
    if (!ok) { this.fails.set(key, { n: (f && now - f.at < 10 * 60_000 ? f.n : 0) + 1, at: now }); throw Error('Wrong username or password.'); }
    this.fails.delete(key); return '@' + key;
  }
  exists(id) { return id?.startsWith('@') ? !!this.db.prepare('SELECT 1 FROM accounts WHERE name=?').get(id.slice(1)) : (() => { try { new PublicKey(id); return true; } catch { return false; } })(); }

  // ---------- referrals ----------
  /** Remember who referred a player (first referrer only, never yourself). */
  setReferrer(user, ref, now = Date.now()) {
    ref = String(ref || '').trim(); if (!ref || ref === user || !this.exists(ref)) return false;
    if (ref.startsWith('@')) ref = ref.toLowerCase();
    if (this.db.prepare('SELECT 1 FROM referrals WHERE user=?').get(user)) return false;
    if (this.referrerOf(ref) === user) return false; // no referral loops
    this.db.prepare('INSERT INTO referrals(user,referrer,created_at) VALUES(?,?,?)').run(user, ref, now); return true;
  }
  referrerOf(user) { return this.db.prepare('SELECT referrer FROM referrals WHERE user=?').get(user)?.referrer || null; }
  /** 5% of what a referred player won (their payout minus their own stake). */
  static cutOf(profit) { return profit > 0n ? (profit * BigInt(REFERRAL_BPS)) / 10_000n : 0n; }
  recordPayout(matchId, referrer, user, lamports, now = Date.now()) {
    this.db.prepare('INSERT OR IGNORE INTO referral_payouts(match_id,referrer,user,lamports,created_at) VALUES(?,?,?,?,?)').run(matchId, referrer, user, String(lamports), now);
  }
  referralStats(id) {
    const n = this.db.prepare('SELECT COUNT(*) n FROM referrals WHERE referrer=?').get(id).n;
    const rows = this.db.prepare('SELECT lamports FROM referral_payouts WHERE referrer=?').all(id);
    return { referred: n, payouts: rows.length, earnedLamports: rows.reduce((t, r) => t + BigInt(r.lamports), 0n).toString(), referrer: this.referrerOf(id) };
  }

  // ---------- profile avatars ----------
  avatarChoice(id) { return this.db.prepare('SELECT avatar FROM profiles WHERE id=?').get(id)?.avatar || null; }
  setAvatarChoice(id, avatar, now = Date.now()) { this.db.prepare('INSERT INTO profiles(id,avatar,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET avatar=excluded.avatar, updated_at=excluded.updated_at').run(id, avatar, now); }
  avatarSale(avatar) { return this.db.prepare('SELECT * FROM avatar_sales WHERE avatar=?').get(avatar) || null; }
  recordAvatarSale(avatar, buyer, signature, now = Date.now()) {
    if (this.db.prepare('SELECT 1 FROM avatar_sales WHERE signature=?').get(signature)) throw Error('That payment was already used.');
    this.db.prepare('INSERT INTO avatar_sales(avatar,buyer,signature,created_at) VALUES(?,?,?,?)').run(avatar, buyer, signature, now);
  }

  // ---------- card payments (Stripe) ----------
  payoutAccount(user) { return this.db.prepare('SELECT account FROM payout_accounts WHERE user=?').get(user)?.account || null; }
  setPayoutAccount(user, account) { this.db.prepare('INSERT OR REPLACE INTO payout_accounts(user,account) VALUES(?,?)').run(user, account); }
  usdListing(serial) { return this.db.prepare('SELECT * FROM usd_listings WHERE serial=?').get(serial) || null; }
  usdListings() { return this.db.prepare('SELECT * FROM usd_listings ORDER BY created_at DESC').all(); }
  listUsd(serial, seller, cents, now = Date.now()) { this.db.prepare('INSERT OR REPLACE INTO usd_listings(serial,seller,cents,created_at) VALUES(?,?,?,?)').run(serial, seller, cents, now); }
  unlistUsd(serial) { this.db.prepare('DELETE FROM usd_listings WHERE serial=?').run(serial); }
  cardOrder(session) { return this.db.prepare('SELECT * FROM card_orders WHERE session=?').get(session) || null; }
  recordCardOrder(session, kind, result, now = Date.now()) { this.db.prepare('INSERT OR IGNORE INTO card_orders(session,kind,result,created_at) VALUES(?,?,?,?)').run(session, kind, JSON.stringify(result), now); }

  // ---------- catch passes (free accounts: 2 free catches, then one pass per catch, bought with a card) ----------
  catchCredits(user) { return this.db.prepare('SELECT credits FROM catch_credits WHERE user=?').get(user)?.credits || 0; }
  addCatchCredits(user, n) { this.db.prepare('INSERT INTO catch_credits(user,credits) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET credits=credits+excluded.credits').run(user, n); }
  useCatchCredit(user) { return this.db.prepare('UPDATE catch_credits SET credits=credits-1 WHERE user=? AND credits>0').run(user).changes > 0; }

  // ---------- Superhero Drop ----------
  sale(species) { return this.db.prepare('SELECT * FROM drop_sales WHERE species=?').get(species) || null; }
  sales() { return this.db.prepare('SELECT * FROM drop_sales').all(); }
  recordSale(species, buyer, signature, serial, now = Date.now()) {
    if (this.db.prepare('SELECT 1 FROM drop_sales WHERE signature=?').get(signature)) throw Error('That payment was already used.');
    this.db.prepare('INSERT INTO drop_sales(species,buyer,signature,serial,created_at) VALUES(?,?,?,?,?)').run(species, buyer, signature, serial, now);
  }
}
