'use strict';
// PocketMonstars pixel arena renderer: a 320x180 native-resolution battlefield scaled up with crisp pixels.
// Draws animated pixel Monstars and a hand-built animation for every power. Exposes window.PMArena.
(() => {
const NAMES = ['cindercub', 'mossprout', 'ripplefin', 'voltwing', 'duskhorn', 'pebblit', 'frostuft', 'bloomtail', 'soloryx'];
const W = 320, H = 180, K = 1 / 3; // world (960x540) -> pixels
const imgs = NAMES.map(n => { const i = new Image(); i.src = 'art/pixel/' + n + '.png'; return i; });
const cache = new Map();
const PAL = {
  EMBER: ['#fff6a8', '#ffd23f', '#ff8a1f', '#e8401c', '#7a2a1c'], TIDE: ['#ffffff', '#bfefff', '#5ec2ff', '#2b7be0', '#163c8c'],
  GROVE: ['#f6ffd0', '#b8f070', '#5fbf3a', '#2f7d2a', '#5a3a1e'], SPARK: ['#ffffff', '#fff6a0', '#ffe14a', '#e0a020', '#6a4a10'],
  SHADE: ['#f0d8ff', '#b98cff', '#7a4ad8', '#3a1e6e', '#120a22'], STONE: ['#efe2c0', '#c8b088', '#8f7a5a', '#5e4e38', '#2e261c'],
  FROST: ['#ffffff', '#dff8ff', '#9be6ff', '#4ab0e0', '#20607e'], ASTRAL: ['#ffffff', '#fff3c4', '#ffd97a', '#f0a030', '#8a4a10'],
  PETAL: ['#ffffff', '#ffd6e6', '#ff9cc2', '#e0568e', '#7a2048'],
};
const STY = { projectile: { r: 12 }, bolt: { range: 420, hitAt: 0.08, dur: 0.22 }, whip: { range: 220, hitAt: 0.12, dur: 0.3 },
  cone: { range: 230, angle: 0.5, dur: 0.95 }, beam: { range: 640, width: 44, hitAt: 0.42, dur: 0.85 }, strike: { radius: 74, hitAt: 0.6, dur: 1.0 } };

function sprite(sid, hue = 0, white = false) {
  const img = imgs[sid]; if (!img?.complete || !img.naturalWidth) return null;
  const key = sid + '|' + hue + '|' + white; let c = cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (hue) x.filter = `hue-rotate(${hue}deg)`; x.drawImage(img, 0, 0); x.filter = 'none';
  if (white) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
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

// ---------- static ground (prerendered) ----------
let ground = null;
function buildGround(rocks) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; g = c.getContext('2d');
  const r = rng(7);
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) px(x, y, 8, 8, ((x + y) / 8) % 2 ? '#78c850' : '#70c048');
  for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * H; px(x, y, 1, 2, '#58a038'); px(x + 2, y + 1, 1, 2, '#58a038'); }
  // battle ring: worn dirt oval
  ellipse(160, 96, 128, 66, '#c8b878'); ellipse(160, 96, 124, 63, '#d8c888');
  for (let i = 0; i < 160; i++) { const a = r() * 6.283, d = r(); px(160 + Math.cos(a) * 120 * d, 96 + Math.sin(a) * 60 * d, 1, 1, r() < 0.5 ? '#c0b070' : '#e4d6a0'); }
  ring(160, 96, 22, 11, '#b8a868');
  // tall grass and flowers around the edge
  for (let i = 0; i < 70; i++) {
    let x = r() * W, y = r() * H; if (((x - 160) / 132) ** 2 + ((y - 96) / 70) ** 2 < 1) continue;
    if (r() < 0.75) { px(x, y, 1, 3, '#3f8a2c'); px(x + 1, y - 1, 1, 4, '#4fa034'); px(x + 2, y, 1, 3, '#3f8a2c'); }
    else { px(x, y, 2, 2, r() < 0.5 ? '#f8f8f8' : '#f86890'); px(x, y + 2, 1, 1, '#3f8a2c'); }
  }
  // trees along the top edge
  for (let x = -6; x < W + 12; x += 18) { disc(x, 6, 11, '#2f6e2a'); disc(x - 2, 3, 7, '#3f8a34'); px(x - 4, 0, 3, 2, '#58a848'); }
  for (const k of rocks) {
    const cx = k.x * K, cy = k.y * K, rr = R(k.r * K);
    ellipse(cx + 1, cy + rr * 0.7, rr, R(rr * 0.4), '#00000033');
    disc(cx, cy, rr, '#5e5a52'); disc(cx - 1, cy - 1, rr - 1, '#8a857a'); disc(cx - R(rr / 3), cy - R(rr / 3), R(rr / 2), '#aaa496');
    px(cx + R(rr / 3), cy, 2, 1, '#5e5a52');
  }
  return c;
}

