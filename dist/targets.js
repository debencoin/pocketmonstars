'use strict';
// Target Practice: a 30-second shooting range for practising your Monstar's moves. Random targets pop up:
// bullseye boards (score by ring), hay stacks (take several hits), cans on a fence (tip over in one hit) and a row of
// moving ducks (one hit each). Every hit shows its damage. Nothing is earned yet: the result shows what the same hits
// would have earned in a real match (EXP and SOL), using the game's real formulas.
(() => {
const S = window.PMStake, API = window.PMArenaApi, PA = window.PMArena; if (!S || !PA) return;
const { Monstars, Stake, Sim } = S, { SPECIES } = Monstars;
const q = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nav = document.querySelector('header nav'), main = document.querySelector('main');
const btn = document.createElement('button'); btn.textContent = 'Target Practice'; btn.dataset.tab = 'targets'; btn.onclick = () => window.tab('targets');
nav?.insertBefore(btn, nav.querySelector('[data-tab=market]'));
const sec = document.createElement('section'); sec.id = 'targets'; sec.className = 'view hidden'; main.insertBefore(sec, main.querySelector('footer'));
sec.innerHTML = `<div class="topline"><div><div class="eyebrow">Practice your moves · 30 seconds</div><h1>Target Practice</h1>
  <p class="muted">Tap a target to fire at it. Bullseyes score by ring, hay stacks take a beating, cans tip over and ducks go down in one hit. Your Monstar's real moves and damage are used. No EXP or SOL is earned here yet, but you'll see what you would have earned.</p></div>
  <span class="pill"><i class="dot"></i> BEST <span id="tpBest">0</span></span></div>
  <div class="panel tp-wrap">
   <div class="tp-bar"><select class="pv-input" id="tpPick"></select><button class="primary" id="tpStart">Start · 30 s</button></div>
   <div class="tp-hud"><span>⏱ <b id="tpTime">30.0</b></span><span>★ <b id="tpScore">0</b></span><span>💥 <b id="tpDmg">0</b></span><span>🎯 <b id="tpAcc">0%</b></span></div>
   <canvas id="tpCanvas" width="960" height="540" aria-label="Target practice range"></canvas>
   <div class="tp-moves" id="tpMoves"></div>
   <div class="tp-result" id="tpResult" hidden></div>
  </div>`;
const cv = q('tpCanvas'), ctx = cv.getContext('2d'), W = 960, H = 540;
let G = null, raf = 0, best = 0; try { best = Number(localStorage.getItem('pm-tp-best') || 0); } catch {}
q('tpBest').textContent = best;

// ---------- your Monstar ----------
function fighters() {
  const mine = API?.mine?.() || [];
  if (mine.length) return mine.map(m => ({ key: 's' + m.serial, label: `${m.form || m.name} · Lv${m.level}`, mon: new Monstars.Monstar({ speciesId: m.speciesId, level: m.level }), stage: m.stageId }));
  return Monstars.STARTER_IDS.map(id => ({ key: 'g' + id, label: `${SPECIES[id].name} · Lv1 (guest)`, mon: new Monstars.Monstar({ speciesId: id, level: 1 }), stage: 0 }));
}
function fillPick() { const list = fighters(), cur = q('tpPick').value; q('tpPick').innerHTML = list.map(f => `<option value="${f.key}">${esc(f.label)}</option>`).join(''); if (list.some(f => f.key === cur)) q('tpPick').value = cur; }
const TYPE_COL = { EMBER: '#ff5a1f', TIDE: '#3a8ae0', SPARK: '#ffd23f', GROVE: '#4caa3a', SHADE: '#7a4ad8', STONE: '#9a8458', FROST: '#7fe8ff', ASTRAL: '#ff9ad8', PSYCHIC: '#c050c8', STEEL: '#b8c4d8', GALE: '#e8fbff', VENOM: '#9a4ad0', DRACO: '#ff8a00', ANCIENT: '#ffb300', WATCHER: '#c0c8ff' };

// ---------- moves: your Monstar's own attack, special and Mega Shot ----------
function movesFor(mon) {
  const K = mon.kit, st = mon.stats;
  return [
    { id: 'atk', name: K.basic.name, key: '1', cd: 0.35, power: 9 * (K.basic.power || 1), atk: st.attack, speed: 900, r: 9, shots: K.basic.shots || 1 },
    { id: 'sp', name: K.special.name, key: '2', cd: 1.6, power: 16 * (K.special.power || 1), atk: st.spAttack, speed: 760, r: 14, shots: K.special.shots ? K.special.shots + (Math.random() < 0.5 ? 1 : 0) : 1 },
    { id: 'mega', name: K.mega.name, key: '3', cd: 0, power: 30 * (K.mega.power || 1), atk: st.spAttack, speed: 0, r: 150 * (K.mega.size || 1), mega: true },
  ];
}
const dmgOf = (mv, mon) => Math.max(1, Math.round(mv.power * (1 + (mon.level - 1) * 0.03) * Math.sqrt(mv.atk / 80) * 1.4 * (Math.random() < 0.08 ? 1.5 : 1)));

// ---------- targets ----------
const KINDS = ['bull', 'hay', 'cans', 'ducks'];
function spawn(kind = KINDS[Math.floor(Math.random() * KINDS.length)]) {
  const x = 330 + Math.random() * 560, y = 110 + Math.random() * 360, id = G.nextId++;
  if (kind === 'bull') G.targets.push({ id, kind, x, y, r: 62, life: 4 + Math.random() * 2, hp: 3 });
  else if (kind === 'hay') G.targets.push({ id, kind, x, y, w: 120, h: 92, life: 7, hp: 40 + G.mon.level * 4, max: 40 + G.mon.level * 4 });
  else if (kind === 'cans') { const fy = 160 + Math.random() * 300, fx = 380 + Math.random() * 330; for (let i = 0; i < 4; i++) G.targets.push({ id: G.nextId++, kind: 'can', x: fx + i * 56, y: fy, w: 34, h: 52, life: 7, hp: 1, fence: fx }); }
  else { const row = 120 + Math.random() * 320, dir = Math.random() < 0.5 ? 1 : -1, sp = (120 + Math.random() * 110) * dir;
    for (let i = 0; i < 5; i++) G.targets.push({ id: G.nextId++, kind: 'duck', x: (dir > 0 ? 300 : W + 40) - dir * i * 95, y: row, r: 32, vx: sp, life: 9, hp: 1 }); }
}
const hitTest = (t, x, y, r) => t.kind === 'hay' || t.kind === 'can' ? x + r > t.x - t.w / 2 && x - r < t.x + t.w / 2 && y + r > t.y - t.h && y - r < t.y : Math.hypot(t.x - x, t.y - y) < t.r + r;

// ---------- game ----------
function start() {
  const f = fighters().find(x => x.key === q('tpPick').value) || fighters()[0];
  G = { mon: f.mon, stage: f.stage, img: new Image(), moves: movesFor(f.mon), sel: 0, cds: [0, 0, 0], ult: 0, t: 30, targets: [], shots: [], fx: [], texts: [], nextId: 1, spawnT: 0,
    score: 0, dmg: 0, fired: 0, hits: 0, exp: 0, lam: 0n, kills: { bull: 0, hay: 0, can: 0, duck: 0 }, last: performance.now(), px: 130, py: 300 };
  G.img.src = PA.spriteSrc(f.mon.species.id, f.stage);
  for (let i = 0; i < 3; i++) spawn(KINDS[i]);
  q('tpResult').hidden = true; q('tpStart').textContent = 'Restart'; renderMoves(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function renderMoves() {
  q('tpMoves').innerHTML = G ? G.moves.map((m, i) => `<button class="tp-move${i === G.sel ? ' on' : ''}${m.mega && G.ult < 100 ? ' locked' : ''}" data-i="${i}"><small>${m.key}</small>${esc(m.name)}${m.mega ? `<i style="width:${Math.min(100, G.ult)}%"></i>` : ''}</button>`).join('') : '';
  q('tpMoves').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { G.sel = Number(b.dataset.i); renderMoves(); });
}
function fire(x, y) {
  if (!G || G.t <= 0) return;
  const i = G.sel, mv = G.moves[i];
  if (G.cds[i] > 0) return;
  if (mv.mega) { if (G.ult < 100) { say(x, y - 20, 'MEGA NOT READY', '#ffd84a'); return; } G.ult = 0; G.fired++; blast(x, y, mv); G.sel = 0; renderMoves(); return; }
  G.cds[i] = mv.cd; G.fired++;
  const a = Math.atan2(y - G.py, x - G.px);
  for (let k = 0; k < mv.shots; k++) { const aa = a + (mv.shots > 1 ? (k - (mv.shots - 1) / 2) * 0.12 : 0); G.shots.push({ x: G.px + 30, y: G.py - 30, vx: Math.cos(aa) * mv.speed, vy: Math.sin(aa) * mv.speed, r: mv.r, mv, life: 1.4, done: false }); }
}
function blast(x, y, mv) { G.fx.push({ k: 'blast', x, y, r: mv.r, t: 0 }); let any = false; for (const t of G.targets) if (t.hp > 0 && hitTest(t, x, y, mv.r)) { any = true; hit(t, mv, x, y); } if (!any) say(x, y, 'MISS', '#9aa'); }
function hit(t, mv, x, y) {
  const d = dmgOf(mv, G.mon); G.dmg += d; G.hits++;
  G.exp += Math.max(1, Math.round(d * Sim.EXP_RULES.perDamage));
  G.lam += Stake.hitFee({ level: G.mon.level, attack: mv.atk, power: mv.power });
  if (!mv.mega) G.ult = Math.min(100, G.ult + d * 0.9);
  let pts = 0, label = '-' + d;
  if (t.kind === 'bull') { const off = Math.hypot(x - t.x, y - t.y) / t.r; pts = off < 0.25 ? 50 : off < 0.55 ? 25 : 10; label = (pts === 50 ? 'BULLSEYE! ' : '') + '-' + d; t.hp--; if (t.hp <= 0) { G.kills.bull++; boom(t.x, t.y, ['#ffffff', '#e83a3a']); } }
  else if (t.kind === 'hay') { t.hp -= d; pts = 5; if (t.hp <= 0) { pts += 40; G.kills.hay++; boom(t.x, t.y - 30, ['#e8c860', '#c8a040', '#fff0a0'], 26); } }
  else if (t.kind === 'can') { t.hp = 0; t.tip = 1; t.vx = (Math.random() < 0.5 ? -1 : 1) * 160; t.vy = -260; pts = 15; G.kills.can++; }
  else if (t.kind === 'duck') { t.hp = 0; t.down = 1; pts = 20; G.kills.duck++; }
  G.score += pts; say(x, y - 10, label, pts >= 50 ? '#ffd84a' : '#ffffff'); if (pts) say(x + 26, y - 34, '+' + pts, '#7affa0', 0.8);
  G.fx.push({ k: 'pop', x, y, t: 0, col: TYPE_COL[G.mon.type] || '#fff' });
}
function boom(x, y, cols, n = 18) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 80 + Math.random() * 200; G.fx.push({ k: 'bit', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, col: cols[i % cols.length] }); } }
function say(x, y, txt, col, life = 1) { G.texts.push({ x, y, txt, col, t: 0, life }); }
function loop(now) {
  const dt = Math.min(0.05, (now - G.last) / 1000); G.last = now;
  if (G.t > 0) {
    G.t = Math.max(0, G.t - dt); G.cds = G.cds.map(c => Math.max(0, c - dt));
    G.spawnT -= dt; if (G.spawnT <= 0 || G.targets.filter(t => t.hp > 0).length < 3) { spawn(); G.spawnT = 1.4 + Math.random() * 1.2; }
    for (const t of G.targets) { t.life -= dt; if (t.kind === 'duck' && !t.down) t.x += t.vx * dt; if (t.tip) { t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 900 * dt; t.rot = (t.rot || 0) + t.vx * dt * 0.05; } if (t.down) t.down += dt * 4; }
    G.targets = G.targets.filter(t => t.life > 0 && t.y < H + 80 && t.x > -80 && t.x < W + 80 && !(t.down > 3));
    for (const s of G.shots) { if (s.done) continue; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const t of G.targets) if (t.hp > 0 && hitTest(t, s.x, s.y, s.r)) { hit(t, s.mv, s.x, s.y); s.done = true; break; }
      if (!s.done && (s.life <= 0 || s.x > W + 20 || s.y < -20 || s.y > H + 20)) { s.done = true; } }
    G.shots = G.shots.filter(s => !s.done);
    if (G.t <= 0) finish();
  }
  draw(dt); renderHud();
  if (G.t > 0 || G.fx.length || G.texts.length) raf = requestAnimationFrame(loop);
}
function renderHud() {
  q('tpTime').textContent = G.t.toFixed(1); q('tpScore').textContent = G.score; q('tpDmg').textContent = G.dmg; q('tpAcc').textContent = (G.fired ? Math.round(Math.min(G.hits, G.fired) / G.fired * 100) : 0) + '%';
  const mb = q('tpMoves').querySelector('[data-i="2"]'); if (mb) { mb.classList.toggle('locked', G.ult < 100); const bar = mb.querySelector('i'); if (bar) bar.style.width = Math.min(100, G.ult) + '%'; }
}
function finish() {
  if (G.score > best) { best = G.score; try { localStorage.setItem('pm-tp-best', best); } catch {} q('tpBest').textContent = best; }
  const k = G.kills, sol = Stake.formatSol(G.lam, 9);
  q('tpResult').hidden = false;
  q('tpResult').innerHTML = `<h2>Time! ${G.score} points</h2>
    <div class="tp-stats"><span><b>${G.dmg}</b> damage</span><span><b>${G.hits}</b> hits</span><span>Boards <b>${k.bull}</b></span><span>Hay stacks <b>${k.hay}</b></span><span>Cans <b>${k.can}</b></span><span>Ducks <b>${k.duck}</b></span></div>
    <p class="pv-note">In a real match these hits would have earned about <b>+${G.exp} EXP</b> and moved <b>${sol} SOL</b> to you from your rival's stake. Target Practice earns nothing yet: it's just for practice.</p>
    <button class="primary" id="tpAgain">Play again</button>`;
  q('tpAgain').onclick = start;
}

