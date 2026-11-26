// Boss Monster powers in 3D. Every boss has its own evil look that no other Monstar uses: bramble fields, lava geysers, blood
// crescents, toxic gas rings, abyss whirlpools, brine jets, gold glare, void lances, rift claws, hydra venom fans, glacier craters,
// blood rakes, blue bonefire, wraith scythes, chainhooks, ice shard storms, thunder lanes, permafrost rings and a black sunburst.
// The ground under an attack glows with a red warning sigil first (the telegraph), then the power erupts. window.PMBossFx.
import * as T from 'three';

const hex = c => (typeof c === 'number' ? c : parseInt(String(c).replace('#', '').slice(0, 6), 16));
const css = c => '#' + hex(c).toString(16).padStart(6, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = u => 1 - (1 - u) * (1 - u);

// ---- per boss: projectile look, special kind and colours
const B = {
  thornmaw: { p: 'thorn', s: 'bramble', c1: 0x1a3a12, c2: 0x9aff4a },
  cinderwing: { p: 'lava', s: 'hellbreath', c1: 0xff3a00, c2: 0xffd040 },
  crimsonharrow: { p: 'fang', s: 'bloodcrescent', c1: 0x9a0018, c2: 0xff3a4a },
  briarcoil: { p: 'venom', s: 'toxicring', c1: 0x3aa82a, c2: 0xc8ff3a },
  abysssiren: { p: 'bubble', s: 'undertow', c1: 0x08204a, c2: 0x3ad8ff },
  brineviper: { p: 'brine', s: 'brinejet', c1: 0x0a7a6a, c2: 0x9affe8 },
  gildedasp: { p: 'scarab', s: 'crownglare', c1: 0xc88a00, c2: 0xfff0a0 },
  nulllancer: { p: 'void', s: 'voidlance', c1: 0x0a0014, c2: 0xb07aff },
  rifttalon: { p: 'rift', s: 'riftrake', c1: 0x6a10c8, c2: 0xf0b0ff },
  hydramatron: { p: 'hydra', s: 'hydrafan', c1: 0x6a1a8a, c2: 0x9aff4a },
  icebackravager: { p: 'iceboulder', s: 'glaciercrater', c1: 0x5ab8e8, c2: 0xe8faff },
  paleclaw: { p: 'bloodclaw', s: 'crimsonrake', c1: 0x8a0010, c2: 0xff2a3a },
  sableossuary: { p: 'skull', s: 'bonefire', c1: 0x1a4aff, c2: 0x9ad8ff },
  lanternreaper: { p: 'lantern', s: 'wraithreap', c1: 0x0aa8a0, c2: 0xc0fff8 },
  briarinquisitor: { p: 'hook', s: 'chainhook', c1: 0x4a4048, c2: 0xff5a7a },
  ashscalebulwark: { p: 'magma', s: 'lavaquake', c1: 0xff4a00, c2: 0xffe060 },
  rimeforgedsentinel: { p: 'icespear', s: 'shardstorm', c1: 0x2a8aff, c2: 0xe0f6ff },
  stormhornrevenant: { p: 'hornbolt', s: 'thunderram', c1: 0x2a6aff, c2: 0xfff27a },
  whitehorncolossus: { p: 'frostspike', s: 'permafrost', c1: 0xa8d8f0, c2: 0xffffff },
  goldendreadchimera: { p: 'sunfeather', s: 'sunburst', c1: 0xff8a00, c2: 0xfff0a0 },
};

// ---- renderers: one square (ground powers, projectiles, bursts) and one long (lanes)
const SQ = 256, LW = 512, LH = 128;
const mk = (w, h) => { const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true }); r.setPixelRatio(1); r.setSize(w, h, false); r.setClearColor(0, 0); return r; };
let rSq = null, rLn = null;
const lights = sc => { sc.add(new T.HemisphereLight(0xffffff, 0x221122, 2.4)); const d = new T.DirectionalLight(0xffffff, 2.4); d.position.set(2, 5, 3); sc.add(d); };
// ground scene: the arena is seen from high above at an angle, like the game's aerial camera
const gScene = new T.Scene(); lights(gScene);
const gCam = new T.PerspectiveCamera(40, 1, 0.1, 40); gCam.position.set(0, 5.2, 3.0); gCam.lookAt(0, 0, 0);
const gRoot = new T.Group(); gScene.add(gRoot);
gCam.updateMatrixWorld(true);
const pj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(gCam); return [(v.x + 1) / 2 * SQ, (1 - v.y) / 2 * SQ]; }; // 3D ground point → pixel in the square canvas
// projectile scene: seen from the side
const pScene = new T.Scene(); lights(pScene);
const pCam = new T.PerspectiveCamera(35, 1, 0.1, 30); pCam.position.set(0, 1.2, 6); pCam.lookAt(0, 0, 0);
const pRoot = new T.Group(); pScene.add(pRoot);
// lane scene
const lScene = new T.Scene(); lights(lScene);
const lCam = new T.OrthographicCamera(-LW / LH, LW / LH, 1, -1, 0.1, 20); lCam.position.set(0, 2.4, 5); lCam.lookAt(0, 0, 0);
const lRoot = new T.Group(); lScene.add(lRoot);

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
const lit = (c, e, ei = 0.8, o = {}) => new T.MeshStandardMaterial({ color: c, emissive: e ?? c, emissiveIntensity: ei, metalness: 0.2, roughness: 0.45, ...o });
const glowM = (c, op = 0.8) => new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
const addM = (c, op = 0.7) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });

