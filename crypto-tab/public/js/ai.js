// AI desk: token analysis with entry/exit ranges, market scanner, bot reviews.
import { api, qs, conn } from './api.js';
import { zones } from '/shared/optimizer.mjs';
import { forecast } from '/shared/forecast.mjs';
import { $, esc, fmtPrice, fmtPct, fmtAmt, cls, haptic, toast, store } from './ui.js';

const tfSec = (tf) => parseInt(tf, 10) * ({ m: 60, h: 3600, d: 86400, w: 604800 }[tf.replace(/\d+/g, '')] || 60);

export function aiScreen(el, app) {
  let tf = store.get('aiTf', '1h');

  el.innerHTML = `
    <div class="ai-hero">
      <h2>✦ AI Trading Desk</h2>
      <p id="ai-who">A technical analyst, a risk manager and a head trader review every idea. It backtests settings on real history before suggesting them, and gives you ranges to get in and get out.</p>
    </div>
    <div class="pad" style="padding-top:0">
      <div class="row between" style="margin-bottom:10px"><button class="ch-pair" id="ai-pair"></button>
        <div class="seg" id="ai-tf">${['15m', '1h', '4h', '1d'].map((t) => `<button data-tf="${t}" class="${t === tf ? 'active' : ''}">${t}</button>`).join('')}</div></div>
      <button class="btn primary block" id="ai-go" style="height:54px">✦ Analyze entry & exit</button>
      <div id="ai-out" style="margin-top:12px"></div>
    </div>
    <div class="section-title"><span>Opportunity scanner</span><button class="btn sm" id="ai-scan">Scan ${esc(app.S.ex)}</button></div>
    <div id="ai-scan-out" class="muted" style="padding:0 12px;font-size:13px">Ranks the most liquid pairs by entry quality, risk/reward and forecast. Pairs marked GRID suit a grid bot.</div>
    <div class="section-title"><span>Bot reviews</span></div>
    <div id="ai-bots" style="padding:0 12px"></div>`;

  $('#ai-tf', el).onclick = (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tf = b.dataset.tf; store.set('aiTf', tf); el.querySelectorAll('#ai-tf button').forEach((x) => x.classList.toggle('active', x === b)); };
  $('#ai-pair', el).onclick = () => app.pickSymbol(() => paint());
  $('#ai-go', el).onclick = analyze;
  $('#ai-scan', el).onclick = scan;

  function paint() {
    $('#ai-pair', el).innerHTML = `${esc(app.S.symbol)} <small>${esc(app.S.ex)}</small> <span class="dim">▾</span>`;
    $('#ai-scan', el).textContent = `Scan ${app.S.ex}`;
    const s = conn.ai;
    $('#ai-who', el).innerHTML = `A technical analyst, a risk manager and a head trader review every idea. It backtests settings on real history before suggesting them.<br><span class="pill ${s?.claude ? 'accent' : 'warn'}" style="margin-top:8px">${s?.claude ? `Claude · ${esc(s.model)}` : conn.demo ? 'Demo · in-browser quant engine' : 'Quant engine (Claude: set ANTHROPIC_API_KEY)'}</span>`;
  }

  async function analyze() {
    const out = $('#ai-out', el);
    out.innerHTML = '<div class="card"><span class="spinner"></span> Reading the chart, levels and forecast…</div>';
    haptic();
    try {
      let a, ev;
      if (!conn.demo) {
        const r = await api('/api/ai/symbol', { method: 'POST', body: { exchange: app.S.ex, symbol: app.S.symbol, tf } });
        a = r.ai; ev = r.evidence;
      } else {
        const c = await api(`/api/ohlcv${qs({ ex: app.S.ex, symbol: app.S.symbol, tf, limit: 1000 })}`);
        const z = zones(c, tf); const f = forecast(c, tfSec(tf), 30);
        ev = { stats: z.stats, levels: z.levels, zones: z, forecast: f };
        a = { verdict: z.score >= 65 ? 'start' : 'wait', confidence: z.score, headline: z.verdict, summary: `${z.stats.regime}, RSI ${z.stats.rsi?.toFixed(1)}. Forecast ${f.bias} ${fmtPct(f.expectedMovePct)} over 30 bars.`, entry_zone: `${fmtPrice(z.buyZone[0])} - ${fmtPrice(z.buyZone[1])}`, exit_zone: `${fmtPrice(z.sellZone[0])} - ${fmtPrice(z.sellZone[1])}`, risks: ['Demo data. Results are not guaranteed.'], changes: [], model: 'in-browser quant engine' };
      }
      const z = ev.zones, s = ev.stats, ref = s.price;
      out.innerHTML = app.views.bots.verdictCard(a) + `
        <div class="card">
          <div class="zone buy"><span>Buy zone</span><span>${fmtPrice(z.buyZone[0], ref)} – ${fmtPrice(z.buyZone[1], ref)}</span></div>
          <div class="zone sell"><span>Take profit</span><span>${fmtPrice(z.sellZone[0], ref)} – ${fmtPrice(z.sellZone[1], ref)}</span></div>
          <div class="zone stop"><span>Stop loss</span><span>${fmtPrice(z.stop, ref)}</span></div>
          <div class="grid3" style="margin-top:10px">
            <div class="kv"><span>Regime</span><span style="font-size:12px">${esc(s.regime)}</span></div>
            <div class="kv"><span>RSI</span><span>${s.rsi?.toFixed(1)}</span></div>
            <div class="kv"><span>Daily vol</span><span>${s.dailyVolPct?.toFixed(2)}%</span></div>
            <div class="kv"><span>R:R</span><span>${z.riskReward}</span></div>
            <div class="kv"><span>Forecast</span><span class="${cls(ev.forecast.expectedMovePct)}">${fmtPct(ev.forecast.expectedMovePct)}</span></div>
            <div class="kv"><span>Range</span><span style="font-size:11px">${fmtPct(ev.forecast.rangePct[0], 1)} / ${fmtPct(ev.forecast.rangePct[1], 1)}</span></div>
          </div>
          ${a.risks?.length ? `<div style="margin-top:10px">${a.risks.map((x) => `<div class="muted" style="font-size:12px">• ${esc(x)}</div>`).join('')}</div>` : ''}
          <div class="grid3" style="margin-top:12px"><button class="btn sm" id="ai-chart">Chart</button><button class="btn sm" id="ai-alert">🔔 Alert</button><button class="btn sm primary" id="ai-bot">Grid bot</button></div>
        </div>`;
      $('#ai-chart', out).onclick = () => app.go('chart');
      $('#ai-alert', out).onclick = () => app.newAlert({ price: z.buyZone[1], condition: 'below', note: 'AI buy zone' });
      $('#ai-bot', out).onclick = () => app.go('bots', { create: { type: 'grid', params: { lower: +(z.buyZone[0] * 0.98).toPrecision(6), upper: +(z.sellZone[1]).toPrecision(6) } } });
    } catch (e) { out.innerHTML = `<div class="card down">${esc(e.message)}</div>`; }
  }

  async function scan() {
    const out = $('#ai-scan-out', el);
    if (conn.demo) { out.innerHTML = 'The scanner needs your Crypto Tab server.'; return; }
    out.innerHTML = '<div class="card"><span class="spinner"></span> Scanning the top pairs (about 15 seconds)…</div>';
    try {
      const quote = app.S.symbol.split('/')[1];
      const r = await api('/api/ai/scan', { method: 'POST', body: { exchange: app.S.ex, quote, top: 25, tf } });
      out.innerHTML = r.results.length ? r.results.map((x) => `<div class="scan-row" data-s="${esc(x.symbol)}">
        <div><b>${esc(x.symbol)}</b> ${x.gridFit ? '<span class="pill accent">GRID</span>' : ''} <span class="pill ${x.bias === 'bullish' ? 'up' : x.bias === 'bearish' ? 'down' : ''}">${esc(x.bias)}</span>
          <div class="dim num" style="font-size:11px;margin-top:3px">Buy ${fmtPrice(x.buyZone[0])}–${fmtPrice(x.buyZone[1])} · TP ${fmtPrice(x.sellZone[1])} · R:R ${x.riskReward}</div>
          <div class="dim" style="font-size:11px">${esc(x.regime)} · RSI ${x.rsi?.toFixed(0)} · ${esc(x.verdict)}</div></div>
        <div style="text-align:right"><div class="num" style="font-size:18px;font-weight:700;color:${x.score >= 65 ? 'var(--up)' : x.score >= 45 ? 'var(--warn)' : 'var(--down)'}">${x.score}</div><div class="num ${cls(x.change24h)}" style="font-size:11px">${fmtPct(x.change24h)}</div></div></div>`).join('') : 'No results';
      out.onclick = (e) => { const row = e.target.closest('[data-s]'); if (row) { app.set({ symbol: row.dataset.s }); paint(); analyze(); el.scrollTo({ top: 0, behavior: 'smooth' }); } };
    } catch (e) { out.innerHTML = `<div class="card down">${esc(e.message)}</div>`; }
  }

  async function bots() {
    const box = $('#ai-bots', el);
    if (conn.demo) { box.innerHTML = '<div class="muted" style="font-size:13px">Bots run on your server.</div>'; return; }
    try {
      const list = (await api('/api/bots')).filter((b) => b.status !== 'stopped');
      box.innerHTML = list.length ? list.map((b) => `<div class="card row between"><div><b>${esc(b.name)}</b><div class="dim" style="font-size:12px">${esc(b.symbol)} · <span class="${cls(b.stats.pnl)}">${fmtPct(b.stats.pnlPct)}</span>${b.aiTuned ? ' · AI tuned' : ''}</div></div><button class="btn sm primary" data-id="${b.id}">Review</button></div>`).join('') : '<div class="muted" style="font-size:13px">No active bots to review.</div>';
      box.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) app.go('bots', { review: b.dataset.id }); };
    } catch { box.innerHTML = ''; }
  }

  return {
    show(opts = {}) { paint(); bots(); if (opts.analyze) analyze(); },
    hide() {},
  };
}

export { fmtAmt };
