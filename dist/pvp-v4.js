'use strict';
// v4 overlay: 1v1 Stake Duel (live per-hit SOL shares), one-of-a-kind Monstars per wallet, royalty marketplace.
(() => {
const S = window.PMStake; if (!S) return;
const { Monstars, Stake, ARENA } = S;
const q = id => document.getElementById(id);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '—';
const sol = (l, d = 6) => Stake.formatSol(BigInt(l), d);
const coarse = matchMedia('(pointer:coarse)').matches; if (coarse) document.body.classList.add('coarse');
const art = (window.creatureArt && window.creatureArt.length === 9) ? window.creatureArt : Monstars.SPECIES.map(s => { const i = new Image(); i.src = 'art/' + s.art + '.png'; return i; });
let toastT;
function toast(msg, err = false) { let t = q('pvToast'); if (!t) { t = el('div', { id: 'pvToast', className: 'pv-toast', role: 'status' }); document.body.append(t); } t.textContent = msg; t.classList.toggle('err', err); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4200); }
function fail(e) { const m = e?.message || String(e); toast(/4001|reject|declin/i.test(m) ? 'Request declined in Phantom. Nothing was sent.' : m.slice(0, 300), true); }
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Working…'; try { return await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; btn.textContent = t; } }

// ---------- nav + sections ----------
const nav = document.querySelector('nav');
const pvpBtn = el('button', { textContent: '1v1 Stake' }); pvpBtn.dataset.tab = 'pvp';
nav.insertBefore(pvpBtn, nav.children[1]);
pvpBtn.onclick = () => tab('pvp');
const main = document.querySelector('main');
const pvp = el('section', { id: 'pvp', className: 'view hidden' });
pvp.innerHTML = `
<div class="topline"><div><div class="eyebrow">Real-time 1v1 · Solana devnet</div><h1>Stake Duel</h1>
<p class="muted">Both players stake the same SOL. Every hit you land takes lamports from your rival's share. KO them and the whole pot is yours.</p></div>
<span class="pill" id="pvNet"><i class="dot"></i> DEVNET TEST SOL</span></div>
<div class="pv-grid">
 <div class="pv-col">
  <div class="pv-stage" id="pvStage">
   <canvas id="pvCanvas" width="960" height="540" aria-label="1v1 arena"></canvas>
   <div class="pv-hud" id="pvHud" hidden>
    <div class="pv-side"><b id="pvN0">You</b><div class="pv-bar"><i id="pvH0"></i></div><div class="pv-bar en"><i id="pvE0"></i></div><span class="pv-sol" id="pvS0">0</span></div>
    <div class="pv-mid"><span id="pvClock">90</span><small>SECONDS</small></div>
    <div class="pv-side r"><b id="pvN1">Rival</b><div class="pv-bar"><i id="pvH1"></i></div><div class="pv-bar en"><i id="pvE1"></i></div><span class="pv-sol" id="pvS1">0</span></div>
   </div>
   <div class="pv-pot" id="pvPot" hidden><div class="pv-potbar"><i id="pvP0" style="width:50%"></i><i id="pvP1" style="width:50%"></i></div><small id="pvPotTxt">Pot</small></div>
   <div class="pv-touch"><div class="pv-stickzone" id="pvZone"><div class="pv-stick" id="pvStick"><i id="pvKnob"></i></div></div>
    <div class="pv-btns"><button class="pv-btn grd" data-k="guard">GUARD</button><button class="pv-btn spl" data-k="sp">SPECIAL</button><button class="pv-btn dash" data-k="dash">DASH</button><button class="pv-btn atk" data-k="atk">ATTACK</button></div></div>
   <button class="smallbtn pv-exit" id="pvExit">Leave</button>
   <div class="pv-overlay" id="pvOverlay"><div class="big" id="pvBig">Ready to duel</div><div class="pv-note" id="pvSmall">Sign in with Phantom, pick your Monstar and create or join a match.</div><div class="pv-row" id="pvOvBtns"></div></div>
  </div>
  <p class="pv-note" id="pvKeys">${coarse ? 'Left thumb: drag anywhere to move. Right thumb: attack (hold), special, dash, guard. Attacks auto-aim at your rival.' : 'Move <b>WASD</b> · Attack <b>J</b> or click · Special <b>K</b> or right-click · Dash <b>Space</b> · Guard <b>L</b>. Your mouse aims.'}</p>
  <div class="panel"><div class="pv-row" style="justify-content:space-between"><h3>Your one-of-a-kind Monstars</h3><span class="pv-chip" id="pvCount">Sign in to reveal</span></div>
   <p class="pv-note" style="margin:6px 0 12px">Every wallet gets its own version of all nine species. DNA comes from your address, and the registry refuses any repeat look or stat roll, so no two Monstars are ever the same. Mint one to own it as an NFT you can trade or send.</p>
   <div class="pv-cards" id="pvCards"><div class="pv-empty">Sign in with Phantom to see your Monstars.</div></div></div>
 </div>
 <div class="pv-col">
  <div class="panel"><h3>Wallet</h3>
   <div id="pvWallet" class="pv-note" style="margin:8px 0">Not signed in.</div>
   <button class="primary wide" id="pvSignIn">Connect Phantom &amp; sign in</button>
   <p class="pv-note" id="pvPhantomHint" style="margin-top:8px">Signing in only signs a message. It never moves funds.</p></div>
  <div class="panel" id="pvLobby"><h3>Start a match</h3>
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
function cardHtml(m, extra = '') {
  return `<span class="pv-rar ${esc(m.traits.rarity)}">${esc(m.traits.rarity)}</span>
  <img src="art/${Monstars.SPECIES[m.speciesId].art}.png" alt="${esc(m.name)}" style="filter:hue-rotate(${m.traits.hue}deg)" loading="lazy">
  <span class="nm">${esc(m.name)}</span><span class="sub">${esc(m.className)} · ${esc(m.type)} · ${esc(m.traits.aura)} ${esc(m.traits.pattern)} · ${esc(m.traits.nature)}</span>
  ${statBars(m.stats)}${extra}`;
}
async function refreshMine() {
  if (!S.session()) return;
  try { mine = await S.myMonstars(); } catch (e) { return fail(e); }
  me = S.session()?.wallet;
  if (!picked || !mine.some(m => m.serial === picked)) picked = mine[0]?.serial ?? null;
  q('pvCount').textContent = mine.length + ' owned'; q('pvCount').classList.add('ok');
  const box = q('pvCards'); box.innerHTML = '';
  for (const m of mine) {
    const c = el('div', { className: 'pv-card' }); c.setAttribute('aria-pressed', m.serial === picked);
    c.innerHTML = cardHtml(m, `<div class="acts"><button class="smallbtn" data-a="pick">${m.serial === picked ? 'Selected' : 'Use in duel'}</button>${m.asset ? '<span class="pv-chip ok">Minted NFT</span>' : '<button class="smallbtn" data-a="mint">Mint NFT</button>'}</div>`);
    c.querySelector('[data-a=pick]').onclick = () => { picked = m.serial; refreshMine(); };
    const mb = c.querySelector('[data-a=mint]');
    if (mb) mb.onclick = () => busy(mb, async () => { await S.mint(m.serial); toast(m.name + ' minted to your wallet.'); refreshMine(); refreshBalance(); });
    box.append(c);
  }
  renderMineMarket();
}

// ---------- lobby ----------
async function stakeNote() {
  cfg ??= await S.getConfig().catch(() => null);
  let v; try { v = Stake.toLamports(q('pvStake').value || '0'); } catch { q('pvStakeNote').textContent = 'Enter an amount like 0.01'; return; }
  q('pvStakeNote').innerHTML = v === 0n ? 'Free match: no SOL moves.' : `Pot <b>${sol(v * 2n)} SOL</b>. A hit worth 10% of your rival's HP moves <b>${sol(v / 10n, 9)} SOL</b> to you. Minimum stake 0.001 SOL.`;
}
q('pvPresets').onclick = e => { const b = e.target.closest('button'); if (!b) return; q('pvPresets').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); q('pvStake').value = b.dataset.v; stakeNote(); };
q('pvStake').oninput = stakeNote; stakeNote();
function needSocket() { if (!S.session()) throw Error('Sign in with Phantom first.'); if (!ws || ws.readyState > 1) openSocket(); }
function sendWs(msg) { needSocket(); const go = () => ws.send(JSON.stringify(msg)); ws.readyState === 1 ? go() : ws.addEventListener('open', go, { once: true }); }
q('pvCreate').onclick = () => { try { const lam = Stake.toLamports(q('pvStake').value || '0'); sendWs({ t: 'create', stakeLamports: lam.toString(), serial: lam > 0n ? picked : undefined, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0 }); } catch (e) { fail(e); } };
q('pvJoin').onclick = () => { try { sendWs({ t: 'join', code: q('pvJoinCode').value.trim().toUpperCase(), serial: picked, speciesId: mine.find(m => m.serial === picked)?.speciesId ?? 0 }); } catch (e) { fail(e); } };
q('pvLeave').onclick = q('pvExit').onclick = () => { try { sendWs({ t: 'leave' }); } catch {} room = null; ended = null; renderRoom(); };
// One deposit per match. If the server hasn't seen it on-chain yet, re-check the SAME signature; never send a second transfer.
let pendingDeposit = null, depositRetries = 0;
q('pvDeposit').onclick = e => busy(e.target, async () => {
  if (pendingDeposit && pendingDeposit.code === room?.code) { sendWs({ t: 'deposit', signature: pendingDeposit.sig }); toast('Checking your deposit again…'); return; }
  const sig = await S.deposit(); pendingDeposit = { code: room?.code, sig }; depositRetries = 0;
  sendWs({ t: 'deposit', signature: sig }); toast('Deposit sent. Waiting for confirmation…'); refreshBalance();
});

