// Accounts, sessions and plans.
//  - Owner: logs in with the server passcode (CT_TOKEN) and always has full access.
//  - Users: email + password (scrypt-hashed). Sessions last 30 days.
//  - Pro ($10/month): from a Stripe subscription, a crypto payment (30 days each), or free
//    ("comp") access granted by the owner or listed in CT_COMP_EMAILS (comma separated).
import crypto from 'node:crypto';
import { load, save, accessToken } from './store.mjs';
import { httpError } from './exchanges.mjs';

const users = load('users', {});        // id -> user
const sessions = load('sessions', {});  // token -> { uid, exp }
const persist = () => { save('users', users); save('sessions', sessions); };
const OWNER = { id: 'owner', email: 'owner', role: 'owner' };
const DAY = 864e5;

export const PRICE_USD = Number(process.env.CT_PRICE_USD || 10);
export const FREE_BOTS = new Set(['grid', 'dca']); // free plan: these two, paper only

const norm = (e) => String(e || '').trim().toLowerCase();
const compList = () => new Set(String(process.env.CT_COMP_EMAILS || '').split(',').map(norm).filter(Boolean));
const hash = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
const byEmail = (email) => Object.values(users).find((u) => u.email === norm(email));

function newSession(uid) {
  const token = crypto.randomBytes(24).toString('base64url');
  sessions[token] = { uid, exp: Date.now() + 30 * DAY };
  persist();
  return token;
}

export function signup({ email, password }) {
  email = norm(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'Enter a valid email');
  if (String(password || '').length < 8) throw httpError(400, 'Password must be at least 8 characters');
  const existing = byEmail(email);
  if (existing && !existing.pw) return claimInvite({ email, password }); // the owner invited this email
  if (existing) throw httpError(400, 'An account with this email already exists. Log in instead.');
  const salt = crypto.randomBytes(16).toString('hex');
  const u = { id: crypto.randomUUID().slice(0, 12), email, salt, pw: hash(password, salt), created: Date.now(), proUntil: 0, payments: [] };
  users[u.id] = u;
  const token = newSession(u.id);
  return { token, user: view(u) };
}

export function login({ email, password }) {
  const u = byEmail(email);
  if (!u || !u.pw || hash(password, u.salt) !== u.pw) throw httpError(401, 'Wrong email or password');
  return { token: newSession(u.id), user: view(u) };
}

export function logout(token) { delete sessions[token]; persist(); return { ok: true }; }

// Resolve the x-ct-token header: the owner passcode or a user session.
export function userFor(token) {
  if (!token) return null;
  if (token === accessToken()) return OWNER;
  const s = sessions[token];
  if (!s || s.exp < Date.now()) return null;
  return users[s.uid] || null;
}

export function plan(u) {
  if (!u) return { pro: false, tier: 'guest' };
  if (u.role === 'owner') return { pro: true, tier: 'owner', reason: 'Owner: full access' };
  if (u.comp || compList().has(u.email)) return { pro: true, tier: 'pro', reason: 'Free access granted by the owner' };
  if (u.proUntil > Date.now()) return { pro: true, tier: 'pro', until: u.proUntil, reason: u.stripe?.subscription ? 'Card subscription' : 'Paid with crypto', renews: !!u.stripe?.subscription && !u.stripe?.cancelAt };
  return { pro: false, tier: 'free', expired: u.proUntil ? u.proUntil : null };
}

export function view(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, role: u.role || 'user', created: u.created, plan: plan(u), payments: (u.payments || []).slice(-12).reverse() };
}

export function requirePro(u, what = 'This feature') {
  if (!plan(u).pro) throw httpError(402, `${what} is part of Crypto Tab Pro ($${PRICE_USD}/month). Open Settings → Subscription to upgrade.`);
}

// Add paid time. Stacks on top of time already paid for.
export function addPro(uid, days, payment) {
  const u = users[uid]; if (!u) throw httpError(404, 'No such user');
  u.proUntil = Math.max(u.proUntil || 0, Date.now()) + days * DAY;
  u.payments = [...(u.payments || []), { ...payment, at: Date.now(), days }];
  persist();
  return view(u);
}

export function setStripe(uid, patch) { const u = users[uid]; if (!u) return; u.stripe = { ...(u.stripe || {}), ...patch }; persist(); }
export function setProUntil(uid, until) { const u = users[uid]; if (!u) return; u.proUntil = until; persist(); }
export const get = (uid) => users[uid] || null;
export const all = () => Object.values(users);

// ---------- owner tools ----------
export function adminList() {
  return all().map((u) => ({ ...view(u), comp: !!u.comp || compList().has(u.email), invited: !!u.invited, proUntil: u.proUntil, stripe: u.stripe ? { status: u.stripe.status, cancelAt: u.stripe.cancelAt } : null }))
    .sort((a, b) => b.created - a.created);
}

export function adminComp(email, on) {
  email = norm(email);
  let u = byEmail(email);
  if (!u) { // pre-create so the person gets access as soon as they sign up with this email
    const salt = crypto.randomBytes(16).toString('hex');
    u = { id: crypto.randomUUID().slice(0, 12), email, salt, pw: null, created: Date.now(), proUntil: 0, payments: [], invited: true };
    users[u.id] = u;
  }
  u.comp = !!on; persist();
  return view(u);
}

// Signing up with an email the owner already invited claims that account.
export function claimInvite({ email, password }) {
  const u = byEmail(email);
  if (!u || u.pw) return null;
  if (String(password || '').length < 8) throw httpError(400, 'Password must be at least 8 characters');
  u.pw = hash(password, u.salt); delete u.invited; persist();
  return { token: newSession(u.id), user: view(u) };
}

export function adminResetPassword(email, password) {
  const u = byEmail(email); if (!u) throw httpError(404, 'No such user');
  if (String(password || '').length < 8) throw httpError(400, 'Password must be at least 8 characters');
  u.pw = hash(password, u.salt); persist();
  for (const [t, s] of Object.entries(sessions)) if (s.uid === u.id) delete sessions[t];
  persist();
  return { ok: true };
}

export function stats() {
  const list = all();
  const pays = list.flatMap((u) => (u.payments || []).map((p) => ({ ...p, email: u.email })));
  return { users: list.length, pro: list.filter((u) => plan(u).pro).length, revenueUsd: +pays.reduce((s, p) => s + (p.usd || 0), 0).toFixed(2), recentPayments: pays.sort((a, b) => b.at - a.at).slice(0, 20) };
}

export { OWNER };
