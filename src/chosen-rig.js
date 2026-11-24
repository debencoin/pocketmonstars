// The Chosen Ones in 3D: skinned GLB models (dist/chosen/<File>.glb) drawn into the arena with Three.js (bundled by `npm run build`,
// never loaded from a CDN). Every fighter turns a full 360 degrees, runs, dashes, guards, takes hits and falls, and plays
// five different cast poses plus slash combos. The energy saber is built in code (so its length and glow follow the move)
// and energy streams from the fighter's chest, through the arm, into the blade.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// glb: file in dist/chosen/; c1 / c2: main and second energy colour; top: how far the hilt reaches above the fist (model units, model is 1.7 tall);
// hue: turn the costume colours by this many degrees (the four new fighters wear recoloured costumes of the pack's models); trim: remove the baked-in blade ('up' above the hand, 'down' below it)
const CHR = {
  akena:        { glb: 'AKENA', c1: 0xff2a3a, c2: 0x9a2aff, top: 0.2, trim: 'up' },
  amyah:        { glb: 'Amyah', c1: 0x3a9bff, c2: 0xcfeaff, top: 0.13 },
  aurelia:      { glb: 'Aurelia', c1: 0xffd23a, c2: 0xfff4c0, top: 0.44, trim: 'down' },
  azaelionvoid: { glb: 'Azaelion', bald: true, c1: 0xb45cff, c2: 0x5a2aff, top: 0.45, trim: 'down' },
  azmara:       { glb: 'Azmara', c1: 0xe060ff, c2: 0x40e8ff, top: 0.4, trim: 'down' },
  kaelion:      { glb: 'Kaelion', bald: true, c1: 0x3ac8ff, c2: 0x2a5aff, top: 0.18 },
  malakar:      { glb: 'Malakar', bald: true, c1: 0xff1a2a, c2: 0xc040ff, top: 0.18, trim: 'up' },
  nymara:       { glb: 'Nymara', bald: true, c1: 0x3aff6a, c2: 0xff8ad0, top: 0.47 },
  solarius:     { glb: 'Solarius', bald: true, c1: 0xffb020, c2: 0xff5a1a, top: 0.1 },
  zayron:       { glb: 'Zayron', bald: true, c1: 0x8aff3a, c2: 0xc09a50, top: 0.09 },
  // four new fighters made from the pack's models in new colours
  pyrelion:     { glb: 'Kaelion', bald: true, c1: 0xff7a1a, c2: 0xffd23a, top: 0.18, hue: 170 },
  glacion:      { glb: 'Zayron', bald: true, c1: 0x7af0ff, c2: 0xffffff, top: 0.09, hue: 88 },
  rosalis:      { glb: 'Amyah', c1: 0xff6ad0, c2: 0xffe0f4, top: 0.13, hue: 105 },
  thalassa:     { glb: 'AKENA', c1: 0x1affd0, c2: 0x2a8aff, top: 0.2, trim: 'up', hue: 175 },
};
const BASE = './chosen/', SIZE = 320, H = 1.7, SA = 'Left', OFF = 'Right'; // the rig's "Left" arm is the one holding the saber
const BONES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
const inst = {}, fstate = {};
let renderer = null, camera = null, glowTex = null, view = null;

function getRenderer() {
  if (renderer) return renderer;
  renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setSize(SIZE, SIZE); renderer.setClearColor(0, 0);
  camera = new T.PerspectiveCamera(34, 1, 0.1, 50); camera.position.set(0, 2.5, 6.0); camera.lookAt(0, 1.15, 0); camera.updateMatrixWorld(true);
  const proj = y => { const v = new T.Vector3(0, y, 0).project(camera); return (1 - v.y) / 2 * SIZE; };
  view = { feet: proj(0), head: proj(H) }; // render rows of the feet and the top of the head: used to draw every fighter at the same size
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new T.CanvasTexture(c);
  return renderer;
}
const add = (c, o = {}) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false, ...o });
const spr = (c, s, op = 1) => { const m = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false })); m.scale.setScalar(s); return m; };

