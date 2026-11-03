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
      <div class="hb-sol"><span class="pv-sol" id="pvS0">0 SOL</span><small id="pvSD0"></small></div><div class="hb-tm" id="pvTm0"></div><div class="hb-st" id="pvSt0"></div></div></div>
    <div class="hb-mid"><div class="hb-clock" id="pvClock">1:30</div><div class="hb-pot" id="pvPotMid">POT 0.01 SOL</div><div class="hb-potbar"><i id="pvPB0"></i><i id="pvPB1"></i></div></div>
    <div class="hb r"><img class="hb-pic" id="pvPic1" alt=""><div class="hb-main">
      <div class="hb-top"><b id="pvN1">RIVAL</b><span class="hb-lv" id="pvL1">Lv1</span><span class="hb-type" id="pvT1"></span></div>
      <div class="hb-hp"><em>HP</em><div class="hb-bar"><i id="pvH1"></i></div><span id="pvHN1"></span></div>
      <div class="hb-xp"><em>EXP</em><div class="hb-bar xp"><i id="pvX1"></i></div></div>
      <div class="hb-sol"><span class="pv-sol" id="pvS1">0 SOL</span><small id="pvSD1"></small></div><div class="hb-tm" id="pvTm1"></div><div class="hb-st" id="pvSt1"></div></div></div>
   </div>
   <div class="pv-field" id="pvField">
    <canvas id="pvCanvas" width="960" height="540" aria-label="Battle arena"></canvas>
    <div class="pv-pot" id="pvPot" hidden><div class="pv-potbar"><i id="pvP0" style="width:50%"></i><i id="pvP1" style="width:50%"></i></div><small id="pvPotTxt">Pot</small></div>
    <div class="pv-touch"><div class="pv-stickzone" id="pvZone"></div></div>
    <button class="pv-capture" id="pvCapture" hidden>Capture!</button>
   </div>
   <div class="pv-moves" id="pvMoves" hidden>
    <div class="pv-ask"><span>What will <b id="pvAsk">YOUR MONSTAR</b> do?</span><button class="pv-run" id="pvExit" hidden>Catch</button></div>
    <div class="pv-mgrid" id="pvMGrid"></div>
   </div>
   <div class="pv-overlay" id="pvOverlay"><div class="big" id="pvBig">Ready to battle</div><div class="pv-note" id="pvSmall">Sign in with Phantom, pick your Monstar and create or join a match.</div><div class="pv-row" id="pvOvBtns"></div></div>
  </div>
  <div class="panel pv-walletbar"><h3>Sign in</h3>
   <div id="pvWallet" class="pv-note" style="margin:8px 0">Not signed in. Practice is free with no sign-in.</div>
   <form class="pv-acct" id="pvAcct" autocomplete="on" onsubmit="return false">
    <div class="pv-note" style="margin-bottom:6px"><b>Play online free</b> with a username and password (no wallet needed).</div>
    <div class="pv-row" style="flex-wrap:nowrap"><input class="pv-input" id="pvUser" name="username" placeholder="Username" autocomplete="username" maxlength="20" autocapitalize="none" style="flex:1;min-width:0">
    <input class="pv-input" id="pvPass" name="password" type="password" placeholder="Password (8+)" autocomplete="current-password" maxlength="200" style="flex:1;min-width:0"></div>
    <div class="pv-row" style="margin-top:8px"><button class="primary" id="pvSignUp" type="button">Sign up free</button><button class="smallbtn" id="pvLogIn" type="button">Log in</button></div>
   </form>
   <div class="pv-or"><span>or play for SOL</span></div>
   <button class="primary wide" id="pvSignIn">Connect Phantom &amp; sign in</button>
   <p class="pv-note" id="pvPhantomHint" style="margin-top:8px">Phantom sign-in only signs a message. It never moves funds. Phantom players can stake SOL, buy the Superhero Drop and mint NFTs.</p>
   <button class="smallbtn" id="pvSignOut" hidden style="margin-top:8px">Sign out</button></div>
  <p class="pv-note" id="pvKeys">${coarse ? 'Your Monstar moves on its own. Touch the arena with your index finger to run it there (it follows your finger); swipe fast or double-tap to dodge-dash that way. Use your thumb on the move cards.' : 'Your Monstar moves and dodges on its own. <b>Click or hold the mouse</b> on the arena to move it there. Hit with the keyboard: <b>1</b>–<b>5</b> (or <b>Q</b>/<b>J</b> attack · <b>E</b>/<b>K</b> special · <b>Space</b> dash · <b>L</b> guard · <b>R</b> Mega Shot), <b>6</b>–<b>8</b> switch · <b>WASD</b> also steers · <b>Esc</b> to run.'}</p>
  <div class="panel" id="pvBreed"><div class="pv-row" style="justify-content:space-between"><h3>Breed Monstars</h3><span class="pv-chip" id="pvBreedFee">0.01 SOL each</span></div>
   <p class="pv-note" style="margin:6px 0 12px">Pair one of your Monstars with another player's. Each of you gets a new Infant. Its stats mix both parents with a random twist, so it can come out stronger or weaker. Each player pays a 0.01 SOL fee to PocketMonstars.</p>
   <div class="pv-row"><select class="pv-input" id="pvBreedPick" style="flex:1;min-width:0" aria-label="Your Monstar to breed"></select><button class="primary" id="pvBreedNew">Start</button></div>
   <div class="pv-row" style="margin-top:8px;flex-wrap:nowrap"><input class="pv-input" id="pvBreedCode" placeholder="Breeding code" maxlength="5" autocapitalize="characters" style="text-transform:uppercase"><button class="smallbtn" id="pvBreedJoin">Join</button></div>
   <div id="pvBreedBox" class="pv-note" style="margin-top:12px"></div></div>
 </div>
 <div class="pv-col">
  <div class="panel" id="pvLobby"><h3>Choose your Monstar</h3>
   <div class="pv-presets pv-mode" id="pvMode" role="group" aria-label="Battle size"><button data-m="1v1" aria-pressed="true">1v1</button><button data-m="3v3" aria-pressed="false">3v3 tag team</button><button data-m="squad" aria-pressed="false">3v3 squad</button></div>
   <p class="pv-note" id="pvModeNote" style="margin:6px 0 10px">One Monstar each. Pick 3v3 tag team (one at a time, swap in) or 3v3 squad (all six fight at once).</p>
   <div class="pv-team" id="pvTeamPick" hidden></div>
   <div class="pv-picker" id="pvPicker" role="group" aria-label="Choose your Monstar"></div>
   <p class="pv-note" id="pvPickInfo" style="margin:8px 0 12px"></p>
   <div class="pv-presets pv-cpu" id="pvCpu" role="group" aria-label="Computer difficulty"><button data-l="easy" aria-pressed="false">Easy</button><button data-l="normal" aria-pressed="true">Normal</button><button data-l="hard" aria-pressed="false">Hard</button></div>
   <button class="primary wide" id="pvPractice">Quick battle vs CPU</button>
   <p class="pv-note" style="margin:6px 0 16px">Free, no wallet needed.</p>
   <h3>Battle a real rival</h3>
   <label class="fieldlabel" for="pvStake" style="display:block;margin:10px 0 6px">Stake per player (SOL)</label>
   <div class="pv-presets" id="pvPresets"><button data-v="0.001" aria-pressed="true">0.001</button><button data-v="0.002">0.002</button><button data-v="0.005">0.005</button><button data-v="0.01">0.01</button></div>
   <input class="pv-input" id="pvStake" inputmode="decimal" value="0.001" style="margin-top:8px">
   <p class="pv-note" id="pvStakeNote" style="margin:8px 0"></p>
   <button class="primary wide" id="pvCreate">Create match</button>
   <div class="pv-row" style="margin-top:12px;flex-wrap:nowrap"><input class="pv-input" id="pvJoinCode" placeholder="Match code" maxlength="6" autocapitalize="characters" style="text-transform:uppercase"><button class="smallbtn" id="pvJoin">Join</button></div>
   <div class="pv-immortal"><h3>⚔ Immortal Combat 1v1</h3>
    <p class="pv-note">No SOL stake: your Monstar is the prize. <b>The winner takes the loser's Monstar.</b> The loser then has 24 hours to buy it back for the winner's soul fee (0.1 to 0.5 SOL, or a dollar price by card). If they can't, it's gone for good. (The winner gets 95% of the soul fee; PocketMonstars keeps 5%.) Phantom players sign before the fight (minted NFTs move into a match escrow), so the winner always gets the Monstar.</p>
    <button class="primary wide pv-imm-btn" id="pvImmortal">Create Immortal Combat</button>
    <p class="pv-note" style="margin-top:6px">To join one, enter its code above and tap Join.</p></div>
   <div id="pvSouls"></div></div>
  <div class="panel" id="pvRoom" hidden><div class="pv-row" style="justify-content:space-between"><h3>Match</h3><span class="pv-chip" id="pvRoomState">waiting</span></div>
   <div class="pv-code" id="pvCode">——</div><p class="pv-note">Send this code to your rival.</p>
   <div class="pv-players" id="pvPlayers" style="margin:10px 0"></div>
   <button class="primary wide" id="pvDeposit" hidden>Deposit stake</button>
   <p class="pv-note" id="pvEscrow"></p>
   <button class="smallbtn wide" id="pvLeave" style="margin-top:8px">Leave match</button></div>
  <div class="panel" id="pvMoney"><h3>How the money moves</h3><p class="pv-note" style="margin-top:8px">
   • Smallest unit: <b>1 lamport</b> = 0.000000001 SOL. Every hit moves at least 1 lamport.<br>
   • Hit fee = stake × damage ÷ rival max HP, taken from the victim's share and added to yours, live.<br>
   • KO = winner takes the full pot. Time out = higher HP wins it all. Exact tie = each keeps their share.<br>
   • One settlement transaction pays out. Company fee: <b>1 lamport</b> per match. Network fee: 0.000005 SOL, paid from the pot.<br>
   • Referrals: whoever invited the winner gets 5% of what the winner won.<br>
   • NFT market: on every sale, 5% goes to the wallet the Monstar was born to and 5% to PocketMonstars. The seller gets the rest.<br>
   • Superhero Drop: 1 SOL (top 5) or 0.5 SOL, paid to PocketMonstars.<br>
   • Your Phantom balance updates once that settlement confirms (a few seconds).</p></div>
 </div>
