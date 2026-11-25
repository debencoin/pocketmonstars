// ChartView: candlestick chart with indicator panes, forecast ("future") overlay and drawings.
// Built on TradingView Lightweight Charts (Apache-2.0).
import * as I from '/shared/indicators.mjs';
import { DrawingLayer } from './drawings.js';
import { decimalsFor, fmtPrice, fmtAmt, tz } from './ui.js';
import { fmtTime } from '/shared/tz.mjs';

let LW = null;
export async function loadLW() {
  if (LW) return LW;
  try { LW = await import('/vendor/lightweight-charts.js'); }
  catch { LW = await import('https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.mjs'); }
  return LW;
}

const C = { up: '#00d68f', down: '#ff3b5c', text: '#858b97', grid: '#0e1014', line: '#1f232b', accent: '#7c5cff', cyan: '#22d3ee' };
const PALETTE = ['#f5c542', '#e86bff', '#22d3ee', '#ff8a3d', '#8cff66', '#ffffff'];

export const CHART_TYPES = [['candles', 'Candles'], ['hollow', 'Hollow'], ['heikin', 'Heikin Ashi'], ['bars', 'OHLC bars'], ['line', 'Line'], ['area', 'Area'], ['baseline', 'Baseline']];

function heikin(c) {
  const out = [];
  for (let i = 0; i < c.length; i++) {
    const x = c[i];
    const close = (x.open + x.high + x.low + x.close) / 4;
    const open = i === 0 ? (x.open + x.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ time: x.time, open, close, high: Math.max(x.high, open, close), low: Math.min(x.low, open, close), volume: x.volume });
  }
  return out;
}

export class ChartView {
  constructor(host, { drawings = true, onLegend, storageKey } = {}) {
    this.host = host;
    this.candles = [];
    this.tfSec = 3600;
    this.type = 'candles';
    this.indicators = [];
    this.indSeries = [];
    this.fcSeries = [];
    this.priceLines = [];
    this.forecast = null;
    this.onLegend = onLegend;
    this.storageKey = storageKey;
    this.markerSets = {}; // kind -> markers (trades, news, herd), merged into one layer
    this.wantDrawings = drawings;
  }

  async init() {
    const L = await loadLW();
    this.L = L;
    this.chart = L.createChart(this.host, {
      autoSize: true,
      layout: { attributionLogo: false, background: { type: 'solid', color: '#000000' }, textColor: C.text, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, panes: { separatorColor: C.line, separatorHoverColor: '#2a2f39', enableResize: true } },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.line, scaleMargins: { top: 0.1, bottom: 0.08 } },
      timeScale: { tickMarkFormatter: (t, type) => fmtTime(t * 1000, tz(), type === 0 ? { year: 'numeric' } : type === 1 ? { month: 'short' } : type === 2 ? { month: 'short', day: 'numeric' } : { hour: 'numeric', minute: '2-digit' }), borderColor: C.line, timeVisible: true, secondsVisible: false, rightOffset: 12, barSpacing: 7, minBarSpacing: 1.5, fixLeftEdge: false, rightBarStaysOnScroll: true },
      crosshair: { mode: 0, vertLine: { color: '#5a606c', labelBackgroundColor: '#2a2f39' }, horzLine: { color: '#5a606c', labelBackgroundColor: '#2a2f39' } },
      localization: { priceFormatter: (p) => fmtPrice(p, this.refPrice), timeFormatter: (t) => fmtTime(t * 1000, tz(), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, pinch: true, mouseWheel: true },
      handleScroll: { horzTouchDrag: true, vertTouchDrag: true, pressedMouseMove: true, mouseWheel: true },
      kineticScroll: { touch: true, mouse: false },
    });
    this.makeMain();
    this.chart.subscribeCrosshairMove((p) => this.legend(p));
    if (this.wantDrawings) this.draw = new DrawingLayer(this, this.host);
    this.gestures();
    return this;
  }

