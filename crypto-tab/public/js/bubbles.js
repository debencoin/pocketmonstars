// Bubbles / Matrix / List: market performance at a glance.
//  - Bubbles: a live physics field; each coin is a bubble sized by its move (or volume) and
//    colored green / red by performance. Drag and fling them; tap one for details.
//  - Matrix: tiles sized by trading volume, colored by performance (squarified treemap).
//  - List: hour / day / week / month / year performance, sortable.
import { api, qs, conn } from './api.js';
import { MAIN_COIN } from '/shared/presets.mjs';
import { $, esc, fmtPrice, fmtAmt, fmtPct, cls, store, sheet, haptic, toast } from './ui.js';

const TFS = [['h1', 'Hour'], ['d1', 'Day'], ['w1', 'Week'], ['m1', 'Month'], ['y1', 'Year']];

export function bubblesScreen(el, app) {
  let mode = store.get('bbMode', 'bubbles'), tf = store.get('bbTf', 'd1'), sizeBy = store.get('bbSize', 'perf'), page = 1, only = store.get('bbOnly', 'all'), src = store.get('bbSrc', 'top');
  const logos = new Map(); // coin logo images, loaded once
  const logo = (r) => {
    if (!r.img) return null;
    let im = logos.get(r.b);
    if (!im) { im = new Image(); im.src = r.img.replace('/large/', '/small/'); logos.set(r.b, im); }
    return im.complete && im.naturalWidth ? im : null;
  };
  const SIZES = { perf: 'move', mc: 'market cap', volume: 'volume' };
  let rows = [], nodes = [], raf = null, timer = null, canvas = null, drag = null, sortK = 'rank', sortD = 1;

  function frame() {
    el.innerHTML = `
      <div class="row between" style="padding:8px 12px 4px;gap:6px">
        <div class="seg" id="bb-mode" style="flex:1">${[['list', '📋 List'], ['bubbles', '🫧 Bubbles'], ['matrix', '🔳 Matrix']].map(([k, l]) => `<button data-m="${k}" class="${k === mode ? 'active' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="row" style="padding:4px 12px;gap:6px;overflow-x:auto">
        <div class="seg" id="bb-tf">${TFS.map(([k, l]) => `<button data-tf="${k}" class="${k === tf ? 'active' : ''}" style="height:32px;padding:0 9px">${l}</button>`).join('')}</div>
      </div>
      <div class="row" style="padding:4px 12px 6px;gap:6px;overflow-x:auto;scrollbar-width:none">
        <button class="chip active" id="bb-src">${src === 'top' ? '🌐 Top coins' : `🏦 ${esc(app.S.ex)}`}</button>
        <button class="chip ${page === 1 ? 'active' : ''}" data-pg="1">1–100</button><button class="chip ${page === 2 ? 'active' : ''}" data-pg="2">101–200</button>
        <button class="chip ${only === 'fav' ? 'active' : ''}" data-only="fav">★ Mine</button>
        ${mode === 'bubbles' ? `<button class="chip" id="bb-size">Size: ${SIZES[sizeBy] || 'move'}</button>` : ''}
        <span class="dim" id="bb-info" style="font-size:11px;white-space:nowrap;align-self:center"></span>
      </div>
      <div id="bb-body" style="position:relative"></div>`;
    $('#bb-mode', el).onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; if (b.dataset.m === 'list') { store.set('bbMode', 'bubbles'); return app.go('markets'); } mode = b.dataset.m; store.set('bbMode', mode); haptic(); frame(); draw(); };
    $('#bb-tf', el).onclick = (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tf = b.dataset.tf; store.set('bbTf', tf); haptic(); el.querySelectorAll('#bb-tf button').forEach((x) => x.classList.toggle('active', x === b)); draw(true); };
    el.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = () => { page = Number(b.dataset.pg); haptic(); frame(); load(); }));
    el.querySelector('[data-only]').onclick = () => { only = only === 'fav' ? 'all' : 'fav'; store.set('bbOnly', only); haptic(); frame(); draw(); };
    $('#bb-size', el)?.addEventListener('click', () => { const ks = Object.keys(SIZES).filter((k) => k !== 'mc' || rows.some((r) => r.mc)); sizeBy = ks[(ks.indexOf(sizeBy) + 1) % ks.length]; store.set('bbSize', sizeBy); haptic(); frame(); draw(true); });
    $('#bb-src', el).onclick = () => { src = src === 'top' ? 'exchange' : 'top'; store.set('bbSrc', src); haptic(); frame(); load(); };
  }

  async function load() {
    try {
      const r = await api(`/api/bubbles${qs({ ex: app.S.ex, quote: 'USDT', page, source: src })}`);
      rows = r.rows;
      const info = $('#bb-info', el); if (info) info.textContent = `${r.source === 'top' ? 'by market cap · CoinGecko' : `${app.S.ex} · ${r.total} coins`}${r.loading ? ` · loading ${r.loading}…` : ''}`;
      draw();
    } catch (e) {
      if (conn.demo) {
        const m = await api(`/api/markets${qs({ ex: app.S.ex })}`);
        rows = m.markets.slice(0, 100).map((x, i) => ({ rank: i + 1, s: x.s, b: x.b, p: x.p, v: x.v, d1: x.c, h1: x.c / 6, w1: x.c * 2.2, m1: x.c * 4, y1: x.c * 9 }));
        draw();
      } else $('#bb-body', el).innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
  }

  const visible = () => {
    if (only !== 'fav') return rows;
    const f = new Set((store.get('favs', []) || []).map((k) => k.split('|')[1]));
    return rows.filter((r) => f.has(r.s) || r.b === MAIN_COIN);
  };

  function draw(resize) {
    cancelAnimationFrame(raf);
    if (mode === 'bubbles') bubbleField(resize);
    else if (mode === 'matrix') matrix();
    else list();
  }

  // ---------------- bubbles ----------------
  function bubbleField(resize) {
    const body = $('#bb-body', el);
    const H = Math.max(360, el.clientHeight - body.offsetTop - 8);
    if (!canvas || !body.contains(canvas)) { body.innerHTML = ''; canvas = document.createElement('canvas'); canvas.style.cssText = `width:100%;height:${H}px;display:block;touch-action:none`; body.appendChild(canvas); bindDrag(); }
    canvas.style.height = `${H}px`;
    const W = canvas.clientWidth, dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const list = visible().filter((r) => r[tf] != null || sizeBy === 'volume');
    const weight = (r) => (sizeBy === 'perf' ? Math.sqrt(Math.abs(r[tf] ?? 0)) + 0.35 : sizeBy === 'mc' && r.mc ? Math.log10(1 + r.mc) ** 2.2 : Math.log10(1 + (r.v || 0)) ** 2);
    const total = list.reduce((s, r) => s + weight(r) ** 2, 0) || 1;
    const k = Math.sqrt((0.6 * W * H) / (Math.PI * total));
    const old = new Map(nodes.map((n) => [n.r.s, n]));
    nodes = list.map((r) => {
      const prev = old.get(r.s);
      const rad = Math.max(12, Math.min(Math.min(W, H) * 0.26, k * weight(r)));
      return prev ? Object.assign(prev, { r, rad }) : { r, rad, x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 };
    });
    const g = canvas.getContext('2d');
    const step = () => {
      raf = requestAnimationFrame(step);
      if (document.hidden || app.current !== 'bubbles' || mode !== 'bubbles') return;
      // physics: pull to the center, push apart on overlap, bounce on walls
      for (const n of nodes) {
        if (n === drag?.n) continue;
        n.vx += (W / 2 - n.x) * 0.00025; n.vy += (H / 2 - n.y) * 0.00025;
        n.vx += (Math.random() - 0.5) * 0.04; n.vy += (Math.random() - 0.5) * 0.04;
      }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.rad + b.rad + 1.5;
        if (d < min) {
          const push = (min - d) / 2, ux = dx / d, uy = dy / d;
          const wa = a === drag?.n ? 0 : 1, wb = b === drag?.n ? 0 : 1, sum = wa + wb || 1;
          a.x -= ux * push * (2 * wa / sum); a.y -= uy * push * (2 * wa / sum); b.x += ux * push * (2 * wb / sum); b.y += uy * push * (2 * wb / sum);
          const rv = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
          if (rv < 0) { a.vx += ux * rv * 0.5 * wa; a.vy += uy * rv * 0.5 * wa; b.vx -= ux * rv * 0.5 * wb; b.vy -= uy * rv * 0.5 * wb; }
        }
      }
      for (const n of nodes) {
        if (n === drag?.n) continue;
        n.vx *= 0.94; n.vy *= 0.94; n.x += n.vx; n.y += n.vy;
        if (n.x < n.rad) { n.x = n.rad; n.vx = Math.abs(n.vx) * 0.6; } if (n.x > W - n.rad) { n.x = W - n.rad; n.vx = -Math.abs(n.vx) * 0.6; }
        if (n.y < n.rad) { n.y = n.rad; n.vy = Math.abs(n.vy) * 0.6; } if (n.y > H - n.rad) { n.y = H - n.rad; n.vy = -Math.abs(n.vy) * 0.6; }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (const n of nodes) paintBubble(g, n);
    };
    step();
  }

  function paintBubble(g, n) {
    const v = n.r[tf] ?? 0, up = v >= 0;
    const a = Math.min(1, 0.25 + Math.abs(v) / 12);
    const rgb = up ? '0,214,143' : '255,59,92';
    const grd = g.createRadialGradient(n.x, n.y, n.rad * 0.2, n.x, n.y, n.rad);
    grd.addColorStop(0, `rgba(${rgb},${0.05 * a})`); grd.addColorStop(0.78, `rgba(${rgb},${0.22 * a})`); grd.addColorStop(1, `rgba(${rgb},${0.85 * a})`);
    g.beginPath(); g.arc(n.x, n.y, n.rad, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
    g.lineWidth = n.r.b === MAIN_COIN ? 3 : 1.2; g.strokeStyle = n.r.b === MAIN_COIN ? '#ffb020' : `rgba(${rgb},${0.9 * a})`; g.stroke();
    if (n.rad < 11) return;
    const im = n.rad >= 22 ? logo(n.r) : null, ls = n.rad * 0.5;
    if (im) g.drawImage(im, n.x - ls / 2, n.y - n.rad * 0.72, ls, ls);
    const ty = im ? n.y + n.rad * 0.08 : n.y - n.rad * 0.14, py = im ? n.y + n.rad * 0.46 : n.y + n.rad * 0.26;
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.max(8, Math.min(26, n.rad * (im ? 0.34 : 0.42), (n.rad * 1.8) / Math.max(3, n.r.b.length) / 0.62))}px Inter, system-ui`;
    g.fillText(n.r.b, n.x, ty);
    g.font = `600 ${Math.max(7, Math.min(18, n.rad * (im ? 0.25 : 0.28)))}px JetBrains Mono, monospace`;
    g.fillStyle = up ? '#b6ffe2' : '#ffc2cc';
    g.fillText(n.r[tf] == null ? '…' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, n.x, py);
  }

  function bindDrag() {
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      const n = [...nodes].reverse().find((b) => Math.hypot(b.x - p.x, b.y - p.y) <= b.rad);
      if (!n) return;
      canvas.setPointerCapture(e.pointerId);
      drag = { n, x0: p.x, y0: p.y, t0: Date.now(), last: p, moved: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = pos(e);
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 6) drag.moved = true;
      drag.n.vx = p.x - drag.last.x; drag.n.vy = p.y - drag.last.y;
      drag.n.x = p.x; drag.n.y = p.y; drag.last = p;
    });
    const up = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.moved && Date.now() - d.t0 < 400) { haptic(); detail(d.n.r); }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }

  // ---------------- matrix (squarified treemap) ----------------
  function squarify(items, x, y, w, h) {
    const out = []; let rest = items.slice();
    const total = rest.reduce((s, i) => s + i.w, 0) || 1;
    const scale = (w * h) / total;
    let rx = x, ry = y, rw = w, rh = h;
    const worst = (row, side) => { const s = row.reduce((a, b) => a + b.w * scale, 0); const mx = Math.max(...row.map((r) => r.w * scale)), mn = Math.min(...row.map((r) => r.w * scale)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
    while (rest.length) {
      const side = Math.min(rw, rh); let row = [rest[0]]; let i = 1;
      while (i < rest.length && worst([...row, rest[i]], side) <= worst(row, side)) { row.push(rest[i]); i++; }
      const s = row.reduce((a, b) => a + b.w * scale, 0);
      if (rw >= rh) { const cw = s / rh; let cy = ry; for (const r of row) { const ch = (r.w * scale) / cw; out.push({ ...r, x: rx, y: cy, w2: cw, h2: ch }); cy += ch; } rx += cw; rw -= cw; }
      else { const ch = s / rw; let cx = rx; for (const r of row) { const cw = (r.w * scale) / ch; out.push({ ...r, x: cx, y: ry, w2: cw, h2: ch }); cx += cw; } ry += ch; rh -= ch; }
      rest = rest.slice(row.length);
    }
    return out;
  }

  // Tiles sized by market cap (or volume), but compressed so even coin #100 gets a tile big
  // enough to read its name and % change. Taller than the screen when needed: scroll down.
  function matrix() {
    const body = $('#bb-body', el); canvas = null;
    const W = body.clientWidth || el.clientWidth - 24, screenH = Math.max(420, el.clientHeight - body.offsetTop - 8);
    const list = visible().filter((r) => r.mc || r.v > 0).slice(0, 100);
    const wOf = (r) => (r.mc ? r.mc : r.v) ** 0.33;
    const items = list.map((r) => ({ r, w: wOf(r) })).sort((a, b) => b.w - a.w);
    const total = items.reduce((s2, i) => s2 + i.w, 0) || 1, minShare = (items.at(-1)?.w || 1) / total;
    const H = Math.round(Math.min(screenH * 3, Math.max(screenH, 2000 / (W * minShare)))); // smallest tile ≈ 2000 px²
    const tiles = squarify(items, 0, 0, W, H);
    body.innerHTML = `<div style="position:relative;width:${W}px;height:${H}px;margin:0 auto">${tiles.map((t) => {
      const v = t.r[tf]; const a = v == null ? 0.15 : Math.min(1, 0.22 + Math.abs(v) / 10); const bg = v == null ? '#181b21' : v >= 0 ? `rgba(0,214,143,${a})` : `rgba(255,59,92,${a})`;
      const nameFs = Math.max(7, Math.min(24, t.h2 / 2.8, (t.w2 - 6) / Math.max(2.2, t.r.b.length * 0.74)));
      const pctFs = Math.max(7, Math.min(16, t.h2 / 3.6, (t.w2 - 4) / 4.4));
      const pct = v == null ? '…' : `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
      const row = t.h2 < 22; // very flat tile: name and % side by side
      const img = t.r.img && t.w2 > 70 && t.h2 > 70 ? `<img src="${esc(t.r.img.replace('/large/', '/small/'))}" alt="" style="width:${Math.min(36, t.h2 / 4)}px;height:${Math.min(36, t.h2 / 4)}px;border-radius:50%;margin-bottom:3px">` : '';
      return `<button data-s="${esc(t.r.s)}" style="position:absolute;left:${t.x}px;top:${t.y}px;width:${t.w2}px;height:${t.h2}px;background:${bg};border:1px solid #000;${t.r.b === MAIN_COIN ? 'box-shadow:inset 0 0 0 2px #ffb020;' : ''}display:flex;flex-direction:${row ? 'row' : 'column'};gap:${row ? 3 : 0}px;align-items:center;justify-content:center;overflow:hidden;padding:1px;color:#fff;line-height:1.05">
        ${img}<b style="font-size:${nameFs}px;white-space:nowrap">${esc(t.r.b)}</b><span class="num" style="font-size:${pctFs}px;white-space:nowrap;opacity:.95">${pct}</span></button>`;
    }).join('')}</div><div class="dim" style="font-size:11px;padding:6px 12px">Tile size = ${list.some((r) => r.mc) ? 'market cap' : '24h trading volume'} · color = ${TFS.find((x) => x[0] === tf)[1].toLowerCase()} change${H > screenH ? ' · scroll for the rest' : ''}</div>`;
    body.onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { haptic(); detail(rows.find((r) => r.s === b.dataset.s)); } };
  }

  // ---------------- list ----------------
  function list() {
    const body = $('#bb-body', el); canvas = null;
    const L = [...visible()].sort((a, b) => (sortK === 'b' ? a.b.localeCompare(b.b) : ((a[sortK] ?? -1e9) - (b[sortK] ?? -1e9))) * sortD);
    const th = (k, l) => `<button data-k="${k}" style="text-align:${k === 'b' ? 'left' : 'right'};font-size:10px;font-weight:700;color:${sortK === k ? 'var(--fg)' : 'var(--fg-4)'}">${l}${sortK === k ? (sortD > 0 ? ' ▲' : ' ▼') : ''}</button>`;
    body.innerHTML = `<div style="display:grid;grid-template-columns:26px 1fr 1.1fr repeat(5, 50px);gap:4px;padding:6px 12px;position:sticky;top:0;background:#000;z-index:2">${th('rank', '#')}${th('b', 'Coin')}${th('p', 'Price')}${TFS.map(([k, l]) => th(k, l === 'Month' ? 'Mo' : l === 'Week' ? 'Wk' : l === 'Hour' ? '1h' : l === 'Day' ? '24h' : 'Yr')).join('')}</div>
      ${L.map((r) => `<div data-s="${esc(r.s)}" style="display:grid;grid-template-columns:26px 1fr 1.1fr repeat(5, 50px);gap:4px;padding:9px 12px;border-bottom:1px solid #0d0f12;align-items:center;font-size:12px${r.b === MAIN_COIN ? ';background:linear-gradient(90deg, rgba(255,176,32,.1), transparent)' : ''}">
        <span class="dim num">${r.rank}</span><b style="display:flex;align-items:center;gap:5px;min-width:0">${r.img ? `<img src="${esc(r.img.replace('/large/', '/small/'))}" alt="" loading="lazy" style="width:16px;height:16px;border-radius:50%">` : ''}${r.b === MAIN_COIN ? '★ ' : ''}${esc(r.b)}</b><span class="num" style="text-align:right">${fmtPrice(r.p)}</span>
        ${TFS.map(([k]) => `<span class="num ${cls(r[k])}" style="text-align:right;font-size:11px">${r[k] == null ? '…' : fmtPct(r[k], 1)}</span>`).join('')}</div>`).join('')}`;
    body.onclick = (e) => {
      const h = e.target.closest('[data-k]'); if (h) { const k = h.dataset.k; sortD = sortK === k ? -sortD : k === 'rank' || k === 'b' ? 1 : -1; sortK = k; list(); return; }
      const row = e.target.closest('[data-s]'); if (row) { haptic(); detail(rows.find((r) => r.s === row.dataset.s)); }
    };
  }

  // ---------------- detail ----------------
  function detail(r) {
    if (!r) return;
    sheet(`${r.b === MAIN_COIN ? '★ ' : ''}${r.s}`, async (b, close) => {
      b.innerHTML = `<div class="row between"><div class="num" style="font-size:26px;font-weight:700">${fmtPrice(r.p)}</div><span class="dim">#${r.mcRank || r.rank}${r.mc ? ` · cap $${fmtAmt(r.mc)}` : ''} · vol ${fmtAmt(r.v)}</span></div>${r.name ? `<div class="dim" style="font-size:13px;margin-top:2px">${esc(r.name)}</div>` : ''}
        <div class="grid3" style="margin:12px 0;grid-template-columns:repeat(5,1fr)">${TFS.map(([k, l]) => `<div class="kv" style="text-align:center"><span>${l}</span><span class="${cls(r[k])}">${r[k] == null ? '…' : fmtPct(r[k], 1)}</span></div>`).join('')}</div>
        <canvas id="bb-spark" style="width:100%;height:120px;display:block;margin-bottom:12px"></canvas>
        <div class="grid3"><button class="btn sm" data-a="chart">Chart</button><button class="btn sm buy" data-a="trade">Trade</button><button class="btn sm" data-a="alert">🔔 Alert</button></div>
        <div class="grid2" style="margin-top:8px"><button class="btn sm primary" data-a="bot">🚀 Pump Rider</button><button class="btn sm" data-a="profile">🧬 Profile</button></div>`;
      b.onclick = (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        app.set({ symbol: r.s }); close(); haptic();
        if (a === 'chart') app.go('chart'); if (a === 'trade') app.go('trade', { side: 'buy' }); if (a === 'alert') app.newAlert({ price: r.p });
        if (a === 'bot') app.go('bots', { create: { type: 'pumpgrid' } }); if (a === 'profile') app.go('ai');
      };
      try {
        const c = await api(`/api/ohlcv${qs({ ex: app.S.ex, symbol: r.s, tf: tf === 'h1' ? '5m' : tf === 'd1' ? '15m' : tf === 'w1' ? '1h' : '1d', limit: tf === 'y1' ? 365 : tf === 'm1' ? 30 : 96 })}`);
        const cv = b.querySelector('#bb-spark'); const W = cv.clientWidth, H = 120, dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr;
        const g = cv.getContext('2d'); g.scale(dpr, dpr);
        const v = c.map((k) => k.close), lo = Math.min(...v), hi = Math.max(...v);
        const up = v[v.length - 1] >= v[0]; const col = up ? '#00d68f' : '#ff3b5c';
        const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, up ? 'rgba(0,214,143,.35)' : 'rgba(255,59,92,.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.beginPath(); v.forEach((p, i) => { const x = (i / (v.length - 1)) * W, y = H - 6 - ((p - lo) / ((hi - lo) || 1)) * (H - 12); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = grd; g.fill();
      } catch { /* no chart */ }
    });
  }

  return {
    show() { frame(); load(); clearInterval(timer); timer = setInterval(() => !document.hidden && load(), 20000); },
    hide() { clearInterval(timer); cancelAnimationFrame(raf); },
  };
}