// a pool of reusable objects per scene, reset every frame
function pool(root) {
  const items = {}; let used = {};
  return {
    begin() { used = {}; for (const k in items) for (const o of items[k]) o.visible = false; },
    get(key, make) { const arr = items[key] || (items[key] = []), i = used[key] = (used[key] || 0) + 1; if (!arr[i - 1]) { const o = make(); root.add(o); arr.push(o); } const o = arr[i - 1]; o.visible = true; return o; },
  };
}
const G = pool(gRoot), P = pool(pRoot), L = pool(lRoot);
const GEO = {
  cone: new T.ConeGeometry(0.5, 1, 7), spike: new T.ConeGeometry(0.5, 1, 4), sph: new T.SphereGeometry(0.5, 14, 10), ico: new T.IcosahedronGeometry(0.5, 0), dode: new T.DodecahedronGeometry(0.5, 0),
  oct: new T.OctahedronGeometry(0.5, 0), box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 12, 1, true), ring: new T.RingGeometry(0.92, 1, 64), disc: new T.CircleGeometry(1, 48), sector: new T.CircleGeometry(1, 32, -0.5, 1.0),
  torus: new T.TorusGeometry(0.5, 0.08, 8, 24), link: new T.TorusGeometry(0.5, 0.16, 6, 12), arc: new T.TorusGeometry(1, 0.1, 8, 40, Math.PI * 0.9), tube: new T.CylinderGeometry(0.5, 0.5, 1, 14, 1, true),
};
// one mesh per material colour key, made on first use
const mesh = (pl, geo, mat, key) => pl.get(geo + '|' + key, () => new T.Mesh(GEO[geo], mat()));
const spr = (pl, c, op, key) => pl.get('spr|' + key, () => new T.Sprite(glowM(c, op)));
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

