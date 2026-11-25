// Small UI toolkit: formatting, storage, toasts, bottom sheets, haptics.

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem('ct.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ct.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtPrice(v, ref) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(ref ?? v);
  const d = a >= 10000 ? 1 : a >= 1000 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function decimalsFor(v) { const a = Math.abs(v); return a >= 10000 ? 1 : a >= 1000 ? 2 : a >= 10 ? 3 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9; }
export function fmtAmt(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : v.toPrecision(3);
}
export const fmtPct = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);
export const fmtUsd = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`);
export const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');
export const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? `${s | 0}s` : s < 3600 ? `${(s / 60) | 0}m` : s < 86400 ? `${(s / 3600) | 0}h` : `${(s / 86400) | 0}d`; };
export const time = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }

export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 4500 : 2600);
}

// Bottom sheet. Returns { el, close }. `render(el, close)` fills it.
export function sheet(title, render, { onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="grab"></div><h3><span>${esc(title)}</span><button class="close" aria-label="Close">✕</button></h3><div class="sheet-body"></div>`;
  const close = () => { bd.remove(); el.remove(); onClose?.(); };
  bd.onclick = close;
  el.querySelector('.close').onclick = close;
  // swipe down to close
  let y0 = null;
  el.addEventListener('touchstart', (e) => { if (el.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchmove', (e) => { if (y0 != null && e.touches[0].clientY - y0 > 90) { y0 = null; close(); } }, { passive: true });
  root.append(bd, el);
  render(el.querySelector('.sheet-body'), close);
  return { el, close };
}

export function confirmSheet(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    sheet(title, (b, close) => {
      b.innerHTML = `<p class="muted" style="margin:0 0 16px;line-height:1.5">${text}</p><div class="grid2"><button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'sell' : 'primary'}" data-ok>${esc(okLabel)}</button></div>`;
      b.querySelector('[data-no]').onclick = () => { done = true; close(); resolve(false); };
      b.querySelector('[data-ok]').onclick = () => { done = true; close(); resolve(true); };
    }, { onClose: () => { if (!done) resolve(false); } });
  });
}

// Build a form from strategy field specs: [key, label, type, default, hint]
export function fieldsHtml(fields, values = {}) {
  return fields.map(([k, label, type, d, hint]) => {
    const v = values[k] ?? d ?? '';
    if (type === 'bool') return `<div class="field"><div class="row between"><label>${esc(label)}</label><button type="button" class="toggle ${v ? 'on' : ''}" data-key="${k}" data-bool></button></div>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
    if (type.startsWith('select:')) {
      const opts = type.slice(7).split(',');
      return `<div class="field"><label>${esc(label)}</label><select class="input" data-key="${k}">${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
    }
    return `<div class="field"><label>${esc(label)}</label><input class="input" data-key="${k}" inputmode="decimal" value="${v == null ? '' : esc(v)}" placeholder="${type === 'number' && d == null ? 'optional' : ''}">${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
  }).join('');
}

export function readFields(root) {
  const out = {};
  for (const el of root.querySelectorAll('[data-key]')) {
    if (el.hasAttribute('data-bool')) out[el.dataset.key] = el.classList.contains('on');
    else out[el.dataset.key] = el.value === '' ? null : isNaN(Number(el.value)) ? el.value : Number(el.value);
  }
  return out;
}

export function wireToggles(root) {
  root.querySelectorAll('.toggle').forEach((t) => (t.onclick = () => { t.classList.toggle('on'); haptic(); }));
}
