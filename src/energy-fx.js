// 3D energy effects for every Monstar's powers, in the same style as COVO's: a lit, glowing 3D core with spinning energy
// coils and sparks, rendered with three.js and painted into the 2D arena. Each move keeps its own shape (orb, crystal shard,
// crescent blade, boulder, lightning, flame, beam, shock wave); only the look is shared. window.PMEnergy.
import * as T from 'three';

const S = 160; // square effect canvas
const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false); renderer.setClearColor(0, 0);
const BW = 512, BH = 96; // long canvas for beams
const beamR = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
beamR.setPixelRatio(1); beamR.setSize(BW, BH, false); beamR.setClearColor(0, 0);

const lights = sc => { sc.add(new T.HemisphereLight(0xffffff, 0x325577, 3)); const d = new T.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 5); sc.add(d); };
const scene = new T.Scene(); lights(scene);
const camera = new T.PerspectiveCamera(35, 1, 0.1, 30); camera.position.set(0, 0, 7);
const root = new T.Group(); scene.add(root);
const std = () => new T.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x2288ff, emissiveIntensity: 0.9, metalness: 0.25, roughness: 0.18 });
const add = (geo, mat) => { const m = new T.Mesh(geo, mat); root.add(m); return m; };
// one core per shape; only the one in use is shown
const cores = {
  orb: add(new T.IcosahedronGeometry(0.42, 2), std()),
  shard: add(new T.OctahedronGeometry(0.42, 0), std()),
  blade: add(new T.TorusGeometry(0.5, 0.11, 10, 40, Math.PI * 1.15), std()),
  rock: add(new T.DodecahedronGeometry(0.46, 0), new T.MeshStandardMaterial({ color: 0x8a7a60, emissive: 0x331a00, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.85, flatShading: true })),
  flame: add(new T.ConeGeometry(0.36, 1.05, 18, 1, true), std()),
  bolt: add(new T.TetrahedronGeometry(0.42, 0), std()),
};
const coils = Array.from({ length: 4 }, (_, i) => add(new T.TorusGeometry(0.48 + i * 0.09, 0.024, 8, 48), new T.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.8 })));
const sparks = Array.from({ length: 18 }, () => add(new T.SphereGeometry(0.035, 6, 6), new T.MeshBasicMaterial({ color: 0xffffff })));
const shell = add(new T.IcosahedronGeometry(0.5, 2), new T.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.4, wireframe: true }));
const wave = add(new T.TorusGeometry(1, 0.06, 8, 64), new T.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.8 }));

const hex = c => { if (typeof c === 'number') return c; const s = String(c || '#66ddff').replace('#', ''); return parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s.slice(0, 6), 16) || 0x66ddff; };
function tint(c1, c2) {
  for (const k in cores) { if (k === 'rock') { cores.rock.material.emissive.setHex(c1); continue; } cores[k].material.color.setHex(c1); cores[k].material.emissive.setHex(c1); }
  coils.forEach(m => m.material.color.setHex(c2)); sparks.forEach(m => m.material.color.setHex(0xffffff)); shell.material.color.setHex(c2); wave.material.color.setHex(c2);
}
function only(kind) { for (const k in cores) cores[k].visible = k === kind; coils.forEach(m => (m.visible = true)); sparks.forEach(m => (m.visible = true)); shell.visible = false; wave.visible = false; }

// which 3D shape a move's projectile takes
export const KIND = lk => /ice|shard|icezap|frost/.test(lk) ? 'shard' : /crescent|disc|ring|cthorn/.test(lk) ? 'blade' : /boulder|rock|stone/.test(lk) ? 'rock' : /fire|flame|firenado|dragon/.test(lk) ? 'flame' : /bolt|spark|zap|volt/.test(lk) ? 'bolt' : 'orb';

function glowDisc(ctx, r, c) { const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r); g.addColorStop(0, c + '99'); g.addColorStop(0.35, c + '33'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); }

