// Chart screen: pro chart + timeframes + indicators + drawing tools + future forecast,
// with order book / trades / AI levels underneath and one-tap Buy / Sell.
import { api, qs, conn } from './api.js';
import { ChartView, CHART_TYPES } from './chart.js';
import { TOOLS, COLORS } from './drawings.js';
import { INDICATORS } from '/shared/indicators.mjs';
import { renderBook, renderTrades } from './book.js';
import { $, esc, fmtPrice, fmtAmt, fmtPct, store, sheet, haptic, toast, fmtDateTime, tzShort } from './ui.js';

const TFS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const tfSec = (tf) => parseInt(tf, 10) * ({ m: 60, h: 3600, d: 86400, w: 604800, M: 2592000 }[tf.replace(/\d+/g, '')] || 60);
const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${d}"/></svg>`;

export function chartScreen(el, app) {
  let cv = null, timers = [], tick = null, below = store.get('chBelow', 'book');
  let showFc = store.get('forecast', true);
  let showNews = store.get('newsMarkers', true), newsMarks = [];
  let showTrades = store.get('tradeMarkers', true);
  let ob = null, trades = null;

  el.innerHTML = `
    <div class="ch-head">
      <div>
        <button class="ch-pair" id="ch-pair"><span id="ch-sym">—</span> <small id="ch-ex"></small> <span class="dim">▾</span></button>
        <div class="ch-price num" id="ch-price">—</div>
        <div class="num" style="font-size:13px" id="ch-chg"></div>
      </div>
      <div class="ch-stats" id="ch-stats"></div>
    </div>
    <div class="ch-tools" id="ch-tfs">${TFS.map((t) => `<button class="tf" data-tf="${t}">${t}</button>`).join('')}
      <span style="flex:1"></span>
      <button class="tool-btn" id="t-type" title="Chart type">${ICON('M7 3v18M5 7h4v8H5zM17 3v18M15 9h4v6h-4z')}</button>
      <button class="tool-btn" id="t-ind" title="Indicators">${ICON('M3 17l5-6 4 4 8-10')}<span>fx</span></button>
      <button class="tool-btn" id="t-draw" title="Drawing tools">${ICON('M4 20l4-1L19 8l-3-3L5 16zM14 6l3 3')}</button>
      <button class="tool-btn ${showFc ? 'active' : ''}" id="t-fc" title="Future forecast">${ICON('M3 17l6-6 4 4 4-8M17 7h4v4')}<span>Future</span></button>
      <button class="tool-btn ${showTrades ? 'active' : ''}" id="t-trades" title="My buys and sells"><span style="color:var(--up)">▲</span><span style="color:var(--down)">▼</span></button>
      <button class="tool-btn ${showNews ? 'active' : ''}" id="t-news" title="News and herd moves on chart">📰</button>
      <button class="tool-btn" id="t-full" title="Fullscreen">${ICON('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>
    </div>
    <div class="ch-wrap" id="ch-wrap">
      <div class="chart-host" id="chart-host"></div>
      <div class="legend" id="ch-legend"></div>
      <div class="draw-bar" id="draw-bar" hidden></div>
      <div class="sel-bar" id="sel-bar" hidden></div>
      <div class="fc-badge" id="fc-badge" hidden></div>
    </div>
    <div class="seg" style="margin:10px 12px" id="ch-below">
      <button data-b="book">Order book</button><button data-b="trades">Trades</button><button data-b="ai">AI levels</button><button data-b="info">Info</button>
    </div>
    <div class="below-tabs" id="ch-below-body"></div>
    <div style="height:72px"></div>
    <div class="ch-actions">
      <button class="btn" id="ch-alert" title="Price alert">🔔</button>
      <button class="btn buy" id="ch-buy">Buy</button>
      <button class="btn sell" id="ch-sell">Sell</button>
    </div>`;

  const host = $('#chart-host', el), legend = $('#ch-legend', el), drawBar = $('#draw-bar', el), selBar = $('#sel-bar', el), body = $('#ch-below-body', el);

  async function ensureChart() {
    if (cv) return cv;
    cv = new ChartView(host, { onLegend: (h) => (legend.innerHTML = h), storageKey: () => `${app.S.ex}:${app.S.symbol}` });
    await cv.init();
    cv.type = store.get('chartType', 'candles'); cv.makeMain();
    cv.indicators = store.get('indicators', [{ id: 'MA' }, { id: 'VOL' }, { id: 'MACD' }]);
    cv.draw.onChange(() => renderDrawUI());
    // tap a candle that has news: show those articles and what the price did after them
    cv.chart.subscribeClick((p) => {
      if (!showNews || !p?.time || cv.draw.tool || !newsMarks.length) return;
      const step = cv.tfSec;
      const here = newsMarks.filter((n) => Math.floor(n.time / step) * step === p.time);
      if (!here.length) return;
      const bar = cv.candles.find((k) => k.time === p.time);
      const lastC = cv.candles[cv.candles.length - 1].close;
      sheet(`${here.length} news · ${app.S.symbol.split('/')[0]}`, (b) => {
        b.innerHTML = here.map((n) => `<div class="news-item" style="margin:0 0 8px;border-left-color:${n.label === 'bullish' ? 'var(--up)' : n.label === 'bearish' ? 'var(--down)' : 'var(--line-2)'}"><div class="dim" style="font-size:11px">${esc(n.source)} · ${fmtDateTime(n.time * 1000)} ${tzShort()}</div><a class="news-title" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div>`).join('')
          + (bar ? `<div class="card" style="font-size:13px">Price at that candle ${fmtPrice(bar.close)} → now ${fmtPrice(lastC)} (<span class="${lastC >= bar.close ? 'up' : 'down'}">${fmtPct(((lastC - bar.close) / bar.close) * 100)}</span>)</div>` : '');
      });
    });
    cv.draw.setLocked(store.get('drawLock', false));
    cv.draw.onLockedTouch = () => toast('Drawings are locked (🔒 in the drawing bar)');
    return cv;
  }

  async function load() {
    const { ex, symbol, tf } = app.S;
    $('#ch-sym', el).textContent = symbol;
    $('#ch-ex', el).textContent = (app.exchanges?.find((x) => x.id === ex)?.name) || ex;
    el.querySelectorAll('.tf').forEach((b) => b.classList.toggle('active', b.dataset.tf === tf));
    await ensureChart();
    try {
      const candles = await api(`/api/ohlcv${qs({ ex, symbol, tf, limit: 1000 })}`);
      if (!candles.length) throw new Error('No price history for this pair');
      cv.setData(candles, tfSec(tf));
      cv.fit();
      loadForecast();
      loadNewsMarkers();
      loadTradeMarkers();
    } catch (e) { toast(e.message, 'err'); }
    refreshTicker();
  }

  async function loadForecast() {
    const badge = $('#fc-badge', el);
    if (!showFc) { cv.setForecast(null); badge.hidden = true; return; }
    try {
      const fc = await api(`/api/forecast${qs({ ex: app.S.ex, symbol: app.S.symbol, tf: app.S.tf, h: 30 })}`);
      cv.setForecast(fc);
      badge.hidden = false;
      badge.innerHTML = `🔮 ${esc(fc.model)} · ${fc.horizon} bars · <span class="${fc.expectedMovePct >= 0 ? 'up' : 'down'}">${fmtPct(fc.expectedMovePct)}</span>`;
    } catch {
      // demo / offline: compute in the browser with the same shared code
      const { forecast } = await import('/shared/forecast.mjs');
      const fc = forecast(cv.candles, cv.tfSec, 30);
      cv.setForecast(fc);
      badge.hidden = false;
      badge.innerHTML = `🔮 ${fc.model} · <span class="${fc.expectedMovePct >= 0 ? 'up' : 'down'}">${fmtPct(fc.expectedMovePct)}</span>`;
    }
  }

  // News on the chart: an arrow on every candle where news about this token came out.
  async function loadNewsMarkers() {
    if (!cv) return;
    if (!showNews) { cv.setMarkerSet('news', []); cv.setMarkerSet('herd', []); return; }
    try {
      const base = app.S.symbol.split('/')[0];
      newsMarks = await api(`/api/news/markers${qs({ token: base, from: cv.candles[0]?.time })}`);
      const step = cv.tfSec, byBar = new Map();
      for (const n of newsMarks) {
        const t = Math.floor(n.time / step) * step;
        if (t < cv.candles[0].time || t > cv.candles[cv.candles.length - 1].time) continue;
        const cur = byBar.get(t);
        if (!cur || n.importance > cur.importance || (cur.label === 'neutral' && n.label !== 'neutral')) byBar.set(t, { ...n, count: (cur?.count || 0) + 1 }); else cur.count++;
      }
      const marks = [...byBar.entries()].sort((a, b) => a[0] - b[0]).map(([t, n]) => n.label === 'bullish'
        ? { time: t, position: 'belowBar', color: '#00d68f', shape: 'arrowUp', text: n.count > 1 ? `📰${n.count}` : '📰' }
        : n.label === 'bearish' ? { time: t, position: 'aboveBar', color: '#ff3b5c', shape: 'arrowDown', text: n.count > 1 ? `📰${n.count}` : '📰' }
          : { time: t, position: 'aboveBar', color: '#858b97', shape: 'circle', text: '' });
      cv.setMarkerSet('news', marks);
      // herd moves this token took part in (⚡ purple)
      const evs = await api(`/api/herd/events${qs({ token: base, days: 8 })}`).catch(() => []);
      cv.setMarkerSet('herd', evs.map((e) => { const bar = cv.barFor(Math.floor(e.time / 1000)); return bar && { time: bar.time, position: e.dir === 'pump' ? 'belowBar' : 'aboveBar', shape: 'circle', color: '#a78bfa', text: `⚡${Math.round(e.breadth * 100)}%` }; }).filter(Boolean));
    } catch { /* news offline */ }
  }

  async function loadTradeMarkers() {
    if (!cv?.candles.length) return;
    if (!showTrades || conn.demo || !store.get('token')) { cv.setMarkerSet('trades', []); return; }
    try { cv.setMarkerSet('trades', cv.tradeMarkers(await api(`/api/fills${qs({ ex: app.S.ex, symbol: app.S.symbol })}`, { quiet: true }))); } catch { /* not logged in */ }
  }

  async function refreshTicker() {
    try {
      const t = await api(`/api/ticker${qs({ ex: app.S.ex, symbol: app.S.symbol })}`);
      app.last = t;
      const pe = $('#ch-price', el);
      pe.textContent = fmtPrice(t.p);
      pe.className = `ch-price num ${t.c >= 0 ? 'up' : 'down'}`;
      $('#ch-chg', el).innerHTML = `<span class="${t.c >= 0 ? 'up' : 'down'}">${fmtPct(t.c)}</span>`;
      $('#ch-stats', el).innerHTML = `<span>24h High</span><b>${fmtPrice(t.h, t.p)}</b><span>24h Low</span><b>${fmtPrice(t.l, t.p)}</b><span>24h Vol</span><b>${fmtAmt(t.v)}</b>`;
    } catch { /* keep last */ }
  }

  async function liveBar() {
    if (!cv?.candles.length || document.hidden) return;
    try {
      const c = await api(`/api/ohlcv${qs({ ex: app.S.ex, symbol: app.S.symbol, tf: app.S.tf, limit: 2 })}`);
      for (const b of c) cv.updateBar(b);
    } catch { /* transient */ }
  }

  async function loadBelow() {
    const { ex, symbol } = app.S;
    try {
      if (below === 'book') { ob = await api(`/api/book${qs({ ex, symbol, depth: 20 })}`); renderBook(body, ob, { rows: 10, last: app.last?.p, change: app.last?.c, onPrice: (p) => app.go('trade', { price: p }) }); }
      else if (below === 'trades') { trades = await api(`/api/trades${qs({ ex, symbol })}`); renderTrades(body, trades, app.last?.p); }
    } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function renderAiLevels() {
    body.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    const { zones } = await import('/shared/optimizer.mjs');
    const z = zones(cv.candles, app.S.tf);
    const ref = z.stats.price;
    body.innerHTML = `<div class="card">
      <div class="verdict"><div class="score-ring" style="background:conic-gradient(var(--accent) ${z.score * 3.6}deg,var(--bg-3) 0)"><div style="width:44px;height:44px;border-radius:50%;background:var(--bg-1);display:grid;place-items:center">${z.score}</div></div>
      <div><b>${esc(z.verdict)}</b><div class="muted" style="font-size:12px">${esc(z.stats.regime)} · RSI ${z.stats.rsi?.toFixed(1)} · R:R ${z.riskReward}</div></div></div>
      <div class="zone buy"><span>Buy zone</span><span>${fmtPrice(z.buyZone[0], ref)} – ${fmtPrice(z.buyZone[1], ref)}</span></div>
      <div class="zone sell"><span>Take profit</span><span>${fmtPrice(z.sellZone[0], ref)} – ${fmtPrice(z.sellZone[1], ref)}</span></div>
      <div class="zone stop"><span>Stop</span><span>${fmtPrice(z.stop, ref)}</span></div>
      <div class="label" style="margin:12px 0 6px">Support / resistance</div>
      ${z.levels.map((l) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px"><span class="${l.kind === 'support' ? 'up' : 'down'}">${l.kind}</span><span class="num">${fmtPrice(l.price, ref)}</span><span class="dim">${l.touches} touches</span></div>`).join('')}
      <div class="grid2" style="margin-top:12px"><button class="btn sm" id="z-lines">Show on chart</button><button class="btn sm primary" id="z-ai">Full AI analysis</button></div>
    </div>`;
    $('#z-lines', body).onclick = () => {
      cv.setPriceLines([
        { price: z.buyZone[0], color: '#00d68f', title: 'Buy', style: 2 }, { price: z.buyZone[1], color: '#00d68f', title: '', style: 2 },
        { price: z.sellZone[0], color: '#ff3b5c', title: 'TP', style: 2 }, { price: z.sellZone[1], color: '#ff3b5c', title: '', style: 2 },
        { price: z.stop, color: '#ffb020', title: 'Stop', style: 1 },
      ]);
      haptic(); toast('Zones drawn on the chart');
    };
    $('#z-ai', body).onclick = () => app.go('ai', { analyze: true });
  }

  function renderInfo() {
    const m = app.marketCache?.find((x) => x.s === app.S.symbol);
    body.innerHTML = `<div class="card"><div class="grid2">
      <div class="kv"><span>Exchange</span><span>${esc(app.S.ex)}</span></div><div class="kv"><span>Pair</span><span>${esc(app.S.symbol)}</span></div>
      <div class="kv"><span>Last</span><span>${fmtPrice(app.last?.p)}</span></div><div class="kv"><span>24h</span><span class="${(app.last?.c ?? 0) >= 0 ? 'up' : 'down'}">${fmtPct(app.last?.c)}</span></div>
      <div class="kv"><span>Bid</span><span>${fmtPrice(app.last?.bid)}</span></div><div class="kv"><span>Ask</span><span>${fmtPrice(app.last?.ask)}</span></div>
      <div class="kv"><span>Min order</span><span>${m?.min ?? '—'} ${esc(m?.q || '')}</span></div><div class="kv"><span>Type</span><span>${m?.st ? 'Tokenized stock' : 'Crypto spot'}</span></div>
    </div></div>`;
  }

  function setBelow(b) {
    below = b; store.set('chBelow', b);
    el.querySelectorAll('#ch-below button').forEach((x) => x.classList.toggle('active', x.dataset.b === b));
    if (b === 'ai') renderAiLevels(); else if (b === 'info') renderInfo(); else loadBelow();
  }

  // ---------- toolbar ----------
  $('#ch-tfs', el).onclick = (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; haptic(); app.set({ tf: b.dataset.tf }); load(); };
  $('#ch-pair', el).onclick = () => app.pickSymbol();
  $('#ch-below', el).onclick = (e) => { const b = e.target.closest('[data-b]'); if (b) { haptic(); setBelow(b.dataset.b); } };
  $('#ch-buy', el).onclick = () => app.go('trade', { side: 'buy' });
  $('#ch-sell', el).onclick = () => app.go('trade', { side: 'sell' });
  $('#ch-alert', el).onclick = () => app.newAlert({ price: app.last?.p });

  $('#t-type', el).onclick = () => sheet('Chart type', (b, close) => {
    b.innerHTML = CHART_TYPES.map(([k, l]) => `<button class="btn block ${cv.type === k ? 'primary' : ''}" style="margin-bottom:8px" data-t="${k}">${l}</button>`).join('');
    b.onclick = (e) => { const x = e.target.closest('[data-t]'); if (!x) return; cv.setType(x.dataset.t); store.set('chartType', x.dataset.t); cv.renderForecast(); close(); };
  });

  $('#t-ind', el).onclick = () => sheet('Indicators', (b) => {
    const active = () => new Map(cv.indicators.map((i) => [i.id, i]));
    const draw = () => {
      const a = active();
      const sec = (overlay) => Object.entries(INDICATORS).filter(([, d]) => d.overlay === overlay).map(([id, d]) => {
        const on = a.get(id);
        const params = on?.params || d.params;
        return `<div class="ind-row"><div><b>${esc(d.name)}</b>${on ? `<div class="params" style="margin-top:6px">${Object.entries(params).map(([k, v]) => `<input data-ind="${id}" data-p="${k}" value="${v}" inputmode="decimal" title="${k}">`).join('')}</div>` : ''}</div><button class="toggle ${on ? 'on' : ''}" data-tog="${id}"></button></div>`;
      }).join('');
      b.innerHTML = `<div class="label">Main chart</div>${sec(true)}<div class="label" style="margin-top:16px">Sub charts</div>${sec(false)}`;
    };
    draw();
    b.onclick = (e) => {
      const t = e.target.closest('[data-tog]'); if (!t) return;
      const id = t.dataset.tog;
      const a = active();
      if (a.has(id)) cv.indicators = cv.indicators.filter((i) => i.id !== id); else cv.indicators = [...cv.indicators, { id, params: { ...INDICATORS[id].params } }];
      store.set('indicators', cv.indicators); cv.renderIndicators(); haptic(); draw();
    };
    b.onchange = (e) => {
      const i = e.target.closest('[data-ind]'); if (!i) return;
      const ind = cv.indicators.find((x) => x.id === i.dataset.ind);
      ind.params = { ...(ind.params || INDICATORS[ind.id].params), [i.dataset.p]: Number(i.value) };
      store.set('indicators', cv.indicators); cv.renderIndicators();
    };
  });

  $('#t-draw', el).onclick = () => { drawBar.hidden = !drawBar.hidden; $('#t-draw', el).classList.toggle('active', !drawBar.hidden); if (drawBar.hidden) cv.draw.setTool(null); renderDrawUI(); };
  $('#t-fc', el).onclick = () => {
    showFc = !showFc; store.set('forecast', showFc);
    $('#t-fc', el).classList.toggle('active', showFc);
    loadForecast().then(() => showFc && cv.revealFuture());
    haptic();
  };
  $('#t-trades', el).onclick = () => { showTrades = !showTrades; store.set('tradeMarkers', showTrades); $('#t-trades', el).classList.toggle('active', showTrades); loadTradeMarkers(); haptic(); };
  $('#t-news', el).onclick = () => { showNews = !showNews; store.set('newsMarkers', showNews); $('#t-news', el).classList.toggle('active', showNews); loadNewsMarkers(); haptic(); };
  $('#t-full', el).onclick = () => { $('#ch-wrap', el).classList.toggle('full'); haptic(); };

  function renderDrawUI() {
    if (!cv) return;
    const d = cv.draw;
    drawBar.innerHTML = Object.entries(TOOLS).map(([k, [label, , path]]) => `<button data-tool="${k}" class="${d.tool === k ? 'active' : ''}" title="${label}">${ICON(path)}</button>`).join('')
      + `<button data-act="magnet" class="${d.magnet ? 'active' : ''}" title="Magnet">🧲</button><button data-act="lockall" class="${d.locked ? 'active' : ''}" title="Lock all drawings">${d.locked ? '🔒' : '🔓'}</button><button data-act="clear" title="Delete all">🗑</button>`;
    selBar.hidden = !d.sel || d.sel.bot;
    if (d.sel && !d.sel.bot) {
      selBar.innerHTML = `${COLORS.map((c) => `<button data-color="${c}" style="color:${c}">●</button>`).join('')}<button data-act="lock">${d.sel.locked ? '🔒' : '🔓'}</button><button data-act="del">🗑</button><button data-act="done">✓</button>`;
    }
  }
  drawBar.onclick = (e) => {
    const t = e.target.closest('[data-tool]'), a = e.target.closest('[data-act]');
    if (t) { haptic(); cv.draw.setTool(cv.draw.tool === t.dataset.tool ? null : t.dataset.tool); if (cv.draw.tool) toast(`${TOOLS[t.dataset.tool][0]}: ${TOOLS[t.dataset.tool][1] === 3 ? 'drag, then tap the 3rd point' : TOOLS[t.dataset.tool][1] === 1 ? 'tap to place' : 'drag on the chart'}`); }
    if (a?.dataset.act === 'magnet') cv.draw.toggleMagnet();
    if (a?.dataset.act === 'lockall') { cv.draw.setLocked(!cv.draw.locked); store.set('drawLock', cv.draw.locked); toast(cv.draw.locked ? 'Drawings locked' : 'Drawings unlocked', 'ok'); }
    if (a?.dataset.act === 'clear' && confirm('Delete all drawings on this chart?')) cv.draw.clear();
    renderDrawUI();
  };
  selBar.onclick = (e) => {
    const c = e.target.closest('[data-color]'), a = e.target.closest('[data-act]');
    if (c) cv.draw.colorSelected(c.dataset.color);
    if (a?.dataset.act === 'lock') cv.draw.lockSelected();
    if (a?.dataset.act === 'del') cv.draw.removeSelected();
    if (a?.dataset.act === 'done') cv.draw.select(null);
    renderDrawUI();
  };

  return {
    async show() {
      await load();
      setBelow(below);
      timers.forEach(clearInterval);
      timers = [
        setInterval(liveBar, 3000),
        setInterval(refreshTicker, 4000),
        setInterval(() => { if (!document.hidden && (below === 'book' || below === 'trades')) loadBelow(); }, 1800),
        setInterval(() => showFc && loadForecast(), 120000),
        setInterval(() => !document.hidden && loadTradeMarkers(), 15000),
      ];
    },
    hide() { timers.forEach(clearInterval); timers = []; clearInterval(tick); },
    get chart() { return cv; },
  };
}
