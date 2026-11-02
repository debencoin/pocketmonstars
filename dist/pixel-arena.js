'use strict';
// PocketMonstars pixel arena renderer: a 320x180 native-resolution battlefield scaled up with crisp pixels.
// Draws animated pixel Monstars and a hand-built animation for every power. Exposes window.PMArena.
(() => {
const NAMES = ['cindercub', 'mossprout', 'ripplefin', 'voltwing', 'duskhorn', 'pebblit', 'frostuft', 'bloomtail', 'soloryx', 'seraphon', 'psyvolt'];
const W = 320, H = 180, K = 1 / 3; // world (960x540) -> logical pixels; the canvas is 2x (640x360) so sprites keep fine detail
const CW = 640, CH = 360, Z = 2;
const STAGE_SCALE = [0.6, 0.72, 0.85, 1.0, 1.12, 1.25];
const imgs = NAMES.map(n => { const i = new Image(); i.src = 'art/pixel/' + n + '.png'; return i; });
const cache = new Map();
const PAL = {
  EMBER: ['#fff6a8', '#ffd23f', '#ff8a1f', '#e8401c', '#7a2a1c'], TIDE: ['#ffffff', '#bfefff', '#5ec2ff', '#2b7be0', '#163c8c'],
  GROVE: ['#f6ffd0', '#b8f070', '#5fbf3a', '#2f7d2a', '#5a3a1e'], SPARK: ['#ffffff', '#fff6a0', '#ffe14a', '#e0a020', '#6a4a10'],
  SHADE: ['#f0d8ff', '#b98cff', '#7a4ad8', '#3a1e6e', '#120a22'], STONE: ['#efe2c0', '#c8b088', '#8f7a5a', '#5e4e38', '#2e261c'],
  FROST: ['#ffffff', '#dff8ff', '#9be6ff', '#4ab0e0', '#20607e'], ASTRAL: ['#ffffff', '#fff3c4', '#ffd97a', '#f0a030', '#8a4a10'],
  PETAL: ['#ffffff', '#ffd6e6', '#ff9cc2', '#e0568e', '#7a2048'],
  PSYCHIC: ['#ffffff', '#ead8ff', '#c08cff', '#8a4ae0', '#3a1870'], HOLY: ['#ffffff', '#fffbe6', '#ffe9a0', '#f0c050', '#8a6a20'],
};
const STY = { projectile: { r: 12 }, bolt: { range: 420, hitAt: 0.08, dur: 0.22 }, whip: { range: 220, hitAt: 0.12, dur: 0.3 },
  cone: { range: 230, angle: 0.5, dur: 0.95 }, beam: { range: 640, width: 44, hitAt: 0.42, dur: 0.85 }, strike: { radius: 74, hitAt: 0.6, dur: 1.0 }, levitate: { dur: 1.5, throws: [0.7, 0.86, 1.02], boltAt: 1.22 } };

function sprite(sid, hue = 0, white = false) {
  const img = imgs[sid]; if (!img?.complete || !img.naturalWidth) return null;
  const key = sid + '|' + hue + '|' + white; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (hue) x.filter = `hue-rotate(${hue}deg)`; x.drawImage(img, 0, 0); x.filter = 'none';
  if (white) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
  cache.set(key, c); return c;
}

// Evolution looks, built from the base sprite: Infant sits in a cracked egg shell, Ultimate glows in its type colour,
// Mega grows a pair of wings, Ascended has four wings and a golden halo.
function stageSprite(sid, hue, stage, pal, white = false) {
  const base = sprite(sid, hue, white); if (!base) return null;
  const key = 'st|' + sid + '|' + hue + '|' + stage + '|' + white; let c = cache.get(key); if (c) return c;
  const legend = sid >= 9, wings = legend ? 0 : stage >= 5 ? 4 : stage >= 4 ? 2 : 0, pad = wings ? 34 : 4;
  c = document.createElement('canvas'); c.width = base.width + pad * 2; c.height = base.height + pad + 6;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; const ox = pad, oy = pad;
  const P = (px_, py_, w, h, col) => { x.fillStyle = white ? '#ffffff' : col; x.fillRect(Math.round(px_), Math.round(py_), w, h); };
  if (wings) { // large feather wings spreading up and out from the shoulders (two at Mega, four at Ascended)
    const cx = ox + base.width * 0.45, cy = oy + base.height * 0.28;
    for (let k = 0; k < wings; k++) {
      const up = k < 2, dir = k % 2 ? 1 : -1, len = up ? 34 : 22;
      for (let f = 0; f < 6; f++) {
        const a2 = up ? -0.3 - f * 0.2 : 0.12 + f * 0.13, L = len - Math.abs(f - 2) * 2.2;
        for (let s2 = 4; s2 < L; s2++) {
          const wx = cx + dir * Math.cos(a2) * s2, wy = cy + Math.sin(a2) * s2 + (up ? 0 : 8);
          P(wx, wy, 3, 2, s2 > L - 4 ? '#ffffff' : f % 2 ? pal[1] : pal[0]);
          if (s2 % 5 === 0) P(wx, wy + 2, 3, 1, pal[2]);
        }
      }
    }
  }
  if (stage >= 3 && !white) { // glowing outline: gold when Ascended, type colour otherwise
    const t = document.createElement('canvas'); t.width = base.width; t.height = base.height; const tx = t.getContext('2d');
    tx.drawImage(base, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = stage >= 5 ? '#ffd23f' : pal[2]; tx.fillRect(0, 0, t.width, t.height);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) x.drawImage(t, ox + dx, oy + dy);
  }
  if (stage === 0 && !white) x.filter = 'saturate(0.8) brightness(1.15)';
  x.drawImage(base, ox, oy); x.filter = 'none';
  if (stage === 0) { // cracked egg shell around the lower half
    const ew = base.width * 0.9, ex = ox + (base.width - ew) / 2, ey = oy + base.height * 0.55, eh = base.height * 0.47;
    for (let yy = 0; yy < eh; yy++) { const t2 = yy / eh, w = Math.round(ew * (0.86 + t2 * 0.14) * Math.sqrt(1 - Math.pow(t2, 3) * 0.6));
      P(ex + (ew - w) / 2, ey + yy, w, 1, yy < 2 ? '#d8d0c0' : '#f6f0e2'); }
    for (let k = 0; k < 6; k++) P(ex + 3 + k * (ew - 6) / 5, ey - (k % 2 ? 3 : 0), 3, 3, '#f6f0e2');
    P(ex + ew * 0.3, ey + eh * 0.4, 4, 2, '#c8b898'); P(ex + ew * 0.62, ey + eh * 0.6, 3, 2, '#c8b898');
  }
  if (stage >= 5 && !white) { const hx = ox + base.width * 0.55, hy = oy - 3; P(hx - 7, hy, 15, 1, '#ffd23f'); P(hx - 9, hy + 1, 2, 1, '#ffd23f'); P(hx + 8, hy + 1, 2, 1, '#ffd23f'); P(hx - 7, hy + 2, 15, 1, '#ffd23f'); }
  cache.set(key, c); return c;
}

// ---------- tiny pixel helpers ----------
let g; // current 2d context
const R = Math.round;
function px(x, y, w, h, col) { g.fillStyle = col; g.fillRect(R(x), R(y), w, h); }
function disc(cx, cy, r, col) { g.fillStyle = col; cx = R(cx); cy = R(cy); for (let dy = -r; dy <= r; dy++) { const w = R(Math.sqrt(Math.max(0, r * r - dy * dy))); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
function ring(cx, cy, rx, ry, col) { g.fillStyle = col; const n = Math.max(16, R(rx * 5)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.fillRect(R(cx + Math.cos(a) * rx), R(cy + Math.sin(a) * ry), 1, 1); } }
function ellipse(cx, cy, rx, ry, col) { g.fillStyle = col; cx = R(cx); cy = R(cy); for (let dy = -ry; dy <= ry; dy++) { const w = R(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)))); g.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }
function line(x1, y1, x2, y2, col, w = 1) { g.fillStyle = col; const n = Math.max(1, R(Math.hypot(x2 - x1, y2 - y1))); for (let i = 0; i <= n; i++) g.fillRect(R(x1 + (x2 - x1) * i / n - w / 2), R(y1 + (y2 - y1) * i / n - w / 2), w, w); }
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- arenas (top-down, like a stadium floor seen from above) ----------
const THEMES = [
  { name: 'Stone Coliseum', a: '#55596a', b: '#4b4f60', line: '#2c2f3c', mark: '#6fd8c8', crack: '#33364a' },
  { name: 'Dust Bowl', a: '#8a6a48', b: '#7f6142', line: '#5e4630', mark: '#e8dcc0', crack: '#5a4230' },
  { name: 'Grass Pitch', a: '#4f9a3c', b: '#468e35', line: '#3a7a2c', mark: '#e8f4e0', crack: '#3c7a2e' },
  { name: 'Cosmic Dome', a: '#241c52', b: '#20184a', line: '#3a2e7a', mark: '#b06ad8', crack: '#2e2464' },
];
const grounds = {};
function buildGround(rocks, theme = 0) {
  const T = THEMES[theme % THEMES.length];
  const c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d');
  const r = rng(11 + theme * 7);
  if (theme === 0) { // flagstones
    px(0, 0, W, H, T.a);
    for (let y = 0; y < H; y += 12) { const off = (y / 12) % 2 ? 9 : 0; for (let x = -off; x < W; x += 18) { px(x, y, 18, 12, r() < 0.5 ? T.a : T.b); px(x, y, 18, 1, T.line); px(x, y, 1, 12, T.line); } }
    for (let i = 0; i < 26; i++) { let x = r() * W, y = r() * H; for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 6; y += r() * 3; px(x, y, 1, 1, T.crack); } }
  } else if (theme === 2) { // mowed stripes
    for (let x = 0; x < W; x += 20) px(x, 0, 20, H, (x / 20) % 2 ? T.a : T.b);
    for (let i = 0; i < 300; i++) px(r() * W, r() * H, 1, 1, T.line);
  } else if (theme === 3) { // cosmic grid
    px(0, 0, W, H, T.a);
    for (let x = 0; x < W; x += 16) px(x, 0, 1, H, T.line); for (let y = 0; y < H; y += 16) px(0, y, W, 1, T.line);
    for (let i = 0; i < 60; i++) px(r() * W, r() * H, 1, 1, r() < 0.3 ? '#ffffff' : '#8a7ad8');
  } else { // dirt
    px(0, 0, W, H, T.a);
    for (let i = 0; i < 900; i++) px(r() * W, r() * H, r() < 0.2 ? 2 : 1, 1, r() < 0.5 ? T.b : '#94744f');
    for (let i = 0; i < 18; i++) { let x = r() * W, y = r() * H; for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 5; y += r() * 3; px(x, y, 1, 1, T.crack); } }
  }
  // field markings: boundary, halfway line, big centre circle
  const m = T.mark, dash = theme === 1;
  const lineH = (x, y, w) => { for (let i = 0; i < w; i++) if (!dash || (i >> 2) % 2 === 0) px(x + i, y, 1, 1, m); };
  const lineV = (x, y, h) => { for (let i = 0; i < h; i++) if (!dash || (i >> 2) % 2 === 0) px(x, y + i, 1, 1, m); };
  g.globalAlpha = theme === 0 ? 0.9 : 0.6;
  lineH(14, 22, W - 28); lineH(14, H - 10, W - 28); lineV(14, 22, H - 32); lineV(W - 15, 22, H - 32); lineV(160, 22, H - 32);
  if (theme === 0) { for (let k = 0; k < 2; k++) ring(160, 96, 52 + k, 52 + k, m); disc(160, 96, 13, '#e8d8a0'); disc(160, 96, 11, '#f4e6b0'); ring(160, 96, 13, 13, m); }
  else { ring(160, 96, 40, 40, m); ring(160, 96, 6, 6, m); lineH(14, 70, 26); lineV(40, 70, 52); lineH(14, 122, 26); lineH(W - 40, 70, 26); lineV(W - 41, 70, 52); lineH(W - 40, 122, 26); }
  g.globalAlpha = 1;
  // stands / wall along the top
  px(0, 0, W, 16, theme === 3 ? '#140e34' : '#2a2c36');
  for (let x = 2; x < W; x += 5) px(x, 4 + (x % 3), 3, 3, ['#d8584a', '#4a8ad8', '#e8c84a', '#58b858', '#d8d8d8'][(x / 5 | 0) % 5]);
  px(0, 16, W, 2, theme === 3 ? '#3a2e7a' : '#8a8c96');
  for (const k of rocks) { // boulders
    const cx = k.x * K, cy = k.y * K, rr = R(k.r * K);
    ellipse(cx + 1, cy + rr * 0.7, rr, R(rr * 0.4), '#00000044');
    disc(cx, cy, rr, '#5e5a52'); disc(cx - 1, cy - 1, rr - 1, '#8a857a'); disc(cx - R(rr / 3), cy - R(rr / 3), R(rr / 2), '#aaa496');
  }
  return c;
}

