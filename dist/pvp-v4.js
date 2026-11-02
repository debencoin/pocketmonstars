'use strict';
// v4 overlay: 1v1 Stake Duel (live per-hit SOL shares), one-of-a-kind Monstars per wallet, royalty marketplace.
(() => {
const S = window.PMStake; if (!S) return;
const { Monstars, Stake, ARENA, Sim } = S;
const PA = window.PMArena;
const q = id => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '—';
const sol = (l, d = 6) => Stake.formatSol(BigInt(l), d);
const coarse = matchMedia('(pointer:coarse)').matches; if (coarse) document.body.classList.add('coarse');
let toastT;
function toast(msg, err = false) { let t = q('pvToast'); if (!t) { t = el('div', { id: 'pvToast', className: 'pv-toast', role: 'status' }); document.body.append(t); } t.textContent = msg; t.classList.toggle('err', err); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); }
function fail(e) { const m = e?.message || String(e); toast(/4001|reject|declin/i.test(m) ? 'Request declined in Phantom. Nothing was sent.' : m.slice(0, 300), true); }
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Working…'; try { return await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; btn.textContent = t; } }

// ---------- nav + sections ----------
const nav = document.querySelector('nav');
const pvpBtn = el('button', { textContent: 'Arena' }); pvpBtn.dataset.tab = 'pvp';
nav.insertBefore(pvpBtn, nav.children[0]);
const oldPlay = nav.querySelector('[data-tab=play]'); if (oldPlay) oldPlay.textContent = 'Wild Expedition';
pvpBtn.onclick = () => tab('pvp');
const main = document.querySelector('main');
const pvp = el('section', { id: 'pvp', className: 'view hidden' });
pvp.innerHTML = `
<div class="topline"><div><div class="eyebrow">Real-time 1v1 · Solana devnet</div><h1>Monstar Arena</h1>
<p class="muted">Practice against the computer, or stake SOL against a real rival. Every hit you land takes lamports from their share. KO them and the whole pot is yours.</p></div>
<span class="pill" id="pvNet"><i class="dot"></i> DEVNET TEST SOL</span></div>
<div class="pv-grid">
 <div class="pv-col">
  <div class="pv-stage" id="pvStage">
   <div class="pv-hud" id="pvHud" hidden>
    <div class="hb"><img class="hb-pic" id="pvPic0" alt=""><div class="hb-main">
      <div class="hb-top"><b id="pvN0">YOU</b><span class="hb-lv" id="pvL0">Lv1</span><span class="hb-type" id="pvT0"></span></div>
      <div class="hb-hp"><em>HP</em><div class="hb-bar"><i id="pvH0"></i></div><span id="pvHN0"></span></div>
      <div class="hb-xp"><em>EXP</em><div class="hb-bar xp"><i id="pvX0"></i></div></div>
      <div class="hb-sol"><span class="pv-sol" id="pvS0">0 SOL</span><small id="pvSD0"></small></div><div class="hb-tm" id="pvTm0"></div></div></div>
    <div class="hb-mid"><div class="hb-clock" id="pvClock">1:30</div><div class="hb-pot" id="pvPotMid">POT 0.01 SOL</div><div class="hb-potbar"><i id="pvPB0"></i><i id="pvPB1"></i></div></div>
    <div class="hb r"><img class="hb-pic" id="pvPic1" alt=""><div class="hb-main">
      <div class="hb-top"><b id="pvN1">RIVAL</b><span class="hb-lv" id="pvL1">Lv1</span><span class="hb-type" id="pvT1"></span></div>
      <div class="hb-hp"><em>HP</em><div class="hb-bar"><i id="pvH1"></i></div><span id="pvHN1"></span></div>
      <div class="hb-xp"><em>EXP</em><div class="hb-bar xp"><i id="pvX1"></i></div></div>
      <div class="hb-sol"><span class="pv-sol" id="pvS1">0 SOL</span><small id="pvSD1"></small></div><div class="hb-tm" id="pvTm1"></div></div></div>
   </div>
   <div class="pv-field" id="pvField">
    <canvas id="pvCanvas" width="960" height="540" aria-label="Battle arena"></canvas>
    <div class="pv-pot" id="pvPot" hidden><div class="pv-potbar"><i id="pvP0" style="width:50%"></i><i id="pvP1" style="width:50%"></i></div><small id="pvPotTxt">Pot</small></div>
    <div class="pv-touch"><div class="pv-stickzone" id="pvZone"><div class="pv-stick" id="pvStick"><i id="pvKnob"></i></div></div></div>
   </div>
   <div class="pv-moves" id="pvMoves" hidden>
    <div class="pv-ask"><span>What will <b id="pvAsk">YOUR MONSTAR</b> do?</span><button class="pv-run" id="pvExit">Run</button></div>
    <div class="pv-mgrid" id="pvMGrid"></div>
   </div>
   <div class="pv-overlay" id="pvOverlay"><div class="big" id="pvBig">Ready to battle</div><div class="pv-note" id="pvSmall">Sign in with Phantom, pick your Monstar and create or join a match.</div><div class="pv-row" id="pvOvBtns"></div></div>
  </div>
  <p class="pv-note" id="pvKeys">${coarse ? 'Your Monstar moves and dodges on its own. Tap a move card to attack. Drag on the battlefield any time to steer it yourself.' : 'Your Monstar moves and dodges on its own. Pick a move card or press <b>1</b>–<b>4</b> (also <b>J</b> attack · <b>K</b> special · <b>Space</b> dash · <b>L</b> guard). Hold <b>WASD</b> to steer · <b>Esc</b> to run.'}</p>
  <div class="panel"><div class="pv-row" style="justify-content:space-between"><h3>Your one-of-a-kind Monstars</h3><span class="pv-chip" id="pvCount">Sign in to reveal</span></div>
   <p class="pv-note" style="margin:6px 0 12px">Every wallet gets its own version of all nine species. DNA comes from your address, and the registry refuses any repeat look or stat roll, so no two Monstars are ever the same. Mint one to own it as an NFT you can trade or send.</p>
   <div id="pvCards"><div class="pv-empty">Sign in with Phantom to see your Monstars.</div></div></div>
  <div class="panel" id="pvBreed"><div class="pv-row" style="justify-content:space-between"><h3>Breed Monstars</h3><span class="pv-chip" id="pvBreedFee">0.01 SOL each</span></div>
   <p class="pv-note" style="margin:6px 0 12px">Pair one of your Monstars with another player's. Each of you gets a new Infant. Its stats mix both parents with a random twist, so it can come out stronger or weaker. Each player pays a 0.01 SOL fee to PocketMonstars.</p>
   <div class="pv-row"><select class="pv-input" id="pvBreedPick" style="flex:1;min-width:0" aria-label="Your Monstar to breed"></select><button class="primary" id="pvBreedNew">Start</button></div>
   <div class="pv-row" style="margin-top:8px;flex-wrap:nowrap"><input class="pv-input" id="pvBreedCode" placeholder="Breeding code" maxlength="5" autocapitalize="characters" style="text-transform:uppercase"><button class="smallbtn" id="pvBreedJoin">Join</button></div>
   <div id="pvBreedBox" class="pv-note" style="margin-top:12px"></div></div>
 </div>
 <div class="pv-col">
  <div class="panel"><h3>Wallet</h3>
   <div id="pvWallet" class="pv-note" style="margin:8px 0">Not signed in.</div>
   <button class="primary wide" id="pvSignIn">Connect Phantom &amp; sign in</button>
   <p class="pv-note" id="pvPhantomHint" style="margin-top:8px">Signing in only signs a message. It never moves funds.</p></div>
  <div class="panel" id="pvLobby"><h3>Choose your Monstar</h3>
   <div class="pv-presets pv-mode" id="pvMode" role="group" aria-label="Battle size"><button data-m="1v1" aria-pressed="true">1v1</button><button data-m="3v3" aria-pressed="false">3v3 team</button></div>
   <div class="pv-team" id="pvTeamPick" hidden></div>
   <div class="pv-picker" id="pvPicker" role="group" aria-label="Choose your Monstar"></div>
   <p class="pv-note" id="pvPickInfo" style="margin:8px 0 12px"></p>
   <button class="primary wide" id="pvPractice">Practice vs AI</button>
   <p class="pv-note" style="margin:6px 0 16px">Free, no wallet needed.</p>
   <h3>Battle a real rival</h3>
   <label class="fieldlabel" for="pvStake" style="display:block;margin:10px 0 6px">Stake per player (SOL)</label>
   <div class="pv-presets" id="pvPresets"><button data-v="0">Free</button><button data-v="0.001" aria-pressed="true">0.001</button><button data-v="0.01">0.01</button><button data-v="0.05">0.05</button></div>
   <input class="pv-input" id="pvStake" inputmode="decimal" value="0.001" style="margin-top:8px">
   <p class="pv-note" id="pvStakeNote" style="margin:8px 0"></p>
   <button class="primary wide" id="pvCreate">Create match</button>
   <div class="pv-row" style="margin-top:12px;flex-wrap:nowrap"><input class="pv-input" id="pvJoinCode" placeholder="Match code" maxlength="6" autocapitalize="characters" style="text-transform:uppercase"><button class="smallbtn" id="pvJoin">Join</button></div></div>
  <div class="panel" id="pvRoom" hidden><div class="pv-row" style="justify-content:space-between"><h3>Match</h3><span class="pv-chip" id="pvRoomState">waiting</span></div>
   <div class="pv-code" id="pvCode">——</div><p class="pv-note">Send this code to your rival.</p>
   <div class="pv-players" id="pvPlayers" style="margin:10px 0"></div>
   <button class="primary wide" id="pvDeposit" hidden>Deposit stake</button>
   <p class="pv-note" id="pvEscrow"></p>
   <button class="smallbtn wide" id="pvLeave" style="margin-top:8px">Leave match</button></div>
  <div class="panel"><h3>How the money moves</h3><p class="pv-note" style="margin-top:8px">
   • Smallest unit: <b>1 lamport</b> = 0.000000001 SOL. Every hit moves at least 1 lamport.<br>
   • Hit fee = stake × damage ÷ rival max HP, taken from the victim's share and added to yours, live.<br>
   • KO = winner takes the full pot. Time out = higher HP wins it all. Exact tie = each keeps their share.<br>
   • One settlement transaction pays out. Company fee: <b>1 lamport</b>. Network fee: 0.000005 SOL, paid from the pot.<br>
   • Your Phantom balance updates once that settlement confirms (a few seconds).</p></div>
 </div>
</div>`;
main.insertBefore(pvp, q('play').nextSibling);

// Marketplace block at the top of the existing NFT Market tab
const marketSec = q('market');
const mk = el('div', { id: 'pvMarket' });
mk.innerHTML = `<div class="topline"><div><div class="eyebrow">Buy · Sell · Send</div><h1>Monstar Market</h1>
<p class="muted">Every resale pays a royalty to the wallet the Monstar was born to, forever. Company fee per sale: 1 lamport.</p></div><button class="smallbtn" id="pvMkRefresh">Refresh</button></div>
<div class="panel" style="margin-bottom:16px"><h3>For sale</h3><div class="pv-cards" id="pvListings" style="margin-top:12px"></div></div>
<div class="panel" style="margin-bottom:24px"><h3>Your minted Monstars</h3><p class="pv-note" style="margin:6px 0 12px">List for sale (Phantom approves the marketplace to transfer only that Monstar when someone pays), or send it to another player.</p><div class="pv-cards" id="pvMine"></div></div>`;
marketSec.prepend(mk);

const baseTab4 = window.tab;
window.tab = tab = function (id) { baseTab4(id); pvpBtn.classList.toggle('active', id === 'pvp'); if (id === 'pvp') { refreshMine(); draw(); } if (id === 'market') refreshMarket(); };
let pickedSpecies = 0, local = null, fightAt = 0;

// ---------- state ----------
let me = null, mine = [], picked = null, ws = null, room = null, cfg = null;
let stageHome = null, stageNext = null;
let snapPrev = null, snapCur = null, snapAt = 0, shares = null, pops = [], ended = null;

// ---------- wallet ----------
async function afterSignIn() {
  me = S.session()?.wallet || null;
  q('pvSignIn').textContent = me ? 'Signed in · switch wallet' : 'Connect Phantom & sign in';
  if (!me) return;
  q('pvWallet').innerHTML = `<span class="pv-addr">${esc(me)}</span><br><span id="pvBal">Loading balance…</span>`;
  refreshBalance(); await refreshMine(); openSocket();
  q('pvBig').textContent = 'Ready to duel'; q('pvSmall').textContent = 'Pick your Monstar below, then create a match or join with a code.';
}
async function refreshBalance() { if (!me) return; try { q('pvBal').textContent = sol(await S.balance(me), 6) + ' devnet SOL'; } catch { q('pvBal').textContent = 'Balance unavailable (RPC busy)'; } }
q('pvSignIn').onclick = e => busy(e.target, async () => {
  if (!window.phantom?.solana?.isPhantom) {
    q('pvPhantomHint').innerHTML = coarse ? `Phantom isn't in this browser. <a href="${esc(S.phantomBrowseLink())}" style="color:var(--lime)">Open this game in the Phantom app</a>, then sign in there.` : 'Install the official Phantom extension, then reload this page.';
    throw Error('Phantom wallet not found in this browser.');
  }
  await S.signIn(); await afterSignIn(); toast('Signed in as ' + short(me));
});

// ---------- Monstar cards ----------
function statBars(st) {
  return '<div class="pv-stats">' + Monstars.STAT_KEYS.map(k => `<span>${Monstars.STAT_LABELS[k]}</span><i><s style="width:${Math.min(100, st[k] / 1.8)}%"></s></i><em>${st[k]}</em>`).join('') + '</div>';
}
function expBar(m) { return `<div class="pv-xp" title="${m.expInto} / ${m.expNeed} EXP"><i style="width:${Math.min(100, m.expInto / Math.max(1, m.expNeed) * 100)}%"></i></div>`; }
function cardHtml(m, extra = '') {
  return `<span class="pv-rar ${esc(m.traits.rarity)}">${esc(m.traits.rarity)}</span>${m.tier ? `<span class="pv-tier ${esc(m.tier)}">${esc(m.tier)}</span>` : ''}<span class="pv-lv">Lv${m.level} · ${esc(m.stage)}</span>
  <img class="px" src="art/hd/${Monstars.SPECIES[m.speciesId].art}.png" alt="${esc(m.name)}" style="filter:hue-rotate(${m.traits.hue}deg)" loading="lazy">
  <span class="nm">${esc(m.name)}</span><span class="sub">${esc(m.className)} · ${esc(m.type)} · ${esc(m.traits.aura)} ${esc(m.traits.pattern)} · ${esc(m.traits.nature)}</span>
  ${expBar(m)}${statBars(m.stats)}${extra}`;
}
async function refreshMine() {
  if (!S.session()) return;
  try { mine = await S.myMonstars(); } catch (e) { return fail(e); }
  me = S.session()?.wallet;
  if (!picked || !mine.some(m => m.serial === picked)) picked = mine[0]?.serial ?? null;
  q('pvCount').textContent = mine.length + ' owned'; q('pvCount').classList.add('ok');
  const box = q('pvCards'); box.innerHTML = '';
  const groups = [['mythic', 'Mythic collection'], ['legendary', 'Legendary collection'], ['frontier', 'Frontier collection (caught in the wild)'], ['bred', 'Bred collection'], ['genesis', 'Genesis collection']];
  for (const [key, label] of groups) {
    const list = mine.filter(m => m.collection === key); if (!list.length) continue;
    box.append(el('h4', { className: 'pv-coll', textContent: `${label} · ${list.length}` }));
    const grid = el('div', { className: 'pv-cards' }); box.append(grid);
  for (const m of list) {
    const c = el('div', { className: 'pv-card' }); c.setAttribute('aria-pressed', m.serial === picked);
    c.innerHTML = cardHtml(m, `<div class="acts"><button class="smallbtn" data-a="pick">${m.serial === picked ? 'Selected' : 'Use in duel'}</button>${m.asset ? '<span class="pv-chip ok">Minted NFT</span>' : '<button class="smallbtn" data-a="mint">Mint NFT</button>'}</div>`);
    c.querySelector('[data-a=pick]').onclick = () => { picked = m.serial; pickedSpecies = m.speciesId; refreshMine(); renderPicker(); q('pvLobby').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const mb = c.querySelector('[data-a=mint]');
    if (mb) mb.onclick = () => busy(mb, async () => { await S.mint(m.serial); toast(m.name + ' minted to your wallet.'); refreshMine(); refreshBalance(); });
    grid.append(c);
  }
  }
  renderBreedPick();
  renderMineMarket(); renderPicker();
}

// ---------- lobby ----------
async function stakeNote() {
  cfg ??= await S.getConfig().catch(() => null);
  let v; try { v = Stake.toLamports(q('pvStake').value || '0'); } catch { q('pvStakeNote').textContent = 'Enter an amount like 0.01'; return; }
  q('pvStakeNote').innerHTML = v === 0n ? 'Free match: no SOL moves.' : `Pot <b>${sol(v * 2n)} SOL</b>. A hit worth 10% of your rival's HP moves <b>${sol(v / 10n, 9)} SOL</b> to you. Minimum stake 0.001 SOL.`;
}
q('pvPresets').onclick = e => { const b = e.target.closest('button'); if (!b) return; q('pvPresets').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); q('pvStake').value = b.dataset.v; stakeNote(); };
q('pvStake').oninput = stakeNote; stakeNote();
function teamMsg(needOwned) {
  if (mode !== '3v3') return { mode };
  if (teamPick.length < 3) throw Error('Pick three Monstars for your 3v3 team.');
  const owned = teamPick.map(ownedFor);
  if (owned.every(Boolean)) return { mode, serials: owned.map(m => m.serial) };
  if (needOwned) throw Error('A staked 3v3 needs three of your own Monstars.');
  return { mode, speciesIds: teamPick.slice() };
}
function needSocket() { if (!S.session()) throw Error('Sign in with Phantom first.'); if (!ws || ws.readyState > 1) openSocket(); }
function sendWs(msg) { needSocket(); const go = () => ws.send(JSON.stringify(msg)); ws.readyState === 1 ? go() : ws.addEventListener('open', go, { once: true }); }
q('pvCreate').onclick = () => { try { const lam = Stake.toLamports(q('pvStake').value || '0'); sendWs({ t: 'create', stakeLamports: lam.toString(), serial: lam > 0n ? picked : undefined, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0, ...teamMsg(lam > 0n) }); } catch (e) { fail(e); } };
q('pvJoin').onclick = () => { try { sendWs({ t: 'join', code: q('pvJoinCode').value.trim().toUpperCase(), serial: picked, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0, ...teamMsg(true) }); } catch (e) { fail(e); } };
// ---------- move cards ("What will X do?") ----------
const MOVE_KEYS = ['atk', 'sp', 'dash', 'guard'];
const TYPE_COL = { EMBER: '#e8582c', TIDE: '#3a8ae0', GROVE: '#4caa3a', SPARK: '#d8b018', SHADE: '#7a4ad8', STONE: '#9a8458', FROST: '#5ab8d8', ASTRAL: '#d89a30', PSYCHIC: '#c050c8', NORMAL: '#8a8a9a' };
let moveFor = null;
function buildMoves(meSid, foeSid) {
  if (!room?.players || room.players.length < 2) return;
  const me2 = { speciesId: meSid ?? room.players[room.local || room.ai ? 0 : room.you].monstar.speciesId }, foe = { speciesId: foeSid ?? room.players[room.local || room.ai ? 1 : 1 - room.you].monstar.speciesId };
  const key = me2.speciesId + ':' + foe.speciesId; if (moveFor === key) return; moveFor = key;
  const sp = Monstars.SPECIES[me2.speciesId], eff = Monstars.effectiveness(sp.type, Monstars.SPECIES[foe.speciesId].type);
  const effTxt = eff > 1 ? '<i class="up">▲</i> Super effective' : eff < 1 ? '<i class="dn">▼</i> Not very effective' : '<i>●</i> Normal damage';
  const ST = Sim.STYLES, bs = ST[sp.basicStyle], ss = ST[sp.specialStyle];
  const cards = [
    { k: 'atk', n: sp.move, ty: sp.type, c: bs.cost ? '⚡' + bs.cost : '⚡0', e: effTxt },
    { k: 'sp', n: sp.special, ty: sp.type, c: '⚡' + ss.cost, e: effTxt },
    { k: 'dash', n: 'Quick dash', ty: 'NORMAL', c: 'Dodge', e: 'Dash through attacks' },
    { k: 'guard', n: 'Guard', ty: 'NORMAL', c: 'Block', e: 'Halves the next hit' },
  ];
  q('pvAsk').textContent = sp.name.toUpperCase();
  q('pvMGrid').innerHTML = cards.map((c, i) => `<button class="pv-mv" data-k="${c.k}" style="--tc:${TYPE_COL[c.ty] || '#888'}"><span class="mv-n">${esc(c.n)}</span><span class="mv-k">${i + 1}</span>
    <span class="mv-row"><span class="mv-ty">${c.ty === 'NORMAL' ? 'MOVE' : esc(c.ty)}</span><span class="mv-c">${esc(c.c)}</span></span><span class="mv-e">${c.e}</span><i class="mv-cd"></i></button>`).join('');
  q('pvMGrid').querySelectorAll('.pv-mv').forEach(b => { const k = b.dataset.k; let at = 0;
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = true; at = performance.now(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} });
    const up = () => { b.classList.remove('on'); setTimeout(() => { touch[k] = false; }, Math.max(0, 160 - (performance.now() - at))); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault()); });
}
const cdMax = { b: 1, s: 1, d: 1, g: 1 };
function updateMoves(f) {
  const grid = q('pvMGrid'); if (!grid || !f) return;
  const sp = Monstars.SPECIES[f.s], cost = { b: Sim.STYLES[sp.basicStyle].cost, s: Sim.STYLES[sp.specialStyle].cost, d: 0, g: 0 };
  ['b', 's', 'd', 'g'].forEach((k, i) => { const b = grid.children[i]; if (!b) return; const cd = f.cd[k] || 0; cdMax[k] = Math.max(cd, cd > 0 ? cdMax[k] : 0.01);
    const cool = cd > 0.05 || f.en < cost[k]; b.classList.toggle('cool', cool); b.querySelector('.mv-cd').style.width = (cd > 0 ? cd / cdMax[k] * 100 : 0) + '%'; });
}
function hudNames() {
  shownS[0] = shownS[1] = null; stripKey = ['', ''];
  if (!room?.players || room.players.length < 2) return;
  const order = room.local || room.ai ? [0, 1] : [room.you, 1 - room.you];
  buildMoves();
  order.forEach((pi, k) => { const m = room.players[pi].monstar; q('pvN' + k).textContent = Monstars.SPECIES[m.speciesId].name.toUpperCase(); const t = q('pvT' + k); if (!t.classList.contains('cast')) t.textContent = m.type; t.dataset.type = m.type; t.style.setProperty('--tc', TYPE_COL[m.type] || '#888');
    q('pvPic' + k).src = PA.spriteSrc(m.speciesId); q('pvPic' + k).style.filter = `hue-rotate(${m.traits?.hue || 0}deg)`; });
}
function leaveBattle() { if (room?.local) { room = null; local = null; ended = null; snapCur = null; renderRoom(); renderer.idle(); return; } try { sendWs({ t: 'leave' }); } catch {} room = null; ended = null; renderRoom(); }
q('pvLeave').onclick = q('pvExit').onclick = leaveBattle;
// One deposit per match. If the server hasn't seen it on-chain yet, re-check the SAME signature; never send a second transfer.
let pendingDeposit = null, depositRetries = 0;
q('pvDeposit').onclick = e => busy(e.target, async () => {
  if (pendingDeposit && pendingDeposit.code === room?.code) { sendWs({ t: 'deposit', signature: pendingDeposit.sig }); toast('Checking your deposit again…'); return; }
  const sig = await S.deposit(); pendingDeposit = { code: room?.code, sig }; depositRetries = 0;
  sendWs({ t: 'deposit', signature: sig }); toast('Deposit sent. Waiting for confirmation…'); refreshBalance();
});

