// Billing: $10/month Crypto Tab Pro.
//  - Card: Stripe Checkout subscription (STRIPE_SECRET_KEY; optional STRIPE_WEBHOOK_SECRET).
//    Confirmed on return from Checkout, refreshed every 6 h, and by webhook when configured.
//  - Crypto: ZEC, BTC, SOL, XRP straight to the owner's own addresses (CT_PAY_ZEC, CT_PAY_BTC,
//    CT_PAY_SOL, CT_PAY_XRP or Settings → Owner). Each invoice has a unique exact amount (XRP: a
//    unique destination tag) and is confirmed on-chain by public explorers. 30 days per month paid.
import crypto from 'node:crypto';
import * as A from './accounts.mjs';
import * as X from './exchanges.mjs';
import { load, save } from './store.mjs';

const invoices = load('invoices', []);
const payCfg = load('paycfg', {});
const persist = () => save('invoices', invoices);
const UA = { 'user-agent': 'CryptoTab/1.0 (payments)' };
export const COINS = { ZEC: { decimals: 8, name: 'Zcash' }, BTC: { decimals: 8, name: 'Bitcoin' }, SOL: { decimals: 9, name: 'Solana' }, XRP: { decimals: 6, name: 'XRP' } };

export const addressOf = (coin) => process.env[`CT_PAY_${coin}`] || payCfg[coin] || null;
export function setAddresses(map) {
  for (const c of Object.keys(COINS)) if (map[c] !== undefined) payCfg[c] = String(map[c] || '').trim() || undefined;
  save('paycfg', payCfg);
  return config();
}
export function config() {
  return {
    price: A.PRICE_USD,
    card: !!process.env.STRIPE_SECRET_KEY,
    coins: Object.entries(COINS).map(([c, m]) => ({ coin: c, name: m.name, enabled: !!addressOf(c), address: addressOf(c), fromEnv: !!process.env[`CT_PAY_${c}`] })),
  };
}

// ---------------- Stripe ----------------
async function stripe(method, path, form) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw X.httpError(400, 'Card payments are not set up yet (STRIPE_SECRET_KEY).');
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form ? new URLSearchParams(form).toString() : undefined, signal: AbortSignal.timeout(20000) });
  const j = await r.json();
  if (!r.ok) throw X.httpError(400, j.error?.message || 'Stripe error');
  return j;
}

export async function cardCheckout(user, origin) {
  if (user.role === 'owner') throw X.httpError(400, 'The owner already has full access.');
  const form = {
    mode: 'subscription', client_reference_id: user.id, 'metadata[uid]': user.id, 'subscription_data[metadata][uid]': user.id,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(A.PRICE_USD * 100)),
    'line_items[0][price_data][recurring][interval]': 'month', 'line_items[0][price_data][product_data][name]': 'Crypto Tab Pro',
    'line_items[0][price_data][product_data][description]': 'All trading bots, live bot trading, AI tuning',
    success_url: `${origin}/?view=bots&paid={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?view=bots&paycancel=1`, allow_promotion_codes: 'true',
  };
  const u = A.get(user.id);
  if (u?.stripe?.customer) form.customer = u.stripe.customer; else form.customer_email = user.email;
  const s = await stripe('POST', 'checkout/sessions', form);
  return { url: s.url };
}

const periodEnd = (sub) => (sub.current_period_end || sub.items?.data?.[0]?.current_period_end || 0) * 1000;

async function applySubscription(uid, sub, sessionId) {
  const end = periodEnd(sub);
  A.setStripe(uid, { customer: sub.customer, subscription: sub.id, status: sub.status, cancelAt: sub.cancel_at_period_end ? end : null });
  if (['active', 'trialing', 'past_due'].includes(sub.status) && end) A.setProUntil(uid, end + 864e5); // 1 day grace
  if (sessionId) {
    const u = A.get(uid);
    if (!(u.payments || []).some((p) => p.ref === sessionId)) { u.payments = [...(u.payments || []), { method: 'card', usd: A.PRICE_USD, ref: sessionId, at: Date.now(), days: 30 }]; A.setStripe(uid, {}); }
  }
}