// ============ projectiles ============
function projectile(ctx, x, y, a, look, b, now, seed, size = 52) {
  const t = now / 1000 + seed * 0.37; P.begin();
  const c1 = b.c1, c2 = b.c2, r = rng(seed * 97 + 13);
  const put = (geo, mat, key, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = mesh(P, geo, mat, key); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
  const glow = (c, s, op = 0.8, key = 'g', px = 0, py = 0) => { const g = spr(P, c, op, key); g.material.color.setHex(c); g.material.opacity = op; g.scale.setScalar(s); g.position.set(px, py, 0); return g; };
  switch (look) {
    case 'thorn': for (let i = 0; i < 3; i++) put('spike', () => lit(0x101a08, c2, 0.25, { flatShading: true }), 't' + i, -i * 0.25, (i - 1) * 0.12, 0, 0.32, 1.1, 0.32, 0, t * 6, -Math.PI / 2); glow(c2, 1.2, 0.5); break;
    case 'lava': put('dode', () => lit(0x2a0800, 0xff4a00, 1.4, { flatShading: true }), 'core', 0, 0, 0, 1, 1, 1, t * 3, t * 4, 0); glow(0xff6a00, 2.4, 0.85); for (let i = 0; i < 4; i++) put('sph', () => lit(0xff6a00, 0xff3a00, 1.5), 'drip' + i, -0.6 - i * 0.3, Math.sin(t * 9 + i) * 0.1 - i * 0.05, 0, 0.25 - i * 0.04, 0.25 - i * 0.04, 0.25 - i * 0.04); break;
    case 'fang': put('cone', () => lit(0x4a0008, 0xff1a2a, 1.2), 'f', 0, 0, 0, 0.5, 1.6, 0.5, 0, 0, -Math.PI / 2); glow(c2, 1.8, 0.7); break;
    case 'venom': put('sph', () => lit(0x2a8a1a, 0x8aff2a, 0.9, { transparent: true, opacity: 0.85 }), 'v', 0, 0, 0, 0.9, 0.8, 0.8); for (let i = 0; i < 5; i++) put('sph', () => lit(0xc8ff3a, 0xc8ff3a, 1.4), 'b' + i, -0.5 - r() * 0.8, (r() - 0.5) * 0.5, 0, 0.14, 0.14, 0.14); glow(c2, 1.8, 0.55); break;
    case 'bubble': put('sph', () => new T.MeshStandardMaterial({ color: 0x0a2a5a, emissive: 0x0a3a8a, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.75 }), 'bb', 0, 0, 0, 1.1, 1.1, 1.1);
      put('torus', () => addM(0x3ad8ff, 0.8), 'rim', 0, 0, 0, 1.15, 1.15, 1.15, t * 2, t * 3, 0); glow(0x3ad8ff, 2.0, 0.45); break;
    case 'brine': put('sph', () => lit(0x0a6a5a, 0x3affd8, 0.8, { transparent: true, opacity: 0.85 }), 'd', 0, 0, 0, 0.7, 0.7, 0.7); put('cone', () => lit(0x0a6a5a, 0x3affd8, 0.8, { transparent: true, opacity: 0.85 }), 'dt', -0.5, 0, 0, 0.6, 0.8, 0.6, 0, 0, Math.PI / 2); glow(c2, 1.6, 0.5); break;
    case 'scarab': put('sph', () => lit(0xc88a00, 0xffc000, 0.6, { metalness: 0.9, roughness: 0.15 }), 's', 0, 0, 0, 0.9, 0.45, 0.65, 0, 0, Math.sin(t * 20) * 0.15);
      for (const sg of [-1, 1]) put('box', () => lit(0xfff0a0, 0xffd000, 1.2, { transparent: true, opacity: 0.7 }), 'w' + sg, 0, 0.2, sg * 0.35, 0.6, 0.02, 0.35, Math.sin(t * 40) * 0.6 * sg, 0, 0); glow(0xffd000, 1.6, 0.6); break;
    case 'void': put('oct', () => lit(0x050008, 0x2a0050, 0.6, { flatShading: true }), 'v', 0, 0, 0, 1.4, 0.6, 0.6, t * 5, 0, 0); put('oct', () => addM(0xb07aff, 0.5), 've', 0, 0, 0, 1.55, 0.7, 0.7, t * 5, 0, 0); glow(0x7a2aff, 1.8, 0.6); break;
    case 'rift': case 'riftrake': for (let i = 0; i < (look === 'riftrake' ? 3 : 1); i++) put('arc', () => addM(0xd080ff, 0.95), 'a' + i, -i * 0.25, (i - 1) * 0.25, 0, 0.7, 0.7, 0.7, 0, 0, Math.PI * 0.55); glow(0x9a3aff, look === 'riftrake' ? 2.6 : 1.8, 0.7); break;
    case 'hydra': case 'hydrafan': put('sph', () => lit(0x6a1a8a, 0x8a2aaa, 0.6), 'h', 0, 0, 0, 0.6, 0.45, 0.45); put('cone', () => lit(0x6a1a8a, 0x8a2aaa, 0.6), 'j', 0.35, -0.05, 0, 0.35, 0.5, 0.3, 0, 0, -Math.PI / 2);
      for (const sg of [-1, 1]) put('sph', () => lit(0xc8ff3a, 0xc8ff3a, 2), 'e' + sg, 0.18, 0.12, sg * 0.15, 0.08, 0.08, 0.08);
      if (look === 'hydrafan') put('arc', () => addM(0x9aff4a, 0.85), 'cr', -0.2, 0, 0, 0.8, 0.8, 0.8, 0, 0, Math.PI * 0.55); glow(0x9aff4a, 1.8, 0.5); break;
    case 'iceboulder': put('dode', () => lit(0x9ad8ff, 0x3a8aff, 0.35, { flatShading: true, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.92 }), 'i', 0, 0, 0, 1.2, 1.1, 1.1, t * 2, t * 3, 0); glow(0xbfefff, 2.0, 0.4); break;
    case 'bloodclaw': for (let i = 0; i < 3; i++) put('arc', () => addM(0xff1a2a, 0.95), 'c' + i, 0, (i - 1) * 0.3, 0, 0.6, 0.6, 0.6, 0, 0, Math.PI * 0.6); glow(0xff1a2a, 1.6, 0.6); break;
    case 'skull': put('sph', () => lit(0xe8e0d0, 0x3a6aff, 0.3), 'sk', 0, 0, 0, 0.75, 0.75, 0.7); put('box', () => lit(0xe8e0d0, 0x3a6aff, 0.3), 'jaw', 0.1, -0.35, 0, 0.45, 0.2, 0.45);
      for (const sg of [-1, 1]) put('sph', () => lit(0x000000, 0x3a8aff, 2.5), 'ey' + sg, 0.3, 0.05, sg * 0.15, 0.16, 0.16, 0.16);
      for (let i = 0; i < 4; i++) { const g = spr(P, 0x3a7aff, 0.8, 'fl' + i); g.material.color.setHex(i % 2 ? 0x3a7aff : 0x9ad8ff); g.position.set(-0.35 - i * 0.22, 0.25 + Math.sin(t * 12 + i) * 0.08, 0); g.scale.setScalar(0.9 - i * 0.15); } break;
    case 'lantern': put('box', () => lit(0x1a1a1a, 0x000000, 0, { metalness: 0.8 }), 'lb', 0, 0, 0, 0.35, 0.5, 0.35); { const g = spr(P, 0x28e0d8, 0.95, 'lf'); g.scale.setScalar(1.0 + Math.sin(t * 14) * 0.1); }
      for (let i = 0; i < 5; i++) { const g = spr(P, 0xc0fff8, 0.6, 'w' + i); g.position.set(-0.4 - i * 0.28, Math.sin(t * 6 + i * 1.3) * 0.25, 0); g.scale.setScalar(0.5 - i * 0.06); } break;
    case 'hook': put('arc', () => lit(0x6a6068, 0x1a0008, 0.2, { metalness: 0.9, roughness: 0.3 }), 'hk', 0, 0, 0, 0.5, 0.5, 1.6, 0, 0, Math.PI * 0.2);
      for (let i = 0; i < 4; i++) put('link', () => lit(0x5a5058, 0x000000, 0, { metalness: 0.9, roughness: 0.35 }), 'l' + i, -0.5 - i * 0.3, 0, 0, 0.3, 0.3, 0.3, i % 2 ? Math.PI / 2 : 0, Math.PI / 2, 0); glow(0xff5a7a, 1.0, 0.4); break;
    case 'magma': put('dode', () => lit(0x1a0a04, 0xff3a00, 0.9, { flatShading: true, roughness: 0.9 }), 'm', 0, 0, 0, 1.2, 1.0, 1.0, t * 2.5, t * 1.7, 0); glow(0xff5a00, 2.2, 0.75); break;
    case 'icespear': put('cone', () => lit(0xbfefff, 0x3a8aff, 0.5, { transparent: true, opacity: 0.9 }), 's', 0, 0, 0, 0.35, 2.0, 0.35, t * 4, 0, -Math.PI / 2); glow(0xe0f6ff, 1.4, 0.5); break;
    case 'hornbolt': for (let i = 0; i < 4; i++) put('box', () => lit(0xfff27a, 0xfff27a, 2), 'z' + i, -i * 0.3, (i % 2 ? 0.12 : -0.12) + (r() - 0.5) * 0.05, 0, 0.36, 0.06, 0.06, 0, 0, i % 2 ? 0.6 : -0.6); glow(0x3a8aff, 2.0, 0.8); glow(0xfff27a, 0.9, 0.9, 'g2'); break;
    case 'frostspike': put('spike', () => lit(0xffffff, 0xa8d8f0, 0.4, { flatShading: true }), 's', 0, 0, 0, 0.5, 1.7, 0.5, t * 3, 0, -Math.PI / 2); glow(0xffffff, 1.2, 0.5); break;
    case 'sunfeather': put('cone', () => lit(0xffc81a, 0xff8a00, 1.3), 'f', 0, 0, 0, 0.35, 1.5, 0.08, Math.sin(t * 10) * 0.3, 0, -Math.PI / 2); glow(0xffa000, 1.8, 0.75); break;
    default: return false;
  }
  rSq ||= mk(SQ, SQ); rSq.render(pScene, pCam);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1); ctx.imageSmoothingEnabled = true; ctx.drawImage(rSq.domElement, -size / 2, -size / 2, size, size); ctx.restore();
  return true;
}