</div>`;
main.insertBefore(pvp, q('play').nextSibling);

// Marketplace block at the top of the existing NFT Market tab
const marketSec = q('market');
const mk = el('div', { id: 'pvMarket' });
mk.innerHTML = `<div class="topline"><div><div class="eyebrow">Buy · Sell · Send</div><h1>Monstar Market</h1>
<p class="muted">Every resale pays a 5% royalty to the wallet the Monstar was born to, forever, and a 5% fee to PocketMonstars.</p></div><button class="smallbtn" id="pvMkRefresh">Refresh</button></div>
<div class="panel" style="margin-bottom:16px"><h3>For sale</h3><div class="pv-cards" id="pvListings" style="margin-top:12px"></div></div>
<div class="panel" style="margin-bottom:24px"><h3>Your minted Monstars</h3><p class="pv-note" style="margin:6px 0 12px">List for sale (Phantom approves the marketplace to transfer only that Monstar when someone pays), or send it to another player.</p><div class="pv-cards" id="pvMine"></div></div>`;
marketSec.prepend(mk);

// Leaderboard tab: connected wallets ranked by SOL earned in staked matches
const lbBtn = el('button', { textContent: 'Leaderboard' }); lbBtn.dataset.tab = 'leaders';
nav.insertBefore(lbBtn, nav.children[2] || null); lbBtn.onclick = () => tab('leaders');
const lbSec = el('section', { id: 'leaders', className: 'view hidden' });
lbSec.innerHTML = `<div class="topline"><div><div class="eyebrow">Connected wallets</div><h1>Leaderboard</h1>
<p class="muted">Ranked by SOL earned in staked matches (what you finished with minus your stake), then by wins. Updates every few seconds.</p></div><button class="smallbtn" id="lbRefresh">Refresh</button></div>
<div class="panel"><div class="lb-table" id="lbTable"><div class="pv-empty">Loading…</div></div></div>`;
main.append(lbSec);
async function refreshLeaders() {
  const box = q('lbTable');
  try {
    const r = await fetch('/api/leaderboard').then(x => x.json()), me2 = S.session()?.wallet;
    if (!r.players?.length) { box.innerHTML = '<div class="pv-empty">No staked matches yet. Win one to take the top spot.</div>'; return; }
    box.innerHTML = '<div class="lb-row lb-head"><span>#</span><span>Wallet</span><span>Net SOL</span><span>Won</span><span>Wins</span><span>Played</span></div>' + r.players.map(p =>
      `<div class="lb-row${p.wallet === me2 ? ' me' : ''}"><span class="lb-rank r${p.rank}">${p.rank}</span><span class="pv-addr">${esc(short(p.wallet))}${p.wallet === me2 ? ' <b>(you)</b>' : ''}</span><span class="${BigInt(p.net) >= 0n ? 'up' : 'dn'}">${BigInt(p.net) > 0n ? '+' : ''}${esc(p.netSol)}</span><span>${esc(p.earnedSol)}</span><span>${p.wins}</span><span>${p.played}</span></div>`).join('');
  } catch { box.innerHTML = '<div class="pv-empty">Leaderboard unavailable right now.</div>'; }
}
q('lbRefresh').onclick = refreshLeaders;
const baseTab4 = window.tab;
window.tab = tab = function (id) { baseTab4(id); pvpBtn.classList.toggle('active', id === 'pvp'); lbBtn.classList.toggle('active', id === 'leaders'); if (id === 'leaders') refreshLeaders(); if (id === 'pvp') { refreshMine(); draw(); } if (id === 'market') refreshMarket(); };
let pickedSpecies = 0, local = null, fightAt = 0;

// ---------- state ----------
let me = null, mine = [], picked = null, ws = null, room = null, cfg = null;
let stageHome = null, stageNext = null;
let snapPrev = null, snapCur = null, snapAt = 0, shares = null, pops = [], ended = null;

// ---------- wallet ----------
const isAcct = id => !!id && id.startsWith('@');
async function afterSignIn() {
  me = S.session()?.wallet || null;
  q('pvSignIn').textContent = me && !isAcct(me) ? 'Signed in · switch wallet' : 'Connect Phantom & sign in';
  q('pvAcct').hidden = !!me; q('pvSignOut').hidden = !me;
  window.PMV5?.signedIn?.(me); setTimeout(() => renderSouls(), 0);
  if (!me) { q('pvWallet').textContent = 'Not signed in. Practice is free with no sign-in.'; return; }
  q('pvWallet').innerHTML = isAcct(me) ? `Signed in as <b>${esc(me.slice(1))}</b> · free account. Connect Phantom any time to play for SOL.`
    : `<span class="pv-addr">${esc(me)}</span><br><span id="pvBal">Loading balance…</span>`;
  refreshBalance(); await refreshMine(); openSocket();
  q('pvBig').textContent = 'Ready to duel'; q('pvSmall').textContent = 'Pick your Monstar below, then create a match or join with a code.';
}
async function refreshBalance() { if (!me || isAcct(me)) return; try { q('pvBal').textContent = sol(await S.balance(me), 6) + ' devnet SOL'; } catch { q('pvBal').textContent = 'Balance unavailable (RPC busy)'; } }
q('pvSignIn').onclick = e => busy(e.target, async () => {
  if (!window.phantom?.solana?.isPhantom) {
    if (coarse) { toast('Opening PocketMonstars in the Phantom app…'); location.href = S.phantomBrowseLink(); return; } // Phantom's browser has the wallet built in
    q('pvPhantomHint').innerHTML = 'Phantom isn\'t installed in this browser. <a href="https://phantom.com/download" target="_blank" rel="noopener" style="color:var(--lime)">Get Phantom</a>, then reload this page.';
    window.open('https://phantom.com/download', '_blank', 'noopener'); return;
  }
  await S.signIn(); await afterSignIn(); toast('Signed in as ' + short(me));
});
async function acct(btn, fn) { return busy(btn, async () => {
  const u = q('pvUser').value.trim(), p = q('pvPass').value;
  if (!u || !p) throw Error('Enter a username and a password.');
  await fn(u, p); q('pvPass').value = ''; await afterSignIn(); toast('Signed in as ' + me.slice(1) + '. You can play online now.');
}); }
q('pvSignUp').onclick = e => acct(e.target, S.accountRegister);
q('pvLogIn').onclick = e => acct(e.target, S.accountLogin);
q('pvSignOut').onclick = () => { try { ws?.close(); } catch {} ws = null; S.signOut(); me = null; mine = []; picked = null; afterSignIn(); renderPicker(); toast('Signed out.'); };

// ---------- Monstar cards ----------
function statBars(st) {
  return '<div class="pv-stats">' + Monstars.STAT_KEYS.map(k => `<span>${Monstars.STAT_LABELS[k]}</span><i><s style="width:${Math.min(100, st[k] / 1.8)}%"></s></i><em>${st[k]}</em>`).join('') + '</div>';
}
function expBar(m) { return `<div class="pv-xp" title="${m.expInto} / ${m.expNeed} EXP"><i style="width:${Math.min(100, m.expInto / Math.max(1, m.expNeed) * 100)}%"></i></div>`; }
function cardHtml(m, extra = '') {
  return `${m.fusedWith ? `<span class="pv-chip ok" title="Bred bender: carries ${esc(m.fusedWith)}'s powers">Fused · ${esc(m.fusedWith)}</span>` : ''}<span class="pv-rar ${esc(m.traits.rarity)}">${esc(m.traits.rarity)}</span>${m.tier ? `<span class="pv-tier ${esc(m.tier)}">${esc(m.tier)}</span>` : ''}<span class="pv-lv">Lv${m.level} · ${esc(m.stage)}</span>
  <img class="px nftimg" src="art/nft/${Monstars.nftArt(Monstars.SPECIES[m.speciesId])}" alt="${esc(m.name)}" style="filter:hue-rotate(${m.traits.hue}deg)" loading="lazy">
  <span class="nm">${esc(m.form && m.form !== Monstars.SPECIES[m.speciesId].name ? m.form : m.name)}</span><span class="sub">${esc(m.className)} · ${esc(m.type)} · ${esc(m.traits.aura)} ${esc(m.traits.pattern)} · ${esc(m.traits.nature)} · 🛡 ${m.traits.shield ?? 70}% shield</span>
  ${expBar(m)}${statBars(m.stats)}${extra}`;
}
async function refreshMine() {
  if (!S.session()) return;
  try { mine = await S.myMonstars(); } catch (e) { return fail(e); }
  me = S.session()?.wallet;
  if (mine.length < 3 && mode === '3v3') setMode('1v1');
  if (!picked || !mine.some(m => m.serial === picked)) picked = mine[0]?.serial ?? null;
  const box = q('pvCards');
  if (box) { box.innerHTML = '';
  const groups = [['royals', 'Royal Anunnaki (Queen Ninshara\'s court)'], ['ascendants', 'Ascendants (founder legendaries)'], ['mythic', 'Mythic collection'], ['anunnaki', 'Anunnaki collection'], ['watchers', 'Watchers collection'], ['legendary', 'Legendary collection'], ['frontier', 'Frontier collection (caught in the wild)'], ['bred', 'Bred collection'], ['genesis', 'Genesis collection']];
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
  }
  renderBreedPick();
  renderMineMarket(); renderPicker();
}

// ---------- lobby ----------
async function stakeNote() {
  cfg ??= await S.getConfig().catch(() => null);
  let v; try { v = Stake.toLamports(q('pvStake').value || '0'); } catch { q('pvStakeNote').textContent = 'Enter an amount like 0.01'; return; }
  q('pvStakeNote').innerHTML = v < 1_000_000n ? '<b>Minimum stake is 0.001 SOL.</b> For a free game, use Quick battle vs CPU.' : `Pot <b>${sol(v * 2n)} SOL</b>. A hit worth 10% of your rival's HP moves <b>${sol(v / 10n, 9)} SOL</b> to you. Minimum stake 0.001 SOL.`;
}
q('pvPresets').onclick = e => { const b = e.target.closest('button'); if (!b) return; q('pvPresets').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); q('pvStake').value = b.dataset.v; stakeNote(); };
q('pvStake').oninput = stakeNote; stakeNote();
function teamMsg(needOwned) {
  if (mode !== '3v3') return { mode };
  return { ...teamMsg3(needOwned), squad };
}
function teamMsg3(needOwned) {
  if (teamPick.length < 3) { fillTeam(); renderPicker(); }
  const owned = teamPick.map(ownedFor);
  if (owned.every(Boolean)) return { mode, serials: owned.map(m => m.serial) };
  if (needOwned) throw Error('A staked 3v3 needs three of your own Monstars.');
  return { mode, speciesIds: teamPick.slice() };
}
function needSocket() { if (!S.session()) throw Error('Sign in with Phantom first.'); if (!ws || ws.readyState > 1) openSocket(); }
function sendWs(msg) { needSocket(); const go = () => ws.send(JSON.stringify(msg)); ws.readyState === 1 ? go() : ws.addEventListener('open', go, { once: true }); }
q('pvCreate').onclick = () => { try { const lam = Stake.toLamports(q('pvStake').value || '0'); if (lam < 1_000_000n) throw Error('The minimum stake is 0.001 SOL.'); sendWs({ t: 'create', stakeLamports: lam.toString(), serial: lam > 0n ? picked : undefined, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0, ...teamMsg(lam > 0n) }); } catch (e) { fail(e); } };
let lastJoin = null;
q('pvJoin').onclick = () => { try { lastJoin = { t: 'join', code: q('pvJoinCode').value.trim().toUpperCase(), serial: picked, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0, ...teamMsg(true) }; sendWs(lastJoin); } catch (e) { fail(e); } };
// ---------- Immortal Combat: winner takes the loser's Monstar; the loser can buy it back for the winner's soul fee ----------
q('pvImmortal').onclick = () => { try {
  if (!S.session()) throw Error('Sign in first (top right).');
  const m = mine.find(x => x.serial === picked); if (!m) throw Error('Pick one of your own Monstars first.');
  if (!confirm(`Immortal Combat puts ${m.form || m.name} (Lv${m.level}) on the line.\n\nIf you lose, the winner takes it. You'll have 24 hours to buy it back for their soul fee, or it's gone for good.\n\nCreate the match?`)) return;
  sendWs({ t: 'create', immortal: true, mode: '1v1', serial: m.serial, speciesId: m.speciesId }); } catch (e) { fail(e); } };
