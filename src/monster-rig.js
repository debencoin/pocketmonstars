// The Boss Monsters, drawn from their own animated 3D models (Higgsfield bodies with five baked clips: Idle, Move, Attack, Hit,
// Defeat). Each boss plays the clip that matches what it is doing in the fight, cross-fading between them, and walks the arena the
// way COVO does: the body faces where it goes, leans into a run and bobs with each stride. A dark ground sigil and a coloured
// glow mark it as a boss. window.PMBoss, same drawing contract as the other rigs (draw(ctx, x, y, h, f, col, o)).
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// art key → model file, boss colours (c1 main, c2 accent), model height in the arena (relative to a normal fighter), how fast it strides
const BOSSES = {
  thornmaw: { glb: 'thornmaw', c1: 0x3a8a2a, c2: 0x9aff4a, k: 1.12, fly: true },
  cinderwing: { glb: 'cinderwing', c1: 0xff3a1a, c2: 0xffb02a, k: 1.15, fly: true },
  crimsonharrow: { glb: 'crimson-harrow', c1: 0xc8102e, c2: 0xff5a6a, k: 1.15, fly: true },
  briarcoil: { glb: 'briarcoil', c1: 0x2a7a3a, c2: 0x9aff3a, k: 1.1 },
  abysssiren: { glb: 'abyss-siren', c1: 0x1a5aa8, c2: 0x3ad8ff, k: 1.1 },
  brineviper: { glb: 'brine-viper', c1: 0x2ab8a8, c2: 0x9affe8, k: 1.1 },
  gildedasp: { glb: 'gilded-asp', c1: 0xf2b81a, c2: 0xfff0a0, k: 1.1 },
  nulllancer: { glb: 'null-lancer', c1: 0x5a2a9a, c2: 0xb07aff, k: 1.22 },
  rifttalon: { glb: 'rift-talon', c1: 0x9a3aff, c2: 0xe0a0ff, k: 1.18 },
  hydramatron: { glb: 'hydra-matron', c1: 0x8a3aa8, c2: 0x9aff4a, k: 1.3 },
  icebackravager: { glb: 'iceback-ravager', c1: 0x7ad8ff, c2: 0xe8faff, k: 1.2 },
  paleclaw: { glb: 'paleclaw', c1: 0xc8102e, c2: 0xffffff, k: 1.15 },
  sableossuary: { glb: 'sable-ossuary', c1: 0x3a7aff, c2: 0xa0d0ff, k: 1.2 },
  lanternreaper: { glb: 'lantern-reaper', c1: 0x28e0d8, c2: 0xc0fff8, k: 1.25, fly: true },
  briarinquisitor: { glb: 'briar-inquisitor', c1: 0xb03a5a, c2: 0xffa0b0, k: 1.25 },
  ashscalebulwark: { glb: 'ashscale-bulwark', c1: 0xff5a10, c2: 0xffd040, k: 1.25 },
  rimeforgedsentinel: { glb: 'rimeforged-sentinel', c1: 0x3ab0ff, c2: 0xe0f6ff, k: 1.27 },
  stormhornrevenant: { glb: 'stormhorn-revenant', c1: 0x3a8aff, c2: 0xfff27a, k: 1.3 },
  whitehorncolossus: { glb: 'whitehorn-colossus', c1: 0xd8e8f0, c2: 0x7ad8ff, k: 1.4 },
  goldendreadchimera: { glb: 'golden-dread-chimera', c1: 0xffc81a, c2: 0xff7a1a, k: 1.4, fly: true },
};
const BASE = './bosses/', SIZE = 360, H = 1.7;
const inst = {};
let renderer = null, camera = null, view = null, glowTex = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setSize(SIZE, SIZE); renderer.setClearColor(0, 0);
  camera = new T.PerspectiveCamera(34, 1, 0.1, 50); camera.position.set(0, 2.9, 6.6); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(true);
  const proj = y => { const v = new T.Vector3(0, y, 0).project(camera); return (1 - v.y) / 2 * SIZE; };
  view = { feet: proj(0), head: proj(H) };
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new T.CanvasTexture(c);
  return renderer;
}

