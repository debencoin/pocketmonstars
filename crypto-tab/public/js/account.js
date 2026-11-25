// Accounts & Crypto Tab Pro: log in / sign up, subscription (card or crypto), owner dashboard.
import { api } from './api.js';
import { $, esc, store, sheet, toast, fmtUsd } from './ui.js';

export const me = { user: null, billing: null, freeBots: ['grid', 'dca'] };
export const isPro = () => !!me.user?.plan?.pro;
export const isOwner = () => me.user?.role === 'owner';
export const lockedBot = (type) => !isPro() && !me.freeBots.includes(type);

export async function loadMe() {
  try { Object.assign(me, await api('/api/me', { quiet: true })); } catch { me.user = null; }
  window.dispatchEvent(new CustomEvent('ct:me'));
  return me;
}

const fmtDate = (t) => new Date(t).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

export function loginSheet(app) {
  if ($('#lg-email')) return;
  sheet('Welcome to Crypto Tab', (b, close) => {
    let mode = 'login';
    const draw = () => {
      b.innerHTML = `<div class="seg" style="margin-bottom:14px">${[['login', 'Log in'], ['signup', 'Create account'], ['owner', 'Owner']].map(([k, l]) => `<button class="${k === mode ? 'active' : ''}" data-m="${k}">${l}</button>`).join('')}</div>
        ${mode === 'owner'
          ? `<p class="muted" style="margin-top:0;line-height:1.5">Server owner: enter the passcode from the server log (or <code>CT_TOKEN</code>). Full access to everything.</p>
             <input class="input" id="lg-t" type="password" placeholder="Passcode" style="margin-bottom:12px">`
          : `<input class="input" id="lg-email" type="email" autocomplete="email" placeholder="Email" style="margin-bottom:10px">
             <input class="input" id="lg-pw" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="Password${mode === 'signup' ? ' (8+ characters)' : ''}" style="margin-bottom:12px">`}
        <button class="btn primary block" id="lg-go">${mode === 'signup' ? 'Create free account' : mode === 'owner' ? 'Unlock' : 'Log in'}</button>
        <div class="dim" style="font-size:12px;margin-top:12px;line-height:1.5">Free: charts, indicators, news, herd, bubbles, pump clock, paper trading, Spot Grid & DCA bots (paper).<br><b>Pro $${me.billing?.price || 10}/month</b>: every bot (Pump Rider, Herd, News, Phoenix…), live bot trading on your exchanges, AI tuning. Pay by card or with ZEC, BTC, SOL, XRP.</div>`;
      b.querySelector('.seg').onclick = (e) => { const x = e.target.closest('[data-m]'); if (x) { mode = x.dataset.m; draw(); } };
      const go = async () => {
        try {
          let r;
          if (mode === 'owner') { r = await api('/api/login', { method: 'POST', body: { token: $('#lg-t', b).value.trim() }, quiet: true }); }
          else r = await api(`/api/auth/${mode}`, { method: 'POST', body: { email: $('#lg-email', b).value.trim(), password: $('#lg-pw', b).value }, quiet: true });
          store.set('token', r.token); close();
          toast(mode === 'signup' ? 'Account created' : 'Logged in', 'ok');
          await loadMe(); app.reconnect();
        } catch (e) { toast(e.message, 'err'); }
      };
      $('#lg-go', b).onclick = go;
      b.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    };
    draw();
  });
}

export async function logout(app) {
  await api('/api/auth/logout', { method: 'POST', body: {}, quiet: true }).catch(() => {});
  store.set('token', ''); me.user = null; toast('Logged out'); app.reconnect?.(); loginSheet(app);
}