function confirmImmortalJoin() {
  const m = mine.find(x => x.serial === picked);
  if (!lastJoin || !m) return toast('Pick one of your own Monstars to join an Immortal Combat.', true);
  if (!confirm(`That match is IMMORTAL COMBAT: the winner takes the loser's Monstar.\n\nYou'd put ${m.form || m.name} (Lv${m.level}) on the line. If you lose, you have 24 hours to buy it back for the winner's soul fee, or it's gone.\n\nJoin anyway?`)) return;
  sendWs({ ...lastJoin, mode: '1v1', serial: m.serial, immortalOk: true });
}
const SOL_FEES = ['0.1', '0.2', '0.3', '0.4', '0.5'];
async function renderSouls(box = q('pvSouls')) {
  if (!box) return; if (!S.session()) { box.innerHTML = ''; return; }
  let r; try { r = await S.soulMine(); } catch { return; }
  const open = r.claims.filter(c => c.state === 'open'), done = r.claims.filter(c => c.state !== 'open').slice(0, 5);
  if (!r.claims.length && !r.collect?.length) { box.innerHTML = ''; return; }
  const left = c => { const ms = Math.max(0, c.expiresAt - Date.now()), h = Math.floor(ms / 36e5), mi = Math.floor(ms / 6e4) % 60; return `${h}h ${mi}m left`; };
  box.innerHTML = `<h3 style="margin-top:16px">Soul claims</h3>` + open.map(c => { const n = esc(c.monstar?.form || c.monstar?.name || 'Monstar');
    return `<div class="pv-soul">${c.monstar ? `<img src="${PA.spriteSrc(c.monstar.speciesId, c.monstar.stageId)}" alt="">` : ''}<div><b>${n}</b> · Lv${c.monstar?.level ?? '?'}<br><small>${left(c)} · soul fee <b>${c.feeSol} SOL</b>${c.feeUsd ? ' or <b>' + c.feeUsd + '</b> by card' : ''}</small>
      ${c.you === 'winner' ? `<div class="pv-row soul-fee">${SOL_FEES.map(v => `<button class="smallbtn" data-sfee="${c.id}" data-v="${v}" aria-pressed="${Number(v) === Number(c.feeSol)}">${v} SOL</button>`).join('')}<input class="pv-input" data-susd="${c.id}" inputmode="decimal" placeholder="$ (optional)" value="${c.feeCents ? (c.feeCents / 100).toFixed(2) : ''}" style="max-width:110px"><button class="smallbtn" data-ssave="${c.id}">Save $</button></div><small>You won it. Its old owner can buy it back until the time runs out, then it's yours for good.</small>`
        : `<div class="pv-row">${c.canSol ? `<button class="primary" data-sbuy="${c.id}">Buy back · ${c.feeSol} SOL</button>` : ''}${c.canCard ? `<button class="smallbtn" data-scard="${c.id}">💳 Buy back · ${c.feeUsd}</button>` : ''}</div>${!c.canSol && !c.canCard ? '<small>Waiting for the winner to set a price you can pay.</small>' : '<small>Buy it back before the time runs out, or it is gone for good.</small>'}`}</div></div>`; }).join('')
    + (r.collect || []).map(e => `<div class="pv-soul">${e.monstar ? `<img src="${PA.spriteSrc(e.monstar.speciesId, e.monstar.stageId)}" alt="">` : ''}<div><b>${esc(e.monstar?.form || e.monstar?.name || 'NFT')}</b> is waiting in an escrow for you.<div class="pv-row"><button class="primary" data-collect="${e.id}">Collect NFT</button></div></div></div>`).join('')
    + done.map(c => `<div class="pv-soul done"><small>${esc(c.monstar?.form || c.monstar?.name || 'Monstar')}: ${c.state === 'bought' ? 'bought back' : c.you === 'winner' ? 'yours for good' : 'lost for good'}</small></div>`).join('');
  const fee = id => box.querySelector(`[data-sfee="${id}"][aria-pressed="true"]`)?.dataset.v || '0.1';
  box.querySelectorAll('[data-sfee]').forEach(b => b.onclick = async () => { try { const usdIn = box.querySelector(`[data-susd="${b.dataset.sfee}"]`).value; await S.soulFee(Number(b.dataset.sfee), Number(b.dataset.v), usdIn === '' ? null : Number(usdIn)); toast('Soul fee set to ' + b.dataset.v + ' SOL.'); renderSouls(box); } catch (e) { fail(e); } });
  box.querySelectorAll('[data-ssave]').forEach(b => b.onclick = async () => { try { const id = Number(b.dataset.ssave), v = box.querySelector(`[data-susd="${id}"]`).value; await S.soulFee(id, Number(fee(id)), v === '' ? null : Number(v)); toast('Saved.'); renderSouls(box); } catch (e) { fail(e); } });
  box.querySelectorAll('[data-sbuy]').forEach(b => b.onclick = async () => { try { b.disabled = true; const m = await S.soulBuy(Number(b.dataset.sbuy)); toast(`${m.form || m.name} is back with you!`); refreshMine(); renderSouls(box); } catch (e) { fail(e); b.disabled = false; } });
  box.querySelectorAll('[data-collect]').forEach(b => b.onclick = async () => { try { b.disabled = true; const m = await S.escrowCollect(Number(b.dataset.collect)); toast(`${m.form || m.name} is in your wallet.`); refreshMine(); renderSouls(box); } catch (e) { fail(e); b.disabled = false; } });
  box.querySelectorAll('[data-scard]').forEach(b => b.onclick = () => S.soulCard(Number(b.dataset.scard)).catch(fail));
}
setInterval(() => { if (!pvp.classList.contains('hidden')) renderSouls(); }, 30000);
// ---------- move cards ("What will X do?") ----------
const MOVE_KEYS = ['atk', 'sp', 'dash', 'guard'];
const TYPE_COL = { ANCIENT: '#c8902a', WATCHER: '#6a5ab0', VENOM: '#9a4ad0', STEEL: '#7a889e', GALE: '#3aa888', DRACO: '#c83a5a', EMBER: '#e8582c', TIDE: '#3a8ae0', GROVE: '#4caa3a', SPARK: '#d8b018', SHADE: '#7a4ad8', STONE: '#9a8458', FROST: '#5ab8d8', ASTRAL: '#d89a30', PSYCHIC: '#c050c8', NORMAL: '#8a8a9a' };
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
    { k: 'dash', n: sp.kit.dash.name, ty: 'NORMAL', c: 'Dash', e: sp.kit.dash.note },
    { k: 'guard', n: sp.kit.guard.name, ty: 'NORMAL', c: 'Guard', e: sp.kit.guard.note },
    { k: 'mega', n: sp.kit.mega.name, ty: sp.type, c: 'MEGA', e: 'Mega Shot · ' + sp.kit.mega.note + ' Needs a full ULT meter.' },
  ];
  q('pvAsk').textContent = sp.name.toUpperCase();
  q('pvMGrid').innerHTML = cards.map((c, i) => `<button class="pv-mv${c.k === 'mega' ? ' mega' : ''}" data-k="${c.k}" style="--tc:${TYPE_COL[c.ty] || '#888'}"><span class="mv-n">${esc(c.n)}</span><span class="mv-k">${i + 1}</span>
    <span class="mv-row"><span class="mv-ty">${c.k === 'mega' ? 'MEGA SHOT' : c.ty === 'NORMAL' ? (c.k === 'dash' ? 'DASH' : 'GUARD') : esc(c.ty)}</span><span class="mv-c">${esc(c.c)}</span></span><span class="mv-e">${c.e}</span><i class="mv-cd"></i></button>`).join('');
  q('pvMGrid').querySelectorAll('.pv-mv').forEach(b => { const k = b.dataset.k; let at = 0;
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = true; at = performance.now(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} });
    const up = () => { b.classList.remove('on'); setTimeout(() => { touch[k] = false; }, Math.max(0, 160 - (performance.now() - at))); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault()); });
}
const cdMax = { b: 1, s: 1, d: 1, g: 1 };
const ST_LABEL = { paralyze: 'PARALYZED', freeze: 'FROZEN', burn: 'BURNED', poison: 'POISONED', root: 'ENTANGLED', stun: 'STUNNED', confuse: 'CONFUSED', lift: 'LEVITATED', soak: 'SWEPT AWAY', dazzle: 'DAZZLED', weaken: 'CURSED', mark: 'WATCHED' };
function updateStatus(k, f) { const el = q('pvSt' + k); if (!el) return; const t = f.st ? ST_LABEL[f.st] : f.rc ? 'RECOVERING' : ''; if (el.textContent !== t) { el.textContent = t; el.className = 'hb-st' + (f.st ? ' s-' + f.st : ''); } }
function updateMoves(f) {
  const grid = q('pvMGrid'); if (!grid || !f) return;
  const spc = grid.children[1];
  if (spc) { const u = Math.min(100, f.ul || 0); spc.classList.toggle('ult', u >= 100); let bar = spc.querySelector('.mv-ult'); if (!bar) { bar = el('span', { className: 'mv-ult' }); spc.append(bar); } bar.innerHTML = u >= 100 ? '<b>ULT READY</b>' : `ULT ${u}%<i style="width:${u}%"></i>`; }
  const sp = Monstars.SPECIES[f.s], cost = { b: Sim.STYLES[sp.basicStyle].cost, s: Sim.STYLES[sp.specialStyle].cost, d: 0, g: 0 };
  const mg = grid.children[4]; if (mg) { const u = Math.min(100, f.ul || 0); mg.classList.toggle('cool', u < 100); mg.classList.toggle('ult', u >= 100); mg.querySelector('.mv-cd').style.width = (100 - u) + '%'; }
  ['b', 's', 'd', 'g'].forEach((k, i) => { const b = grid.children[i]; if (!b) return; const cd = f.cd[k] || 0; cdMax[k] = Math.max(cd, cd > 0 ? cdMax[k] : 0.01);
    const cool = cd > 0.05 || f.en < cost[k]; b.classList.toggle('cool', cool); b.querySelector('.mv-cd').style.width = (cd > 0 ? cd / cdMax[k] * 100 : 0) + '%'; });
}
function hudNames() {
  shownS[0] = shownS[1] = null; stripKey = ['', ''];
  PA.preload?.((room?.players || []).flatMap(p => (p.team || [p.monstar]).map(x => x.speciesId)));
  if (!room?.players || room.players.length < 2) return;
  const order = room.local || room.ai ? [0, 1] : [room.you, 1 - room.you];
  buildMoves();
  order.forEach((pi, k) => { const m = room.players[pi].monstar; q('pvN' + k).textContent = Monstars.SPECIES[m.speciesId].name.toUpperCase(); const t = q('pvT' + k); if (!t.classList.contains('cast')) t.textContent = m.type; t.dataset.type = m.type; t.style.setProperty('--tc', TYPE_COL[m.type] || '#888');
    q('pvPic' + k).src = PA.spriteSrc(m.speciesId); q('pvPic' + k).style.filter = `hue-rotate(${m.traits?.hue || 0}deg)`; });
}
/** After a fight: one button back to the start (a fresh page load on the Arena picker); free fights also go back on their own. */
let backTimer = null, backAt = 0;
function backToPick(autoSec = 0) {
  const b = el('button', { className: 'primary', textContent: 'Back to pick your Monstar' });
  const go = () => { clearInterval(backTimer); backAt = 0; location.replace(location.pathname + location.search + '#arena'); location.reload(); };
  b.onclick = go; clearInterval(backTimer);
  if (autoSec > 0) { // the overlay can be redrawn: keep one deadline so the countdown never restarts
    if (!backAt) backAt = Date.now() + autoSec * 1000;
    const tick = () => { const n = Math.ceil((backAt - Date.now()) / 1000); if (n <= 0) go(); else b.textContent = `Back to pick your Monstar (${n})`; };
    tick(); backTimer = setInterval(tick, 250);
  }
  return b;
}
function leaveBattle() { if (room?.code && !room.local) doneCodes.add(room.code); if (room?.local) { room = null; local = null; ended = null; snapCur = null; renderRoom(); renderer.idle(); return; } try { sendWs({ t: 'leave' }); } catch {} room = null; ended = null; renderRoom(); }
q('pvLeave').onclick = leaveBattle;
// No running away: in the wild this button is Catch, in other battles it is hidden (the match plays out).
q('pvExit').onclick = () => tryCatch();
function tryCatch() {
  if (!room?.wild || room.state !== 'live' || ended) return;
  if (room.local) return toast('This is a practice run. Sign in (top right) to catch wild Monstars.', true);
  const f = snapCur?.f?.[1]; if (!f) return;
  if (f.hp / f.max > 0.25) return toast(`Get its HP into the red first (${Math.ceil(f.hp / f.max * 100)}% now, 25% or less).`, true);
  try { sendWs({ t: 'capture' }); } catch (e) { fail(e); }
}
/** Soul-orb colour of a caught Monstar: its bender element, else its type (every colour of the spectrum). */
const ELEMENT_COL = { water: '#1e7bff', earth: '#9a6a32', fire: '#ff3b1f', air: '#f4fbff', thunder: '#ffe01a', all: '#ffcc00' };
const TYPE_SOUL = { EMBER: '#ff3b1f', TIDE: '#1e7bff', SPARK: '#ffe01a', SHADE: '#120c1c', PSYCHIC: '#a23bff', GROVE: '#2ecc40', ASTRAL: '#ff8ad8', FROST: '#7fe8ff',
  STONE: '#9a6a32', STEEL: '#b8c4d8', GALE: '#f4fbff', VENOM: '#8b2bd8', DRACO: '#ff8a00', ANCIENT: '#ffb300', WATCHER: '#c0c8ff' };
function soulColor(sp) { return (sp?.el2 && ELEMENT_COL[sp.el2]) || TYPE_SOUL[sp?.type] || '#ffffff'; }
/** Free accounts used their 2 free catches: offer catch passes (paid by card). */
async function offerPasses() {
  let c; try { c = await S.catchesMe(); } catch { return; }
  if (!c.card) return toast('You used your 2 free catches. Catch passes (card payments) open soon, or connect Phantom to catch with SOL.', true);
  const p1 = c.packs.find(p => p.n === 1), p5 = c.packs.find(p => p.n === 5);
  const pick = prompt(`You used your 2 free catches. Catch passes let you keep catching (paid by card).\n\nType 1 for 1 pass ($${p1.usd.toFixed(2)}) or 5 for 5 passes ($${p5.usd.toFixed(2)}).`, '5');
  if (pick === '1' || pick === '5') S.catchPassBuy(Number(pick)).catch(fail);
}
window.PMOfferPasses = offerPasses;
// One deposit per match. If the server hasn't seen it on-chain yet, re-check the SAME signature; never send a second transfer.
let pendingDeposit = null, depositRetries = 0;
q('pvDeposit').onclick = e => busy(e.target, async () => {
  if (pendingDeposit && pendingDeposit.code === room?.code) { sendWs({ t: 'deposit', signature: pendingDeposit.sig }); toast('Checking your deposit again…'); return; }
  const sig = await S.deposit(); pendingDeposit = { code: room?.code, sig }; depositRetries = 0;
  sendWs({ t: 'deposit', signature: sig }); toast('Deposit sent. Waiting for confirmation…'); refreshBalance();
});

// Practice and free matches show a pretend 0.01 SOL pot so you can watch SOL move per hit. It is never paid out.
const PRACTICE_STAKE = 1_000_000n; // 0.001 SOL each side
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
let mode = '1v1', squad = false, teamPick = []; // new players start with 1v1; 3v3 is tag team or squad (all three fight at once)
const MODE_NOTES = { '1v1': 'One Monstar each.', '3v3': '3v3 tag team: one Monstar at a time. Tap a teammate\'s picture in battle to swap it in.', squad: '3v3 squad: all six Monstars fight at once. You control one; tap a teammate\'s picture to take control of it. The others fight on their own.' };
let cpuLevel = 'normal';
q('pvCpu').onclick = e => { const b = e.target.closest('button'); if (!b) return; cpuLevel = b.dataset.l; q('pvCpu').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); };
function fillTeam() { const pool = Monstars.SPECIES.filter(sp => usableSpecies(sp) && !teamPick.includes(sp.id)).sort(() => Math.random() - 0.5); while (teamPick.length < 3 && pool.length) teamPick.push(pool.shift().id); }
function setMode(m) { squad = m === 'squad'; mode = squad ? '3v3' : m; q('pvMode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === m)); const n = q('pvModeNote'); if (n) n.textContent = MODE_NOTES[m]; }
q('pvMode').onclick = e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.m !== '1v1' && S.session() && mine.length < 3) { toast('3v3 needs three Monstars. Capture more in the Wild or buy one in the Superhero Drop.', true); return; }
  setMode(b.dataset.m); if (mode === '3v3' && !teamPick.length) teamPick = [pickedSpecies]; renderPicker(); };
function renderTeamPick() {
  const box = q('pvTeamPick'); box.hidden = mode !== '3v3'; if (mode !== '3v3') return;
  box.innerHTML = `<span>Your team (${teamPick.length}/3):</span>` + [0, 1, 2].map(i => teamPick[i] != null ? `<button data-i="${i}" title="Remove"><img src="${PA.spriteSrc(teamPick[i])}" alt="${esc(Monstars.SPECIES[teamPick[i]].name)}"></button>` : '<i>?</i>').join('') + '<small>Tap Monstars below to add. The next one comes in when one faints, or tap its picture in battle to switch.</small>';
  box.querySelectorAll('button').forEach(b => b.onclick = () => { teamPick.splice(+b.dataset.i, 1); renderPicker(); });
}
// Every player starts with three Monstars (a wallet's three are picked from its address; a guest gets three at random).
// Everything else is caught in the Wild Expedition.
const STARTER_KEY = 'pm-guest-starters-v2';
function guestStarters() { // a guest practises with one random Starter Bender (like a new account) plus two of the original nine for 3v3
  try { const v = JSON.parse(localStorage.getItem(STARTER_KEY) || 'null'); if (Array.isArray(v) && v.length === 3) return v; } catch {}
  const ids = Monstars.STARTER_IDS, v = [ids[Math.floor(Math.random() * ids.length)], ...Monstars.GENESIS_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 2)];
  try { localStorage.setItem(STARTER_KEY, JSON.stringify(v)); } catch {} return v;
}
const usableSpecies = sp => (S.session() && mine.length ? mine.some(m => m.speciesId === sp.id) : guestStarters().includes(sp.id));
function ensurePick() { if (!usableSpecies(Monstars.SPECIES[pickedSpecies])) pickedSpecies = (S.session() && mine[0]?.speciesId) ?? guestStarters()[0]; teamPick = teamPick.filter(id => usableSpecies(Monstars.SPECIES[id])); }
function renderPicker() {
  const box = q('pvPicker'); if (!box) return; box.innerHTML = ''; ensurePick(); renderTeamPick();
  Monstars.SPECIES.filter(usableSpecies).forEach(sp => {
    const own = ownedFor(sp.id), b = el('button', { className: 'pv-pick' + (sp.legendary ? ' legend' : ''), title: sp.name });
    b.setAttribute('aria-pressed', sp.id === pickedSpecies);
    b.innerHTML = `<img class="px" src="${PA.spriteSrc(sp.id, own?.stageId)}" alt="${sp.name}" style="filter:hue-rotate(${own?.traits.hue || 0}deg)">`;
    if (mode === '3v3' && teamPick.includes(sp.id)) b.classList.add('inteam');
    b.onclick = () => { pickedSpecies = sp.id; if (own) picked = own.serial;
      if (mode === '3v3' && !teamPick.includes(sp.id)) { if (teamPick.length >= 3) teamPick.shift(); teamPick.push(sp.id); }
      renderPicker(); if (own) refreshMine(); };
    box.append(b);
  });
  const sp = Monstars.SPECIES[pickedSpecies], m = monFor(pickedSpecies), j = m.toJSON();
  const K = sp.kit;
  q('pvPickInfo').innerHTML = `<b>${esc(j.form || m.displayName)}</b> · Lv${j.level} ${esc(j.stage)} · ${sp.cls.label} · ${sp.type}${expBar(j)}
    <span class="kit"><b>Attack</b> ${esc(K.basic.name)}${K.basic.shots > 1 ? ' (double shot)' : ''}${K.basic.homing ? ' (homing)' : ''}<br><b>Special</b> ${esc(K.special.name)}<br><b>Dash</b> ${esc(K.dash.name)}: ${esc(K.dash.note)}<br><b>Guard</b> ${esc(K.guard.name)}: ${esc(K.guard.note)}<br><b>Mega Shot</b> ${esc(K.mega.name)}: ${esc(K.mega.note)}</span>${esc(sp.cls.passive)}`;
}
q('pvPractice').onclick = () => startPractice();
let lastPractice = null;
function startPractice(opt = null) {
  lastPractice = opt;
  const own = ownedFor(pickedSpecies);
  if (!opt && mode === '3v3' && teamPick.length < 3) { fillTeam(); renderPicker(); }
  const ownTeam = mode === '3v3' ? teamPick.map(ownedFor) : [own];
  if (!opt && S.session() && ownTeam.length === (mode === '3v3' ? 3 : 1) && ownTeam.every(Boolean) && ws?.readyState === 1) {
    try { // Rematch: drop the finished match first, or its old frame stays frozen on screen and the new room is ignored
      const oldCode = room?.code; local = null; room = null; ended = null; snapCur = null; snapPrev = null; renderRoom();
      q('pvBig').textContent = 'Get ready!'; q('pvSmall').textContent = 'Finding your rival…';
      sendWs({ t: 'ai', mode, squad: mode === '3v3' && squad, level: cpuLevel, serial: own?.serial, serials: ownTeam.map(m => m.serial) }); fightAt = 0; renderer.reset(); resetVirtual();
      const asked = performance.now(); setTimeout(() => { if ((!room || room.code === oldCode) && performance.now() - asked > 2400) { toast('Server is slow, playing practice on this device.'); startPractice({ ...(opt || {}), forceLocal: true }); } }, 4000);
    } catch (e) { fail(e); } return; }
  if (!opt && S.session() && ws?.readyState !== 1) openSocket(); // reconnect in the background; this practice runs locally
  if (opt?.forceLocal) opt = null;
  if (!usableSpecies(Monstars.SPECIES[pickedSpecies])) pickedSpecies = 0;
  const three = !opt && mode === '3v3';
  if (three && teamPick.length < 3) { fillTeam(); renderPicker(); }
  const ids = three ? teamPick.slice() : [pickedSpecies];
  const others = Monstars.WILD_IDS.map(id => Monstars.SPECIES[id]).filter(x => !x.mythic && !ids.includes(x.id)).sort(() => Math.random() - 0.5);
  const team = ids.map(monFor), lvl = () => Math.max(1, team[0].level + Math.floor(Math.random() * 3) - 1);
  const foes = opt?.foeId != null ? [new Monstars.Monstar({ speciesId: opt.foeId, level: opt.foeLevel })] : ids.map((_, i) => new Monstars.Monstar({ speciesId: others[i].id, level: lvl() }));
  local = { m: Sim.createMatch(three ? team : team[0], three ? foes : foes[0], { arena: opt?.arena ?? Math.floor(Math.random() * Sim.ARENA_COUNT), squad: three && squad, intro: true }), mem: { hard: !!opt?.hard, level: opt ? 'normal' : cpuLevel } };
  const a = team[0], b = foes[0], foe = b.species;
  room = { local: true, wild: opt || null, mode: three ? '3v3' : '1v1', squad: three && squad, state: 'live', you: 0, stake: '0', code: 'AI',
    players: [{ wallet: me || 'You', monstar: a.toJSON(), team: team.map(x => x.toJSON()) }, { wallet: 'AI', monstar: { ...b.toJSON(), name: opt ? 'Wild ' + foe.name : b.toJSON().name }, team: foes.map(x => x.toJSON()) }] };
  ended = null; snapPrev = null; snapCur = Sim.snapshot(local.m); snapAt = performance.now(); renderer.reset(); fightAt = performance.now(); resetVirtual();
  renderRoom(); draw();
}
window.PMStartBattle = startPractice;
window.PMArenaApi = {
  afterSignIn: () => afterSignIn(), refreshMine: () => refreshMine(), toast, snap: () => snapCur, mine: () => mine, renderSouls: box => renderSouls(box), pickedMon: () => mine.find(x => x.serial === picked) || null,
  /** Immortal Guild: join an open Immortal Combat with the Monstar picked in the Arena (the player already confirmed). */
  joinImmortal(code) { const m = mine.find(x => x.serial === picked); if (!m) throw Error('Pick one of your own Monstars first.'); window.tab?.('pvp'); lastJoin = { t: 'join', code, mode: '1v1', serial: m.serial, speciesId: m.speciesId }; sendWs({ ...lastJoin, immortalOk: true }); },
  pick(serial) { const m = mine.find(x => x.serial === serial); if (m) { picked = m.serial; pickedSpecies = m.speciesId; renderPicker(); } },
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

let retry = 0, retryT = null;
function openSocket() {
  if (ws && ws.readyState <= 1) return;
  clearTimeout(retryT);
  ws = S.connectSocket(onMsg);
  ws.onopen = () => { retry = 0; };
  ws.onclose = e => {
    if (e.code === 4001) { // the server no longer accepts this sign-in: clear it once, no reconnect loop
      S.signOut?.(); me = null; serverLost('Your sign-in expired. Tap "Connect Phantom & sign in" to sign in again. Practice still works.'); return; }
    if (!S.session()) return;
    if (room && !room.local && room.state === 'live' && retry === 0) toast('Connection lost. Reconnecting…', true);
    retry++; if (retry > 6) { serverLost('Lost connection to the game server. Practice runs on your phone until it is back.'); retry = 0; return; }
    retryT = setTimeout(openSocket, Math.min(8000, 800 * retry)); // back off instead of hammering
  };
}
function serverLost(msg) {
  if (room && !room.local) { room = null; ended = null; snapCur = null; snapPrev = null; renderRoom(); renderer.idle(); }
  q('pvSignIn').textContent = S.session() ? 'Signed in · switch wallet' : 'Connect Phantom & sign in';
  toast(msg, true);
}

const doneCodes = new Set(); // matches this player has finished or left: ignore anything they still send
function onMsg(m) {
  if (m.code && doneCodes.has(m.code)) return;
  if (m.code && room && !room.local && m.code !== room.code && m.t !== 'room') return; // belongs to another match
  if (m.t === 'error') {
    if (/not found yet/i.test(m.error) && window.PMWild?.retry?.()) return toast('Waiting for Solana to confirm your entry fee…');
    if (/not found yet/i.test(m.error) && pendingDeposit && depositRetries < 10) { depositRetries++; setTimeout(() => sendWs({ t: 'deposit', signature: pendingDeposit.sig }), 3000); return toast('Waiting for Solana to confirm your deposit…'); }
    if (/free catches/i.test(m.error)) { offerPasses(); return; }
    if (m.error === 'IMMORTAL_CONFIRM') { confirmImmortalJoin(); return; }
    return toast(m.error, true);
  }
  if (m.t === 'noroom') { if (room && !room.local) { serverLost('That match ended because the game server restarted. Start a new one.'); } return; }
  if (m.t === 'room') { if (room?.local) return; if (room && room.code !== m.code && ['live', 'countdown'].includes(room.state) && !ended && ['done', 'cancelled', 'settled', 'refunded'].includes(m.state)) return; room = m; shares = practiceMoney() ? (vLedger ? vLedger.shares.map(String) : null) : m.shares; renderRoom(); return; }
  if (m.t === 'state') {
    if (room && room.state !== 'live') { room.state = 'live'; fightAt = performance.now(); renderer.reset(); renderRoom(); }
    snapPrev = snapCur; snapCur = m.s; snapAt = performance.now(); setShares(m.shares); showCapture(); return;
  }
  if (m.t === 'capture') { if (!m.ok) toast(`It broke free! (${m.chance}% chance) · ${m.left} ${m.left === 1 ? 'try' : 'tries'} left`, true); return; }
  if (m.t === 'hit') { setShares(m.shares, m); return; }
  if (['switch', 'status', 'ult', 'pickup', 'blocked', 'dash', 'guard', 'mega', 'quake'].includes(m.t)) { battleEvent({ ...m, type: m.t }); return; }
  if (m.t === 'miss' || m.t === 'level' || m.t === 'bonus') { battleEvent({ ...m, type: m.t }); if (m.t === 'level') refreshSoon(); return; }
  if (m.t === 'end') { q('pvCapture').hidden = true; if (m.caught?.captured) toast('Captured! ' + (Monstars.SPECIES[m.caught.speciesId]?.name || 'It') + ' joined your team' + (m.caught.monstar?.level > 1 ? ' at Lv' + m.caught.monstar.level + '.' : ' as a level 1 Infant.')); if (m.code) setTimeout(() => doneCodes.add(m.code), 60000); if (practiceMoney() && vLedger) { vLedger.finish(m.winner == null ? null : m.winner); shares = vLedger.shares.map(String); showShares(); } ended = { ...m, at: performance.now(), capture: m.caught?.ok ? { col: soulColor(Monstars.SPECIES[m.caught.speciesId]) } : null }; if (m.caught?.needPass) setTimeout(offerPasses, 3500); refreshSoon(); if (room) room.state = room.stake === '0' ? 'done' : 'settling'; renderRoom(); return; }
  if (m.t === 'settlement') { ended = { at: 0, ...(ended || {}), settlement: m }; if (room) room.state = m.ok ? (m.refund ? 'refunded' : 'settled') : 'needs review'; renderRoom(); refreshBalance(); return; }
  if (m.t === 'cancelled') { toast('Match cancelled (' + m.reason + ').' + (room?.players?.some(p => p.deposited) ? ' Deposits are being refunded.' : '')); if (room) room.state = 'cancelled'; renderRoom(); }
  if (m.t === 'left') { room = null; renderRoom(); }
}

// Capture: during a wild battle on the server, the button appears once the wild Monstar's HP is in the red (25% or less).
function showCapture() {
  const b = q('pvExit'), f = snapCur?.f?.[1], wild = !!(room?.wild && room.state === 'live' && !ended);
  b.hidden = !wild; q('pvCapture').hidden = true;
  b.classList.toggle('ready', !!(wild && !room.local && f && f.hp > 0 && f.hp / f.max <= 0.25));
}
q('pvCapture').onclick = () => { try { sendWs({ t: 'capture' }); } catch (e) { fail(e); } };

let refreshT;
function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(() => { if (S.session()) refreshMine(); }, 1500); }
function battleEvent(ev) {
  if (!snapCur) return;
  if (ev.type === 'level') { const sp = Monstars.SPECIES[snapCur.f[ev.side]?.s ?? room?.players?.[ev.side]?.monstar?.speciesId ?? 0];
    ev.name = Monstars.formName(sp, Math.max(0, (ev.stageId ?? 1) - 1)).toUpperCase(); if (ev.evolved) ev.formTo = Monstars.formName(sp, ev.stageId); }
  if (ev.type === 'switch') ev.name = Monstars.SPECIES[ev.speciesId].name.toUpperCase();
  if (ev.type === 'hit' && ev.fee == null && room && room.stake !== '0' && ev.feeLamports) ev.fee = sol(ev.feeLamports, 9);
  if (ev.type === 'hit' && practiceMoney() && vLedger && ev.fee == null) { // pretend pot for practice
    const fee = vLedger.hit(ev.attacker, ev.damage, ev.victimMaxHp || snapCur.f[ev.victim]?.max || 100, ev);
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
  if (practiceMoney()) { if (hit && snapCur) battleEvent({ type: 'hit', attacker: hit.attacker, victim: 1 - hit.attacker, victimMaxHp: hit.victimMaxHp, lvl: hit.lvl, atk: hit.atk, pw: hit.pw, kind: hit.kind, damage: hit.damage, eff: hit.eff, crit: hit.crit, exp: hit.exp, style: hit.style }); return; }
  if (!next) return;
  shares = next; showShares(hit);
  if (hit && snapCur) battleEvent({ type: 'hit', attacker: hit.attacker, victim: 1 - hit.attacker, victimMaxHp: hit.victimMaxHp, lvl: hit.lvl, atk: hit.atk, pw: hit.pw, kind: hit.kind, damage: hit.damage, eff: hit.eff, crit: hit.crit, exp: hit.exp, style: hit.style, fee: BigInt(hit.fee) > 0n ? sol(hit.fee, 9) : null });
}

let shownShares = null;
function showShares() {
  if (!shares || !room) return;
  const you = room.local ? 0 : room.you, pretend = practiceMoney(), next = shares, prev = shownShares; shownShares = next.slice();
  const start = pretend ? PRACTICE_STAKE : BigInt(room.stake || 0);
  for (const side of [0, 1]) {
    const idx = side === 0 ? you : 1 - you, span = q('pvS' + side), d = BigInt(next[idx]) - start;
    span.textContent = sol(next[idx], 6) + ' SOL';
    q('pvSD' + side).textContent = d === 0n ? (pretend ? 'practice' : 'paid at end') : (d > 0n ? '+' : '−') + sol(d < 0n ? -d : d, 9);
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
  const holdMs = ended?.capture ? 3300 : ended && ended.winner != null ? 3200 : 1800; // the soul-orb animation plays before the result shows
  const fainting = ended && performance.now() - (ended.at || 0) < holdMs;
  if (fainting) setTimeout(renderRoom, holdMs + 50 - (performance.now() - ended.at));
  const stay = !!(room?.wild && ended && !fainting); // wild runs stay full screen until you choose what's next
  const stage = q('pvStage'), full = !!room && room.state === 'live' && (!ended || fainting) || (!!ended && fainting) || stay;
  stage.classList.toggle('live', !!full);
  document.documentElement.classList.toggle('pv-battling', !!full);
  // lock the page while the battle is on screen: no zoom, Back can't leave, no scrolling behind it
  if (full && !window.PMLock?.active) window.PMLock?.on({ scroll: true, warn: room?.stake && room.stake !== '0', onBack: () => toast('Battle in progress. There is no running away: finish the fight' + (room?.wild ? ' or catch it!' : '!')) });
  else if (!full && window.PMLock?.active) window.PMLock.off();
  if (full && stage.parentElement !== document.body) { stageHome ??= stage.parentElement; stageNext = stage.nextSibling; document.body.append(stage); }
  else if (!full && stageHome && stage.parentElement === document.body) stageHome.insertBefore(stage, stageNext);
  q('pvHud').hidden = !full || stay; q('pvMoves').hidden = !full || stay; q('pvPot').hidden = !full || stay;
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
        const keepLv = !String(me || '').startsWith('@') && c?.monstar?.level > 1;
        const line = c ? (c.ok ? `<b>You caught ${esc(wsp.name)}!</b> ${keepLv ? `It kept its level (Lv${c.monstar.level}) because you play with Phantom.` : 'It joined your team as a level 1 Infant (Phantom players keep the level they beat).'}`
            : won ? `${esc(wsp.name)} got away (${Math.round(c.chance * 100)}% catch chance for ${esc(c.tier)}).` : `${esc(wsp.name)} was too strong this time.`)
          : `Practice run. <b>Sign in and pay ${esc(w.feeSol())} SOL</b> to enter the wild for real and catch what you beat.`;
        q('pvSmall').innerHTML += '<br>' + line;
        const nx = el('button', { className: 'primary', textContent: 'Next wild encounter' }); nx.onclick = () => { room = null; local = null; ended = null; snapCur = null; renderRoom(); w.next(); };
        const mp = el('button', { className: 'smallbtn', textContent: 'Expedition map' }); mp.onclick = () => { room = null; local = null; ended = null; snapCur = null; renderRoom(); w.map(); };
        btns.append(nx, mp); if (!ended._rec) { ended._rec = 1; w.record(won, c); if (c?.ok) refreshMine(); } return; }
      // No rematch: the game reloads to the start, where you pick your Monstar again (a clean start every time)
      btns.append(backToPick(6));
    }
    return;
  }
  if (!room) { q('pvOverlay').hidden = false; q('pvBig').textContent = 'Ready to battle'; q('pvSmall').textContent = 'Pick a Monstar and tap Practice vs AI, or sign in with Phantom to battle a rival for SOL.'; q('pvOvBtns').innerHTML = ''; return; }
  q('pvCode').textContent = room.code; q('pvRoomState').textContent = (room.immortal ? 'IMMORTAL COMBAT · ' : '') + room.state;
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
    if (ended.immortal) { const im = ended.immortal, iWon = im.winner === S.session()?.wallet;
      small.innerHTML = iWon ? `<b>You won ${esc(im.name)}!</b> It's yours now. Its old owner has ${im.hours} hours to buy it back for your soul fee (0.1 SOL until you change it in Soul claims).`
        : `<b>${esc(im.name)} now belongs to the winner.</b> Buy it back within ${im.hours} hours in Soul claims, or it's gone for good.`; }
    if (!ended.immortal) { btns.append(backToPick(room.stake === '0' ? 6 : 0)); return; }
    const again = el('button', { className: 'primary', textContent: 'Soul claims' }); again.onclick = () => { room = null; ended = null; snapCur = null; renderRoom(); renderer.idle(); refreshMine(); renderSouls().then(() => q('pvSouls')?.scrollIntoView({ block: 'center' })); };
    btns.append(again);
  } else if (room.state === 'waiting') { big.textContent = room.code; small.textContent = 'Waiting for your rival to join with this code.'; }
  else if (room.state === 'lock') { // Immortal Combat: Phantom players sign before the fight
    const meP = room.players[room.you], rival = room.players[1 - room.you];
    big.textContent = 'Immortal Combat';
    if (meP && !meP.locked) {
      small.innerHTML = meP.nft ? `Your Monstar is an NFT: <b>sign in Phantom to move it into the match escrow</b>. The winner gets it (you collect yours back if you win).` : `<b>Sign in Phantom to put your Monstar on the line.</b> If you lose, the winner takes it. You can buy it back within 24 hours for their soul fee.`;
      const sb = el('button', { className: 'primary', textContent: meP.nft ? 'Sign · lock my NFT in escrow' : 'Sign · put my Monstar on the line' });
      sb.onclick = async () => { sb.disabled = true; sb.textContent = 'Approve in Phantom…'; try { room = { ...room, ...(meP.nft ? await S.immortalLock() : await S.immortalSign(room.consent)) }; toast('Signed. Waiting for your rival.'); renderRoom(); } catch (e) { fail(e); sb.disabled = false; sb.textContent = 'Try again'; } };
      btns.append(sb);
    } else small.textContent = `You signed. Waiting for ${rival?.locked ? 'the fight to start' : 'your rival to sign'}…`;
  }
  else if (room.state === 'deposit') { big.textContent = 'Deposits'; small.textContent = `Both players deposit ${sol(room.stake, 6)} SOL into the match escrow. The duel starts when both confirm.`; }
  else if (room.state === 'countdown') { big.textContent = String(room.countdown || 'GO'); small.textContent = 'Get ready!'; }
  else if (room.state === 'cancelled') { big.textContent = 'Cancelled'; small.textContent = 'Any deposits are refunded minus the 0.000005 SOL network fee.'; }
}

