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
  // the Ancient Beings: a winged Watcher, a Nephilim giant and an Anunnaki ruler
  sarielthewatcher: { glb: 'sarielwatcher', el: 'aether', c1: 0x8a6aff, c2: 0xffe9a0, turn: Math.PI / 2, wings: [0.2], jt: { neck: 0.7, top: 0.96 } },
  neraththenephilim: { glb: 'nerathnephilim', el: 'earth', c1: 0xc87a3a, c2: 0xffb060, turn: Math.PI / 2, rs: 1.5, jt: { hip: 0.44, chest: 0.52, neck: 0.74, top: 0.98, sh: [0.76, 0.2], el: [0.52, 0.33], wr: [0.37, 0.37], hand: [0.28, 0.38], hj: [0.44, 0.09], kn: [0.22, 0.1], an: [0.05, 0.11] } },
  enkartheanunnaki: { glb: 'enkaranunnaki', el: 'aether', c1: 0xffb02a, c2: 0x3a6aff, turn: Math.PI / 2, rs: 1.2, jt: { hip: 0.34, chest: 0.42, neck: 0.56, top: 0.98, sh: [0.62, 0.15], el: [0.47, 0.27], wr: [0.34, 0.33], hand: [0.28, 0.34], hj: [0.34, 0.07], kn: [0.18, 0.075], an: [0.04, 0.08] } },
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