function openSocket() {
  if (ws && ws.readyState <= 1) return;
  ws = S.connectSocket(onMsg);
  ws.onclose = () => { if (room && room.state === 'live') toast('Connection lost. Reconnecting…', true); setTimeout(() => { if (S.session()) openSocket(); }, 1500); };
}

function onMsg(m) {
  if (m.t === 'error') {
    if (/not found yet/i.test(m.error) && pendingDeposit && depositRetries < 10) { depositRetries++; setTimeout(() => sendWs({ t: 'deposit', signature: pendingDeposit.sig }), 3000); return toast('Waiting for Solana to confirm your deposit…'); }
    return toast(m.error, true);
  }
  if (m.t === 'room') { room = m; shares = m.shares; renderRoom(); return; }
  if (m.t === 'state') {
    if (room && room.state !== 'live') { room.state = 'live'; renderRoom(); }
    snapPrev = snapCur; snapCur = m.s; snapAt = performance.now(); setShares(m.shares); return;
  }
  if (m.t === 'hit') { setShares(m.shares, m); return; }
  if (m.t === 'end') { ended = { ...m }; if (room) room.state = room.stake === '0' ? 'done' : 'settling'; renderRoom(); return; }
  if (m.t === 'settlement') { ended = { ...(ended || {}), settlement: m }; if (room) room.state = m.ok ? (m.refund ? 'refunded' : 'settled') : 'needs review'; renderRoom(); refreshBalance(); return; }
  if (m.t === 'cancelled') { toast('Match cancelled (' + m.reason + ').' + (room?.players?.some(p => p.deposited) ? ' Deposits are being refunded.' : '')); if (room) room.state = 'cancelled'; renderRoom(); }
  if (m.t === 'left') { room = null; renderRoom(); }
}