// ---------- input ----------
// Movement: touch the arena with a finger (or click / hold the mouse) and your Monstar runs to that spot and
// follows your finger while it's down. Thumb (or keyboard 1-4, J K Space L) does the moves. Aim is automatic.
const keys = {}, touch = { atk: false, sp: false, dash: false, guard: false, mega: false, sw: -1 };
let target = null; // { x, y, held, until } in arena coordinates
addEventListener('keydown', e => { if (room?.state !== 'live') return; if (e.code === 'KeyC' && room?.wild) tryCatch(); keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const cv = q('pvCanvas');
const renderer = PA.createRenderer(cv, ARENA);
cv.addEventListener('contextmenu', e => e.preventDefault());
const zone = q('pvZone'); let movePointer = null;
function toArena(e) { const r = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(ARENA.w, (e.clientX - r.left) / r.width * ARENA.w)), y: Math.max(0, Math.min(ARENA.h, (e.clientY - r.top) / r.height * ARENA.h)) }; }
// Dodging with the finger: a quick swipe, or a double-tap, makes your Monstar dash that way.
let lastTap = { at: 0, x: 0, y: 0 }, trail = [], dodgeDir = null;
function dodge(dx, dy) { const d = Math.hypot(dx, dy) || 1; dodgeDir = { x: dx / d, y: dy / d, until: performance.now() + 220 }; touch.dash = true; setTimeout(() => { touch.dash = false; }, 220); }
// Squad: tapping the swap button over a teammate (or the teammate itself) takes control of it.
function squadMateAt(pt) {
  if (!snapCur?.sq || !snapCur.x) return null;
  const me = room?.local ? 0 : room?.you ?? 0;
  let best = null, bd = 85;
  for (const f of snapCur.x) if (f.sd === me) { const d = Math.min(Math.hypot(pt.x - f.x, pt.y - (f.y - 130)), Math.hypot(pt.x - f.x, pt.y - (f.y - 35))); if (d < bd) { bd = d; best = f; } }
  return best;
}
zone.addEventListener('pointerdown', e => {
  if (room?.state !== 'live') return; e.preventDefault();
  const mate = squadMateAt(toArena(e));
  if (mate) { touch.sw = mate.sl; setTimeout(() => { touch.sw = -1; }, 250); return; } // switch control, don't move
  movePointer = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch {}
  const pt = toArena(e), now = performance.now(); target = { ...pt, held: true, until: 0 }; trail = [{ x: e.clientX, y: e.clientY, t: now }];
  if (now - lastTap.at < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 60 && snapCur) { const f = snapCur.f[room.local ? 0 : room.you]; dodge(pt.x - f.x, pt.y - f.y); }
  lastTap = { at: now, x: e.clientX, y: e.clientY };
});
zone.addEventListener('pointermove', e => {
  if (e.pointerId !== movePointer || !target) return;
  Object.assign(target, toArena(e));
  const now = performance.now(); trail.push({ x: e.clientX, y: e.clientY, t: now }); while (trail.length > 2 && now - trail[0].t > 120) trail.shift();
  const a = trail[0], dist = Math.hypot(e.clientX - a.x, e.clientY - a.y), dt = Math.max(1, now - a.t);
  if (dist > 45 && dist / dt > 0.9 && (!dodgeDir || now > dodgeDir.until + 250)) { dodge(e.clientX - a.x, e.clientY - a.y); trail = [{ x: e.clientX, y: e.clientY, t: now }]; } // fast swipe = dodge
});
const endMove = e => { if (e.pointerId !== movePointer) return; movePointer = null; if (target) { target.held = false; target.until = performance.now() + 1200; } };
zone.addEventListener('pointerup', endMove); zone.addEventListener('pointercancel', endMove);
zone.addEventListener('contextmenu', e => e.preventDefault());

