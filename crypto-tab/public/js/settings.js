// Settings: server connection + passcode, exchange API keys, notifications, preferences.
import { api, conn, probe } from './api.js';
import { $, esc, store, sheet, toast, confirmSheet, tz, tzPicker } from './ui.js';
import { label as tzLabel } from '/shared/tz.mjs';
import { enablePush } from './alerts.js';
import { me, loadMe, upgradeSheet, loginSheet, logout, adminSheet, isOwner } from './account.js';

export function settingsSheet(app) {
  sheet('Settings', async (body, close) => {
    const draw = async () => {
      let keys = [];
      if (!conn.demo && store.get('token')) keys = await api('/api/keys', { quiet: true }).catch(() => []);
      const ex = app.exchanges || [];
      if (!conn.demo && store.get('token') && !me.user) await loadMe();
      const p = me.user?.plan;
      body.innerHTML = `
        <div class="label">Account & subscription</div>
        <div class="card" style="margin:8px 0 16px">${me.user ? `<div class="row between"><span>${esc(me.user.role === 'owner' ? 'Owner' : me.user.email)}</span><b class="${p?.pro ? 'up' : ''}">${p?.tier === 'owner' ? 'OWNER' : p?.pro ? 'PRO' : 'FREE'}</b></div>
          <div class="grid2" style="margin-top:10px"><button class="btn primary" id="st-sub">${p?.pro ? 'Subscription' : `⭐ Go Pro · $${me.billing?.price || 10}/mo`}</button>${isOwner() ? '<button class="btn" id="st-admin">👑 Owner dashboard</button>' : '<button class="btn" id="st-out">Log out</button>'}</div>` : '<button class="btn primary block" id="st-in">Log in / create account</button>'}</div>
        <div class="label">Server</div>
        <div class="card" style="margin:8px 0 16px">
          <div class="field"><label>Server address (leave empty when the app is served by it)</label><input class="input" id="st-server" placeholder="https://your-crypto-tab.example.com" value="${esc(store.get('server', ''))}" style="font-family:var(--sans)"></div>
          <div class="field"><label>Owner passcode (optional: server log or CT_TOKEN)</label><input class="input" id="st-token" type="password" value="${esc(store.get('token', ''))}"></div>
          <button class="btn primary block" id="st-connect">Connect</button>
          <div class="dim" style="font-size:12px;margin-top:8px">Status: <b class="${conn.state === 'ok' ? 'up' : conn.demo ? '' : 'down'}">${conn.state === 'ok' ? 'connected' : conn.demo ? 'demo data (no server)' : conn.state}</b>${conn.ai?.claude ? ` · AI: Claude ${esc(conn.ai.model)}` : ''}</div>
        </div>
        <div class="label">Exchange API keys</div>
        <div class="dim" style="font-size:12px;margin:6px 0 8px;line-height:1.5">Keys are encrypted (AES-256-GCM) on your server and never sent back to the phone. Create keys with <b>trade</b> permission only, never withdrawal, and restrict them to your server's IP.</div>
        <div class="card" style="margin-bottom:16px">
          ${keys.length ? keys.map((k) => `<div class="order-item"><div><b>${esc(ex.find((x) => x.id === k.exchange)?.name || k.exchange)}</b><div class="dim" style="font-size:12px">${esc(k.label)}${k.sandbox ? ' · testnet' : ''}</div></div><button class="btn sm" data-delkey="${esc(k.exchange)}">Remove</button></div>`).join('') : '<div class="muted" style="font-size:13px;margin-bottom:10px">No keys yet. Paper trading works without them.</div>'}
          <div class="field" style="margin-top:10px"><label>Exchange</label><select class="input" id="k-ex">${ex.map((x) => `<option value="${x.id}" ${x.id === app.S.ex ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="field"><label>API key</label><input class="input" id="k-key" autocomplete="off"></div>
          <div class="field"><label>Secret</label><input class="input" id="k-secret" type="password" autocomplete="off"></div>
          <div class="field" id="k-pass-f"><label>Passphrase (OKX, KuCoin, Bitget, Crypto.com…)</label><input class="input" id="k-pass" type="password" autocomplete="off"></div>
          <div class="row between" style="margin-bottom:12px"><span style="font-size:13px">Testnet / sandbox</span><button class="toggle" id="k-sb"></button></div>
          <button class="btn block" id="k-save">Save key</button>
        </div>
        <div class="label">Notifications</div>
        <div class="card" style="margin:8px 0 16px">
          <button class="btn block" id="st-push">🔔 Enable notifications (alarms & profitable trades)</button>
          <div class="dim" style="font-size:12px;margin-top:8px;line-height:1.5">iPhone: open Safari → Share → <b>Add to Home Screen</b>, launch Crypto Tab from the icon, then tap this button (iOS 16.4+). Android: Chrome asks for permission directly.</div>
        </div>
        <div class="label" ${isOwner() ? '' : 'hidden'}>Telegram</div>
        <div class="card" style="margin:8px 0 16px" id="tg-card" ${isOwner() ? '' : 'hidden'}><div class="dim" style="font-size:12px;line-height:1.5;margin-bottom:10px">Get alarms, profits, news and herd moves in Telegram, and control the app with commands (/price ZEC, /bots, /pause all, /stop…). 1) In Telegram, open @BotFather → /newbot and copy the token. 2) Paste it below and save. 3) Send your new bot /start: it replies with your chat id. 4) Paste the chat id and save again.</div>
          <div class="field"><label>Bot token</label><input class="input" id="tg-token" type="password" autocomplete="off" placeholder="123456:ABC…"></div>
          <div class="field"><label>Chat id</label><input class="input" id="tg-chat" inputmode="numeric" placeholder="from /start"></div>
          <div class="grid2"><button class="btn" id="tg-save">Save</button><button class="btn primary" id="tg-test">Send test</button></div>
          <div class="dim" id="tg-status" style="font-size:12px;margin-top:8px"></div></div>
        <div class="label">Time zone</div>
        <div class="card" style="margin:8px 0 16px"><button class="btn block" id="st-tz" style="justify-content:space-between"><span>🕐 ${esc(tzLabel(tz()))}</span><span class="dim">Change ›</span></button>
          <div class="dim" style="font-size:12px;margin-top:8px">Used for every time in the app. Phoenix = Mountain Standard Time all year.</div></div>
        <div class="label">Preferences</div>
        <div class="card" style="margin:8px 0 16px">
          <div class="row between" style="margin-bottom:10px"><span style="font-size:13px">Keep drawing tool after placing</span><button class="toggle ${store.get('stayInDraw', false) ? 'on' : ''}" id="p-stay"></button></div>
          <div class="row between"><span style="font-size:13px">💰 Cash sound on profitable bot trades</span><button class="toggle ${store.get('profitSound', true) ? 'on' : ''}" id="p-ps"></button></div>
        </div>
        <div class="dim" style="font-size:11px;text-align:center;line-height:1.5">Crypto Tab · trading involves risk of loss. Bots, AI suggestions and forecasts are tools, not guarantees.<br>Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener" style="color:var(--fg-3)">TradingView</a> Lightweight Charts™ · market connectivity by CCXT.</div>`;
      $('#st-sub', body)?.addEventListener('click', () => { close(); upgradeSheet(app); });
      $('#st-admin', body)?.addEventListener('click', () => { close(); adminSheet(app); });
      $('#st-out', body)?.addEventListener('click', () => { close(); logout(app); });
      $('#st-in', body)?.addEventListener('click', () => { close(); loginSheet(app); });
      $('#st-connect', body).onclick = async () => {
        store.set('server', $('#st-server', body).value.trim());
        const tk = $('#st-token', body).value.trim(); if (tk) store.set('token', tk);
        conn.demo = false;
        const h = await probe();
        if (!h) return toast('Server not reachable. Using demo data.', 'err');
        if (!tk) { toast('Connected', 'ok'); close(); if (!store.get('token')) loginSheet(app); else { await loadMe(); app.reconnect(); } return; }
        try { await api('/api/login', { method: 'POST', body: { token: tk }, quiet: true }); await loadMe(); toast('Connected', 'ok'); close(); app.reconnect(); }
        catch (e) { toast(e.message, 'err'); }
      };
      const exSel = $('#k-ex', body);
      const passVis = () => { const e = ex.find((x) => x.id === exSel.value); $('#k-pass-f', body).hidden = !e?.password; };
      exSel.onchange = passVis; passVis();
      $('#k-sb', body).onclick = (e) => e.target.classList.toggle('on');
      $('#k-save', body).onclick = async () => {
        try {
          await api(`/api/keys/${exSel.value}`, { method: 'POST', body: { apiKey: $('#k-key', body).value.trim(), secret: $('#k-secret', body).value.trim(), password: $('#k-pass', body).value.trim() || undefined, sandbox: $('#k-sb', body).classList.contains('on') } });
          const b = await api(`/api/balance?ex=${exSel.value}`).catch((e) => ({ error: e.message }));
          toast(b.error ? `Saved, but balance check failed: ${b.error}` : `Key saved · ${b.balances.length} assets found`, b.error ? 'err' : 'ok');
          draw();
        } catch (e) { toast(e.message, 'err'); }
      };
      body.querySelectorAll('[data-delkey]').forEach((b) => (b.onclick = async () => { if (await confirmSheet('Remove key?', 'Live bots on this exchange will pause.', 'Remove', true)) { await api(`/api/keys/${b.dataset.delkey}`, { method: 'DELETE', body: {} }); draw(); } }));
      $('#st-push', body).onclick = async () => { try { await enablePush(); await api('/api/push/test', { method: 'POST', body: {} }); toast('Notifications on. A test was sent.', 'ok'); } catch (e) { toast(e.message, 'err'); } };
      if (isOwner()) api('/api/telegram', { quiet: true }).then((t) => { $('#tg-status', body).textContent = t.configured ? `Connected${t.chat ? ` · chat ${t.chat}` : ' · add your chat id'}${t.source === 'env' ? ' (server settings)' : ''}` : 'Not connected'; }).catch(() => {});
      $('#tg-save', body).onclick = async () => { try { const t = await api('/api/telegram', { method: 'POST', body: { token: $('#tg-token', body).value.trim(), chatId: $('#tg-chat', body).value.trim() } }); $('#tg-status', body).textContent = t.configured ? `Saved${t.chat ? ` · chat ${t.chat}` : ' · now send your bot /start to get the chat id'}` : 'Removed'; toast('Telegram saved', 'ok'); } catch (e) { toast(e.message, 'err'); } };
      $('#tg-test', body).onclick = async () => { try { await api('/api/telegram/test', { method: 'POST', body: {} }); toast('Test sent to Telegram', 'ok'); } catch (e) { toast(e.message, 'err'); } };
      $('#st-tz', body).onclick = () => tzPicker(() => { toast('Time zone saved', 'ok'); location.reload(); });
      $('#p-stay', body).onclick = (e) => { e.target.classList.toggle('on'); store.set('stayInDraw', e.target.classList.contains('on')); };
      $('#p-ps', body).onclick = (e) => { e.target.classList.toggle('on'); store.set('profitSound', e.target.classList.contains('on')); };
    };
    draw();
  });
}