// ---- A person's skeleton for the static models: hips, chest, head, two arms (upper + fore) and two legs (thigh + shin).
// The joints sit at human proportions of the model's height, every vertex is skinned to the nearest body parts, and the bones are swung each frame,
// so the fighters run, punch, guard, crouch and fall like people instead of sliding along as one piece. A = the +Z side, B = the -Z side.
const JT = { hip: 0.37, chest: 0.46, neck: 0.66, top: 0.97, sh: [0.64, 0.115], el: [0.52, 0.165], wr: [0.42, 0.195], hand: [0.35, 0.205], hj: [0.37, 0.055], kn: [0.20, 0.06], an: [0.045, 0.065], toe: 0.09 };
const LT = JT.hj[0] - JT.kn[0], LS = JT.kn[0] - JT.an[0]; // thigh and shin length (fractions of the height)
function rigBody(scene, cfg = {}) {
  const J = { ...JT, ...(cfg.jt || {}) }, RS = cfg.rs || 1, LT = J.hj[0] - J.kn[0], LS = J.kn[0] - J.an[0];
  let mesh = null; scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
  const g = mesh.geometry; if (cfg.turn) g.rotateY(cfg.turn); const pa = g.attributes.position, n = pa.count, P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P[i * 3] = pa.getX(i); P[i * 3 + 1] = pa.getY(i); P[i * 3 + 2] = pa.getZ(i); }
  g.setAttribute('position', new T.BufferAttribute(P, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  else if (g.attributes.normal.normalized || g.attributes.normal.array.constructor !== Float32Array) { const na = g.attributes.normal, N = new Float32Array(n * 3); for (let i = 0; i < n; i++) { N[i * 3] = na.getX(i); N[i * 3 + 1] = na.getY(i); N[i * 3 + 2] = na.getZ(i); } g.setAttribute('normal', new T.BufferAttribute(N, 3)); }
  g.computeBoundingBox(); const bb = g.boundingBox, y0 = bb.min.y, h = bb.max.y - bb.min.y, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const V = (t, z = 0, x = 0) => new T.Vector3(cx + x * h, y0 + t * h, cz + z * h);
  // bone segments: [bone index, from, to, radius]
  const segs = [[0, V(J.hip), V(J.hip + 0.07), 0.12 * RS], [1, V(J.chest), V(J.neck - 0.02), 0.16 * RS], [2, V(J.neck), V(J.top - 0.1), 0.2]];
  for (const sg of [1, -1]) { const A = sg > 0, b = A ? 3 : 5, t = A ? 7 : 9;
    segs.push([b, V(J.sh[0], sg * J.sh[1]), V(J.el[0], sg * J.el[1]), 0.05 * RS], [b + 1, V(J.el[0], sg * J.el[1]), V(J.wr[0], sg * J.wr[1]), 0.048 * RS], [b + 1, V(J.wr[0], sg * J.wr[1]), V(J.hand[0], sg * J.hand[1]), 0.05 * RS],
      [t, V(J.hj[0] + 0.02, sg * J.hj[1]), V(J.kn[0], sg * J.kn[1]), 0.1 * RS], [t + 1, V(J.kn[0], sg * J.kn[1]), V(J.an[0], sg * J.an[1]), 0.085 * RS], [A ? 11 : 12, V(J.an[0], sg * J.an[1]), V(J.an[0] - 0.02, sg * J.an[1], J.toe), 0.06 * RS]); }
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), v = new T.Vector3(), ab = new T.Vector3(), ap = new T.Vector3(), ws = new Float32Array(15);
  for (let i = 0; i < n; i++) { v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); ws.fill(1e9);
    for (const [bi, a, b, r] of segs) { ab.subVectors(b, a); ap.subVectors(v, a); const k = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1), d = ap.sub(ab.multiplyScalar(k)).length() / r; if (d < ws[bi]) ws[bi] = d; }
    const idx = Array.from(ws.keys()).sort((x, y) => ws[x] - ws[y]).slice(0, 4), w = idx.map(j => 1 / (Math.pow(ws[j], 3) + 0.02)), tot = w[0] + w[1] + w[2] + w[3];
    for (let j = 0; j < 4; j++) { SI[i * 4 + j] = idx[j]; SW[i * 4 + j] = w[j] / tot; } }
  if (cfg.wings) { // wing vertices (far out to the sides, above the hips) follow their own wing bones: 13 = +Z wing, 14 = -Z wing
    for (let i = 0; i < n; i++) { const z = P[i * 3 + 2] - cz, y = (P[i * 3 + 1] - y0) / h, a = Math.abs(z) / h, k = clamp((a - cfg.wings[0]) / 0.07, 0, 1) * (y > 0.28 ? 1 : 0); if (k <= 0) continue;
      const wi = z > 0 ? 13 : 14; for (let j = 0; j < 4; j++) SW[i * 4 + j] *= 1 - k; SI[i * 4 + 3] = wi; SW[i * 4 + 3] = k + SW[i * 4 + 3] * (1 - k) * 0 + (SI[i * 4 + 3] === wi ? 0 : 0); const tot = SW[i * 4] + SW[i * 4 + 1] + SW[i * 4 + 2] + SW[i * 4 + 3]; for (let j = 0; j < 4; j++) SW[i * 4 + j] /= tot; } }
  g.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
  const bone = (abs, parent, pabs) => { const b = new T.Bone(); b.position.copy(abs).sub(pabs); (parent || null)?.add(b); return b; };
  const hipsP = V(J.hip), chestP = V(J.chest), headP = V(J.neck);
  const hips = bone(hipsP, null, new T.Vector3()), chest = bone(chestP, hips, hipsP), head = bone(headP, chest, chestP), B = [hips, chest, head];
  const leg = sg => { const th = bone(V(J.hj[0], sg * J.hj[1]), hips, hipsP), sh = bone(V(J.kn[0], sg * J.kn[1]), th, V(J.hj[0], sg * J.hj[1])); return [th, sh]; };
  const arm = sg => { const ua = bone(V(J.sh[0], sg * J.sh[1]), chest, chestP), fa = bone(V(J.el[0], sg * J.el[1]), ua, V(J.sh[0], sg * J.sh[1])); return [ua, fa]; };
  const [uaA, faA] = arm(1), [uaB, faB] = arm(-1), [thA, shA] = leg(1), [thB, shB] = leg(-1); B.push(uaA, faA, uaB, faB, thA, shA, thB, shB);
  const ft = (sh, sg) => bone(V(J.an[0], sg * J.an[1]), sh, V(J.kn[0], sg * J.kn[1])), ftA = ft(shA, 1), ftB = ft(shB, -1); B.push(ftA, ftB);
  if (cfg.wings) { const wb = sg => bone(V(J.sh[0] - 0.02, sg * 0.07, -0.03), chest, chestP); B.push(wb(1), wb(-1)); }
  const par = mesh.parent, sm = new T.SkinnedMesh(g, mesh.material); sm.name = mesh.name; sm.position.copy(mesh.position); sm.quaternion.copy(mesh.quaternion); sm.scale.copy(mesh.scale);
  par.add(sm); par.remove(mesh); sm.add(hips); par.updateMatrixWorld(true); sm.bind(new T.Skeleton(B)); sm.frustumCulled = false;
  return { hips, chest, head, uaA, faA, uaB, faB, thA, shA, thB, shB, ftA, ftB, wA: B[13], wB: B[14], lt: LT, ls: LS, h };
}