function hueShift(tex, deg) { // turn the costume colours, keep skin, hair and gold
  const img = tex.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0; if (s < 0.32 || v < 0.22) continue;
    let h = mx === mn ? 0 : mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; h *= 60;
    if ((h > 8 && h < 40 && v < 0.64) || (h >= 40 && h <= 62)) continue; // skin, hair, gold
    h = (h + deg) % 360; const C = v * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = v - C; let R = 0, G = 0, B = 0;
    if (h < 60) [R, G, B] = [C, X, 0]; else if (h < 120) [R, G, B] = [X, C, 0]; else if (h < 180) [R, G, B] = [0, C, X]; else if (h < 240) [R, G, B] = [0, X, C]; else if (h < 300) [R, G, B] = [X, 0, C]; else [R, G, B] = [C, 0, X];
    p[i] = (R + m) * 255; p[i + 1] = (G + m) * 255; p[i + 2] = (B + m) * 255;
  }
  x.putImageData(d, 0, 0); const t = new T.CanvasTexture(c); t.flipY = false; t.colorSpace = T.SRGBColorSpace; t.anisotropy = tex.anisotropy; return t;
}
function trimBlade(mesh, mode) { // the baked-in blade of the art is cut off: the game draws its own energy blade
  try {
    const geo = mesh.geometry, idx = geo.index, uv = geo.attributes.uv, img = mesh.material.map?.image; if (!idx || !uv || !img) return;
    const cw = 512, c = document.createElement('canvas'); c.width = c.height = cw; const x = c.getContext('2d'); x.drawImage(img, 0, 0, cw, cw); const px = x.getImageData(0, 0, cw, cw).data;
    const bright = (v, hi) => { const X = Math.min(cw - 1, Math.max(0, Math.floor(uv.getX(v) * cw))), Y = Math.min(cw - 1, Math.max(0, Math.floor(uv.getY(v) * cw))), o = (Y * cw + X) * 4; const mx = Math.max(px[o], px[o + 1], px[o + 2]), mn = Math.min(px[o], px[o + 1], px[o + 2]); return (mx > 120 && mn > 50) || (mx > 235 && mn < 140 && mx - mn > 120) || (hi && mx > 170 && mn < 100 && mx - mn > 100); };
    mesh.updateWorldMatrix(true, true); const n = geo.attributes.position.count, P = new T.Vector3(), X3 = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) { mesh.getVertexPosition(v, P); P.applyMatrix4(mesh.matrixWorld); X3[3 * v] = P.x; X3[3 * v + 1] = P.y; X3[3 * v + 2] = P.z; }
    const hz = []; for (let v = 0; v < n; v++) if (X3[3 * v + 1] > 1.25) hz.push(X3[3 * v + 2]); hz.sort((p, q) => p - q); const zc = hz[hz.length >> 1] || 0; // the head's centre line
    const a = idx.array, keep = []; let cut = 0;
    for (let t = 0; t < a.length; t += 3) {
      const v0 = a[t], v1 = a[t + 1], v2 = a[t + 2], y = (X3[3 * v0 + 1] + X3[3 * v1 + 1] + X3[3 * v2 + 1]) / 3, z = Math.abs((X3[3 * v0 + 2] + X3[3 * v1 + 2] + X3[3 * v2 + 2]) / 3 - zc);
      const inZone = mode === 'up' ? (y > 0.85 && z > 0.24) : (y < 0.55 && z > 0.2);
      const hiZone = mode === 'up' && y > 1.0 && z > 0.32;
      if ((inZone || hiZone) && bright(v0, hiZone) && bright(v1, hiZone) && bright(v2, hiZone)) { cut++; continue; } keep.push(v0, v1, v2);
    }
    if (cut > 6) geo.setIndex(keep);
  } catch (e) { console.warn('blade trim skipped', e); }
}

