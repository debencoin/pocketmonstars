'use strict';
// Wild Expedition: a run of wild Monstar battles across four arenas, using the same battle engine,
// move cards, effects and HUD as the Arena. Progress is kept on this device.
(() => {
const S = window.PMStake, PA = window.PMArena; if (!S || !PA || !window.PMStartBattle) return;
const { Monstars } = S;
const q = id => document.getElementById(id);
const KEY = 'pm-wild-v1';
const ZONES = [
  { name: 'Grass Pitch', theme: 2, pool: [1, 7, 2, 6], min: 1, boss: 7, blurb: 'Soft turf and young wild Monstars. A good place to start.' },
  { name: 'Dust Bowl', theme: 1, pool: [5, 0, 3, 1], min: 6, boss: 5, blurb: 'Hot dirt, loose rock and fast hitters.' },
  { name: 'Stone Coliseum', theme: 0, pool: [4, 6, 5, 3], min: 14, boss: 4, blurb: 'Broken pillars and old champions.' },
  { name: 'Cosmic Dome', theme: 3, pool: [8, 4, 3, 2], min: 26, boss: 8, blurb: 'The strongest wild Monstars live under the stars.' },
];
const STEPS = 4; // three wild battles then the zone boss
const load = () => { try { return { z: 0, s: 0, wins: 0, best: 0, loops: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { z: 0, s: 0, wins: 0, best: 0, loops: 0 }; } };
const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
let st = load();

function foeFor(z = st.z, s = st.s) {
  const Z = ZONES[z], boss = s === STEPS - 1;
  return { foeId: boss ? Z.boss : Z.pool[(s + st.wins) % Z.pool.length], foeLevel: Z.min + s * 2 + (boss ? 3 : 0) + st.loops * 30, arena: Z.theme, zone: z, step: s, boss };
}
const label = () => { const Z = ZONES[st.z]; return `${Z.name} · ${st.s === STEPS - 1 ? 'Zone boss' : 'Battle ' + (st.s + 1) + ' of ' + (STEPS - 1)} next`; };

const sec = q('play'); if (!sec) return;
const box = document.createElement('div'); box.id = 'pvWild';
sec.prepend(box);

function render() {
  const f = foeFor(), sp = Monstars.SPECIES[f.foeId];
  box.innerHTML = `<div class="topline"><div><div class="eyebrow">Wild Expedition</div><h1>Into the wild</h1>
  <p class="muted">Battle wild Monstars across four arenas with the same moves, powers and live HUD as the Arena. Win to push deeper. Every hit earns EXP, so your Monstar levels up and evolves on the way.</p></div>
  <span class="pill"><i class="dot"></i> ${st.wins} WINS · BEST ZONE ${Math.min(ZONES.length, st.best + 1)}</span></div>
  <div class="wx-grid">
   <div class="wx-next panel">
    <div class="wx-next-art"><img src="${PA.spriteSrc(f.foeId)}" alt=""><span class="wx-tag ${f.boss ? 'boss' : ''}">${f.boss ? 'ZONE BOSS' : 'WILD'}</span></div>
    <div class="wx-next-body"><div class="eyebrow">${ZONES[st.z].name}${st.loops ? ' · Round ' + (st.loops + 1) : ''}</div>
     <h2>Wild ${sp.name} <small>Lv${f.foeLevel}</small></h2>
     <p class="pv-note">${sp.type} · ${sp.cls.label} · uses <b>${sp.move}</b> and <b>${sp.special}</b></p>
     <div class="wx-steps">${Array.from({ length: STEPS }, (_, i) => `<i class="${i < st.s ? 'done' : i === st.s ? 'cur' : ''}">${i === STEPS - 1 ? '★' : i + 1}</i>`).join('')}</div>
     <p class="pv-note" style="margin:10px 0">Your Monstar: pick one in the Arena tab (currently the one selected there).</p>
     <button class="primary" id="wxGo">Battle wild ${sp.name}</button></div>
   </div>
   <div class="wx-zones">${ZONES.map((Z, i) => `<button class="wx-zone t${Z.theme} ${i === st.z ? 'on' : ''} ${i > st.best ? 'locked' : ''}" data-z="${i}" ${i > st.best ? 'disabled' : ''}>
     <span class="wx-zn">${i + 1}. ${Z.name}</span><span class="wx-zb">${Z.blurb}</span><span class="wx-zl">Lv${Z.min}+ ${i > st.best ? '· locked' : i < st.best ? '· cleared' : ''}</span>
     <span class="wx-mons">${Z.pool.slice(0, 3).map(id => `<img src="${PA.spriteSrc(id)}" alt="">`).join('')}</span></button>`).join('')}</div>
  </div>`;
  q('wxGo').onclick = () => window.PMStartBattle(foeFor());
  box.querySelectorAll('.wx-zone:not([disabled])').forEach(b => b.onclick = () => { st.z = +b.dataset.z; st.s = 0; save(st); render(); });
}

window.PMWild = {
  result(won, opt) {
    if (!won || opt.zone !== st.z || opt.step !== st.s) return;
    st.wins++; st.s++;
    if (st.s >= STEPS) { st.s = 0; st.best = Math.max(st.best, st.z + 1); if (st.z < ZONES.length - 1) st.z++; else { st.z = 0; st.loops++; } }
    st.best = Math.min(st.best, ZONES.length - 1); save(st); render();
  },
  next() { window.PMStartBattle(foeFor()); },
  map() { render(); window.tab?.('play'); },
  label,
};
render();
if (location.hash === '#wild') setTimeout(() => window.tab?.('play'), 0);
})();