function build(name, gltf) {
  const cfg = GIRLS[name], scene = new T.Scene(), root = new T.Group(), body = new T.Group();
  scene.add(root); root.add(body); body.add(gltf.scene); const bones = rigBody(gltf.scene, cfg);
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
  return { name, cfg, scene, root, body, bones, mats, el, motes, ring, ring2, orb, core, shell, trail, ready: true };
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


// ---- Human motion: the angle of every joint (radians; + swings forward, knees and elbows bend by + flex) for what the fighter is doing now
const ease = k => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k;
const R_wings = o => !!GIRLS[o.name]?.wings;
function limbs(f, o, t, S, u, casting, moving, fly) {
  const L = { thA: 0, thB: 0, kA: 0, kB: 0, uaA: 0, uaB: 0, faA: 0.2, faB: 0.2, twist: 0, hipTw: 0, headY: 0, headZ: 0, chestX: 0, chestZ: 0, splay: 0.1, tsp: 0.04, ground: true, shake: 0, wf: 0, wy: 0 };
  const br = Math.sin(t * 2.4);
  if (fly) { // floating: legs hang loose and drift, arms float out
    L.ground = false; L.thA = 0.12 + Math.sin(t * 1.9) * 0.1; L.thB = -0.06 + Math.sin(t * 1.9 + 1.2) * 0.1; L.kA = 0.35; L.kB = 0.5; L.uaA = 0.25 + br * 0.08; L.uaB = 0.2 - br * 0.08; L.faA = 0.5; L.faB = 0.6; L.splay = 0.35;
    if (moving) { L.thA = -0.5; L.thB = -0.65; L.kA = 0.9; L.kB = 0.7; L.uaA = -0.5; L.uaB = -0.5; L.faA = 0.3; L.faB = 0.3; L.chestX = 0.1; }
  } else if (moving) { // run: the legs scissor, the knees fold on the way forward, the arms pump against the legs, the chest twists
    const p = t * (f.ds ? 15 : 11.5), sA = Math.sin(p), sB = -sA, amp = f.ds ? 1.15 : 0.95;
    L.thA = sA * amp; L.thB = sB * amp; L.kA = 0.2 + Math.max(0, Math.cos(p)) * 1.25; L.kB = 0.2 + Math.max(0, -Math.cos(p)) * 1.25;
    L.uaA = -sA * (f.ds ? 1.1 : 0.9) - (f.ds ? 0.5 : 0); L.uaB = -sB * (f.ds ? 1.1 : 0.9) - (f.ds ? 0.5 : 0); L.faA = 1.15 + sA * 0.25; L.faB = 1.15 + sB * 0.25;
    L.twist = sA * 0.2; L.hipTw = -sA * 0.12; L.headY = -sA * 0.14; L.chestX = Math.cos(p * 2) * 0.03; L.splay = 0.05; L.tsp = 0.02;
  } else { // ready stance: a bounce on the toes, fists up, weight shifting
    const sw = Math.sin(t * 1.3); L.thA = 0.3 + sw * 0.05; L.thB = -0.14 - sw * 0.05; L.kA = 0.45 + br * 0.03; L.kB = 0.28; L.uaA = 0.55 + br * 0.04; L.uaB = 0.15 + br * 0.04; L.faA = 1.3; L.faB = 1.45; L.twist = 0.16 + sw * 0.03; L.hipTw = -0.08; L.headY = -0.1; L.splay = 0.08; L.chestZ = br * 0.015;
  }
  if (f.cg > 0 && !fly) { // charging: a wide crouch, both arms drawn back to the hip, shaking harder as the energy builds
    const c = f.cg; L.thA = 0.55; L.thB = -0.45; L.kA = 1.0 + c * 0.25; L.kB = 0.85 + c * 0.2; L.uaA = -0.45 - c * 0.25; L.uaB = -0.55 - c * 0.25; L.faA = 1.5; L.faB = 1.5; L.twist = 0.25; L.chestZ = 0.18 + c * 0.1; L.chestX = 0; L.headY = -0.2; L.shake = 0.01 + c * 0.035; L.splay = 0.2;
  } else if (f.cg > 0) { L.uaA = L.uaB = -0.5; L.faA = L.faB = 1.3; L.shake = 0.02 * f.cg; }
  if (f.g) { // guard: knees bent, both forearms crossed up in front of the face, head tucked
    L.thA = 0.35; L.thB = -0.2; L.kA = 0.75; L.kB = 0.6; L.uaA = 1.15; L.uaB = 1.05; L.faA = 2.05; L.faB = 2.15; L.twist = 0.3; L.chestZ = 0.12; L.headZ = 0.12; L.headY = -0.2; L.splay = -0.2; L.chestX = 0;
  }
  if (casting && f.ck === 'basic') { // a strike: wind the arm back, snap it forward, step into it, twist the hips behind it
    const A = !(S.combo % 2), wind = clamp(u / 0.3, 0, 1), st = ease(clamp((u - 0.3) / 0.22, 0, 1)), rec = ease(clamp((u - 0.62) / 0.38, 0, 1)), k = Math.sin(Math.PI * u);
    const ua = mix(mix(0.55, -0.95, ease(wind)), 1.5, st) * (1 - rec) + 0.55 * rec, fa = mix(mix(1.3, 1.7, ease(wind)), 0.12, st) * (1 - rec) + 1.3 * rec, tw = mix(mix(0.16, -0.55, ease(wind)), 0.7, st) * (1 - rec) + 0.16 * rec;
    if (A) { L.uaA = ua; L.faA = fa; L.uaB = 0.2; L.faB = 1.7; } else { L.uaB = ua; L.faB = fa; L.uaA = 0.2; L.faA = 1.7; } L.twist = A ? tw : -tw * 0.6; L.hipTw = -L.twist * 0.5;
    if (!fly) { L.thA = 0.55 * k + 0.1; L.thB = -0.5 * k; L.kA = 0.5 + k * 0.4; L.kB = 0.4 + k * 0.4; }
  }
  if (casting && f.ck === 'special') { // a sweeping strike: arms back and up, then a big step and both arms slice through
    const w = ease(clamp(u / 0.4, 0, 1)), s = ease(clamp((u - 0.4) / 0.35, 0, 1)), rec = ease(clamp((u - 0.78) / 0.22, 0, 1)), a = mix(mix(0.55, -1.4, w), 1.9, s) * (1 - rec) + 0.55 * rec;
    L.uaA = a; L.uaB = a * 0.75; L.faA = mix(1.3, 0.2, s) * (1 - rec) + 1.3 * rec; L.faB = 0.5 + (1 - s) * 0.9; L.twist = mix(mix(0.2, -0.8, w), 0.8, s) * (1 - rec); L.hipTw = -L.twist * 0.5;
    if (!fly) { const k = Math.sin(Math.PI * clamp(u * 1.2, 0, 1)); L.thA = 0.8 * k; L.thB = -0.6 * k; L.kA = 0.7 + k * 0.5; L.kB = 0.5 + k * 0.5; }
  }
  if (f.ck === 'mega' && f.ct < 1.3) { // mega: arms thrown wide and up, legs apart, then everything forward
    const w = ease(clamp(u * 2, 0, 1)), s = ease(clamp((u - 0.5) * 2.2, 0, 1)); L.uaA = L.uaB = mix(mix(0.5, 2.9, w), 1.5, s); L.faA = L.faB = mix(0.4, 0.1, s); L.splay = mix(0.1, 0.5, w) * (1 - s); L.thA = 0.35; L.thB = -0.35; L.kA = L.kB = 0.25; L.chestX = -0.15 * (1 - s); L.twist = 0; L.ground = false;
  }
  if (f.tr > 0) { L.ground = false; L.uaA = L.uaB = 2.3; L.faA = L.faB = 0.3; L.thA = 0.3; L.thB = -0.3; L.kA = L.kB = 0.5; }
  if (f.hu > 0) { const k = Math.min(1, f.hu / 0.25); L.uaA = -0.7 * k; L.uaB = -0.5 * k; L.faA = L.faB = 0.4; L.headZ = -0.35 * k; L.chestZ = -0.25 * k; L.kA += 0.5 * k; L.kB += 0.5 * k; L.thA = 0.2 * k; L.thB = -0.3 * k; L.splay = 0.4 * k; }
  if (f.st) { L.shake = 0.03; L.faA = L.faB = 0.5; }
  { const wing = R_wings(o); if (wing) { L.wf = fly ? Math.sin(t * (moving ? 9 : 4.2)) * (moving ? 0.75 : 0.5) + 0.15 : 0.12 + br * 0.03; if (f.ck === 'mega') L.wf = -0.8 + Math.sin(t * 14) * 0.2; if (f.g) { L.wf = 0.1; L.wy = 1.25; } if (f.cg > 0) { L.wf = -0.3; L.wy = -0.3; } if (f.hu > 0) L.wf = 0.6; } }
  if (o.faint) { const k = Math.min(1, o.faint * 1.4); L.uaA = 0.3 * k; L.uaB = -0.2 * k; L.faA = L.faB = 0.2; L.thA = 0.1; L.thB = -0.1; L.kA = L.kB = 0.2; L.splay = 0.5 * k; L.ground = false; L.twist = 0; L.headY = 0; }
  return L;
}
const legReach = (R, th, k) => R.bones.lt * Math.cos(th) + R.bones.ls * Math.cos(th - k);
function skeleton(R, L, out, t) {
  const b = R.bones; if (!b) return;
  const sh = L.shake ? (Math.sin(t * 61) * L.shake) : 0, sh2 = L.shake ? Math.cos(t * 53) * L.shake : 0;
  b.hips.rotation.set(0, L.hipTw, 0); b.chest.rotation.set(L.chestX + sh, L.twist, L.chestZ + sh2); b.head.rotation.set(0, L.headY, L.headZ);
  b.uaA.rotation.set(-L.splay, 0, L.uaA); b.uaB.rotation.set(L.splay, 0, L.uaB); b.faA.rotation.set(0, 0, L.faA); b.faB.rotation.set(0, 0, L.faB);
  b.thA.rotation.set(-L.tsp, 0, L.thA); b.thB.rotation.set(L.tsp, 0, L.thB); b.shA.rotation.set(0, 0, -L.kA); b.shB.rotation.set(0, 0, -L.kB);
  // the feet stay flat on the ground when planted and point down as the leg trails behind
  const fa = (th, k) => clamp(-(th - k) + (th - k < -0.2 ? -0.5 * (th - k + 0.2) * -1 * 0 : 0), -0.9, 0.9) * 0.85 - Math.max(0, k - th) * 0.0;
  b.ftA.rotation.set(0, 0, fa(L.thA, L.kA)); b.ftB.rotation.set(0, 0, fa(L.thB, L.kB));
  // keep the planted foot on the floor: the hips sink as the legs fold and rise as they straighten
  out.legDrop = L.ground ? (b.lt + b.ls - Math.max(legReach(R, L.thA, L.kA), legReach(R, L.thB, L.kB))) * H : 0;
  if (b.wA) { b.wA.rotation.set(-L.wf, L.wy, 0); b.wB.rotation.set(L.wf, -L.wy, 0); }
}

// The pose: everything the static body can do (offsets in model units; lean > 0 leans forward)
function pose(R, f, o, t) {
  const S = stateOf(f, o), out = { y: 0, lean: 0, roll: 0, fwd: 0, yaw: 0, sx: 1, sy: 1, fall: 0, flash: 0, orb: 0, ring: 0, shell: 0, glow: 0.2, spin: 0 };
  const dur = f.ck === 'mega' ? 1.3 : f.ck === 'special' ? 0.9 : 0.5, casting = !!f.ck && f.ct < dur, u = casting ? clamp(f.ct / dur, 0, 1) : 0, moving = f.mv && !f.ds;
  const stage = clamp(f.sg || 0, 0, 5);
  out.y = (f.fl ? 0.3 + Math.sin(t * 2.6) * 0.05 : 0); // an airbender hovers out.glow = 0.25 + stage * 0.06 + (f.fl ? 0.1 : 0);
  if (moving) { out.lean = f.ds ? 0.4 : 0.18; out.glow += 0.1; }
  if (f.ds) { out.lean = 0.42; out.fwd = 0.1; out.glow = 1; }
  if (f.g) { out.shell = 0.35 + Math.sin(t * 8) * 0.06; out.glow = 0.7; }
  if (casting && f.ck === 'basic') { const k = Math.sin(Math.PI * u); out.lean = 0.1 + k * 0.3; out.fwd = k * 0.14; out.orb = k; out.glow = 0.5 + k; }
  if (casting && f.ck === 'special') { // wind up (rise, lean back), then strike (lean far forward, spin on every second cast)
    const w = clamp(u / 0.4, 0, 1), s = clamp((u - 0.4) / 0.6, 0, 1); out.y += w * 0.12 * (1 - s); out.lean = -0.3 * w * (1 - s) + 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (s > 0);
    out.fwd = 0.2 * Math.sin(Math.PI * s); out.orb = 0.4 + Math.sin(Math.PI * u); out.glow = 0.6 + Math.sin(Math.PI * u) * 1.4; out.ring = Math.sin(Math.PI * u); if (S.el % 2) out.spin = u * Math.PI * 2; }
  if (f.ck === 'mega' && f.ct < dur) { out.y += Math.sin(Math.PI * Math.min(1, u * 1.3)) * 0.35; out.spin = u * Math.PI * 4; out.orb = 1.6; out.glow = 2.4; out.ring = 1.4; out.lean = -0.1; }
  if (f.tr > 0) { out.y += 0.2; out.glow = 2; out.spin = (1 - f.tr / 0.9) * Math.PI * 2; out.ring = 1; }
  if (f.hu > 0) { out.lean = -0.35 * Math.min(1, f.hu / 0.25); out.flash = -1; out.fwd = -0.1; }
  if (o.faint) { out.fall = Math.min(1, o.faint * 1.4); out.glow = 0; out.orb = 0; }
  if (f.st) out.flash = out.flash || 0.35;
  out.L = limbs(f, o, t, S, u, casting, moving, !!f.fl); out.sy = 1;
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
  skeleton(R, out.L, out, now);
  R.root.rotation.set(0, yaw + out.yaw + out.spin, 0);
  R.body.rotation.set(0, 0, -(out.lean) + out.fall * 1.5);
  R.body.rotation.x = out.roll; R.body.scale.set(out.sx, out.sy, out.sx);
  R.body.position.set(out.fwd, out.y - (out.legDrop || 0) + out.fall * 0.02, 0);
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
function snapshot(name, px = 512, yaw = -0.75, hh = 0.74, act = null, tt = 1.0) {
  const R = inst[name]; if (!R?.ready) return null;
  const f = { fx: Math.cos(yaw), fy: -Math.sin(yaw), ...(act || {}) }, out = pose(R, f, { name, i: 9, ...(act?.o || {}) }, tt); if (act?.nospin) out.spin = 0; out.glow = 0.7; out.ring = 0.3;
  apply(R, out, f, tt, yaw); energy(R, out, f, tt, null); R.shell.material.opacity = 0;
  const rd = getRenderer(), cam = new T.PerspectiveCamera(24, 1, 0.1, 50), dist = H / hh / (2 * Math.tan(12 * Math.PI / 180));
  cam.position.set(0, 0.85 + dist * 0.2, dist); cam.lookAt(0, 0.8, 0); rd.setSize(px, px); rd.render(R.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(rd.domElement, 0, 0); rd.setSize(SIZE, SIZE); return c;
}
window.PMGirl = {
  snapshot, has: n => !!GIRLS[n], ready: n => { if (!GIRLS[n]) return false; return !!load(n).ready; },
  draw: (ctx, x, y, h, f, col, o) => draw(ctx, x, y, h, f, col, o), names: () => Object.keys(GIRLS),
  colors: n => GIRLS[n] && { c1: '#' + GIRLS[n].c1.toString(16).padStart(6, '0'), c2: '#' + GIRLS[n].c2.toString(16).padStart(6, '0') },
};
