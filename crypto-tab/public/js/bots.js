// Bots: list, create (with AI auto-fill + backtest), detail (chart, stats, trades),
// pause / edit / resume, AI tune with one-tap apply, stop (keep or sell), duplicate.
import { api, qs, conn } from './api.js';
import { ChartView } from './chart.js';
import { STRATEGIES, defaultsFor, backtest, normalizeParams } from '/shared/strategies.mjs';
import { optimize, suggestGrid } from '/shared/optimizer.mjs';
import { runMeter, gridLinesForStep } from './meter.js';
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
      <div class="bot-title"><div><b>${ICONS[b.type] || '◆'} ${esc(b.name)}</b><div class="sub">${esc(b.symbol)} · ${esc(b.exchange)} · <span class="pill ${b.mode === 'live' ? 'down' : 'warn'}">${b.mode === 'live' ? 'LIVE' : 'PAPER'}</span> <span class="pill ${b.status === 'running' ? 'up' : b.status === 'paused' ? 'warn' : ''}">${b.status}</span>${b.aiTuned ? ' <span class="pill accent">AI tuned</span>' : ''}${b.phase ? `<div style="margin-top:6px">${phasePill(b)}</div>` : ''}</div></div>
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
        ${b.status === 'running' ? `<button class="btn" data-act="pause">⏸ Pause</button>` : b.status === 'paused' ? `<button class="btn buy" data-act="resume">▶ Resume</button>` : `<button class="btn" data-act="duplicate">⧉ Copy</button>`}
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
      <div class="chips">${['all', 'running', 'paused', 'stopped'].map((f) => `<button class="chip ${f === filter ? 'active' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
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
      else if (act === 'resume') { await api(`/api/bots/${b.id}/resume`, { method: 'POST', body: {} }); toast('Bot resumed', 'ok'); }
      else if (act === 'edit') return editSheet(b);
      else if (act === 'ai') return aiTune(b);
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
    const s = STRATEGIES[b.type];
    sheet(`Edit · ${b.name}`, (body, close) => {
      body.innerHTML = `${b.status === 'running' ? '<div class="pill warn" style="margin-bottom:12px;height:auto;padding:8px 10px;white-space:normal">Tip: pause first if you want the bot to stay idle while you change it. Changes apply immediately either way.</div>' : ''}
        <div class="field"><label>Name</label><input class="input" data-name value="${esc(b.name)}" style="font-family:var(--sans)"></div>
        ${fieldsHtml(s.fields, b.params)}
        ${b.type === 'grid' ? '<button class="btn block" id="ed-chart" style="margin-bottom:8px">↕ Move grid lines on the chart</button>' : ''}
        ${['grid', 'pumpgrid'].includes(b.type) ? '<button class="btn block" id="ed-meter" style="margin-bottom:8px">📏 Measure candle % on every timeframe</button>' : ''}
        <div class="grid2"><button class="btn" id="ed-bt">Backtest</button><button class="btn primary" id="ed-save">${b.status === 'paused' ? 'Save & resume' : 'Save changes'}</button></div>
        <div id="ed-out"></div>`;
      wireToggles(body);
      $('#ed-chart', body)?.addEventListener('click', () => { close(); openDetail(b.id, true); });
      $('#ed-meter', body)?.addEventListener('click', () => runMeter(body.querySelector('#ed-out'), { ...app, S: { ...app.S, ex: b.exchange, symbol: b.symbol } }, readFields(body), (row) => applyMeter(body, b.type, row)));
      $('#ed-bt', body).onclick = () => runBacktest(body.querySelector('#ed-out'), b.exchange, b.symbol, b.type, readFields(body));
      $('#ed-save', body).onclick = async () => {
        try {
          const params = readFields(body);
          await api(`/api/bots/${b.id}`, { method: 'PATCH', body: { name: body.querySelector('[data-name]').value, params } });
          if (b.status === 'paused') await api(`/api/bots/${b.id}/resume`, { method: 'POST', body: {} });
          haptic(20); toast('Bot updated', 'ok'); close(); load();
        } catch (e) { toast(e.message, 'err'); }
      };
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
      const draw = () => {
        const s = STRATEGIES[type];
        const params = { ...defaultsFor(type), ...(preset.params || {}) };
        body.innerHTML = `
          <div class="strat-grid">${[['pumpgrid', STRATEGIES.pumpgrid], ...Object.entries(STRATEGIES).filter(([k]) => k !== 'pumpgrid')].map(([k, x]) => `<button class="strat ${k === type ? 'active' : ''}" data-type="${k}"><span class="ico">${ICONS[k]}</span><b>${esc(x.label)}</b><span>${esc(x.desc.split('.')[0])}.</span></button>`).join('')}</div>
          <hr class="sep">
          <div class="row between" style="margin-bottom:12px"><button class="ch-pair" id="nb-pair">${esc(app.S.symbol)} <small>${esc(app.S.ex)}</small> <span class="dim">▾</span></button>
            <div class="seg" id="nb-mode"><button data-m="paper" class="${mode === 'paper' ? 'active' : ''}">Paper</button><button data-m="live" class="${mode === 'live' ? 'active' : ''}">Live</button></div></div>
          <p class="muted" style="font-size:12px;margin:0 0 12px;line-height:1.45">${esc(s.desc)}</p>
          <div class="field"><label>Name</label><input class="input" id="nb-name" style="font-family:var(--sans)" placeholder="${esc(s.label)} ${esc(app.S.symbol)}"></div>
          <div id="nb-fields">${fieldsHtml(s.fields, params)}</div>
          ${['grid', 'pumpgrid'].includes(type) ? '<button class="btn block" id="nb-meter" style="margin-bottom:8px">📏 Measure candle % on every timeframe</button>' : ''}
          <button class="btn block primary" id="nb-ai" style="margin-bottom:8px">✦ AI auto-fill best settings</button>
          <div class="grid2"><button class="btn" id="nb-bt">Backtest</button><button class="btn buy" id="nb-go">Start bot</button></div>
          <div id="nb-out"></div>`;
        wireToggles(body);
        body.querySelector('.strat-grid').onclick = (e) => { const b = e.target.closest('[data-type]'); if (b) { type = b.dataset.type; preset = {}; haptic(); draw(); } };
        $('#nb-mode', body).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; body.querySelectorAll('#nb-mode button').forEach((x) => x.classList.toggle('active', x === b)); if (mode === 'live') toast('Live bots trade real funds with your API key', 'err'); };
        $('#nb-pair', body).onclick = () => app.pickSymbol(() => draw());
        if (type === 'grid' && params.lower == null) autoGrid(body);
        $('#nb-ai', body).onclick = () => aiFill(body, type);
        $('#nb-meter', body)?.addEventListener('click', () => runMeter($('#nb-out', body), app, readFields($('#nb-fields', body)), (row) => applyMeter($('#nb-fields', body), type, row)));
        $('#nb-bt', body).onclick = () => runBacktest($('#nb-out', body), app.S.ex, app.S.symbol, type, readFields($('#nb-fields', body)));
        $('#nb-go', body).onclick = async () => {
          if (conn.demo) return toast('Connect your Crypto Tab server (Settings) to run bots 24/7', 'err');
          const params = readFields($('#nb-fields', body));
          if (mode === 'live' && !(await confirmSheet('Start LIVE bot?', `It will place real orders on <b>${esc(app.S.ex)}</b> using up to <b>${fmtAmt(params.investment)} ${esc(app.S.symbol.split('/')[1])}</b>.`, 'Start live', true))) return;
          try {
            await api('/api/bots', { method: 'POST', body: { name: $('#nb-name', body).value || undefined, type, exchange: app.S.ex, symbol: app.S.symbol, mode, params } });
            haptic(30); toast('Bot started 🚀', 'ok'); close(); load();
          } catch (e) { toast(e.message, 'err'); }
        };
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
      <div class="ch-wrap" style="height:42vh;min-height:280px"><div class="chart-host" id="bd-chart"></div><div class="legend" id="bd-legend"></div></div>
      <div id="bd-edit" class="pad" hidden></div>
      <div id="bd-body" class="pad"></div>`;
    $('#bd-back', el).onclick = () => { detailId = null; renderList(); };
    $('#bd-more', el).onclick = () => sheet('Bot actions', (body, close) => {
      body.innerHTML = ['pause:⏸ Pause', 'resume:▶ Resume', 'edit:✎ Edit settings', 'ai:✦ AI review & tune', 'duplicate:⧉ Duplicate as paper', 'stop:■ Stop', 'delete:🗑 Delete'].map((x) => { const [a, l] = x.split(':'); return `<button class="btn block" style="margin-bottom:8px" data-a="${a}">${l}</button>`; }).join('');
      body.onclick = (e) => { const x = e.target.closest('[data-a]'); if (x) { close(); action(bots.find((y) => y.id === id), x.dataset.a); } };
    });
    detailCv = new ChartView($('#bd-chart', el), { onLegend: (h) => ($('#bd-legend', el).innerHTML = h) });
    await detailCv.init();
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

  function renderDetail() {
    const b = bots.find((x) => x.id === detailId);
    if (!b || !detailCv) return;
    const s = b.stats, [bs, q] = b.symbol.split('/');
    if (b.levels && $('#bd-edit', el).hidden) detailCv.setPriceLines(b.levels.map((l, i) => ({ price: l, color: b.slots?.[i] ? 'rgba(0,214,143,.55)' : 'rgba(255,59,92,.45)', style: 2, label: i === 0 || i === b.levels.length - 1 })));
    if (b.deal?.cost && b.deal?.amount) detailCv.setPriceLines([{ price: b.deal.cost / b.deal.amount, color: '#f5c542', title: 'Avg entry', style: 0 }]);
    const trades = b.trades || [];
    $('#bd-body', el).innerHTML = `
      <div class="row between"><div><span class="pill ${b.status === 'running' ? 'up' : b.status === 'paused' ? 'warn' : ''}">${b.status}</span> <span class="pill ${b.mode === 'live' ? 'down' : 'warn'}">${b.mode}</span> <span class="dim" style="font-size:12px">${esc(b.label)} · ${s.runtimeH.toFixed(1)}h</span></div>
        <div class="bot-pnl"><b class="${cls(s.pnl)}">${s.pnl >= 0 ? '+' : ''}${fmtAmt(s.pnl)} ${esc(q)}</b><small class="${cls(s.pnl)}">${fmtPct(s.pnlPct)}</small></div></div>
      ${b.type === 'grid' ? rangeBar(b) : ''}
      ${phaseCard(b)}
      <div class="grid3" style="margin:12px 0">
        <div class="kv"><span>Equity</span><span>${fmtAmt(s.equity)}</span></div><div class="kv"><span>Realized</span><span class="${cls(s.realized)}">${fmtAmt(s.realized)}</span></div><div class="kv"><span>Fees</span><span>${fmtAmt(s.fees)}</span></div>
        <div class="kv"><span>${esc(bs)} held</span><span>${fmtAmt(s.base)}</span></div><div class="kv"><span>${esc(q)} free</span><span>${fmtAmt(s.quote)}</span></div><div class="kv"><span>Max DD</span><span>${s.maxDrawdownPct.toFixed(2)}%</span></div>
        <div class="kv"><span>Trades</span><span>${s.trades}</span></div><div class="kv"><span>Wins</span><span>${s.wins}</span></div><div class="kv"><span>APR</span><span class="${cls(s.apr)}">${s.apr == null ? '—' : fmtPct(s.apr, 0)}</span></div>
      </div>
      <div class="bot-actions" style="margin-bottom:14px">
        ${b.status === 'running' ? '<button class="btn" data-a="pause">⏸ Pause</button>' : b.status === 'paused' ? '<button class="btn buy" data-a="resume">▶ Resume</button>' : '<button class="btn" data-a="duplicate">⧉ Copy</button>'}
        <button class="btn" data-a="${b.type === 'grid' ? 'chart' : 'edit'}" ${b.status === 'stopped' ? 'disabled' : ''}>✎ Edit</button>
        <button class="btn primary" data-a="ai">✦ AI</button>
        <button class="btn sell" data-a="stop" ${b.status === 'stopped' ? 'disabled' : ''}>■ Stop</button>
      </div>
      ${b.type === 'grid' ? '<button class="btn block sm" data-a="edit" style="margin-bottom:12px">All settings</button>' : ''}
      <div class="label">Settings</div>
      <div class="grid2" style="margin:8px 0 14px">${Object.entries(b.params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(typeof v === 'number' ? +v.toPrecision(8) : v)}</span></div>`).join('')}</div>
      <div class="label">Trades</div>
      ${trades.length ? trades.map((t) => `<div class="trade-row"><span class="side ${t.side === 'buy' ? 'up' : 'down'}">${t.side}</span><div><span class="num">${fmtAmt(t.amount)} @ ${fmtPrice(t.price)}</span><div class="dim">${esc(t.tag)} · ${ago(t.time)} ago</div></div><span class="num ${cls(t.pnl)}">${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + fmtAmt(t.pnl) : ''}</span></div>`).join('') : '<div class="muted" style="font-size:13px;padding:12px 0">No trades yet</div>'}`;
    $('#bd-body', el).onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      haptic();
      if (a === 'chart') return chartEdit(b);
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