function fixHead(mesh) { // the models' bald heads are black where the picture never showed them: paint those parts skin-coloured
  try {
    const geo = mesh.geometry, idx = geo.index, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, img = mesh.material.map?.image; if (!idx || !uv || !si || !img) return;
    const cw = img.width, ch = img.height, c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const px = x.getImageData(0, 0, cw, ch).data;
    const bones = mesh.skeleton.bones, head = new Set(); bones.forEach((b, i) => { if (/^(Head|neck)$/.test(b.name)) head.add(i); });
    const dom = v => { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; bi = si.getComponent(v, k); } } return bi; };
    const a = idx.array, tex = (u, v) => { const X = Math.min(cw - 1, Math.max(0, Math.floor(u * cw))), Y = Math.min(ch - 1, Math.max(0, Math.floor(v * ch))), o = (Y * cw + X) * 4; return [px[o], px[o + 1], px[o + 2]]; };
    let sr = 0, sg = 0, sb = 0, n = 0; const dark = [];
    for (let t = 0; t < a.length; t += 3) {
      const v0 = a[t], v1 = a[t + 1], v2 = a[t + 2]; if (!(head.has(dom(v0)) && head.has(dom(v1)) && head.has(dom(v2)))) continue;
      const u = (uv.getX(v0) + uv.getX(v1) + uv.getX(v2)) / 3, w = (uv.getY(v0) + uv.getY(v1) + uv.getY(v2)) / 3, [r, g, b] = tex(u, w), lum = (r + g + b) / 3;
      if (lum < 42) dark.push(t); else if (r > g && g > b && r > 70 && r < 210 && r - b > 28) { sr += r; sg += g; sb += b; n++; }
    }
    console.log('headfix', n, dark.length, cw, ch); if (!n || dark.length < 20) return; const col = `rgb(${Math.round(sr / n * 0.82)},${Math.round(sg / n * 0.82)},${Math.round(sb / n * 0.82)})`;
    x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 2;
    for (const t of dark) { x.beginPath(); x.moveTo(uv.getX(a[t]) * cw, uv.getY(a[t]) * ch); x.lineTo(uv.getX(a[t + 1]) * cw, uv.getY(a[t + 1]) * ch); x.lineTo(uv.getX(a[t + 2]) * cw, uv.getY(a[t + 2]) * ch); x.closePath(); x.fill(); x.stroke(); }
    const tx = new T.CanvasTexture(c); tx.flipY = false; tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = mesh.material.map.anisotropy; mesh.material.map = tx;
  } catch (e) { console.warn('head fix skipped', e); }
}
function dropStray(mesh) { // small floating pieces above the head (stray blocks in the models) are removed
  try {
    const geo = mesh.geometry, idx = geo.index; if (!idx) return; const a = idx.array, nv = geo.attributes.position.count, par = new Int32Array(nv).map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let t = 0; t < a.length; t += 3) { const r0 = find(a[t]); for (const v of [a[t + 1], a[t + 2]]) { const r = find(v); if (r !== r0) par[r] = r0; } }
    const cnt = new Map(), sy = new Map(), v = new T.Vector3();
    for (let t = 0; t < a.length; t += 3) { const r = find(a[t]); cnt.set(r, (cnt.get(r) || 0) + 1); mesh.getVertexPosition(a[t], v); v.applyMatrix4(mesh.matrixWorld); sy.set(r, (sy.get(r) || 0) + v.y); }
    const total = a.length / 3, drop = new Set(); for (const [r, c] of cnt) if (c < total * 0.03 && sy.get(r) / c > H * 0.88) drop.add(r);
    if (!drop.size) return; const keep = []; for (let t = 0; t < a.length; t += 3) if (!drop.has(find(a[t]))) keep.push(a[t], a[t + 1], a[t + 2]); geo.setIndex(keep);
  } catch (e) { console.warn('stray cleanup skipped', e); }
}
function build(name, g) {
  const cfg = CHR[name], scene = new T.Scene(), root = new T.Group(); scene.add(root); root.add(g.scene);
  const box = new T.Box3().setFromObject(g.scene), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = H / size.y;
  g.scene.scale.multiplyScalar(k); g.scene.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
  let mesh; g.scene.traverse(o => { if (o.isSkinnedMesh) mesh = o; if (o.isMesh) o.frustumCulled = false; });
  if (mesh) {
    mesh.material = mesh.material.clone(); mesh.material.emissive = new T.Color(0x000000); mesh.material.metalness = Math.min(mesh.material.metalness ?? 1, 0.18); mesh.material.envMapIntensity = 0; // no environment map here: a shiny surface would render black
    g.scene.updateMatrixWorld(true); dropStray(mesh); if (cfg.bald) fixHead(mesh); if (cfg.trim) trimBlade(mesh, cfg.trim);
    if (cfg.hue && mesh.material.map) mesh.material.map = hueShift(mesh.material.map, cfg.hue);
  }
  scene.add(new T.HemisphereLight(0xffffff, 0x8a90b0, 2.6)); const sun = new T.DirectionalLight(0xfff0d8, 3.2); sun.position.set(2.5, 4, 3.5); scene.add(sun);
  const fill = new T.DirectionalLight(0xbfd8ff, 1.3); fill.position.set(-3, 1.5, 2); scene.add(fill);
  const bone = {}, rest = {}; for (const n of BONES) { const b = g.scene.getObjectByName(n); if (b) { bone[n] = b; rest[n] = b.quaternion.clone(); } }
  scene.updateMatrixWorld(true);
  // the saber socket rides on the fist, pointing up in the rest pose, the hilt's length above the hand
  const hand = bone[SA + 'Hand'], hp = hand.getWorldPosition(new T.Vector3()), hq = hand.getWorldQuaternion(new T.Quaternion()), socket = new T.Object3D(); hand.add(socket);
  socket.position.copy(hand.worldToLocal(hp.clone().add(new T.Vector3(0, cfg.top, 0)))); socket.quaternion.copy(hq.clone().invert().multiply(root.getWorldQuaternion(new T.Quaternion()).clone().invert().invert()));
  socket.quaternion.copy(hq.clone().invert());
  // the blade: white core, two glow shells, a bright tip, a light that colours the fighter
  const saber = new T.Group(); scene.add(saber);
  const cyl = (r, c, op) => { const gm = new T.CylinderGeometry(r, r, 1, 10); gm.translate(0, 0.5, 0); const m = new T.Mesh(gm, add(c, { opacity: op })); saber.add(m); return m; };
  const blade = { core: cyl(0.016, 0xffffff, 1), g1: cyl(0.04, cfg.c1, 0.6), g2: cyl(0.085, cfg.c1, 0.22), g3: cyl(0.11, cfg.c2, 0.0), tip: spr(0xffffff, 0.22, 0.9) }; saber.add(blade.tip);
  const bl = new T.PointLight(cfg.c1, 2.2, 3.2); saber.add(bl); blade.light = bl;
  // energy streams (chest -> arm -> hilt -> up the blade) and the aura
  const stream = Array.from({ length: 34 }, (_, i) => { const s = spr(i % 3 ? cfg.c1 : cfg.c2, 0.1); scene.add(s); return s; });
  const aura = Array.from({ length: 14 }, () => { const s = spr(cfg.c1, 0.2); scene.add(s); return s; });
  const ringG = new T.RingGeometry(0.5, 0.56, 48); ringG.rotateX(-Math.PI / 2); const ring = new T.Mesh(ringG, add(cfg.c1, { opacity: 0.6, side: T.DoubleSide })); scene.add(ring);
  const ring2 = new T.Mesh(ringG, add(cfg.c2, { opacity: 0.4, side: T.DoubleSide })); scene.add(ring2);
  const shield = new T.Mesh(new T.SphereGeometry(0.95, 24, 16), add(cfg.c1, { opacity: 0.2, side: T.DoubleSide })); scene.add(shield);
  const shell = new T.Mesh(new T.IcosahedronGeometry(0.98, 1), add(cfg.c2, { opacity: 0.35, wireframe: true })); scene.add(shell);
  const orb = spr(cfg.c1, 0.5, 0.0); scene.add(orb);
  return { cfg, scene, root, mesh, bone, rest, socket, saber, blade, stream, aura, ring, ring2, shield, shell, orb, sun, ready: true, order: BONES.filter(n => bone[n]) };
}
function load(name) {
  const cfg = CHR[name]; if (!cfg || inst[name]) return inst[name]; getRenderer();
  const rec = inst[name] = { ready: false };
  new GLTFLoader().loadAsync(BASE + cfg.glb + '.glb').then(g => { Object.assign(rec, build(name, g)); }).catch(e => { rec.failed = true; console.warn('Chosen model unavailable', name, e); });
  return rec;
}