// ---------- subscription ----------
export function upgradeSheet(app, why) {
  sheet('Crypto Tab Pro', async (b, close) => {
    await loadMe();
    let months = 1, inv = null, timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    const draw = () => {
      const u = me.user, p = u?.plan || {}, bill = me.billing || { price: 10, coins: [] };
      if (!u) { b.innerHTML = '<p class="muted">Log in first.</p><button class="btn primary block" id="up-login">Log in</button>'; $('#up-login', b).onclick = () => { close(); loginSheet(app); }; return; }
      const coins = bill.coins.filter((c) => c.enabled);
      b.innerHTML = `${why ? `<div class="card" style="margin-bottom:12px;border-color:var(--accent)"><b>🔒 ${esc(why)}</b></div>` : ''}
        <div class="card" style="margin-bottom:14px">
          <div class="row between"><span class="dim">${esc(u.email === 'owner' ? 'Owner' : u.email)}</span><b class="${p.pro ? 'up' : ''}">${p.tier === 'owner' ? 'OWNER' : p.pro ? 'PRO' : 'FREE'}</b></div>
          <div style="font-size:13px;margin-top:6px">${p.pro ? esc(p.reason || 'Pro') : 'Free plan'}${p.until ? ` · ${p.renews ? 'renews' : 'active until'} ${fmtDate(p.until)}` : ''}${p.expired ? ` · expired ${fmtDate(p.expired)}` : ''}</div>
        </div>
        ${p.tier === 'owner' || (p.pro && !p.until) ? '' : `
        <div class="label">What Pro unlocks · $${bill.price}/month</div>
        <ul style="font-size:13px;line-height:1.7;margin:6px 0 14px;padding-left:18px"><li>All 13 bots: Pump Rider Grid, Herd Follower, News Sentiment, Phoenix Reversal, Step Grid, signal bots</li><li>Live bot trading on your own exchange keys (MEXC, Kraken, Coinbase…)</li><li>AI bot tuning and AI auto-fill</li></ul>
        <div class="label">Pay by card</div>
        <div class="card" style="margin:8px 0 14px">${bill.card
          ? (p.renews ? `<div style="font-size:13px;margin-bottom:10px">Card subscription active.</div><button class="btn block" id="up-cancel">Cancel at period end</button>` : `<button class="btn primary block" id="up-card">💳 Subscribe $${bill.price}/month (debit or credit card)</button><div class="dim" style="font-size:12px;margin-top:8px">Secure checkout by Stripe. Cancel any time.</div>`)
          : '<div class="dim" style="font-size:13px">Card payments are not switched on yet.</div>'}</div>
        <div class="label">Pay with crypto</div>
        <div class="card" style="margin:8px 0 14px">
          ${coins.length ? `<div class="seg" id="up-months" style="margin-bottom:10px">${[1, 3, 12].map((m) => `<button class="${m === months ? 'active' : ''}" data-mo="${m}">${m} mo · $${bill.price * m}</button>`).join('')}</div>
          <div class="grid2">${coins.map((c) => `<button class="btn" data-coin="${c.coin}">${esc(c.coin)} · ${esc(c.name)}</button>`).join('')}</div>
          <div id="up-inv"></div>` : '<div class="dim" style="font-size:13px">Crypto payments are not switched on yet.</div>'}
        </div>`}
        ${u.payments?.length ? `<div class="label">Payments</div><div class="card" style="margin:8px 0 14px;font-size:12px">${u.payments.map((x) => `<div class="row between"><span>${fmtDate(x.at)} · ${esc(x.method)}</span><span>${x.usd ? fmtUsd(x.usd) : ''} +${x.days}d</span></div>`).join('')}</div>` : ''}
        ${isOwner() ? '<button class="btn block" id="up-admin" style="margin-bottom:10px">👑 Owner dashboard</button>' : ''}
        ${u.role !== 'owner' ? '<button class="btn block" id="up-out">Log out</button>' : ''}`;
      $('#up-admin', b)?.addEventListener('click', () => { close(); adminSheet(app); });
      $('#up-out', b)?.addEventListener('click', () => { close(); logout(app); });
      $('#up-card', b)?.addEventListener('click', async () => { try { const r = await api('/api/billing/card', { method: 'POST', body: {} }); location.href = r.url; } catch (e) { toast(e.message, 'err'); } });
      $('#up-cancel', b)?.addEventListener('click', async () => { try { await api('/api/billing/card/cancel', { method: 'POST', body: {} }); toast('Subscription will end at the period end', 'ok'); await loadMe(); draw(); } catch (e) { toast(e.message, 'err'); } });
      $('#up-months', b)?.addEventListener('click', (e) => { const x = e.target.closest('[data-mo]'); if (x) { months = Number(x.dataset.mo); draw(); } });
      b.querySelectorAll('[data-coin]').forEach((x) => (x.onclick = async () => {
        try { inv = await api('/api/billing/crypto', { method: 'POST', body: { coin: x.dataset.coin, months } }); drawInv(); stop(); timer = setInterval(poll, 15000); }
        catch (e) { toast(e.message, 'err'); }
      }));
      if (inv) drawInv();
    };
    const drawInv = () => {
      const el = $('#up-inv', b); if (!el || !inv) return;
      const left = Math.max(0, Math.round((inv.expires - Date.now()) / 60000));
      const copy = (t) => `<button class="btn sm" data-copy="${esc(t)}">Copy</button>`;
      el.innerHTML = `<div style="margin-top:12px;font-size:13px;line-height:1.6">
        <div>Send <b>exactly</b>:</div>
        <div class="row between"><b style="font-family:var(--mono);font-size:15px">${esc(inv.amount)} ${esc(inv.coin)}</b>${copy(inv.amount)}</div>
        <div>To ${esc(inv.coin)} address:</div>
        <div class="row between" style="gap:8px"><code style="word-break:break-all;font-size:12px">${esc(inv.address)}</code>${copy(inv.address)}</div>
        ${inv.tag ? `<div class="row between"><span>Destination tag (required): <b>${inv.tag}</b></span>${copy(String(inv.tag))}</div>` : ''}
        ${inv.coin === 'ZEC' ? '<div class="dim" style="font-size:12px">Send from a transparent (t-) address or exchange withdrawal. Fully shielded sends can\'t be detected.</div>' : ''}
        <a class="btn block" href="${esc(inv.uri)}" style="margin:8px 0">Open in wallet</a>
        <div>Status: <b class="${inv.status === 'paid' ? 'up' : ''}">${{ pending: '⏳ waiting for payment', seen: '👀 seen, waiting for confirmation', paid: '✅ paid, Pro is active', expired: 'expired' }[inv.status] || esc(inv.status)}</b>${inv.status === 'pending' ? ` · ${left} min left` : ''}</div>
        <div class="dim" style="font-size:12px">$${inv.usd} at ${fmtUsd(inv.price)} per ${esc(inv.coin)}. The odd last digits identify your payment.</div></div>`;
      el.querySelectorAll('[data-copy]').forEach((c) => (c.onclick = () => { navigator.clipboard?.writeText(c.dataset.copy); toast('Copied', 'ok'); }));
    };
    const poll = async () => {
      if (!b.isConnected) return stop();
      try { inv = await api(`/api/billing/invoice/${inv.id}`, { quiet: true }); drawInv(); if (inv.status === 'paid') { stop(); toast('Payment received. Pro is active 🎉', 'ok'); await loadMe(); draw(); } } catch { /* retry */ }
    };
    draw();
  }, {});
}

