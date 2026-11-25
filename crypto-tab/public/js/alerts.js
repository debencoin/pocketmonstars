// Alerts + the persistent alarm.
// A triggered alert keeps ringing (looping siren, vibration, screen kept awake, repeated
// push notifications from the server) until the user presses STOP.
import { api, qs, conn, base, token } from './api.js';
import { $, esc, fmtPrice, store, sheet, haptic, toast, ago } from './ui.js';

let ctx = null, ringTimer = null, vibTimer = null, wake = null, ringing = new Map();
const local = () => store.get('localAlerts', []);

// iOS / Android need a user gesture before audio can play: unlock on the first tap.
export function unlockAudio() {
  const go = () => {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* no audio */ }
  };
  ['touchend', 'click'].forEach((ev) => window.addEventListener(ev, go, { once: false, passive: true }));
}

function tone(freq, start, dur, type = 'square', vol = 0.35) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(vol, start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(ctx.destination); o.start(start); o.stop(start + dur + 0.05);
  return o;
}

const SOUNDS = {
  siren(t) { for (let i = 0; i < 4; i++) { const o = tone(700, t + i * 0.5, 0.48, 'sawtooth', 0.3); o.frequency.linearRampToValueAtTime(1400, t + i * 0.5 + 0.45); } return 2; },
  beep(t) { for (let i = 0; i < 6; i++) tone(1046, t + i * 0.22, 0.12, 'square', 0.3); return 1.8; },
  chime(t) { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, t + i * 0.18, 0.6, 'sine', 0.4)); return 1.6; },
  ping(t) { tone(1568, t, 0.25, 'sine', 0.35); tone(2093, t + 0.12, 0.3, 'sine', 0.25); return 0.6; },
};

export function playOnce(name = 'ping') {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); SOUNDS[name](ctx.currentTime + 0.02); } catch { /* ignore */ }
}

function startRing(sound = 'siren') {
  if (ringTimer) return;
  const loop = () => {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); const d = (SOUNDS[sound] || SOUNDS.siren)(ctx.currentTime + 0.02); ringTimer = setTimeout(loop, d * 1000 + 250); } catch { ringTimer = setTimeout(loop, 2000); }
  };
  loop();
  vibTimer = setInterval(() => { try { navigator.vibrate?.([700, 250, 700, 250]); } catch { /* unsupported */ } }, 1900);
  navigator.wakeLock?.request('screen').then((w) => (wake = w)).catch(() => {});
}

function stopRing() {
  clearTimeout(ringTimer); ringTimer = null;
  clearInterval(vibTimer); vibTimer = null;
  try { navigator.vibrate?.(0); } catch { /* ignore */ }
  wake?.release?.().catch(() => {}); wake = null;
}

export function alarmOn(a, app) {
  ringing.set(a.id, a);
  const box = $('#alarm');
  box.hidden = false;
  const list = [...ringing.values()];
  const first = list[0];
  $('#alarm-title').textContent = list.length > 1 ? `${list.length} price alerts` : `${first.symbol} ${describe(first)}`;
  $('#alarm-sub').textContent = `Now ${fmtPrice(first.triggerPrice ?? first.lastPrice)}`;
  $('#alarm-list').innerHTML = list.map((x) => `<div>${esc(x.symbol)} · ${esc(x.exchange)} ${x.note ? '· ' + esc(x.note) : ''}</div>`).join('');
  startRing(first.sound);
  $('#alarm-stop').onclick = () => stopAll(app);
  $('#alarm-view').onclick = () => { stopAll(app); app.set({ ex: first.exchange, symbol: first.symbol }); app.go('chart'); };
  if (document.hidden && Notification?.permission === 'granted') navigator.serviceWorker?.ready.then((r) => r.showNotification(`⏰ ${first.symbol} ${describe(first)}`, { body: 'Tap to stop the alarm', tag: `alarm-${first.id}`, requireInteraction: true, renotify: true, vibrate: [800, 300, 800, 300, 800] }));
}

export function alarmOff(id) {
  ringing.delete(id);
  if (!ringing.size) { $('#alarm').hidden = true; stopRing(); }
}