function setShares(next, hit) {
  if (!next || !room) return;
  const you = room.you;
  const prev = shares; shares = next;
  for (const side of [0, 1]) {
    const idx = side === 0 ? you : 1 - you, span = q('pvS' + side);
    span.textContent = room.stake === '0' ? 'Free match' : sol(next[idx], 6) + ' SOL';
    if (prev && BigInt(prev[idx]) !== BigInt(next[idx])) { span.classList.remove('flash-up', 'flash-down'); void span.offsetWidth; span.classList.add(BigInt(next[idx]) > BigInt(prev[idx]) ? 'flash-up' : 'flash-down'); }
  }
  const pot = BigInt(next[0]) + BigInt(next[1]);
  if (pot > 0n) { const p = Number(BigInt(next[you]) * 1000n / pot) / 10; q('pvP0').style.width = p + '%'; q('pvP1').style.width = (100 - p) + '%'; q('pvPotTxt').textContent = `Your share ${p.toFixed(1)}% of ${sol(pot, 4)} SOL pot`; }
  if (hit && snapCur) {
    const vic = snapCur.f[1 - hit.attacker], att = snapCur.f[hit.attacker], fee = BigInt(hit.fee);
    pops.push({ x: vic.x, y: vic.y - 70, txt: `-${hit.damage}${hit.eff > 1 ? ' SUPER' : ''}`, col: hit.eff > 1 ? '#f5d488' : '#ffffff', t: 1 });
    if (fee > 0n) pops.push({ x: att.x, y: att.y - 90, txt: `+${sol(fee, 9)} SOL`, col: '#9ef0c8', t: 1.2 });
  }
}