// ============ the red warning sigil on the ground before a boss power lands ============
function telegraph(ctx, shape, x, y, a, r, len, ang, u, now, col = '#ff2a2a') {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); const pulse = 0.55 + Math.sin(now / 70) * 0.25;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
  if (shape === 'ring') { ctx.scale(1, 0.5); ctx.globalAlpha = 0.18 * pulse; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.85 * pulse; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, r * u, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + now / 900; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.75, Math.sin(an) * r * 0.75); ctx.lineTo(Math.cos(an) * r * 0.95, Math.sin(an) * r * 0.95); ctx.stroke(); } }
  else if (shape === 'cone') { ctx.rotate(a); ctx.globalAlpha = 0.16 * pulse; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, len, -ang, ang); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 0.8 * pulse; ctx.stroke();
    ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(0, 0, len * u, -ang, ang); ctx.stroke(); }
  else { ctx.rotate(a); ctx.globalAlpha = 0.16 * pulse; ctx.fillRect(0, -r, len, r * 2); ctx.globalAlpha = 0.8 * pulse; ctx.strokeRect(0, -r, len, r * 2); ctx.globalAlpha = 0.5; ctx.fillRect(0, -r, len * u, 2); ctx.fillRect(0, r - 2, len * u, 2); }
  ctx.restore();
}