// ---------- poses ----------
const E = new T.Euler(), QA = new T.Quaternion(), QB = new T.Quaternion(), V = new T.Vector3(), PW = new T.Vector3(), SC = new T.Vector3();
const sm = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }, lerp = (a, b, u) => a + (b - a) * u, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function applyPose(R, spec) { // rotate each bone about its own joint in model space (axes: +X forward, +Y up, +Z the saber side)
  R.root.rotation.set(0, 0, 0); R.root.position.set(0, 0, 0); R.root.updateMatrixWorld(true);
  for (const n of R.order) {
    const b = R.bone[n]; b.quaternion.copy(R.rest[n]); const d = spec[n]; if (!d) continue;
    b.parent.updateWorldMatrix(true, false); b.parent.matrixWorld.decompose(PW, QA, SC);
    E.set(d[0], d[1], d[2], 'XYZ'); QB.setFromEuler(E);
    b.quaternion.copy(QA.clone().invert().multiply(QB).multiply(QA).multiply(R.rest[n]));
  }
}
// pose for the saber arm: shoulder swing, elbow, saber pitch (0 = blade straight up, + = forward, 1.57 = level), roll across the body
function arm(spec, side, az, fz, pitch, ax = -0.3) {
  spec[side + 'Arm'] = [ax, 0, az]; spec[side + 'ForeArm'] = [0, 0, fz]; spec[side + 'Hand'] = [-ax * 0.95, 0, -pitch - az - fz];
}
function stateOf(f, o) {
  const key = (o.name || '') + (o.i ?? 0), s = fstate[key] || (fstate[key] = { el: -1, combo: 0, last: 9, g: 0, gOn: false, spin: 0 });
  if (o.el != null) s.el = o.el;
  if (f.ck && f.ct < s.last - 0.05 && f.ct < 0.2) { if (f.ck === 'special') s.el = (s.el + 1) % 5; if (f.ck === 'basic') s.combo++; }
  s.last = f.ck ? f.ct : 9; return s;
}
function pose(R, f, o, now) {
  const t = now, sp = {}, S = stateOf(f, o), out = { dy: 0, yaw: 0, bx: 0, blade: 1, energy: 0.35, flash: 0, fall: 0, guard: 0, orb: 0, ringK: 0, shake: 0 };
  const moving = f.mv && !f.ds, stage = clamp(f.sg || 0, 0, 5);
  const dur = f.ck === 'mega' ? 1.2 : f.ck === 'special' ? 0.85 : 0.5, casting = !!f.ck && f.ct < dur, u = casting ? clamp(f.ct / dur, 0, 1) : 0;
  const sw = Math.sin(t * 10);
  // base: ready stance
  arm(sp, SA, Math.sin(t * 2) * 0.03, 0, 0); sp[OFF + 'Arm'] = [0, 0, Math.sin(t * 2 + 1) * 0.03];
  sp.Spine01 = [0, 0, Math.sin(t * 2) * 0.02]; 
  out.energy = 0.4 + stage * 0.08;
  if (moving) { // run: legs and arms pump, the body leans into it
    sp.LeftUpLeg = [0, 0, sw * 0.6]; sp.RightUpLeg = [0, 0, -sw * 0.6]; sp.LeftLeg = [0, 0, -0.1 - Math.max(0, -sw) * 0.7]; sp.RightLeg = [0, 0, -0.1 - Math.max(0, sw) * 0.7];
    arm(sp, SA, 0.2 - sw * 0.15, 0.3, 0.3 + sw * 0.05); sp[OFF + 'Arm'] = [0, 0, -sw * 0.6]; sp[OFF + 'ForeArm'] = [0, 0, 0.3];
    sp.Spine01 = [0, 0, -0.16]; sp.Head = [0, 0, 0.1]; out.dy = Math.abs(Math.sin(t * 10)) * 0.05; out.energy = 0.55; out.bx = 0.0;
  }
  if (f.ds) { // dash: leaning far forward, the saber trailing behind like a comet
    sp.LeftUpLeg = [0, 0, 0.9 + Math.sin(t * 16) * 0.1]; sp.RightUpLeg = [0, 0, -0.9]; sp.LeftLeg = [0, 0, -0.5]; sp.RightLeg = [0, 0, -1.1];
    arm(sp, SA, -0.9, 0.2, -1.2); sp[OFF + 'Arm'] = [0, 0, -1.0]; sp.Spine01 = [0, 0, -0.5]; sp.Spine = [0, 0, -0.15]; sp.Head = [0, 0, 0.35]; out.blade = 1.3; out.energy = 0.9; out.bx = 0.12; out.dy = 0.03;
  }
  if (f.fl) out.dy += 0.08 + Math.sin(t * 3) * 0.02;
  if (f.g) { // guard: the saber across the body inside a ring of energy
    arm(sp, SA, 1.15, 1.35, 1.35, 0); sp[OFF + 'Arm'] = [0, 0, 1.0]; sp[OFF + 'ForeArm'] = [0, 0, 1.2]; sp.Spine01 = [0, 0, 0.06]; sp.LeftLeg = [0, 0, -0.3]; sp.RightLeg = [0, 0, -0.3]; sp.LeftUpLeg = [0, 0, 0.25]; sp.RightUpLeg = [0, 0, -0.2];
    if (!S.gOn) S.g = t; S.gOn = true; out.guard = Math.min(1, (t - S.g) / 0.18); out.energy = 0.9; out.blade = 0.9;
  } else S.gOn = false;
  if (casting) {
    const e = sm; out.energy = 1.0;
    if (f.ck === 'basic') {
      const heavy = S.combo % 2 === 1, w = e(u / 0.35), st = e((u - 0.3) / 0.35);
      const side = heavy ? 1 : -1;
      arm(sp, SA, lerp(0.4, heavy ? 2.6 : 2.0, w) - st * (heavy ? 1.7 : 1.5), lerp(0.5, 0.2, w), lerp(0.2, heavy ? -0.5 : -0.2, w) + st * (heavy ? 2.4 : 1.9), side * (w - st) * 0.35);
      sp.Spine01 = [0, side * (w - st) * 0.3, -st * 0.28 + w * 0.12]; sp[OFF + 'Arm'] = [0, 0, -0.4 * st]; sp.LeftUpLeg = [0, 0, 0.35 * st]; sp.RightUpLeg = [0, 0, -0.25 * st];
      out.blade = 1.15 + 0.3 * st; out.flash = st * (1 - e((u - 0.7) / 0.3)); out.bx = 0.08 * st; out.energy = 0.8 + st * 0.5;
    } else if (f.ck === 'mega') {
      const w = e(u / 0.3), rise = e(u / 0.5);
      arm(sp, SA, lerp(0.4, 3.0, w), 0.1, lerp(0.2, 0.05, w)); arm(sp, OFF, lerp(0.1, 2.9, w), 0.1, 0); sp[OFF + 'Hand'] = [0, 0, 0];
      sp.Spine01 = [0, 0, 0.12 * w]; sp.Head = [0, 0, 0.25 * w]; sp.LeftUpLeg = [0, 0, 0.12]; sp.RightUpLeg = [0, 0, -0.12]; sp.LeftLeg = [0, 0, -0.15]; sp.RightLeg = [0, 0, -0.15];
      out.dy = 0.32 * rise * (1 - e((u - 0.85) / 0.15)); out.blade = 1 + 1.5 * w; out.orb = w * (1 - e((u - 0.9) / 0.1)); out.ringK = 1; out.energy = 1.5; out.yaw = Math.sin(u * Math.PI) * 0.4; out.flash = w * 0.4;
    } else {
      const el = S.el < 0 ? 0 : S.el, w = e(u / 0.35), st = e((u - 0.3) / 0.3), rec = 1 - e((u - 0.78) / 0.22);
      if (el === 0) { // overhead slam: blade raised high, then chopped into the ground with a ring of energy
        arm(sp, SA, lerp(0.4, 2.8, w) - st * 1.9, lerp(0.5, 0.15, w), lerp(0.2, -0.5, w) + st * 2.4); sp.Spine01 = [0, 0, 0.2 * w - 0.55 * st]; sp[OFF + 'Arm'] = [0, 0, 2.2 * w - 1.9 * st]; sp.LeftUpLeg = [0, 0, 0.4 * st]; sp.RightUpLeg = [0, 0, -0.3 * st];
        out.blade = 1.4 + 0.6 * st; out.ringK = st * rec; out.shake = st * (1 - e((u - 0.55) / 0.2)); out.flash = st * rec;
      } else if (el === 1) { // whirlwind: a full spin with the blade held out level
        arm(sp, SA, 1.55, 0.1, 1.5); sp[OFF + 'Arm'] = [0, 0, -1.2]; sp.Spine01 = [0, 0, -0.1]; sp.LeftLeg = [0, 0, -0.3]; sp.RightLeg = [0, 0, -0.3];
        out.yaw = Math.PI * 2 * e(u / 0.85); out.blade = 1.7; out.dy = 0.05 * Math.sin(u * Math.PI); out.ringK = 0.7 * Math.sin(u * Math.PI); out.flash = 0.7 * Math.sin(u * Math.PI);
      } else if (el === 2) { // lunge: the blade thrusts straight ahead
        arm(sp, SA, lerp(0.4, 1.5, w), lerp(0.5, 0.05, st), lerp(0.2, 1.5, w)); sp[OFF + 'Arm'] = [0, 0, -0.9 * w]; sp.Spine01 = [0, 0, -0.3 * st]; sp.LeftUpLeg = [0, 0, 0.95 * st]; sp.RightUpLeg = [0, 0, -0.55 * st]; sp.LeftLeg = [0, 0, -0.2]; sp.RightLeg = [0, 0, -0.7 * st];
        out.blade = 1.2 + 1.0 * st; out.bx = 0.2 * st; out.flash = st * rec; out.energy = 1.3;
      } else if (el === 3) { // sky call: both arms and the blade point up, the fighter rises on a column of energy
        arm(sp, SA, lerp(0.4, 3.0, w), 0.1, 0.0); arm(sp, OFF, lerp(0.1, 2.8, w), 0.1, 0); sp[OFF + 'Hand'] = [0, 0, 0]; sp.Spine01 = [0, 0, 0.14 * w]; sp.Head = [0, 0, 0.25 * w];
        out.dy = 0.2 * w * rec; out.blade = 1.4 + 1.1 * w; out.orb = 0.6 * w; out.ringK = w; out.energy = 1.4;
      } else { // cross slash: two quick diagonal cuts
        const a = e(u / 0.4), bb = e((u - 0.4) / 0.35), c = a - bb;
        arm(sp, SA, lerp(0.4, 2.1, a) - bb * 1.1 + (bb > 0 ? 0.6 * (1 - bb) : 0) * 0, lerp(0.5, 0.2, a), lerp(0.2, -0.4, a) + (st) * 1.6, 0.45 * (a - 2 * bb + 1)); sp.Spine01 = [0, 0.4 * (a - 2 * bb), -0.2 * st]; sp[OFF + 'Arm'] = [0, 0, -0.6 * st];
        out.blade = 1.45; out.flash = Math.abs(Math.sin(u * Math.PI * 2)); out.energy = 1.3; out.yaw = 0.35 * (a - 2 * bb);
      }
    }
  }
  if (f.hu > 0) { const k = clamp(f.hu / 0.35, 0, 1); sp.Spine01 = [0, 0, 0.5 * k]; sp.Head = [0, 0, 0.3 * k]; arm(sp, SA, -0.4 * k, 0.3, -0.5 * k); sp[OFF + 'Arm'] = [0, 0, -0.6 * k]; out.bx = -0.12 * k; out.flash = -k; out.blade = 0.8; }
  if (o.faint) { const k = clamp(o.faint * 1.3, 0, 1); out.fall = sm(k); out.blade = 0.3; out.energy = 0.1; arm(sp, SA, 0.1, 0.2, 0.2); }
  if (f.tr > 0) { const k = 1 - f.tr / 0.9; out.ringK = 1; out.energy = 1.6; out.blade = 1 + k; out.dy += 0.12 * Math.sin(k * Math.PI); }
  return { sp, out };
}

