// Card payments (Stripe) for Monstars sold in the store, and dollar resale between players.
//
// Off until STRIPE_SECRET_KEY is set on the server (Render → Environment). Nothing secret lives in the repo or the browser.
//  - Store purchases (Superhero Drop heroes, Sky Benders, COVA): Stripe Checkout, same price as in SOL, converted to US
//    dollars at the live SOL price (PM_SOL_USD fixes the rate instead). Works for username accounts and Phantom wallets.
//  - Dollar resale: a seller connects a Stripe Express payout account, lists an unminted Monstar for a dollar price; the buyer
//    pays with a card; the server moves the Monstar and pays the seller 90%, the Monstar's creator 5% (if they have a payout
//    account) and keeps 5% for PocketMonstars (it also covers Stripe's card fees).
//  - Every paid Checkout Session carries its order in metadata, so after a server reset (the free plan loses its database)
//    the sales and resales are rebuilt from Stripe, like SOL purchases are rebuilt from the chain.
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.stripe.com/v1';
export const RESALE_COMPANY_BPS = 500, RESALE_CREATOR_BPS = 500;

/** Stripe's form encoding: nested objects become key[sub]=value. */
export function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) form(v, key, out);
    else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'object' ? form(x, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else out.append(key, String(v));
  }
  return out;
}

/** Checks the Stripe-Signature header (HMAC-SHA256 of "t.body") within a 5 minute window. */
export function verifyWebhook(raw, header, secret, now = Date.now()) {
  if (!secret) throw Error('Webhook secret not set.');
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = String(header || '').split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t); if (!t || !sigs.length) throw Error('Bad signature header.');
  if (Math.abs(now / 1000 - t) > 300) throw Error('Webhook too old.');
  const want = createHmac('sha256', secret).update(`${t}.${raw}`).digest();
  if (!sigs.some(s => { try { const b = Buffer.from(s, 'hex'); return b.length === want.length && timingSafeEqual(b, want); } catch { return false; } })) throw Error('Bad webhook signature.');
  return JSON.parse(raw);
}

export class StripePay {
  constructor({ secretKey = null, webhookSecret = null, fixedSolUsd = null, publicUrl = '', fetchImpl = globalThis.fetch } = {}) {
    this.key = secretKey; this.webhookSecret = webhookSecret; this.fixed = fixedSolUsd ? Number(fixedSolUsd) : null;
    this.publicUrl = publicUrl.replace(/\/$/, ''); this.fetch = fetchImpl; this.rate = null;
  }
  get enabled() { return !!this.key; }
  async call(method, path, params = null) {
    if (!this.key) throw Error('Card payments are not switched on yet.');
    const q = params ? form(params).toString() : '';
    const r = await this.fetch(API + path + (method === 'GET' && q ? '?' + q : ''), { method, headers: { Authorization: 'Bearer ' + this.key, ...(method !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: method !== 'GET' && q ? q : undefined });
    const j = await r.json(); if (!r.ok) throw Error(j?.error?.message || 'Stripe error ' + r.status); return j;
  }
  /** US dollars per SOL (cached 5 minutes). */
  async solUsd() {
    if (this.fixed) return this.fixed;
    if (this.rate && Date.now() - this.rate.at < 300_000) return this.rate.v;
    try { const r = await this.fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'); const v = (await r.json())?.solana?.usd;
      if (v > 0) { this.rate = { v, at: Date.now() }; return v; } } catch {}
    if (this.rate) return this.rate.v; throw Error('Could not get the SOL price right now. Try again in a minute.');
  }
  /** Same price as in SOL, in US cents (at least 50 cents, Stripe's minimum). */
  async centsFor(lamports) { return Math.max(50, Math.round(Number(BigInt(lamports)) / 1e9 * (await this.solUsd()) * 100)); }

  checkout({ name, image, cents, metadata, ref, transferGroup }) {
    return this.call('POST', '/checkout/sessions', { mode: 'payment', client_reference_id: ref,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name, images: image ? [image] : undefined } } }],
      metadata, payment_intent_data: { metadata, transfer_group: transferGroup },
      success_url: `${this.publicUrl}/play?paid={CHECKOUT_SESSION_ID}#market`,
      cancel_url: `${this.publicUrl}/play#market` });
  }
  session(id) { return this.call('GET', '/checkout/sessions/' + encodeURIComponent(id), { expand: ['payment_intent.latest_charge'] }); }
  async paidSessions() { // every completed Checkout Session, oldest first
    const all = []; let after = null;
    for (let i = 0; i < 50; i++) { const r = await this.call('GET', '/checkout/sessions', { limit: 100, status: 'complete', starting_after: after || undefined }); all.push(...r.data); if (!r.has_more) break; after = r.data.at(-1).id; }
    return all.filter(s => s.payment_status === 'paid' && s.metadata?.pm).sort((a, b) => a.created - b.created);
  }
  refund(paymentIntent) { return this.call('POST', '/refunds', { payment_intent: paymentIntent }); }
  // ----- Connect (payouts for sellers) -----
  createAccount(user) { return this.call('POST', '/accounts', { type: 'express', capabilities: { transfers: { requested: true } }, metadata: { pm_user: user } }); }
  onboardingLink(account) { return this.call('POST', '/account_links', { account, type: 'account_onboarding', refresh_url: `${this.publicUrl}/play#market`, return_url: `${this.publicUrl}/play?payouts=done#market` }); }
  account(id) { return this.call('GET', '/accounts/' + encodeURIComponent(id)); }
  async accountsByUser() { const out = new Map(); let after = null;
    for (let i = 0; i < 50; i++) { const r = await this.call('GET', '/accounts', { limit: 100, starting_after: after || undefined }); for (const a of r.data) if (a.metadata?.pm_user && !out.has(a.metadata.pm_user)) out.set(a.metadata.pm_user, a.id); if (!r.has_more) break; after = r.data.at(-1).id; }
    return out; }
  transfer({ cents, destination, charge, group, metadata }) { return this.call('POST', '/transfers', { amount: cents, currency: 'usd', destination, source_transaction: charge, transfer_group: group, metadata }); }
}

/** How a dollar resale splits: seller 90%, creator 5% (company keeps it when the creator has no payout account), company 5%. */
export function resaleSplit(cents, creatorHasAccount) {
  const company = Math.floor(cents * RESALE_COMPANY_BPS / 10_000), creator = Math.floor(cents * RESALE_CREATOR_BPS / 10_000);
  return { seller: cents - company - creator, creator: creatorHasAccount ? creator : 0, company: company + (creatorHasAccount ? 0 : creator) };
}