// ---------- renderer ----------
function createRenderer(canvas, arena) {
  canvas.width = CW; canvas.height = CH;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  let parts = [], decals = [], texts = [], trails = [[], []], shake = 0, flash = 0, impacts = new Set(), lastNow = performance.now();
  let banner = null, grow = [0, 0], theme = 0;
  const groundFor = th => (grounds[th] ||= buildGround(arena.rocks, th));

  function part(x, y, vx, vy, life, col, size = 1, grav = 0) { parts.push({ x, y, vx, vy, life, max: life, col, size, grav }); }
  function burst(x, y, pal, n = 10, spd = 40) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = spd * (0.4 + Math.random()); part(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.3, pal[1 + (i % 3)], Math.random() < 0.3 ? 2 : 1); } }
  function palFor(ty, sid) { return sid === 7 ? PAL.PETAL : sid === 9 ? PAL.HOLY : PAL[ty] || PAL.STONE; }
  function say(x, y, txt, col, t = 1, size = 8) { texts.push({ x, y, txt, col, t, size }); }

  /** Battle events from the server or the local practice engine. */
  function event(ev, snap) {
    if (!snap) return;
    if (ev.type === 'miss') { const v = snap.f[ev.victim ?? 1 - ev.attacker]; say(v.x * K, v.y * K - 22, 'MISS', '#d8d8e8', 0.8); return; }
    if (ev.type === 'level') {
      const f = snap.f[ev.side];
      if (ev.evolved) { banner = { txt: `${ev.name || 'Your Monstar'} evolved into ${ev.stage.toUpperCase()}!`, t: 2.6, side: ev.side }; grow[ev.side] = 1.2; flash = Math.max(flash, 0.5); burst(f.x * K, f.y * K - 10, PAL.HOLY, 40, 90); }
      else say(f.x * K, f.y * K - 38, `LEVEL UP! Lv${ev.level}`, '#ffe14a', 1.3, 8);
      return;
    }
    if (ev.type === 'bonus') { const f = snap.f[ev.side]; say(f.x * K, f.y * K - 30, `+${ev.exp} EXP bonus`, '#8fd0ff', 1.4, 6); return; }
    const v = snap.f[ev.victim], a = snap.f[ev.attacker]; if (!v || !a) return;
    const x = v.x * K, y = v.y * K - 10;
    burst(x, y, ev.eff > 1 ? PAL.SPARK : ['#fff', '#fff', '#ffe', '#fdd'], 12, 50);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 + Math.PI / 4; part(x, y, Math.cos(an) * 70, Math.sin(an) * 70, 0.15, '#ffffff', 2); }
    say(x, y - 14, String(ev.damage), ev.crit ? '#ff5a4a' : ev.eff > 1 ? '#ffd23f' : '#ffffff', 0.9, ev.crit ? 10 : 8);
    if (ev.crit) say(x, y - 26, 'CRITICAL!', '#ff8a5a', 1.1, 7);
    else if (ev.eff > 1) say(x, y - 26, 'SUPER EFFECTIVE!', '#ffb030', 1.1, 6);
    else if (ev.eff < 1) say(x, y - 26, 'NOT VERY EFFECTIVE', '#b0b0c0', 1.1, 5);
    // earnings over the attacker: SOL (paid when the match ends) and EXP
    const ax = a.x * K, ay = a.y * K - 34;
    if (ev.fee) { say(ax, ay, '+' + ev.fee + ' SOL', '#9ef0c8', 1.4, 6); say(x, y + 12, '-' + ev.fee + ' SOL', '#ff6b6b', 1.4, 6); } // earned by the attacker, deducted from the one hit
    if (ev.exp) say(ax, ay + (ev.fee ? 9 : 0), '+' + ev.exp + ' EXP', '#8fd0ff', 1.4, 6);
    shake = Math.max(shake, ev.style === 'beam' || ev.style === 'strike' ? 0.3 : 0.12);
  }
  const hit = (ev, snap) => event({ type: 'hit', ...ev }, snap);

  // ---------- fighters (drawn at full 640x360 resolution) ----------
  function drawFighter(f, prev, t, i, opt) {
    const now = opt.now / 1000;
    const wx = prev ? prev.x + (f.x - prev.x) * t : f.x, wy = prev ? prev.y + (f.y - prev.y) * t : f.y;
    const pal = palFor(opt.type, f.s), stage = f.sg ?? 0;
    const spr = stageSprite(f.s, opt.hue || 0, stage, pal), wh = stageSprite(f.s, opt.hue || 0, stage, pal, true);
    if (!spr) return;
    grow[i] = Math.max(0, grow[i] - opt.dt * 0.8);
    const sc = STAGE_SCALE[stage] * (1 + Math.sin(grow[i] * 12) * 0.12 * grow[i]);
    const dw = Math.round(spr.width * sc), dh = Math.round(spr.height * sc);
    let X = wx * K * Z, Y = wy * K * Z + 22; // feet in canvas pixels
    const tr = trails[i]; if (f.ds) tr.push({ x: X, y: Y, life: 0.22 }); for (const q of tr) q.life -= opt.dt; trails[i] = tr.filter(q => q.life > 0);
    let ox = 0, oy = 0, sx = 1, sy = 1, alpha = 1, rot = 0;
    const mo = f.mo || 'pounce', phase = now + i * 0.37;
    if (f.fl) oy -= 10 + Math.sin(phase * 3) * 3; // hovering / levitating
    if (f.mv && !f.ds) {
      if (mo === 'pounce' || mo === 'prance') { const s2 = Math.abs(Math.sin(phase * 10)); oy -= s2 * 7; if (s2 < 0.2) { sx = 1.08; sy = 0.9; } }
      else if (mo === 'stomp' || mo === 'charge') { oy -= Math.abs(Math.sin(phase * 7)) * 3; if (Math.random() < 0.15) part(X / Z, Y / Z, (Math.random() - 0.5) * 10, -6, 0.4, '#b8a888', 1); }
      else if (mo === 'dart') { ox += (Math.random() - 0.5) * 2; oy -= Math.abs(Math.sin(phase * 16)) * 3; }
      else if (mo === 'glide' || mo === 'skate') { rot = (f.fx < 0 ? -1 : 1) * 0.06; if (Math.random() < 0.3) part(X / Z, Y / Z, 0, 0, 0.35, mo === 'skate' ? '#dff8ff' : '#bfefff', 1); }
      else if (mo === 'blink') oy -= Math.abs(Math.sin(phase * 8)) * 3;
    } else if (!f.fl) oy -= (Math.floor(phase * 2.4) % 2) ? 2 : 0;
    if (f.ct < 0.16) { ox += f.fx * 10 * (1 - f.ct / 0.16); oy += f.fy * 6 * (1 - f.ct / 0.16); }
    if (f.hu > 0) ox += (Math.random() - 0.5) * 4;
    if (f.i && Math.floor(now * 20) % 2) alpha = 0.5;
    if (f.bk > 0) alpha *= 0.3 + (1 - f.bk / 0.35) * 0.7;
    if (opt.faint) { oy += opt.faint * 20; alpha *= 1 - opt.faint; sy *= 1 - opt.faint * 0.5; }
    const flip = f.fx < 0;
    // shadow (smaller and lighter when airborne)
    ctx.globalAlpha = (f.fl ? 0.2 : 0.35) * alpha; ctx.fillStyle = '#10141a';
    ctx.beginPath(); ctx.ellipse(Math.round(X), Math.round(Y), Math.round(dw * (f.fl ? 0.22 : 0.3)), f.fl ? 3 : 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // dash: speed lines + afterimages
    for (const q of trails[i]) { ctx.globalAlpha = q.life * 2.5; blit(wh, q.x, q.y + oy, dw, dh, flip, 1, 1, 0); }
    if (f.ds) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(X - f.fx * (20 + k * 9) - 8), Math.round(Y - dh * 0.2 - k * 7 + Math.random() * 4), 14, 2); }
    if (f.bk > 0) { ctx.fillStyle = '#d8b8ff'; ctx.globalAlpha = f.bk / 0.35; for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(X + (Math.random() - 0.5) * dw), Math.round(Y - dh - 10 + Math.random() * dh), 2, 10); }
    ctx.globalAlpha = alpha;
    if (f.ck === 'special' && f.ct < 0.45) for (let k = 0; k < 4; k++) { const an = Math.random() * 6.283, d = dw * 0.4 + Math.random() * 10; ctx.fillStyle = pal[1 + (k % 3)]; ctx.fillRect(Math.round(X + Math.cos(an) * d), Math.round(Y - dh / 2 + oy + Math.sin(an) * d), 3, 3); }
    const blinkW = f.hu > 0 && Math.floor(now * 30) % 2 === 0;
    blit(blinkW || grow[i] > 0.9 ? wh : spr, X + ox, Y + oy, dw, dh, flip, sx, sy, rot);
    ctx.globalAlpha = 1;
    if (f.g) { ctx.strokeStyle = Math.floor(now * 8) % 2 ? '#fff6a8' : '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(X), Math.round(Y - dh / 2 + oy), Math.round(dw * 0.55), 0, Math.PI * 2); ctx.stroke(); }
    if (!opt.faint) { // owner marker
      const mx = Math.round(X), my = Math.round(Y - dh - 10 + oy + (Math.floor(now * 3) % 2) * 2);
      ctx.fillStyle = opt.you ? '#9ef0c8' : '#ff6b6b'; ctx.fillRect(mx - 4, my, 9, 2); ctx.fillRect(mx - 2, my + 2, 5, 2); ctx.fillRect(mx, my + 4, 1, 2);
    }
  }
  function blit(img, fx, fy, w, h, flip, sx, sy, rot) {
    const dw = Math.round(w * sx), dh = Math.round(h * sy);
    ctx.save(); ctx.translate(Math.round(fx), Math.round(fy)); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1); ctx.drawImage(img, -Math.round(dw / 2), -dh, dw, dh); ctx.restore();
  }

  function projectile(p, x, y, now) {
    const pal = palFor(p.ty, p.sid), a = Math.atan2(p.vy, p.vx), fl = Math.floor(now * 20) % 2;
    y -= 8;
    if (p.sid === 0) { // fireball
      disc(x, y, 4 + fl, pal[3]); disc(x, y, 3, pal[2]); disc(x + Math.cos(a), y, 1 + fl, pal[0]);
      part(x - Math.cos(a) * 4, y + (Math.random() - 0.5) * 3, -p.vx * K * 0.1, -8 - Math.random() * 10, 0.3, pal[1 + (Math.random() * 3 | 0)], 2);
    } else if (p.sid === 2) { // water pulse
      ring(x, y, 5, 5, pal[2]); ring(x, y, 3 + fl, 3 + fl, pal[1]); px(x - 2, y - 2, 2, 1, '#fff');
      if (Math.random() < 0.5) part(x, y, (Math.random() - 0.5) * 10, 10, 0.3, pal[2], 1, 60);
    } else if (p.sid === 4) { // shadow orb
      disc(x, y, 5, pal[3]); disc(x, y, 3, pal[4]); for (let k = 0; k < 4; k++) { const b = now * 9 + k * 1.57; px(x + Math.cos(b) * 7, y + Math.sin(b) * 7, 2, 2, pal[1]); }
    } else if (p.sid === 5) { // rock
      const rot = Math.floor(now * 12) % 2; disc(x, y, 4, pal[3]); px(x - 2 + rot, y - 3, 3, 2, pal[1]); px(x + 1, y + 1 - rot, 2, 2, pal[4]);
      if (Math.random() < 0.4) part(x, y + 3, -p.vx * K * 0.05, 0, 0.3, pal[1]);
    } else if (p.sid === 6) { // ice shard
      const c = Math.cos(a), s = Math.sin(a); line(x - c * 6, y - s * 6, x + c * 6, y + s * 6, pal[3], 2); line(x - c * 4, y - s * 4, x + c * 5, y + s * 5, pal[0], 1);
      if (Math.random() < 0.6) part(x - c * 6, y - s * 6, 0, 0, 0.25, pal[1]);
    } else if (p.sid === 7) { // petal storm
      for (let k = 0; k < 3; k++) { const b = now * 14 + k * 2.09; const qx = x + Math.cos(b) * 4, qy = y + Math.sin(b) * 4; px(qx, qy, 2, 2, pal[2]); px(qx, qy, 1, 1, pal[1]); }
    } else if (p.st === 'debris') { // psychic-hurled boulder
      const fl2 = Math.floor(now * 16) % 2; ring(x, y, 7 + fl2, 7 + fl2, PAL.PSYCHIC[2]); disc(x, y, 5, '#6e665c'); disc(x - 1, y - 1, 3, '#9a9284'); px(x + 2, y + 1, 2, 2, '#4e483e');
      if (Math.random() < 0.7) part(x, y, -p.vx * K * 0.05, -p.vy * K * 0.05, 0.3, PAL.PSYCHIC[1 + (Math.random() * 2 | 0)], 1);
    } else if (p.sid === 10) { // psy orb
      disc(x, y, 4 + fl, PAL.PSYCHIC[3]); disc(x, y, 3, PAL.PSYCHIC[2]); px(x - 1, y - 1, 2, 2, '#fff');
      for (let k = 0; k < 3; k++) { const b = now * 10 + k * 2.09; px(x + Math.cos(b) * 6, y + Math.sin(b) * 6, 1, 1, PAL.PSYCHIC[1]); }
    } else { disc(x, y, 3, pal[2]); }
  }

  function effect(e, lt, now) {
    const pal = palFor(e.ty, e.sid), ox = e.x * K, oy = e.y * K - 8, dx = e.dx, dy = e.dy, S = STY[e.st];
    if (e.st === 'bolt') {
      const len = S.range * K, fade = 1 - lt / S.dur; g.globalAlpha = Math.max(0, fade);
      if (e.sid === 3) { // lightning arc
        const r = rng(e.id * 31 + Math.floor(now / 50)); let lx = ox, ly = oy; const nx = -dy, ny = dx;
        for (let k = 1; k <= 10; k++) { const tx = ox + dx * len * k / 10 + nx * (k < 10 ? (r() - 0.5) * 12 : 0), ty = oy + dy * len * k / 10 + ny * (k < 10 ? (r() - 0.5) * 12 : 0); line(lx, ly, tx, ty, pal[2], 2); line(lx, ly, tx, ty, '#ffffff', 1); lx = tx; ly = ty; }
      } else if (e.sid === 9) { // holy lance: white spear of light with feathers
        line(ox, oy, ox + dx * len, oy + dy * len, PAL.HOLY[3], 3); line(ox, oy, ox + dx * len, oy + dy * len, '#ffffff', 1);
        const tx = ox + dx * len, ty = oy + dy * len; px(tx - 2, ty - 2, 5, 5, PAL.HOLY[1]);
        if (Math.random() < 0.6) { const d = Math.random() * len; part(ox + dx * d, oy + dy * d, (Math.random() - 0.5) * 12, 8, 0.5, '#ffffff', 2, 10); }
      } else { // solar ray
        line(ox, oy, ox + dx * len, oy + dy * len, pal[3], 4); line(ox, oy, ox + dx * len, oy + dy * len, pal[1], 2); line(ox, oy, ox + dx * len, oy + dy * len, '#ffffff', 1);
        if (Math.random() < 0.7) { const d = Math.random() * len; part(ox + dx * d, oy + dy * d, 0, -15, 0.3, pal[1]); }
      }
      g.globalAlpha = 1;
    } else if (e.st === 'whip') { // vine lash
      const grow = Math.min(1, lt / S.hitAt), back = lt > S.hitAt + 0.06 ? 1 - (lt - S.hitAt - 0.06) / (S.dur - S.hitAt - 0.06) : 1;
      const len = S.range * K * grow * Math.max(0, back), nx = -dy, ny = dx; let lx = ox, ly = oy;
      for (let k = 1; k <= 14; k++) { const d = len * k / 14, w = Math.sin(k * 0.9 + now / 60) * 3 * (k / 14); const tx = ox + dx * d + nx * w, ty = oy + dy * d + ny * w;
        line(lx, ly, tx, ty, pal[3], 2); if (k % 3 === 0) { px(tx + nx * 2, ty + ny * 2, 2, 2, pal[2]); px(tx - nx * 2, ty - ny * 2, 1, 1, pal[1]); } lx = tx; ly = ty; }
      px(lx - 1, ly - 1, 3, 3, pal[2]);
    } else if (e.st === 'cone') { // flamethrower
      if (lt < S.dur) for (let k = 0; k < 6; k++) { const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * S.angle * 1.6, sp = S.range * K * (2.4 + Math.random());
        part(ox + dx * 6, oy + dy * 6, Math.cos(a) * sp, Math.sin(a) * sp - 6, 0.36, null, 2 + (Math.random() < 0.3 ? 1 : 0), -20, 'flame'); }
    } else if (e.st === 'beam') {
      const len = S.range * K, wid = R(S.width * K);
      if (lt < S.hitAt) { // charge
        const p = lt / S.hitAt, r = 2 + R(p * 6); disc(ox + dx * 8, oy + dy * 8, r, pal[2]); disc(ox + dx * 8, oy + dy * 8, R(r / 2), pal[0]);
        for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, d = 18 * (1 - p) + 6; part(ox + dx * 8 + Math.cos(a) * d, oy + dy * 8 + Math.sin(a) * d, -Math.cos(a) * 40, -Math.sin(a) * 40, 0.15, pal[1]); }
      } else {
        const p = (lt - S.hitAt) / (S.dur - S.hitAt), w = Math.max(1, R(wid * (p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.6) / 0.4))));
        g.save(); g.translate(R(ox + dx * 6), R(oy + dy * 6)); g.rotate(Math.atan2(dy, dx));
        g.fillStyle = pal[3]; g.fillRect(0, -R(w / 2) - 1, len, w + 2); g.fillStyle = pal[2]; g.fillRect(0, -R(w / 2), len, w);
        g.fillStyle = pal[1]; g.fillRect(0, -R(w / 4), len, Math.max(1, R(w / 2))); g.fillStyle = pal[0]; g.fillRect(0, 0, len, 1);
        const scroll = (now / 8) % 12;
        if (e.sid === 2) { g.fillStyle = '#ffffff'; for (let s = -scroll; s < len; s += 12) { g.fillRect(R(s), -R(w / 3), 5, 1); g.fillRect(R(s + 6), R(w / 4), 4, 1); } } // hydro jet streaks
        if (e.sid === 6) { for (let s = 10 - scroll; s < len; s += 16) { g.fillStyle = pal[0]; g.fillRect(R(s), -R(w / 2) - 3, 1, 3); g.fillRect(R(s) - 1, -R(w / 2) - 2, 3, 1); g.fillRect(R(s), R(w / 2) + 1, 1, 3); g.fillRect(R(s) - 1, R(w / 2) + 2, 3, 1); } } // ice crystals
        g.restore();
        if (e.sid === 8 && p < 0.2) flash = Math.max(flash, 0.35); // supernova flash
        disc(ox + dx * 6, oy + dy * 6, R(w / 2) + 2, pal[1]);
      }
    } else if (e.st === 'levitate') { // debris rises around the user, gets hurled, then lightning chains to the rival
      const P2 = PAL.PSYCHIC, lift = Math.min(1, lt / 0.6);
      ring(ox, oy + 10, 16 + Math.sin(now / 80) * 2, 6, P2[2]); ring(ox, oy + 10, 20, 8, P2[3]);
      for (let k = 0; k < 3; k++) {
        if (lt >= STY.levitate.throws[k]) continue;
        const a = k * 2.1 + 0.6 + now / 400, rx = ox + Math.cos(a) * 15, ry = oy - 4 + Math.sin(a) * 8 - lift * 10;
        ring(rx, ry, 6, 6, P2[1]); disc(rx, ry, 4, '#6e665c'); disc(rx - 1, ry - 1, 2, '#9a9284');
        if (Math.random() < 0.5) part(rx, ry + 5, (Math.random() - 0.5) * 6, 10, 0.3, '#8a7a60', 1, 20);
      }
      if (lt < 0.4 && Math.random() < 0.8) part(ox + (Math.random() - 0.5) * 30, oy + 12, 0, -30, 0.4, P2[1], 1);
      if (lt >= STY.levitate.boltAt && e.gx) { // chained lightning, purple turning electric
        const tx = e.gx * K, ty = e.gy * K - 8, r2 = rng(e.id * 7 + Math.floor(now / 45)); let lx = ox, ly = oy - 6;
        g.globalAlpha = Math.max(0, 1 - (lt - STY.levitate.boltAt) / 0.28);
        for (let k = 1; k <= 9; k++) { const qx = ox + (tx - ox) * k / 9 + (k < 9 ? (r2() - 0.5) * 12 : 0), qy = oy - 6 + (ty - oy + 6) * k / 9 + (k < 9 ? (r2() - 0.5) * 12 : 0);
          line(lx, ly, qx, qy, k < 4 ? P2[2] : '#ffe14a', 2); line(lx, ly, qx, qy, '#ffffff', 1); lx = qx; ly = qy; }
        g.globalAlpha = 1; if (!impacts.has('b' + e.id)) { impacts.add('b' + e.id); burst(tx, ty, PAL.SPARK, 14, 60); shake = Math.max(shake, 0.25); }
      }
    } else if (e.st === 'strike') {
      const gx = e.gx * K, gy = e.gy * K + 6, rad = R(S.radius * K);
      if (lt < S.hitAt) { // telegraph
        const p = lt / S.hitAt, blink = Math.floor(now / 90) % 2;
        ring(gx, gy, rad * (1.4 - p * 0.4), rad * 0.5 * (1.4 - p * 0.4), blink ? pal[2] : '#ffffff');
        if (e.sid === 5) { // meteor falls in
          ellipse(gx, gy, R(rad * p * 0.8) + 1, R(rad * p * 0.3) + 1, '#00000044');
          const my = gy - 120 * (1 - p); disc(gx + (1 - p) * 30, my, 5, pal[3]); disc(gx + (1 - p) * 30 - 1, my - 1, 3, pal[1]);
          part(gx + (1 - p) * 30, my - 4, 8, -10, 0.25, PAL.EMBER[2], 2);
        }
        if (e.sid === 9) { g.globalAlpha = 0.4 + 0.3 * Math.sin(now / 60); g.fillStyle = PAL.HOLY[1]; g.fillRect(R(gx - 2), 18, 4, R(gy - 18)); g.globalAlpha = 1; }
        if (e.sid === 3 || e.sid === 4) { ellipse(gx, 10, 18, 5, e.sid === 3 ? '#4a4a5a' : '#2a1640'); ellipse(gx - 6, 8, 10, 4, e.sid === 3 ? '#5a5a6e' : '#3a1e56'); } // storm cloud / eclipse
      } else {
        const p = (lt - S.hitAt) / (S.dur - S.hitAt);
        if (!impacts.has(e.id)) { impacts.add(e.id); shake = Math.max(shake, 0.35);
          burst(gx, gy - 4, pal, 22, 70);
          if (e.sid === 5 || e.sid === 3 || e.sid === 1) decals.push({ x: gx, y: gy, r: rad, kind: e.sid === 1 ? 'roots' : 'crater', life: 8 });
          if (decals.length > 10) decals.shift(); }
        g.globalAlpha = Math.max(0, 1 - p);
        if (e.sid === 3) { const r = rng(e.id + Math.floor(now / 40)); let lx = gx, ly = 8; for (let k = 1; k <= 8; k++) { const tx = gx + (k < 8 ? (r() - 0.5) * 14 : 0), ty = 8 + (gy - 8) * k / 8; line(lx, ly, tx, ty, pal[2], 3); line(lx, ly, tx, ty, '#fff', 1); lx = tx; ly = ty; } ellipse(gx, gy, rad, R(rad / 2), pal[1]); }
        else if (e.sid === 4) { g.fillStyle = pal[3]; g.fillRect(R(gx - rad / 2), 0, R(rad), R(gy)); g.fillStyle = pal[4]; g.fillRect(R(gx - rad / 4), 0, R(rad / 2), R(gy)); ellipse(gx, gy, rad, R(rad / 2), pal[2]); }
        else if (e.sid === 1) { for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283, h = R((p < 0.3 ? p / 0.3 : 1) * (10 + (k % 3) * 4)), rx = gx + Math.cos(a) * rad * 0.6, ry = gy + Math.sin(a) * rad * 0.25;
          px(rx - 1, ry - h, 3, h, PAL.GROVE[4]); px(rx, ry - h, 1, h, '#7a5a30'); px(rx - 2, ry - h, 2, 2, PAL.GROVE[2]); px(rx + 1, ry - h + 2, 2, 2, PAL.GROVE[1]); } }
        else if (e.sid === 7) { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + p * 3, d = rad * (0.2 + p); px(gx + Math.cos(a) * d, gy - 6 + Math.sin(a) * d * 0.5, 3, 2, pal[2]); px(gx + Math.cos(a) * d, gy - 6 + Math.sin(a) * d * 0.5, 1, 1, pal[0]); } disc(gx, gy - 6, R(4 * (1 - p)) + 1, '#ffe14a'); }
        else if (e.sid === 9) { // heaven's judgment: column of light and falling feathers
          const w2 = R(rad * (1 - p * 0.5)); g.fillStyle = PAL.HOLY[2]; g.fillRect(R(gx - w2 / 2), 0, w2, R(gy)); g.fillStyle = '#ffffff'; g.fillRect(R(gx - w2 / 4), 0, R(w2 / 2), R(gy));
          ellipse(gx, gy, rad, R(rad / 2), PAL.HOLY[1]); if (Math.random() < 0.8) part(gx + (Math.random() - 0.5) * rad * 2, gy - 50 - Math.random() * 30, (Math.random() - 0.5) * 10, 18, 0.9, '#ffffff', 2, 0);
        }
        else { ellipse(gx, gy, R(rad * (0.6 + p * 0.6)), R(rad * 0.3 * (0.6 + p * 0.6)), pal[2]); }
        g.globalAlpha = 1;
      }
    }
  }

  function draw(prev, cur, t, view) {
    const now = performance.now(), dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now; g = ctx;
    theme = cur?.ar ?? view.theme ?? 0;
    let sx = 0, sy = 0; if (shake > 0) { sx = R((Math.random() - 0.5) * 4 * shake * 3); sy = R((Math.random() - 0.5) * 4 * shake * 3); shake = Math.max(0, shake - dt); }
    const logical = () => ctx.setTransform(Z, 0, 0, Z, sx * Z, sy * Z), full = () => ctx.setTransform(1, 0, 0, 1, sx * Z, sy * Z);
    logical(); ctx.drawImage(groundFor(theme), 0, 0);
    for (const d of decals) { d.life -= dt; g.globalAlpha = Math.min(1, d.life / 2);
      if (d.kind === 'crater') { ellipse(d.x, d.y, R(d.r * 0.7), R(d.r * 0.28), '#00000055'); ellipse(d.x, d.y + 1, R(d.r * 0.5), R(d.r * 0.18), '#00000077'); for (let k = 0; k < 5; k++) px(d.x - d.r * 0.6 + k * d.r * 0.3, d.y - 3 + (k % 2) * 6, 2, 2, '#00000066'); }
      else { ellipse(d.x, d.y, R(d.r * 0.6), R(d.r * 0.22), '#3a2a1a88'); } }
    g.globalAlpha = 1; decals = decals.filter(d => d.life > 0);
    if (cur) {
      const lagged = (now - view.snapAt) / 1000;
      for (const e of cur.e || []) if (e.st === 'strike') effect(e, e.t + lagged, now);
      full();
      const order = cur.f.map((f, i) => i).sort((a, b) => cur.f[a].y - cur.f[b].y);
      for (const i of order) drawFighter(cur.f[i], prev?.f[i], t, i, { now, dt, you: i === view.you, hue: view.hues?.[i] || 0, type: view.types?.[i], faint: view.faint?.[i] || 0 });
      logical();
      for (const e of cur.e || []) if (e.st !== 'strike') effect(e, e.t + lagged, now);
      for (const p of cur.p || []) { const pp = prev?.p?.find(o => o.id === p.id); projectile(p, (pp ? pp.x + (p.x - pp.x) * t : p.x) * K, (pp ? pp.y + (p.y - pp.y) * t : p.y) * K, now); }
    }
    for (const p of parts) {
      p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      let col = p.col; if (!col) { const q = 1 - p.life / p.max; col = q < 0.2 ? PAL.EMBER[0] : q < 0.45 ? PAL.EMBER[1] : q < 0.7 ? PAL.EMBER[2] : q < 0.9 ? PAL.EMBER[3] : '#6a6060'; }
      g.globalAlpha = Math.min(1, p.life / p.max * 2); px(p.x, p.y, p.size, p.size, col);
    }
    g.globalAlpha = 1; parts = parts.filter(p => p.life > 0); if (parts.length > 700) parts = parts.slice(-700);
    ctx.textAlign = 'center';
    for (const tx of texts) { tx.t -= dt; tx.y -= 12 * dt; g.globalAlpha = Math.min(1, tx.t * 3); ctx.font = tx.size + 'px "Press Start 2P", monospace';
      ctx.fillStyle = '#141018'; ctx.fillText(tx.txt, R(tx.x) + 1, R(tx.y) + 1); ctx.fillStyle = tx.col; ctx.fillText(tx.txt, R(tx.x), R(tx.y)); }
    g.globalAlpha = 1; texts = texts.filter(tx => tx.t > 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (flash > 0) { g.globalAlpha = flash; g.fillStyle = '#ffffff'; g.fillRect(0, 0, CW, CH); g.globalAlpha = 1; flash = Math.max(0, flash - dt * 1.5); }
    if (view.fight > 0) { // "FIGHT!" splash
      const a = Math.min(1, view.fight * 2), s = 1 + (1 - Math.min(1, (1.4 - view.fight) * 4)) * 0.6;
      ctx.save(); ctx.translate(CW / 2, CH / 2); ctx.scale(s, s); ctx.globalAlpha = a; ctx.font = '40px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1a1024'; ctx.fillText('FIGHT!', 4, 4); ctx.fillStyle = '#ffd23f'; ctx.fillText('FIGHT!', 0, 0); ctx.restore(); ctx.globalAlpha = 1;
    }
    if (banner) { banner.t -= dt; const a = Math.min(1, banner.t * 2);
      ctx.globalAlpha = a; ctx.fillStyle = '#141018dd'; ctx.fillRect(0, CH / 2 - 26, CW, 52); ctx.fillStyle = '#ffd23f'; ctx.fillRect(0, CH / 2 - 26, CW, 2); ctx.fillRect(0, CH / 2 + 24, CW, 2);
      ctx.font = '13px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.fillText(banner.txt, CW / 2, CH / 2 + 1); ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1; if (banner.t <= 0) banner = null; }
  }
  function reset() { parts = []; decals = []; texts = []; trails = [[], []]; impacts.clear(); shake = 0; flash = 0; banner = null; grow = [0, 0]; }
  return { draw, hit, event, reset, idle: (th = theme) => { g = ctx; ctx.setTransform(Z, 0, 0, Z, 0, 0); ctx.drawImage(groundFor(th), 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }, themes: THEMES };
}

window.PMArena = { createRenderer, sprite, stageSprite, STAGE_SCALE, THEMES, spriteSrc: sid => 'art/pixel/' + NAMES[sid] + '.png', W, H, onReady: cb => Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(cb) };
})();
