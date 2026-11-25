// Trade screen in the exchange style: order form on the left, live order book on the right,
// open orders / fills / assets underneath. Paper mode works without API keys.
import { api, qs, conn } from './api.js';
import { renderBook, groupingSteps } from './book.js';
import { $, esc, fmtPrice, fmtAmt, fmtPct, store, haptic, toast, confirmSheet, ago, decimalsFor } from './ui.js';

export function tradeScreen(el, app) {
  let side = 'buy', type = store.get('ordType', 'limit'), mode = store.get('tradeMode', 'paper');
  let ob = null, bal = { balances: [] }, timers = [], grouping = 0, tab = 'orders', priceTouched = false;

  el.innerHTML = `
    <div class="trade-top">
      <button class="ch-pair" id="tr-pair"><span id="tr-sym"></span> <span class="dim">▾</span></button>
      <span class="num" id="tr-chg" style="font-size:13px"></span>
      <span style="flex:1"></span>
      <button class="mode-pill" id="tr-mode"></button>
      <button class="icon-btn" id="tr-chart" aria-label="Chart"><svg viewBox="0 0 24 24"><path d="M7 3v3H5v10h2v5h1.5v-5h2V6h-2V3zm8.5 3v4h-2v7h2v4H17v-4h2v-7h-2V6z"/></svg></button>
    </div>
    <div class="trade-split">
      <div class="trade-form">
        <div class="seg buysell" id="tr-side"><button data-s="buy" class="buy">Buy</button><button data-s="sell" class="sell">Sell</button></div>
        <select class="input" id="tr-type" style="margin:8px 0;height:40px"><option value="limit">Limit</option><option value="market">Market</option><option value="stop">Stop-limit</option></select>
        <div class="field" id="f-stop" hidden><div class="stepper"><button data-step="stop:-1">−</button><input id="tr-stop" inputmode="decimal" placeholder="Trigger price"><button data-step="stop:1">+</button></div></div>
        <div class="field" id="f-price"><div class="stepper"><button data-step="price:-1">−</button><input id="tr-price" inputmode="decimal" placeholder="Price"><button data-step="price:1">+</button></div></div>
        <div class="field"><div class="stepper"><button data-step="amt:-1">−</button><input id="tr-amt" inputmode="decimal" placeholder="Amount"><span class="unit" id="tr-base"></span></div></div>
        <div class="pct-row" id="tr-pct"><button data-p="25">25%</button><button data-p="50">50%</button><button data-p="75">75%</button><button data-p="100">Max</button></div>
        <div class="field"><div class="stepper"><input id="tr-total" inputmode="decimal" placeholder="Total" style="padding-left:12px;text-align:left"><span class="unit" id="tr-quote"></span></div></div>
        <div class="avail"><span>Available</span><b id="tr-avail">—</b></div>
        <div class="avail"><span>Est. fee</span><b id="tr-fee">—</b></div>
        <button class="btn buy block" id="tr-submit" style="margin-top:8px;height:52px">Buy</button>
      </div>
      <div>
        <div class="row between" style="margin-bottom:4px"><select class="input" id="tr-group" style="height:30px;font-size:11px;padding:0 22px 0 8px;width:auto;min-width:72px;background-position:calc(100% - 12px) 12px,calc(100% - 7px) 12px"></select>
          <div class="seg" id="tr-bmode" style="padding:2px"><button data-m="both" class="active" style="height:24px;padding:0 6px;font-size:10px">⇅</button><button data-m="bids" style="height:24px;padding:0 6px;font-size:10px;color:var(--up)">B</button><button data-m="asks" style="height:24px;padding:0 6px;font-size:10px;color:var(--down)">S</button></div></div>
        <div id="tr-health"></div><div id="tr-book"></div>
      </div>
    </div>
    <div class="seg" style="margin:14px 12px 4px" id="tr-tabs"><button data-t="orders" class="active">Open orders</button><button data-t="fills">History</button><button data-t="assets">Assets</button></div>
    <div id="tr-list" style="padding:0 12px"></div>`;

  const P = $('#tr-price', el), A = $('#tr-amt', el), T = $('#tr-total', el), S = $('#tr-stop', el);
  let bookMode = 'both';
  const base = () => app.S.symbol.split('/')[0];
  const quote = () => app.S.symbol.split('/')[1];
  const px = () => (type === 'market' ? (side === 'buy' ? ob?.asks[0]?.[0] : ob?.bids[0]?.[0]) || app.last?.p : Number(P.value));
  const free = (asset) => bal.balances?.find((b) => b.asset === asset)?.free ?? 0;

  function paint() {
    $('#tr-sym', el).textContent = app.S.symbol;
    $('#tr-base', el).textContent = base();
    $('#tr-quote', el).textContent = quote();
    el.querySelectorAll('#tr-side button').forEach((b) => b.classList.toggle('active', b.dataset.s === side));
    $('#tr-type', el).value = type;
    $('#f-price', el).hidden = type === 'market';
    $('#f-stop', el).hidden = type !== 'stop';
    const sb = $('#tr-submit', el);
    sb.className = `btn block ${side}`; sb.style.height = '52px'; sb.style.marginTop = '8px';
    sb.textContent = `${side === 'buy' ? 'Buy' : 'Sell'} ${base()}${mode === 'paper' ? ' (paper)' : ''}`;
    const m = $('#tr-mode', el);
    m.className = `mode-pill ${mode}`;
    m.innerHTML = mode === 'paper' ? '● Paper' : '● LIVE';
    const av = side === 'buy' ? `${fmtAmt(free(quote()))} ${quote()}` : `${fmtAmt(free(base()))} ${base()}`;
    $('#tr-avail', el).textContent = av;
    calc();
  }

  function calc(from = 'amt') {
    const p = px();
    if (!p) return;
    if (from === 'total') A.value = T.value ? +(Number(T.value) / p).toPrecision(6) : '';
    else T.value = A.value ? +(Number(A.value) * p).toFixed(decimalsFor(1)) : '';
    $('#tr-fee', el).textContent = T.value ? `${(Number(T.value) * 0.001).toFixed(4)} ${quote()}` : '—';
  }

  $('#tr-side', el).onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { side = b.dataset.s; haptic(); paint(); } };
  $('#tr-type', el).onchange = (e) => { type = e.target.value; store.set('ordType', type); paint(); };
  $('#tr-pair', el).onclick = () => app.pickSymbol();
  $('#tr-chart', el).onclick = () => app.go('chart');
  $('#tr-mode', el).onclick = async () => {
    if (mode === 'paper') {
      if (conn.demo) return toast('Live trading needs your Crypto Tab server', 'err');
      const keys = await api('/api/keys').catch(() => []);
      if (!keys.find((k) => k.exchange === app.S.ex)) return toast(`Add a ${app.S.ex} API key in Settings to trade live`, 'err');
      if (!(await confirmSheet('Switch to LIVE trading?', `Orders will be sent to <b>${esc(app.S.ex)}</b> with real funds.`, 'Go live', true))) return;
      mode = 'live';
    } else mode = 'paper';
    store.set('tradeMode', mode); loadBalance(); loadList(); paint();
  };
  P.oninput = () => { priceTouched = true; calc(); };
  A.oninput = () => calc();
  T.oninput = () => calc('total');
  el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => {
    const [k, dir] = b.dataset.step.split(':');
    const inp = k === 'price' ? P : k === 'stop' ? S : A;
    const v = Number(inp.value) || (k === 'amt' ? 0 : app.last?.p || 0);
    const step = k === 'amt' ? Math.pow(10, -Math.min(6, decimalsFor(1 / Math.max(v, 1e-9)))) || 0.001 : Math.pow(10, -decimalsFor(v));
    inp.value = +(v + Number(dir) * step).toFixed(k === 'amt' ? 6 : decimalsFor(v));
    if (k === 'price') priceTouched = true;
    haptic(); calc();
  }));
  $('#tr-pct', el).onclick = (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const f = Number(b.dataset.p) / 100;
    const p = px(); if (!p) return;
    A.value = side === 'buy' ? +((free(quote()) * f) / (p * 1.001)).toPrecision(6) : +(free(base()) * f).toPrecision(6);
    el.querySelectorAll('#tr-pct button').forEach((x) => x.classList.toggle('active', x === b));
    haptic(); calc();
  };
  $('#tr-group', el).onchange = (e) => { grouping = Number(e.target.value); drawBook(); };
  $('#tr-bmode', el).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; bookMode = b.dataset.m; el.querySelectorAll('#tr-bmode button').forEach((x) => x.classList.toggle('active', x === b)); drawBook(); };
  $('#tr-tabs', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; el.querySelectorAll('#tr-tabs button').forEach((x) => x.classList.toggle('active', x === b)); loadList(); };

  $('#tr-submit', el).onclick = async () => {
    const amount = Number(A.value), price = px();
    if (!(amount > 0)) return toast('Enter an amount', 'err');
    if (type !== 'market' && !(price > 0)) return toast('Enter a price', 'err');
    if (mode === 'live' && !(await confirmSheet(`Confirm ${side.toUpperCase()}`, `${side} <b>${amount} ${esc(base())}</b> ${type === 'market' ? 'at market' : `@ <b>${fmtPrice(price)}</b>`} on ${esc(app.S.ex)}<br>≈ ${fmtAmt(amount * price)} ${esc(quote())}`, `${side === 'buy' ? 'Buy' : 'Sell'} now`, side === 'sell'))) return;
    const btn = $('#tr-submit', el); btn.disabled = true;
    try {
      const o = await api('/api/order', { method: 'POST', body: { mode, exchange: app.S.ex, symbol: app.S.symbol, side, type, amount, price, stopPrice: type === 'stop' ? Number(S.value) : undefined } });
      haptic(25);
      toast(`${side === 'buy' ? 'Buy' : 'Sell'} order ${o.status === 'closed' ? 'filled' : 'placed'}`, 'ok');
      A.value = ''; T.value = '';
      loadBalance(); loadList();
    } catch (e) { toast(e.message, 'err'); }
    btn.disabled = false;
  };

  function bookHealth() {
    if (!ob?.bids?.[0] || !ob?.asks?.[0]) return '';
    const mid = (ob.bids[0][0] + ob.asks[0][0]) / 2, spread = ((ob.asks[0][0] - ob.bids[0][0]) / mid) * 100;
    const depth = (side, pct) => side.filter(([p]) => Math.abs(p - mid) / mid <= pct / 100).reduce((s, [p, a]) => s + p * a, 0);
    const b1 = depth(ob.bids, 1), a1 = depth(ob.asks, 1);
    const ok = spread <= 0.15;
    return `<div style="font-size:10px;line-height:1.4;margin:4px 0;padding:6px;border-radius:8px;background:${ok ? 'var(--up-bg)' : 'rgba(255,176,32,.12)'}">${ok ? '✓' : '⚠'} spread ${spread.toFixed(3)}%<br>±1% depth: <span class="up">${fmtAmt(b1)}</span> / <span class="down">${fmtAmt(a1)}</span></div>`;
  }

  function drawBook() {
    const hb = $('#tr-health', el); if (hb) hb.innerHTML = bookHealth();
    renderBook($('#tr-book', el), ob, { rows: 8, last: app.last?.p, change: app.last?.c, grouping, mode: bookMode, onPrice: (p) => { P.value = p; priceTouched = true; if (type === 'market') { type = 'limit'; paint(); } calc(); haptic(); } });
  }

  async function loadBook() {
    if (document.hidden) return;
    try {
      ob = await api(`/api/book${qs({ ex: app.S.ex, symbol: app.S.symbol, depth: 40 })}`);
      if (!priceTouched && !P.value && ob.bids[0]) { P.value = side === 'buy' ? ob.bids[0][0] : ob.asks[0][0]; calc(); }
      drawBook();
    } catch { /* keep last */ }
  }

  async function loadTicker() {
    try {
      app.last = await api(`/api/ticker${qs({ ex: app.S.ex, symbol: app.S.symbol })}`);
      $('#tr-chg', el).innerHTML = `<span class="${app.last.c >= 0 ? 'up' : 'down'}">${fmtPct(app.last.c)}</span>`;
      const g = $('#tr-group', el);
      if (!g.options.length) g.innerHTML = groupingSteps(app.last.p).map((s) => `<option value="${s}">${s ? s : 'Raw'}</option>`).join('');
    } catch { /* ignore */ }
  }

  async function loadBalance() {
    if (conn.demo) { bal = { balances: [{ asset: quote(), free: 10000, total: 10000 }] }; paint(); return; }
    try { bal = await api(`/api/balance${qs({ ex: mode === 'paper' ? 'paper' : app.S.ex })}`); } catch (e) { bal = { balances: [] }; if (mode === 'live') toast(e.message, 'err'); }
    paint();
  }

  async function loadList() {
    const L = $('#tr-list', el);
    if (conn.demo) { L.innerHTML = '<div class="empty"><b>Demo mode</b>Connect your Crypto Tab server in Settings to trade.</div>'; return; }
    try {
      if (tab === 'assets') {
        const rows = (bal.balances || []).filter((b) => b.total > 0);
        L.innerHTML = rows.length ? rows.map((b) => `<div class="order-item"><div><b>${esc(b.asset)}</b><div class="dim" style="font-size:11px">Free ${fmtAmt(b.free)} · In orders ${fmtAmt(b.used)}</div></div><div class="num">${fmtAmt(b.total)}</div></div>`).join('') + (mode === 'paper' ? '<button class="btn sm" id="pp-reset" style="margin-top:12px">Reset paper account</button>' : '') : '<div class="empty">No assets</div>';
        $('#pp-reset', L)?.addEventListener('click', async () => { if (await confirmSheet('Reset paper account?', 'Balances go back to 10,000 USDT / USD and orders are cleared.', 'Reset')) { await api('/api/paper/reset', { method: 'POST', body: {} }); loadBalance(); loadList(); } });
        return;
      }
      if (tab === 'fills') {
        const fills = mode === 'paper' ? (await api('/api/balance?ex=paper')).fills : [];
        L.innerHTML = fills.length ? fills.map((o) => `<div class="order-item"><div><b class="${o.side === 'buy' ? 'up' : 'down'}">${o.side.toUpperCase()}</b> ${esc(o.symbol)}<div class="dim" style="font-size:11px">${ago(o.closedAt || o.time)} ago · ${o.type}</div></div><div class="num" style="text-align:right">${fmtAmt(o.amount)}<div class="dim">@ ${fmtPrice(o.average || o.price)}</div></div></div>`).join('') : `<div class="empty">${mode === 'live' ? 'Open your exchange app for full live history.' : 'No fills yet'}</div>`;
        return;
      }
      const orders = await api(`/api/orders${qs({ ex: mode === 'paper' ? 'paper' : app.S.ex, symbol: mode === 'live' ? app.S.symbol : undefined })}`);
      L.innerHTML = orders.length ? orders.map((o) => `<div class="order-item"><div><b class="${o.side === 'buy' ? 'up' : 'down'}">${o.side.toUpperCase()}</b> ${esc(o.symbol)} <span class="pill">${o.type}</span><div class="dim num" style="font-size:12px">${fmtAmt(o.amount)} @ ${fmtPrice(o.price)}${o.stopPrice ? ` · trigger ${fmtPrice(o.stopPrice)}` : ''}</div></div><button class="btn sm" data-cancel="${esc(o.id)}" data-sym="${esc(o.symbol)}">Cancel</button></div>`).join('') : '<div class="empty">No open orders</div>';
      L.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = async () => {
        try { await api(`/api/order/${encodeURIComponent(b.dataset.cancel)}${qs({ ex: mode === 'paper' ? 'paper' : app.S.ex, symbol: b.dataset.sym })}`, { method: 'DELETE', body: {} }); toast('Canceled', 'ok'); loadList(); loadBalance(); } catch (e) { toast(e.message, 'err'); }
      }));
    } catch (e) { L.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  return {
    async show(opts = {}) {
      if (opts.side) side = opts.side;
      if (opts.price) { P.value = opts.price; priceTouched = true; if (type === 'market') type = 'limit'; }
      if (opts.symbolChanged) { P.value = ''; A.value = ''; T.value = ''; priceTouched = false; $('#tr-group', el).innerHTML = ''; ob = null; }
      paint();
      await Promise.all([loadTicker(), loadBook(), loadBalance()]);
      loadList();
      timers.forEach(clearInterval);
      timers = [setInterval(loadBook, 1500), setInterval(loadTicker, 4000), setInterval(() => !document.hidden && loadList(), 8000)];
    },
    hide() { timers.forEach(clearInterval); timers = []; },
  };
}