// a flying power shot (also the energy gathering in the hands while charging)
function orb(ctx, x, y, a, size, col, col2, kind, now, seed = 0) {
  const t = now / 1000 + seed * 0.37, c1 = hex(col), c2 = hex(col2 || col);
  tint(c1, c2); only(kind);
  const core = cores[kind];
  core.rotation.set(t * 4, t * 5, t * 2); core.scale.set(1.35, 0.85, 0.85);
  if (kind === 'blade') { core.rotation.set(0, 0, -Math.PI * 0.55 + Math.sin(t * 8) * 0.05); core.scale.set(1.1, 1.3, 1); }
  if (kind === 'flame') { core.rotation.set(0, t * 6, Math.PI / 2); core.scale.set(1, 1.2 + Math.sin(t * 30) * 0.12, 1); }
  if (kind === 'shard') core.scale.set(1.7, 0.7, 0.7);
  if (kind === 'rock') { core.rotation.set(t * 3, t * 2, 0); core.scale.set(1.1, 1, 1); }
  coils.forEach((m, i) => { m.rotation.set(t * 4 + i, t * 3 + i * 0.9, t * 2); m.visible = kind !== 'rock' || i < 2; });
  sparks.forEach((m, i) => { const u = (i / 18 + t * 1.8) % 1; m.position.set(-u * 1.6, Math.sin(i * 2.4 + t * 9) * 0.42 * (1 - u), Math.cos(i * 2.4 + t * 9) * 0.42 * (1 - u)); m.scale.setScalar(1 - u * 0.8); });
  renderer.render(scene, camera);
  const r = size * 0.42, w = size;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
  glowDisc(ctx, r, '#' + c1.toString(16).padStart(6, '0')); ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(renderer.domElement, -w / 2, -w / 2, w, w); ctx.restore();
  return true;
}

// an impact: a shell of energy bursting outward with a shock-wave ring (u: 0..1 through the burst)
function burst(ctx, x, y, size, col, col2, u, now) {
  const t = now / 1000, c1 = hex(col), c2 = hex(col2 || col);
  tint(c1, c2); for (const k in cores) cores[k].visible = false; coils.forEach(m => (m.visible = false));
  shell.visible = true; wave.visible = true; sparks.forEach(m => (m.visible = true));
  const e = 0.4 + u * 1.6; shell.scale.setScalar(e); shell.rotation.set(t * 2, t * 3, 0); shell.material.opacity = 0.55 * (1 - u);
  wave.scale.setScalar(0.5 + u * 1.9); wave.rotation.set(1.25, 0, 0); wave.material.opacity = 0.9 * (1 - u);
  sparks.forEach((m, i) => { const an = i * 2.4, d = 0.3 + u * 2.2; m.position.set(Math.cos(an) * d, Math.sin(an) * d * 0.8 + u * 0.3, Math.sin(an * 1.7) * d * 0.4); m.scale.setScalar(1.4 * (1 - u)); });
  renderer.render(scene, camera);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = Math.min(1, 1.4 * (1 - u)); ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y); glowDisc(ctx, size * 0.3 * (0.6 + u), '#' + c1.toString(16).padStart(6, '0'));
  ctx.drawImage(renderer.domElement, -size / 2, -size / 2, size, size); ctx.restore();
  return true;
}

