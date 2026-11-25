// Markets: exchange picker, quote tabs, favourites, tokenised stocks, sortable live list.
import { api, qs } from './api.js';
import { $, esc, fmtPrice, fmtAmt, fmtPct, store, haptic, toast } from './ui.js';
import { COINS, MAIN_COIN } from '/shared/presets.mjs';

const TABS = ['★', 'USDT', 'USDC', 'USD', 'BTC', 'Stocks', 'All'];

export function marketsView(el, app) {
  let rows = [], prev = new Map(), timer = null;
  let tab = store.get('mkTab', 'USDT');
  let sort = store.get('mkSort', { k: 'v', d: -1 });
  let q = '';
  const favs = () => new Set(store.get('favs', COINS.map((c) => `mexc|${c}/USDT`)));

  el.innerHTML = `
    <div class="chips" id="mk-ex"></div>
    <div class="search"><svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3m0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10"/></svg><input class="input" id="mk-q" placeholder="Search coins & tokenized stocks" autocomplete="off"></div>
    <div class="ticker-strip" id="mk-top"></div>
    <div class="chips" id="mk-tabs" style="padding-top:2px"></div>
    <div class="mk-head"><button data-k="b">Pair / Vol</button><button data-k="p">Price</button><button data-k="c">24h %</button></div>
    <div id="mk-list"><div class="empty"><span class="spinner"></span></div></div>`;

  const exEl = $('#mk-ex', el), listEl = $('#mk-list', el), tabsEl = $('#mk-tabs', el), topEl = $('#mk-top', el);

  async function loadExchanges() {
    const list = await api('/api/exchanges').catch(() => []);
    app.exchanges = list;
    exEl.innerHTML = list.map((x) => `<button class="chip ${x.id === app.S.ex ? 'active' : ''}" data-ex="${x.id}">${esc(x.name)}</button>`).join('');
    exEl.querySelector('.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  exEl.onclick = (e) => {
    const b = e.target.closest('[data-ex]'); if (!b) return;
    haptic(); app.set({ ex: b.dataset.ex });
    exEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
    listEl.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    rows = []; load();
  };
  tabsEl.innerHTML = TABS.map((t) => `<button class="chip ${t === tab ? 'active' : ''}" data-tab="${t}">${t === '★' ? '★ Favorites' : t}</button>`).join('');
  tabsEl.onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; store.set('mkTab', tab); tabsEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b)); haptic(); render(); };
  $('#mk-q', el).oninput = (e) => { q = e.target.value.trim().toUpperCase(); render(); };
  el.querySelector('.mk-head').onclick = (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    sort = { k: b.dataset.k === 'b' ? (sort.k === 'v' ? 'b' : 'v') : b.dataset.k, d: sort.k === b.dataset.k ? -sort.d : -1 };
    store.set('mkSort', sort); render();
  };

  listEl.onclick = (e) => {
    const star = e.target.closest('.star');
    const row = e.target.closest('.mk-row');
    if (!row) return;
    const key = `${app.S.ex}|${row.dataset.s}`;
    if (star) {
      const f = favs(); f.has(key) ? f.delete(key) : f.add(key);
      store.set('favs', [...f]); haptic(12); render(); return;
    }
    haptic(); app.open(row.dataset.s);
  };
  topEl.onclick = (e) => { const c = e.target.closest('[data-s]'); if (c) app.open(c.dataset.s); };

  async function load() {
    try {
      const r = await api(`/api/markets${qs({ ex: app.S.ex })}`);
      prev = new Map(rows.map((x) => [x.s, x.p]));
      rows = r.markets;
      app.marketCache = rows;
      render();
    } catch (e) {
      listEl.innerHTML = `<div class="empty"><b>Could not load ${esc(app.S.ex)}</b>${esc(e.message)}</div>`;
    }
  }

  function render() {
    const f = favs();
    let list = rows;
    if (tab === '★') list = rows.filter((r) => f.has(`${app.S.ex}|${r.s}`));
    else if (tab === 'Stocks') list = rows.filter((r) => r.st);
    else if (tab !== 'All') list = rows.filter((r) => r.q === tab);
    if (q) list = list.filter((r) => r.b.includes(q) || r.s.includes(q));
    const k = sort.k;
    list = [...list].sort((a, b) => (k === 'b' ? a.b.localeCompare(b.b) * -sort.d : ((a[k] ?? -1e18) - (b[k] ?? -1e18)) * sort.d));
    if (!q) { const i = list.findIndex((r) => r.b === MAIN_COIN); if (i > 0) list.unshift(...list.splice(i, 1)); } // main coin pinned on top
    el.querySelectorAll('.mk-head button').forEach((b) => b.classList.toggle('sorted', b.dataset.k === k || (b.dataset.k === 'b' && k === 'v')));
    const pick = (c) => rows.find((r) => r.b === c && r.q === 'USDT') || rows.find((r) => r.b === c && (r.q === 'USD' || r.q === 'USDC'));
    const top = COINS.map(pick).filter(Boolean);
    topEl.innerHTML = top.map((r) => `<div class="tk-card ${r.b === MAIN_COIN ? 'main' : ''}" data-s="${esc(r.s)}"><b>${r.b === MAIN_COIN ? '★ ' : ''}${esc(r.b)}</b> <span class="${r.c >= 0 ? 'up' : 'down'}" style="font-size:11px">${fmtPct(r.c)}</span><span class="num">${fmtPrice(r.p)}</span></div>`).join('');
    if (!list.length) {
      listEl.innerHTML = `<div class="empty"><b>${tab === '★' ? 'No favorites yet' : 'Nothing here'}</b>${tab === '★' ? 'Tap the ☆ next to any pair to pin it here.' : tab === 'Stocks' ? 'This exchange lists no tokenized stocks. Try Gate.io, MEXC, KuCoin or Bybit.' : 'Try another tab or exchange.'}</div>`;
      return;
    }
    const html = [];
    for (const r of list.slice(0, 300)) {
      const p0 = prev.get(r.s);
      const flash = p0 != null && p0 !== r.p ? (r.p > p0 ? 'flash-up' : 'flash-down') : '';
      const ch = r.c ?? 0;
      html.push(`<div class="mk-row ${flash} ${r.b === MAIN_COIN ? 'main' : ''}" data-s="${esc(r.s)}">
        <div class="mk-pair"><span class="star ${f.has(`${app.S.ex}|${r.s}`) ? 'on' : ''}">${f.has(`${app.S.ex}|${r.s}`) ? '★' : '☆'}</span>
          <div class="mk-name"><b>${esc(r.b)}</b><small>/${esc(r.q)}</small>${r.b === MAIN_COIN ? ' <span class="pill warn" style="height:16px;font-size:9px">★ MAIN</span>' : ''}${r.st ? ' <span class="pill accent" style="height:16px;font-size:9px">STOCK</span>' : ''}<div>Vol ${fmtAmt(r.v)}</div></div></div>
        <div class="mk-price">${fmtPrice(r.p)}<div>H ${fmtPrice(r.h, r.p)}</div></div>
        <div class="mk-chg ${ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat'}">${fmtPct(r.c)}</div>
      </div>`);
    }
    listEl.innerHTML = html.join('');
  }

  return {
    async show() {
      if (!app.exchanges) await loadExchanges();
      else exEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.ex === app.S.ex));
      load();
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) load(); }, 6000);
    },
    hide() { clearInterval(timer); },
    refreshExchanges: loadExchanges,
    toast,
  };
}