// After Stripe checkout redirects back with ?paid=<session>
export async function handleReturn(app, params) {
  if (params.get('paid')) {
    try { const r = await api('/api/billing/card/confirm', { method: 'POST', body: { session: params.get('paid') } }); toast(r.ok ? 'Subscribed. Pro is active 🎉' : 'Payment not finished yet', r.ok ? 'ok' : 'err'); } catch (e) { toast(e.message, 'err'); }
    await loadMe();
  }
  if (params.get('paycancel')) toast('Checkout cancelled');
}

// ---------- owner dashboard ----------
export function adminSheet(app) {
  sheet('Owner dashboard', async (b) => {
    const draw = async () => {
      let d; try { d = await api('/api/admin'); } catch (e) { b.innerHTML = `<p class="down">${esc(e.message)}</p>`; return; }
      const s = d.stats;
      b.innerHTML = `<div class="grid2" style="margin-bottom:14px">
          <div class="card"><div class="dim" style="font-size:12px">Users</div><b style="font-size:20px">${s.users}</b></div>
          <div class="card"><div class="dim" style="font-size:12px">Pro</div><b style="font-size:20px">${s.pro}</b></div>
          <div class="card"><div class="dim" style="font-size:12px">Revenue</div><b style="font-size:20px">${fmtUsd(s.revenueUsd)}</b></div>
          <div class="card"><div class="dim" style="font-size:12px">Card payments</div><b style="font-size:14px">${d.billing.card ? 'on' : 'off (STRIPE_SECRET_KEY)'}</b></div></div>
        <div class="label">Free access (comp)</div>
        <div class="card" style="margin:8px 0 14px"><div class="row" style="gap:8px"><input class="input" id="ad-email" type="email" placeholder="email@example.com"><button class="btn primary" id="ad-comp">Give free access</button></div>
          <div class="dim" style="font-size:12px;margin-top:6px">They get everything as soon as they sign up with that email.</div></div>
        <div class="label">Crypto wallet addresses (where payments go)</div>
        <div class="card" style="margin:8px 0 14px">${d.billing.coins.map((c) => `<div class="field"><label>${esc(c.name)} (${c.coin})${c.fromEnv ? ' · set on server' : ''}</label><input class="input" data-addr="${c.coin}" value="${esc(c.address || '')}" ${c.fromEnv ? 'disabled' : ''} placeholder="${c.coin === 'ZEC' ? 't1… (transparent address)' : 'your address'}" style="font-size:12px"></div>`).join('')}
          <button class="btn block" id="ad-addr">Save addresses</button></div>
        <div class="label">Users</div>
        <div class="card" style="margin:8px 0 14px;font-size:12px">${d.users.length ? d.users.map((u) => `<div class="order-item"><div><b>${esc(u.email)}</b><div class="dim">${u.plan.pro ? `PRO · ${esc(u.plan.reason)}` : 'free'}${u.plan.until ? ` · until ${fmtDate(u.plan.until)}` : ''}${u.invited ? ' · invited' : ''}</div></div>
          <div class="row" style="gap:4px"><button class="btn sm" data-grant="${esc(u.email)}">+30d</button><button class="btn sm" data-comp="${esc(u.email)}" data-on="${u.comp ? 0 : 1}">${u.comp ? 'Remove free' : 'Free'}</button></div></div>`).join('') : '<div class="dim">No users yet.</div>'}</div>
        <div class="label">Crypto invoices</div>
        <div class="card" style="margin:8px 0;font-size:12px">${d.invoices.length ? d.invoices.slice(0, 30).map((i) => `<div class="row between"><span>${esc(i.email)} · ${esc(i.amount)} ${esc(i.coin)}</span><b class="${i.status === 'paid' ? 'up' : ''}">${esc(i.status)}</b></div>`).join('') : '<div class="dim">None yet.</div>'}</div>`;
      $('#ad-comp', b).onclick = async () => { try { await api('/api/admin/comp', { method: 'POST', body: { email: $('#ad-email', b).value, on: true } }); toast('Free access granted', 'ok'); draw(); } catch (e) { toast(e.message, 'err'); } };
      $('#ad-addr', b).onclick = async () => { const m = {}; b.querySelectorAll('[data-addr]:not([disabled])').forEach((i) => { m[i.dataset.addr] = i.value.trim(); }); try { await api('/api/admin/addresses', { method: 'POST', body: m }); toast('Saved', 'ok'); draw(); } catch (e) { toast(e.message, 'err'); } };
      b.querySelectorAll('[data-comp]').forEach((x) => (x.onclick = async () => { await api('/api/admin/comp', { method: 'POST', body: { email: x.dataset.comp, on: x.dataset.on === '1' } }).catch((e) => toast(e.message, 'err')); draw(); }));
      b.querySelectorAll('[data-grant]').forEach((x) => (x.onclick = async () => { await api('/api/admin/grant', { method: 'POST', body: { email: x.dataset.grant, days: 30 } }).catch((e) => toast(e.message, 'err')); toast('Added 30 days', 'ok'); draw(); }));
    };
    draw();
  });
}
