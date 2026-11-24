// The five Girl Elementals, the Eclipse Sovereign and the Weavers in 3D (dist/girls/<element>.glb: static models, so the whole body moves: lean, lunge, spin, rise) drawn into the
// arena with Three.js (bundled by `npm run build`, never loaded from a CDN). Each one commands an element: the element gathers around her,
// streams into her palms when she casts, shields her when she guards and bursts out of her in a mega attack. Same size as COVO and the Chosen Ones.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// el: 'water' | 'fire' | 'earth' | 'air' | 'aether' (picks the look of the energy around her)
const GIRLS = {
  nerida:  { glb: 'water',  el: 'water',  c1: 0x35c8ff, c2: 0xcff6ff },
  ignessa: { glb: 'fire',   el: 'fire',   c1: 0xff5a1a, c2: 0xffd23a },
  terrasa: { glb: 'earth',  el: 'earth',  c1: 0xb08a50, c2: 0x8bd04a },
  zephyra: { glb: 'air',    el: 'air',    c1: 0xc8f4ff, c2: 0xffffff },
  etheria: { glb: 'aether', el: 'aether', c1: 0xd08aff, c2: 0x6a8aff },
  // the Eclipse Sovereign and the Weavers
  eclipsesovereign: { glb: 'eclipsesovereign', el: 'aether', c1: 0x3a8aff, c2: 0xff3a4a },
  tideweaver:  { glb: 'tideweaver', el: 'water', c1: 0x35c8ff, c2: 0xcff6ff },
  emberweaver: { glb: 'emberweaver', el: 'fire', c1: 0xff5a1a, c2: 0xffd23a },
  voltweaver:  { glb: 'voltweaver', el: 'volt', c1: 0xffe23a, c2: 0xffffff },
  stoneweaver: { glb: 'stoneweaver', el: 'earth', c1: 0xb08a50, c2: 0x8bd04a },
  haloslinger: { glb: 'haloslinger', el: 'aether', c1: 0xffd23a, c2: 0xffffff },
};
const BASE = './girls/', SIZE = 320, H = 1.7;
const inst = {}, fstate = {};
let renderer = null, camera = null, glowTex = null, view = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function getRenderer() {
  if (renderer) return renderer;
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setSize(SIZE, SIZE); renderer.setClearColor(0, 0);
  camera = new T.PerspectiveCamera(34, 1, 0.1, 50); camera.position.set(0, 2.5, 6.0); camera.lookAt(0, 1.15, 0); camera.updateMatrixWorld(true);
  const proj = y => { const v = new T.Vector3(0, y, 0).project(camera); return (1 - v.y) / 2 * SIZE; };
  view = { feet: proj(0), head: proj(H) }; // same projection as the Chosen Ones: every fighter is drawn at the same size
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new T.CanvasTexture(c);
  return renderer;
}
const sprite = (c, s, op = 1, additive = true) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: op, blending: additive ? T.AdditiveBlending : T.NormalBlending, depthWrite: false })); m.scale.setScalar(s); return m; };

