// Creature rig: the wild Monstars' 3D models (static GLBs from the 3D Roster) get a skeleton made for their body type, found on
// the model itself: legs are the clusters of vertices near the ground, the head is the front end, the tail the back, wings stick
// out to the sides. Each body type then moves the way that animal would:
//   quad    four legs in a trot (diagonal pairs together), head bobbing, tail wagging, a pounce for attacks, a leap for dashes
//   biped   two legs walking, body swaying, head nodding (upright creatures, robots, toads)
//   bird    two legs walking or tucked, wings flapping, hopping
//   insect  six legs in a tripod gait (three down, three swinging), buzzing wings
//   serpent a travelling wave down the body (slithering), the head rising to strike
//   float   a bobbing body with swaying tentacles (jellies, spores, blobs)
//   flyer   a gliding body with big flapping wings (rays, moths)
// window.PMCreature: same drawing contract as the other rigs.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// art key → [model file, body type, colour, options]
const C = {
  cindercub: ['000-cindercub', 'quad', 0xff6a1a], mossprout: ['001-mossprout', 'quad', 0x6ad84a], ripplefin: ['002-ripplefin', 'quad', 0x3a9aff],
  voltwing: ['003-voltwing', 'flyer', 0xffd23a], duskhorn: ['004-duskhorn', 'quad', 0xa070ff], pebblit: ['005-pebblit', 'quad', 0xc8a060],
  frostuft: ['006-frostuft', 'quad', 0x9ae8ff], bloomtail: ['007-bloomtail', 'quad', 0xff8ac8], soloryx: ['008-soloryx', 'quad', 0xffd060],
  pyrofinch: ['013-pyrofinch', 'bird', 0xff5a1a], emberjack: ['015-emberjack', 'quad', 0xff5a1a],
  coralisk: ['016-coralisk', 'quad', 0x3a8aff],
  wavewing: ['020-wavewing', 'bird', 0x3a8aff], mantiseed: ['023-mantiseed', 'insect', 0x8ae84a],
  lilypadra: ['025-lilypadra', 'biped', 0x3ac84a], zapurr: ['026-zapurr', 'quad', 0xffa03a],
  ohmoth: ['027-ohmoth', 'insect', 0xffd23a], joltail: ['029-joltail', 'serpent', 0x3a7aff], gloomwisp: ['030-gloomwisp', 'float', 0x3a3aaa],
  nocturrow: ['031-nocturrow', 'bird', 0x3a3a8a], geodillo: ['036-geodillo', 'quad', 0x8a6a4a],
  icicrow: ['040-icicrow', 'bird', 0x5ab8ff],
  lunaroo: ['043-lunaroo', 'biped', 0xc8d8e8], mindmoth: ['045-mindmoth', 'insect', 0xc08aff], toxitoad: ['048-toxitoad', 'biped', 0x5a3aaa],
  mycospore: ['049-mycospore', 'bird', 0xe84a4a], viperoot: ['051-viperoot', 'serpent', 0x4a9a3a], gearhound: ['052-gearhound', 'quad', 0xb8c0c8],
  ironshell: ['055-ironshell', 'insect', 0x3a6aaa], zephyrkit: ['056-zephyrkit', 'quad', 0x9affd8],
  whirlwisp: ['058-whirlwisp', 'float', 0x9ae8e8],
};
const BASE = './creatures/', SIZE = 300, VIEW = 1.5;
const inst = {}, st = {};
let renderer = null, camera = null, view = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function getRenderer() {
  if (renderer) return renderer;
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setSize(SIZE, SIZE); renderer.setClearColor(0, 0);
  camera = new T.PerspectiveCamera(34, 1, 0.1, 50); camera.position.set(0, 2.5, 6.0); camera.lookAt(0, 1.0, 0); camera.updateMatrixWorld(true);
  const proj = y => { const v = new T.Vector3(0, y, 0).project(camera); return (1 - v.y) / 2 * SIZE; };
  view = { feet: proj(0), head: proj(1.7) }; // same scale as the human rigs: a 1.7 unit person fills the fighter's height
  return renderer;
}