// ---------- energy: blade, streams, aura ----------
function energy(R, out, f, now, col) {
  const t = now, cfg = R.cfg, k = out.energy, stage = clamp(f.sg || 0, 0, 5), tint = col ? new T.Color(col) : null;
  R.socket.updateWorldMatrix(true, false); R.socket.matrixWorld.decompose(PW, QA, SC); R.saber.position.copy(PW); R.saber.quaternion.copy(QA);
  const L = 0.62 * out.blade * (1 + stage * 0.06) * (out.fall ? 0.4 : 1), fl = 1 + Math.sin(t * 38) * 0.06 + Math.sin(t * 23) * 0.04, b = R.blade, wk = 0.8 + k * 0.5;
  b.core.scale.set(wk * fl, L, wk * fl); b.g1.scale.set(wk * fl, L, wk * fl); b.g2.scale.set(wk * (1 + out.flash * 0.6), L * 1.02, wk * (1 + out.flash * 0.6)); b.g3.scale.set(wk * (1 + k * 0.5), L * 1.05, wk * (1 + k * 0.5));
  b.tip.position.set(0, L, 0); b.tip.scale.setScalar(0.18 + 0.12 * k); b.light.position.set(0, L * 0.5, 0); b.light.intensity = 1.0 + 1.0 * k + Math.max(0, out.flash) * 1.0;
  // streams: chest -> upper arm -> elbow -> hand -> hilt -> up the blade, as a bright braid of moving sparks
  const wp = n => R.bone[n].getWorldPosition(new T.Vector3()), up = new T.Vector3(0, 1, 0).applyQuaternion(QA);
  const hilt = PW.clone(), tip = hilt.clone().addScaledVector(up, L);
  const pts = [wp('Spine01').add(new T.Vector3(0, 0.05, 0)), wp(SA + 'Arm'), wp(SA + 'ForeArm'), wp(SA + 'Hand'), hilt, tip];
  const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.3), n = R.stream.length, lenK = k;
  R.stream.forEach((s, i) => {
    const u = ((i / n) + t * (0.7 + 0.3 * k)) % 1, p = curve.getPoint(u), w = Math.sin(t * 9 + i * 1.7) * 0.03 * (1 - Math.abs(u - 0.5));
    s.position.set(p.x + w, p.y + w * 0.5, p.z - w); const fade = Math.sin(Math.PI * u); s.material.opacity = clamp(fade * (0.5 + 0.7 * lenK), 0, 1);
    s.scale.setScalar((0.06 + 0.1 * fade) * (0.8 + lenK * 0.8)); if (tint && i % 3 === 0) s.material.color.copy(tint);
  });
  // aura: sparks that rise around the body, a ring on the ground
  const base = R.root.position;
  R.aura.forEach((s, i) => { const u = (t * 0.45 + i / R.aura.length) % 1, a = i * 2.4 + t * 1.2, r = 0.45 + 0.12 * Math.sin(i + t * 2); s.position.set(base.x + Math.cos(a) * r, 0.1 + u * 1.7 + base.y, base.z + Math.sin(a) * r); s.material.opacity = Math.sin(Math.PI * u) * clamp(0.15 + k * 0.35, 0, 0.7); s.scale.setScalar(0.05 + 0.07 * Math.sin(Math.PI * u) * (1 + k)); });
  const rk = clamp(out.ringK, 0, 1);
  for (const [r, s, sp] of [[R.ring, 1, 0.9], [R.ring2, 1.35, -0.6]]) { r.position.set(base.x, 0.02, base.z); const q = (1 + rk * 0.9) * s * (0.9 + 0.1 * Math.sin(t * 5)); r.scale.set(q, 1, q); r.rotation.y = t * sp; r.material.opacity = clamp(0.12 + rk * 0.6 + k * 0.1, 0, 0.85); }
  R.shield.visible = R.shell.visible = out.guard > 0; if (out.guard > 0) { const gp = 0.85 + out.guard * 0.15 + Math.sin(t * 8) * 0.02; R.shield.position.set(base.x, 0.85 + base.y, base.z); R.shield.scale.setScalar(gp); R.shell.position.copy(R.shield.position); R.shell.scale.setScalar(gp * 1.02); R.shell.rotation.y = t * 1.5; R.shell.rotation.x = t * 0.7; R.shield.material.opacity = 0.16 + Math.sin(t * 9) * 0.04; }
  R.orb.material.opacity = clamp(out.orb, 0, 1); R.orb.visible = out.orb > 0.01; if (R.orb.visible) { R.orb.position.set(base.x, 2.05 + base.y, base.z); R.orb.scale.setScalar(0.6 + out.orb * 1.5 + Math.sin(t * 20) * 0.05); }
}