// Practice and free matches show a pretend 0.01 SOL pot so you can watch SOL move per hit. It is never paid out.
const PRACTICE_STAKE = 5_000_000n;
let vLedger = null;
function practiceMoney() { return !room || room.local || room.ai || room.stake === '0'; }
function resetVirtual() { vLedger = new Stake.StakeLedger(PRACTICE_STAKE); shares = vLedger.shares.map(String); showShares(null); }
const GUEST_KEY = 'pm-guest-exp-v1';
function guestExp() { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}'); } catch { return {}; } }
function saveGuestExp(sid, exp) { try { const g = guestExp(); g[sid] = Math.max(g[sid] || 0, Math.floor(exp)); localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch {} }
function ownedFor(sid) { return mine.find(m => m.serial === picked && m.speciesId === sid) || mine.find(m => m.speciesId === sid); }
function monFor(sid) {
  const own = ownedFor(sid);
  return own ? new Monstars.Monstar({ speciesId: sid, dna: own.dna, serial: own.serial, exp: own.exp, collection: own.collection })
    : new Monstars.Monstar({ speciesId: sid, exp: guestExp()[sid] || 0 });
}
// ---------- 1v1 / 3v3 ----------
let mode = '1v1', teamPick = [];
q('pvMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; q('pvMode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); if (mode === '3v3' && !teamPick.length) teamPick = [pickedSpecies]; renderPicker(); };
function renderTeamPick() {
  const box = q('pvTeamPick'); box.hidden = mode !== '3v3'; if (mode !== '3v3') return;
  box.innerHTML = `<span>Your team (${teamPick.length}/3):</span>` + [0, 1, 2].map(i => teamPick[i] != null ? `<button data-i="${i}" title="Remove"><img src="${PA.spriteSrc(teamPick[i])}" alt="${esc(Monstars.SPECIES[teamPick[i]].name)}"></button>` : '<i>?</i>').join('') + '<small>Tap Monstars below to add. The next one comes in when one faints, or tap its picture in battle to switch.</small>';
  box.querySelectorAll('button').forEach(b => b.onclick = () => { teamPick.splice(+b.dataset.i, 1); renderPicker(); });
}
const usableSpecies = sp => sp.collection === 'genesis' || mine.some(m => m.speciesId === sp.id); // the 50 wild ones and the mythics must be caught first
function renderPicker() {
  const box = q('pvPicker'); if (!box) return; box.innerHTML = ''; renderTeamPick();
  Monstars.SPECIES.filter(usableSpecies).forEach(sp => {
    const own = ownedFor(sp.id), b = el('button', { className: 'pv-pick' + (sp.legendary ? ' legend' : ''), title: sp.name });
    b.setAttribute('aria-pressed', sp.id === pickedSpecies);
    b.innerHTML = `<img class="px" src="${PA.spriteSrc(sp.id)}" alt="${sp.name}" style="filter:hue-rotate(${own?.traits.hue || 0}deg)">`;
    if (mode === '3v3' && teamPick.includes(sp.id)) b.classList.add('inteam');
    b.onclick = () => { pickedSpecies = sp.id; if (own) picked = own.serial;
      if (mode === '3v3' && !teamPick.includes(sp.id)) { if (teamPick.length >= 3) teamPick.shift(); teamPick.push(sp.id); }
      renderPicker(); if (own) refreshMine(); };
    box.append(b);
  });
  const sp = Monstars.SPECIES[pickedSpecies], m = monFor(pickedSpecies), j = m.toJSON();
  q('pvPickInfo').innerHTML = `<b>${esc(m.displayName)}</b> · Lv${j.level} ${esc(j.stage)} · ${sp.cls.label} · ${sp.type}${expBar(j)}A: ${esc(sp.move)} · B: ${esc(sp.special)}<br>${esc(sp.cls.passive)}`;
}
q('pvPractice').onclick = () => startPractice();
let lastPractice = null;
function startPractice(opt = null) {
  lastPractice = opt;
  const own = ownedFor(pickedSpecies);
  const ownTeam = mode === '3v3' ? teamPick.map(ownedFor) : [own];
  if (!opt && S.session() && ownTeam.length === (mode === '3v3' ? 3 : 1) && ownTeam.every(Boolean)) { try { sendWs({ t: 'ai', mode, serial: own?.serial, serials: ownTeam.map(m => m.serial) }); ended = null; fightAt = 0; renderer.reset(); resetVirtual(); } catch (e) { fail(e); } return; }
  if (!usableSpecies(Monstars.SPECIES[pickedSpecies])) pickedSpecies = 0;
  const three = !opt && mode === '3v3';
  if (three && teamPick.length < 3) { toast('Pick three Monstars for your 3v3 team.', true); return; }
  const ids = three ? teamPick.slice() : [pickedSpecies];
  const others = Monstars.SPECIES.filter(x => x.collection === 'genesis' && !ids.includes(x.id)).sort(() => Math.random() - 0.5);
  const team = ids.map(monFor), lvl = () => Math.max(1, team[0].level + Math.floor(Math.random() * 3) - 1);
  const foes = opt?.foeId != null ? [new Monstars.Monstar({ speciesId: opt.foeId, level: opt.foeLevel })] : ids.map((_, i) => new Monstars.Monstar({ speciesId: others[i].id, level: lvl() }));
  local = { m: Sim.createMatch(three ? team : team[0], three ? foes : foes[0], { arena: opt?.arena ?? Math.floor(Math.random() * 4) }), mem: { hard: !!opt?.hard } };
  const a = team[0], b = foes[0], foe = b.species;
  room = { local: true, wild: opt || null, mode: three ? '3v3' : '1v1', state: 'live', you: 0, stake: '0', code: 'AI',
    players: [{ wallet: me || 'You', monstar: a.toJSON(), team: team.map(x => x.toJSON()) }, { wallet: 'AI', monstar: { ...b.toJSON(), name: opt ? 'Wild ' + foe.name : b.toJSON().name }, team: foes.map(x => x.toJSON()) }] };
  ended = null; snapPrev = null; snapCur = Sim.snapshot(local.m); snapAt = performance.now(); renderer.reset(); fightAt = performance.now(); resetVirtual();
  renderRoom(); draw();
}
window.PMStartBattle = startPractice;
window.PMArenaApi = {
  signedIn: () => !!S.session(),
  ownedPick: () => ownedFor(pickedSpecies) || mine[0] || null,
  // paid wild battle run by the server: it picks the wild Monstar, and a win can catch it
  startServerWild(signature, zone) { sendWs({ t: 'wild', serial: (ownedFor(pickedSpecies) || mine[0])?.serial, signature, zone }); ended = null; fightAt = 0; renderer.reset(); resetVirtual(); },
};
setInterval(() => {
  if (!local || room?.state !== 'live' || ended) return;
  const m = local.m;
  m.fighters[0].input = Sim.sanitizeInput(currentInput());
  m.fighters[1].input = Sim.sanitizeInput(Sim.aiInput(m, 1, local.mem));
  const evs = Sim.step(m);
  snapPrev = snapCur; snapCur = Sim.snapshot(m); snapAt = performance.now();
  for (const ev of evs) battleEvent(ev);
  if (m.over) {
    const f0 = m.fighters[0]; saveGuestExp(f0.speciesId, f0.exp);
    if (vLedger) { vLedger.finish(m.winner); shares = vLedger.shares.map(String); showShares(null); }
    ended = { winner: m.winner, reason: m.reason, at: performance.now(), local: true, progress: m.fighters.map(f => ({ gained: f.expGained, level: f.level, stage: Monstars.stageFor(f.level).name, saved: true })) };
    if (room?.wild) window.PMWild?.result(m.winner === 0, room.wild);
    renderRoom(); renderPicker();
  }
}, 1000 / 30);