// ---------- drawing ----------
function draw(dt) {
  // the range: sky, grass, a fence line
  const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9ad8ff'); sky.addColorStop(0.35, '#d8f0ff'); sky.addColorStop(0.36, '#6ab84a'); sky.addColorStop(1, '#3a8a2a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 12; i++) ctx.fillRect(0, 200 + i * 30, W, 14);
  ctx.fillStyle = '#c8a070'; ctx.fillRect(0, 186, W, 6);
  for (const t of G.targets) drawTarget(t);
  // your Monstar
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(G.px, G.py + 6, 40, 10, 0, 0, 6.283); ctx.fill();
  if (G.img.complete && G.img.naturalWidth) { const h = 120, w = G.img.naturalWidth / G.img.naturalHeight * h; ctx.imageSmoothingEnabled = false; ctx.drawImage(G.img, G.px - w / 2, G.py - h, w, h); }
  const col = TYPE_COL[G.mon.type] || '#fff';
  for (const s of G.shots) { ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.35, 0, 6.283); ctx.fill(); }
  for (const f of G.fx) { f.t += dt;
    if (f.k === 'blast') { const a = Math.max(0, 1 - f.t / 0.6); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + f.t * 1.2), 0, 6.283); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = 1; }
    else if (f.k === 'pop') { const a = Math.max(0, 1 - f.t / 0.3); ctx.globalAlpha = a; ctx.strokeStyle = f.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + f.t * 90, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
    else { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; ctx.fillStyle = f.col; ctx.fillRect(f.x, f.y, 5, 5); } }
  G.fx = G.fx.filter(f => f.t < (f.k === 'bit' ? 1.2 : 0.7));
  ctx.textAlign = 'center'; ctx.font = '900 32px Inter, sans-serif';
  for (const t of G.texts) { t.t += dt; const a = Math.max(0, 1 - t.t / t.life); ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(t.txt, t.x, t.y - t.t * 40); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y - t.t * 40); ctx.globalAlpha = 1; }
  G.texts = G.texts.filter(t => t.t < t.life);
  if (G.t <= 0) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.font = '900 54px Inter, sans-serif'; ctx.fillText('TIME!', W / 2, H / 2); }
}
function drawTarget(t) {
  const fade = Math.min(1, t.life / 0.5); ctx.globalAlpha = fade;
  if (t.kind === 'bull') { // stand + rings
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(t.x - 4, t.y, 8, 50);
    [['#ffffff', 1], ['#e83a3a', 0.8], ['#ffffff', 0.55], ['#e83a3a', 0.3], ['#ffd84a', 0.14]].forEach(([c, k]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, 6.283); ctx.fill(); });
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 6.283); ctx.stroke();
    if (t.hp < 3) { ctx.fillStyle = '#222'; for (let i = 0; i < 3 - t.hp; i++) { ctx.beginPath(); ctx.arc(t.x - 10 + i * 12, t.y + 4 - i * 6, 3, 0, 6.283); ctx.fill(); } }
  } else if (t.kind === 'hay') {
    const x = t.x - t.w / 2, y = t.y - t.h; ctx.fillStyle = '#d8b850'; ctx.fillRect(x, y, t.w, t.h); ctx.fillStyle = '#b8983a';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 4, y + 6 + i * 11, t.w - 8, 2); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x + t.w * 0.3, y, 4, t.h); ctx.fillRect(x + t.w * 0.66, y, 4, t.h);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x, y - 12, t.w, 6); ctx.fillStyle = '#7affa0'; ctx.fillRect(x, y - 12, t.w * Math.max(0, t.hp / t.max), 6);
  } else if (t.kind === 'can') {
    if (!t.tip) { ctx.fillStyle = '#8a6a4a'; ctx.fillRect(t.fence - 26, t.y, 4 * 56 + 24, 12); }
    ctx.save(); ctx.translate(t.x, t.y - t.h / 2); ctx.rotate(t.rot || 0);
    ctx.fillStyle = '#c8ccd8'; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h); ctx.fillStyle = '#e83a3a'; ctx.fillRect(-t.w / 2, -t.h / 2 + 10, t.w, 14); ctx.fillStyle = '#fff'; ctx.fillRect(-t.w / 2 + 3, -t.h / 2 + 2, 4, t.h - 4);
    ctx.restore();
  } else if (t.kind === 'duck') {
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(1.4, 1.4); if (t.down) ctx.scale(1, Math.max(0.05, 1 - (t.down - 1) * 0.5)); const f = t.vx < 0 ? -1 : 1; ctx.scale(f, 1);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-3, 10, 6, 30);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, 24, 15, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.arc(16, -14, 11, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(26, -15); ctx.lineTo(36, -12); ctx.lineTo(26, -9); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(19, -17, 2.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#e8b820'; ctx.beginPath(); ctx.ellipse(-4, 0, 11, 7, -0.3, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ---------- input ----------
const toXY = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!G || G.t <= 0) return; const [x, y] = toXY(e); if (x < 220) { G.py = Math.max(220, Math.min(H - 20, y)); return; } fire(x, y); });
addEventListener('keydown', e => { if (!G || sec.classList.contains('hidden')) return; const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0) { G.sel = i; renderMoves(); } });
q('tpStart').onclick = start;
const baseTab = window.tab;
window.tab = function (id) { baseTab(id); btn.classList.toggle('active', id === 'targets'); if (id === 'targets') { fillPick(); if (!G) { G = null; idle(); } } else if (G && G.t > 0) { G.t = 0.0001; } };
function idle() { ctx.fillStyle = '#3a8a2a'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 34px Inter, sans-serif'; ctx.fillText('Pick your Monstar and tap Start', W / 2, H / 2); ctx.font = '600 18px Inter, sans-serif'; ctx.fillText('Tap targets to fire · tap the left edge to move up and down · keys 1-3 pick a move', W / 2, H / 2 + 36); }
idle();
})();