let lastSent = '', lastSendAt = 0;
function currentInput() {
  if (!snapCur) return {};
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  const meF = snapCur.f[room.local ? 0 : room.you];
  if (target && !mx && !my) { // run to the finger / mouse; once there, hold the spot briefly, then the autopilot takes over again
    const dx = target.x - meF.x, dy = target.y - meF.y, d = Math.hypot(dx, dy);
    if (d > 16) { mx = dx / d; my = dy / d; } else if (!target.held && performance.now() > target.until) target = null; else { mx = 0.0001; my = 0; }
    if (target && !target.held && d > 16 && performance.now() > target.until + 2500) target = null;
  }
  if (dodgeDir && performance.now() < dodgeDir.until) { mx = dodgeDir.x; my = dodgeDir.y; } // dash the way the finger swiped
  const ax = 0, ay = 0; // aim is automatic: the Monstar faces its rival
  const swKey = keys.Digit6 ? 0 : keys.Digit7 ? 1 : keys.Digit8 ? 2 : -1;
  const i = { sw: touch.sw >= 0 ? touch.sw : swKey, mx, my, ax, ay, atk: !!(keys.KeyJ || keys.Digit1 || keys.KeyQ || touch.atk), sp: !!(keys.KeyK || keys.Digit2 || keys.KeyE || touch.sp), dash: !!(keys.Space || keys.Digit3 || touch.dash), guard: !!(keys.KeyL || keys.Digit4 || touch.guard), mega: !!(keys.Digit5 || keys.KeyR || touch.mega) };
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
  [you, 1 - you].forEach((idx, k) => { const f = snapCur.f[idx]; if (!f || shownS[k] === f.s + ':' + f.sg) return; shownS[k] = f.s + ':' + f.sg; // changes when it evolves mid-battle
    const sp = Monstars.SPECIES[f.s], hue = room.players[idx]?.team?.find(x => x.speciesId === f.s)?.traits?.hue || 0;
    q('pvN' + k).textContent = Monstars.formName(sp, f.sg).toUpperCase(); q('pvPic' + k).src = PA.spriteSrc(f.s, f.sg); q('pvPic' + k).style.filter = `hue-rotate(${hue}deg)`;
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
let drawLoop = 0; // only ever one animation loop: every Rematch used to start another one on top, until the phone froze
function draw() { if (!drawLoop) drawLoop = requestAnimationFrame(frame); }
function frame() {
  drawLoop = 0;
  try { drawArena(); } catch (e) { console.warn('arena frame skipped:', e?.message || e); }
  if (!pvp.classList.contains('hidden') || q('pvStage').classList.contains('live')) draw();
}
function drawArena() {
  const now = performance.now();
  if (snapCur && room?.players?.length === 2) {
    const t = Math.min(1, (now - snapAt) / (room.local ? 34 : 66)), you = room.you;
    const faint = [0, 0];
    let capture = null;
    if (ended?.capture) capture = { side: 1, t: (now - (ended.at || now)) / 1000, col: ended.capture.col };
    else if (ended && ended.winner != null) { // the Monstar that lost turns back into its soul orb, floats, then flies away
      const lose = 1 - ended.winner, f = snapCur.f[lose];
      capture = { side: lose, t: (now - (ended.at || now)) / 1000, col: soulColor(Monstars.SPECIES[f?.s]), beam: false, rise: 2.4 };
    }
    renderer.draw(snapPrev, snapCur, t, { target: target && { x: target.x, y: target.y }, rangeFor: you, you, snapAt, hues: room.players.map(p => p.monstar.traits?.hue || 0), types: room.players.map(p => p.monstar.type), faint, capture, soulCol: sid => soulColor(Monstars.SPECIES[sid]), fight: fightAt ? Math.max(0, 1.4 - (now - fightAt) / 1000) : 0 });
    const meF = snapCur.f[you], foe = snapCur.f[1 - you];
    for (const [k, f] of [[0, meF], [1, foe]]) {
      const p = Math.max(0, f.hp / f.max), bar = q('pvH' + k);
      bar.style.width = (p * 100) + '%'; bar.style.background = hpColor(p);
      q('pvX' + k).style.width = Math.min(100, f.xi / Math.max(1, f.xn) * 100) + '%';
      q('pvL' + k).textContent = `Lv${f.lv}`; q('pvL' + k).title = Monstars.STAGES[f.sg]?.name || '';
      q('pvHN' + k).textContent = `${Math.ceil(Math.max(0, f.hp))}/${f.max}`;
    }
    const left = Math.max(0, Math.ceil((snapCur.lim ?? ARENA.roundSeconds) - snapCur.t));
    q('pvClock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    callouts(); showCapture();
    updateMoves(meF); activeHud(you); teamStrips(you); updateStatus(0, meF); updateStatus(1, foe);
  } else renderer.idle();
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
      c.innerHTML = cardHtml(l.monstar, `<span class="price">${sol(price, 6)} SOL</span><span class="pv-split">Royalty ${cfg.royaltyBps / 100}% (${sol(roy, 6)}) → ${short(l.monstar.originOwner)} · PocketMonstars fee 5% (${sol(price * 500n / 10000n, 6)})</span><div class="acts"><button class="primary">${isMine ? 'Cancel listing' : 'Buy'}</button></div>`);
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
  const minted = mine;
  if (!S.session()) { box.innerHTML = '<div class="pv-empty">Sign in on the 1v1 Stake tab to see your Monstars.</div>'; return; }
  box.innerHTML = minted.length ? '' : '<div class="pv-empty">No Monstars yet.</div>';
  for (const m of minted) {
    const c = el('div', { className: 'pv-card' });
    if (!m.asset) { c.innerHTML = cardHtml(m, '<div class="acts"><button class="smallbtn" data-a="mint">Mint NFT to trade</button></div>'); const mb = c.querySelector('[data-a=mint]');
      mb.onclick = () => busy(mb, async () => { await S.mint(m.serial); toast(m.name + ' minted to your wallet.'); refreshMine(); refreshBalance(); }); box.append(c); continue; }
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
if (!location.hash || location.hash === '#arena' || location.hash === '#free') tab('pvp');
if (S.session()) afterSignIn();
window.phantom?.solana?.on?.('accountChanged', () => { if (!S.session()) { me = null; mine = []; q('pvWallet').textContent = 'Wallet changed. Sign in again.'; q('pvSignIn').textContent = 'Connect Phantom & sign in'; } });
})();