function openSocket() {
  if (ws && ws.readyState <= 1) return;
  ws = S.connectSocket(onMsg);
  ws.onclose = () => { if (room && room.state === 'live') toast('Connection lost. Reconnecting…', true); setTimeout(() => { if (S.session()) openSocket(); }, 1500); };
}

function onMsg(m) {
  if (m.t === 'error') {
    if (/not found yet/i.test(m.error) && window.PMWild?.retry?.()) return toast('Waiting for Solana to confirm your entry fee…');
    if (/not found yet/i.test(m.error) && pendingDeposit && depositRetries < 10) { depositRetries++; setTimeout(() => sendWs({ t: 'deposit', signature: pendingDeposit.sig }), 3000); return toast('Waiting for Solana to confirm your deposit…'); }
    return toast(m.error, true);
  }
  if (m.t === 'room') { room = m; shares = practiceMoney() ? (vLedger ? vLedger.shares.map(String) : null) : m.shares; renderRoom(); return; }
  if (m.t === 'state') {
    if (room && room.state !== 'live') { room.state = 'live'; fightAt = performance.now(); renderer.reset(); renderRoom(); }
    snapPrev = snapCur; snapCur = m.s; snapAt = performance.now(); setShares(m.shares); return;
  }
  if (m.t === 'hit') { setShares(m.shares, m); return; }
  if (m.t === 'switch') { battleEvent({ ...m, type: 'switch' }); return; }
  if (m.t === 'miss' || m.t === 'level' || m.t === 'bonus') { battleEvent({ ...m, type: m.t }); if (m.t === 'level') refreshSoon(); return; }
  if (m.t === 'end') { if (practiceMoney() && vLedger) { vLedger.finish(m.winner == null ? null : m.winner); shares = vLedger.shares.map(String); showShares(); } ended = { ...m, at: performance.now() }; refreshSoon(); if (room) room.state = room.stake === '0' ? 'done' : 'settling'; renderRoom(); return; }
  if (m.t === 'settlement') { ended = { at: 0, ...(ended || {}), settlement: m }; if (room) room.state = m.ok ? (m.refund ? 'refunded' : 'settled') : 'needs review'; renderRoom(); refreshBalance(); return; }
  if (m.t === 'cancelled') { toast('Match cancelled (' + m.reason + ').' + (room?.players?.some(p => p.deposited) ? ' Deposits are being refunded.' : '')); if (room) room.state = 'cancelled'; renderRoom(); }
  if (m.t === 'left') { room = null; renderRoom(); }
}