function draw(ctx, x, y, h, f, col, o = {}) {
  const name = o.name; const R = inst[name]; if (!R?.ready) return false;
  const now = (o.now ?? performance.now()) / 1000 + (o.i || 0) * 0.37;
  const { sp, out } = pose(R, f, o, now);
  applyPose(R, sp);
  let fxx = f.fx || 0, fyy = f.fy || 0; if (!fxx && !fyy) fxx = 1; const yaw = Math.atan2(-fyy, fxx) + out.yaw, root = R.root;
  root.rotation.set(0, yaw, 0);
  if (out.fall) { const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), out.fall * 1.45); root.quaternion.multiply(q); out.dy += -0.0; }
  const fwd = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  root.position.set(fwd.x * out.bx + (out.shake ? (Math.random() - 0.5) * 0.04 * out.shake : 0), out.dy + out.fall * 0.2, fwd.z * out.bx);
  root.updateMatrixWorld(true);
  const mat = R.mesh?.material; if (mat) { const fl = out.flash; if (fl < 0) mat.emissive.setRGB(-fl * 0.45, -fl * 0.05, -fl * 0.03); else mat.emissive.set(R.cfg.c1).multiplyScalar(clamp(fl * 0.12 + (out.energy > 1 ? 0.02 : 0), 0, 0.16)); }
  energy(R, out, f, now, col);
  const rd = getRenderer(); rd.render(R.scene, camera);
  const D = h * SIZE / (view.feet - view.head), s = D / SIZE;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(rd.domElement, x - D / 2, y - view.feet * s, D, D); ctx.restore();
  return true;
}

