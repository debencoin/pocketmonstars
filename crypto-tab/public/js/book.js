// Order book + recent trades renderers (exchange-style with depth bars).
import { fmtPrice, fmtAmt, esc } from './ui.js';

export function renderBook(el, ob, { rows = 9, last, change, onPrice, grouping = 0, mode = 'both' } = {}) {
  if (!ob) { el.innerHTML = '<div class="empty"><span class="spinner"></span></div>'; return; }
  const group = (side, asc) => {
    if (!grouping) return side;
    const m = new Map();
    for (const [p, a] of side) { const k = (asc ? Math.ceil(p / grouping) : Math.floor(p / grouping)) * grouping; m.set(k, (m.get(k) || 0) + a); }
    return [...m.entries()].sort((x, y) => (asc ? x[0] - y[0] : y[0] - x[0]));
  };
  const nAsk = mode === 'bids' ? 0 : mode === 'asks' ? rows * 2 : rows;
  const nBid = mode === 'asks' ? 0 : mode === 'bids' ? rows * 2 : rows;
  const asks = group(ob.asks, true).slice(0, nAsk).reverse();
  const bids = group(ob.bids, false).slice(0, nBid);
  let cum = 0; const askCum = asks.slice().reverse().map(([, a]) => (cum += a)).reverse();
  cum = 0; const bidCum = bids.map(([, a]) => (cum += a));
  const max = Math.max(askCum[0] || 0, bidCum[bidCum.length - 1] || 0) || 1;
  const ref = last ?? ob.bids[0]?.[0] ?? ob.asks[0]?.[0];
  const row = (cls, [p, a], c) => `<div class="bk-row ${cls}" data-p="${p}"><i class="bar" style="width:${Math.min(100, (c / max) * 100)}%"></i><span>${fmtPrice(p, ref)}</span><span>${fmtAmt(a)}</span></div>`;
  const spread = ob.asks[0] && ob.bids[0] ? ob.asks[0][0] - ob.bids[0][0] : 0;
  el.innerHTML = `<div class="book">
    <div class="bk-head"><span>Price</span><span>Amount</span></div>
    ${asks.map((x, i) => row('bk-ask', x, askCum[i])).join('')}
    <div class="bk-mid"><b class="${change >= 0 ? 'up' : 'down'}">${fmtPrice(ref, ref)}</b><small>Spread ${fmtPrice(spread, ref)} (${((spread / ref) * 100).toFixed(3)}%)</small></div>
    ${bids.map((x, i) => row('bk-bid', x, bidCum[i])).join('')}
    <div class="bk-ratio">${ratioBar(ob)}</div>
  </div>`;
  if (onPrice) el.querySelectorAll('.bk-row').forEach((r) => (r.onclick = () => onPrice(Number(r.dataset.p))));
}

function ratioBar(ob) {
  const b = ob.bids.slice(0, 20).reduce((s, [p, a]) => s + p * a, 0);
  const a = ob.asks.slice(0, 20).reduce((s, [p, x]) => s + p * x, 0);
  const pb = (b / (a + b || 1)) * 100;
  return `<div style="display:flex;height:18px;border-radius:5px;overflow:hidden;margin-top:6px;font-size:10px;font-weight:700;font-family:var(--sans)">
    <div style="width:${pb}%;background:var(--up-bg);color:var(--up);padding-left:4px;display:flex;align-items:center">B ${pb.toFixed(0)}%</div>
    <div style="flex:1;background:var(--down-bg);color:var(--down);padding-right:4px;display:flex;align-items:center;justify-content:flex-end">${(100 - pb).toFixed(0)}% S</div></div>`;
}

export function renderTrades(el, trades, ref) {
  if (!trades) { el.innerHTML = '<div class="empty"><span class="spinner"></span></div>'; return; }
  el.innerHTML = `<div class="book trades-list"><div class="bk-head"><span>Price</span><span>Amount</span><span>Time</span></div>${trades.slice(0, 30).map((t) => `<div class="bk-row"><span class="${t.s === 'buy' ? 'up' : 'down'}">${fmtPrice(t.p, ref)}</span><span>${fmtAmt(t.a)}</span><span class="dim">${new Date(t.t).toLocaleTimeString([], { hour12: false })}</span></div>`).join('')}</div>`;
}

export function groupingSteps(price) {
  const d = Math.pow(10, Math.floor(Math.log10(price)) - 4);
  return [0, d, d * 10, d * 100, d * 1000].map((x) => Number(x.toPrecision(2)));
}

export { esc };
