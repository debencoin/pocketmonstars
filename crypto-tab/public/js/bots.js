// Bots: list, create (with AI auto-fill + backtest), detail (chart, stats, trades),
// pause / edit / resume, AI tune with one-tap apply, stop (keep or sell), duplicate.
import { api, qs, conn } from './api.js';
import { ChartView } from './chart.js';
import { STRATEGIES, defaultsFor, backtest, normalizeParams } from '/shared/strategies.mjs';
import { optimize, suggestGrid } from '/shared/optimizer.mjs';
import { runMeter, gridLinesForStep } from './meter.js';
import { helpFor, STORY, ctxFor } from '/shared/fieldhelp.mjs';
import { COINS, MAIN_COIN, presetFor } from '/shared/presets.mjs';
import { $, esc, fmtPrice, fmtAmt, fmtPct, fmtUsd, cls, store, sheet, haptic, toast, confirmSheet, fieldsHtml, readFields, wireToggles, ago } from './ui.js';

const ICONS = { pumpgrid: '🚀', grid: '▦', dca: '⬇', stepgrid: '⟋', bb: '◎', emacross: '✕', rsi: '∿', gain: '⤓', supertrend: '⇗', macd: '≋' };
const tfSec = (tf) => parseInt(tf, 10) * ({ m: 60, h: 3600, d: 86400, w: 604800 }[tf.replace(/\d+/g, '')] || 60);