// a beam: a glowing 3D energy column with coils spiralling along it and sparks streaming down it
const bScene = new T.Scene(); lights(bScene);
const bCam = new T.OrthographicCamera(-BW / BH, BW / BH, 1, -1, 0.1, 20); bCam.position.set(0, 2.2, 6); bCam.lookAt(0, 0, 0); // seen a little from above, so the column and its rings read as 3D
const bRoot = new T.Group(); bScene.add(bRoot);
const bCore = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 1, 24, 1, true), new T.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x2288ff, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.2, transparent: true, opacity: 0.85 })); bCore.rotation.z = Math.PI / 2; bRoot.add(bCore);
const bInner = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 1, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffffff })); bInner.rotation.z = Math.PI / 2; bRoot.add(bInner);
const bHalo = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 1, 24, 1, true), new T.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.14, depthWrite: false })); bHalo.rotation.z = Math.PI / 2; bRoot.add(bHalo);
const bRings = Array.from({ length: 10 }, () => { const m = new T.Mesh(new T.TorusGeometry(0.62, 0.06, 8, 40), new T.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x66ddff, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.25 })); bRoot.add(m); return m; });
const bSparks = Array.from({ length: 24 }, () => { const m = new T.Mesh(new T.SphereGeometry(0.05, 6, 6), new T.MeshBasicMaterial({ color: 0xffffff })); bRoot.add(m); return m; });
const bHead = new T.Mesh(new T.IcosahedronGeometry(0.62, 2), std()); bRoot.add(bHead);
function beam(ctx, x0, y0, x1, y1, width, col, col2, k, now) {
  const t = now / 1000, c1 = hex(col), c2 = hex(col2 || col), L = Math.hypot(x1 - x0, y1 - y0); if (L < 2) return true;
  const span = (BW / BH) * 2; // world length across the canvas
  bCore.material.color.setHex(c1); bCore.material.emissive.setHex(c1); bHead.material.color.setHex(c1); bHead.material.emissive.setHex(c1); bHalo.material.color.setHex(c2);
  bCore.scale.set(k, span, k); bInner.scale.set(k, span, k); bInner.position.x = 0; bCore.position.x = 0; bHalo.scale.set(k * (1 + Math.sin(t * 30) * 0.08), span, k * (1 + Math.sin(t * 30) * 0.08));
  bHead.position.set(-span / 2 + 0.85, 0, 0); bHead.rotation.set(t * 4, t * 5, 0); bHead.scale.setScalar(0.55 + k * 0.4);
  bRings.forEach((m, i) => { const u = (i / bRings.length + t * 1.4) % 1; m.material.color.setHex(c2); m.material.emissive.setHex(c2); m.position.x = -span / 2 + u * span; m.rotation.set(0, Math.PI / 2 - 0.55, 0); m.scale.setScalar(k * (0.9 + Math.sin(t * 12 + i) * 0.15)); });
  bSparks.forEach((m, i) => { const u = (i / bSparks.length + t * 2.2) % 1, an = i * 2.4 + t * 10; m.position.set(-span / 2 + u * span, Math.sin(an) * 0.55 * k, Math.cos(an) * 0.55 * k); });
  beamR.render(bScene, bCam);
  const h = Math.max(width * 2.2, 18);
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(beamR.domElement, 0, -h / 2, L, h); ctx.restore();
  return true;
}


// ---- ground powers (a ground strike lands under the rival): an element eruption in 3D, seen from the arena's aerial camera
const gScene = new T.Scene(); lights(gScene);
const gCam = new T.PerspectiveCamera(40, 1, 0.1, 40); gCam.position.set(0, 5.2, 3.0); gCam.lookAt(0, 0, 0); gCam.updateMatrixWorld(true);
const gRoot = new T.Group(); gScene.add(gRoot);
const gpj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(gCam); return [(v.x + 1) / 2 * S, (1 - v.y) / 2 * S]; };
const GG = { cone: new T.ConeGeometry(0.5, 1, 8), oct: new T.OctahedronGeometry(0.5, 0), dode: new T.DodecahedronGeometry(0.5, 0), sph: new T.SphereGeometry(0.5, 12, 8), tor: new T.TorusGeometry(0.5, 0.07, 8, 40), ring: new T.RingGeometry(0.92, 1, 64), box: new T.BoxGeometry(1, 1, 1) };
const gPool = {}; let gUsed = {};
const gGet = (geo, add, key) => { const k = geo + key, arr = gPool[k] || (gPool[k] = []), i = gUsed[k] = (gUsed[k] || 0) + 1;
  if (!arr[i - 1]) { const m = new T.Mesh(GG[geo], add ? new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }) : new T.MeshStandardMaterial({ metalness: 0.2, roughness: 0.5, flatShading: true, transparent: true })); gRoot.add(m); arr.push(m); }
  const m = arr[i - 1]; m.visible = true; return m; };
