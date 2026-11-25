// Crypto Tab app shell: routing, shared state, symbol picker, live events, notifications.
import { api, qs, probe, events, onConn, conn, token } from './api.js';
import { $, $$, esc, store, sheet, toast, haptic, fmtPrice, fmtPct } from './ui.js';
import { marketsView } from './markets.js';
import { chartScreen } from './chartview.js';
import { tradeScreen } from './trade.js';
import { botsScreen } from './bots.js';
import { aiScreen } from './ai.js';
import { alertsSheet, alarmOn, alarmOff, unlockAudio, startLocalChecker, activeCount, playOnce } from './alerts.js';
import { settingsSheet } from './settings.js';

const app = {
  S: { ex: 'mexc', symbol: 'BTC/USDT', tf: '1h', ...store.get('state', {}) },
  views: {},
  current: null,
  exchanges: null,
  last: null,
  set(patch) {
    const symChanged = (patch.symbol && patch.symbol !== this.S.symbol) || (patch.ex && patch.ex !== this.S.ex);
    Object.assign(this.S, patch);
    store.set('state', this.S);
    if (symChanged) { this.last = null; this._symChanged = true; }
  },
  go(name, opts = {}) {
    if (this.current && this.current !== name) this.views[this.current].hide?.();
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.go === name));
    this.current = name;
    if (this._symChanged && name === 'trade') opts.symbolChanged = true;
    if (name === 'trade') this._symChanged = false;
    this.views[name].show?.(opts);
    store.set('view', name);
  },
  open(symbol) { this.set({ symbol }); this.go('chart'); },
  newAlert(preset) { alertsSheet(this, preset); },
  // symbol search sheet (current exchange); cb runs after a pick
  pickSymbol(cb) {
    sheet('Select pair', async (b, close) => {
      b.innerHTML = `<input class="input" id="ps-q" placeholder="Search" style="font-family:var(--sans);margin-bottom:10px" autocomplete="off"><div id="ps-list"><div class="empty"><span class="spinner"></span></div></div>`;
      let rows = this.marketCache;
      if (!rows) { try { rows = (await api(`/api/markets${qs({ ex: this.S.ex })}`)).markets; this.marketCache = rows; } catch (e) { b.querySelector('#ps-list').innerHTML = esc(e.message); return; } }
      const draw = (q = '') => {
        const list = rows.filter((r) => !q || r.s.includes(q)).slice(0, 80);
        b.querySelector('#ps-list').innerHTML = list.map((r) => `<div class="mk-row" data-s="${esc(r.s)}" style="grid-template-columns:1fr auto auto;gap:12px"><div class="mk-name"><b>${esc(r.b)}</b><small>/${esc(r.q)}</small></div><span class="num">${fmtPrice(r.p)}</span><span class="num ${r.c >= 0 ? 'up' : 'down'}" style="font-size:12px;width:62px;text-align:right">${fmtPct(r.c)}</span></div>`).join('');
      };
      draw();
      const input = b.querySelector('#ps-q');
      input.oninput = () => draw(input.value.trim().toUpperCase());
      b.querySelector('#ps-list').onclick = (e) => {
        const r = e.target.closest('[data-s]'); if (!r) return;
        haptic(); this.set({ symbol: r.dataset.s }); close();
        if (cb) cb(); else this.go(this.current, { symbolChanged: true });
      };
      setTimeout(() => input.focus(), 250);
    });
  },
  async refreshAlertBadge() {
    const n = await activeCount();
    const b = $('#alert-badge');
    b.hidden = !n; b.textContent = n;
  },
  reconnect() { this.exchanges = null; this.views.markets.refreshExchanges?.(); this.startEvents(); this.go(this.current || 'markets'); this.refreshAlertBadge(); },
  startEvents() {
    this.stopEvents?.();
    this.stopEvents = events({
      hello: (d) => (d.ringing || []).forEach((a) => alarmOn(a, this)),
      alarm: (a) => { alarmOn(a, this); this.refreshAlertBadge(); },
      'alarm-stop': (a) => { alarmOff(a.id); this.refreshAlertBadge(); },
      trade: (t) => { this.views.bots.onEvent?.('trade', t); if (t.side === 'sell' && t.pnl > 0) { if (store.get('profitSound', true)) playOnce('cash'); toast(`💰 ${t.name}: +${t.pnl.toFixed(2)}`, 'ok'); } },
      bot: (b) => this.views.bots.onEvent?.('bot', b),
      notify: (n) => { if (n.kind === 'bot') toast(`${n.title}: ${n.body}`); },
    });
  },
};
window.CT = app;

function login() {
  sheet('Connect to your server', (b, close) => {
    b.innerHTML = `<p class="muted" style="margin-top:0;line-height:1.5">Enter the passcode shown when your Crypto Tab server starts (or the <code>CT_TOKEN</code> you set).</p>
      <input class="input" id="lg-t" type="password" placeholder="Passcode" style="margin-bottom:12px"><button class="btn primary block" id="lg-go">Unlock</button>`;
    b.querySelector('#lg-go').onclick = async () => {
      const t = b.querySelector('#lg-t').value.trim();
      try { await api('/api/login', { method: 'POST', body: { token: t }, quiet: true }); store.set('token', t); close(); toast('Unlocked', 'ok'); app.reconnect(); }
      catch (e) { toast(e.message, 'err'); }
    };
  });
}

async function boot() {
  app.views.markets = marketsView($('#view-markets'), app);
  app.views.chart = chartScreen($('#view-chart'), app);
  app.views.trade = tradeScreen($('#view-trade'), app);
  app.views.bots = botsScreen($('#view-bots'), app);
  app.views.ai = aiScreen($('#view-ai'), app);

  $('#tabbar').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) { haptic(); app.go(b.dataset.go); } };
  $('.brand').onclick = () => app.go('markets');
  $('#btn-alerts').onclick = () => app.newAlert();
  $('#btn-settings').onclick = () => settingsSheet(app);
  window.addEventListener('ct:login', () => { if (!$('#lg-t')) login(); });

  onConn((c) => { const d = $('#conn'); d.className = `conn ${c.state === 'ok' ? 'ok' : c.demo ? 'demo' : c.state === 'err' ? 'err' : ''}`; d.title = c.demo ? 'Demo data: connect a server in Settings' : c.state; });
  unlockAudio();

  const h = await probe();
  if (h && !token()) login();
  if (conn.demo) toast('Demo data. Connect your server in Settings for live markets.', '');
  else app.startEvents();
  startLocalChecker(app);

  const params = new URLSearchParams(location.search);
  if (params.get('ack')) { await api(`/api/alerts/${params.get('ack')}/ack`, { method: 'POST', body: {} }).catch(() => {}); history.replaceState(null, '', '/'); }
  app.go(params.get('view') || store.get('view', 'markets'));
  app.refreshAlertBadge();

  // when the phone wakes the app up, re-check for alarms still ringing
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || conn.demo) return;
    try { (await api('/api/alerts', { quiet: true })).filter((a) => a.status === 'ringing').forEach((a) => alarmOn(a, app)); } catch { /* ignore */ }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'alarm-stopped') alarmOff(e.data.id); });
  }
}

boot();