// A still picture of a fighter (cards, the home page): `px` square, turned `yaw` radians (0 = facing right, -PI/2 = facing the viewer)
function snapshot(name, px = 512, yaw = -0.75, hh = 0.74) {
  const R = inst[name]; if (!R?.ready) return null;
  const f = { fx: Math.cos(yaw), fy: -Math.sin(yaw) }; const { sp, out } = pose(R, f, { name, i: 9 }, 1.0); applyPose(R, sp);
  R.root.rotation.set(0, yaw, 0); R.root.position.set(0, 0, 0); R.root.updateMatrixWorld(true); energy(R, { ...out, energy: 0.8, ringK: 0 }, f, 1.0, null);
  const rd = getRenderer(), cam = new T.PerspectiveCamera(24, 1, 0.1, 50), dist = H / hh / (2 * Math.tan(12 * Math.PI / 180)) * 1.0;
  cam.position.set(0, 0.85 + dist * 0.2, dist); cam.lookAt(0, 0.8, 0); rd.setSize(px, px); rd.render(R.scene, cam);
  const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(rd.domElement, 0, 0); rd.setSize(SIZE, SIZE); return c;
}
window.PMChosen = {
  snapshot,
  has: n => !!CHR[n],
  ready: n => { if (!CHR[n]) return false; const r = load(n); return !!r.ready; },
  draw: (ctx, x, y, h, f, col, o) => draw(ctx, x, y, h, f, col, o),
  names: () => Object.keys(CHR),
  colors: n => CHR[n] && { c1: '#' + CHR[n].c1.toString(16).padStart(6, '0'), c2: '#' + CHR[n].c2.toString(16).padStart(6, '0') },
};