function renderRoom() {
  q('pvRoom').hidden = !room; q('pvLobby').hidden = !!room && !['cancelled', 'settled', 'done', 'refunded'].includes(room.state);
  const live = room?.state === 'live';
  const stage = q('pvStage'), full = live && !ended;
  stage.classList.toggle('live', full);
  if (coarse && full && stage.parentElement !== document.body) { stageHome ??= stage.parentElement; stageNext = stage.nextSibling; document.body.append(stage); }
  else if (!(coarse && full) && stageHome && stage.parentElement === document.body) stageHome.insertBefore(stage, stageNext);
  q('pvHud').hidden = !(live || ended); q('pvPot').hidden = !(live || ended) || room?.stake === '0';
  if (!room) { q('pvOverlay').hidden = false; q('pvBig').textContent = 'Ready to duel'; q('pvSmall').textContent = me ? 'Create a match or join with a code.' : 'Sign in with Phantom to start.'; q('pvOvBtns').innerHTML = ''; return; }
  q('pvCode').textContent = room.code; q('pvRoomState').textContent = room.state;
  q('pvPlayers').innerHTML = [0, 1].map(i => { const p = room.players[i]; return p ? `<div class="pv-player"><b>${esc(p.monstar.name)}</b><small>${i === room.you ? 'You' : 'Rival'} · ${short(p.wallet)}</small><small>${esc(p.monstar.className)} · ${esc(p.monstar.type)}</small>${room.stake !== '0' ? `<span class="pv-chip ${p.deposited ? 'ok' : ''}">${p.deposited ? 'Deposited' : 'Deposit pending'}</span>` : ''}</div>` : '<div class="pv-player"><b>Waiting…</b><small>Share the code</small></div>'; }).join('');
  const myP = room.players[room.you];
  q('pvDeposit').hidden = !(room.state === 'deposit' && myP && !myP.deposited);
  q('pvDeposit').textContent = pendingDeposit?.code === room.code ? 'Check my deposit' : `Deposit ${sol(room.stake, 6)} SOL`;
  q('pvEscrow').innerHTML = room.escrow ? `Escrow: <span class="pv-addr">${esc(room.escrow)}</span>` : 'Free match: no escrow.';
  if (room.players.length === 2) { q('pvN0').textContent = room.players[room.you].monstar.name; q('pvN1').textContent = room.players[1 - room.you].monstar.name; }
  const ov = q('pvOverlay'), big = q('pvBig'), small = q('pvSmall'), btns = q('pvOvBtns'); btns.innerHTML = '';
  ov.hidden = live && !ended;
  if (ended) {
    const won = ended.winner === room.you, draw = ended.winner == null;
    big.textContent = draw ? 'Draw' : won ? 'Victory' : 'Defeated';
    const st = ended.settlement;
    small.innerHTML = room.stake === '0' ? `${ended.reason === 'ko' ? 'KO' : ended.reason === 'time' ? 'Time up' : 'Forfeit'} · free match`
      : st ? (st.ok ? `Paid out on-chain: you receive <b>${sol(st.payouts[room.you], 9)} SOL</b>. Company fee ${st.company} lamport. <a href="${esc(S.explorer(st.signature))}" target="_blank" rel="noopener">View transaction</a>` : `Settlement needs review: ${esc(st.error || st.signature || '')}`)
      : `${draw ? 'Each keeps their share.' : won ? 'You take the pot: ' + sol(ended.shares[room.you], 6) + ' SOL.' : 'Your rival takes the pot.'} Settling on Solana…`;
    const again = el('button', { className: 'primary', textContent: 'New match' }); again.onclick = () => { room = null; ended = null; snapCur = null; renderRoom(); };
    btns.append(again);
  } else if (room.state === 'waiting') { big.textContent = room.code; small.textContent = 'Waiting for your rival to join with this code.'; }
  else if (room.state === 'deposit') { big.textContent = 'Deposits'; small.textContent = `Both players deposit ${sol(room.stake, 6)} SOL into the match escrow. The duel starts when both confirm.`; }
  else if (room.state === 'countdown') { big.textContent = String(room.countdown || 'GO'); small.textContent = 'Get ready!'; }
  else if (room.state === 'cancelled') { big.textContent = 'Cancelled'; small.textContent = 'Any deposits are refunded minus the 0.000005 SOL network fee.'; }
}