// a boss's ground sigil: two counter-turning runic rings and a dark pool, coloured like the boss
function sigil(c1, c2) {
  const g = new T.Group();
  const ringM = (r0, r1, col, op) => { const m = new T.Mesh(new T.RingGeometry(r0, r1, 64), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; g.add(m); return m; };
  const pool = new T.Mesh(new T.CircleGeometry(0.78, 48), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004; g.add(pool);
  const a = ringM(0.7, 0.76, c1, 0.8), b = ringM(0.5, 0.53, c2, 0.6);
  const ticks = new T.Group(); g.add(ticks);
  for (let i = 0; i < 12; i++) { const t = new T.Mesh(new T.BoxGeometry(0.03, 0.005, 0.12), new T.MeshBasicMaterial({ color: c1, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    const an = i / 12 * Math.PI * 2; t.position.set(Math.cos(an) * 0.62, 0.01, Math.sin(an) * 0.62); t.rotation.y = -an; ticks.add(t); }
  g.position.y = 0.01; return { g, a, b, ticks };
}

function build(name, gltf) {
  const cfg = BOSSES[name], scene = new T.Scene(), root = new T.Group(), body = new T.Group();
  scene.add(root); root.add(body); body.add(gltf.scene);
  const mixer = new T.AnimationMixer(gltf.scene), clips = {};
  for (const c of gltf.animations) clips[c.name] = mixer.clipAction(c);
  const first = clips.Idle || Object.values(clips)[0]; first?.play(); mixer.update(0); // measure the body in its standing pose
  gltf.scene.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(gltf.scene, true), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = H / size.y;
  gltf.scene.scale.multiplyScalar(k); gltf.scene.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
  gltf.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); if (o.material.metalness !== undefined) o.material.metalness = Math.min(o.material.metalness, 0.25); } } });
  scene.add(new T.HemisphereLight(0xffffff, 0x2a1a30, 2.2));
  const sun = new T.DirectionalLight(0xffeedd, 2.8); sun.position.set(2.5, 4, 3.5); scene.add(sun);
  const rim = new T.DirectionalLight(cfg.c1, 2.2); rim.position.set(-3, 2.5, -3); scene.add(rim); // an evil coloured rim light from behind
  const el = new T.PointLight(cfg.c2, 0, 4); el.position.set(0.5, 1.0, 0); root.add(el);
  const sg = sigil(cfg.c1, cfg.c2); root.add(sg.g);
  const motes = Array.from({ length: 14 }, (_, i) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: i % 2 ? cfg.c1 : cfg.c2, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false })); m.scale.setScalar(0.12); root.add(m); return m; });
  for (const n of ['Attack', 'Hit', 'Defeat']) if (clips[n]) { clips[n].setLoop(T.LoopOnce, 1); clips[n].clampWhenFinished = true; }
  return { name, cfg, scene, root, body, mixer, clips, cur: first ? (clips.Idle ? 'Idle' : first.getClip().name) : null, last: 0, sg, motes, el, castSeen: 9, hitSeen: 0, ready: true };
}

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
function load(name) {
  if (inst[name]) return inst[name];
  const r = inst[name] = { ready: false };
  loader.loadAsync(BASE + BOSSES[name].glb + '.glb').then(g => { getRenderer(); Object.assign(r, build(name, g)); }).catch(e => console.warn('boss load failed', name, e));
  return r;
}

function play(R, n, fade = 0.15, restart = false) {
  const a = R.clips[n]; if (!a) return;
  if (R.cur === n && !restart) return;
  const prev = R.clips[R.cur];
  a.reset(); a.setEffectiveWeight(1); a.play(); if (prev && prev !== a) prev.crossFadeTo(a, fade, false);
  R.cur = n;
}

function pick(R, f, o) {
  // fainted: hold the Defeat pose; just hit: flinch; casting: the Attack clip from the start; moving: Move; otherwise Idle
  if (o.faint > 0 || f.hp <= 0) return play(R, 'Defeat', 0.2);
  const casting = !!f.ck && f.ct < 0.75;
  if (casting && f.ct < R.castSeen - 0.05) play(R, 'Attack', 0.08, true);
  R.castSeen = f.ck ? f.ct : 9;
  if (casting && R.cur === 'Attack') return;
  if (f.hu > 0 && !R.hitSeen) { R.hitSeen = 1; return play(R, 'Hit', 0.06, true); }
  if (!(f.hu > 0)) R.hitSeen = 0;
  if (R.cur === 'Hit' && R.clips.Hit && R.clips.Hit.time < R.clips.Hit.getClip().duration * 0.9) return;
  play(R, f.mv || f.ds ? 'Move' : 'Idle', 0.2);
}

