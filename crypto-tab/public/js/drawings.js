// Touch-first drawing tools on top of the chart.
// Points are stored as {t, p} (unix seconds, price) so drawings survive zoom, timeframe
// changes and restarts, and can be placed in the future area of the chart.
import { store, fmtPrice, haptic } from './ui.js';

const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIBX = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];

// tool id -> [label, points needed, svg path]
export const TOOLS = {
  trend: ['Trend line', 2, 'M4 20 20 4'],
  ray: ['Ray', 2, 'M4 20 14 10M14 10l6-6'],
  ext: ['Extended line', 2, 'M2 22 22 2'],
  hline: ['Horizontal line', 1, 'M2 12h20'],
  hray: ['Horizontal ray', 1, 'M6 12h16M6 9v6'],
  vline: ['Vertical line', 1, 'M12 2v20'],
  arrow: ['Arrow', 2, 'M4 20 18 6m-6 0h6v6'],
  channel: ['Parallel channel', 3, 'M3 16 15 4M9 20 21 8'],
  fib: ['Fib retracement', 2, 'M3 4h18M3 9h18M3 13h18M3 20h18'],
  fibx: ['Fib extension', 3, 'M3 20 9 8l6 8M3 4h18M3 10h18'],
  rect: ['Rectangle', 2, 'M4 6h16v12H4z'],
  ellipse: ['Ellipse', 2, 'M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z'],
  measure: ['Price range', 2, 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4'],
  long: ['Long position', 2, 'M4 4h16v8H4zM4 12h16v6H4z'],
  short: ['Short position', 2, 'M4 6h16v6H4zM4 12h16v8H4z'],
  brush: ['Brush', 0, 'M4 18c3 0 3-4 6-4s3 4 6 4 3-6 4-8'],
  text: ['Text', 1, 'M5 5h14M12 5v14'],
};
const COLORS = ['#7c5cff', '#22d3ee', '#f5c542', '#00d68f', '#ff3b5c', '#ffffff'];

export class DrawingLayer {
  constructor(view, host) {
    this.v = view;
    this.host = host;
    this.items = [];
    this.tool = null;
    this.sel = null;
    this.draft = null;
    this.magnet = store.get('magnet', true);
    this.color = COLORS[0];
    this.listeners = new Set();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'draw-layer';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.sig = '';
    this.bindEvents();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    view.chart.subscribeClick((p) => this.onChartClick(p));
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((f) => f(this)); }

  key() { return this.v.storageKey ? `draw:${this.v.storageKey()}` : null; }
  load() { const k = this.key(); this.items = k ? (store.get(k, []) || []).filter((d) => !d.bot) : []; this.sel = null; this.dirty(); }
  save() { const k = this.key(); if (k) store.set(k, this.items.filter((d) => !d.bot)); this.emit(); }

  setTool(t) {
    this.tool = t;
    this.draft = null;
    this.sel = null;
    this.capture(!!t);
    this.dirty();
    this.emit();
  }
  capture(on) { this.canvas.classList.toggle('capture', on); }
  dirty() { this.sig = ''; }

  // ---------- coordinates ----------
  toXY(pt) { return { x: this.v.timeToX(pt.t), y: this.v.priceToY(pt.p) }; }
  fromXY(x, y, snap = this.magnet) {
    let t = this.v.xToTime(x), p = this.v.yToPrice(y);
    if (snap) {
      const bar = this.v.barAtX(x);
      if (bar) {
        let best = null;
        for (const k of ['open', 'high', 'low', 'close']) {
          const yy = this.v.priceToY(bar[k]);
          if (yy != null && Math.abs(yy - y) < 22 && (!best || Math.abs(yy - y) < best.d)) best = { d: Math.abs(yy - y), v: bar[k] };
        }
        if (best) { p = best.v; t = bar.time; }
      }
    }
    return { t, p };
  }

  // ---------- input ----------
  bindEvents() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const { x, y } = pos(e);
      if (this.tool) return this.startDraw(x, y);
      if (this.sel) {
        const h = this.hitHandle(this.sel, x, y);
        if (h != null) { this.drag = { mode: 'handle', i: h }; return; }
        if (this.hit(this.sel, x, y)) { this.drag = { mode: 'move', x, y, orig: this.sel.pts.map((p) => ({ ...p })) }; return; }
        const other = this.pick(x, y);
        if (other && !other.locked) { this.select(other); this.drag = { mode: 'move', x, y, orig: other.pts.map((p) => ({ ...p })) }; return; }
        this.select(null);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const { x, y } = pos(e);
      if (this.draft) {
        if (this.draft.type === 'brush') this.draft.pts.push(this.fromXY(x, y, false));
        else this.draft.pts[this.draft.pts.length - 1] = this.fromXY(x, y);
        this.dirty();
        return;
      }
      if (!this.drag || !this.sel || this.sel.locked) return;
      if (this.drag.mode === 'handle') {
        this.sel.pts[this.drag.i] = this.fromXY(x, y);
        if (this.sel.bot && this.sel.onDrag) this.sel.onDrag(this.sel.pts[0].p);
      } else {
        const t0 = this.v.xToTime(this.drag.x), p0 = this.v.yToPrice(this.drag.y);
        const t1 = this.v.xToTime(x), p1 = this.v.yToPrice(y);
        this.sel.pts = this.drag.orig.map((p) => ({ t: p.t + (t1 - t0), p: p.p + (p1 - p0) }));
        if (this.sel.bot && this.sel.onDrag) this.sel.onDrag(this.sel.pts[0].p);
      }
      this.dirty();
    });
    const up = () => {
      if (this.draft) this.finishStep();
      if (this.drag) { this.drag = null; if (this.sel?.bot) this.sel.onDrop?.(this.sel.pts[0].p); this.save(); }
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  startDraw(x, y) {
    const type = this.tool;
    const pt = this.fromXY(x, y, type !== 'brush');
    if (this.draft) { // 3-point tools: the next touch places the third point
      this.draft.pts[this.draft.pts.length - 1] = pt;
      this.dirty();
      return;
    }
    const need = TOOLS[type][1];
    this.draft = { id: Math.random().toString(36).slice(2, 9), type, color: this.color, pts: need === 1 ? [pt] : [pt, { ...pt }] };
    if (type === 'text') {
      const txt = prompt('Text');
      if (!txt) { this.draft = null; return; }
      this.draft.text = txt;
    }
    haptic();
    this.dirty();
  }

  finishStep() {
    const d = this.draft;
    const need = TOOLS[d.type][1];
    if (need === 3 && d.pts.length < 3) { d.pts.push({ ...d.pts[d.pts.length - 1] }); return; } // wait for the third point
    if (d.type === 'long' || d.type === 'short') {
      const [a, b] = d.pts;
      const dist = b.p - a.p;
      d.pts = [a, { t: b.t, p: b.p }, { t: b.t, p: a.p - dist / 2 }]; // entry, target, stop (2R)
    }
    this.items.push(d);
    this.draft = null;
    this.sel = d;
    this.tool = store.get('stayInDraw', false) ? this.tool : null;
    this.capture(true);
    haptic(15);
    this.save();
    this.dirty();
  }

  onChartClick(p) {
    if (this.tool || !p?.point) return;
    const hit = this.pick(p.point.x, p.point.y);
    this.select(hit);
  }

  select(d) {
    this.sel = d;
    this.capture(!!d || !!this.tool);
    this.dirty();
    this.emit();
  }

  pick(x, y) {
    for (let i = this.items.length - 1; i >= 0; i--) if (this.hit(this.items[i], x, y)) return this.items[i];
    return null;
  }

  hitHandle(d, x, y) {
    const pts = d.pts.map((p) => this.toXY(p));
    for (let i = 0; i < pts.length; i++) if (pts[i].x != null && Math.hypot(pts[i].x - x, pts[i].y - y) < 22) return i;
    return null;
  }

  hit(d, x, y) {
    const P = d.pts.map((p) => this.toXY(p));
    if (P.some((p) => p.x == null || p.y == null)) return false;
    const W = this.canvas.clientWidth;
    const near = (a, b, tol = 12) => segDist(x, y, a.x, a.y, b.x, b.y) < tol;
    switch (d.type) {
      case 'hline': return Math.abs(y - P[0].y) < 14;
      case 'hray': return Math.abs(y - P[0].y) < 14 && x >= P[0].x - 10;
      case 'vline': return Math.abs(x - P[0].x) < 14;
      case 'text': return Math.abs(x - P[0].x - 30) < 40 && Math.abs(y - P[0].y + 6) < 16;
      case 'ext': { const e = extend(P[0], P[1], W, true); return near(e[0], e[1]); }
      case 'ray': { const e = extend(P[0], P[1], W, false); return near(e[0], e[1]); }
      case 'channel': return near(P[0], P[1]) || inPoly(x, y, channelPoly(P));
      case 'rect': case 'measure': case 'fib': case 'ellipse': case 'long': case 'short': case 'fibx': {
        const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
        const right = ['fib', 'fibx'].includes(d.type) ? W : Math.max(...xs);
        return x >= Math.min(...xs) - 8 && x <= right + 8 && y >= Math.min(...ys) - 8 && y <= Math.max(...ys) + 8;
      }
      case 'brush': for (let i = 1; i < P.length; i++) if (near(P[i - 1], P[i])) return true; return false;
      default: return near(P[0], P[1]);
    }
  }

  // ---------- actions on the selection ----------
  removeSelected() { if (!this.sel || this.sel.bot) return; this.items = this.items.filter((d) => d !== this.sel); this.select(null); this.save(); }
  lockSelected() { if (this.sel) { this.sel.locked = !this.sel.locked; this.save(); this.dirty(); } }
  colorSelected(c) { this.color = c; if (this.sel) { this.sel.color = c; this.save(); this.dirty(); } }
  clear() { this.items = this.items.filter((d) => d.bot); this.select(null); this.save(); }
  toggleMagnet() { this.magnet = !this.magnet; store.set('magnet', this.magnet); this.emit(); }

  // Draggable horizontal lines for editing bots on the chart (grid bounds, TP, SL).
  setBotLines(lines) {
    this.items = this.items.filter((d) => !d.bot);
    const t = this.v.candles.length ? this.v.candles[this.v.candles.length - 1].time : 0;
    for (const l of lines) this.items.push({ id: `bot-${l.key}`, bot: true, key: l.key, type: 'hline', color: l.color, label: l.label, pts: [{ t, p: l.price }], onDrag: l.onDrag, onDrop: l.onDrop });
    this.dirty();
  }

  // ---------- rendering ----------
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const c = this.canvas, dpr = window.devicePixelRatio || 1;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h || !this.v.candles.length) return;
    const ts = this.v.chart.timeScale();
    const ref = this.v.candles[this.v.candles.length - 1].close;
    const sig = [w, h, ts.logicalToCoordinate(0), ts.logicalToCoordinate(100), this.v.priceToY(ref), this.v.priceToY(ref * 1.01), this.items.length, this.sel?.id, !!this.draft].join('|');
    if (sig === this.sig && !this.draft && !this.drag) return;
    this.sig = sig;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px'; }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // clip to the price pane (exclude the price axis and sub-panes)
    const panes = this.v.chart.panes();
    const mainH = panes[0]?.getHeight?.() ?? h;
    const axisW = this.v.chart.priceScale('right').width();
    g.save();
    g.beginPath(); g.rect(0, 0, w - axisW, mainH); g.clip();
    for (const d of this.items) this.paint(g, d, d === this.sel, w - axisW);
    if (this.draft) this.paint(g, this.draft, true, w - axisW);
    g.restore();
    // axis labels for bot lines
    for (const d of this.items.filter((x) => x.bot)) {
      const y = this.v.priceToY(d.pts[0].p);
      if (y == null) continue;
      g.fillStyle = d.color; g.fillRect(w - axisW, y - 9, axisW, 18);
      g.fillStyle = '#000'; g.font = '600 10px JetBrains Mono'; g.textBaseline = 'middle';
      g.fillText(fmtPrice(d.pts[0].p, ref), w - axisW + 3, y);
    }
  }

  paint(g, d, selected, W) {
    const P = d.pts.map((p) => this.toXY(p));
    if (P.some((p) => p.x == null || p.y == null || !Number.isFinite(p.x))) return;
    const ref = this.v.refPrice;
    g.strokeStyle = d.color; g.fillStyle = d.color; g.lineWidth = selected ? 2 : 1.5;
    g.setLineDash([]); g.font = '600 11px JetBrains Mono'; g.textBaseline = 'bottom';
    const ln = (a, b) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
    const label = (txt, x, y, color = d.color) => { g.fillStyle = color; g.fillText(txt, x, y); };
    switch (d.type) {
      case 'trend': ln(P[0], P[1]); break;
      case 'ray': { const e = extend(P[0], P[1], W, false); ln(e[0], e[1]); break; }
      case 'ext': { const e = extend(P[0], P[1], W, true); ln(e[0], e[1]); break; }
      case 'hline':
        if (d.bot) { g.setLineDash([6, 4]); g.lineWidth = 2; }
        ln({ x: 0, y: P[0].y }, { x: W, y: P[0].y });
        label(d.label ? `${d.label}  ${fmtPrice(d.pts[0].p, ref)}` : fmtPrice(d.pts[0].p, ref), 8, P[0].y - 3);
        if (d.bot) { g.setLineDash([]); g.beginPath(); g.arc(W - 26, P[0].y, 9, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillText('⇅', W - 30, P[0].y + 6); }
        break;
      case 'hray': ln(P[0], { x: W, y: P[0].y }); label(fmtPrice(d.pts[0].p, ref), P[0].x + 4, P[0].y - 3); break;
      case 'vline': ln({ x: P[0].x, y: 0 }, { x: P[0].x, y: 4000 }); break;
      case 'arrow': {
        ln(P[0], P[1]);
        const a = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x);
        g.beginPath(); g.moveTo(P[1].x, P[1].y);
        g.lineTo(P[1].x - 12 * Math.cos(a - 0.4), P[1].y - 12 * Math.sin(a - 0.4));
        g.lineTo(P[1].x - 12 * Math.cos(a + 0.4), P[1].y - 12 * Math.sin(a + 0.4)); g.closePath(); g.fill();
        break;
      }
      case 'channel': {
        ln(P[0], P[1]);
        if (P[2]) {
          const dy = P[2].y - P[0].y;
          const q0 = { x: P[0].x, y: P[0].y + dy }, q1 = { x: P[1].x, y: P[1].y + dy };
          ln(q0, q1);
          g.globalAlpha = 0.08; g.beginPath(); g.moveTo(P[0].x, P[0].y); g.lineTo(P[1].x, P[1].y); g.lineTo(q1.x, q1.y); g.lineTo(q0.x, q0.y); g.fill(); g.globalAlpha = 1;
          g.setLineDash([4, 4]); ln({ x: P[0].x, y: P[0].y + dy / 2 }, { x: P[1].x, y: P[1].y + dy / 2 });
        }
        break;
      }
      case 'fib': case 'fibx': {
        const levels = d.type === 'fib' ? FIB : FIBX;
        const a = d.pts[0].p, b = d.pts[1].p;
        const base = d.type === 'fib' ? b : (d.pts[2]?.p ?? b);
        const span = d.type === 'fib' ? a - b : b - a;
        const x0 = Math.min(P[0].x, P[1].x);
        levels.forEach((lv, k) => {
          const price = d.type === 'fib' ? b + span * lv : base + span * lv;
          const y = this.v.priceToY(price);
          if (y == null) return;
          g.globalAlpha = 0.07; g.fillStyle = COLORS[k % COLORS.length];
          const nextP = d.type === 'fib' ? b + span * (levels[k + 1] ?? lv) : base + span * (levels[k + 1] ?? lv);
          const y2 = this.v.priceToY(nextP);
          if (k < levels.length - 1 && y2 != null) g.fillRect(x0, Math.min(y, y2), W - x0, Math.abs(y2 - y));
          g.globalAlpha = 1; g.strokeStyle = COLORS[k % COLORS.length]; g.lineWidth = 1;
          ln({ x: x0, y }, { x: W, y });
          label(`${lv} (${fmtPrice(price, ref)})`, x0 + 4, y - 2, COLORS[k % COLORS.length]);
        });
        g.strokeStyle = d.color; g.setLineDash([3, 3]); ln(P[0], P[1]); if (P[2]) ln(P[1], P[2]);
        break;
      }
      case 'rect': {
        g.globalAlpha = 0.12; g.fillRect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y); g.globalAlpha = 1;
        g.strokeRect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y);
        break;
      }
      case 'ellipse': {
        g.beginPath(); g.ellipse((P[0].x + P[1].x) / 2, (P[0].y + P[1].y) / 2, Math.abs(P[1].x - P[0].x) / 2, Math.abs(P[1].y - P[0].y) / 2, 0, 0, 7);
        g.globalAlpha = 0.1; g.fill(); g.globalAlpha = 1; g.stroke();
        break;
      }
      case 'measure': {
        const up = d.pts[1].p >= d.pts[0].p;
        const col = up ? '#00d68f' : '#ff3b5c';
        g.fillStyle = col; g.globalAlpha = 0.15; g.fillRect(P[0].x, P[0].y, P[1].x - P[0].x, P[1].y - P[0].y); g.globalAlpha = 1;
        g.strokeStyle = col; ln({ x: (P[0].x + P[1].x) / 2, y: P[0].y }, { x: (P[0].x + P[1].x) / 2, y: P[1].y });
        const dp = d.pts[1].p - d.pts[0].p, pc = (dp / d.pts[0].p) * 100;
        const bars = Math.round((d.pts[1].t - d.pts[0].t) / this.v.tfSec);
        const txt = `${dp >= 0 ? '+' : ''}${fmtPrice(dp, ref)} (${pc >= 0 ? '+' : ''}${pc.toFixed(2)}%) · ${bars} bars`;
        g.fillStyle = '#000c'; const tw = g.measureText(txt).width;
        const lx = Math.min(P[0].x, P[1].x), ly = up ? Math.min(P[0].y, P[1].y) - 6 : Math.max(P[0].y, P[1].y) + 20;
        g.fillRect(lx - 2, ly - 15, tw + 8, 18); label(txt, lx + 2, ly, col);
        break;
      }
      case 'long': case 'short': {
        const [e, t, s] = P;
        const x1 = Math.max(e.x + 60, t.x);
        g.globalAlpha = 0.2;
        g.fillStyle = '#00d68f'; g.fillRect(e.x, Math.min(e.y, t.y), x1 - e.x, Math.abs(t.y - e.y));
        g.fillStyle = '#ff3b5c'; g.fillRect(e.x, Math.min(e.y, s.y), x1 - e.x, Math.abs(s.y - e.y));
        g.globalAlpha = 1; g.strokeStyle = '#fff'; ln({ x: e.x, y: e.y }, { x: x1, y: e.y });
        const ep = d.pts[0].p, tp = d.pts[1].p, sp = d.pts[2].p;
        const rr = Math.abs(tp - ep) / Math.max(1e-12, Math.abs(ep - sp));
        label(`Target ${fmtPrice(tp, ref)} (${(((tp - ep) / ep) * 100).toFixed(2)}%)`, e.x + 4, t.y + (t.y < e.y ? 14 : -3), '#00d68f');
        label(`Stop ${fmtPrice(sp, ref)} (${(((sp - ep) / ep) * 100).toFixed(2)}%)`, e.x + 4, s.y + (s.y < e.y ? 14 : -3), '#ff3b5c');
        label(`${d.type === 'long' ? 'LONG' : 'SHORT'} ${fmtPrice(ep, ref)} · R:R ${rr.toFixed(2)}`, e.x + 4, e.y - 3, '#fff');
        break;
      }
      case 'brush': { g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); break; }
      case 'text': g.font = '600 13px Inter'; label(d.text, P[0].x, P[0].y); break;
      default: break;
    }
    if (selected && !d.bot) {
      g.setLineDash([]);
      for (const p of P) { g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fillStyle = '#000'; g.fill(); g.lineWidth = 2; g.strokeStyle = d.locked ? '#5a606c' : '#fff'; g.stroke(); }
    }
  }

  destroy() { cancelAnimationFrame(this.raf); this.canvas.remove(); }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function extend(a, b, W, both) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6) return [{ x: a.x, y: both ? -4000 : a.y }, { x: a.x, y: dy > 0 ? 4000 : -4000 }];
  const k = dy / dx;
  const right = dx > 0 ? W : 0;
  const start = both ? (dx > 0 ? 0 : W) : a.x;
  return [{ x: start, y: a.y + k * (start - a.x) }, { x: right, y: a.y + k * (right - a.x) }];
}

function channelPoly(P) {
  if (!P[2]) return [];
  const dy = P[2].y - P[0].y;
  return [P[0], P[1], { x: P[1].x, y: P[1].y + dy }, { x: P[0].x, y: P[0].y + dy }];
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export { COLORS };