// ---------- input ----------
const keys = {}, touch = { mx: 0, my: 0, atk: false, sp: false, dash: false, guard: false }; let mouse = null, mouseBtn = { l: false, r: false };
addEventListener('keydown', e => { if (room?.state !== 'live') return; keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const cv = q('pvCanvas'), ctx = cv.getContext('2d');
cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) / r.width * ARENA.w, y: (e.clientY - r.top) / r.height * ARENA.h }; });
cv.addEventListener('mousedown', e => { if (e.button === 2) mouseBtn.r = true; else mouseBtn.l = true; });
addEventListener('mouseup', e => { if (e.button === 2) mouseBtn.r = false; else mouseBtn.l = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
const zone = q('pvZone'), stick = q('pvStick'), knob = q('pvKnob'); let stickId = null, origin = null;
zone.addEventListener('pointerdown', e => { stickId = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch {} const r = zone.getBoundingClientRect(); origin = { x: e.clientX, y: e.clientY }; stick.style.display = 'block'; stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px'; });
zone.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; let dx = e.clientX - origin.x, dy = e.clientY - origin.y; const d = Math.hypot(dx, dy), R = 50; if (d > R) { dx *= R / d; dy *= R / d; } touch.mx = dx / R; touch.my = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; });
const endStick = e => { if (e.pointerId !== stickId) return; stickId = null; touch.mx = touch.my = 0; stick.style.display = 'none'; knob.style.transform = ''; };
zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);
pvp.querySelectorAll('.pv-btn').forEach(b => { const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} });
  const up = () => { touch[k] = false; b.classList.remove('on'); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); });

let lastSent = '', lastSendAt = 0;
function sendInput() {
  if (room?.state !== 'live' || !ws || ws.readyState !== 1 || !snapCur) return;
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  if (Math.abs(touch.mx) > 0.12 || Math.abs(touch.my) > 0.12) { mx = touch.mx; my = touch.my; }
  const meF = snapCur.f[room.you], foe = snapCur.f[1 - room.you];
  let ax, ay;
  if (mouse && !coarse) { ax = mouse.x - meF.x; ay = mouse.y - meF.y; } else { ax = foe.x - meF.x; ay = foe.y - meF.y; } // touch: auto-aim at rival
  const i = { mx, my, ax, ay, atk: !!(keys.KeyJ || mouseBtn.l || touch.atk), sp: !!(keys.KeyK || mouseBtn.r || touch.sp), dash: !!(keys.Space || touch.dash), guard: !!(keys.KeyL || touch.guard) };
  const s = JSON.stringify(i), now = performance.now();
  if (s !== lastSent || now - lastSendAt > 200) { ws.send(JSON.stringify({ t: 'input', i })); lastSent = s; lastSendAt = now; }
}
setInterval(sendInput, 50);