// ============ ground powers (strike / whip / bolt): drawn centred on (x, y) with radius r ============
function ground(ctx, kind, b, x, y, r, u, fade, now, seed) {
  const t = now / 1000; G.begin(); const R = rng(seed * 31 + 7), c1 = b.c1, c2 = b.c2;
  const put = (geo, mat, key, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = mesh(G, geo, mat, key); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
  const glow = (c, s, op, key, px = 0, py = 0.2, pz = 0) => { const g = spr(G, c, op, key); g.material.color.setHex(c); g.material.opacity = op; g.scale.setScalar(s); g.position.set(px, py, pz); return g; };
  const floor = (c, op, s = 1, key = 'fl') => put('disc', () => addM(c, op), key, 0, 0.01, 0, s, s, s, -Math.PI / 2).material.opacity = op;
  const rise = k => ease(clamp(u * 1.6 - k * 0.5, 0, 1));
  switch (kind) {
    case 'bramble': floor(0x0a1a04, 0.5 * fade); for (let i = 0; i < 22; i++) { const an = R() * 6.283, d = Math.sqrt(R()) * 1.4, h = (0.5 + R() * 0.9) * rise(d / 1.4);
      put('spike', () => lit(0x0e1a08, 0x3a8a1a, 0.3, { flatShading: true }), 'th' + i, Math.cos(an) * d, h / 2, Math.sin(an) * d, 0.16, h, 0.16, (R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5); } glow(c2, 2.2, 0.35 * fade, 'g'); break;
    case 'toxicring': { const rr = 0.4 + u * 1.2; put('ring', () => addM(0x8aff2a, 0.8), 'r', 0, 0.02, 0, rr, rr, rr, -Math.PI / 2).material.opacity = 0.8 * fade;
      for (let i = 0; i < 26; i++) { const an = i / 26 * 6.283 + R() * 0.2, d = rr * (0.85 + R() * 0.3), up = ((t * 0.8 + R()) % 1); put('sph', () => lit(0x3a8a1a, 0xaaff3a, 0.9, { transparent: true, opacity: 0.7 }), 'b' + i, Math.cos(an) * d, up * 0.9, Math.sin(an) * d, 0.18 + R() * 0.2, 0.18 + R() * 0.2, 0.18 + R() * 0.2).material.opacity = 0.75 * fade * (1 - up); }
      glow(0x8aff2a, 2.8 * rr, 0.3 * fade, 'g'); break; }
    case 'undertow': floor(0x020818, 0.7 * fade, 1.5); for (let i = 0; i < 5; i++) { const s = 0.3 + i * 0.28; put('arc', () => addM(i % 2 ? 0x3ad8ff : 0x1a5aa8, 0.85), 'v' + i, 0, 0.05 + i * 0.12 * u, 0, s, s, s * 1.5, -Math.PI / 2, 0, t * (5 - i) + i).material.opacity = 0.85 * fade; }
      put('cone', () => lit(0x0a2a5a, 0x1a7aff, 0.6, { transparent: true, opacity: 0.6 }), 'fun', 0, 0.7 * u, 0, 0.9 * u, 1.4 * u, 0.9 * u, Math.PI, t * 4, 0); glow(0x3ad8ff, 2.5, 0.35 * fade, 'g'); break;
    case 'glaciercrater': floor(0x9ad8ff, 0.35 * fade); for (let i = 0; i < 14; i++) { const an = i / 14 * 6.283 + R() * 0.3, d = 0.4 + R() * 1.0, h = (0.4 + R() * 0.8) * rise(d / 1.4);
      put('box', () => lit(0xbfefff, 0x3a8aff, 0.35, { transparent: true, opacity: 0.92, roughness: 0.1 }), 'sl' + i, Math.cos(an) * d, h / 2 - 0.1, Math.sin(an) * d, 0.35, h, 0.18, 0.4 * Math.sin(an), -an, 0.4 * Math.cos(an)); } glow(0xe8faff, 2.6, 0.4 * fade, 'g'); break;
    case 'bonefire': { const rr = 0.5 + u * 0.9; for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283; const fl = spr(G, 0x3a7aff, 0.9, 'f' + i); fl.material.color.setHex(i % 2 ? 0x1a4aff : 0x9ad8ff); fl.material.opacity = 0.9 * fade;
        fl.position.set(Math.cos(an) * rr, 0.35 + Math.sin(t * 14 + i) * 0.08, Math.sin(an) * rr); fl.scale.set(0.45, 0.9 + Math.sin(t * 18 + i) * 0.2, 1);
        if (i % 4 === 0) { put('sph', () => lit(0xe8e0d0, 0x3a6aff, 0.5), 'sk' + i, Math.cos(an) * rr, 0.15, Math.sin(an) * rr, 0.22, 0.22, 0.2); } }
      put('ring', () => addM(0x3a7aff, 0.8), 'r', 0, 0.02, 0, rr, rr, rr, -Math.PI / 2).material.opacity = 0.8 * fade; break; }
    case 'chainhook': for (let k = 0; k < 6; k++) { const an = k / 6 * 6.283 + 0.3, reach = 1.5 * (u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4 * 0.85);
        for (let i = 0; i < 8; i++) { const d = reach * (i + 1) / 8; put('link', () => lit(0x5a5058, 0x200008, 0.2, { metalness: 0.9, roughness: 0.35 }), 'l' + k + '_' + i, Math.cos(an) * d, 0.18, Math.sin(an) * d, 0.12, 0.12, 0.12, i % 2 ? Math.PI / 2 : 0, -an, 0); }
        put('spike', () => lit(0x8a8088, 0xff2a4a, 0.4, { metalness: 0.9 }), 'h' + k, Math.cos(an) * reach, 0.18, Math.sin(an) * reach, 0.14, 0.4, 0.14, 0, -an, -Math.PI / 2); } glow(0xff3a5a, 2.0, 0.3 * fade, 'g'); break;
    case 'lavaquake': floor(0x1a0400, 0.6 * fade, 1.4); for (let i = 0; i < 6; i++) { const an = i / 6 * 6.283 + 0.4, d = 0.35 + (i % 2) * 0.75; put('box', () => lit(0xff3a00, 0xff3a00, 2.0), 'cr' + i, Math.cos(an) * d * 0.6, 0.02, Math.sin(an) * d * 0.6, d * 1.2, 0.02, 0.06, 0, -an, 0); }
      for (let i = 0; i < 7; i++) { const an = R() * 6.283, d = Math.sqrt(R()) * 1.2, h = (0.8 + R() * 1.2) * rise(d / 1.4) * (0.8 + Math.sin(t * 20 + i) * 0.2);
        put('cyl', () => lit(0xff6a00, 0xff4a00, 1.6, { transparent: true, opacity: 0.9 }), 'gy' + i, Math.cos(an) * d, h / 2, Math.sin(an) * d, 0.2, h, 0.2);
        put('dode', () => lit(0x2a0a04, 0xff3a00, 0.7, { flatShading: true }), 'rk' + i, Math.cos(an) * d * (1 + u * 0.4), h + 0.1 + u * 0.4, Math.sin(an) * d * (1 + u * 0.4), 0.16, 0.16, 0.16, t * 4, t * 3, 0); }
      glow(0xff5a00, 3.2, 0.5 * fade, 'g'); break;
    case 'shardstorm': for (let i = 0; i < 24; i++) { const an = i / 24 * 6.283 + R() * 0.2, d = 0.2 + u * (1.1 + R() * 0.5);
        put('oct', () => lit(0xd0f0ff, 0x3a8aff, 0.5, { flatShading: true, transparent: true, opacity: 0.95 }), 's' + i, Math.cos(an) * d, 0.35 + R() * 0.5, Math.sin(an) * d, 0.1, 0.1, 0.45, 0, -an + Math.PI / 2, 0); }
      put('ring', () => addM(0xe0f6ff, 0.8), 'r', 0, 0.03, 0, 0.3 + u * 1.4, 0.3 + u * 1.4, 0.3 + u * 1.4, -Math.PI / 2).material.opacity = 0.8 * fade; glow(0xbfefff, 2.2, 0.4 * fade, 'g'); break;
    case 'permafrost': { const rr = 0.3 + u * 1.5; put('ring', () => addM(0xffffff, 0.9), 'r', 0, 0.02, 0, rr, rr, rr, -Math.PI / 2).material.opacity = 0.9 * fade; floor(0xa8d8f0, 0.3 * fade, rr);
      for (let i = 0; i < 28; i++) { const an = i / 28 * 6.283, h = 0.35 + (i % 3) * 0.2; put('spike', () => lit(0xffffff, 0x7ad8ff, 0.35, { flatShading: true }), 's' + i, Math.cos(an) * rr, h / 2, Math.sin(an) * rr, 0.14, h * (1 - u * 0.3), 0.14, Math.sin(an) * 0.3, 0, -Math.cos(an) * 0.3); } break; }
    case 'sunburst': { const s = 0.2 + ease(u) * 1.2; put('sph', () => lit(0xfff0a0, 0xff8a00, 1.8), 'sun', 0, 0.5, 0, s, s, s); put('sph', () => lit(0x200800, 0x000000, 0, { transparent: true, opacity: 0.85 }), 'core', 0, 0.5, 0, s * 0.55, s * 0.55, s * 0.55); // a black core: the dread sun
      for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + t; put('box', () => lit(0xffc81a, 0xffa000, 2), 'ray' + i, Math.cos(an) * s * 1.3, 0.5, Math.sin(an) * s * 1.3, s * 1.2, 0.05, 0.08, 0, -an, 0); }
      put('ring', () => addM(0xffc81a, 0.9), 'sh', 0, 0.03, 0, 0.3 + u * 1.8, 0.3 + u * 1.8, 0.3 + u * 1.8, -Math.PI / 2).material.opacity = 0.9 * fade; glow(0xffa000, 4 * s, 0.55 * fade, 'g', 0, 0.5); break; }
    default: return false;
  }
  rSq ||= mk(SQ, SQ); rSq.render(gScene, gCam);
  const c0 = pj(0, 0, 0), c1p = pj(1.5, 0, 0), D = r * SQ / (c1p[0] - c0[0]); // the 3D field's radius 1.5 is the attack's radius on screen, its centre on (x, y)
  ctx.save(); ctx.globalAlpha = Math.min(1, fade * 1.5); ctx.imageSmoothingEnabled = true; ctx.drawImage(rSq.domElement, x - c0[0] * D / SQ, y - c0[1] * D / SQ, D, D); ctx.restore();
  return true;
}

