// Jachin and Boaz, the fallen angel brothers, drawn from their own animated 3D models (four wings flapping on staggered beats from
// morph targets, the WingbeatHover and SupremeCharge clips). They never run: they fly, high off the ground, leaning into the way they
// go, and turn three-quarter to the camera so the four wings stay open. No aura: their bodies already glow (emissive ribbons), with a
// soft halo behind them and a shimmer of sparkles drifting off the wings. window.PMAngel, same contract as the other rigs.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ANGELS = {
  jachin: { glb: 'jachin', c1: 0x7ae8ff, c2: 0xffd86a, c3: 0xffffff, k: 1.12 },
  boaz: { glb: 'boaz', c1: 0x9a3aff, c2: 0xffc23a, c3: 0xd8a0ff, k: 1.12 },
};
const BASE = './angels/', SIZE = 400, H = 1.7, CUE = 1.05; // CUE: the wings-forward pose of SupremeCharge, where the power leaves him
const inst = {};
let renderer = null, camera = null, view = null, glowTex = null, starTex = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setSize(SIZE, SIZE); renderer.setClearColor(0, 0); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  camera = new T.PerspectiveCamera(36, 1, 0.1, 50); camera.position.set(0, 2.4, 7.4); camera.lookAt(0, 1.45, 0); camera.updateMatrixWorld(true);
  const proj = y => { const v = new T.Vector3(0, y, 0).project(camera); return (1 - v.y) / 2 * SIZE; };
  view = { feet: proj(0), head: proj(H) };
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); return new T.CanvasTexture(c); };
  glowTex = mk(x => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  starTex = mk(x => { // a four-pointed glint
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 10); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [w, h] of [[2.4, 30], [30, 2.4]]) { x.beginPath(); x.ellipse(32, 32, w, h, 0, 0, Math.PI * 2); x.fill(); } });
  return renderer;
}

