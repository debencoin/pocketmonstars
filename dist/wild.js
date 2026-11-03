'use strict';
// Wild Expedition: random wild Monstars from the 50 Frontier species (plus very rare angels and a god).
// Signed in: pay 0.0001 SOL, the server runs the battle and a win can catch the wild Monstar (Phantom wallets keep its level; username accounts get a level 1 Infant).
// Not signed in: practice runs on this device, no catching.
(() => {
const S = window.PMStake, PA = window.PMArena, API = window.PMArenaApi; if (!S || !PA || !window.PMStartBattle || !API) return;
const { Monstars } = S, { SPECIES, TIERS, WILD_IDS, rollWild } = Monstars;
const q = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'pm-wild-v2';
const ZONES = [
  { name: 'Grass Pitch', theme: 2, min: 1, blurb: 'Young wild Monstars. Start here.' },
  { name: 'Dust Bowl', theme: 1, min: 6, blurb: 'Hot dirt and faster hitters.' },
  { name: 'Stone Coliseum', theme: 0, min: 14, blurb: 'Broken pillars and old champions.' },
  { name: 'Cosmic Dome', theme: 3, min: 26, blurb: 'The strongest wild Monstars, and where the angels are seen most.' },
];
const TIER_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Divine'];
const TIER_COL = { Common: '#b9c3d9', Uncommon: '#5fd38a', Rare: '#48d0ff', Epic: '#c08cff', Mythic: '#ffd84a', Divine: '#ff7ad8' };
const load = () => { try { return { z: 0, wins: 0, caught: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { z: 0, wins: 0, caught: [] }; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
let st = load(), cfg = null, pending = null, retries = 0, busy = false;
S.getConfig().then(c => { cfg = c; render(); }).catch(() => {});
const feeSol = () => (Number(cfg?.wildFeeLamports || 100000) / 1e9).toString();
const totalW = Object.fromEntries(TIER_ORDER.map(t => [t, 0])); for (const id of WILD_IDS) totalW[SPECIES[id].tier]++;
const allW = TIER_ORDER.reduce((n, t) => n + (totalW[t] ? TIERS[t].weight : 0), 0);

const sec = q('play'); if (!sec) return;
const box = document.createElement('div'); box.id = 'pvWild'; sec.prepend(box);

function render() {
  const Z = ZONES[st.z], signed = API.signedIn(), mine = API.ownedPick(), acct = (S.session()?.wallet || '').startsWith('@');
  const dex = TIER_ORDER.map(t => {
    const ids = WILD_IDS.filter(id => SPECIES[id].tier === t); if (!ids.length) return '';
    return `<div class="wx-tierrow"><div class="wx-tierhead"><b style="color:${TIER_COL[t]}">${t}</b><span>${ids.length} species · seen ${(TIERS[t].weight / allW * 100).toFixed(t === 'Divine' ? 1 : 0)}% · catch ${Math.round(TIERS[t].catch * 100)}% · stats ×${TIERS[t].mult}</span></div>
      <div class="wx-dex">${ids.map(id => `<span class="wx-mon${st.caught.includes(id) ? ' got' : ''}" title="${esc(SPECIES[id].name)} · ${SPECIES[id].type}"><img src="${PA.spriteSrc(id)}" alt="${esc(SPECIES[id].name)}" loading="lazy"><small>${esc(SPECIES[id].name)}</small></span>`).join('')}</div></div>`;
  }).join('');
  box.innerHTML = `<div class="topline"><div><div class="eyebrow">Wild Expedition</div><h1>Into the wild</h1>
  <p class="muted">${WILD_IDS.length} wild Monstars roam here: the Genesis nine, the fifty Frontier, twenty Anunnaki, twenty Watchers, the five Starter Benders and ten Elemental Benders, plus angels and gods that almost never appear. Wild Monstars are always above your level: usually 1 to 3 levels up, sometimes far more. Anunnaki, benders and mythics are at least 2 up (a rare 1% are level 1). Knock one's HP into the red and tap <b>Capture!</b>. Every Monstar has its own catch odds and they change with every throw (3 throws per battle), and a KO gives one last chance. <b>Phantom players keep the level of what they catch</b>; free and card accounts get it as a level 1 Infant.</p></div>
  <span class="pill"><i class="dot"></i> ${st.wins} WINS · ${st.caught.length} CAUGHT</span></div>
  <div class="wx-grid">
   <div class="wx-next panel">
    <div class="wx-next-art"><span class="wx-q">?</span><span class="wx-tag">WILD</span></div>
    <div class="wx-next-body"><div class="eyebrow">${Z.name} · wild Lv${Z.min}+</div>
     <h2>A wild Monstar is out there…</h2>
     <p class="pv-note">${signed ? (mine ? `You'll battle with <b>${esc(mine.name)}</b> (Lv${mine.level}). Change it in the Arena tab.` : 'You need a Monstar first. Sign in on the Arena tab.') : 'Practice for free, or sign up free (username and password) to capture Monstars.'}</p>
     <div class="pv-row" style="margin-top:12px">
      ${signed ? `<button class="primary" id="wxPay" ${mine ? '' : 'disabled'}>${acct ? 'Enter the wild · free' : `Enter the wild · ${feeSol()} SOL`}</button>` : ''}
      <button class="${signed ? 'smallbtn' : 'primary'}" id="wxFree">Practice run (free, no catching)</button></div>
     <p class="pv-note" style="margin-top:8px">${acct ? 'Free accounts get a wild run every 45 seconds.' : 'With Phantom, the entry fee goes to PocketMonstars and is paid on devnet.'} A practice run never catches anything. There is no running away: tap <b>Catch</b> once its HP is in the red.</p>
     ${acct ? '<div class="wx-pass" id="wxPass"></div>' : ''}</div>
   </div>
   <div class="wx-zones">${ZONES.map((z, i) => `<button class="wx-zone t${z.theme} ${i === st.z ? 'on' : ''}" data-z="${i}"><span class="wx-zn">${i + 1}. ${z.name}</span><span class="wx-zb">${z.blurb}</span><span class="wx-zl">Wild Lv${z.min}+</span></button>`).join('')}</div>
  </div>
  <div class="panel wx-dexpanel"><h3>Wild Monstars · ${WILD_IDS.length}</h3><p class="pv-note" style="margin:6px 0 12px">Ones you've caught are lit up.</p>${dex}</div>`;
  box.querySelectorAll('.wx-zone').forEach(b => b.onclick = () => { st.z = +b.dataset.z; save(); render(); });
  q('wxFree').onclick = () => practice();
  const pay = q('wxPay'); if (pay) pay.onclick = () => enter(pay);
  if (acct) passes();
}

// Free accounts: 2 free catches, then catch passes bought with a card (Phantom players pay SOL per wild run instead)
async function passes() {
  const box = q('wxPass'); if (!box) return; let c; try { c = await S.catchesMe(); } catch { return; }
  box.innerHTML = `<p class="pv-note"><b>${c.free}</b> of ${c.freeTotal} free catches left · <b>${c.credits}</b> catch pass${c.credits === 1 ? '' : 'es'}</p>
    ${c.card ? `<div class="pv-row">${c.packs.map(p => `<button class="smallbtn" data-pack="${p.n}">💳 ${p.n} pass${p.n > 1 ? 'es' : ''} · $${p.usd.toFixed(2)}</button>`).join('')}</div>` : (c.free ? '' : '<p class="pv-note">Catch passes (card) open soon. Connect Phantom to catch with SOL.</p>')}`;
  box.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => S.catchPassBuy(Number(b.dataset.pack)).catch(e => alert(e.message)));
}
function practice() { // local battle against a random wild Monstar, no catch
  const sid = rollWild(), tier = TIERS[SPECIES[sid].tier], Z = ZONES[st.z];
  const myLv = API.ownedPick()?.level || 1; // wild Monstars are always above your level (special ones: a rare level 1)
  window.PMStartBattle({ foeId: sid, foeLevel: Monstars.wildLevel(SPECIES[sid], myLv, Math.random, Z.min), arena: Z.theme, hard: tier.lvl >= 12, speciesId: sid, practice: true });
}
async function enter(btn) {
  if (busy) return;
  if ((S.session()?.wallet || '').startsWith('@')) { pending = null; API.startServerWild(null, st.z); window.tab?.('pvp'); return; }
  busy = true; const t = btn.textContent; btn.disabled = true; btn.textContent = 'Approve in Phantom…';
  try { const sig = await S.wildPay(); pending = { sig, zone: st.z }; retries = 0; API.startServerWild(sig, st.z); }
  catch (e) { const m = e?.message || String(e); alert(/4001|reject|declin/i.test(m) ? 'Request declined in Phantom. Nothing was sent.' : m.slice(0, 200)); }
  finally { busy = false; btn.disabled = false; btn.textContent = t; }
}

window.PMWild = {
  result() {}, label: () => ZONES[st.z].name, feeSol,
  next() { if (API.signedIn() && API.ownedPick()) { render(); window.tab?.('play'); q('wxPay')?.scrollIntoView({ block: 'center' }); } else practice(); },
  map() { render(); window.tab?.('play'); },
  record(won, c) { if (won) st.wins++; if (c?.ok && !st.caught.includes(c.speciesId)) st.caught.push(c.speciesId); save(); render(); },
  retry() { if (!pending || retries >= 8) return false; retries++; setTimeout(() => API.startServerWild(pending.sig, pending.zone), 3000); return true; },
};
const baseTab = window.tab; window.tab = function (id) { baseTab(id); if (id === 'play') render(); };
render();
if (location.hash === '#wild') setTimeout(() => window.tab?.('play'), 0);
})();