async function stopAll(app) {
  const ids = [...ringing.keys()];
  ringing.clear();
  $('#alarm').hidden = true;
  stopRing();
  haptic(30);
  for (const id of ids) {
    if (id.startsWith('L')) { const L = local(); const a = L.find((x) => x.id === id); if (a) a.status = a.repeat ? 'active' : 'done'; store.set('localAlerts', L); }
    else await api(`/api/alerts/${id}/ack`, { method: 'POST', body: {} }).catch(() => {});
  }
  navigator.serviceWorker?.ready.then((r) => r.getNotifications().then((ns) => ns.forEach((n) => n.tag?.startsWith('alarm-') && n.close())));
  app.refreshAlertBadge?.();
}

export function describe(a) {
  return { above: `≥ ${fmtPrice(a.price)}`, below: `≤ ${fmtPrice(a.price)}`, cross: `crossed ${fmtPrice(a.price)}`, pctUp: `+${a.pct}%`, pctDown: `-${a.pct}%` }[a.condition] || '';
}

// --- demo / offline alerts are checked by the open app itself ---
export function startLocalChecker(app) {
  setInterval(async () => {
    const L = local();
    const act = L.filter((a) => a.status === 'active');
    if (!act.length) return;
    for (const a of act) {
      try {
        const t = await api(`/api/ticker${qs({ ex: a.exchange, symbol: a.symbol })}`);
        const prev = a.lastPrice ?? t.p; a.lastPrice = t.p;
        const hit = a.condition === 'above' ? t.p >= a.price : a.condition === 'below' ? t.p <= a.price : a.condition === 'cross' ? (prev < a.price && t.p >= a.price) || (prev > a.price && t.p <= a.price) : a.condition === 'pctUp' ? t.p >= a.refPrice * (1 + a.pct / 100) : t.p <= a.refPrice * (1 - a.pct / 100);
        if (hit) { a.status = 'ringing'; a.triggerPrice = t.p; a.triggeredAt = Date.now(); alarmOn(a, app); }
      } catch { /* skip */ }
    }
    store.set('localAlerts', L);
  }, 4000);
}

// ---------------- push notifications ----------------
export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(/iPhone|iPad/.test(navigator.userAgent) ? 'On iPhone: Share → Add to Home Screen, open Crypto Tab from the home screen, then enable notifications.' : 'This browser does not support push notifications');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for this site');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api('/api/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) });
  await api('/api/push/subscribe', { method: 'POST', body: sub.toJSON() });
  // let the service worker stop alarms from the notification's "Stop" button
  const c = await caches.open('ct-auth');
  await c.put('/__auth', new Response(JSON.stringify({ base: base() || location.origin, token: token() })));
  return true;
}
function urlB64(s) { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...b].map((c) => c.charCodeAt(0))); }