// ---------- renderer ----------
function createRenderer(canvas, arena) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  let parts = [], decals = [], texts = [], trails = [[], []], shake = 0, flash = 0, seen = new Set(), impacts = new Set(), lastNow = performance.now();
  ground = ground || buildGround(arena.rocks);

  function part(x, y, vx, vy, life, col, size = 1, grav = 0) { parts.push({ x, y, vx, vy, life, max: life, col, size, grav }); }
  function burst(x, y, pal, n = 10, spd = 40) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = spd * (0.4 + Math.random()); part(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.3, pal[1 + (i % 3)], Math.random() < 0.3 ? 2 : 1); } }
  function palFor(ty, sid) { return sid === 7 ? PAL.PETAL : PAL[ty] || PAL.STONE; }

  function hit(ev, snap) {
    const v = snap?.f[ev.victim]; if (!v) return;
    const x = v.x * K, y = v.y * K - 10;
    burst(x, y, ev.eff > 1 ? PAL.SPARK : ['#fff', '#fff', '#ffe', '#fdd'], 12, 50);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; part(x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.15, '#ffffff', 2); }
    texts.push({ x, y: y - 14, txt: String(ev.damage), col: ev.eff > 1 ? '#ffd23f' : '#ffffff', t: 0.9 });
    if (ev.eff > 1) texts.push({ x, y: y - 24, txt: 'SUPER!', col: '#ff8a1f', t: 1 });
    if (ev.fee) texts.push({ x: snap.f[ev.attacker].x * K, y: snap.f[ev.attacker].y * K - 30, txt: '+' + ev.fee, col: '#9ef0c8', t: 1.2, small: true });
    shake = Math.max(shake, ev.style === 'beam' || ev.style === 'strike' ? 0.3 : 0.12);
  }

  function drawFighter(f, prev, t, i, opt) {
    const now = opt.now / 1000;
    const wx = prev ? prev.x + (f.x - prev.x) * t : f.x, wy = prev ? prev.y + (f.y - prev.y) * t : f.y;
    let x = wx * K, y = wy * K + 11; // feet
    const spr = sprite(f.s, opt.hue || 0), wh = sprite(f.s, opt.hue || 0, true);
    if (!spr) return;
    // dash afterimages
    const tr = trails[i]; if (f.ds) tr.push({ x, y, life: 0.25 }); for (const a of tr) a.life -= opt.dt; trails[i] = tr.filter(a => a.life > 0);
    let ox = 0, oy = 0, sx = 1, sy = 1, alpha = 1;
    if (f.mv && !f.ds) { const s = Math.abs(Math.sin(now * 13 + i)); oy = -s * 3; if (s < 0.25) { sx = 1.08; sy = 0.9; } }
    else oy = (Math.floor(now * 2.6 + i) % 2) ? -1 : 0;
    const flip = f.fx < 0, dir = flip ? -1 : 1;
    if (f.ct < 0.16) { ox += f.fx * 5 * (1 - f.ct / 0.16); oy += f.fy * 3 * (1 - f.ct / 0.16); sx *= 1.05; }
    if (f.hu > 0) { ox += (Math.random() - 0.5) * 2; }
    if (f.i && Math.floor(now * 20) % 2) alpha = 0.45;
    if (opt.faint) { oy += opt.faint * 14; alpha *= 1 - opt.faint; sy *= 1 - opt.faint * 0.5; }
    // shadow
    g.globalAlpha = 0.35 * alpha; ellipse(x, y, R(spr.width * 0.32), 3, '#203018'); g.globalAlpha = 1;
    // afterimages
    for (const a of trails[i]) { g.globalAlpha = a.life * 1.6; drawSpr(wh, a.x, a.y, spr.width, spr.height, flip, 1, 1); }
    g.globalAlpha = alpha;
    // special-cast aura
    if (f.ck === 'special' && f.ct < 0.45) { const p = palFor(opt.type, f.s); for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283, d = 14 + Math.random() * 10; px(x + Math.cos(a) * d, y - spr.height / 2 + Math.sin(a) * d, 2, 2, p[1 + k]); } }
    const blink = f.hu > 0 && Math.floor(now * 30) % 2 === 0;
    drawSpr(blink ? wh : spr, x + ox, y + oy, spr.width, spr.height, flip, sx, sy);
    g.globalAlpha = 1;
    if (f.g) { const r = R(spr.width * 0.55); ring(x, y - spr.height / 2, r, r, Math.floor(now * 8) % 2 ? '#fff6a8' : '#ffd23f'); }
    // player marker
    if (!opt.faint) { const mx = R(x), my = R(y - spr.height - 6 + (Math.floor(now * 3) % 2)); g.fillStyle = opt.you ? '#f8f8f8' : '#f85858'; g.fillRect(mx - 2, my, 5, 1); g.fillRect(mx - 1, my + 1, 3, 1); g.fillRect(mx, my + 2, 1, 1); }
  }
  function drawSpr(img, fx, fy, w, h, flip, sx, sy) {
    const dw = R(w * sx), dh = R(h * sy);
    g.save(); g.translate(R(fx), R(fy)); if (flip) g.scale(-1, 1); g.drawImage(img, -R(dw / 2), -dh, dw, dh); g.restore();
  }

  // ---------- powers ----------
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
    } else { disc(x, y, 3, pal[2]); }
  }

  function effect(e, lt, now) {
    const pal = palFor(e.ty, e.sid), ox = e.x * K, oy = e.y * K - 8, dx = e.dx, dy = e.dy, S = STY[e.st];
    if (e.st === 'bolt') {
      const len = S.range * K, fade = 1 - lt / S.dur; g.globalAlpha = Math.max(0, fade);
      if (e.sid === 3) { // lightning arc
        const r = rng(e.id * 31 + Math.floor(now / 50)); let lx = ox, ly = oy; const nx = -dy, ny = dx;
        for (let k = 1; k <= 10; k++) { const tx = ox + dx * len * k / 10 + nx * (k < 10 ? (r() - 0.5) * 12 : 0), ty = oy + dy * len * k / 10 + ny * (k < 10 ? (r() - 0.5) * 12 : 0); line(lx, ly, tx, ty, pal[2], 2); line(lx, ly, tx, ty, '#ffffff', 1); lx = tx; ly = ty; }
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
        else { ellipse(gx, gy, R(rad * (0.6 + p * 0.6)), R(rad * 0.3 * (0.6 + p * 0.6)), pal[2]); }
        g.globalAlpha = 1;
      }
    }
  }

  function draw(prev, cur, t, view) {
    const now = performance.now(), dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now; g = ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shake > 0) { ctx.translate(R((Math.random() - 0.5) * 4 * shake * 3), R((Math.random() - 0.5) * 4 * shake * 3)); shake = Math.max(0, shake - dt); }
    ctx.drawImage(ground, 0, 0);
    for (const d of decals) { d.life -= dt; g.globalAlpha = Math.min(1, d.life / 2);
      if (d.kind === 'crater') { ellipse(d.x, d.y, R(d.r * 0.7), R(d.r * 0.28), '#8a7848'); ellipse(d.x, d.y + 1, R(d.r * 0.5), R(d.r * 0.18), '#5e5030'); }
      else { ellipse(d.x, d.y, R(d.r * 0.6), R(d.r * 0.22), '#7a6a40'); } }
    g.globalAlpha = 1; decals = decals.filter(d => d.life > 0);
    if (cur) {
      // effects that sit on the ground go first (strike telegraphs), then fighters sorted by depth, then everything else
      const lagged = (now - view.snapAt) / 1000;
      for (const e of cur.e || []) if (e.st === 'strike') effect(e, e.t + lagged, now);
      const order = cur.f.map((f, i) => i).sort((a, b) => cur.f[a].y - cur.f[b].y);
      for (const i of order) drawFighter(cur.f[i], prev?.f[i], t, i, { now, dt, you: i === view.you, hue: view.hues?.[i] || 0, type: view.types?.[i], faint: view.faint?.[i] || 0 });
      for (const e of cur.e || []) if (e.st !== 'strike') effect(e, e.t + lagged, now);
      for (const p of cur.p || []) { const pp = prev?.p?.find(o => o.id === p.id); projectile(p, (pp ? pp.x + (p.x - pp.x) * t : p.x) * K, (pp ? pp.y + (p.y - pp.y) * t : p.y) * K, now); }
    }
    for (const p of parts) {
      p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      let col = p.col; if (!col) { const q = 1 - p.life / p.max; col = q < 0.2 ? PAL.EMBER[0] : q < 0.45 ? PAL.EMBER[1] : q < 0.7 ? PAL.EMBER[2] : q < 0.9 ? PAL.EMBER[3] : '#6a6060'; }
      g.globalAlpha = Math.min(1, p.life / p.max * 2); px(p.x, p.y, p.size, p.size, col);
    }
    g.globalAlpha = 1; parts = parts.filter(p => p.life > 0); if (parts.length > 600) parts = parts.slice(-600);
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (const tx of texts) { tx.t -= dt; tx.y -= 14 * dt; g.globalAlpha = Math.min(1, tx.t * 3); ctx.font = (tx.small ? '6px' : '8px') + ' "Press Start 2P", monospace';
      ctx.fillStyle = '#181018'; ctx.fillText(tx.txt, R(tx.x) + 1, R(tx.y) + 1); ctx.fillStyle = tx.col; ctx.fillText(tx.txt, R(tx.x), R(tx.y)); }
    g.globalAlpha = 1; texts = texts.filter(tx => tx.t > 0);
    if (flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = flash; px(0, 0, W, H, '#ffffff'); g.globalAlpha = 1; flash = Math.max(0, flash - dt * 1.5); }
  }
  function reset() { parts = []; decals = []; texts = []; trails = [[], []]; impacts.clear(); seen.clear(); shake = 0; flash = 0; }
  return { draw, hit, reset, idle: () => { g = ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ground, 0, 0); } };
}

window.PMArena = { createRenderer, sprite, spriteSrc: sid => 'art/pixel/' + NAMES[sid] + '.png', W, H, onReady: cb => Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(cb) };
})();