// element looks (by Monstar type): shape, how they rise, colours
const GKIND = { EMBER: 'flame', DRACO: 'flame', TIDE: 'water', STONE: 'rock', STEEL: 'rock', ANCIENT: 'rock', FROST: 'ice', SPARK: 'storm', GROVE: 'vine', VENOM: 'vine', GALE: 'wind', SHADE: 'arcane', PSYCHIC: 'arcane', ASTRAL: 'arcane' };
function ground(ctx, x, y, r, u, fade, col, col2, type, now, seed = 0) {
  const t = now / 1000, c1 = hex(col), c2 = hex(col2 || col), kind = GKIND[type] || 'arcane'; gUsed = {}; for (const k in gPool) for (const m of gPool[k]) m.visible = false;
  let R = seed * 9301 + 49297; const rnd = () => ((R = (R * 9301 + 49297) % 233280) / 233280);
  const rise = d => { const k = Math.max(0, Math.min(1, u * 1.7 - d * 0.5)); return 1 - (1 - k) * (1 - k); };
  const solid = (geo, key, c, e, ei, op = 1) => { const m = gGet(geo, false, key); m.material.color.setHex(c); m.material.emissive.setHex(e); m.material.emissiveIntensity = ei; m.material.opacity = op * fade; return m; };
  const glow = (geo, key, c, op) => { const m = gGet(geo, true, key); m.material.color.setHex(c); m.material.opacity = op * fade; return m; };
  const ring = glow('ring', 'r', c2, 0.85); ring.rotation.set(-Math.PI / 2, 0, 0); ring.position.y = 0.02; ring.scale.setScalar(0.3 + u * 1.3);
  if (kind === 'flame') for (let i = 0; i < 9; i++) { const an = rnd() * 6.283, d = Math.sqrt(rnd()) * 1.1, h = (0.8 + rnd()) * rise(d) * (0.85 + Math.sin(t * 18 + i) * 0.15);
    const m = solid('cone', 'f', 0xff6a1a, 0xff4a00, 1.6, 0.92); m.position.set(Math.cos(an) * d, h / 2, Math.sin(an) * d); m.scale.set(0.35, h, 0.35); m.rotation.set(0, t * 3 + i, 0);
    const g2 = glow('sph', 'fg', i % 2 ? 0xffd040 : 0xff5a1a, 0.6); g2.position.set(m.position.x, h * 0.9, m.position.z); g2.scale.setScalar(0.3); }
  else if (kind === 'water') { for (let i = 0; i < 3; i++) { const m = solid('tor', 'w', 0x2a8ae0, 0x35c8ff, 0.7, 0.75); const k = 0.4 + u * 1.2 + i * 0.25; m.rotation.set(-Math.PI / 2, 0, 0); m.position.y = 0.15 + i * 0.25 * (1 - u); m.scale.set(k, k, 2.4); }
    for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283, d = 0.3 + u * 1.3, m = solid('sph', 'd', 0x9ae8ff, 0x35c8ff, 0.8, 0.85); m.position.set(Math.cos(an) * d, 0.2 + Math.sin(Math.PI * u) * 0.9 * (0.6 + (i % 3) * 0.2), Math.sin(an) * d); m.scale.setScalar(0.12); } }
  else if (kind === 'rock') for (let i = 0; i < 10; i++) { const an = rnd() * 6.283, d = Math.sqrt(rnd()) * 1.2, h = (0.5 + rnd() * 0.8) * rise(d);
    const m = solid(i % 2 ? 'box' : 'dode', 'k', 0x8a7458, 0x3a2410, 0.25); m.position.set(Math.cos(an) * d, h / 2 - 0.05, Math.sin(an) * d); m.scale.set(0.32, h, 0.32); m.rotation.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4); }
  else if (kind === 'ice') for (let i = 0; i < 12; i++) { const an = rnd() * 6.283, d = Math.sqrt(rnd()) * 1.2, h = (0.5 + rnd() * 0.9) * rise(d);
    const m = solid('oct', 'i', 0xd8f6ff, 0x3a9aff, 0.45, 0.9); m.position.set(Math.cos(an) * d, h / 2, Math.sin(an) * d); m.scale.set(0.22, h, 0.22); m.rotation.set((rnd() - 0.5) * 0.5, rnd() * 3, (rnd() - 0.5) * 0.5); }
  else if (kind === 'storm') { const sp = glow('sph', 'core', 0xfff6b0, 0.7); sp.position.y = 0.6; sp.scale.setScalar(0.4 + u * 1.2);
    for (let i = 0; i < 10; i++) { const an = i / 10 * 6.283 + t * 2, L = 0.4 + u * 1.2, m = solid('box', 'b', 0xffe24a, 0xffe24a, 2.2); m.position.set(Math.cos(an) * L * 0.5, 0.6 + Math.sin(t * 30 + i) * 0.15, Math.sin(an) * L * 0.5); m.scale.set(L, 0.04, 0.04); m.rotation.set(0, -an, (rnd() - 0.5) * 0.8); } }
  else if (kind === 'vine') for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + rnd() * 0.3, d = 0.3 + rnd() * 0.9, h = (0.6 + rnd() * 0.7) * rise(d);
    const m = solid('cone', 'v', type === 'VENOM' ? 0x7a2aa8 : 0x2a8a2a, type === 'VENOM' ? 0xb05aff : 0x4aff4a, 0.5); m.position.set(Math.cos(an) * d, h / 2, Math.sin(an) * d); m.scale.set(0.12, h, 0.12); m.rotation.set(Math.sin(an) * 0.4, 0, -Math.cos(an) * 0.4); }
  else if (kind === 'wind') for (let i = 0; i < 6; i++) { const m = glow('tor', 't', i % 2 ? 0xffffff : 0xbfefff, 0.5); const k = (0.35 + i * 0.16) * (0.6 + u * 0.6); m.rotation.set(-Math.PI / 2, 0, t * (6 - i)); m.position.y = 0.1 + i * 0.28 * (0.4 + u); m.scale.set(k, k, 1.5); }
  else { for (let i = 0; i < 3; i++) { const m = glow('tor', 'a', i % 2 ? c1 : c2, 0.8); const k = 0.5 + i * 0.35; m.rotation.set(-Math.PI / 2, 0, t * (i % 2 ? -2 : 2)); m.position.y = 0.05 + i * 0.02; m.scale.set(k, k, 1); }
    for (let i = 0; i < 6; i++) { const an = i / 6 * 6.283 + t, m = solid('sph', 'o', c1, c2, 1.4); m.position.set(Math.cos(an) * 0.8, 0.3 + Math.sin(Math.PI * u) * 0.8, Math.sin(an) * 0.8); m.scale.setScalar(0.18); }
    const col2 = glow('sph', 'pillar', c2, 0.35); col2.position.y = 0.8; col2.scale.set(0.6, 2.2 * Math.sin(Math.PI * u), 0.6); }
  renderer.render(gScene, gCam);
  const o0 = gpj(0, 0, 0), o1 = gpj(1.3, 0, 0), D = r * S / Math.max(1, o1[0] - o0[0]);
  ctx.save(); ctx.globalAlpha = Math.min(1, fade * 1.4); ctx.imageSmoothingEnabled = true; ctx.drawImage(renderer.domElement, x - o0[0] * D / S, y - o0[1] * D / S, D, D); ctx.restore();
  return true;
}

window.PMEnergy = { ready: true, orb, burst, beam, ground, KIND };