export async function cardConfirm(user, sessionId) {
  const s = await stripe('GET', `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
  if ((s.client_reference_id || s.metadata?.uid) !== user.id) throw X.httpError(403, 'This payment belongs to another account');
  if (s.status !== 'complete' || !s.subscription) return { ok: false, status: s.status };
  await applySubscription(user.id, s.subscription, s.id);
  return { ok: true, user: A.view(A.get(user.id)) };
}

export async function cardCancel(user) {
  const u = A.get(user.id);
  if (!u?.stripe?.subscription) throw X.httpError(400, 'No card subscription');
  const sub = await stripe('POST', `subscriptions/${u.stripe.subscription}`, { cancel_at_period_end: 'true' });
  await applySubscription(u.id, sub);
  return A.view(A.get(u.id));
}

async function refreshCards() {
  if (!process.env.STRIPE_SECRET_KEY) return;
  for (const u of A.all()) {
    if (!u.stripe?.subscription) continue;
    try { await applySubscription(u.id, await stripe('GET', `subscriptions/${u.stripe.subscription}`)); } catch { /* try later */ }
  }
}

// Webhook (optional): verify the Stripe-Signature header, then refresh that subscription.
export async function webhook(raw, sig) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw X.httpError(400, 'Webhook not configured');
  const parts = Object.fromEntries(String(sig || '').split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  if (!parts.v1 || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1)) || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) throw X.httpError(400, 'Bad signature');
  const ev = JSON.parse(raw);
  const obj = ev.data?.object || {};
  const subId = obj.object === 'subscription' ? obj.id : obj.subscription;
  const uid = obj.metadata?.uid || obj.subscription_details?.metadata?.uid || A.all().find((u) => u.stripe?.subscription === subId || u.stripe?.customer === obj.customer)?.id;
  if (subId && uid) await applySubscription(uid, await stripe('GET', `subscriptions/${subId}`), ev.type === 'checkout.session.completed' ? obj.id : undefined);
  return { received: true };
}

// ---------------- crypto ----------------
async function usdPrice(coin) {
  for (const [ex, sym] of [['kraken', `${coin}/USD`], ['mexc', `${coin}/USDT`], ['coinbase', `${coin}/USD`]]) {
    try { const t = await X.ticker(ex, sym); if (t.p > 0) return t.p; } catch { /* next source */ }
  }
  throw X.httpError(502, `No price for ${coin} right now`);
}

export async function createInvoice(user, coin, months = 1) {
  coin = String(coin).toUpperCase(); months = [1, 3, 12].includes(Number(months)) ? Number(months) : 1;
  if (!COINS[coin]) throw X.httpError(400, 'Unsupported coin');
  const address = addressOf(coin);
  if (!address) throw X.httpError(400, `${COINS[coin].name} payments are not set up yet.`);
  if (user.role === 'owner') throw X.httpError(400, 'The owner already has full access.');
  const usd = A.PRICE_USD * months;
  const price = await usdPrice(coin);
  const d = COINS[coin].decimals;
  const base = BigInt(Math.ceil((usd / price) * 10 ** d));
  let amountBase, tag = null;
  // unique fingerprint so each payment can be matched to its invoice (worth a fraction of a cent)
  if (coin === 'XRP') { amountBase = ((base + 999n) / 1000n) * 1000n; tag = 100000 + crypto.randomInt(899999999); }
  else { const step = coin === 'SOL' ? 10000n : 100n; amountBase = (base / step) * step + BigInt(1 + crypto.randomInt(Number(step) - 1)); }
  const amount = (Number(amountBase) / 10 ** d).toFixed(d);
  const inv = { id: crypto.randomUUID().slice(0, 10), uid: user.id, email: user.email, coin, address, amount, amountBase: amountBase.toString(), tag, usd, price, months, created: Date.now(), expires: Date.now() + 60 * 60e3, status: 'pending' };
  invoices.unshift(inv); persist();
  return publicInvoice(inv);
}

const uri = (inv) => ({ BTC: `bitcoin:${inv.address}?amount=${inv.amount}`, ZEC: `zcash:${inv.address}?amount=${inv.amount}`, SOL: `solana:${inv.address}?amount=${inv.amount}`, XRP: `xrpl:${inv.address}?amount=${inv.amount}&dt=${inv.tag}` }[inv.coin]);
const publicInvoice = (inv) => ({ id: inv.id, coin: inv.coin, address: inv.address, amount: inv.amount, tag: inv.tag, usd: inv.usd, months: inv.months, price: inv.price, created: inv.created, expires: inv.expires, status: inv.status, tx: inv.tx || null, uri: uri(inv) });
export function invoiceFor(user, id) { const inv = invoices.find((i) => i.id === id && (i.uid === user.id || user.role === 'owner')); if (!inv) throw X.httpError(404, 'Invoice not found'); return publicInvoice(inv); }
export const adminInvoices = () => invoices.slice(0, 100).map((i) => ({ ...publicInvoice(i), email: i.email }));

// --- on-chain lookups: each returns [{ tx, base (BigInt), time, confirmed, tag }] paid to the address ---
async function j(url, opt) { const r = await fetch(url, { headers: { ...UA, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000), ...opt }); if (!r.ok) throw new Error(`${url.split('/')[2]} ${r.status}`); return r.json(); }

const CHAINS = {
  async BTC(addr) {
    const txs = await j(`https://mempool.space/api/address/${addr}/txs`);
    return txs.map((t) => ({ tx: t.txid, base: t.vout.filter((o) => o.scriptpubkey_address === addr).reduce((s, o) => s + BigInt(o.value), 0n), time: (t.status.block_time || Date.now() / 1000) * 1000, confirmed: !!t.status.confirmed })).filter((x) => x.base > 0n);
  },
  async ZEC(addr) {
    try {
      const r = await j(`https://sandbox-api.3xpl.com/zcash/address/${addr}?data=events&from=all&limit=50`);
      return (r.data?.events?.['zcash-main'] || []).filter((e) => !e.failed && String(e.effect).startsWith('+')).map((e) => ({ tx: e.transaction, base: BigInt(String(e.effect).slice(1)), time: Date.parse(e.time), confirmed: e.block != null }));
    } catch {
      const r = await j(`https://api.blockchair.com/zcash/outputs?q=recipient(${addr})&limit=50`);
      return (r.data || []).map((o) => ({ tx: o.transaction_hash, base: BigInt(o.value), time: Date.parse(`${o.time}Z`), confirmed: o.block_id > 0 }));
    }
  },
  async SOL(addr) {
    const rpc = (method, params) => j('https://api.mainnet-beta.solana.com', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const sigs = (await rpc('getSignaturesForAddress', [addr, { limit: 25 }])).result || [];
    const out = [];
    for (const s of sigs.filter((x) => !x.err).slice(0, 15)) {
      const t = (await rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }])).result;
      if (!t) continue;
      const i = t.transaction.message.accountKeys.findIndex((k) => (k.pubkey || k) === addr);
      if (i < 0) continue;
      const diff = BigInt(t.meta.postBalances[i]) - BigInt(t.meta.preBalances[i]);
      if (diff > 0n) out.push({ tx: s.signature, base: diff, time: (t.blockTime || 0) * 1000, confirmed: true });
    }
    return out;
  },
  async XRP(addr) {
    const r = await j('https://xrplcluster.com', { method: 'POST', body: JSON.stringify({ method: 'account_tx', params: [{ account: addr, limit: 50 }] }) });
    return (r.result?.transactions || []).filter((x) => x.tx?.TransactionType === 'Payment' && x.tx.Destination === addr && x.validated && typeof x.meta?.delivered_amount === 'string')
      .map((x) => ({ tx: x.tx.hash, base: BigInt(x.meta.delivered_amount), time: (x.tx.date + 946684800) * 1000, confirmed: true, tag: x.tx.DestinationTag }));
  },
};