function draw(ctx, x, y, h, f, col, o = {}) {
  const R = inst[o.name]; if (!R?.ready) return false;
  const nowS = (o.now ?? performance.now()) / 1000, dt = R.last ? Math.min(0.1, Math.max(0, nowS - R.last)) : 0; R.last = nowS;
  pick(R, f, o);
  R.mixer.update(dt * (f.ds ? 1.6 : 1));
  // facing: the model looks down +Z; yaw 0 = facing right on screen
  let fxx = f.fx || 0, fyy = f.fy || 0; if (!fxx && !fyy) fxx = 1;
  const yaw = Math.atan2(-fyy, fxx);
  R.root.rotation.set(0, yaw + Math.PI / 2, 0);
  // COVO-style movement: lean into the run, bob with each stride; flyers hover and bank
  const run = f.mv || f.ds, cad = f.ds ? 14 : 9, st = Math.sin(nowS * cad);
  R.body.rotation.set(run ? 0.12 + (f.ds ? 0.1 : 0) : 0, 0, run ? st * 0.05 : 0);
  R.body.position.y = (R.cfg.fly ? 0.22 + Math.sin(nowS * 3) * 0.06 : 0) + (run ? Math.abs(st) * 0.05 : 0);
  // boss sigil and motes
  R.sg.a.rotation.z = nowS * 0.8; R.sg.b.rotation.z = -nowS * 1.3; R.sg.ticks.rotation.y = -nowS * 0.6;
  const casting = !!f.ck && f.ct < 0.75, pulse = casting ? 1 : 0.55 + Math.sin(nowS * 4) * 0.15;
  R.sg.a.material.opacity = 0.8 * pulse; R.sg.b.material.opacity = 0.6 * pulse; R.el.intensity = casting ? 9 : 2.5;
  R.motes.forEach((m, i) => { const u = (i / R.motes.length + nowS * 0.35) % 1, an = i * 2.4 + nowS * 1.5; m.position.set(Math.cos(an) * 0.6, u * 1.9, Math.sin(an) * 0.6); m.material.opacity = (1 - u) * 0.9; m.scale.setScalar(0.08 + (1 - u) * 0.08); });
  R.sg.g.visible = !(o.faint > 0);
  const rd = getRenderer(); rd.render(R.scene, camera);
  const D = h * 1.15 * SIZE / (view.feet - view.head), s = D / SIZE;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; if (o.faint) ctx.globalAlpha *= Math.max(0, 1 - o.faint * 0.6);
  ctx.drawImage(rd.domElement, x - D / 2, y - view.feet * s, D, D); ctx.restore();
  return true;
}

// a still picture for cards and pickers: `px` square, playing a clip at time tt
function snapshot(name, px = 400, yaw = -0.6, clip = 'Idle', tt = 0.5) {
  const R = inst[name]; if (!R?.ready) return null;
  for (const a of Object.values(R.clips)) a.stop();
  const a = R.clips[clip] || R.clips.Idle; if (a) { a.reset(); a.play(); R.mixer.setTime(tt); }
  R.cur = clip; R.root.rotation.set(0, yaw + Math.PI / 2, 0); R.body.rotation.set(0, 0, 0); R.body.position.y = R.cfg.fly ? 0.2 : 0;
  const rd = getRenderer(), cam = new T.PerspectiveCamera(26, 1, 0.1, 50); cam.position.set(0, 1.9, 5.4); cam.lookAt(0, 0.95, 0);
  rd.setSize(px, px); rd.render(R.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(rd.domElement, 0, 0); rd.setSize(SIZE, SIZE);
  if (R.clips.Idle) { for (const x of Object.values(R.clips)) x.stop(); R.clips.Idle.reset().play(); R.cur = 'Idle'; }
  return c;
}

window.PMBoss = {
  has: n => !!BOSSES[n], ready: n => !!BOSSES[n] && !!load(n).ready, names: () => Object.keys(BOSSES), snapshot,
  draw: (ctx, x, y, h, f, col, o) => draw(ctx, x, y, h, f, col, o),
  colors: n => BOSSES[n] && { c1: '#' + BOSSES[n].c1.toString(16).padStart(6, '0'), c2: '#' + BOSSES[n].c2.toString(16).padStart(6, '0') },
};