// ============ cone powers: drawn from (x, y) along angle a, reaching len ============
function cone(ctx, kind, b, x, y, a, len, ang, u, fade, now, seed) {
  const t = now / 1000; G.begin(); const R = rng(seed * 17 + 3);
  const put = (geo, mat, key, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = mesh(G, geo, mat, key); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
  const L3 = 2.6 * ease(clamp(u * 1.4, 0, 1)); // in the 3D scene the cone runs along +X from -1.3
  const fan = (c, op, key) => put('sector', () => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), key, -1.3, 0.02, 0, L3, L3, L3, -Math.PI / 2, 0, 0);
  switch (kind) {
    case 'hellbreath': fan(0xff3a00, 0.22 * fade, 'lf'); for (let i = 0; i < 18; i++) { const d = ((t * 1.6 + i / 18) % 1) * L3, sp = (R() - 0.5) * 2 * Math.tan(ang) * d;
        put('dode', () => lit(0x2a0800, 0xff4a00, 1.3, { flatShading: true }), 'r' + i, -1.3 + d, 0.15 + R() * 0.3, sp, 0.16 + d * 0.1, 0.16 + d * 0.1, 0.16 + d * 0.1, t * 5 + i, t * 3, 0);
        const g = spr(G, 0xff6a00, 0.8, 'fg' + i); g.material.color.setHex(i % 3 ? 0xff5a00 : 0xffd040); g.position.set(-1.3 + d, 0.25, sp); g.scale.setScalar(0.3 + d * 0.25); g.material.opacity = 0.75 * fade; } break;
    case 'bloodcrescent': for (let i = 0; i < 2; i++) { const k = clamp(u * 1.6 - i * 0.35, 0, 1); put('arc', () => lit(0x6a0010, 0xff1a2a, 1.6, { transparent: true, opacity: 0.95 }), 'c' + i, -1.3 + k * 2.4, 0.3, 0, 0.9 + k * 0.4, 0.9 + k * 0.4, 1.2, -Math.PI / 2, 0, -Math.PI * 0.45 + (i ? 0.3 : -0.3)).material.opacity = 0.95 * fade * (1 - k * 0.5); } break;
    case 'crownglare': fan(0xffc000, 0.2 * fade, 'f'); for (let i = 0; i < 9; i++) { const an = (i / 8 - 0.5) * 2 * ang; put('box', () => addM(0xfff0a0, 0.8), 'ray' + i, -1.3 + Math.cos(an) * L3 / 2, 0.25, Math.sin(an) * L3 / 2, L3, 0.03, 0.06, 0, -an, 0).material.opacity = 0.7 * fade * (0.6 + 0.4 * Math.sin(t * 20 + i)); }
      put('torus', () => lit(0xffd000, 0xffa000, 1.5, { metalness: 0.9 }), 'eye', -1.0, 0.4, 0, 0.5, 0.5, 0.5, 0, Math.PI / 2, t * 2); put('sph', () => lit(0x200000, 0xff0000, 2), 'pupil', -1.0, 0.4, 0, 0.12, 0.2, 0.12); break;
    case 'crimsonrake': for (let i = 0; i < 3; i++) put('arc', () => lit(0x5a0008, 0xff1a2a, 2, { transparent: true, opacity: 0.95 }), 'g' + i, -0.6 + u * 0.8, 0.2, (i - 1) * 0.35, 1.0, 1.0, 0.7, -Math.PI / 2, 0, -Math.PI * 0.45).material.opacity = 0.95 * fade;
      for (let i = 0; i < 10; i++) put('sph', () => lit(0x8a0010, 0xff0010, 1), 'dr' + i, -0.4 + R() * 2 * u, 0.1 + R() * 0.4 - u * 0.2, (R() - 0.5) * 1.2, 0.07, 0.07, 0.07); break;
    case 'wraithreap': put('arc', () => lit(0x0a6a68, 0x28e0d8, 1.8, { transparent: true, opacity: 0.9 }), 'sc', -1.3, 0.35, 0, 2.0, 2.0, 1.6, -Math.PI / 2, 0, -Math.PI * 0.45 + (u - 0.5) * 1.6).material.opacity = 0.9 * fade;
      for (let i = 0; i < 8; i++) { const g = spr(G, 0xc0fff8, 0.7, 'w' + i), an = (R() - 0.5) * 2 * ang, d = ((t * 0.9 + i / 8) % 1) * L3; g.position.set(-1.3 + Math.cos(an) * d, 0.3 + Math.sin(t * 6 + i) * 0.15, Math.sin(an) * d); g.scale.set(0.3, 0.55, 1); g.material.opacity = 0.7 * fade; } break;
    default: return false;
  }
  rSq ||= mk(SQ, SQ); rSq.render(gScene, gCam);
  const a0 = pj(-1.3, 0, 0), a1 = pj(1.3, 0, 0), D = len * SQ / (a1[0] - a0[0]); // the scene's cone apex (-1.3) sits on the caster, its far end at the cone's reach
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = Math.min(1, fade * 1.5); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(rSq.domElement, -a0[0] * D / SQ, -a0[1] * D / SQ, D, D); ctx.restore();
  return true;
}