  // Thumb control, like TradingView mobile:
  //  - drag one finger anywhere: candles move left/right AND up/down
  //  - drag up/down on the price axis: stretch / squash candles vertically
  //  - drag left/right on the time axis: spread / squeeze candles
  //  - pinch side to side: zoom time · pinch up and down (fingers above each other): zoom price
  //  - double-tap the chart or an axis: back to auto-fit
  gestures() {
    const host = this.host;
    host.ctChart = this;
    const btn = document.createElement('button');
    btn.className = 'chart-auto'; btn.textContent = 'AUTO'; btn.hidden = true; btn.title = 'Fit candles to screen';
    btn.onclick = (e) => { e.stopPropagation(); this.autoFit(); };
    host.appendChild(btn);
    const ps = () => this.chart.priceScale('right');
    const showBtn = () => { btn.hidden = ps().options().autoScale !== false; };
    let pinch = null, lastTap = 0, pan = null;
    const busy = () => this.draw?.tool || this.draw?.botDrag;
    const dist = (t) => Math.abs(t[0].clientY - t[1].clientY);
    host.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches, dx = Math.abs(a.clientX - b.clientX), dy = Math.abs(a.clientY - b.clientY);
        const r = ps().getVisibleRange?.();
        if (dy > dx * 1.2 && r) { // fingers stacked vertically: this is a price pinch, not a time pinch
          if (pan?.wasAuto) ps().applyOptions({ autoScale: true });
          pinch = { d0: Math.max(dy, 20), r, mid: (r.from + r.to) / 2 }; pan = null;
          e.stopPropagation(); e.preventDefault();
        }
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0], r = host.getBoundingClientRect();
        const inPane = t.clientX - r.left < r.width - ps().width() && t.clientY - r.top < r.height - this.chart.timeScale().height();
        pan = null;
        if (inPane && !busy()) { // free the price scale so the chart's own drag moves candles up/down too
          pan = { y0: t.clientY, dy: 0, wasAuto: ps().options().autoScale !== false };
          if (pan.wasAuto) ps().applyOptions({ autoScale: false });
        }
        const now = Date.now();
        if (now - lastTap < 280 && !this.draw?.tool) { this.autoFit(); lastTap = 0; } else lastTap = now;
      }
    }, { capture: true, passive: false });
    host.addEventListener('touchmove', (e) => {
      if (pan && e.touches.length === 1) { pan.dy = Math.max(pan.dy, Math.abs(e.touches[0].clientY - pan.y0)); return; }
      if (!pinch || e.touches.length !== 2) return;
      e.stopPropagation(); e.preventDefault();
      const k = pinch.d0 / Math.max(dist(e.touches), 20); // fingers apart → smaller range → taller candles
      const half = ((pinch.r.to - pinch.r.from) / 2) * k;
      ps().applyOptions({ autoScale: false });
      ps().setVisibleRange({ from: pinch.mid - half, to: pinch.mid + half });
      showBtn();
    }, { capture: true, passive: false });
    const end = (e) => { if (pinch && e.touches.length < 2) { pinch = null; showBtn(); } if (!e.touches.length && pan) { if (pan.wasAuto && pan.dy < 12) ps().applyOptions({ autoScale: true }); pan = null; } setTimeout(showBtn, 50); };
    host.addEventListener('touchend', end, { capture: true });
    host.addEventListener('touchcancel', end, { capture: true });
    host.addEventListener('pointerup', () => setTimeout(showBtn, 50));
    host.addEventListener('wheel', () => setTimeout(showBtn, 50), { passive: true });
  }

  autoFit() {
    this.chart.priceScale('right').applyOptions({ autoScale: true });
    this.chart.timeScale().applyOptions({ barSpacing: 7 });
    this.chart.timeScale().scrollToRealTime();
    const b = this.host.querySelector('.chart-auto'); if (b) b.hidden = true;
  }

  makeMain() {
    const L = this.L;
    if (this.main) this.chart.removeSeries(this.main);
    const common = { priceLineColor: '#ffffff55', lastValueVisible: true };
    const t = this.type;
    if (t === 'bars') this.main = this.chart.addSeries(L.BarSeries, { ...common, upColor: C.up, downColor: C.down, thinBars: false });
    else if (t === 'line') this.main = this.chart.addSeries(L.LineSeries, { ...common, color: '#ffffff', lineWidth: 2 });
    else if (t === 'area') this.main = this.chart.addSeries(L.AreaSeries, { ...common, lineColor: C.accent, topColor: 'rgba(124,92,255,0.35)', bottomColor: 'rgba(124,92,255,0)', lineWidth: 2 });
    else if (t === 'baseline') this.main = this.chart.addSeries(L.BaselineSeries, { ...common, topLineColor: C.up, bottomLineColor: C.down, topFillColor1: 'rgba(0,214,143,.25)', topFillColor2: 'rgba(0,214,143,0)', bottomFillColor1: 'rgba(255,59,92,0)', bottomFillColor2: 'rgba(255,59,92,.25)' });
    else if (t === 'hollow') this.main = this.chart.addSeries(L.CandlestickSeries, { ...common, upColor: 'rgba(0,0,0,0)', downColor: C.down, borderUpColor: C.up, borderDownColor: C.down, wickUpColor: C.up, wickDownColor: C.down });
    else this.main = this.chart.addSeries(L.CandlestickSeries, { ...common, upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down });
    for (const pl of this.priceLines) pl.handle = this.main.createPriceLine(pl.opts);
    this.markerPlugin = null;
    if (Object.keys(this.markerSets).length) this.applyMarkers();
  }

  setMarkerSet(kind, list) { this.markerSets[kind] = list || []; this.applyMarkers(); }

  applyMarkers() {
    if (!this.main) return;
    if (!this.markerPlugin) this.markerPlugin = this.L.createSeriesMarkers(this.main, []);
    const all = Object.values(this.markerSets).flat().sort((a, b) => a.time - b.time);
    this.markerPlugin.setMarkers(all.slice(-600));
  }

  // Bar that contains a moment in time (works for every timeframe, incl. weekly/monthly)
  barFor(tSec) {
    const c = this.candles; if (!c.length || tSec < c[0].time) return null;
    let lo = 0, hi = c.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m].time <= tSec) lo = m; else hi = m - 1; }
    return c[lo];
  }

  // Green ▲ buys and red ▼ sells with the arrow tip on the exact fill price.
  tradeMarkers(fills) {
    const out = [];
    for (const f of fills) {
      const bar = this.barFor(Math.floor(f.time / 1000));
      if (!bar || !(f.price > 0)) continue;
      const buy = f.side === 'buy';
      out.push({ time: bar.time, position: buy ? 'atPriceTop' : 'atPriceBottom', price: f.price, shape: buy ? 'arrowUp' : 'arrowDown', color: buy ? '#00d68f' : '#ff3b5c', size: 1, text: buy ? 'B' : f.pnl != null ? `${f.pnl >= 0 ? '+' : ''}${f.pnl.toFixed(2)}` : 'S' });
    }
    return out;
  }

  mainData(c = this.candles) {
    const src = this.type === 'heikin' ? heikin(c) : c;
    if (['line', 'area', 'baseline'].includes(this.type)) return src.map((x) => ({ time: x.time, value: x.close }));
    return src.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
  }

  setType(t) { this.type = t; this.makeMain(); this.render(); }

  setData(candles, tfSec) {
    this.candles = candles;
    this.tfSec = tfSec;
    this.refPrice = candles.length ? candles[candles.length - 1].close : 1;
    const d = decimalsFor(this.refPrice);
    this.priceFormat = { type: 'price', precision: d, minMove: Math.pow(10, -d) };
    this.chart.applyOptions({ timeScale: { timeVisible: tfSec < 86400 } });
    this.render();
    this.draw?.load();
  }

  render() {
    if (!this.candles.length) return;
    this.main.applyOptions({ priceFormat: this.priceFormat });
    if (this.type === 'baseline') this.main.applyOptions({ baseValue: { type: 'price', price: this.candles[0].close } });
    this.main.setData(this.mainData());
    this.renderIndicators();
    this.renderForecast();
    this.legend(null);
  }

  // live tick: update or append the last bar without a full redraw
  updateBar(bar) {
    if (!this.candles.length) return;
    const last = this.candles[this.candles.length - 1];
    if (bar.time < last.time) return;
    if (bar.time === last.time) this.candles[this.candles.length - 1] = bar; else this.candles.push(bar);
    if (this.type === 'heikin') { const h = heikin(this.candles.slice(-3)); const x = h[h.length - 1]; this.main.update({ time: x.time, open: x.open, high: x.high, low: x.low, close: x.close }); }
    else if (['line', 'area', 'baseline'].includes(this.type)) this.main.update({ time: bar.time, value: bar.close });
    else this.main.update({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    if (bar.time !== last.time || (this._indT || 0) < Date.now() - 4000) { this._indT = Date.now(); this.renderIndicators(); }
    this.legend(null);
  }

  // ---------- indicators ----------
  setIndicators(list) { this.indicators = list; this.renderIndicators(); }

  clearIndicators() {
    for (const s of this.indSeries) { try { this.chart.removeSeries(s); } catch { /* gone */ } }
    this.indSeries = [];
    const panes = this.chart.panes();
    for (let i = panes.length - 1; i > 0; i--) { try { this.chart.removePane(i); } catch { /* ignore */ } }
  }

  renderIndicators() {
    if (!this.chart || !this.candles.length) return;
    // keep the visible range stable while rebuilding
    const range = this.chart.timeScale().getVisibleLogicalRange();
    this.clearIndicators();
    const c = this.candles;
    const T = c.map((x) => x.time);
    const L = this.L;
    let pane = 0;
    const line = (vals, color, p, opts = {}) => {
      const s = this.chart.addSeries(L.LineSeries, { color, lineWidth: opts.w || 1, lineStyle: opts.style || 0, priceLineVisible: false, lastValueVisible: opts.last ?? false, crosshairMarkerVisible: false, priceFormat: opts.fmt || this.priceFormat, ...(opts.extra || {}) }, p);
      s.setData((opts.times || T).map((t, i) => (vals[i] == null ? { time: t } : { time: t, value: vals[i] })));
      this.indSeries.push(s);
      return s;
    };
    const hist = (vals, colors, p, fmt) => {
      const s = this.chart.addSeries(L.HistogramSeries, { priceLineVisible: false, lastValueVisible: false, priceFormat: fmt || { type: 'price', precision: 4, minMove: 0.0001 } }, p);
      s.setData(T.map((t, i) => (vals[i] == null ? { time: t } : { time: t, value: vals[i], color: colors(i) })));
      this.indSeries.push(s);
      return s;
    };
    const osc = { type: 'price', precision: 2, minMove: 0.01 };
    const level = (s, v, color = '#2a2f39') => s.createPriceLine({ price: v, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
    for (const ind of this.indicators) {
      const p = ind.params || I.INDICATORS[ind.id].params;
      const overlay = I.INDICATORS[ind.id].overlay;
      const P = overlay ? 0 : ++pane;
      switch (ind.id) {
        case 'MA': [p.p1, p.p2, p.p3].forEach((n, k) => n && line(I.sma(c.map((x) => x.close), n), PALETTE[k], 0)); break;
        case 'EMA': [p.p1, p.p2, p.p3].forEach((n, k) => n && line(I.ema(c.map((x) => x.close), n), PALETTE[k + 2], 0)); break;
        case 'WMA': line(I.wma(c.map((x) => x.close), p.p1), '#ff8a3d', 0); break;
        case 'BOLL': { const b = I.bollinger(c, p.period, p.mult); line(b.mid, '#f5c542', 0); line(b.upper, '#e86bff', 0); line(b.lower, '#22d3ee', 0); break; }
        case 'SAR': { const s = this.chart.addSeries(L.LineSeries, { color: '#e86bff', lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: this.priceFormat }, 0); const v = I.sar(c, p.step, p.max); s.setData(T.map((t, i) => (v[i] == null ? { time: t } : { time: t, value: v[i] }))); this.indSeries.push(s); break; }
        case 'VWAP': line(I.vwap(c), '#22d3ee', 0, { w: 2 }); break;
        case 'ST': {
          const st = I.supertrend(c, p.period, p.mult);
          line(st.line.map((v, i) => (st.dir[i] === 1 ? v : null)), C.up, 0, { w: 2 });
          line(st.line.map((v, i) => (st.dir[i] === -1 ? v : null)), C.down, 0, { w: 2 });
          break;
        }
        case 'ICHI': {
          const ic = I.ichimoku(c, p.conv, p.base, p.spanB);
          line(ic.tenkan, '#22d3ee', 0); line(ic.kijun, '#ff3b5c', 0);
          // leading spans are plotted 26 bars into the future
          const fut = T.map((t) => t + ic.disp * this.tfSec);
          line(ic.spanA, 'rgba(0,214,143,.8)', 0, { times: fut });
          line(ic.spanB, 'rgba(255,59,92,.8)', 0, { times: fut });
          line(ic.chikou.slice(ic.disp), '#8cff66', 0, { times: T.slice(0, T.length - ic.disp) });
          break;
        }
        case 'DC': { const d = I.donchian(c, p.period); line(d.upper, '#22d3ee', 0); line(d.lower, '#22d3ee', 0); line(d.mid, '#5a606c', 0, { style: 2 }); break; }
        case 'KC': { const k = I.keltner(c, p.period, p.mult); line(k.upper, '#e86bff', 0); line(k.mid, '#f5c542', 0); line(k.lower, '#e86bff', 0); break; }
        case 'VOL': {
          hist(c.map((x) => x.volume), (i) => (c[i].close >= c[i].open ? 'rgba(0,214,143,.55)' : 'rgba(255,59,92,.55)'), P, { type: 'volume' });
          line(I.sma(c.map((x) => x.volume), p.ma || 20), '#f5c542', P, { fmt: { type: 'volume' } });
          break;
        }
        case 'MACD': {
          const m = I.macd(c, p.fast, p.slow, p.signal);
          hist(m.hist, (i) => (m.hist[i] >= 0 ? (m.hist[i] >= (m.hist[i - 1] ?? 0) ? C.up : 'rgba(0,214,143,.45)') : m.hist[i] <= (m.hist[i - 1] ?? 0) ? C.down : 'rgba(255,59,92,.45)'), P, this.priceFormat);
          line(m.dif, '#ffffff', P); line(m.dea, '#f5c542', P);
          break;
        }
        case 'RSI': { const s = line(I.rsi(c, p.period), '#e86bff', P, { fmt: osc, last: true }); level(s, 70); level(s, 30); level(s, 50, '#181b21'); break; }
        case 'KDJ': { const k = I.kdj(c, p.n, p.m1, p.m2); line(k.k, '#ffffff', P, { fmt: osc }); line(k.d, '#f5c542', P, { fmt: osc }); const s = line(k.j, '#e86bff', P, { fmt: osc }); level(s, 80); level(s, 20); break; }
        case 'STOCHRSI': { const k = I.stochRsi(c, p.rsi, p.stoch, p.k, p.d); const s = line(k.k, '#22d3ee', P, { fmt: osc }); line(k.d, '#ff8a3d', P, { fmt: osc }); level(s, 80); level(s, 20); break; }
        case 'CCI': { const s = line(I.cci(c, p.period), '#22d3ee', P, { fmt: osc, last: true }); level(s, 100); level(s, -100); break; }
        case 'DMI': { const d = I.dmi(c, p.period); line(d.pdi, C.up, P, { fmt: osc }); line(d.mdi, C.down, P, { fmt: osc }); line(d.adx, '#f5c542', P, { fmt: osc, last: true }); break; }
        case 'OBV': line(I.obv(c), '#22d3ee', P, { fmt: { type: 'volume' }, last: true }); break;
        case 'ATR': line(I.atr(c, p.period), '#ff8a3d', P, { last: true }); break;
        case 'WR': { const s = line(I.williamsR(c, p.period), '#e86bff', P, { fmt: osc, last: true }); level(s, -20); level(s, -80); break; }
        case 'MFI': { const s = line(I.mfi(c, p.period), '#8cff66', P, { fmt: osc, last: true }); level(s, 80); level(s, 20); break; }
        case 'ROC': { const s = line(I.roc(c, p.period), '#22d3ee', P, { fmt: osc, last: true }); level(s, 0); break; }
        default: break;
      }
    }
    const panes = this.chart.panes();
    const h = this.host.clientHeight;
    const sub = Math.max(64, Math.min(110, h * 0.17));
    for (let i = 1; i < panes.length; i++) panes[i].setHeight(sub);
    if (range) this.chart.timeScale().setVisibleLogicalRange(range);
  }

  // ---------- forecast: the "look into the future" layer ----------
  setForecast(fc) { this.forecast = fc; this.renderForecast(); }

  renderForecast() {
    for (const s of this.fcSeries) { try { this.chart.removeSeries(s); } catch { /* gone */ } }
    this.fcSeries = [];
    const fc = this.forecast;
    if (!fc || !fc.points?.length || !this.candles.length) return;
    const L = this.L;
    const last = this.candles[this.candles.length - 1];
    const start = { time: last.time, value: last.close };
    const mk = (key, color, style, w) => {
      const s = this.chart.addSeries(L.LineSeries, { color, lineWidth: w, lineStyle: style, priceLineVisible: false, lastValueVisible: key === 'mid', crosshairMarkerVisible: false, priceFormat: this.priceFormat, title: key === 'mid' ? 'AI' : '' }, 0);
      if (key !== 'mid') s.applyOptions({ autoscaleInfoProvider: () => null }); // bands never squash the candles
      s.setData([start, ...fc.points.filter((p) => p.time > last.time).map((p) => ({ time: p.time, value: p[key] }))]);
      this.fcSeries.push(s);
    };
    mk('upper', 'rgba(0,214,143,.55)', 2, 1);
    mk('lower', 'rgba(255,59,92,.55)', 2, 1);
    mk('mid', '#7c5cff', 0, 2);
  }

  // Show the forecast horizon in view
  revealFuture() {
    const ts = this.chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const n = this.candles.length;
    const span = r.to - r.from;
    const h = this.forecast?.points?.length || 30;
    ts.setVisibleLogicalRange({ from: n - span + h * 0.8, to: n + h * 1.1 });
  }

  // ---------- price lines (orders, alerts, bot grids) ----------
  setPriceLines(lines) {
    for (const pl of this.priceLines) { try { this.main.removePriceLine(pl.handle); } catch { /* gone */ } }
    this.priceLines = lines.map((l) => {
      const opts = { price: l.price, color: l.color || '#5a606c', lineWidth: l.width || 1, lineStyle: l.style ?? 2, axisLabelVisible: l.label !== false, title: l.title || '' };
      return { opts, handle: this.main.createPriceLine(opts) };
    });
  }

  legend(param) {
    if (!this.onLegend || !this.candles.length) return;
    let bar = null;
    if (param?.time) bar = this.candles.find((x) => x.time === param.time);
    if (!bar) bar = this.candles[this.candles.length - 1];
    const i = this.candles.indexOf(bar);
    const prev = this.candles[i - 1] || bar;
    const ch = ((bar.close - prev.close) / prev.close) * 100;
    const f = (v) => fmtPrice(v, this.refPrice);
    this.onLegend(`<b>O</b> ${f(bar.open)} <b>H</b> ${f(bar.high)} <b>L</b> ${f(bar.low)} <b>C</b> <span class="${ch >= 0 ? 'up' : 'down'}">${f(bar.close)} ${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span><br><b>V</b> ${fmtAmt(bar.volume)}`);
  }

  // coordinate helpers used by the drawing layer (time may lie in the future)
  timeToX(t) {
    const c = this.candles; if (!c.length) return null;
    const n = c.length - 1;
    let idx;
    if (t >= c[n].time) idx = n + (t - c[n].time) / this.tfSec;
    else if (t <= c[0].time) idx = (t - c[0].time) / this.tfSec;
    else {
      let lo = 0, hi = n;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m].time <= t) lo = m; else hi = m; }
      idx = lo + (t - c[lo].time) / (c[hi].time - c[lo].time);
    }
    return this.chart.timeScale().logicalToCoordinate(idx);
  }

  xToTime(x) {
    const c = this.candles; const n = c.length - 1;
    const l = this.chart.timeScale().coordinateToLogical(x);
    if (l == null) return null;
    if (l >= n) return c[n].time + (l - n) * this.tfSec;
    if (l <= 0) return c[0].time + l * this.tfSec;
    const lo = Math.floor(l);
    return c[lo].time + (l - lo) * (c[lo + 1].time - c[lo].time);
  }

  barAtX(x) {
    const l = this.chart.timeScale().coordinateToLogical(x);
    if (l == null) return null;
    return this.candles[Math.round(l)] || null;
  }

  priceToY(p) { return this.main.priceToCoordinate(p); }
  yToPrice(y) { return this.main.coordinateToPrice(y); }

  // show the most recent candles with a little room on the right for the future
  fit(bars = 90) {
    const n = this.candles.length;
    if (!n) return;
    this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - bars), to: n + 10 });
  }
  destroy() { this.draw?.destroy(); this.chart?.remove(); }
}