// ---------------- alerts sheet ----------------
export function alertsSheet(app, preset = {}) {
  sheet('Price alerts', async (body) => {
    const draw = async () => {
      let list = [];
      try { list = conn.demo ? local() : await api('/api/alerts'); } catch (e) { toast(e.message, 'err'); }
      const p = preset.price ?? app.last?.p ?? '';
      body.innerHTML = `
        <div class="card">
          <div class="row between" style="margin-bottom:10px"><button class="ch-pair" id="al-pair">${esc(app.S.symbol)} <small>${esc(app.S.ex)}</small> <span class="dim">▾</span></button><span class="num muted">${fmtPrice(app.last?.p)}</span></div>
          <div class="seg" id="al-cond" style="margin-bottom:10px">${[['above', 'Above'], ['below', 'Below'], ['cross', 'Cross'], ['pctUp', '+%'], ['pctDown', '−%']].map(([k, l]) => `<button data-c="${k}" class="${k === (preset.condition || 'above') ? 'active' : ''}">${l}</button>`).join('')}</div>
          <div class="field"><input class="input" id="al-price" inputmode="decimal" placeholder="Price" value="${p ? +Number(p).toPrecision(8) : ''}"></div>
          <div class="field"><input class="input" id="al-note" placeholder="Note (optional)" style="font-family:var(--sans)" value="${esc(preset.note || '')}"></div>
          <div class="row between" style="margin-bottom:10px"><span style="font-size:13px">Re-arm after I stop it</span><button class="toggle" id="al-rep"></button></div>
          <div class="row between" style="margin-bottom:12px"><span style="font-size:13px">Alarm sound</span><select class="input" id="al-sound" style="width:auto;height:38px">${Object.keys(SOUNDS).map((s) => `<option>${s}</option>`).join('')}</select></div>
          <div class="grid2"><button class="btn" id="al-test">▶ Test alarm</button><button class="btn primary" id="al-add">Create alert</button></div>
        </div>
        <button class="btn block" id="al-push" style="margin:10px 0">🔔 Enable lock-screen notifications</button>
        <div class="dim" style="font-size:11px;line-height:1.5;margin-bottom:12px">The alarm keeps sounding until you press STOP while the app is open. With notifications on, your server re-sends the alert every 30 seconds until you stop it, even when the phone is locked.</div>
        <div class="label">Your alerts</div>
        ${list.length ? list.map((a) => `<div class="order-item"><div><b>${esc(a.symbol)}</b> <span class="pill ${a.status === 'ringing' ? 'down' : a.status === 'active' ? 'up' : ''}">${a.status}</span>${a.repeat ? ' <span class="pill">repeat</span>' : ''}<div class="dim" style="font-size:12px">${esc(a.exchange)} · ${describe(a)}${a.note ? ' · ' + esc(a.note) : ''} · ${ago(a.createdAt)} ago</div></div><button class="btn sm" data-del="${a.id}">✕</button></div>`).join('') : '<div class="muted" style="font-size:13px;padding:10px 0">No alerts yet</div>'}`;
      let cond = preset.condition || 'above';
      const priceIn = $('#al-price', body);
      const setPh = () => { priceIn.placeholder = cond.startsWith('pct') ? 'Percent move from now, e.g. 5' : 'Price'; };
      setPh();
      $('#al-cond', body).onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cond = b.dataset.c; body.querySelectorAll('#al-cond button').forEach((x) => x.classList.toggle('active', x === b)); if (cond.startsWith('pct')) priceIn.value = '5'; setPh(); };
      $('#al-rep', body).onclick = (e) => e.target.classList.toggle('on');
      $('#al-pair', body).onclick = () => app.pickSymbol(() => draw());
      $('#al-test', body).onclick = () => alarmOn({ id: 'Ltest', symbol: app.S.symbol, exchange: app.S.ex, condition: cond, price: Number(priceIn.value), pct: Number(priceIn.value), lastPrice: app.last?.p, sound: $('#al-sound', body).value, note: 'Test' }, app);
      $('#al-push', body).onclick = async () => { try { await enablePush(); await api('/api/push/test', { method: 'POST', body: {} }); toast('Notifications enabled', 'ok'); } catch (e) { toast(e.message, 'err'); } };
      $('#al-add', body).onclick = async () => {
        const v = Number(priceIn.value);
        if (!(v > 0)) return toast('Enter a value', 'err');
        const a = { exchange: app.S.ex, symbol: app.S.symbol, condition: cond, price: cond.startsWith('pct') ? null : v, pct: cond.startsWith('pct') ? v : null, note: $('#al-note', body).value, repeat: $('#al-rep', body).classList.contains('on'), sound: $('#al-sound', body).value };
        try {
          if (conn.demo) { const L = local(); L.unshift({ ...a, id: 'L' + Date.now().toString(36), status: 'active', createdAt: Date.now(), refPrice: app.last?.p, lastPrice: app.last?.p }); store.set('localAlerts', L); }
          else await api('/api/alerts', { method: 'POST', body: a });
          haptic(20); toast('Alert created', 'ok'); preset = {}; draw(); app.refreshAlertBadge?.();
        } catch (e) { toast(e.message, 'err'); }
      };
      body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
        if (conn.demo) store.set('localAlerts', local().filter((x) => x.id !== b.dataset.del));
        else await api(`/api/alerts/${b.dataset.del}`, { method: 'DELETE', body: {} }).catch(() => {});
        draw(); app.refreshAlertBadge?.();
      }));
    };
    draw();
  });
}

export async function activeCount() {
  try { const l = conn.demo ? local() : await api('/api/alerts', { quiet: true }); return l.filter((a) => a.status !== 'done').length; } catch { return 0; }
}