function build(name, gltf) {
  const cfg = GIRLS[name], scene = new T.Scene(), root = new T.Group(), body = new T.Group();
  scene.add(root); root.add(body); body.add(gltf.scene);
  const box = new T.Box3().setFromObject(gltf.scene), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = H / size.y;
  gltf.scene.scale.multiplyScalar(k); gltf.scene.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
  const mats = [];
  gltf.scene.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); if (o.material.metalness !== undefined) o.material.metalness = Math.min(o.material.metalness, 0.18); mats.push(o.material); o.frustumCulled = false; } });
  scene.add(new T.HemisphereLight(0xffffff, 0x8a90b0, 2.4));
  const sun = new T.DirectionalLight(0xfff0d8, 3.0); sun.position.set(2.5, 4, 3.5); scene.add(sun);
  const fill = new T.DirectionalLight(0xbfd8ff, 1.2); fill.position.set(-3, 1.5, 2); scene.add(fill);
  const el = new T.PointLight(cfg.c1, 0, 3); el.position.set(0.4, 0.9, 0); root.add(el);
  // energy: orbiting motes, a ground ring, a cast orb, a guard shell
  const motes = Array.from({ length: 16 }, (_, i) => { const m = sprite(i % 3 ? cfg.c1 : cfg.c2, cfg.el === 'earth' ? 0.1 : 0.16, 0.9, cfg.el !== 'earth'); root.add(m); return m; });
  const ring = new T.Mesh(new T.RingGeometry(0.5, 0.56, 48), new T.MeshBasicMaterial({ color: cfg.c1, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; root.add(ring);
  const ring2 = ring.clone(); ring2.material = ring.material.clone(); root.add(ring2);
  const orb = sprite(cfg.c1, 0.5, 0.9); orb.position.set(0.45, 0.95, 0); root.add(orb);
  const core = sprite(0xffffff, 0.22, 0.9); core.position.copy(orb.position); root.add(core);
  const shell = new T.Mesh(new T.SphereGeometry(0.72, 24, 16), new T.MeshBasicMaterial({ color: cfg.c1, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); shell.position.y = 0.85; root.add(shell);
  const trail = Array.from({ length: 10 }, () => { const m = sprite(cfg.c1, 0.3, 0); root.add(m); return m; });
  return { name, cfg, scene, root, body, mats, el, motes, ring, ring2, orb, core, shell, trail, ready: true };
}
function load(name) {
  if (inst[name]) return inst[name];
  const r = inst[name] = { ready: false };
  new GLTFLoader().loadAsync(BASE + GIRLS[name].glb + '.glb').then(g => { getRenderer(); Object.assign(r, build(name, g)); }).catch(e => console.warn('girl load failed', name, e));
  return r;
}
function stateOf(f, o) {
  const key = (o.name || '') + (o.i ?? 0), s = fstate[key] || (fstate[key] = { el: 0, combo: 0, last: 9, g: 0, gOn: false });
  if (f.ck && f.ct < s.last - 0.05 && f.ct < 0.2) { if (f.ck === 'special') s.el++; if (f.ck === 'basic') s.combo++; }
  s.last = f.ck ? f.ct : 9; return s;
}

// The pose: everything the static body can do (offsets in model units; lean > 0 leans forward)
function pose(R, f, o, t) {
  const S = stateOf(f, o), out = { y: 0, lean: 0, roll: 0, fwd: 0, yaw: 0, sx: 1, sy: 1, fall: 0, flash: 0, orb: 0, ring: 0, shell: 0, glow: 0.2, spin: 0 };
  const dur = f.ck === 'mega' ? 1.3 : f.ck === 'special' ? 0.9 : 0.5, casting = !!f.ck && f.ct < dur, u = casting ? clamp(f.ct / dur, 0, 1) : 0, moving = f.mv && !f.ds;
  const stage = clamp(f.sg || 0, 0, 5);
  out.y = Math.sin(t * 2.2) * 0.012 + (f.fl ? 0.3 + Math.sin(t * 2.6) * 0.05 : 0); // an airbender hovers
  out.sy = 1 + Math.sin(t * 2.2) * 0.008; out.glow = 0.25 + stage * 0.06 + (f.fl ? 0.1 : 0);
  if (moving) { out.y += Math.abs(Math.sin(t * 10)) * 0.045; out.lean = 0.16; out.roll = Math.sin(t * 10) * 0.07; out.glow += 0.1; }
  if (f.ds) { out.lean = 0.42; out.fwd = 0.1; out.sx = 1.08; out.sy = 0.94; out.glow = 1; }
  if (f.g) { out.sy = 0.9; out.sx = 1.05; out.shell = 0.35 + Math.sin(t * 8) * 0.06; out.glow = 0.7; }
  if (casting && f.ck === 'basic') { const k = Math.sin(Math.PI * u); out.lean = 0.1 + k * 0.3; out.fwd = k * 0.14; out.roll = (S.combo % 2 ? 1 : -1) * k * 0.18; out.orb = k; out.glow = 0.5 + k; }
  if (casting && f.ck === 'special') { // wind up (rise, lean back), then strike (lean far forward, spin on every second cast)
    const w = clamp(u / 0.4, 0, 1), s = clamp((u - 0.4) / 0.6, 0, 1); out.y += w * 0.12 * (1 - s); out.lean = -0.3 * w * (1 - s) + 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (s > 0);
    out.fwd = 0.2 * Math.sin(Math.PI * s); out.orb = 0.4 + Math.sin(Math.PI * u); out.glow = 0.6 + Math.sin(Math.PI * u) * 1.4; out.ring = Math.sin(Math.PI * u); if (S.el % 2) out.spin = u * Math.PI * 2; }
  if (f.ck === 'mega' && f.ct < dur) { out.y += Math.sin(Math.PI * Math.min(1, u * 1.3)) * 0.35; out.spin = u * Math.PI * 4; out.orb = 1.6; out.glow = 2.4; out.ring = 1.4; out.lean = -0.1; }
  if (f.tr > 0) { out.y += 0.2; out.glow = 2; out.spin = (1 - f.tr / 0.9) * Math.PI * 2; out.ring = 1; }
  if (f.hu > 0) { out.lean = -0.35 * Math.min(1, f.hu / 0.25); out.flash = -1; out.fwd = -0.1; }
  if (o.faint) { out.fall = Math.min(1, o.faint * 1.4); out.glow = 0; out.orb = 0; }
  if (f.st) out.flash = out.flash || 0.35;
  return out;
}

function energy(R, out, f, t, col) {
  const c1 = R.cfg.c1, c2 = R.cfg.c2, e = R.cfg.el, g = out.glow, now = t;
  R.motes.forEach((m, i) => { const a = now * (e === 'earth' ? 0.9 : 1.6) + i * 2.39, r = 0.42 + (i % 4) * 0.07 + out.orb * 0.12; let y = 0.2 + ((now * (e === 'fire' ? 0.5 : e === 'water' ? 0.22 : 0.3) + i * 0.173) % 1) * 1.3;
    if (e === 'earth') y = 0.35 + (i % 5) * 0.2 + Math.sin(now * 1.5 + i) * 0.05; if (e === 'air') y = 0.2 + (i / 16) * 1.3;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); m.material.opacity = clamp(g * (0.7 + 0.3 * Math.sin(now * 5 + i)), 0, 1) * (out.fall ? 0 : 1); m.scale.setScalar((e === 'earth' ? 0.1 : 0.14) * (0.7 + g * 0.4)); });
  R.ring.material.opacity = clamp(0.25 + out.ring * 0.4 + g * 0.2, 0, 0.9) * (out.fall ? 0 : 1); R.ring.scale.setScalar(1 + out.ring * 0.5 + Math.sin(now * 3) * 0.04);
  R.ring2.material.opacity = out.ring * 0.5; R.ring2.scale.setScalar(1.1 + ((now * 1.5) % 1) * 1.4 * out.ring);
  const fwd = new T.Vector3(0.5 + out.fwd * 0.5, 0.95, 0);
  R.orb.position.copy(fwd); R.core.position.copy(fwd); R.orb.scale.setScalar(0.1 + out.orb * 0.55); R.core.scale.setScalar(0.04 + out.orb * 0.2);
  R.orb.material.opacity = clamp(out.orb, 0, 1); R.core.material.opacity = clamp(out.orb, 0, 1);
  R.shell.material.opacity = out.shell; R.shell.scale.setScalar(1 + Math.sin(now * 9) * 0.03);
  R.el.intensity = out.glow * 1.1; R.el.color.set(c1);
  R.trail.forEach((m, i) => { const on = f.ds || (f.mv && f.fl); m.material.opacity = on ? 0.5 * (1 - i / 10) : 0; m.position.set(-0.15 - i * 0.12, 0.7 + Math.sin(i + now * 8) * 0.06, 0); m.scale.setScalar(0.3 - i * 0.02); });
}

function apply(R, out, f, now, yaw) {
  R.root.rotation.set(0, yaw + out.yaw + out.spin, 0);
  R.body.rotation.set(0, 0, -(out.lean) + out.fall * 1.5);
  R.body.rotation.x = out.roll; R.body.scale.set(out.sx, out.sy, out.sx);
  R.body.position.set(out.fwd, out.y + out.fall * 0.02, 0);
  R.root.updateMatrixWorld(true);
  for (const m of R.mats) if (m.emissive) { if (out.flash < 0) m.emissive.setRGB(0.45, 0.04, 0.03); else m.emissive.set(R.cfg.c1).multiplyScalar(out.flash > 0 ? out.flash * 0.25 : clamp(out.glow - 0.9, 0, 1) * 0.1); }
}

function draw(ctx, x, y, h, f, col, o = {}) {
  const name = o.name, R = inst[name]; if (!R?.ready) return false;
  const now = (o.now ?? performance.now()) / 1000 + (o.i || 0) * 0.37;
  const out = pose(R, f, o, now);
  let fxx = f.fx || 0, fyy = f.fy || 0; if (!fxx && !fyy) fxx = 1; const yaw = Math.atan2(-fyy, fxx);
  apply(R, out, f, now, yaw); energy(R, out, f, now, col);
  const rd = getRenderer(); rd.render(R.scene, camera);
  const D = h * SIZE / (view.feet - view.head), s = D / SIZE;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(rd.domElement, x - D / 2, y - view.feet * s, D, D); ctx.restore();
  return true;
}
// A still picture (cards, the home page): `px` square, turned `yaw` radians (0 = facing right, -PI/2 = facing the viewer)
function snapshot(name, px = 512, yaw = -0.75, hh = 0.74) {
  const R = inst[name]; if (!R?.ready) return null;
  const f = { fx: Math.cos(yaw), fy: -Math.sin(yaw) }, out = pose(R, f, { name, i: 9 }, 1.0); out.glow = 0.7; out.ring = 0.3;
  apply(R, out, f, 1.0, yaw); energy(R, out, f, 1.0, null); R.shell.material.opacity = 0;
  const rd = getRenderer(), cam = new T.PerspectiveCamera(24, 1, 0.1, 50), dist = H / hh / (2 * Math.tan(12 * Math.PI / 180));
  cam.position.set(0, 0.85 + dist * 0.2, dist); cam.lookAt(0, 0.8, 0); rd.setSize(px, px); rd.render(R.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(rd.domElement, 0, 0); rd.setSize(SIZE, SIZE); return c;
}
window.PMGirl = {
  snapshot, has: n => !!GIRLS[n], ready: n => { if (!GIRLS[n]) return false; return !!load(n).ready; },
  draw: (ctx, x, y, h, f, col, o) => draw(ctx, x, y, h, f, col, o), names: () => Object.keys(GIRLS),
  colors: n => GIRLS[n] && { c1: '#' + GIRLS[n].c1.toString(16).padStart(6, '0'), c2: '#' + GIRLS[n].c2.toString(16).padStart(6, '0') },
};