let refreshT;
function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(() => { if (S.session()) refreshMine(); }, 1500); }
function battleEvent(ev) {
  if (!snapCur) return;
  if (ev.type === 'level') ev.name = Monstars.SPECIES[snapCur.f[ev.side]?.s ?? room?.players?.[ev.side]?.monstar?.speciesId ?? 0].name.toUpperCase();
  if (ev.type === 'switch') ev.name = Monstars.SPECIES[ev.speciesId].name.toUpperCase();
  if (ev.type === 'hit' && ev.fee == null && room && room.stake !== '0' && ev.feeLamports) ev.fee = sol(ev.feeLamports, 9);
  if (ev.type === 'hit' && practiceMoney() && vLedger && ev.fee == null) { // pretend pot for practice
    const fee = vLedger.hit(ev.attacker, ev.damage, ev.victimMaxHp || snapCur.f[ev.victim]?.max || 100);
    if (fee > 0n) ev.fee = sol(fee, 9); shares = vLedger.shares.map(String); showShares(null);
  }
  renderer.event(ev, snapCur);
}
// Move-name callouts like "Ember volley!" when a Monstar uses a power
const lastCast = [9, 9];
function callouts() {
  if (!snapCur || !room?.players) return;
  snapCur.f.forEach((f, i) => {
    if (f.ct < lastCast[i] && f.ct < 0.3 && f.ck) {
      const sp = Monstars.SPECIES[f.s], side = i === room.you ? 0 : 1, pill = q('pvT' + side);
      pill.textContent = (f.ck === 'special' ? sp.special : sp.move).toUpperCase(); pill.classList.add('cast'); clearTimeout(pill._t);
      pill._t = setTimeout(() => { pill.classList.remove('cast'); pill.textContent = pill.dataset.type || ''; }, 1300);
    }
    lastCast[i] = f.ct;
  });
}
function setShares(next, hit) {
  if (!room) return;
  if (practiceMoney()) { if (hit && snapCur) battleEvent({ type: 'hit', attacker: hit.attacker, victim: 1 - hit.attacker, victimMaxHp: hit.victimMaxHp, damage: hit.damage, eff: hit.eff, crit: hit.crit, exp: hit.exp, style: hit.style }); return; }
  if (!next) return;
  shares = next; showShares(hit);
  if (hit && snapCur) battleEvent({ type: 'hit', attacker: hit.attacker, victim: 1 - hit.attacker, victimMaxHp: hit.victimMaxHp, damage: hit.damage, eff: hit.eff, crit: hit.crit, exp: hit.exp, style: hit.style, fee: BigInt(hit.fee) > 0n ? sol(hit.fee, 9) : null });
}

