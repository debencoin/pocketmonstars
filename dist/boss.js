'use strict';
// Boss Arena (under Immortal Guild): the fallen monsters' levels. Each level is two bosses at once, a serpent and another
// monster. Fight them solo (1v2, 2v2 or 3v2 with your own Monstars), or raid online with other Phantom players (each brings
// one Monstar and drives it; the bosses are 3-5 levels higher and much tougher). Beat a level for its ancient Anunnaki seal.
(() => {
const S = window.PMStake, API = window.PMArenaApi, PA = window.PMArena; if (!S || !API || !S.Bosses) return;
const { SPECIES } = S.Monstars, { BOSS_STAGES, BOSS_COOP } = S.Bosses;
const q = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nav = document.querySelector('header nav'), main = document.querySelector('main');
const btn = document.createElement('button'); btn.textContent = 'Boss Arena'; btn.dataset.tab = 'boss'; btn.onclick = () => window.tab('boss');
const gbtn = nav?.querySelector('[data-tab=guild]'); nav?.insertBefore(btn, gbtn ? gbtn.nextSibling : nav.querySelector('[data-tab=market]'));
const sec = document.createElement('section'); sec.id = 'boss'; sec.className = 'view hidden'; main.insertBefore(sec, main.querySelector('footer'));

// The Ancient Seal: an Anunnaki winged sun disc in gold, with the level in the middle. Dark and unlit until it is earned.
function seal(n, earned, size = 64) {
  const g = earned ? ['#fff2b0', '#e0a830', '#8a5a10'] : ['#5a5a66', '#3a3a44', '#22222a'], id = 'sg' + n + (earned ? 'e' : 'l');
  const feathers = side => Array.from({ length: 5 }, (_, i) => { const y = 44 + i * 4.2, w = 30 - i * 4; return `<path d="M${side > 0 ? 66 : 34} ${y} q ${side * w * 0.6} ${-3} ${side * w} ${2 + i}" stroke="url(#${id})" stroke-width="3.2" fill="none" stroke-linecap="round"/>`; }).join('');
  return `<svg class="bs-seal${earned ? ' on' : ''}" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Ancient Seal of Level ${n}${earned ? ', earned' : ', not earned yet'}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset=".55" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient></defs>
    <circle cx="50" cy="50" r="47" fill="#14101c" stroke="url(#${id})" stroke-width="3"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="url(#${id})" stroke-width="1" stroke-dasharray="2 3"/>
    ${feathers(1)}${feathers(-1)}
    <path d="M50 66 l-9 12 h18z" fill="url(#${id})"/>
    <circle cx="50" cy="46" r="13" fill="url(#${id})"/><circle cx="50" cy="46" r="9.5" fill="#14101c"/>
    <text x="50" y="50.5" text-anchor="middle" font-size="11" font-weight="800" fill="url(#${id})" font-family="serif">${n}</text>
    <path d="M38 22 l4 6 M46 19 v7 M54 19 v7 M62 22 l-4 6" stroke="url(#${id})" stroke-width="2" stroke-linecap="round"/></svg>`;
}

sec.innerHTML = `<div class="topline"><div><div class="eyebrow">The fallen monsters</div><h1>Boss Arena</h1>
  <p class="muted">Every level is two bosses at once: a serpent and another monster, with evil powers nobody else has. Take them on with 1, 2 or 3 of your Monstars (1v2, 2v2, 3v2),
  or <b>raid online</b> with other Phantom players: each of you brings one Monstar and drives it yourself. Online the bosses are 3 to 5 levels higher and much tougher, so plan your attack together.
  Your Monstars earn EXP and level up as they fight. Beat a level and everyone on the team earns its <b>Ancient Seal</b>.</p></div>
  <span class="pill"><i class="dot"></i> <span id="bsSeals">0</span> / ${BOSS_STAGES.length} SEALS</span></div>
  <div class="panel"><h3>Your Ancient Seals</h3><div class="bs-seals" id="bsSealRow"></div></div>
  <div class="panel"><h3>1 · Choose a level</h3><div class="bs-stages" id="bsStages"></div></div>
  <div class="panel"><h3>2 · How you fight</h3>
    <div class="bs-modes" role="group" aria-label="Fight mode" id="bsModes">
      <button data-m="1" aria-pressed="true">Solo 1v2</button><button data-m="2">Solo 2v2</button><button data-m="3">Solo 3v2</button>
      <button data-m="c2">Online raid · 2 players</button><button data-m="c3">Online raid · 3 players</button></div>
    <p class="pv-note" id="bsModeNote"></p>
    <h3 style="margin-top:12px">3 · Your <span id="bsNeed">Monstar</span></h3><div class="gd-picks" id="bsPick"></div>
    <div class="pv-row" style="margin-top:12px"><button class="primary" id="bsGo">☥ Fight the bosses</button></div></div>
  <div class="panel"><h2>Open online raids</h2><p class="pv-note">Players waiting for allies. Pick your Monstar above, then join a raid (Phantom sign-in needed).</p><div class="bs-raids" id="bsRaids"></div></div>`;

let stage = 1, mode = '1', team = [], badges = new Set(), timer = null;
const coop = () => mode.startsWith('c'), need = () => (coop() ? 1 : Number(mode));
const pool = () => (API.mine?.() || []).filter(m => !SPECIES[m.speciesId]?.boss);
const guestPool = () => S.Monstars.STARTER_IDS.map(id => ({ serial: 'g' + id, speciesId: id, level: 1, name: SPECIES[id].name, guest: true }));
const bossImg = id => `<img src="${PA.spriteSrc(id, 0)}" alt="${esc(SPECIES[id].name)}" loading="lazy">`;
function topLevel() { const list = pool(); return Math.max(1, ...team.map(sr => list.find(m => m.serial === sr)?.level || 1)); }

function renderSeals() {
  q('bsSeals').textContent = badges.size;
  q('bsSealRow').innerHTML = BOSS_STAGES.map(st => `<div class="bs-seal-box" title="${esc(st.title)}">${seal(st.stage, badges.has(st.stage), 56)}<small>${st.stage}</small></div>`).join('');
}
function renderStages() {
  const lv = topLevel(), [a, b] = coop() ? BOSS_COOP.levelUp : BOSS_COOP.soloLevelUp;
  q('bsStages').innerHTML = BOSS_STAGES.map(st => `<button class="bs-stage${st.stage === stage ? ' on' : ''}${badges.has(st.stage) ? ' won' : ''}" data-st="${st.stage}" aria-pressed="${st.stage === stage}">
    <span class="bs-lv">Level ${st.stage}${badges.has(st.stage) ? ' ☥' : ''}</span><span class="bs-pair">${st.bosses.map(bossImg).join('<i>+</i>')}</span>
    <b>${esc(st.title)}</b><small>${st.bosses.map(id => esc(SPECIES[id].name)).join(' & ')}</small><small class="bs-blv">Bosses Lv${lv + a}-${lv + b}</small></button>`).join('');
  q('bsStages').querySelectorAll('[data-st]').forEach(x => x.onclick = () => { stage = Number(x.dataset.st); renderStages(); });
}
function renderPick() {
  const signed = !!S.session(), list = signed ? pool() : guestPool(), n = need();
  team = team.filter(sr => list.some(m => m.serial === sr)).slice(0, n);
  if (!team.length && list[0]) team = [list[0].serial];
  q('bsNeed').textContent = n === 1 ? 'Monstar' : `${n} Monstars (${team.length}/${n} picked)`;
  q('bsModeNote').innerHTML = coop() ? (signed && !S.session().wallet.startsWith('@') ? `You bring one Monstar and open a raid for ${mode.slice(1)} players. Share the raid code; it starts when the raid is full (or start early). Bosses are 3-5 levels above your strongest Monstar, with more HP for every extra player.`
      : '<b>Online raids need a Phantom wallet.</b> Sign in with Phantom (top right) to raid with other players.')
    : `Your ${n === 1 ? 'Monstar fights' : n + ' Monstars fight'} both bosses at once. You drive one${n > 1 ? ' (tap a teammate to switch), the others fight on their own' : ''}. Bosses are 1-2 levels above your strongest Monstar.${signed ? '' : ' <b>Sign in to save EXP to your Monstars and earn seals.</b>'}`;
  if (!list.length) { q('bsPick').innerHTML = '<p class="pv-note">You have no Monstars to fight with yet.</p>'; return; }
  q('bsPick').innerHTML = list.map(m => `<button class="gd-pick" data-sr="${m.serial}" aria-pressed="${team.includes(m.serial)}"><img src="${PA.spriteSrc(m.speciesId, m.stageId)}" alt="${esc(m.form || m.name)}"><small class="gd-nm">${esc((m.form || m.name || '').replace(/ #\d+$/, ''))}</small><small>Lv${m.level}</small></button>`).join('');
  q('bsPick').querySelectorAll('[data-sr]').forEach(x => x.onclick = () => { const sr = isNaN(Number(x.dataset.sr)) ? x.dataset.sr : Number(x.dataset.sr);
    if (team.includes(sr)) team = team.filter(t => t !== sr); else { team.push(sr); if (team.length > need()) team.shift(); } renderPick(); renderStages(); });
}
async function renderRaids() {
  let raids = []; try { raids = (await S.bossOpen()).raids || []; } catch {}
  q('bsRaids').innerHTML = raids.length ? raids.map(r => { const st = S.Bosses.stageOf(r.stage);
    return `<div class="bs-raid"><span class="bs-pair">${st.bosses.map(bossImg).join('')}</span><div><b>Level ${r.stage}: ${esc(st.title)}</b><small>Bosses Lv${r.level} · ${r.players.length} of ${r.size} players · code ${esc(r.code)}</small>
      <small>${r.players.map(p => esc((p.monstar.form || p.monstar.name) + ' (' + p.wallet.slice(0, 4) + '…)')).join(', ')}</small></div><button class="primary" data-code="${esc(r.code)}">Join raid</button></div>`; }).join('')
    : '<div class="pv-empty">No open raids right now. Open one above and share its code.</div>';
  q('bsRaids').querySelectorAll('[data-code]').forEach(x => x.onclick = () => {
    try { if (!S.session() || S.session().wallet.startsWith('@')) throw Error('Sign in with Phantom to raid with other players.');
      const sr = team[0] ?? pool()[0]?.serial; if (sr == null) throw Error('Pick your Monstar first.'); API.joinBoss(x.dataset.code, sr); } catch (e) { API.toast?.(e.message, true); } });
}
async function refresh() {
  if (S.session()) { try { badges = new Set(((await S.bossBadges()).badges || []).map(b => b.stage)); } catch {} } else badges = new Set();
  renderSeals(); renderPick(); renderStages(); renderRaids();
}
q('bsModes').querySelectorAll('[data-m]').forEach(x => x.onclick = () => { mode = x.dataset.m; q('bsModes').querySelectorAll('[data-m]').forEach(y => y.setAttribute('aria-pressed', y === x)); renderPick(); renderStages(); });
q('bsGo').onclick = () => {
  try {
    const n = need(), signed = !!S.session();
    if (team.length < n) throw Error(`Pick ${n} Monstars for ${n}v2.`);
    if (coop() && (!signed || S.session().wallet.startsWith('@'))) throw Error('Online raids need a Phantom wallet. Sign in with Phantom.');
    if (!signed) return API.startBoss({ stage, serials: [], guestTeam: team.map(sr => new S.Monstars.Monstar({ speciesId: Number(String(sr).slice(1)), level: 1 })) });
    API.startBoss({ stage, serials: team.slice(0, n), coop: coop(), size: coop() ? Number(mode.slice(1)) : n });
  } catch (e) { API.toast?.(e.message, true); }
};
window.PMBossTab = { refresh };
const baseTab = window.tab;
window.tab = function (id) { baseTab(id); btn.classList.toggle('active', id === 'boss'); clearInterval(timer); if (id === 'boss') { refresh(); timer = setInterval(renderRaids, 8000); } };
})();