export function botsScreen(el, app) {
  let bots = [], filter = 'all', timer = null, detailId = null, detailCv = null;

  async function load() {
    if (conn.demo) { bots = []; return renderList(); }
    try { bots = await api('/api/bots'); } catch (e) { if (e.status !== 401) toast(e.message, 'err'); }
    detailId ? renderDetail() : renderList();
  }

  function summary() {
    const live = bots.filter((b) => b.status !== 'stopped');
    const pnl = bots.reduce((s, b) => s + (b.stats.pnl || 0), 0);
    const inv = live.reduce((s, b) => s + (b.stats.investment || 0), 0);
    return { pnl, inv, running: bots.filter((b) => b.status === 'running').length };
  }

  function rangeBar(b) {
    if (b.type !== 'grid' || !b.levels) return '';
    const lo = b.levels[0], hi = b.levels[b.levels.length - 1], p = b.stats.price;
    const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
    const ticks = b.levels.map((l, i) => `<i class="tick ${b.slots?.[i] ? 'held' : ''}" style="left:${pos(l)}%"></i>`).join('');
    return `<div class="range-bar"><div class="track"></div>${ticks}${p ? `<i class="now" style="left:${pos(p)}%"></i>` : ''}</div><div class="range-labels"><span>${fmtPrice(lo)}</span><span>${p < lo ? '⚠ below range' : p > hi ? '⚠ above range' : `${b.slots?.filter(Boolean).length || 0}/${b.levels.length - 1} filled`}</span><span>${fmtPrice(hi)}</span></div>`;
  }

  function phasePill(b) {
    const ph = b.phase;
    if (!ph) return '';
    if (ph.mode === 'ride') return `<span class="pill up">🚀 RIDING PUMP · ${ph.lots} lots</span>`;
    if (ph.mode === 'wait') return `<span class="pill warn">⏳ WAITING FOR BOTTOM</span>`;
    return `<span class="pill accent">GRID · step ${ph.step ?? '…'}% · ${ph.lots} lots</span>`;
  }

  function phaseCard(b) {
    const ph = b.phase; if (!ph) return '';
    const what = { grid: 'Trading sideways: buys a lot every step down, sells the oldest profitable lot every step up (FIFO). Holds lots when price runs up step after step.', ride: 'Pump in progress: holding the whole bag and trailing the top. It sells everything when price drops the trail % from the high or a reversal candle prints.', wait: 'Sold the top (or dump guard). Not buying during the drop. Restarts after the bottom is confirmed by green candles.' }[ph.mode];
    return `<div class="card" style="margin-bottom:12px;border-color:${ph.mode === 'ride' ? 'var(--up)' : ph.mode === 'wait' ? 'var(--warn)' : 'var(--accent)'}">
      <div class="row between"><b>${ph.mode === 'ride' ? '🚀 Riding the pump' : ph.mode === 'wait' ? '⏳ Waiting for the bottom' : '▦ Sideways grid'}</b><span class="pill">${ph.lots} lots</span></div>
      <div class="dim" style="font-size:12px;line-height:1.45;margin:6px 0 10px">${what}</div>
      <div class="grid3"><div class="kv"><span>Step</span><span>${ph.step ?? '—'}%</span></div><div class="kv"><span>Candle swing</span><span>${ph.candlePct != null ? ph.candlePct.toFixed(3) + '%' : '—'}</span></div>
      <div class="kv"><span>${ph.mode === 'ride' ? 'Peak' : ph.mode === 'wait' ? 'Low so far' : 'Next ref'}</span><span>${fmtPrice(ph.mode === 'ride' ? ph.peak : ph.mode === 'wait' ? ph.low : ph.ref)}</span></div></div>
      ${ph.events?.length ? `<div class="label" style="margin:12px 0 4px">Bot log</div>${ph.events.slice(0, 8).map((e) => `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid var(--line)"><span class="dim">${ago(e.t)} ago</span> · ${esc(e.msg)}</div>`).join('')}` : ''}
    </div>`;
  }

  function applyMeter(root, type, row) {
    const set = (k, v) => { const i = root.querySelector(`[data-key=${k}]`); if (!i) return; if (i.hasAttribute('data-bool')) i.classList.toggle('on', !!v); else i.value = v; };
    if (type === 'pumpgrid') {
      set('timeframe', row.timeframe); set('stepPct', row.rec.step); set('dumpSell', row.dumpSell);
      toast(`Using ${row.timeframe} candles, step ${row.rec.step}%`, 'ok');
    } else {
      const lo = Number(root.querySelector('[data-key=lower]')?.value), up = Number(root.querySelector('[data-key=upper]')?.value);
      if (!(lo > 0 && up > lo)) return toast('Set the lower and upper price first', 'err');
      const n = gridLinesForStep(lo, up, row.rec.step);
      set('grids', n); set('mode', 'geometric');
      toast(`${n} lines ≈ ${row.rec.step}% apart (${row.timeframe} candle swing)`, 'ok');
    }
  }

  function card(b) {
    const s = b.stats, q = b.symbol.split('/')[1];
    return `<div class="bot-card ${b.status}" data-id="${b.id}">
      <div class="bot-title"><div><b>${ICONS[b.type] || '◆'} ${esc(b.name)}</b><div class="sub">${esc(b.symbol)} · ${esc(b.exchange)} · <span class="pill ${b.mode === 'live' ? 'down' : 'warn'}">${b.mode === 'live' ? 'LIVE' : 'PAPER'}</span> <span class="pill ${b.status === 'running' ? 'up' : b.status === 'paused' ? 'warn' : b.status === 'draft' ? 'accent' : ''}">${b.status === 'draft' ? 'draft · not started' : b.status}</span>${b.aiTuned ? ' <span class="pill accent">AI tuned</span>' : ''}${b.phase && b.status !== 'draft' ? `<div style="margin-top:6px">${phasePill(b)}</div>` : ''}</div></div>
        <div class="bot-pnl"><b class="${cls(s.pnl)}">${s.pnl >= 0 ? '+' : ''}${fmtAmt(s.pnl)} <small>${esc(q)}</small></b><small class="${cls(s.pnl)}">${fmtPct(s.pnlPct)}</small></div></div>
      ${rangeBar(b)}
      <div class="bot-stats">
        <div class="kv"><span>Invested</span><span>${fmtAmt(s.investment)}</span></div>
        <div class="kv"><span>Realized</span><span class="${cls(s.realized)}">${fmtAmt(s.realized)}</span></div>
        <div class="kv"><span>Trades</span><span>${s.trades}</span></div>
        <div class="kv"><span>APR</span><span class="${cls(s.apr)}">${s.apr == null ? '—' : fmtPct(s.apr, 0)}</span></div>
      </div>
      ${b.error ? `<div class="pill down" style="height:auto;padding:6px 8px;margin-bottom:8px;white-space:normal">${esc(b.error)}</div>` : ''}
      <div class="bot-actions">
        ${b.status === 'running' ? `<button class="btn" data-act="pause">⏸ Pause</button>` : b.status === 'paused' ? `<button class="btn buy" data-act="resume">▶ Resume</button>` : b.status === 'draft' ? `<button class="btn buy" data-act="start">▶ Start</button>` : `<button class="btn" data-act="duplicate">⧉ Copy</button>`}
        <button class="btn" data-act="edit" ${b.status === 'stopped' ? 'disabled' : ''}>✎ Edit</button>
        <button class="btn primary" data-act="ai">✦ AI</button>
        <button class="btn" data-act="open">⋯</button>
      </div></div>`;
  }

  function renderList() {
    detailCv?.destroy(); detailCv = null;
    const sm = summary();
    const list = bots.filter((b) => filter === 'all' || b.status === filter);
    el.innerHTML = `
      <div class="ai-hero" style="margin-bottom:6px">
        <div class="row between"><div><div class="label">Total bot profit</div><div class="num ${cls(sm.pnl)}" style="font-size:28px;font-weight:700">${sm.pnl >= 0 ? '+' : ''}${fmtAmt(sm.pnl)}</div><div class="muted" style="font-size:12px">${sm.running} running · ${fmtAmt(sm.inv)} allocated</div></div>
        <button class="btn primary" id="bot-new">＋ New bot</button></div>
      </div>
      <div class="chips">${['all', 'running', 'paused', 'draft', 'stopped'].map((f) => `<button class="chip ${f === filter ? 'active' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
      <div id="bot-list">${list.length ? list.map(card).join('') : `<div class="empty"><b>${conn.demo ? 'Connect your server to run bots' : 'No bots yet'}</b>${conn.demo ? 'Bots run 24/7 on your Crypto Tab server. You can still design and backtest one now.' : 'Start a grid, DCA, step grid or signal bot. You can run several grids on the same pair.'}<br><br><button class="btn primary" id="bot-new2">Create a bot</button></div>`}</div>`;
    $('#bot-new', el).onclick = () => createFlow();
    $('#bot-new2', el)?.addEventListener('click', () => createFlow());
    el.querySelector('.chips').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderList(); } };
    $('#bot-list', el).onclick = (e) => {
      const c = e.target.closest('.bot-card'); if (!c) return;
      const b = bots.find((x) => x.id === c.dataset.id);
      const act = e.target.closest('[data-act]')?.dataset.act;
      haptic();
      if (!act || act === 'open') return openDetail(b.id);
      action(b, act);
    };
  }

  async function action(b, act) {
    try {
      if (act === 'pause') { await api(`/api/bots/${b.id}/pause`, { method: 'POST', body: {} }); toast('Bot paused. Edit it, then resume.', 'ok'); }
      else if (act === 'start') { await api(`/api/bots/${b.id}/start`, { method: 'POST', body: {} }); toast('Bot started 🚀', 'ok'); }
      else if (act === 'resume') { await api(`/api/bots/${b.id}/resume`, { method: 'POST', body: {} }); toast('Bot resumed', 'ok'); }
      else if (act === 'edit') return editSheet(b);
      else if (act === 'ai') return b.status === 'draft' ? draftSheet(b) : aiTune(b);
      else if (act === 'duplicate') { await api(`/api/bots/${b.id}/duplicate`, { method: 'POST', body: {} }); toast('Copy created (paper)', 'ok'); }
      else if (act === 'stop') return stopSheet(b);
      else if (act === 'delete') { if (await confirmSheet('Delete bot?', 'Its history is removed. Coins it holds are not sold.', 'Delete', true)) { await api(`/api/bots/${b.id}`, { method: 'DELETE', body: {} }); detailId = null; toast('Deleted'); } }
      load();
    } catch (e) { toast(e.message, 'err'); }
  }

  function stopSheet(b) {
    sheet('Stop bot', (body, close) => {
      body.innerHTML = `<p class="muted" style="line-height:1.5;margin-top:0">${esc(b.name)} holds <b class="num">${fmtAmt(b.stats.base)} ${esc(b.symbol.split('/')[0])}</b>. What should happen to it?</p>
        <button class="btn sell block" data-s="1" style="margin-bottom:8px">Stop & sell coins to ${esc(b.symbol.split('/')[1])}</button>
        <button class="btn block" data-s="0">Stop & keep coins</button>`;
      body.onclick = async (e) => {
        const x = e.target.closest('[data-s]'); if (!x) return;
        try { await api(`/api/bots/${b.id}/stop`, { method: 'POST', body: { sell: x.dataset.s === '1' } }); toast('Bot stopped', 'ok'); close(); load(); } catch (er) { toast(er.message, 'err'); }
      };
    });
  }

  // ---------- edit (pause → change → resume) ----------
  function editSheet(b) {
    if (b.status === 'draft') return draftSheet(b);
    const s = STRATEGIES[b.type];
    sheet(`Edit · ${b.name}`, (body, close) => {
      body.innerHTML = `${b.status === 'running' ? '<div class="pill warn" style="margin-bottom:12px;height:auto;padding:8px 10px;white-space:normal">Tip: pause first if you want the bot to stay idle while you change it. Changes apply immediately either way.</div>' : ''}
        <div class="field"><label>Name</label><input class="input" data-name value="${esc(b.name)}" style="font-family:var(--sans)"></div>
        <div id="ed-fields">${fieldsHtml(s.fields, b.params)}</div>
        ${b.type === 'grid' ? '<button class="btn block" id="ed-chart" style="margin-bottom:8px">↕ Move grid lines on the chart</button>' : ''}
        ${['grid', 'pumpgrid'].includes(b.type) ? '<button class="btn block" id="ed-meter" style="margin-bottom:8px">📏 Measure candle % on every timeframe</button>' : ''}
        <div class="grid2"><button class="btn" id="ed-bt">Backtest</button><button class="btn primary" id="ed-save">${b.status === 'paused' ? 'Save & resume' : 'Save changes'}</button></div>
        <div id="ed-out"></div>`;
      wireToggles(body);
      wireHelp($('#ed-fields', body), () => ({ type: b.type, exchange: b.exchange, symbol: b.symbol }));
      $('#ed-chart', body)?.addEventListener('click', () => { close(); openDetail(b.id, true); });
      $('#ed-meter', body)?.addEventListener('click', () => runMeter(body.querySelector('#ed-out'), { ...app, S: { ...app.S, ex: b.exchange, symbol: b.symbol } }, readFields(body), (row) => applyMeter(body, b.type, row)));
      $('#ed-bt', body).onclick = () => runBacktest(body.querySelector('#ed-out'), b.exchange, b.symbol, b.type, readFields($('#ed-fields', body)));
      $('#ed-save', body).onclick = async () => {
        try {
          await api(`/api/bots/${b.id}`, { method: 'PATCH', body: { name: body.querySelector('[data-name]').value, params: readFields($('#ed-fields', body)) } });
          if (b.status === 'paused') await api(`/api/bots/${b.id}/resume`, { method: 'POST', body: {} });
          haptic(20); toast('Bot updated', 'ok'); close(); load();
        } catch (e) { toast(e.message, 'err'); }
      };
    });
  }

  // ---------- setting help: plain words + live example + ask the AI agent ----------
  function wireHelp(root, ctx) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-help]'); if (!b) return;
      e.preventDefault(); e.stopPropagation(); haptic();
      openHelp({ ...ctx(), key: b.dataset.help, formRoot: root });
    });
  }

  async function priceOf(ex, symbol) {
    if (app.last?.s === symbol && app.last?.p) return app.last.p;
    try { return (await api(`/api/ticker${qs({ ex, symbol })}`)).p; } catch { return null; }
  }

  function setField(root, key, value) {
    const i = root.querySelector(`[data-key="${key}"]`); if (!i) return;
    if (i.hasAttribute('data-bool')) i.classList.toggle('on', value === true || value === 'true');
    else i.value = value;
  }

  function openHelp({ type, key, exchange, symbol, formRoot }) {
    const h = helpFor(type, key);
    const label = STRATEGIES[type].fields.find((f) => f[0] === key)?.[1] || key;
    if (!h) return;
    sheet(label, async (body, close) => {
      const px = (await priceOf(exchange, symbol)) || 1;
      const x = ctxFor(px, symbol, readFields(formRoot));
      const coin = symbol.split('/')[0];
      body.innerHTML = `<p class="help-what">${esc(h.what)}</p>
        <div class="help-ex"><b>EXAMPLE WITH ${esc(coin)} AT ${esc(x.px(px))}</b>${esc(h.example(x))}</div>
        <div id="hp-ai"><button class="btn primary block" id="hp-ask">✦ Ask the AI agent what to use for ${esc(coin)}</button></div>`;
      $('#hp-ask', body).onclick = async () => {
        const box = $('#hp-ai', body);
        if (conn.demo) { box.innerHTML = '<div class="help-ai dim">The AI agent needs your Crypto Tab server (Settings).</div>'; return; }
        box.innerHTML = '<div class="help-ai"><span class="spinner"></span> Measuring ' + esc(coin) + ' candles and checking the numbers…</div>';
        try {
          const r = await api('/api/ai/explain', { method: 'POST', body: { exchange, symbol, type, key, params: readFields(formRoot) } });
          box.innerHTML = `<div class="help-ai">
            ${r.model !== 'quant engine' ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.5">${esc(r.what)}</p><div class="help-ex" style="margin-bottom:10px">${esc(r.example)}</div>` : ''}
            ${r.suggested != null && r.suggested !== '' ? `<div class="label">Suggested for ${esc(coin)}</div><div class="num" style="font-size:26px;font-weight:700;margin:2px 0 6px">${esc(r.suggested)}</div>` : ''}
            ${r.reason ? `<div style="font-size:13px;line-height:1.5;color:var(--fg-2)">${esc(r.reason)}</div>` : ''}
            ${r.suggested != null && r.suggested !== '' ? `<button class="btn primary block" id="hp-use" style="margin-top:12px">Use ${esc(r.suggested)}</button>` : ''}
            <div class="dim" style="font-size:10px;margin-top:8px">Agent: ${esc(r.model)}</div></div>`;
          $('#hp-use', box)?.addEventListener('click', () => { setField(formRoot, key, r.suggested); haptic(20); toast(`${label}: ${r.suggested}`, 'ok'); close(); });
        } catch (e) { box.innerHTML = `<div class="help-ai down">${esc(e.message)}</div>`; }
      };
    });
  }

  // Measured profile for any token (server caches it 6 h). Falls back to the built-in presets.
  const profileCache = new Map();
  async function profileFor(exchange, symbol) {
    const k = `${exchange}|${symbol}`;
    if (profileCache.has(k)) return profileCache.get(k);
    if (conn.demo) return null;
    const p = api('/api/ai/profile', { method: 'POST', body: { exchange, symbol } }).catch(() => null);
    profileCache.set(k, p);
    return p;
  }

  function profileHtml(pr) {
    if (!pr) return '';
    const good = pr.verdict === 'good fit';
    return `<div class="card" style="margin-bottom:12px;border-color:${good ? 'var(--up)' : 'var(--warn)'}">
      <div class="row between"><b>📏 ${esc(pr.symbol.split('/')[0])} measured profile</b><span class="pill ${good ? 'up' : 'warn'}">${esc(pr.verdict)}</span></div>
      <div style="font-size:13px;line-height:1.5;color:var(--fg-2);margin-top:6px">${esc(pr.note)}</div>
      <div class="dim" style="font-size:11px;margin-top:6px">Settings below were filled from this profile. Change anything you like.</div></div>`;
  }

  function storyHtml(type, symbol, params, px) {
    const st = STORY[type]; if (!st) return '';
    const x = ctxFor(px || 1, symbol, params);
    const pre = type === 'pumpgrid' ? presetFor(symbol) : null;
    return `<div class="card story" style="margin-bottom:12px"><b>How it works with ${esc(x.base)}</b>${px ? '' : ' <span class="spinner" style="width:12px;height:12px"></span>'}
      <ol>${st(x).map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${pre ? `<div class="pill accent" style="height:auto;padding:8px 10px;white-space:normal;margin-top:10px;line-height:1.45;display:block">${x.base === MAIN_COIN ? '★ Main coin · ' : ''}${esc(pre.note)}</div>` : ''}
      <div class="dim" style="font-size:11px;margin-top:8px">Tap <span class="info-btn" style="display:inline-block;width:18px;height:18px;line-height:18px;font-size:10px;text-align:center">i</span> next to any setting for a plain explanation and the agent's suggestion.</div></div>`;
  }

  function coinRowHtml(symbol) {
    const cur = symbol.split('/')[0];
    const other = !COINS.includes(cur) ? `<button class="chip active" data-any>${esc(cur)}</button>` : '';
    return `<div class="coin-row">${COINS.map((c) => `<button class="chip ${c === MAIN_COIN ? 'main' : ''} ${c === cur ? 'active' : ''}" data-coin="${c}">${c === MAIN_COIN ? '★ ' : ''}${c}</button>`).join('')}${other}<button class="chip" data-any>＋ Any token</button></div>`;
  }

  async function switchCoin(ex, coin, currentSymbol) {
    const quote = currentSymbol.split('/')[1] || 'USDT';
    for (const q of [quote, 'USDT', 'USD', 'USDC']) {
      const sym = `${coin}/${q}`;
      try { await api(`/api/ticker${qs({ ex, symbol: sym })}`); return sym; } catch { /* try next quote */ }
    }
    toast(`${coin} is not listed on ${ex}. Try MEXC, OKX, KuCoin or Gate.io.`, 'err');
    return null;
  }

  // ---------- drafts: every setting (coin, exchange, bot type, paper/live) editable before start ----------
  function draftSheet(b) {
    let type = b.type, symbol = b.symbol, mode = b.mode;
    sheet(`Draft · ${b.name}`, (body, close) => {
      const draw = async (params = b.params) => {
        const px = await priceOf(b.exchange, symbol);
        body.innerHTML = `<div class="pill" style="margin-bottom:12px;height:auto;padding:8px 10px;white-space:normal;background:rgba(34,211,238,.12);color:var(--accent-2)">Not started yet: change anything, then press Start.</div>
          ${coinRowHtml(symbol)}
          <div class="row between" style="margin-bottom:12px"><span class="ch-pair">${esc(symbol)} <small>${esc(b.exchange)}</small></span>
            <div class="seg" id="df-mode"><button data-m="paper" class="${mode === 'paper' ? 'active' : ''}">Paper</button><button data-m="live" class="${mode === 'live' ? 'active' : ''}">Live</button></div></div>
          <div class="field"><label>Bot type</label><select class="input" id="df-type">${Object.entries(STRATEGIES).map(([k, x]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>
          ${storyHtml(type, symbol, params, px)}
          <div class="field"><label>Name</label><input class="input" data-name value="${esc(b.name)}" style="font-family:var(--sans)"></div>
          <div id="df-fields">${fieldsHtml(STRATEGIES[type].fields, params)}</div>
          ${['grid', 'pumpgrid'].includes(type) ? '<button class="btn block" id="df-meter" style="margin-bottom:8px">📏 Measure candle % on every timeframe</button>' : ''}
          <div class="grid2" style="margin-bottom:8px"><button class="btn" id="df-bt">Backtest</button><button class="btn" id="df-save">Save draft</button></div>
          <button class="btn buy block" id="df-start" style="height:52px">▶ Save & start bot</button>
          <div id="df-out"></div>`;
        wireToggles(body);
        const F = $('#df-fields', body);
        wireHelp(F, () => ({ type, exchange: b.exchange, symbol }));
        const useSymbol = async (sym) => {
          symbol = sym; haptic();
          let pre = null;
          if (type === 'pumpgrid') { toast(`Measuring ${sym.split('/')[0]}…`); pre = (await profileFor(b.exchange, sym))?.params || presetFor(sym)?.params; }
          draw({ ...readFields(F), ...(pre || {}) });
        };
        body.querySelector('.coin-row').onclick = async (e) => {
          if (e.target.closest('[data-any]')) {
            const keepS = app.S.symbol, keepE = app.S.ex;
            app.set({ ex: b.exchange });
            return app.pickSymbol(() => { const sym = app.S.symbol; app.set({ ex: keepE, symbol: keepS }); useSymbol(sym); });
          }
          const c = e.target.closest('[data-coin]'); if (!c) return;
          const sym = await switchCoin(b.exchange, c.dataset.coin, symbol); if (!sym) return;
          useSymbol(sym);
        };
        $('#df-type', body).onchange = (e) => { type = e.target.value; draw({ ...defaultsFor(type), ...(type === 'pumpgrid' ? presetFor(symbol)?.params : {}) }); };
        $('#df-mode', body).onclick = (e) => { const x = e.target.closest('[data-m]'); if (!x) return; mode = x.dataset.m; body.querySelectorAll('#df-mode button').forEach((y) => y.classList.toggle('active', y === x)); };
        $('#df-meter', body)?.addEventListener('click', () => runMeter($('#df-out', body), { ...app, S: { ...app.S, ex: b.exchange, symbol } }, readFields(F), (row) => applyMeter(F, type, row)));
        $('#df-bt', body).onclick = () => runBacktest($('#df-out', body), b.exchange, symbol, type, readFields(F));
        const save = () => api(`/api/bots/${b.id}`, { method: 'PATCH', body: { name: body.querySelector('[data-name]').value, symbol, type, mode, params: readFields(F) } });
        $('#df-save', body).onclick = async () => { try { await save(); toast('Draft saved', 'ok'); close(); load(); } catch (e) { toast(e.message, 'err'); } };
        $('#df-start', body).onclick = async () => {
          if (mode === 'live' && !(await confirmSheet('Start LIVE bot?', `It will place real orders on <b>${esc(b.exchange)}</b> using up to <b>${fmtAmt(readFields(F).investment)} ${esc(symbol.split('/')[1])}</b>.`, 'Start live', true))) return;
          try { await save(); await api(`/api/bots/${b.id}/start`, { method: 'POST', body: {} }); haptic(30); toast('Bot started 🚀', 'ok'); close(); load(); } catch (e) { toast(e.message, 'err'); }
        };
      };
      draw();
    });
  }

  // ---------- AI tune ----------
  async function aiTune(b) {
    sheet(`AI review · ${b.name}`, async (body, close) => {
      body.innerHTML = '<div class="empty"><span class="spinner"></span><br><br>Backtesting settings and reading the market…</div>';
      try {
        const r = await api(`/api/ai/bot/${b.id}`, { method: 'POST', body: {} });
        const a = r.ai;
        const best = r.evidence.optimizer?.best, cur = r.evidence.optimizer?.current;
        body.innerHTML = `${verdictCard(a)}
          ${best ? `<div class="grid2" style="margin:10px 0"><div class="bt-result"><div class="label">Current settings</div><div class="num ${cls(cur?.test?.pnlPct)}" style="font-size:18px">${cur ? fmtPct(cur.test.pnlPct) : 'n/a'}</div><div class="dim" style="font-size:11px">recent ${r.evidence.timeframe} test · DD ${cur ? cur.test.maxDrawdownPct.toFixed(1) : '—'}%</div></div>
          <div class="bt-result"><div class="label">AI best</div><div class="num ${cls(best.test.pnlPct)}" style="font-size:18px">${fmtPct(best.test.pnlPct)}</div><div class="dim" style="font-size:11px">${r.evidence.optimizer.tested} combos · DD ${best.test.maxDrawdownPct.toFixed(1)}%</div></div></div>` : ''}
          <div class="label" style="margin:10px 0 6px">Proposed changes</div>
          ${a.changes.length ? a.changes.map((c) => `<div class="change-item"><code>${esc(c.key)}</code> ${esc(String(b.params[c.key] ?? '—'))} → <b class="num">${esc(c.value)}</b><div class="dim" style="font-size:12px;margin-top:3px">${esc(c.reason)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">No changes: current settings are already the best tested.</div>'}
          ${a.risks?.length ? `<div class="label" style="margin:12px 0 6px">Risks</div>${a.risks.map((x) => `<div class="muted" style="font-size:12px;margin-bottom:4px">• ${esc(x)}</div>`).join('')}` : ''}
          <div class="grid2" style="margin-top:14px"><button class="btn" id="ai-close">Not now</button><button class="btn primary" id="ai-apply" ${a.changes.length ? '' : 'disabled'}>Apply ${a.changes.length} change${a.changes.length === 1 ? '' : 's'}</button></div>
          ${a.verdict === 'pause' && b.status === 'running' ? '<button class="btn block" id="ai-pause" style="margin-top:8px">⏸ Pause bot as advised</button>' : ''}`;
        $('#ai-close', body).onclick = close;
        $('#ai-pause', body)?.addEventListener('click', async () => { await api(`/api/bots/${b.id}/pause`, { method: 'POST', body: {} }); toast('Paused'); close(); load(); });
        $('#ai-apply', body).onclick = async () => {
          const params = Object.fromEntries(a.changes.map((c) => [c.key, c.value === 'true' ? true : c.value === 'false' ? false : isNaN(Number(c.value)) ? c.value : Number(c.value)]));
          try { await api(`/api/bots/${b.id}`, { method: 'PATCH', body: { params, aiTuned: a.headline } }); haptic(25); toast('AI settings applied', 'ok'); close(); load(); } catch (e) { toast(e.message, 'err'); }
        };
      } catch (e) { body.innerHTML = `<div class="empty"><b>AI review failed</b>${esc(e.message)}</div>`; }
    });
  }

  // ---------- create ----------
  function createFlow(preset = {}) {
    let type = preset.type || 'pumpgrid';
    let mode = 'paper';
    sheet('New bot', (body, close) => {
      const draw = async (keep) => {
        const s = STRATEGIES[type];
        const coinPreset = type === 'pumpgrid' ? presetFor(app.S.symbol)?.params : null;
        const params = { ...defaultsFor(type), ...(coinPreset || {}), ...(preset.params || {}), ...(keep || {}) };
        body.innerHTML = `
          <div class="label" style="margin-bottom:8px">1 · Coin</div>
          ${coinRowHtml(app.S.symbol)}
          <div class="row between" style="margin-bottom:14px"><button class="ch-pair" id="nb-pair">${esc(app.S.symbol)} <small>${esc(app.S.ex)}</small> <span class="dim">▾</span></button>
            <div class="seg" id="nb-mode"><button data-m="paper" class="${mode === 'paper' ? 'active' : ''}">Paper</button><button data-m="live" class="${mode === 'live' ? 'active' : ''}">Live</button></div></div>
          <div class="label" style="margin-bottom:8px">2 · Bot</div>
          <div class="strat-grid">${[['pumpgrid', STRATEGIES.pumpgrid], ...Object.entries(STRATEGIES).filter(([k]) => k !== 'pumpgrid')].map(([k, x]) => `<button class="strat ${k === type ? 'active' : ''}" data-type="${k}"><span class="ico">${ICONS[k]}</span><b>${esc(x.label)}</b><span>${esc(x.desc.split('.')[0])}.</span></button>`).join('')}</div>
          <hr class="sep">
          <div id="nb-profile"></div>
          <div id="nb-story">${storyHtml(type, app.S.symbol, params, app.last?.s === app.S.symbol ? app.last.p : null)}</div>
          <div class="label" style="margin-bottom:8px">3 · Settings <span class="dim" style="text-transform:none;letter-spacing:0">(all editable, now and after saving)</span></div>
          <div class="field"><label>Name</label><input class="input" id="nb-name" style="font-family:var(--sans)" placeholder="${esc(s.label)} ${esc(app.S.symbol)}"></div>
          <div id="nb-fields">${fieldsHtml(s.fields, params)}</div>
          ${['grid', 'pumpgrid'].includes(type) ? '<button class="btn block" id="nb-meter" style="margin-bottom:8px">📏 Measure candle % on every timeframe</button>' : ''}
          <button class="btn block primary" id="nb-ai" style="margin-bottom:8px">✦ AI auto-fill best settings</button>
          <div class="grid2" style="margin-bottom:8px"><button class="btn" id="nb-bt">Backtest</button><button class="btn" id="nb-draft">Save as draft</button></div>
          <button class="btn buy block" id="nb-go" style="height:52px">▶ Start bot</button>
          <div id="nb-out"></div>`;
        wireToggles(body);
        const F = $('#nb-fields', body);
        wireHelp(F, () => ({ type, exchange: app.S.ex, symbol: app.S.symbol }));
        // measured profile for this token (any token): fills the settings once per coin
        if (type === 'pumpgrid' && !keep && !preset.params) {
          const box = $('#nb-profile', body);
          box.innerHTML = `<div class="card" style="margin-bottom:12px"><span class="spinner"></span> Measuring ${esc(app.S.symbol.split('/')[0])} candles on every timeframe…</div>`;
          const sym = app.S.symbol;
          profileFor(app.S.ex, sym).then((pr) => {
            if (!pr || app.S.symbol !== sym || !document.body.contains(box)) { if (box) box.innerHTML = ''; return; }
            box.innerHTML = profileHtml(pr);
            for (const [k, v] of Object.entries(pr.params)) setField(F, k, v);
            const st = $('#nb-story', body); if (st) st.innerHTML = storyHtml(type, sym, readFields(F), app.last?.s === sym ? app.last.p : null);
          });
        }
        // live price for the story
        if (!(app.last?.s === app.S.symbol)) priceOf(app.S.ex, app.S.symbol).then((px) => { const st = $('#nb-story', body); if (px && st) st.innerHTML = storyHtml(type, app.S.symbol, readFields(F), px); });
        body.querySelector('.coin-row').onclick = async (e) => {
          if (e.target.closest('[data-any]')) return app.pickSymbol(() => { preset = { type }; draw(); });
          const c = e.target.closest('[data-coin]'); if (!c) return;
          const sym = await switchCoin(app.S.ex, c.dataset.coin, app.S.symbol); if (!sym) return;
          app.set({ symbol: sym }); haptic(); preset = { type }; draw();
        };
        body.querySelector('.strat-grid').onclick = (e) => { const b = e.target.closest('[data-type]'); if (b) { type = b.dataset.type; preset = {}; haptic(); draw(); } };
        $('#nb-mode', body).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; body.querySelectorAll('#nb-mode button').forEach((x) => x.classList.toggle('active', x === b)); if (mode === 'live') toast('Live bots trade real funds with your API key', 'err'); };
        $('#nb-pair', body).onclick = () => app.pickSymbol(() => draw(readFields(F)));
        if (type === 'grid' && params.lower == null) autoGrid(body);
        $('#nb-ai', body).onclick = () => aiFill(body, type);
        $('#nb-meter', body)?.addEventListener('click', () => runMeter($('#nb-out', body), app, readFields(F), (row) => applyMeter(F, type, row)));
        $('#nb-bt', body).onclick = () => runBacktest($('#nb-out', body), app.S.ex, app.S.symbol, type, readFields(F));
        const create = async (start) => {
          if (conn.demo) return toast('Connect your Crypto Tab server (Settings) to save and run bots', 'err');
          const params = readFields(F);
          if (start && mode === 'live' && !(await confirmSheet('Start LIVE bot?', `It will place real orders on <b>${esc(app.S.ex)}</b> using up to <b>${fmtAmt(params.investment)} ${esc(app.S.symbol.split('/')[1])}</b>.`, 'Start live', true))) return;
          try {
            await api('/api/bots', { method: 'POST', body: { name: $('#nb-name', body).value || undefined, type, exchange: app.S.ex, symbol: app.S.symbol, mode, params, start } });
            haptic(30); toast(start ? 'Bot started 🚀' : 'Draft saved. Edit it any time, then press Start.', 'ok'); close(); load();
          } catch (e) { toast(e.message, 'err'); }
        };
        $('#nb-go', body).onclick = () => create(true);
        $('#nb-draft', body).onclick = () => create(false);
      };
      draw();
    });
  }

  async function candlesFor(ex, symbol, tf) { return api(`/api/ohlcv${qs({ ex, symbol, tf, limit: 1000 })}`); }

  async function autoGrid(body) {
    try {
      const c = await candlesFor(app.S.ex, app.S.symbol, '1h');
      const inv = Number(body.querySelector('[data-key=investment]')?.value) || 500;
      const g = suggestGrid(c, '1h', inv);
      for (const k of ['lower', 'upper', 'grids']) { const i = body.querySelector(`[data-key=${k}]`); if (i && !i.value) i.value = g[k]; }
    } catch { /* leave blank */ }
  }

  async function aiFill(body, type) {
    const out = $('#nb-out', body);
    out.innerHTML = '<div class="bt-result"><span class="spinner"></span> Testing settings on real history…</div>';
    const params = readFields($('#nb-fields', body));
    try {
      let best, ai = null;
      if (!conn.demo) {
        const r = await api('/api/ai/draft', { method: 'POST', body: { exchange: app.S.ex, symbol: app.S.symbol, type, params } });
        ai = r.ai; best = r.evidence.optimizer?.best;
        for (const c of ai.changes || []) { const i = body.querySelector(`[data-key=${c.key}]`); if (i) i.value = c.value; }
      } else {
        const tf = params.timeframe || '1h';
        const o = await optimize(type, params, await candlesFor(app.S.ex, app.S.symbol, tf), { tf });
        best = o.best;
      }
      if (best && (!ai || !ai.changes?.length)) for (const [k, v] of Object.entries(best.params)) { const i = body.querySelector(`[data-key=${k}]`); if (i && k !== 'investment') { if (i.hasAttribute('data-bool')) i.classList.toggle('on', !!v); else i.value = v; } }
      out.innerHTML = (ai ? verdictCard(ai) : '') + (best ? btCard(best.test, 'AI settings on recent data') : '<div class="bt-result">Not enough history to optimize.</div>');
      haptic(20);
    } catch (e) { out.innerHTML = `<div class="bt-result down">${esc(e.message)}</div>`; }
  }

  async function runBacktest(out, ex, symbol, type, params) {
    out.innerHTML = '<div class="bt-result"><span class="spinner"></span> Backtesting…</div>';
    try {
      const tf = params.timeframe || '1h';
      const c = await candlesFor(ex, symbol, tf);
      const r = await backtest(type, normalizeParams(type, { ...defaultsFor(type), ...params }), c);
      out.innerHTML = btCard(r, `${r.days.toFixed(0)} days of ${tf} candles`);
    } catch (e) { out.innerHTML = `<div class="bt-result down">${esc(e.message)}</div>`; }
  }

  function btCard(r, title) {
    return `<div class="bt-result"><div class="label">${esc(title)}</div>
      <div class="grid3" style="margin-top:8px">
        <div class="kv"><span>Return</span><span class="${cls(r.pnlPct)}">${fmtPct(r.pnlPct)}</span></div>
        <div class="kv"><span>Buy & hold</span><span class="${cls(r.buyHoldPct)}">${fmtPct(r.buyHoldPct)}</span></div>
        <div class="kv"><span>Max DD</span><span class="down">-${r.maxDrawdownPct.toFixed(1)}%</span></div>
        <div class="kv"><span>Round trips</span><span>${r.roundTrips}</span></div>
        <div class="kv"><span>Win rate</span><span>${r.winRate.toFixed(0)}%</span></div>
        <div class="kv"><span>Fees</span><span>${fmtAmt(r.fees)}</span></div>
      </div>${r.stopped ? `<div class="dim" style="font-size:11px;margin-top:6px">Stopped: ${esc(r.stopped)}</div>` : ''}</div>`;
  }

  // ---------- detail ----------
  async function openDetail(id, editOnChart = false) {
    detailId = id;
    const b = bots.find((x) => x.id === id);
    if (!b) return;
    el.innerHTML = `
      <div class="row between" style="padding:8px 12px"><button class="btn sm" id="bd-back">‹ Bots</button><b>${esc(b.name)}</b><button class="btn sm" id="bd-more">⋯</button></div>
      <div class="ch-wrap" style="height:42vh;min-height:280px"><div class="chart-host" id="bd-chart"></div><div class="legend" id="bd-legend"></div><button class="lock-btn" id="bd-lock"></button></div>
      <div id="bd-edit" class="pad" hidden></div>
      <div id="bd-body" class="pad"></div>`;
    $('#bd-back', el).onclick = () => { detailId = null; renderList(); };
    $('#bd-more', el).onclick = () => sheet('Bot actions', (body, close) => {
      body.innerHTML = ['pause:⏸ Pause', 'resume:▶ Resume', 'edit:✎ Edit settings', 'ai:✦ AI review & tune', 'duplicate:⧉ Duplicate as paper', 'stop:■ Stop', 'delete:🗑 Delete'].map((x) => { const [a, l] = x.split(':'); return `<button class="btn block" style="margin-bottom:8px" data-a="${a}">${l}</button>`; }).join('');
      body.onclick = (e) => { const x = e.target.closest('[data-a]'); if (x) { close(); action(bots.find((y) => y.id === id), x.dataset.a); } };
    });
    detailCv = new ChartView($('#bd-chart', el), { onLegend: (h) => ($('#bd-legend', el).innerHTML = h) });
    await detailCv.init();
    // Lock / unlock the bot's lines. Unlocked by default; remembered per bot once you lock it.
    const lockKey = `lineLock:${id}`;
    const paintLock = () => { const on = detailCv.draw.locked; const btn = $('#bd-lock', el); btn.className = `lock-btn ${on ? 'on' : ''}`; btn.innerHTML = on ? '🔒 Locked' : '🔓 Unlocked'; };
    detailCv.draw.setLocked(store.get(lockKey, false));
    detailCv.draw.onLockedTouch = () => toast('Lines are locked. Tap 🔒 to unlock and move them.');
    paintLock();
    $('#bd-lock', el).onclick = () => { const v = !detailCv.draw.locked; detailCv.draw.setLocked(v); store.set(lockKey, v); paintLock(); haptic(25); toast(v ? 'Lines locked: they cannot be moved by accident' : 'Lines unlocked: drag to move', 'ok'); };
    const tf = b.params.timeframe || '1h';
    try { detailCv.setData(await candlesFor(b.exchange, b.symbol, tf), tfSec(tf)); detailCv.fit(); } catch (e) { toast(e.message, 'err'); }
    renderDetail();
    if (editOnChart && b.type === 'grid') chartEdit(b);
  }

  // Edit a grid on the chart while it runs: drag any line. Each release is applied to the
  // running bot immediately (no pause needed); open positions keep their place.
  function chartEdit(b) {
    const box = $('#bd-edit', el);
    let lv = [...(b.levels || [])];
    if (lv.length < 2) return toast('This bot has no grid lines yet', 'err');
    let mode = store.get('gridDragMode', 'line');
    let orig = null, saving = false;
    const geo = b.params.mode === 'geometric';
    box.hidden = false;
    box.innerHTML = `<div class="card" style="border-color:var(--accent)">
      <div class="row between"><b>Drag any grid line</b><span class="pill ${b.status === 'running' ? 'up' : 'warn'}" id="ge-state">${b.status === 'running' ? 'LIVE · updates instantly' : 'paused'}</span></div>
      <div class="seg" id="ge-mode" style="margin:10px 0"><button data-m="line">One line</button><button data-m="stretch">Stretch range</button><button data-m="shift">Shift all</button></div>
      <div class="dim" id="ge-help" style="font-size:12px;line-height:1.45;margin-bottom:10px"></div>
      <div class="grid3" id="ge-info" style="margin-bottom:10px"></div>
      <div class="row" style="gap:8px"><input class="input" id="ge-n" inputmode="numeric" value="${lv.length}" style="width:90px"><button class="btn sm" id="ge-respace" style="flex:1;height:46px">Respace evenly</button></div>
      <button class="btn primary block" id="ge-done" style="margin-top:10px">Done</button></div>`;
    const help = { line: 'Move a single buy/sell level. The bot uses the new price on its next tick.', stretch: 'Drag the top or bottom (purple) line to widen or narrow the range. Every line in between rescales.', shift: 'Drag any line to slide the whole grid up or down. Spacing stays the same.' };
    const paintMode = () => { box.querySelectorAll('#ge-mode button').forEach((x) => x.classList.toggle('active', x.dataset.m === mode)); $('#ge-help', box).textContent = help[mode]; };
    const info = () => {
      const s = [...lv].sort((x, y) => x - y);
      const gaps = s.slice(1).map((v, i) => (v / s[i] - 1) * 100);
      const minGap = Math.min(...gaps);
      $('#ge-info', box).innerHTML = `<div class="kv"><span>Lower</span><span>${fmtPrice(s[0])}</span></div><div class="kv"><span>Upper</span><span>${fmtPrice(s[s.length - 1])}</span></div><div class="kv"><span>Min step</span><span class="${minGap < 0.25 ? 'down' : ''}">${minGap.toFixed(2)}%</span></div>${minGap < 0.25 ? '<div class="down" style="grid-column:1/-1;font-size:11px">Two lines are closer than ~0.25%: trades between them lose money to fees.</div>' : ''}`;
    };
    const color = (i) => (i === 0 || i === lv.length - 1 ? '#7c5cff' : b.slots?.[i] ? '#00d68f' : '#ff3b5c');
    const setLines = () => {
      detailCv.setPriceLines([]);
      detailCv.draw.setBotLines(lv.map((price, i) => ({ key: i, price, color: color(i), label: i === lv.length - 1 ? 'UPPER' : i === 0 ? 'LOWER' : '', onDrag, onDrop })));
      info();
    };
    const remap = (x, oLo, oHi, lo, hi) => (geo ? Math.exp(Math.log(lo) + ((Math.log(x) - Math.log(oLo)) * (Math.log(hi) - Math.log(lo))) / (Math.log(oHi) - Math.log(oLo))) : lo + ((x - oLo) * (hi - lo)) / (oHi - oLo));
    function onDrag(p, d) {
      if (!orig) orig = [...lv];
      const i = d.key, n = orig.length - 1;
      if (mode === 'shift') {
        const r = p / orig[i];
        lv = orig.map((x) => x * r);
      } else if (mode === 'stretch' && (i === 0 || i === n)) {
        const lo = i === 0 ? Math.min(p, orig[n] * 0.995) : orig[0];
        const hi = i === n ? Math.max(p, orig[0] * 1.005) : orig[n];
        lv = orig.map((x) => remap(x, orig[0], orig[n], lo, hi));
      } else {
        // one line: stay between its neighbours
        const below = i > 0 ? lv[i - 1] * 1.0005 : 0, above = i < n ? lv[i + 1] * 0.9995 : Infinity;
        lv[i] = Math.min(Math.max(p, below), above);
      }
      detailCv.draw.moveBotLines(Object.fromEntries(lv.map((v, k) => [k, v])));
      info();
    }
    async function onDrop() {
      orig = null;
      lv = lv.map((v) => +v.toPrecision(8)).sort((x, y) => x - y);
      setLines();
      if (saving) return;
      saving = true;
      $('#ge-state', box).textContent = 'saving…';
      try {
        const nb = await api(`/api/bots/${b.id}`, { method: 'PATCH', body: { params: { levels: lv } } });
        Object.assign(b, nb);
        lv = [...nb.levels];
        setLines();
        $('#ge-state', box).textContent = b.status === 'running' ? 'LIVE · updated ✓' : 'saved ✓';
        haptic(20);
      } catch (e) { toast(e.message, 'err'); $('#ge-state', box).textContent = 'not saved'; }
      saving = false;
    }
    $('#ge-mode', box).onclick = (e) => { const x = e.target.closest('[data-m]'); if (!x) return; mode = x.dataset.m; store.set('gridDragMode', mode); paintMode(); haptic(); };
    $('#ge-respace', box).onclick = async () => {
      const n = Math.max(2, Math.min(200, Number($('#ge-n', box).value) || lv.length));
      try {
        const nb = await api(`/api/bots/${b.id}`, { method: 'PATCH', body: { params: { levels: null, lower: lv[0], upper: lv[lv.length - 1], grids: n } } });
        Object.assign(b, nb); lv = [...nb.levels]; setLines(); toast(`${n} evenly spaced lines applied`, 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };
    $('#ge-done', box).onclick = () => { box.hidden = true; detailCv.draw.setBotLines([]); load(); };
    paintMode();
    setLines();
    // frame the whole grid so every line can be reached
    detailCv.main.applyOptions({ autoscaleInfoProvider: (base) => { const r = base(); if (!r || box.hidden) return r; return { priceRange: { minValue: Math.min(r.priceRange.minValue, lv[0] * 0.995), maxValue: Math.max(r.priceRange.maxValue, lv[lv.length - 1] * 1.005) } }; } });
    toast('Touch a line and drag it. The bot updates when you let go.');
  }

  // Pump Rider: its live lines sit on the chart and can be dragged at any time.
  // Dropping a line tells the running bot to act at exactly that price.
  function syncPumpLines(b) {
    const L = b.lines, draw = detailCv?.draw;
    if (!L || !draw || draw.botDrag) return;
    const send = async (body, msg) => {
      try { const nb = await api(`/api/bots/${b.id}/lines`, { method: 'POST', body }); Object.assign(b, nb); toast(msg, 'ok'); haptic(20); syncPumpLines(b); renderDetail(); }
      catch (e) { toast(e.message, 'err'); load(); }
    };
    const mk = (key, price, color, label, onDrop) => ({ key, price, color, label, onDrop, onDrag: () => {} });
    const P = () => b.stats.price;
    const lines = [];
    if (L.nextBuy) lines.push(mk('buy', L.nextBuy.price, '#00d68f', `${L.nextBuy.manual ? '✋ ' : ''}NEXT BUY`, (v) => send({ nextBuy: v }, v >= P() ? `Above the market: buys on the next tick at ≤ ${fmtPrice(v)}` : `Next buy set to ${fmtPrice(v)}`)));
    if (L.nextSell) lines.push(mk('sell', L.nextSell.price, '#ff3b5c', `${L.nextSell.manual ? '✋ ' : ''}NEXT SELL`, (v) => send({ nextSell: v }, v <= P() ? `Below the market: sells the oldest lot on the next tick` : `Next sell set to ${fmtPrice(v)}`)));
    L.lots.forEach((l, i) => lines.push(mk(`lot:${l.id}`, l.target, l.manual ? '#ffb020' : 'rgba(255,176,32,.55)', l.manual ? `✋ LOT ${i + 1}` : '', (v) => send({ lot: { id: l.id, target: v } }, `Lot ${i + 1} (bought ${fmtPrice(l.entry)}) will sell at ${fmtPrice(v)}${v < l.entry ? ' (below its cost)' : ''}`))));
    if (L.stop) lines.push(mk('stop', L.stop.price, '#ff3b5c', `${L.stop.manual ? '✋ ' : ''}SELL BAG`, (v) => send({ stopPrice: v }, v >= P() ? 'Above the market: sells the bag on the next tick' : `Bag sells if price drops to ${fmtPrice(v)}`)));
    if (L.restart) lines.push(mk('restart', L.restart.price, '#22d3ee', `${L.restart.manual ? '✋ ' : ''}RESTART`, (v) => send({ restart: v }, `Grid restarts when price ${v < P() ? 'drops' : 'rises'} to ${fmtPrice(v)}`)));
    const keys = lines.map((l) => l.key).join('|');
    const onChart = draw.items.filter((d) => d.bot).map((d) => d.key).join('|');
    if (onChart === keys) draw.moveBotLines(Object.fromEntries(lines.map((l) => [l.key, l.price])));
    else draw.setBotLines(lines);
    // keep the labels/handlers current (manual flags change)
    for (const d of draw.items) { const l = lines.find((x) => x.key === d.key); if (d.bot && l) { d.label = l.label; d.color = l.color; d.onDrop = l.onDrop; } }
    draw.dirty();
  }

  function linesCard(b) {
    const L = b.lines; if (!L) return '';
    const manual = [L.nextBuy?.manual && 'next buy', L.nextSell?.manual && 'next sell', L.stop?.manual && 'sell bag', L.restart?.manual && 'restart', ...L.lots.filter((l) => l.manual).map((l, i) => `lot ${i + 1}`)].filter(Boolean);
    return `<div class="card" style="margin-bottom:12px"><div class="row between"><b>↕ Move the lines on the chart</b>${manual.length ? '<button class="btn sm" data-a="resetlines">Reset to auto</button>' : ''}</div>
      <div class="dim" style="font-size:12px;line-height:1.5;margin-top:6px">Touch a line and drag it up or down. The running bot then trades at exactly that price: <span class="up">NEXT BUY</span>, <span class="down">NEXT SELL</span>, <span style="color:var(--warn)">each lot's sell</span>${L.stop ? ', <span class="down">SELL BAG</span>' : ''}${L.restart ? ', <span style="color:var(--accent-2)">RESTART</span>' : ''}. ✋ marks lines you set${manual.length ? `: ${esc(manual.join(', '))}` : ''}.</div></div>`;
  }

  function renderDetail() {
    const b = bots.find((x) => x.id === detailId);
    if (!b || !detailCv) return;
    const s = b.stats, [bs, q] = b.symbol.split('/');
    if (b.levels && $('#bd-edit', el).hidden) detailCv.setPriceLines(b.levels.map((l, i) => ({ price: l, color: b.slots?.[i] ? 'rgba(0,214,143,.55)' : 'rgba(255,59,92,.45)', style: 2, label: i === 0 || i === b.levels.length - 1 })));
    if (b.deal?.cost && b.deal?.amount) detailCv.setPriceLines([{ price: b.deal.cost / b.deal.amount, color: '#f5c542', title: 'Avg entry', style: 0 }]);
    if (b.type === 'pumpgrid') syncPumpLines(b);
    const trades = b.trades || [];
    $('#bd-body', el).innerHTML = `
      <div class="row between"><div><span class="pill ${b.status === 'running' ? 'up' : b.status === 'paused' ? 'warn' : ''}">${b.status}</span> <span class="pill ${b.mode === 'live' ? 'down' : 'warn'}">${b.mode}</span> <span class="dim" style="font-size:12px">${esc(b.label)} · ${s.runtimeH.toFixed(1)}h</span></div>
        <div class="bot-pnl"><b class="${cls(s.pnl)}">${s.pnl >= 0 ? '+' : ''}${fmtAmt(s.pnl)} ${esc(q)}</b><small class="${cls(s.pnl)}">${fmtPct(s.pnlPct)}</small></div></div>
      ${b.type === 'grid' ? rangeBar(b) : ''}
      ${phaseCard(b)}
      ${linesCard(b)}
      <div class="grid3" style="margin:12px 0">
        <div class="kv"><span>Equity</span><span>${fmtAmt(s.equity)}</span></div><div class="kv"><span>Realized</span><span class="${cls(s.realized)}">${fmtAmt(s.realized)}</span></div><div class="kv"><span>Fees</span><span>${fmtAmt(s.fees)}</span></div>
        <div class="kv"><span>${esc(bs)} held</span><span>${fmtAmt(s.base)}</span></div><div class="kv"><span>${esc(q)} free</span><span>${fmtAmt(s.quote)}</span></div><div class="kv"><span>Max DD</span><span>${s.maxDrawdownPct.toFixed(2)}%</span></div>
        <div class="kv"><span>Trades</span><span>${s.trades}</span></div><div class="kv"><span>Wins</span><span>${s.wins}</span></div><div class="kv"><span>APR</span><span class="${cls(s.apr)}">${s.apr == null ? '—' : fmtPct(s.apr, 0)}</span></div>
      </div>
      <div class="bot-actions" style="margin-bottom:14px">
        ${b.status === 'running' ? '<button class="btn" data-a="pause">⏸ Pause</button>' : b.status === 'paused' ? '<button class="btn buy" data-a="resume">▶ Resume</button>' : b.status === 'draft' ? '<button class="btn buy" data-a="start">▶ Start</button>' : '<button class="btn" data-a="duplicate">⧉ Copy</button>'}
        <button class="btn" data-a="${b.type === 'grid' && b.status !== 'draft' ? 'chart' : 'edit'}" ${b.status === 'stopped' ? 'disabled' : ''}>✎ Edit</button>
        <button class="btn primary" data-a="ai">✦ AI</button>
        <button class="btn sell" data-a="${b.status === 'draft' ? 'delete' : 'stop'}" ${b.status === 'stopped' ? 'disabled' : ''}>${b.status === 'draft' ? '🗑 Delete' : '■ Stop'}</button>
      </div>
      ${b.type === 'grid' ? '<button class="btn block sm" data-a="edit" style="margin-bottom:12px">All settings</button>' : ''}
      <div class="label">Settings</div>
      <div class="grid2" style="margin:8px 0 14px">${Object.entries(b.params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(typeof v === 'number' ? +v.toPrecision(8) : v)}</span></div>`).join('')}</div>
      <div class="label">Trades</div>
      ${trades.length ? trades.map((t) => `<div class="trade-row"><span class="side ${t.side === 'buy' ? 'up' : 'down'}">${t.side}</span><div><span class="num">${fmtAmt(t.amount)} @ ${fmtPrice(t.price)}</span><div class="dim">${esc(t.tag)} · ${ago(t.time)} ago</div></div><span class="num ${cls(t.pnl)}">${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + fmtAmt(t.pnl) : ''}</span></div>`).join('') : '<div class="muted" style="font-size:13px;padding:12px 0">No trades yet</div>'}`;
    $('#bd-body', el).onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      haptic();
      if (a === 'chart') return b.type === 'pumpgrid' ? toast('Drag the lines on the chart above') : chartEdit(b);
      if (a === 'resetlines') return api(`/api/bots/${b.id}/lines`, { method: 'POST', body: { reset: true } }).then(() => { toast('Lines back to automatic', 'ok'); load(); }).catch((e) => toast(e.message, 'err'));
      action(b, a);
    };
  }

  function verdictCard(a) {
    const color = { keep: 'var(--up)', adjust: 'var(--accent)', start: 'var(--up)', wait: 'var(--warn)', pause: 'var(--warn)', stop: 'var(--down)' }[a.verdict] || 'var(--accent)';
    return `<div class="card" style="border-color:${color}"><div class="verdict"><div class="score-ring" style="background:conic-gradient(${color} ${(a.confidence || 0) * 3.6}deg,var(--bg-3) 0)"><div style="width:44px;height:44px;border-radius:50%;background:var(--bg-1);display:grid;place-items:center;font-size:13px">${a.confidence ?? '—'}</div></div>
      <div><div class="pill" style="color:${color}">${esc(a.verdict?.toUpperCase())}</div><div style="font-weight:700;margin-top:4px">${esc(a.headline)}</div></div></div>
      <p style="margin:0;font-size:13px;line-height:1.5;color:var(--fg-2)">${esc(a.summary)}</p>
      <div style="margin-top:10px;font-size:13px"><div class="zone buy"><span>Entry</span><span>${esc(a.entry_zone)}</span></div><div class="zone sell" style="margin:0"><span>Exit</span><span>${esc(a.exit_zone)}</span></div></div>
      <div class="dim" style="font-size:10px;margin-top:8px">Analyst: ${esc(a.model || 'quant engine')}${a.error ? ` · Claude unavailable: ${esc(a.error)}` : ''}</div></div>`;
  }

  return {
    async show(opts = {}) {
      await load();
      if (opts.create) createFlow(opts.create);
      if (opts.review) { const b = bots.find((x) => x.id === opts.review); if (b) aiTune(b); }
      clearInterval(timer);
      timer = setInterval(() => !document.hidden && load(), 5000);
    },
    hide() { clearInterval(timer); },
    onEvent(kind, data) { if (kind === 'bot' || kind === 'trade') load(); void data; },
    verdictCard,
    createFlow,
    get detailChart() { return detailCv; },
  };
}