function build(name, gltf) {
  const cfg = ANGELS[name], scene = new T.Scene(), root = new T.Group(), body = new T.Group();
  scene.add(root); root.add(body); body.add(gltf.scene);
  const mixer = new T.AnimationMixer(gltf.scene), clips = {};
  for (const c of gltf.animations) clips[c.name] = mixer.clipAction(c);
  const hover = clips.WingbeatHover || Object.values(clips)[0]; hover?.play(); mixer.update(0);
  if (clips.SupremeCharge) { clips.SupremeCharge.setLoop(T.LoopOnce, 1); clips.SupremeCharge.clampWhenFinished = true; }
  gltf.scene.updateMatrixWorld(true);
  // measure the body without the glow ribbons, scale it to a fighter's height, feet at the origin
  const box = new T.Box3(); gltf.scene.traverse(o => { if (o.isMesh && !/Glow|FX/i.test(o.name + (o.parent?.name || ''))) box.expandByObject(o, true); });
  if (box.isEmpty()) box.setFromObject(gltf.scene, true);
  const size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = H * cfg.k / size.y;
  gltf.scene.scale.multiplyScalar(k); gltf.scene.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
  const ribbons = [];
  gltf.scene.traverse(o => { if (!o.isMesh) return; o.frustumCulled = false; if (!o.material) return; o.material = o.material.clone();
    if (o.material.metalness !== undefined) o.material.metalness = Math.min(o.material.metalness, 0.3);
    if (o.material.emissive && (o.material.emissiveIntensity || 0) > 0 && o.material.emissive.getHex() !== 0) ribbons.push({ m: o.material, base: o.material.emissiveIntensity });
    else if (o.material.map && o.material.emissive) { o.material.emissiveMap = o.material.map; o.material.emissive.set(0xffffff); o.material.emissiveIntensity = 0.32; ribbons.push({ m: o.material, base: 0.32, body: 1 }); } }); // he glows from within, no aura
  scene.add(new T.HemisphereLight(0xffffff, 0x302040, 2.0));
  const sun = new T.DirectionalLight(0xfff4e6, 2.6); sun.position.set(2.2, 4.5, 4); scene.add(sun);
  const rimA = new T.DirectionalLight(cfg.c1, 3.0); rimA.position.set(-3, 2.5, -2.5); scene.add(rimA); // the brother's own light from behind
  const rimB = new T.DirectionalLight(cfg.c2, 1.8); rimB.position.set(3, 1.2, -2.5); scene.add(rimB);
  const inner = new T.PointLight(cfg.c3, 3, 3.5); inner.position.set(0, 1.4, 0.8); body.add(inner); // the glow inside him lights his own chest and wings
  const spr = (tex, col, op) => new T.Sprite(new T.SpriteMaterial({ map: tex, color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
  const halo = spr(glowTex, cfg.c1, 0.5); halo.position.set(0, 1.25, -0.6); halo.scale.set(3.6, 3.2, 1); body.add(halo); halo.renderOrder = -1;
  const core = spr(glowTex, cfg.c3, 0.35); core.position.set(0, 1.3, -0.3); core.scale.setScalar(1.4); body.add(core);
  const brow = spr(starTex, cfg.c3, 0); brow.position.set(0, 1.62 * cfg.k, 0.25); brow.scale.setScalar(0.3); body.add(brow); // the eye on the brow (Boaz's trance, Jachin's halo)
  const orb = spr(glowTex, cfg.c2, 0); orb.position.set(0, 1.25, 0.9); body.add(orb);               // the power gathering between the wings
  const orbStar = spr(starTex, cfg.c3, 0); orbStar.position.copy(orb.position); body.add(orbStar);
  // sparkles and shimmer: glints that twinkle across the wings and drift down like dust of light
  const sparks = Array.from({ length: 46 }, (_, i) => { const s = spr(i % 3 ? starTex : glowTex, [cfg.c1, cfg.c2, cfg.c3][i % 3], 0);
    s.userData = { a: Math.random() * 6.283, r: 0.4 + Math.random() * 1.25, y: Math.random() * 2.1, sp: 0.5 + Math.random() * 1.4, ph: Math.random() * 6.283, sz: 0.06 + Math.random() * 0.11 }; root.add(s); return s; });
  // a soft shadow far below: he flies, the ground only sees his shade
  const shade = new T.Mesh(new T.CircleGeometry(0.7, 40), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })); shade.rotation.x = -Math.PI / 2; shade.position.y = 0.005; root.add(shade);
  const glowRing = spr(glowTex, cfg.c1, 0.18); glowRing.position.y = 0.02; glowRing.scale.set(1.8, 0.5, 1); root.add(glowRing);
  return { name, cfg, scene, root, body, mixer, clips, hover, ribbons, halo, core, brow, orb, orbStar, sparks, shade, glowRing, inner, last: 0, yaw: 0.7, side: 1, casting: 0, castSeen: 9, hitT: 0, ready: true };
}

const loader = new GLTFLoader();
function load(name) {
  if (inst[name]) return inst[name];
  const r = inst[name] = { ready: false };
  loader.loadAsync(BASE + ANGELS[name].glb + '.glb').then(g => { getRenderer(); Object.assign(r, build(name, g)); }).catch(e => console.warn('angel load failed', name, e));
  return r;
}

// SupremeCharge: from the start for a Mega Shot or special; held at the wings-forward cue while a blast charges; then back to the wingbeat
function animate(R, f, dt, o) {
  const sc = R.clips.SupremeCharge, hv = R.hover;
  const charging = (f.cg || 0) > 0, casting = !!f.ck && f.ct < 0.75 && (f.ck === 'special' || f.ck === 'mega' || f.uo);
  if (sc) {
    if ((casting && f.ct < R.castSeen - 0.05) || (charging && !R.casting)) { sc.reset(); sc.setEffectiveWeight(1); sc.play(); hv?.crossFadeTo(sc, 0.12, false); R.casting = 1; }
    R.castSeen = f.ck ? f.ct : 9;
    if (R.casting) {
      if (charging && sc.time >= CUE) { sc.time = CUE - 0.02 + Math.sin(performance.now() / 90) * 0.02; sc.paused = false; }
      const dur = sc.getClip().duration;
      if (!charging && sc.time >= dur - 0.05) { hv.reset(); hv.setEffectiveWeight(1); hv.play(); sc.crossFadeTo(hv, 0.25, false); R.casting = 0; }
    }
  }
  R.mixer.update(dt * (f.ds ? 1.9 : f.mv ? 1.35 : 1)); // the wings beat harder when he flies fast
}

function draw(ctx, x, y, h, f, col, o = {}) {
  const R = inst[o.name]; if (!R?.ready) return false;
  const nowS = (o.now ?? performance.now()) / 1000, dt = R.last ? Math.min(0.1, Math.max(0, nowS - R.last)) : 0; R.last = nowS;
  const faint = o.faint > 0 || f.hp <= 0;
  if (!faint) animate(R, f, dt, o); else R.mixer.update(dt * 0.3);
  // turn three-quarter toward where he flies (never edge-on, so the wings stay open)
  let fxx = f.fx || 0; if (Math.abs(fxx) > 0.15) R.side = fxx > 0 ? 1 : -1;
  const want = R.side * (f.ds ? 0.95 : 0.72); R.yaw += (want - R.yaw) * Math.min(1, dt * 7);
  R.root.rotation.set(0, R.yaw, 0);
  // flight: high off the ground, bobbing with the wingbeat, pitched and banked into the way he goes; a dash is a swoop
  const run = f.mv || f.ds, fy = f.fy || 0, bob = Math.sin(nowS * 4.9) * 0.07;
  R.hitT = f.hu > 0 ? 0.3 : Math.max(0, R.hitT - dt);
  const alt = faint ? Math.max(0, 0.55 - (o.faint || 1) * 0.55) : 0.6 + bob + (f.ds ? -0.12 : 0) + (f.st === 'trance' ? 0.15 : 0);
  R.body.position.set(0, alt, 0);
  R.body.rotation.set((run ? 0.22 + (f.ds ? 0.18 : 0) : 0.04) + fy * 0.12 + R.hitT * -0.6, 0, (run ? -R.side * 0.08 : 0) + Math.sin(nowS * 1.7) * 0.03 + (faint ? R.side * 0.9 * Math.min(1, o.faint || 1) : 0));
  R.shade.scale.setScalar(1 - alt * 0.35); R.shade.material.opacity = 0.32 - alt * 0.12;
  // the glow: ribbons pulse; the halo breathes; a charged blast builds an orb between the wings; the brow eye opens on a special
  const cg = f.cg || 0, castK = f.ck && f.ct < 0.75 ? 1 - f.ct / 0.75 : 0, pulse = 0.85 + Math.sin(nowS * 3.1) * 0.15;
  for (const r of R.ribbons) r.m.emissiveIntensity = r.base * (pulse + cg * 0.8 + castK * 0.6);
  R.halo.material.opacity = (0.42 + Math.sin(nowS * 2.2) * 0.08 + cg * 0.3 + castK * 0.25) * (faint ? 0.3 : 1);
  R.core.material.opacity = 0.28 + cg * 0.35;
  R.inner.intensity = 2.5 + cg * 6 + castK * 5;
  R.brow.material.opacity = f.ck === 'special' && f.ct < 0.9 ? 1 : 0.35 + Math.sin(nowS * 5) * 0.15; R.brow.scale.setScalar(0.22 + (f.ck === 'special' && f.ct < 0.9 ? 0.4 : 0));
  const os = cg > 0 ? 0.25 + cg * 1.1 : 0; R.orb.scale.setScalar(os * 1.6); R.orb.material.opacity = cg > 0 ? 0.9 : 0;
  R.orbStar.scale.setScalar(os * 1.3); R.orbStar.material.opacity = cg > 0 ? 0.6 + Math.sin(nowS * 30) * 0.3 : 0; R.orbStar.material.rotation = nowS * 3;
  R.sparks.forEach((s, i) => { const u = s.userData, fall = (u.y - nowS * u.sp * 0.35) % 2.2, yy = fall < 0 ? fall + 2.2 : fall, an = u.a + nowS * 0.4 * (i % 2 ? 1 : -1);
    s.position.set(Math.cos(an) * u.r * 1.25, alt + 0.15 + yy, Math.sin(an) * u.r * 0.45 - 0.2);
    const tw = Math.max(0, Math.sin(nowS * (3 + u.sp * 3) + u.ph)); s.material.opacity = (faint ? 0.2 : 1) * tw * (0.55 + cg * 0.45) * Math.min(1, yy * 2);
    s.scale.setScalar(u.sz * (0.6 + tw * 0.8) * (1 + cg * 0.6)); s.material.rotation = nowS * u.sp; });
  R.glowRing.material.opacity = faint ? 0 : 0.16 + cg * 0.2;
  const rd = getRenderer(); rd.render(R.scene, camera);
  const D = h * 1.15 * SIZE / (view.feet - view.head), s = D / SIZE;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; if (o.faint) ctx.globalAlpha *= Math.max(0, 1 - o.faint * 0.6);
  ctx.drawImage(rd.domElement, x - D / 2, y - view.feet * s, D, D); ctx.restore();
  return true;
}

function snapshot(name, px = 400, yaw = 0.5) {
  const R = inst[name]; if (!R?.ready) return null;
  R.root.rotation.set(0, yaw, 0); R.body.position.set(0, 0.3, 0); R.body.rotation.set(0, 0, 0);
  const rd = getRenderer(), cam = new T.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 1.6, 7); cam.lookAt(0, 1.3, 0);
  rd.setSize(px, px); rd.render(R.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(rd.domElement, 0, 0); rd.setSize(SIZE, SIZE);
  return c;
}

window.PMAngel = {
  has: n => !!ANGELS[n], ready: n => !!ANGELS[n] && !!load(n).ready, names: () => Object.keys(ANGELS), snapshot,
  draw: (ctx, x, y, h, f, col, o) => draw(ctx, x, y, h, f, col, o),
  colors: n => ANGELS[n] && { c1: '#' + ANGELS[n].c1.toString(16).padStart(6, '0'), c2: '#' + ANGELS[n].c2.toString(16).padStart(6, '0') },
};
