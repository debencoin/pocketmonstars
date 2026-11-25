// Pump clock: when pumps and dumps really happen, by hour and weekday, in the user's time zone,
// from up to 2 years of hourly candles, checked out-of-sample, next to the world's market sessions.
import { api, qs, conn } from './api.js';
import { COINS, MAIN_COIN } from '/shared/presets.mjs';
import { DAYS, hourLabel, hourIn, weekdayIn } from '/shared/tz.mjs';
import { $, esc, store, tz, tzShort, tzPicker, haptic, fmtDateTime } from './ui.js';

export function clockScreen(el, app) {
  let token = store.get('clockToken', MAIN_COIN), months = store.get('clockMonths', 24), metric = 'pumps', data = null;

  function frame() {
    el.innerHTML = `
      <div class="row between" style="padding:8px 12px"><button class="btn sm" id="ck-back">‹ Back</button><b>🕐 Pump clock</b><button class="btn sm" id="ck-tz">${esc(tzShort())} ▾</button></div>
      <div class="chips">${[...COINS, 'MARKET'].map((t) => `<button class="chip ${t === token ? 'active' : ''} ${t === MAIN_COIN ? 'main' : ''}" data-t="${t}">${t === MAIN_COIN ? '★ ' : ''}${t === 'MARKET' ? 'Whole market' : t}</button>`).join('')}</div>
      <div class="seg" style="margin:0 12px 10px" id="ck-m">${[6, 12, 24].map((m) => `<button data-m="${m}" class="${m === months ? 'active' : ''}">${m} months</button>`).join('')}</div>
      <div id="ck-body"><div class="empty"><span class="spinner"></span><br><br>Loading ${months} months of hourly prices (first time can take ~30 s; cached after)…</div></div>`;
    $('#ck-back', el).onclick = () => history.length > 1 && app.prev ? app.go(app.prev) : app.go('ai');
    $('#ck-tz', el).onclick = () => tzPicker(() => { frame(); load(); });
    el.querySelector('.chips').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; token = b.dataset.t; store.set('clockToken', token); haptic(); frame(); load(); };
    $('#ck-m', el).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; months = Number(b.dataset.m); store.set('clockMonths', months); haptic(); frame(); load(); };
  }

  async function load() {
    if (conn.demo) { $('#ck-body', el).innerHTML = '<div class="empty"><b>The pump clock needs your server</b></div>'; return; }
    try { data = await api(`/api/clock${qs({ token, months, tz: tz() })}`); render(); }
    catch (e) { $('#ck-body', el).innerHTML = `<div class="empty"><b>Could not build the clock</b>${esc(e.message)}</div>`; }
  }

  const H = (h) => hourLabel(h);
  const range = (hs) => { const s = [...hs].sort((a, b) => a - b); return s.length === 3 && s[2] - s[0] === 2 ? `${H(s[0])}–${H(s[2] + 1)}` : s.map(H).join(', '); };
  const sessionNear = (h) => data.sessions.find((x) => Math.abs(x.hour - h) <= 1 || Math.abs(x.hour - h) >= 23);

  function story() {
    const d = data, c = d.consistency, t = d.top;
    const who = d.token === 'MARKET' ? 'the whole market' : d.token;
    const near = sessionNear(t.busiestHours[0]);
    const lines = [];
    lines.push(`Over ${d.months} months (${fmtDateTime(d.from, { month: 'short', year: 'numeric' })} – ${fmtDateTime(d.to, { month: 'short', year: 'numeric' })}, ${d.hoursAnalyzed.toLocaleString()} hours), ${who}'s biggest moves happen <b>${range(t.busiestHours)} ${esc(tzShort())}</b>${near ? `, right around the <b>${esc(near.name)}</b> (${esc(near.text)})` : ''}.`);
    lines.push(`Most pumps start at <b>${t.pumpHours.map(H).join(', ')}</b>; most dumps at <b>${t.dumpHours.map(H).join(', ')}</b>. Quietest: ${t.quietHours.map(H).join(', ')}.`);
    const busyDay = [...d.days].sort((a, b) => b.pumps - a.pumps)[0], calmDay = [...d.days].sort((a, b) => a.dumps - b.dumps)[0];
    lines.push(`Most pumps on <b>${DAYS[busyDay.day]}</b>; fewest dumps on <b>${DAYS[calmDay.day]}</b>.`);
    const timing = c.volatility >= 0.6 || c.pumps >= 0.5, direction = c.avg >= 0.5;
    lines.push(`<b>Does it repeat?</b> Checked on the most recent 30% of the data, which the pattern was not found on: <i>when</i> big moves happen ${timing ? '<span class="up">repeats</span>' : '<span class="down">does not repeat reliably</span>'} (timing match ${c.volatility}, pump timing ${c.pumps}); <i>which way</i> each hour goes ${direction ? '<span class="up">repeats</span>' : '<span class="down">does not repeat</span>'} (${c.avg}).`);
    lines.push(t.edges.length ? `Hours with a direction edge that held on unseen data: ${t.edges.map((e) => `${H(e.hour)} (${e.avg > 0 ? 'up' : 'down'})`).join(', ')}.` : `<b>No hour has a reliable up-or-down edge on its own.</b> Use these hours as <i>when to watch</i>: let the herd and news agents and your bots decide the direction.`);
    return lines.map((l) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:var(--fg-2)">${l}</p>`).join('');
  }

  function bars() {
    const max = Math.max(...data.hours.map((h) => Math.max(h.pumpRate, h.dumpRate)), 0.1);
    const sess = data.sessions;
    return `<div class="card"><div class="row between"><b>Pumps ▲ and dumps ▼ by hour (${esc(tzShort())})</b></div>
      <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;height:150px;align-items:end;margin-top:10px">${data.hours.map((h) => `<div title="${H(h.hour)}" style="display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:1px"><div style="height:${(h.pumpRate / max) * 70}%;background:var(--up);border-radius:2px 2px 0 0;min-height:1px"></div></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;height:70px;align-items:start">${data.hours.map((h) => `<div style="height:${(h.dumpRate / max) * 100}%;background:var(--down);border-radius:0 0 2px 2px;min-height:1px"></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;font-size:8px;color:var(--fg-4);font-family:var(--mono);margin-top:4px">${data.hours.map((h) => `<span style="text-align:center">${h.hour % 3 === 0 ? (h.hour % 12 || 12) + (h.hour < 12 ? 'a' : 'p') : ''}</span>`).join('')}</div>
      <div style="position:relative;height:${sess.length * 16 + 4}px;margin-top:6px">${sess.map((x, i) => `<div style="position:absolute;left:${((x.hour + x.minute / 60) / 24) * 100}%;top:${i * 16}px;font-size:9px;white-space:nowrap;color:#cfc4ff;transform:translateX(${x.hour > 16 ? '-100%' : '0'})">▏${esc(x.text)} ${esc(x.name)}</div>`).join('')}</div>
      <div class="dim" style="font-size:11px;margin-top:6px">Bar height = share of hours with an unusually big move (2× normal) at that hour. Purple = when world markets open, in your time.</div></div>`;
  }

  function heat() {
    const g = data.grid;
    const val = (c) => (metric === 'pumps' ? c.pumpRate : metric === 'dumps' ? c.dumpRate : metric === 'moves' ? c.absMove : c.avg);
    const vals = g.flat().map(val);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const col = (v) => {
      if (metric === 'avg') { const a = Math.min(1, Math.abs(v) / Math.max(Math.abs(lo), Math.abs(hi), 1e-9)); return v >= 0 ? `rgba(0,214,143,${a})` : `rgba(255,59,92,${a})`; }
      const x = (v - lo) / ((hi - lo) || 1); const base = metric === 'dumps' ? '255,59,92' : metric === 'pumps' ? '0,214,143' : '124,92,255'; return `rgba(${base},${0.08 + x * 0.92})`;
    };
    return `<div class="card"><div class="seg" id="ck-metric" style="margin-bottom:10px">${[['pumps', 'Pumps'], ['dumps', 'Dumps'], ['moves', 'Big moves'], ['avg', 'Avg return']].map(([k, l]) => `<button data-k="${k}" class="${k === metric ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div style="display:grid;grid-template-columns:30px repeat(24,1fr);gap:1px;font-size:8px;font-family:var(--mono)">
        <span></span>${Array.from({ length: 24 }, (_, h) => `<span style="text-align:center;color:var(--fg-4)">${h % 6 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : ''}</span>`).join('')}
        ${g.map((row, w) => `<span style="color:var(--fg-3);align-self:center">${DAYS[w]}</span>${row.map((c, h) => `<span data-cell="${w}-${h}" style="aspect-ratio:1;border-radius:2px;background:${col(val(c))}"></span>`).join('')}`).join('')}
      </div><div class="dim" style="font-size:11px;margin-top:6px">Each square = one hour of one weekday, in ${esc(tzShort())}. Tap a square for details.</div></div>`;
  }

  function days() {
    return `<div class="card">${data.days.map((d) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px"><b style="width:40px">${DAYS[d.day]}</b><span class="up">▲ ${d.pumps}</span><span class="down">▼ ${d.dumps}</span><span class="dim num">avg ${d.avg > 0 ? '+' : ''}${d.avg.toFixed(3)}%/h</span><span class="dim num">move ${d.absMove}%</span></div>`).join('')}</div>`;
  }

  function table() {
    return `<div class="card" style="font-family:var(--mono);font-size:11px"><div style="display:grid;grid-template-columns:44px 1fr 1fr 1fr 1fr 36px;gap:4px;color:var(--fg-4);font-family:var(--sans);font-weight:600"><span>Hour</span><span>Avg</span><span>Pump%</span><span>Dump%</span><span>Move</span><span>Edge</span></div>
      ${data.hours.map((h) => `<div style="display:grid;grid-template-columns:44px 1fr 1fr 1fr 1fr 36px;gap:4px;padding:5px 0;border-top:1px solid var(--line)"><span style="font-family:var(--sans)">${H(h.hour)}</span><span class="${h.avg > 0 ? 'up' : h.avg < 0 ? 'down' : ''}">${h.avg > 0 ? '+' : ''}${h.avg.toFixed(3)}</span><span class="up">${h.pumpRate}</span><span class="down">${h.dumpRate}</span><span>${h.absMove}</span><span>${h.holds ? '✓' : '—'}</span></div>`).join('')}
      <div class="dim" style="font-family:var(--sans);font-size:11px;margin-top:6px">Edge ✓ = the hour's direction was significant on the first 70% of the data (t ≥ 2) <i>and</i> held on the last 30%. Fees (≈0.1–0.2% per trade) are larger than any hourly average, so an hour alone is not a strategy.</div></div>`;
  }

  function newsPart() {
    const n = data.news;
    if (!n || !n.articles) return '<div class="card dim">No news history available.</div>';
    const who = data.token === 'MARKET' ? 'the market' : data.token;
    const dayCard = (d, up) => `<div class="change-item" style="border-left:3px solid ${up ? 'var(--up)' : 'var(--down)'}"><div class="row between"><b class="${up ? 'up' : 'down'}">${d.move > 0 ? '+' : ''}${d.move}%</b><span class="dim" style="font-size:11px">${esc(d.day)}</span></div>
      ${d.headlines.length ? d.headlines.map((h) => `<a href="${esc(h.url)}" target="_blank" rel="noopener" style="display:block;color:var(--fg);text-decoration:none;font-size:12px;margin-top:5px;line-height:1.4"><span class="pill ${h.label === 'bullish' ? 'up' : h.label === 'bearish' ? 'down' : ''}" style="height:16px;font-size:9px">${esc(h.when)}</span> ${esc(h.title)} <span class="dim">· ${esc(h.source || '')}</span></a>`).join('') : '<div class="dim" style="font-size:12px;margin-top:4px">No headline found: likely a market-wide or whale-driven move (check the herd agent).</div>'}</div>`;
    const max = Math.max(...n.byHour, 1);
    return `<div class="card"><p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:var(--fg-2)">${n.articles.toLocaleString()} headlines about ${esc(who)} since ${fmtDateTime(n.from, { month: 'short', year: 'numeric' })}. <b>${n.bigMoveDaysWithNews}%</b> of the ${n.bigDays} biggest-move days had news that day or the day before (vs ${n.normalDaysWithNews}% of quiet days).</p>
      <div class="grid2" style="margin-bottom:6px"><div class="zone buy" style="display:block"><div style="font-size:12px;font-family:var(--sans)">🟢 Bullish news days (${n.bullish.days})</div><div class="num" style="font-size:16px">${n.bullish.sameDay > 0 ? '+' : ''}${n.bullish.sameDay}% <span style="font-size:11px">that day</span></div><div style="font-size:11px">${n.bullish.nextDay > 0 ? '+' : ''}${n.bullish.nextDay}% next day · up ${n.bullish.sameDayUp}%</div></div>
      <div class="zone sell" style="display:block"><div style="font-size:12px;font-family:var(--sans)">🔴 Bearish news days (${n.bearish.days})</div><div class="num" style="font-size:16px">${n.bearish.sameDay > 0 ? '+' : ''}${n.bearish.sameDay}% <span style="font-size:11px">that day</span></div><div style="font-size:11px">${n.bearish.nextDay > 0 ? '+' : ''}${n.bearish.nextDay}% next day · up ${n.bearish.sameDayUp}%</div></div></div>
      ${n.exactTime ? `<div class="label" style="margin:10px 0 4px">When news breaks (${n.exactTime} headlines with exact times, ${esc(tzShort())})</div><div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;height:44px;align-items:end">${n.byHour.map((v) => `<div style="height:${(v / max) * 100}%;background:#a78bfa;border-radius:2px 2px 0 0;min-height:1px"></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(24,1fr);font-size:8px;color:var(--fg-4);font-family:var(--mono)">${n.byHour.map((_, h) => `<span style="text-align:center">${h % 3 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : ''}</span>`).join('')}</div>` : ''}
      <div class="dim" style="font-size:11px;margin-top:8px">Older headlines mostly carry a date only, so they are matched per day. The live news agent records exact times from now on.</div></div>
      <div class="label" style="margin:12px 0 6px">Biggest pump days and the news behind them</div>${n.topPumpDays.map((d) => dayCard(d, true)).join('')}
      <div class="label" style="margin:12px 0 6px">Biggest dump days and the news behind them</div>${n.topDumpDays.map((d) => dayCard(d, false)).join('')}`;
  }

  async function week() {
    const box = $('#ck-week', el); if (!box) return;
    try {
      const evs = await api(`/api/herd/events${qs({ days: 8 })}`);
      if (!evs.length) { box.innerHTML = '<div class="card dim">No synchronized moves this week.</div>'; return; }
      const z = tz(); const hrs = new Array(24).fill(0).map(() => ({ p: 0, d: 0 }));
      for (const e of evs) hrs[hourIn(e.time, z)][e.dir === 'pump' ? 'p' : 'd']++;
      box.innerHTML = `<div class="card"><div style="display:grid;grid-template-columns:repeat(24,1fr);gap:2px;height:60px;align-items:end">${hrs.map((x) => `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%"><div style="height:${x.p * 18}px;background:var(--up)"></div><div style="height:${x.d * 18}px;background:var(--down)"></div></div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(24,1fr);font-size:8px;color:var(--fg-4);font-family:var(--mono)">${hrs.map((_, h) => `<span style="text-align:center">${h % 3 === 0 ? (h % 12 || 12) + (h < 12 ? 'a' : 'p') : ''}</span>`).join('')}</div>
        ${evs.slice(0, 12).map((e) => `<div class="row between" style="padding:5px 0;border-top:1px solid var(--line);font-size:12px"><span class="${e.dir === 'pump' ? 'up' : 'down'}">${e.dir === 'pump' ? '▲' : '▼'} ${DAYS[weekdayIn(e.time, z)]} ${fmtDateTime(e.time, { hour: 'numeric', minute: '2-digit' })}</span><span class="dim">${e.count} coins · ${e.avgMove > 0 ? '+' : ''}${e.avgMove}%</span></div>`).join('')}</div>`;
    } catch { box.innerHTML = ''; }
  }

  function render() {
    $('#ck-body', el).innerHTML = `
      <div style="padding:0 12px"><div class="card" style="border-color:rgba(124,92,255,.5)">${story()}<div class="dim" style="font-size:11px">${esc(data.source)} · ${esc(data.tzLabel)}</div></div></div>
      <div class="section-title"><span>Hour by hour</span></div><div style="padding:0 12px">${bars()}</div>
      <div class="section-title"><span>Weekday × hour</span></div><div style="padding:0 12px" id="ck-heat">${heat()}</div>
      <div class="section-title"><span>By weekday</span></div><div style="padding:0 12px">${days()}</div>
      <div class="section-title"><span>📰 News behind the pumps & dumps</span></div><div style="padding:0 12px">${newsPart()}</div>
      <div class="section-title"><span>⚡ This week's group moves, by hour</span></div><div style="padding:0 12px" id="ck-week"></div>
      <div class="section-title"><span>Every hour</span></div><div style="padding:0 12px">${table()}</div><div style="height:24px"></div>`;
    wireHeat();
    week();
  }

  function wireHeat() {
    const box = $('#ck-heat', el);
    box.querySelector('#ck-metric').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; metric = b.dataset.k; box.innerHTML = heat(); wireHeat(); };
    box.onclick = (e) => {
      const c = e.target.closest('[data-cell]'); if (!c) return;
      const [w, h] = c.dataset.cell.split('-').map(Number); const x = data.grid[w][h];
      haptic(); app.toast?.(`${DAYS[w]} ${H(h)}: ${x.pumpRate}% pumps, ${x.dumpRate}% dumps, avg ${x.avg > 0 ? '+' : ''}${x.avg.toFixed(3)}%, typical move ${x.absMove}% (${x.n} hours)`);
    };
  }

  return { show() { frame(); load(); }, hide() {} };
}