let shownShares = null;
function showShares() {
  if (!shares || !room) return;
  const you = room.local ? 0 : room.you, pretend = practiceMoney(), next = shares, prev = shownShares; shownShares = next.slice();
  const start = pretend ? PRACTICE_STAKE : BigInt(room.stake || 0);
  for (const side of [0, 1]) {
    const idx = side === 0 ? you : 1 - you, span = q('pvS' + side), d = BigInt(next[idx]) - start;
    span.textContent = sol(next[idx], 6) + ' SOL';
    q('pvSD' + side).textContent = d === 0n ? (pretend ? 'practice' : 'paid at end') : (d > 0n ? '+' : '−') + sol(d < 0n ? -d : d, 6);
    q('pvSD' + side).className = d > 0n ? 'up' : d < 0n ? 'dn' : '';
    if (prev && BigInt(prev[idx]) !== BigInt(next[idx])) { span.classList.remove('flash-up', 'flash-down'); void span.offsetWidth; span.classList.add(BigInt(next[idx]) > BigInt(prev[idx]) ? 'flash-up' : 'flash-down'); }
  }
  const pot = BigInt(next[0]) + BigInt(next[1]);
  q('pvPotMid').textContent = `${pretend ? 'PRACTICE ' : ''}POT ${sol(pot, 4)} SOL`;
  if (pot > 0n) { const p = Number(BigInt(next[you]) * 1000n / pot) / 10; q('pvP0').style.width = q('pvPB0').style.width = p + '%'; q('pvP1').style.width = q('pvPB1').style.width = (100 - p) + '%'; q('pvPotTxt').textContent = `Your share ${p.toFixed(1)}% of ${sol(pot, 4)} SOL${pretend ? ' (practice, not real SOL)' : ', paid when the match ends'}`; }
}
function renderRoom() {
  q('pvRoom').hidden = !room; q('pvLobby').hidden = !!room && !['cancelled', 'settled', 'done', 'refunded'].includes(room.state);
  const live = room?.state === 'live' || (room && ended);
  const fainting = ended && performance.now() - (ended.at || 0) < 1800;
  if (fainting) setTimeout(renderRoom, 1850 - (performance.now() - ended.at));
  const stay = !!(room?.wild && ended && !fainting); // wild runs stay full screen until you choose what's next
  const stage = q('pvStage'), full = !!room && room.state === 'live' && (!ended || fainting) || (!!ended && fainting) || stay;
  stage.classList.toggle('live', !!full);
  document.documentElement.classList.toggle('pv-battling', !!full);
  if (full && stage.parentElement !== document.body) { stageHome ??= stage.parentElement; stageNext = stage.nextSibling; document.body.append(stage); }
  else if (!full && stageHome && stage.parentElement === document.body) stageHome.insertBefore(stage, stageNext);
  q('pvHud').hidden = !full; q('pvMoves').hidden = !full || stay; q('pvPot').hidden = !full;
  if (full) { if (!shares || (practiceMoney() && !vLedger)) resetVirtual(); showShares(); }
  if (room?.local || room?.ai) {
    q('pvRoom').hidden = true; q('pvLobby').hidden = false;
    const ov = q('pvOverlay'), btns = q('pvOvBtns'); ov.hidden = !!full && !stay; btns.innerHTML = '';
    hudNames();
    if (!ended && !full) { q('pvBig').textContent = 'Get ready!'; q('pvSmall').textContent = `${room.players[0].monstar.name} vs ${room.players[1]?.monstar.name || '…'}`; }
    if (ended && (!full || stay)) {
      const pr = ended.progress?.[0];
      q('pvBig').textContent = ended.winner == null ? 'Draw' : ended.winner === 0 ? 'Victory!' : 'Defeated';
      q('pvSmall').innerHTML = `${ended.reason === 'ko' ? 'KO' : ended.reason === 'time' ? 'Time up' : 'Forfeit'} · practice vs ${esc(room.players[1].monstar.name)}`
        + (pr ? `<br><b>+${pr.gained} EXP</b> · now Lv${pr.level} ${esc(pr.stage)} · ${room.local ? 'saved on this device' : 'saved to your Monstar'}` : '')
        + (shares ? `<br>Practice pot: you finished with <b>${sol(shares[0], 6)} SOL</b> (pretend SOL, stake a real match to win it)` : '');
      const won = ended.winner === 0;
      if (room.wild) { const w = window.PMWild, c = ended.caught, wsp = Monstars.SPECIES[room.wild.speciesId ?? room.wild.foeId];
        q('pvBig').textContent = c?.ok ? 'Caught!' : won ? 'Victory!' : 'Defeated';
        const line = c ? (c.ok ? `<b>You caught ${esc(wsp.name)}!</b> It hatched as an Infant and joined your ${wsp.mythic ? 'Mythic' : 'Frontier'} collection.`
            : won ? `${esc(wsp.name)} got away (${Math.round(c.chance * 100)}% catch chance for ${esc(c.tier)}).` : `${esc(wsp.name)} was too strong this time.`)
          : `Practice run. <b>Sign in and pay ${esc(w.feeSol())} SOL</b> to enter the wild for real and catch what you beat.`;
        q('pvSmall').innerHTML += '<br>' + line;
        const nx = el('button', { className: 'primary', textContent: 'Next wild encounter' }); nx.onclick = () => { room = null; local = null; ended = null; snapCur = null; renderRoom(); w.next(); };
        const mp = el('button', { className: 'smallbtn', textContent: 'Expedition map' }); mp.onclick = () => { room = null; local = null; ended = null; snapCur = null; renderRoom(); w.map(); };
        btns.append(nx, mp); if (!ended._rec) { ended._rec = 1; w.record(won, c); if (c?.ok) refreshMine(); } return; }
      const again = el('button', { className: 'primary', textContent: 'Rematch' }); again.onclick = () => startPractice();
      const back = el('button', { className: 'smallbtn', textContent: 'Change Monstar' }); back.onclick = () => { room = null; local = null; ended = null; snapCur = null; renderRoom(); renderer.idle(); };
      btns.append(again, back);
    }
    return;
  }
  if (!room) { q('pvOverlay').hidden = false; q('pvBig').textContent = 'Ready to battle'; q('pvSmall').textContent = 'Pick a Monstar and tap Practice vs AI, or sign in with Phantom to battle a rival for SOL.'; q('pvOvBtns').innerHTML = ''; return; }
  q('pvCode').textContent = room.code; q('pvRoomState').textContent = room.state;
  q('pvPlayers').innerHTML = [0, 1].map(i => { const p = room.players[i]; return p ? `<div class="pv-player"><b>${esc(p.monstar.name)}</b><small>${i === room.you ? 'You' : 'Rival'} · ${short(p.wallet)}</small><small>${esc(p.monstar.className)} · ${esc(p.monstar.type)}</small>${room.stake !== '0' ? `<span class="pv-chip ${p.deposited ? 'ok' : ''}">${p.deposited ? 'Deposited' : 'Deposit pending'}</span>` : ''}</div>` : '<div class="pv-player"><b>Waiting…</b><small>Share the code</small></div>'; }).join('');
  const myP = room.players[room.you];
  q('pvDeposit').hidden = !(room.state === 'deposit' && myP && !myP.deposited);
  q('pvDeposit').textContent = pendingDeposit?.code === room.code ? 'Check my deposit' : `Deposit ${sol(room.stake, 6)} SOL`;
  q('pvEscrow').innerHTML = room.escrow ? `Escrow: <span class="pv-addr">${esc(room.escrow)}</span>` : 'Free match: no escrow.';
  hudNames();
  const ov = q('pvOverlay'), big = q('pvBig'), small = q('pvSmall'), btns = q('pvOvBtns'); btns.innerHTML = '';
  ov.hidden = !!full;
  if (ended) {
    const won = ended.winner === room.you, draw = ended.winner == null;
    big.textContent = draw ? 'Draw' : won ? 'Victory' : 'Defeated';
    const st = ended.settlement, pr = ended.progress?.[room.you];
    const expLine = pr ? `<br><b>+${pr.gained} EXP</b> · now Lv${pr.level} ${esc(pr.stage)}` : '';
    small.innerHTML = expLine.replace('<br>', '') + (expLine ? '<br>' : '') + (room.stake === '0' ? `${ended.reason === 'ko' ? 'KO' : ended.reason === 'time' ? 'Time up' : 'Forfeit'} · free match`
      : st ? (st.ok ? `Paid out on-chain: you receive <b>${sol(st.payouts[room.you], 9)} SOL</b>. Company fee ${st.company} lamport. <a href="${esc(S.explorer(st.signature))}" target="_blank" rel="noopener">View transaction</a>` : `Settlement needs review: ${esc(st.error || st.signature || '')}`)
      : `${draw ? 'Each keeps their share.' : won ? 'You take the pot: ' + sol(ended.shares[room.you], 6) + ' SOL.' : 'Your rival takes the pot.'} Paying out on Solana…`);
    const again = el('button', { className: 'primary', textContent: 'New match' }); again.onclick = () => { room = null; ended = null; snapCur = null; renderRoom(); renderer.idle(); };
    btns.append(again);
  } else if (room.state === 'waiting') { big.textContent = room.code; small.textContent = 'Waiting for your rival to join with this code.'; }
  else if (room.state === 'deposit') { big.textContent = 'Deposits'; small.textContent = `Both players deposit ${sol(room.stake, 6)} SOL into the match escrow. The duel starts when both confirm.`; }
  else if (room.state === 'countdown') { big.textContent = String(room.countdown || 'GO'); small.textContent = 'Get ready!'; }
  else if (room.state === 'cancelled') { big.textContent = 'Cancelled'; small.textContent = 'Any deposits are refunded minus the 0.000005 SOL network fee.'; }
}