// ============ lane powers (beams): from (x0, y0) to (x1, y1) ============
function lane(ctx, kind, b, x0, y0, x1, y1, w, k, now) {
  const t = now / 1000, Lx = Math.hypot(x1 - x0, y1 - y0); if (Lx < 2) return true; L.begin(); const span = (LW / LH) * 2;
  const put = (geo, mat, key, px, py, pz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { const m = mesh(L, geo, mat, key); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
  switch (kind) {
    case 'brinejet': for (let s = 0; s < 3; s++) put('tube', () => lit(0x0a7a6a, 0x3affd8, 0.7, { transparent: true, opacity: 0.6 }), 'j' + s, 0, Math.sin(t * 9 + s * 2) * 0.12 * k, Math.cos(t * 9 + s * 2) * 0.12 * k, 0.35 * k, span, 0.35 * k, 0, 0, Math.PI / 2);
      for (let i = 0; i < 16; i++) { const u2 = (i / 16 + t * 1.8) % 1; put('sph', () => lit(0x9affe8, 0x3affd8, 1.2), 'd' + i, -span / 2 + u2 * span, Math.sin(i * 2.3 + t * 8) * 0.5 * k, Math.cos(i * 2.3) * 0.3, 0.09, 0.09, 0.09); } break;
    case 'voidlance': put('cone', () => lit(0x050008, 0x2a0050, 0.5, { flatShading: true }), 'sp', 0, 0, 0, 0.55 * k, span, 0.55 * k, 0, 0, -Math.PI / 2);
      put('cone', () => addM(0xb07aff, 0.35), 'au', 0, 0, 0, 0.9 * k, span, 0.9 * k, 0, 0, -Math.PI / 2);
      for (let i = 0; i < 8; i++) { const u2 = (i / 8 + t * 2.2) % 1; put('torus', () => addM(0xb07aff, 0.8), 'r' + i, -span / 2 + u2 * span, 0, 0, 0.9 * k * (1 - u2 * 0.7), 0.9 * k * (1 - u2 * 0.7), 0.9 * k * (1 - u2 * 0.7), 0, Math.PI / 2, 0); } break;
    case 'thunderram': for (let s = 0; s < 3; s++) { let px = -span / 2; const R = rng(Math.floor(t * 20) * 7 + s); for (let i = 0; i < 14; i++) { const seg = span / 14, py = (R() - 0.5) * 0.7 * k;
        put('box', () => lit(0xfff27a, 0xfff27a, 2.5), 'z' + s + '_' + i, px + seg / 2, py, 0, seg * 1.05, 0.05 + (s === 0 ? 0.04 : 0), 0.05, 0, 0, (R() - 0.5) * 0.9); px += seg; } }
      put('tube', () => addM(0x2a6aff, 0.3), 'gl', 0, 0, 0, 0.8 * k, span, 0.8 * k, 0, 0, Math.PI / 2); break;
    default: return false;
  }
  rLn ||= mk(LW, LH); rLn.render(lScene, lCam);
  const hh = Math.max(w * 2.4, 24);
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.imageSmoothingEnabled = true; ctx.drawImage(rLn.domElement, 0, -hh / 2, Lx, hh); ctx.restore();
  return true;
}

// ============ hit burst: a splash in the boss's own colours ============
function burst(ctx, b, x, y, size, u, now) {
  G.begin(); const t = now / 1000, R = rng(7);
  for (let i = 0; i < 14; i++) { const an = R() * 6.283, d = 0.2 + u * (0.8 + R() * 0.6);
    const s2 = mesh(G, 'oct', () => lit(b.c1, b.c2, 1.2, { flatShading: true }), 'bs' + i); s2.position.set(Math.cos(an) * d, 0.3 + (1 - u) * R() * 0.6, Math.sin(an) * d); s2.scale.setScalar(0.14 * (1 - u)); s2.rotation.set(t * 5 + i, t * 3, 0);
    s2.material.color.setHex(b.c1); s2.material.emissive.setHex(b.c2); }
  const ring = mesh(G, 'ring', () => addM(0xffffff, 0.8), 'br'); ring.position.y = 0.03; ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(0.3 + u * 1.3); ring.material.color.setHex(b.c2); ring.material.opacity = 0.9 * (1 - u);
  rSq ||= mk(SQ, SQ); rSq.render(gScene, gCam);
  ctx.save(); ctx.globalAlpha = Math.min(1, 1.5 * (1 - u)); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 1, x, y, size * 0.35); g.addColorStop(0, css(b.c2) + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.globalCompositeOperation = 'source-over'; { const c0 = pj(0, 0, 0); ctx.drawImage(rSq.domElement, x - c0[0] * size / SQ, y - c0[1] * size / SQ, size, size); } ctx.restore();
  return true;
}

window.PMBossFx = { has: n => !!B[n], info: n => B[n], projectile, telegraph, ground, cone, lane, burst, css };