// ---------- render ----------
const TYPE_COL = { EMBER: '#ff8a4a', GROVE: '#7ed37a', TIDE: '#5ec2ff', SPARK: '#ffe14a', SHADE: '#b98cff', STONE: '#cdb38a', FROST: '#c6f1ff', ASTRAL: '#ffd97a' };
function lerp(a, b, t) { return a + (b - a) * t; }
function drawGround() {
  const g = ctx.createRadialGradient(480, 270, 60, 480, 270, 560); g.addColorStop(0, '#2f4a35'); g.addColorStop(1, '#16241b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, ARENA.w, ARENA.h);
  ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 2; ctx.strokeRect(18, 18, ARENA.w - 36, ARENA.h - 36);
  ctx.beginPath(); ctx.moveTo(480, 18); ctx.lineTo(480, ARENA.h - 18); ctx.stroke();
  ctx.beginPath(); ctx.arc(480, 270, 110, 0, Math.PI * 2); ctx.stroke();
  for (const r of ARENA.rocks) {
    ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(r.x + 6, r.y + 10, r.r, r.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    const rg = ctx.createRadialGradient(r.x - r.r / 3, r.y - r.r / 3, 4, r.x, r.y, r.r); rg.addColorStop(0, '#a9a08a'); rg.addColorStop(1, '#5b5546');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
  }
}
function drawFighter(f, prev, t, idx, mon) {
  const x = prev ? lerp(prev.x, f.x, t) : f.x, y = prev ? lerp(prev.y, f.y, t) : f.y;
  const img = art[f.s], hue = mon?.traits?.hue || 0, flip = f.fx < 0;
  ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(x, y + 34, 38, 10, 0, 0, Math.PI * 2); ctx.fill();
  const ring = idx === room?.you ? '#dfff84' : '#ff7b6b'; ctx.strokeStyle = ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 34, 42, 12, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); if (f.i) ctx.globalAlpha = 0.45; ctx.translate(x, y + Math.sin(performance.now() / 200 + idx) * 2); if (flip) ctx.scale(-1, 1);
  ctx.filter = `hue-rotate(${hue}deg)`;
  if (img?.complete && img.naturalWidth) { const ratio = img.naturalWidth / img.naturalHeight, h = 120, w = h * ratio; ctx.drawImage(img, -w / 2, 38 - h, w, h); }
  else { ctx.fillStyle = Monstars.SPECIES[f.s].color; ctx.beginPath(); ctx.arc(0, -10, 32, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.filter = 'none';
  if (f.g) { ctx.strokeStyle = '#f5d488'; ctx.lineWidth = 4; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y - 10, 58, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  const ax = x + f.fx * 62, ay = y - 10 + f.fy * 62, a = Math.atan2(f.fy, f.fx);
  ctx.fillStyle = ring; ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * 10, ay + Math.sin(a) * 10); ctx.lineTo(ax + Math.cos(a + 2.5) * 9, ay + Math.sin(a + 2.5) * 9); ctx.lineTo(ax + Math.cos(a - 2.5) * 9, ay + Math.sin(a - 2.5) * 9); ctx.fill();
}
let lastFrame = performance.now();
function draw() {
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  drawGround();
  if (snapCur && room?.players?.length === 2) {
    const t = Math.min(1, (now - snapAt) / 66);
    snapCur.f.forEach((f, i) => drawFighter(f, snapPrev?.f[i], t, i, room.players[i].monstar));
    for (const p of snapCur.p) {
      const pp = snapPrev?.p.find(o => o.id === p.id), x = pp ? lerp(pp.x, p.x, t) : p.x, y = pp ? lerp(pp.y, p.y, t) : p.y, col = TYPE_COL[p.ty] || '#fff';
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(x, y - 10, p.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 10, p.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    const you = snapCur.f[room.you], foe = snapCur.f[1 - room.you];
    q('pvH0').style.width = (you.hp / you.max * 100) + '%'; q('pvH1').style.width = (foe.hp / foe.max * 100) + '%';
    q('pvE0').style.width = you.en + '%'; q('pvE1').style.width = foe.en + '%';
    q('pvClock').textContent = Math.max(0, Math.ceil(ARENA.roundSeconds - snapCur.t));
    ctx.font = '700 22px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
    for (const p of pops) { p.t -= dt; p.y -= 40 * dt; ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 2)); ctx.fillStyle = '#000'; ctx.fillText(p.txt, p.x + 2, p.y + 2); ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y); }
    ctx.globalAlpha = 1; pops = pops.filter(p => p.t > 0);
  }
  if (!pvp.classList.contains('hidden') || q('pvStage').classList.contains('live')) requestAnimationFrame(draw);
}

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
renderRoom(); drawGround();
if (S.session()) afterSignIn();
window.phantom?.solana?.on?.('accountChanged', () => { if (!S.session()) { me = null; mine = []; q('pvWallet').textContent = 'Wallet changed. Sign in again.'; q('pvSignIn').textContent = 'Connect Phantom & sign in'; } });
})();
