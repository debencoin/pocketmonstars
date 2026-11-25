// Herd screen: which coins move together, who moves first, synchronized pumps / dumps over the
// last week (and what came after), live group moves with laggards to follow, and the agent's
// learning record.
import { api, conn } from './api.js';
import { MAIN_COIN, COINS } from '/shared/presets.mjs';
import { $, esc, fmtPct, cls, ago, haptic, toast, sheet } from './ui.js';

export function herdScreen(el, app) {
  let timer = null;

  const tokChip = (t, extra = '') => `<button class="pill ${t === MAIN_COIN ? 'warn' : COINS.includes(t) ? 'accent' : ''}" data-tok="${esc(t)}" style="height:22px;margin:2px">${t === MAIN_COIN ? '★ ' : ''}${esc(t)}${extra}</button>`;
  const pctCol = (v) => (v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');

  async function render() {
    if (conn.demo) { el.innerHTML = '<div class="empty"><b>The herd agent needs your server</b>Connect it in Settings.</div>'; return; }
    let o, evs;
    try { [o, evs] = await Promise.all([api('/api/herd'), api('/api/herd/events?days=8')]); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const A = o.analysis, L = o.learning, live = o.live || {};
    if (!A) { el.innerHTML = '<div class="empty"><span class="spinner"></span><br><br>Measuring a week of prices for the top coins (about a minute on first start)…</div>'; return; }
    const zecG = A.clusters.filter((c) => c.tokens.includes(MAIN_COIN));
    const hidden = A.clusters.filter((c) => c.hidden), market = A.clusters.filter((c) => !c.hidden);
    el.innerHTML = `
      <div class="row between" style="padding:8px 12px"><button class="btn sm" id="hd-back">‹ AI</button><b>🔗 Herd agent</b><button class="btn sm" id="hd-re">Re-analyze</button></div>
      <div class="ai-hero" style="margin-top:0"><h2 style="font-size:17px">Coins that move together</h2>
        <p>Big players (funds, market makers, ETF flows, liquidations) move whole baskets at once. The agent finds those baskets, who moves first, and when they pump or tank together. It watches every minute and learns from every move it predicts.</p>
        <div class="dim" style="font-size:11px;margin-top:8px">${A.tokens} coins on ${esc(A.exchange)} · ${A.days} days of 15-minute prices · updated ${ago(A.at)} ago</div></div>

      <div class="section-title"><span>⚡ Right now</span></div>
      <div style="padding:0 12px">${(live.signals || []).length ? live.signals.map(sigCard).join('') : `<div class="card dim" style="font-size:13px">No group is moving together right now. ${(live.clusters || []).map((c) => `${esc(c.name)}: ${c.state}`).join(' · ')}</div>`}</div>

      <div class="section-title"><span>🧠 What it has learned</span></div>
      <div style="padding:0 12px"><div class="card">
        <div class="grid3"><div class="kv"><span>Moves learned</span><span>${L.learnedEvents}</span></div><div class="kv"><span>Predictions graded</span><span>${L.graded}</span></div><div class="kv"><span>Followed</span><span class="${L.precision >= 0.5 ? 'up' : L.precision != null ? 'down' : ''}">${L.precision != null ? Math.round(L.precision * 100) + '%' : '—'}</span></div></div>
        <div class="dim" style="font-size:12px;line-height:1.5;margin-top:8px">It starts with a week of history, then grades every live call 60 minutes later: did the coins that had not moved yet follow the group? Fires when ${Math.round(L.breadthThr * 100)}% of a group moves together; that bar rises when calls miss and falls when they work.</div>
      </div></div>

      ${zecG.length ? `<div class="section-title"><span>★ ${MAIN_COIN} moves with</span></div><div style="padding:0 12px">${zecG.map(groupCard).join('')}</div>` : ''}
      <div class="section-title"><span>🕵️ Hidden groups (beyond Bitcoin)</span></div>
      <div class="dim" style="font-size:12px;padding:0 12px 8px;line-height:1.45">Bitcoin's influence removed: these coins still move together, a sign of one player or theme pushing them.</div>
      <div style="padding:0 12px">${hidden.map(groupCard).join('') || '<div class="dim">None found this week.</div>'}</div>
      <div class="section-title"><span>🌐 Market groups</span></div>
      <div style="padding:0 12px">${market.map(groupCard).join('')}</div>

      <div class="section-title"><span>📅 Pumps & dumps together (last 7 days)</span></div>
      <div style="padding:0 12px">${evs.map(evRow).join('') || '<div class="dim">No synchronized moves found.</div>'}</div>

      <div class="section-title"><span>🌡 Correlation heat map</span></div>
      <div style="padding:0 12px">${heat(A.heat)}</div>

      <div class="section-title"><span>🔗 Tightest pairs</span></div>
      <div style="padding:0 12px">${A.pairs.map((p) => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line);font-size:13px"><span>${tokChip(p.a)} ${tokChip(p.b)}</span><span class="num">${p.c.toFixed(2)}</span></div>`).join('')}</div>
      <div style="height:20px"></div>`;
    el.querySelectorAll('[data-tok]').forEach((b) => (b.onclick = () => { haptic(); app.set({ symbol: `${b.dataset.tok}/USDT` }); app.go('chart'); }));
    el.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => openEvent(evs.find((e) => e.id === b.dataset.ev))));
    el.querySelectorAll('[data-lag]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation(); const [t, act] = b.dataset.lag.split('|'); haptic();
      app.set({ symbol: `${t}/USDT` });
      if (act === 'trade') app.go('trade', { side: 'buy' }); else app.go('bots', { create: { type: 'herd' } });
    }));
    $('#hd-back', el).onclick = () => app.go('ai');
    $('#hd-re', el).onclick = async () => { toast('Re-analyzing the last week…'); try { await api('/api/herd/analyze', { method: 'POST', body: {} }); render(); } catch (e) { toast(e.message, 'err'); } };
  }

  function sigCard(p) {
    const pump = p.dir === 'pump';
    return `<div class="card" style="border-color:${pump ? 'var(--up)' : 'var(--down)'};margin-bottom:8px">
      <div class="row between"><b>${pump ? '🚀' : '🩸'} ${esc(p.name)} ${p.dir}ing together</b><span class="pill ${pump ? 'up' : 'down'}">${Math.round(p.breadth * 100)}% moving</span></div>
      <div style="font-size:12px;margin:6px 0">${p.movers.map((m) => tokChip(m.t, ` ${m.m > 0 ? '+' : ''}${m.m.toFixed(2)}%`)).join('')}</div>
      <div class="dim" style="font-size:12px">${ago(p.time)} ago · laggards usually follow ${Math.round(p.confidence * 100)}% of the time (learned)</div>
      ${p.laggards.length ? `<div class="label" style="margin:8px 0 4px">Not moved yet${pump ? ' (may catch up)' : ' (may drop next)'}</div>${p.laggards.slice(0, 6).map((l) => `<div class="row between" style="padding:4px 0">${tokChip(l.t)}${pump ? `<span><button class="btn sm buy" data-lag="${esc(l.t)}|trade">Buy</button> <button class="btn sm primary" data-lag="${esc(l.t)}|bot">Herd bot</button></span>` : ''}</div>`).join('')}` : ''}
      ${p.result ? `<div class="dim" style="font-size:11px;margin-top:6px">Graded: ${p.result.filter((r) => r.hit).length}/${p.result.length} followed</div>` : ''}</div>`;
  }

  function groupCard(c) {
    return `<div class="card" style="margin-bottom:8px">
      <div class="row between"><b>${esc(c.name)}</b><span class="pill">${c.tokens.length} coins · corr ${c.avgCorr.toFixed(2)}</span></div>
      <div style="margin:6px 0">${c.tokens.map((t) => tokChip(t)).join('')}</div>
      <div class="dim" style="font-size:12px;line-height:1.5">Moves first: ${c.leaders.map((l) => `<b style="color:var(--fg)">${esc(l.t)}</b>`).join(', ')}. When this group pumps, laggards followed <b class="${c.follow.pump >= 0.5 ? 'up' : 'down'}">${Math.round(c.follow.pump * 100)}%</b> of the time; when it dumps, <b class="${c.follow.dump >= 0.5 ? 'down' : ''}">${Math.round(c.follow.dump * 100)}%</b>.</div></div>`;
  }

  function evRow(e) {
    const pump = e.dir === 'pump';
    return `<button class="scan-row" data-ev="${esc(e.id)}" style="width:100%;text-align:left;border-left:3px solid ${pump ? 'var(--up)' : 'var(--down)'};margin-bottom:6px;background:var(--bg-1);border-radius:10px">
      <div><b>${pump ? '▲ Pump' : '▼ Dump'} together</b> <span class="dim" style="font-size:11px">${new Date(e.time).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}${e.source === 'live' ? ' · live' : ''}</span>
        <div class="dim" style="font-size:11px;margin-top:3px">${e.count} coins (${Math.round(e.breadth * 100)}%) · avg ${fmtPct(e.avgMove)}${e.leaders?.length ? ` · first: ${esc(e.leaders.slice(0, 3).join(', '))}` : ''}</div>
        <div style="font-size:11px;margin-top:2px">${e.tokens.slice(0, 8).map((x) => esc(x.t)).join(' · ')}</div></div>
      <div style="text-align:right;font-family:var(--mono);font-size:11px"><div class="${pctCol(e.after1h)}">1h ${e.after1h != null ? fmtPct(e.after1h) : '—'}</div><div class="${pctCol(e.after4h)}">4h ${e.after4h != null ? fmtPct(e.after4h) : '—'}</div>${e.laggardsFollow != null ? `<div class="dim">lag ${e.laggardsFollow}%</div>` : ''}</div></button>`;
  }

  function openEvent(e) {
    if (!e) return;
    sheet(`${e.dir === 'pump' ? '▲ Pump' : '▼ Dump'} together · ${new Date(e.time).toLocaleString()}`, (b) => {
      b.innerHTML = `<p class="muted" style="margin-top:0;font-size:13px;line-height:1.5">${e.count} coins (${Math.round(e.breadth * 100)}% of the ones watched) moved unusually ${e.dir === 'pump' ? 'up' : 'down'} within the same 30 minutes, ${fmtPct(e.avgMove)} on average. ${e.after1h != null ? `One hour later they were ${fmtPct(e.after1h)} further, after 4 hours ${fmtPct(e.after4h)}.` : ''} ${e.laggardsFollow != null ? `${e.laggardsFollow}% of the group members that had not moved yet followed within the hour.` : ''}</p>
        ${e.leaders?.length ? `<div class="label">Moved first</div><div style="margin:6px 0 12px">${e.leaders.map((t) => tokChip(t)).join('')}</div>` : ''}
        <div class="label">Every coin in the move</div>
        ${e.tokens.map((x) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)">${tokChip(x.t)}<span class="num ${cls(x.pct)}">${fmtPct(x.pct)}</span></div>`).join('')}`;
      b.querySelectorAll('[data-tok]').forEach((x) => (x.onclick = () => { app.set({ symbol: `${x.dataset.tok}/USDT` }); document.querySelector('.sheet .close')?.click(); app.go('chart'); }));
    });
  }

  function heat(h) {
    if (!h) return '';
    const n = h.tokens.length;
    // red (unrelated) → yellow → green (move together); stretched over the range crypto actually uses
    const col = (v) => { if (v == null) return '#111'; const x = Math.max(0, Math.min(1, (v - 0.3) / 0.65)); return `hsl(${Math.round(x * 140)}, 75%, ${Math.round(18 + x * 26)}%)`; };
    return `<div class="card" style="overflow-x:auto"><div style="display:grid;grid-template-columns:44px repeat(${n}, minmax(18px,1fr));gap:2px;font-size:9px;font-family:var(--mono)">
      <span></span>${h.tokens.map((t) => `<span style="writing-mode:vertical-rl;transform:rotate(180deg);height:40px;color:${t === MAIN_COIN ? 'var(--warn)' : 'var(--fg-3)'}">${esc(t)}</span>`).join('')}
      ${h.tokens.map((a, i) => `<span style="color:${a === MAIN_COIN ? 'var(--warn)' : 'var(--fg-3)'};align-self:center">${esc(a)}</span>${h.m[i].map((v) => `<span title="${a} ${v}" style="aspect-ratio:1;border-radius:3px;background:${col(v)}"></span>`).join('')}`).join('')}
    </div><div class="row" style="gap:6px;margin-top:8px;font-size:10px;font-family:var(--mono)"><span style="width:14px;height:10px;border-radius:2px;background:${col(0.3)}"></span>0.3 <span style="width:14px;height:10px;border-radius:2px;background:${col(0.6)}"></span>0.6 <span style="width:14px;height:10px;border-radius:2px;background:${col(0.95)}"></span>0.95 <span class="dim" style="font-family:var(--sans)">· how closely 15-minute moves match (1 = always together)</span></div></div>`;
  }

  return {
    show() { render(); clearInterval(timer); timer = setInterval(() => !document.hidden && render(), 60000); },
    hide() { clearInterval(timer); },
    onSignal() { if (app.current === 'herd') render(); },
  };
}
