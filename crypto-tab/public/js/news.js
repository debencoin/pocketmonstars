// News screen: a CryptoPanic-style live feed with sentiment, plus the news agent on top:
// per-token mood, what the price did after each article, trade signals, and stats on how
// each kind of news usually moves the price.
import { api, qs, conn } from './api.js';
import { COINS, MAIN_COIN } from '/shared/presets.mjs';
import { $, esc, fmtPct, cls, ago, haptic, toast, store } from './ui.js';

const FILTERS = [['all', 'All'], ['important', '🔥 Important'], ['bullish', '🟢 Bullish'], ['bearish', '🔴 Bearish'], ['hot', '⚡ Hot'], ['listing', '🏷 Listings']];

export function newsScreen(el, app) {
  let filter = store.get('newsFilter', 'all');
  let token = store.get('newsToken', MAIN_COIN);
  let q = '', items = [], timer = null, seen = new Set();

  el.innerHTML = `
    <div class="chips" id="nw-mood"></div>
    <div id="nw-agent" style="padding:0 12px"></div>
    <div class="chips" id="nw-filters">${FILTERS.map(([k, l]) => `<button class="chip ${k === filter ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="search" style="margin-bottom:6px"><svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3m0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10"/></svg><input class="input" id="nw-q" placeholder="Search news or a token (e.g. ZEC)" autocomplete="off"></div>
    <div id="nw-list"></div>
    <div class="section-title"><span>📊 What happens after news</span></div>
    <div id="nw-stats" style="padding:0 12px"></div>
    <div id="nw-feeds" class="dim" style="font-size:11px;padding:10px 12px"></div>`;

  const tokens = () => [...new Set([...COINS, app.S.symbol.split('/')[0]])];

  async function mood() {
    try {
      const m = await api(`/api/news/sentiment${qs({ tokens: tokens().join(',') })}`);
      $('#nw-mood', el).innerHTML = ['ALL', ...tokens()].map((t) => {
        const x = m[t] || { index: 0, articles: 0 };
        const col = x.index > 15 ? 'var(--up)' : x.index < -15 ? 'var(--down)' : 'var(--fg-3)';
        const active = (token || 'ALL') === t;
        return `<button class="chip ${active ? 'active' : ''} ${t === MAIN_COIN ? 'main' : ''}" data-t="${t}" style="height:auto;padding:6px 12px;text-align:left;line-height:1.25">${t === MAIN_COIN ? '★ ' : ''}${t === 'ALL' ? 'All crypto' : t}<br><span class="num" style="color:${active ? 'inherit' : col};font-size:12px">${x.index > 0 ? '+' : ''}${x.index}</span> <span style="font-size:10px;opacity:.7">${x.articles} news</span></button>`;
      }).join('');
    } catch { /* offline */ }
  }

  async function agent() {
    const box = $('#nw-agent', el);
    const t = token || MAIN_COIN;
    try {
      const b = await api(`/api/news/brief${qs({ token: t })}`);
      const sig = b.allSignals || await api('/api/news/signals');
      const live = sig.filter((s) => !s.pricedIn).slice(0, 4);
      box.innerHTML = `<div class="card" style="border-color:rgba(124,92,255,.5);margin-bottom:10px">
        <div class="row between"><b>📡 News agent · ${esc(t)}</b><span class="pill ${b.index.index > 15 ? 'up' : b.index.index < -15 ? 'down' : ''}">mood ${b.index.index > 0 ? '+' : ''}${b.index.index}</span></div>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.55;color:var(--fg-2)">${esc(b.text)}</p>
        ${live.length ? `<div class="label" style="margin:12px 0 6px">Live signals (all tokens)</div>${live.map(sigHtml).join('')}` : '<div class="dim" style="font-size:12px;margin-top:10px">No live signals right now: every strong headline is either priced in or too old.</div>'}
      </div>`;
      box.querySelectorAll('[data-sig]').forEach((x) => (x.onclick = (e) => {
        const s = live.find((y) => y.id === x.dataset.sig); const act = e.target.closest('[data-act]')?.dataset.act; if (!s || !act) return;
        haptic();
        app.set({ symbol: s.symbol });
        if (act === 'trade') app.go('trade', { side: s.label === 'bullish' ? 'buy' : 'sell', symbolChanged: true });
        if (act === 'bot') app.go('bots', { create: { type: 'newsbot' } });
        if (act === 'chart') app.go('chart');
      }));
    } catch (e) { box.innerHTML = conn.demo ? '<div class="card dim">The news agent needs your Crypto Tab server.</div>' : `<div class="card down">${esc(e.message)}</div>`; }
  }

  function sigHtml(s) {
    const bull = s.label === 'bullish';
    const ev = s.evidence;
    const strong = s.score >= 0.55;
    const head = bull ? (strong ? '🟢 BUY' : '🟢 WATCH') : (strong ? '🔴 AVOID / SELL' : '🔴 CAUTION');
    return `<div class="change-item" data-sig="${esc(s.id)}" style="border-left:3px solid ${bull ? 'var(--up)' : 'var(--down)'}">
      <div class="row between"><b>${head} ${esc(s.token)}</b><span class="num">score ${s.score}${strong ? '' : ' · weak'}</span></div>
      <div style="font-size:12px;margin:4px 0;color:var(--fg-2)">${esc(s.title)}</div>
      <div class="dim" style="font-size:11px">${esc(s.source)} · ${Math.round(s.ageMin)} min ago ${s.latencySec != null ? `· caught ${s.latencySec < 120 ? s.latencySec + ' s' : Math.round(s.latencySec / 60) + ' min'} after publish ` : ''}· moved ${fmtPct(s.movedSincePct)} since</div>
      ${bull ? `<div class="num" style="font-size:12px;margin-top:4px">Target +${s.tpPct}% · stop -${s.slPct}%</div>` : ''}
      ${ev ? `<div class="dim" style="font-size:11px;margin-top:3px">History (${esc(ev.basis.replace('token:', '').replace('cat:', '').replace('label:', '').replace('strong:', 'strong '))}, ${ev.n} cases): ${fmtPct(ev.avg60)} after 1 h${ev.avg240 != null ? `, ${fmtPct(ev.avg240)} after 4 h` : ''} ${ev.agrees ? '✓ agrees' : '⚠ usually goes the other way'}</div>` : ''}
      <div class="grid3" style="margin-top:8px"><button class="btn sm" data-act="chart">Chart</button><button class="btn sm ${bull ? 'buy' : 'sell'}" data-act="trade">${bull ? 'Buy' : 'Sell'}</button><button class="btn sm primary" data-act="bot">News bot</button></div></div>`;
  }

  function itemHtml(a) {
    const main = a.tokens.find((t) => a.reactions?.[t]) || a.tokens[0];
    const r = a.reactions?.[main];
    const chip = (k, l) => (r?.[k] != null ? `<span class="pill ${cls(r[k])}" style="height:18px;font-size:10px">${l} ${fmtPct(r[k], 2)}</span>` : '');
    const col = a.label === 'bullish' ? 'var(--up)' : a.label === 'bearish' ? 'var(--down)' : 'var(--line-2)';
    return `<div class="news-item" style="border-left-color:${col}">
      <div class="row between dim" style="font-size:11px"><span>${ago(a.published)} ago · ${esc(a.source)}</span><span>${a.importance >= 0.4 ? '🔥 ' : ''}<span style="color:${col};font-weight:700">${a.label}</span> ${a.sentiment > 0 ? '+' : ''}${a.sentiment.toFixed(2)}</span></div>
      <a href="${esc(a.url)}" target="_blank" rel="noopener" class="news-title">${esc(a.title)}</a>
      ${a.ai?.summary ? `<div style="font-size:12px;color:var(--fg-2);margin-top:4px">${esc(a.ai.summary)}</div>` : ''}
      ${a.ai?.take ? `<div style="font-size:12px;color:#cfc4ff;margin-top:4px">✦ ${esc(a.ai.take)}</div>` : ''}
      <div class="row" style="flex-wrap:wrap;gap:4px;margin-top:6px">${a.tokens.map((t) => `<button class="pill ${t === MAIN_COIN ? 'warn' : 'accent'}" data-tok="${esc(t)}" style="height:20px">${t === MAIN_COIN ? '★ ' : ''}${esc(t)}</button>`).join('')}
        ${r ? `<span class="dim" style="font-size:10px;margin-left:4px">${esc(main)} after:</span>${chip('m15', '15m')}${chip('m60', '1h')}${chip('m240', '4h')}${r.now != null && r.m240 == null ? chip('now', 'now') : ''}` : ''}</div>
      <div class="row" style="gap:6px;margin-top:6px"><button class="vote" data-vote="bullish" data-id="${a.id}">👍 ${a.votes.bullish || ''}</button><button class="vote" data-vote="bearish" data-id="${a.id}">👎 ${a.votes.bearish || ''}</button><button class="vote" data-vote="important" data-id="${a.id}">⭐ ${a.votes.important || ''}</button><span class="dim" style="font-size:10px;margin-left:auto">${esc(a.category)}${a.words?.length ? ' · ' + esc(a.words.slice(0, 3).join(', ')) : ''}</span></div>
    </div>`;
  }

  async function list() {
    const L = $('#nw-list', el);
    if (!items.length) L.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
    try {
      items = await api(`/api/news${qs({ token: token && token !== 'ALL' ? token : undefined, filter, q: q || undefined, limit: 80 })}`);
      L.innerHTML = items.length ? items.map(itemHtml).join('') : '<div class="empty"><b>No news here yet</b>Sources refresh every 90 seconds.</div>';
      for (const a of items) seen.add(a.id);
    } catch (e) { L.innerHTML = conn.demo ? '<div class="empty"><b>News needs your server</b>Connect it in Settings.</div>' : `<div class="empty">${esc(e.message)}</div>`; }
  }

  async function statsCard() {
    const box = $('#nw-stats', el);
    const t = token && token !== 'ALL' ? token : null;
    try {
      const s = await api(`/api/news/stats${qs({ token: t || undefined })}`);
      const row = (label, k) => { const g = s[k]; if (!g?.m60) return ''; const c = (h) => (g[h] ? `<span class="${cls(g[h].avg)}">${fmtPct(g[h].avg)}</span><br><span class="dim" style="font-size:10px">up ${g[h].upShare}% · n${g[h].n}</span>` : '—'); return `<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:4px;padding:8px 0;border-top:1px solid var(--line);font-family:var(--mono);font-size:12px"><span style="font-family:var(--sans)">${label}</span><span>${c('m15')}</span><span>${c('m60')}</span><span>${c('m240')}</span></div>`; };
      const pre = t ? `token:${t}:` : 'label:';
      box.innerHTML = `<div class="card"><div class="dim" style="font-size:12px;line-height:1.45;margin-bottom:6px">Average price move of ${t ? esc(t) : 'the tagged tokens'} after each kind of headline, measured from when it was published. "up" = how often it went up.</div>
        <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:4px;font-size:10px;color:var(--fg-4);font-weight:600"><span>News</span><span>15 min</span><span>1 hour</span><span>4 hours</span></div>
        ${row('🟢 Bullish', pre + 'bullish')}${row('🔴 Bearish', pre + 'bearish')}${row('⚪ Neutral', pre + 'neutral')}${t ? '' : row('🔥 Strong bullish', 'strong:bullish') + row('🔥 Strong bearish', 'strong:bearish') + row('🏷 Listings', 'cat:listing:bullish') + row('🛡 Hacks', 'cat:hack:bearish') + row('⚖ Regulation (bearish)', 'cat:regulation:bearish')}
        <div class="dim" style="font-size:11px;margin-top:8px">The sample grows every day the server runs, so the agent's estimates keep getting sharper.</div></div>`;
    } catch { box.innerHTML = ''; }
    try {
      const L = await api('/api/news/learning');
      box.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:10px"><b>🧠 News agent track record</b>
        <div class="grid3" style="margin-top:8px"><div class="kv"><span>Signals graded</span><span>${L.graded}</span></div><div class="kv"><span>Worked</span><span class="${L.precision >= 0.5 ? 'up' : L.precision != null ? 'down' : ''}">${L.precision != null ? Math.round(L.precision * 100) + '%' : '—'}</span></div><div class="kv"><span>Waiting</span><span>${L.pending}</span></div></div>
        <div class="dim" style="font-size:11px;margin-top:8px;line-height:1.45">Every live signal is graded 4 hours later from real candles (target before stop = worked). The results keep adjusting how much the agent trusts each source, kind of news and coin.${L.bySource.length ? ` Most reliable so far: ${L.bySource.slice().sort((a, b) => b.rate - a.rate).slice(0, 3).map((x) => `${esc(x.k)} ${Math.round(x.rate * 100)}%`).join(', ')}.` : ' The first grades arrive about 4 hours after the first live signals.'}</div></div>`);
    } catch { /* ignore */ }
    try { const f = await api('/api/news/feeds'); const ok = f.filter((x) => !x.error && x.ok); $('#nw-feeds', el).textContent = `${ok.length}/${f.length} sources live: ${ok.map((x) => x.name).join(', ')}. Refreshed every 90 s.`; } catch { /* ignore */ }
  }

  $('#nw-mood', el).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; token = b.dataset.t === 'ALL' ? null : b.dataset.t; store.set('newsToken', token); haptic(); items = []; mood(); agent(); list(); statsCard(); };
  $('#nw-filters', el).onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f; store.set('newsFilter', filter); el.querySelectorAll('#nw-filters .chip').forEach((c) => c.classList.toggle('active', c === b)); haptic(); items = []; list(); };
  let qt; $('#nw-q', el).oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); items = []; list(); }, 300); };
  $('#nw-list', el).onclick = async (e) => {
    const t = e.target.closest('[data-tok]');
    if (t) { haptic(); app.set({ symbol: `${t.dataset.tok}/USDT` }); return app.go('chart'); }
    const v = e.target.closest('[data-vote]');
    if (v) { try { await api(`/api/news/${v.dataset.id}/vote`, { method: 'POST', body: { kind: v.dataset.vote } }); haptic(15); v.textContent = v.textContent.replace(/\d*$/, (n) => String((Number(n) || 0) + 1)); } catch (er) { toast(er.message, 'err'); } }
  };

  return {
    show() { mood(); agent(); list(); statsCard(); clearInterval(timer); timer = setInterval(() => { if (!document.hidden) { list(); mood(); } }, 60000); },
    hide() { clearInterval(timer); },
    onNews(a) {
      if (app.current !== 'news' || seen.has(a.id)) return;
      if (token && !a.tokens.includes(token)) return;
      seen.add(a.id); items.unshift(a);
      const L = $('#nw-list', el); L.insertAdjacentHTML('afterbegin', itemHtml(a)); L.firstElementChild.classList.add('flash-up');
    },
  };
}