// a few rounds of k-means on (x, z)
function kmeans(pts, cents, iters = 8) {
  const k = cents.length, lab = new Int32Array(pts.length / 2);
  for (let it = 0; it < iters; it++) {
    const sx = new Float64Array(k), sz = new Float64Array(k), n = new Float64Array(k);
    for (let i = 0; i < lab.length; i++) { let b = 0, bd = Infinity; for (let j = 0; j < k; j++) { const d = (pts[i * 2] - cents[j][0]) ** 2 + (pts[i * 2 + 1] - cents[j][1]) ** 2; if (d < bd) { bd = d; b = j; } } lab[i] = b; sx[b] += pts[i * 2]; sz[b] += pts[i * 2 + 1]; n[b]++; }
    for (let j = 0; j < k; j++) if (n[j]) cents[j] = [sx[j] / n[j], sz[j] / n[j]];
  }
  return lab;
}

function build(name, gltf) {
  const [, type, col] = C[name], scene = new T.Scene(), root = new T.Group(); scene.add(root);
  let mesh = null; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingBox(); let bb = g.boundingBox; const len0 = bb.max.z - bb.min.z, h0 = bb.max.y - bb.min.y;
  const k = VIEW / Math.max(h0, len0 * (type === 'serpent' ? 0.5 : 0.8)); // (a long serpent still reads at a good size) g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.scale(k, k, k);
  // some models were generated from a front picture and are paper thin: give them depth, and keep them facing the camera
  g.computeBoundingBox(); bb = g.boundingBox; const thin = (bb.max.z - bb.min.z) < 0.35 * (bb.max.x - bb.min.x);
  if (thin) { const kz = Math.min(2.4, 0.5 * (bb.max.x - bb.min.x) / Math.max(1e-3, bb.max.z - bb.min.z)); g.scale(1, 1, kz); if (g.attributes.normal) g.deleteAttribute('normal'); }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.computeBoundingBox(); bb = g.boundingBox;
  const P = g.attributes.position, n = P.count, H = bb.max.y, L = bb.max.z - bb.min.z, W = bb.max.x - bb.min.x, z0 = bb.min.z, z1 = bb.max.z;
  // ---- bones
  const bones = [], B = (pos, parent) => { const b = new T.Bone(); b.userData.abs = pos.clone(); if (parent) { b.position.copy(pos).sub(parent.userData.abs); parent.add(b); } else b.position.copy(pos); bones.push(b); return b; };
  const legTop = { quad: 0.34, biped: 0.36, bird: 0.3, insect: 0.3 }[type] ?? 0;
  const body = B(new T.Vector3(0, H * (legTop || 0.4), 0), null);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), set = (i, a, wa, b = 0, wb = 0) => { SI[i * 4] = a; SW[i * 4] = wa; SI[i * 4 + 1] = b; SW[i * 4 + 1] = wb; };
  for (let i = 0; i < n; i++) set(i, 0, 1);
  const R = { type, body, legs: [], wings: [], chain: [], tent: [], head: null, tail: null, H, L, W, thin };
  const vx = i => P.getX(i), vy = i => P.getY(i), vz = i => P.getZ(i);
  // legs: clusters of vertices near the ground
  const nLegs = { quad: 4, biped: 2, bird: 2, insect: 6 }[type] || 0;
  if (nLegs) {
    const yTop = H * legTop, idx = [], pts = [];
    for (let i = 0; i < n; i++) if (vy(i) < yTop) { idx.push(i); pts.push(vx(i), vz(i)); }
    const init = nLegs === 4 ? [[W / 4, L / 4], [-W / 4, L / 4], [W / 4, -L / 4], [-W / 4, -L / 4]] : nLegs === 2 ? [[W / 4, 0], [-W / 4, 0]] : [[W / 4, L / 3], [-W / 4, L / 3], [W / 4, 0], [-W / 4, 0], [W / 4, -L / 3], [-W / 4, -L / 3]];
    const cents = init.map(c => c.slice()), lab = kmeans(pts, cents);
    cents.forEach(([cx, cz], j) => {
      const hip = B(new T.Vector3(cx, yTop, cz), body), knee = B(new T.Vector3(cx, yTop * 0.48, cz), hip), bi = bones.indexOf(hip), ki = bones.indexOf(knee);
      R.legs.push({ hip, knee, front: cz > 0, left: cx > 0, j });
      for (let q = 0; q < idx.length; q++) if (lab[q] === j) { const i = idx[q], y = vy(i); const t = clamp((y - yTop * 0.42) / (yTop * 0.12), 0, 1); // knee blend
        const top = clamp((y - yTop * 0.85) / (yTop * 0.15), 0, 1); // near the hip: blend into the body
        if (top > 0) set(i, bi, 1 - top, 0, top); else set(i, ki, 1 - t, bi, t); }
    });
  }
  // head (front end, above the legs) and tail (back end)
  if (type !== 'serpent' && type !== 'float') {
    const yMin = H * (legTop + 0.05), hz = z1 - L * (type === 'biped' ? 1 : 0.32), headUp = type === 'biped' ? H * 0.68 : yMin;
    const head = B(new T.Vector3(0, type === 'biped' ? H * 0.68 : H * 0.6, type === 'biped' ? 0 : hz), body), hi = bones.indexOf(head); R.head = head;
    const tz = z0 + L * 0.24, tail = B(new T.Vector3(0, H * (legTop + 0.1), tz), body), ti = bones.indexOf(tail); R.tail = tail;
    for (let i = 0; i < n; i++) { const y = vy(i), z = vz(i);
      if (type === 'biped' ? y > headUp : (z > hz && y > yMin)) { const w = type === 'biped' ? clamp((y - headUp) / (H * 0.06), 0, 1) : clamp((z - hz) / (L * 0.08), 0, 1); set(i, hi, w, 0, 1 - w); }
      else if (type !== 'biped' && z < tz && y > yMin) { const w = clamp((tz - z) / (L * 0.08), 0, 1); set(i, ti, w, 0, 1 - w); } }
  }
  // wings: far out to the sides, above the middle
  if (type === 'bird' || type === 'insect' || type === 'flyer') {
    const wx = W * (type === 'flyer' ? 0.18 : 0.28), wy = H * (type === 'flyer' ? 0.1 : 0.42);
    for (const sg of [1, -1]) { const wb = B(new T.Vector3(sg * wx, H * 0.55, 0), body), wi = bones.indexOf(wb); R.wings.push({ b: wb, sg });
      for (let i = 0; i < n; i++) { const x = vx(i) * sg; if (x > wx && vy(i) > wy) { const w = clamp((x - wx) / (W * 0.08), 0, 1); set(i, wi, w, 0, 1 - w); } } }
  }
  // serpent: a chain of bones along the body
  if (type === 'serpent') {
    const N = 6; let prev = body;
    for (let c = 0; c < N; c++) { const z = z0 + L * (c + 0.5) / N, b = B(new T.Vector3(0, H * 0.3, z), prev); R.chain.push(b); prev = b; }
    for (let i = 0; i < n; i++) { const u = clamp((vz(i) - z0) / L * N - 0.5, 0, N - 1), a = Math.floor(u), f = u - a, b = Math.min(N - 1, a + 1);
      set(i, bones.indexOf(R.chain[a]), 1 - f, bones.indexOf(R.chain[b]), f); }
  }
  // float: tentacles (the lower part) in four groups around the body
  if (type === 'float') {
    const ty = H * 0.45;
    for (let q = 0; q < 4; q++) { const an = q * Math.PI / 2 + Math.PI / 4, tb = B(new T.Vector3(Math.cos(an) * W * 0.15, ty, Math.sin(an) * L * 0.15), body); R.tent.push({ b: tb, an });
    }
    for (let i = 0; i < n; i++) { const y = vy(i); if (y < ty) { const an = Math.atan2(vz(i), vx(i)), q = ((Math.round((an - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4, w = clamp((ty - y) / (H * 0.15), 0, 1); set(i, bones.indexOf(R.tent[q].b), w, 0, 1 - w); } }
  }
  g.setAttribute('skinIndex', new T.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
  const mat = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
  for (const m of [].concat(mat)) { if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.2); }
  const sm = new T.SkinnedMesh(g, mat); sm.frustumCulled = false; sm.add(body); root.add(sm); root.updateMatrixWorld(true); sm.bind(new T.Skeleton(bones));
  R.rest = bones.map(b => b.position.clone());
  scene.add(new T.HemisphereLight(0xffffff, 0x6a7088, 2.4));
  const sun = new T.DirectionalLight(0xfff0d8, 2.8); sun.position.set(2.5, 4, 3.5); scene.add(sun);
  const rim = new T.DirectionalLight(col, 1.6); rim.position.set(-3, 2, -3); scene.add(rim);
  return Object.assign(R, { name, scene, root, sm, bones, ready: true });
}

function load(name) {
  if (inst[name]) return inst[name];
  const r = inst[name] = { ready: false };
  new GLTFLoader().loadAsync(BASE + C[name][0] + '.glb').then(g => { getRenderer(); Object.assign(r, build(name, g)); }).catch(e => console.warn('creature load failed', name, e));
  return r;
}

// ---- motion
function animate(R, f, o, t) {
  const s = st[o.name + (o.i ?? 0)] || (st[o.name + (o.i ?? 0)] = { ds0: 0, dsOn: false });
  if (f.ds && !s.dsOn) s.ds0 = t; s.dsOn = !!f.ds;
  const run = !!(f.mv || f.ds), cad = f.ds ? 16 : R.type === 'quad' ? 12 : R.type === 'insect' ? 18 : 10, p = t * cad;
  const casting = !!f.ck && f.ct < 0.6, ca = casting ? Math.sin(Math.PI * clamp(f.ct / 0.5, 0, 1)) : 0;
  const jump = f.ds ? Math.sin(Math.PI * clamp((t - s.ds0) / 0.42, 0, 1)) : 0, fall = o.faint ? clamp(o.faint * 1.4, 0, 1) : 0, hurt = f.hu > 0 ? 1 : 0;
  R.bones.forEach((b, i) => { b.position.copy(R.rest[i]); b.rotation.set(0, 0, 0); });
  const body = R.body;
  // whole body: bob with the stride, lean into a run, pounce on attacks, leap on dashes, fall over when fainted
  const bob = run ? Math.abs(Math.sin(p)) * R.H * 0.04 : Math.sin(t * 2.4) * R.H * 0.012;
  body.position.y += bob + jump * R.H * 0.45 + (R.type === 'float' || R.type === 'flyer' ? R.H * 0.12 + Math.sin(t * 2.2) * R.H * 0.05 : 0);
  body.rotation.x = (run ? 0.08 : 0) + ca * 0.25 - hurt * 0.2; body.position.z += ca * R.L * 0.12;
  body.rotation.z = fall * Math.PI / 2 + (R.thin && run ? Math.sin(p) * 0.08 : 0); body.position.y -= fall * R.H * 0.15;
  // legs
  for (const l of R.legs) {
    let ph;
    if (R.type === 'quad') ph = (l.front === l.left) ? 0 : Math.PI;            // trot: diagonal pairs together
    else if (R.type === 'insect') ph = ((l.j % 2) === (l.j >> 1) % 2) ? 0 : Math.PI; // tripod gait
    else ph = l.left ? 0 : Math.PI;                                              // walking
    const sw = Math.sin(p + ph), amp = run ? (f.ds ? 0.75 : 0.55) : 0.04;
    l.hip.rotation.x = sw * amp; l.knee.rotation.x = run ? Math.max(0, -Math.cos(p + ph)) * 0.7 : 0;
    if (jump > 0.05) { l.hip.rotation.x = (l.front ? -0.7 : 0.7) * jump; l.knee.rotation.x = 0.9 * jump; } // tucked in the leap
    if (R.type === 'bird' && run) l.hip.rotation.x = sw * 0.6;
  }
  // head nods with the stride, snaps forward to bite or strike; tail wags
  if (R.head) { R.head.rotation.x = (run ? Math.sin(p * 2) * 0.06 : Math.sin(t * 1.7) * 0.05) - ca * 0.45 + hurt * 0.3; R.head.rotation.y = Math.sin(t * 0.9) * 0.15 * (run ? 0.3 : 1); }
  if (R.tail) { R.tail.rotation.y = Math.sin(t * (run ? 12 : 4)) * (run ? 0.35 : 0.25); R.tail.rotation.x = -0.1 - (run ? 0.15 : 0); }
  // wings flap (fast when moving or flying, a big beat on attacks)
  for (const w of R.wings) { const fl = R.type === 'insect' ? Math.sin(t * 40) * 0.5 : Math.sin(t * (run ? 14 : R.type === 'flyer' ? 5 : 3)) * (run || R.type === 'flyer' ? 0.7 : 0.15);
    w.b.rotation.z = w.sg * (fl + ca * 0.8 - (R.type === 'bird' && !run && !casting ? 0.1 : 0)); }
  // serpent: a wave travels down the body
  R.chain.forEach((b, c) => { b.rotation.y = Math.sin((run ? t * 9 : t * 3) - c * 0.9) * (run ? 0.32 : 0.12); if (c === R.chain.length - 1) b.rotation.x = -0.3 - ca * 0.6; });
  // floater: tentacles sway
  R.tent.forEach(q => { q.b.rotation.x = Math.sin(t * 3 + q.an) * 0.25; q.b.rotation.z = Math.cos(t * 2.6 + q.an) * 0.25; });
}

function draw(ctx, x, y, h, f, col, o = {}) {
  const R = inst[o.name]; if (!R?.ready) return false;
  const t = (o.now ?? performance.now()) / 1000 + (o.i || 0) * 0.37;
  animate(R, f, o, t);
  let fxx = f.fx || 0, fyy = f.fy || 0; if (!fxx && !fyy) fxx = 1;
  R.root.rotation.set(0, R.thin ? (fxx < 0 ? -0.5 : 0.5) : Math.atan2(-fyy, fxx) + Math.PI / 2, 0); // the models face +Z; yaw 0 = facing right on screen (flat ones stay three-quarter to the camera)
  const rd = getRenderer(); rd.render(R.scene, camera);
  const D = h * SIZE / (view.feet - view.head), s = D / SIZE;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(rd.domElement, x - D / 2, y - view.feet * s, D, D); ctx.restore();
  return true;
}
function snapshot(name, px = 300, yaw = -0.6, act = {}, tt = 1) {
  const R = inst[name]; if (!R?.ready) return null; getRenderer();
  animate(R, { fx: 1, fy: 0, ...act }, { name, i: 9 }, tt); R.root.rotation.set(0, R.thin ? 0.5 : yaw + Math.PI / 2, 0);
  renderer.setSize(px, px); renderer.render(R.scene, camera); const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(renderer.domElement, 0, 0); renderer.setSize(SIZE, SIZE); return c;
}
window.PMCreature = { has: n => !!C[n], ready: n => !!C[n] && !!load(n).ready, draw, snapshot, names: () => Object.keys(C), type: n => C[n]?.[1] };
