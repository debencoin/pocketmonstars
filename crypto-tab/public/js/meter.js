// Candle meter UI: measures the real % move of candles on every timeframe, proposes a grid
// step just under it, backtests each timeframe and lets the user apply the winner with one tap.
import { api, conn } from './api.js';
import { measureCandles, recommendStep, estimate, strip } from '/shared/candlemeter.mjs';
import { backtest, normalizeParams, defaultsFor } from '/shared/strategies.mjs';
import { esc, fmtPct, cls, haptic } from './ui.js';

async function localScan(app, params) {
  const fee = params.feePct ?? 0.1;
  const band = { fee, min: params.stepMin ?? 0.39, max: params.stepMax ?? 0.79 };
  const rows = [];
  for (const tf of ['1m', '5m', '15m', '30m', '1h']) {
    const candles = await api(`/api/ohlcv?ex=${encodeURIComponent(app.S.ex)}&symbol=${encodeURIComponent(app.S.symbol)}&tf=${tf}&limit=1000`);
    const m = measureCandles(candles, { recent: 500 });
    const rec = recommendStep(m, band);
    const bt = await backtest('pumpgrid', normalizeParams('pumpgrid', { ...defaultsFor('pumpgrid'), ...params, timeframe: tf, autoStep: false, stepPct: rec.step, investment: 1000 }), candles);
    rows.push({ timeframe: tf, dumpSell: false, stats: strip(m), rec, est: estimate(m, tf, rec), backtest: { ...bt, perDayPct: bt.pnlPct / Math.max(bt.days, 1 / 24) } });
  }
  return { rows, best: [...rows].sort((a, b) => b.backtest.perDayPct - a.backtest.perDayPct)[0], fee, band };
}

// Renders into `box`. onApply(row) is called when the user taps a timeframe.
export async function runMeter(box, app, params, onApply) {
  box.innerHTML = '<div class="bt-result"><span class="spinner"></span> Measuring every candle on 1m, 5m, 15m, 30m and 1h, then backtesting each…</div>';
  try {
    const r = conn.demo ? await localScan(app, params) : await api('/api/ai/candles', { method: 'POST', body: { exchange: app.S.ex, symbol: app.S.symbol, params } });
    if (!r.rows.length) { box.innerHTML = '<div class="bt-result">Not enough candle history on this exchange.</div>'; return r; }
    const best = r.best?.timeframe;
    box.innerHTML = `<div class="bt-result">
      <div class="label">Candle meter · ${esc(app.S.symbol)} · fee ${r.fee}% per fill</div>
      <div class="dim" style="font-size:11px;margin:4px 0 8px;line-height:1.45">"Swing" = how far a candle travels from low to high. The step sits just under the median swing so most candles complete a buy-low / sell-high. Tap a row to use it.</div>
      <div style="display:grid;grid-template-columns:40px 1fr 1fr 1fr 1fr;gap:4px;font-size:10px;color:var(--fg-4);font-weight:600;padding:0 4px"><span>TF</span><span>Avg swing</span><span>Step</span><span>Covers</span><span>Backtest/day</span></div>
      ${r.rows.map((x) => `<button data-tf="${x.timeframe}" style="display:grid;grid-template-columns:40px 1fr 1fr 1fr 1fr;gap:4px;width:100%;text-align:left;padding:10px 4px;border-radius:10px;margin-top:4px;font-family:var(--mono);font-size:12px;${x.timeframe === best ? 'background:rgba(124,92,255,.18);box-shadow:inset 0 0 0 1px var(--accent)' : 'background:var(--bg-3)'}">
        <b style="font-family:var(--sans)">${x.timeframe}</b><span>${x.stats.avgRange.toFixed(3)}%<br><span class="dim">med ${x.stats.medianRange.toFixed(3)}</span></span>
        <span>${x.rec.step.toFixed(3)}%${x.rec.clamped ? `<br><span class="dim" style="font-size:9px">${esc(x.rec.clamped)}</span>` : ''}</span>
        <span>${x.rec.coverage.toFixed(0)}%<br><span class="dim">${x.est.tripsPerDay.toFixed(0)} trips/d</span></span>
        <span class="${cls(x.backtest.perDayPct)}">${fmtPct(x.backtest.perDayPct)}<br><span class="dim">hold ${fmtPct(x.backtest.buyHoldPct, 1)}</span></span></button>`).join('')}
      ${r.rows.some((x) => x.rec.clamped === 'raised to beat fees' || x.rec.clamped === 'raised to your minimum') ? '<div class="dim" style="font-size:11px;margin-top:8px;line-height:1.45">⚠ On some timeframes the candles move less than your minimum step or the fees, so the bot only catches the bigger candles there. Lower "Step band min" and use a 0% maker fee exchange to scalp 1m candles.</div>' : ''}
      ${best ? `<div style="font-size:12px;margin-top:8px">Best: <b>${best}</b> at <b class="num">${r.best.rec.step}%</b>${r.best.dumpSell ? ' with “sell the bag on a dump”' : ''}. Backtests use recent history and are not guarantees.</div>` : ''}
    </div>`;
    box.querySelectorAll('[data-tf]').forEach((b) => (b.onclick = () => { haptic(15); onApply(r.rows.find((x) => x.timeframe === b.dataset.tf)); }));
    return r;
  } catch (e) { box.innerHTML = `<div class="bt-result down">${esc(e.message)}</div>`; return null; }
}

export const gridLinesForStep = (lower, upper, step) => Math.max(2, Math.min(200, Math.round(Math.log(upper / lower) / Math.log(1 + step / 100)) + 1));