const used = () => new Set(invoices.filter((i) => i.tx).map((i) => i.tx));

export async function checkInvoices() {
  const open = invoices.filter((i) => (i.status === 'pending' || i.status === 'seen') && Date.now() < i.expires + 6 * 3600e3);
  for (const i of invoices) if (i.status === 'pending' && Date.now() > i.expires + 6 * 3600e3) i.status = 'expired';
  const byCoin = {};
  for (const inv of open) (byCoin[inv.coin] ||= []).push(inv);
  for (const [coin, list] of Object.entries(byCoin)) {
    const addrs = [...new Set(list.map((i) => i.address))];
    for (const addr of addrs) {
      let txs;
      try { txs = await CHAINS[coin](addr); } catch { continue; }
      const taken = used();
      for (const inv of list.filter((i) => i.address === addr)) {
        const want = BigInt(inv.amountBase);
        const cands = txs.filter((t) => !taken.has(t.tx) && t.time >= inv.created - 10 * 60e3);
        let hit = coin === 'XRP'
          ? cands.find((t) => t.tag === inv.tag && t.base * 100n >= want * 98n)
          : cands.find((t) => t.base === want);
        // wallets sometimes round the last digits: accept a near-exact amount if it is the only open invoice for this coin
        if (!hit && coin !== 'XRP' && list.filter((x) => x.address === addr).length === 1) hit = cands.find((t) => t.base * 1000n >= want * 995n && t.base * 100n <= want * 110n);
        if (!hit) continue;
        if (!hit.confirmed) { inv.status = 'seen'; inv.tx = hit.tx; continue; }
        inv.status = 'paid'; inv.tx = hit.tx; inv.paidAt = Date.now(); taken.add(hit.tx);
        A.addPro(inv.uid, 30 * inv.months, { method: coin, usd: inv.usd, amount: inv.amount, ref: hit.tx });
      }
    }
  }
  persist();
}

export function start() {
  setInterval(() => checkInvoices().catch(() => {}), 45e3);
  setInterval(() => refreshCards().catch(() => {}), 6 * 3600e3);
  refreshCards().catch(() => {});
}