// ---------- input ----------
const keys = {}, touch = { mx: 0, my: 0, atk: false, sp: false, dash: false, guard: false, sw: -1 }; let mouse = null, mouseBtn = { l: false, r: false };
addEventListener('keydown', e => { if (room?.state !== 'live') return; if (e.code === 'Escape') return leaveBattle(); keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const cv = q('pvCanvas');
const renderer = PA.createRenderer(cv, ARENA);
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) / r.width * ARENA.w, y: (e.clientY - r.top) / r.height * ARENA.h, at: performance.now() }; });
cv.addEventListener('mousedown', e => { if (e.button === 2) mouseBtn.r = true; else mouseBtn.l = true; });
addEventListener('mouseup', e => { if (e.button === 2) mouseBtn.r = false; else mouseBtn.l = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
const zone = q('pvZone'), stick = q('pvStick'), knob = q('pvKnob'); let stickId = null, origin = null;
zone.addEventListener('pointerdown', e => { stickId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch {} const r = zone.getBoundingClientRect(); origin = { x: e.clientX, y: e.clientY }; stick.style.display = 'block'; stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px'; });
zone.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; let dx = e.clientX - origin.x, dy = e.clientY - origin.y; const d = Math.hypot(dx, dy), R = 50; if (d > R) { dx *= R / d; dy *= R / d; } touch.mx = dx / R; touch.my = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; });
const endStick = e => { if (e.pointerId !== stickId) return; stickId = null; touch.mx = touch.my = 0; stick.style.display = 'none'; knob.style.transform = ''; };
zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);

let lastSent = '', lastSendAt = 0;
function currentInput() {
  if (!snapCur) return {};
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (Math.abs(touch.mx) > 0.12 || Math.abs(touch.my) > 0.12) { mx = touch.mx; my = touch.my; }
  const meF = snapCur.f[room.you];
  let ax = 0, ay = 0; // 0 = the Monstar aims at its rival on its own
  if (mouse && !coarse && performance.now() - (mouse.at || 0) < 1500) { ax = mouse.x - meF.x; ay = mouse.y - meF.y; }
  const swKey = keys.Digit5 ? 0 : keys.Digit6 ? 1 : keys.Digit7 ? 2 : -1;
  const i = { sw: touch.sw >= 0 ? touch.sw : swKey, mx, my, ax, ay, atk: !!(keys.KeyJ || keys.Digit1 || mouseBtn.l || touch.atk), sp: !!(keys.KeyK || keys.Digit2 || mouseBtn.r || touch.sp), dash: !!(keys.Space || keys.Digit3 || touch.dash), guard: !!(keys.KeyL || keys.Digit4 || touch.guard) };
  return i;
}
function sendInput() {
  if (room?.local || room?.state !== 'live' || !ws || ws.readyState !== 1 || !snapCur) return;
  const i = currentInput(), s = JSON.stringify(i), now = performance.now();
  if (s !== lastSent || now - lastSendAt > 200) { ws.send(JSON.stringify({ t: 'input', i })); lastSent = s; lastSendAt = now; }
}
setInterval(sendInput, 50);

// ---------- 3v3: active Monstar names and the team strip (tap your own to switch) ----------
const shownS = [null, null];
function activeHud(you) {
  [you, 1 - you].forEach((idx, k) => { const f = snapCur.f[idx]; if (!f || shownS[k] === f.s) return; shownS[k] = f.s;
    const sp = Monstars.SPECIES[f.s], hue = room.players[idx]?.team?.find(x => x.speciesId === f.s)?.traits?.hue || 0;
    q('pvN' + k).textContent = sp.name.toUpperCase(); q('pvPic' + k).src = PA.spriteSrc(f.s); q('pvPic' + k).style.filter = `hue-rotate(${hue}deg)`;
    const t = q('pvT' + k); t.dataset.type = sp.type; if (!t.classList.contains('cast')) t.textContent = sp.type; t.style.setProperty('--tc', TYPE_COL[sp.type] || '#888'); });
  buildMoves(snapCur.f[you].s, snapCur.f[1 - you].s);
}
let stripKey = ['', ''];
function teamStrips(you) {
  const tm = snapCur.tm;
  [you, 1 - you].forEach((idx, k) => { const box = q('pvTm' + k); if (!tm) { if (box.firstChild) box.innerHTML = ''; stripKey[k] = ''; return; }
    const list = tm[idx], cur = snapCur.sl?.[idx] ?? 0, key = list.map((x, i) => x.s + ':' + Math.ceil(x.hp / x.mx * 20) + (i === cur ? '*' : '')).join('|') + (snapCur.sc?.[idx] > 0 ? 'c' : '');
    if (key === stripKey[k]) return; stripKey[k] = key;
    box.innerHTML = list.map((x, i) => `<button class="tm${i === cur ? ' on' : ''}${x.hp <= 0 ? ' out' : ''}" data-i="${i}" ${k || x.hp <= 0 || i === cur ? 'disabled' : ''} title="${esc(Monstars.SPECIES[x.s].name)} · ${Math.ceil(x.hp)}/${x.mx}">
      <img src="${PA.spriteSrc(x.s)}" alt=""><i style="width:${Math.max(0, x.hp / x.mx * 100)}%"></i></button>`).join('');
    if (!k) box.querySelectorAll('button:not([disabled])').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); touch.sw = +b.dataset.i; setTimeout(() => { touch.sw = -1; }, 250); }));
  });
}
// ---------- render (pixel arena) ----------
function hpColor(p) { return p > 0.5 ? '#58d858' : p > 0.2 ? '#f8c838' : '#f85838'; }
function draw() {
  const now = performance.now();
  if (snapCur && room?.players?.length === 2) {
    const t = Math.min(1, (now - snapAt) / (room.local ? 34 : 66)), you = room.you;
    const faint = [0, 0];
    if (ended && ended.winner != null) faint[1 - ended.winner] = Math.min(1, (now - (ended.at || now)) / 1200);
    renderer.draw(snapPrev, snapCur, t, { you, snapAt, hues: room.players.map(p => p.monstar.traits?.hue || 0), types: room.players.map(p => p.monstar.type), faint, fight: fightAt ? Math.max(0, 1.4 - (now - fightAt) / 1000) : 0 });
    const meF = snapCur.f[you], foe = snapCur.f[1 - you];
    for (const [k, f] of [[0, meF], [1, foe]]) {
      const p = Math.max(0, f.hp / f.max), bar = q('pvH' + k);
      bar.style.width = (p * 100) + '%'; bar.style.background = hpColor(p);
      q('pvX' + k).style.width = Math.min(100, f.xi / Math.max(1, f.xn) * 100) + '%';
      q('pvL' + k).textContent = `Lv${f.lv}`; q('pvL' + k).title = Monstars.STAGES[f.sg]?.name || '';
      q('pvHN' + k).textContent = `${Math.ceil(Math.max(0, f.hp))}/${f.max}`;
    }
    const left = Math.max(0, Math.ceil(ARENA.roundSeconds - snapCur.t));
    q('pvClock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    callouts();
    updateMoves(meF); activeHud(you); teamStrips(you);
  } else renderer.idle();
  if (!pvp.classList.contains('hidden') || q('pvStage').classList.contains('live')) requestAnimationFrame(draw);
}

// ---------- breeding ----------
let breed = null, breedPoll = null;
function renderBreedPick() {
  const sel = q('pvBreedPick'); if (!sel) return; const cur = sel.value;
  sel.innerHTML = mine.length ? mine.map(m => `<option value="${m.serial}">${esc(m.name)} · Lv${m.level} ${esc(m.stage)} · ${esc(m.traits.rarity)}</option>`).join('') : '<option value="">Sign in to choose a Monstar</option>';
  if (cur) sel.value = cur;
}
function renderBreed() {
  const box = q('pvBreedBox'); if (!breed) { box.innerHTML = ''; return; }
  const me2 = breed.you === 'a' ? 0 : 1, par = breed.parents, kids = breed.children;
  const card = m => m ? `<div class="pv-mini"><img class="px" src="${PA.spriteSrc(m.speciesId)}" style="filter:hue-rotate(${m.traits.hue}deg)" alt=""><span><b>${esc(m.name)}</b><br>Lv${m.level} ${esc(m.stage)} · ${esc(m.traits.rarity)}</span></div>` : '<div class="pv-mini empty">Waiting for a partner…</div>';
  let html = `<div class="pv-breed-code">Code <b>${esc(breed.code)}</b></div><div class="pv-breed-row">${card(par[0])}<span class="pv-heart">+</span>${card(par[1])}</div>`;
  if (breed.state === 'open') html += '<p>Send this code to the other player. They join with one of their Monstars.</p>';
  if (breed.state === 'fees') html += `<p>Both players pay the ${esc(breed.feeSol)} SOL fee. Paid: ${breed.paid[0] ? '✓' : '…'} / ${breed.paid[1] ? '✓' : '…'}</p>` + (breed.paid[me2] ? '' : `<button class="primary wide" id="pvBreedPay">Pay ${esc(breed.feeSol)} SOL in Phantom</button>`);
  if (breed.state === 'hatched') html += `<p><b>Hatched!</b> Each player got a new Infant:</p><div class="pv-breed-row">${card(kids[0])}${card(kids[1])}</div>`;
  box.innerHTML = html;
  const pay = q('pvBreedPay'); if (pay) pay.onclick = () => busy(pay, async () => { breed = await S.breedPay(breed.code); renderBreed(); if (breed.state === 'hatched') { toast('Your new Infant hatched!'); refreshMine(); } });
}
function watchBreed() { clearInterval(breedPoll); breedPoll = setInterval(async () => { if (!breed || breed.state === 'hatched') return clearInterval(breedPoll); try { const prev = breed.state; breed = await S.breedStatus(breed.code); renderBreed(); if (breed.state === 'hatched' && prev !== 'hatched') { toast('Your new Infant hatched!'); refreshMine(); } } catch {} }, 4000); }
q('pvBreedNew').onclick = e => busy(e.target, async () => { if (!S.session()) throw Error('Sign in with Phantom first.'); breed = await S.breedCreate(Number(q('pvBreedPick').value)); renderBreed(); watchBreed(); });
q('pvBreedJoin').onclick = e => busy(e.target, async () => { if (!S.session()) throw Error('Sign in with Phantom first.'); breed = await S.breedJoin(q('pvBreedCode').value.trim().toUpperCase(), Number(q('pvBreedPick').value)); renderBreed(); watchBreed(); });

// ---------- marketplace ----------
async function refreshMarket() {
  const box = q('pvListings');
  try {
    const ls = await S.listings();
    box.innerHTML = ls.length ? '' : '<div class="pv-empty">No Monstars for sale yet. Mint one and list it.</div>';
    cfg ??= await S.getConfig().catch(() => ({ royaltyBps: 500 }));
    for (const l of ls) {
      if (!l.monstar) continue;
      const c = el('div', { className: 'pv-card pv-listing' }), price = BigInt(l.price), roy = price * BigInt(cfg.royaltyBps) / 10000n;
      const isMine = me && l.seller === me;
      c.innerHTML = cardHtml(l.monstar, `<span class="price">${sol(price, 6)} SOL</span><span class="pv-split">Royalty ${cfg.royaltyBps / 100}% (${sol(roy, 6)}) → ${short(l.monstar.originOwner)} · fee 1 lamport</span><div class="acts"><button class="primary">${isMine ? 'Cancel listing' : 'Buy'}</button></div>`);
      const b = c.querySelector('button');
      b.onclick = () => busy(b, async () => {
        if (!S.session()) throw Error('Sign in on the 1v1 Stake tab first.');
        if (isMine) { await S.cancelListing(l.id); toast('Listing cancelled.'); }
        else { const r = await S.buy(l.id); toast(`Bought ${l.monstar.name}. Seller got ${sol(r.split.seller, 6)} SOL, origin owner ${sol(r.split.royalty, 6)} SOL.`); refreshMine(); }
        refreshMarket();
      });
      box.append(c);
    }
  } catch (e) { box.innerHTML = '<div class="pv-empty">Marketplace unavailable. Start the game server (npm start).</div>'; }
  renderMineMarket();
}
function renderMineMarket() {
  const box = q('pvMine'); if (!box) return;
  const minted = mine.filter(m => m.asset);
  if (!S.session()) { box.innerHTML = '<div class="pv-empty">Sign in on the 1v1 Stake tab to see your Monstars.</div>'; return; }
  box.innerHTML = minted.length ? '' : '<div class="pv-empty">None minted yet. Mint from the 1v1 Stake tab.</div>';
  for (const m of minted) {
    const c = el('div', { className: 'pv-card' });
    c.innerHTML = cardHtml(m, `<input class="pv-input" placeholder="Price in SOL" inputmode="decimal" data-f="price"><div class="acts"><button class="primary" data-a="list">List</button></div>
      <input class="pv-input" placeholder="Send to wallet address" data-f="to"><div class="acts"><button class="smallbtn" data-a="send">Send</button></div>`);
    const lb = c.querySelector('[data-a=list]'), sb = c.querySelector('[data-a=send]');
    lb.onclick = () => busy(lb, async () => { const p = c.querySelector('[data-f=price]').value.trim(); if (!p) throw Error('Enter a price.'); await S.list(m, p); toast(m.name + ' listed for ' + p + ' SOL.'); refreshMarket(); });
    sb.onclick = () => busy(sb, async () => { const to = c.querySelector('[data-f=to]').value.trim(); if (!to) throw Error('Enter a wallet address.'); if (!window.PMChain?.gift) throw Error('Transfer tool not loaded.');
      await window.PMChain.gift(m.asset, to); await S.syncOwner(m.serial); toast(m.name + ' sent to ' + short(to) + '.'); refreshMine(); });
    box.append(c);
  }
}
q('pvMkRefresh').onclick = refreshMarket;

// boot
renderRoom(); PA.onReady(() => { renderPicker(); renderer.idle(); });
renderPicker();
// Adventure tab: hide the team strip and show its attack buttons only while a run is active.
setInterval(() => { try { document.body.classList.toggle('pm-active', !!active); } catch {} }, 250);
// Pixel sprites for the Adventure tab too (same look as the Arena).
try {
  const baseMon = mon;
  mon = function (c, id, x, y, scale = 3, t = 0, flip = false) {
    let hue = 0; try { hue = identity(id).hue * 0.4; } catch {}
    const spr = PA.sprite(id, Math.round(hue)); if (!spr) return baseMon(c, id, x, y, scale, t, flip);
    const k = Math.max(1, Math.round(scale * 0.9)), w = spr.width * k, h = spr.height * k, bottom = y + scale * 12, bob = (Math.floor(t * 2.6) % 2) ? -k : 0;
    c.save(); c.imageSmoothingEnabled = false; c.globalAlpha *= 0.25; c.fillStyle = '#081b16'; c.beginPath(); c.ellipse(x, bottom, w * 0.3, Math.max(3, scale * 2), 0, 0, Math.PI * 2); c.fill(); c.globalAlpha /= 0.25;
    c.translate(Math.round(x), Math.round(bottom + bob)); if (flip) c.scale(-1, 1); c.drawImage(spr, -Math.round(w / 2), -h, w, h); c.restore();
  };
} catch {}
if (!location.hash || location.hash === '#arena') tab('pvp');
if (S.session()) afterSignIn();
window.phantom?.solana?.on?.('accountChanged', () => { if (!S.session()) { me = null; mine = []; q('pvWallet').textContent = 'Wallet changed. Sign in again.'; q('pvSignIn').textContent = 'Connect Phantom & sign in'; } });
})();
