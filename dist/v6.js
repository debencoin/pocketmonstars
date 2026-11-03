'use strict';
// v6: ☰ menu with Home first, Home screen, sign-in only at the top right, Connect Phantom under the arena,
// referral button (copies your link, then shows the QR code), and "How the money moves" in the Guide.
(() => {
const S = window.PMStake, API = window.PMArenaApi; if (!S || !API) return;
const q = id => document.getElementById(id), $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const toast = (m, e) => API.toast?.(m, e);
const { SPECIES } = S.Monstars;
const main = $('main'), header = $('header');

// ---------- ☰ menu (all pages, Home first) ----------
const PAGES = [['home', 'Home', '⌂'], ['pvp', 'Arena', '⚔'], ['guild', 'Immortal Guild', '☠'], ['play', 'Wild Expedition', '✦'], ['collection', 'Monstars', '◆'], ['market', 'Market', '◈'], ['breed', 'Breeding', '♥'], ['leaders', 'Leaderboard', '★'], ['guide', 'Guide', '?']];
const burger = el('button', { className: 'v6-burger', ariaLabel: 'Menu' }, '<span></span><span></span><span></span>');
burger.setAttribute('aria-label', 'Open menu'); burger.setAttribute('aria-expanded', 'false');
header.prepend(burger);
const drawer = el('div', { className: 'v6-drawer', id: 'v6Drawer' });
drawer.innerHTML = `<div class="v6-scrim" data-close></div><aside class="v6-menu" role="dialog" aria-label="Menu"><div class="v6-menu-head"><b>✦ PocketMonstars</b><button class="v6-x" data-close aria-label="Close menu">✕</button></div>
  <ul>${PAGES.map(([id, label, icon]) => `<li><button data-go="${id}"><i aria-hidden="true">${icon}</i>${label}</button></li>`).join('')}</ul></aside>`;
document.body.append(drawer);
const openMenu = on => { drawer.classList.toggle('open', on); burger.setAttribute('aria-expanded', on); if (on) drawer.querySelector(`[data-go]`).focus(); };
burger.onclick = () => openMenu(true);
drawer.addEventListener('click', e => { if (e.target.closest('[data-close]')) openMenu(false); const g = e.target.closest('[data-go]'); if (g) { openMenu(false); go(g.dataset.go); } });
addEventListener('keydown', e => { if (e.key === 'Escape') openMenu(false); });
function go(id) { window.tab(id); scrollTo({ top: 0 }); try { history.replaceState(null, '', '#' + (id === 'pvp' ? 'arena' : id === 'play' ? 'wild' : id)); } catch {} }
const baseTab = window.tab;
window.tab = function (id) { baseTab(id); drawer.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id)); if (id === 'home') renderHome(); if (id === 'market') renderAvatarShop?.(); };

// ---------- Home ----------
const home = el('section', { id: 'home', className: 'view hidden' }); main.prepend(home);
const heroes = SPECIES.filter(s => s.hero && s.drop.top).slice(0, 5);
home.innerHTML = `<div class="v6-hero"><div><div class="eyebrow">Battle · Capture · Evolve</div><h1>Your Monstars.<br><em>Your Arena!</em></h1>
  <p class="muted">Real-Time Battles With Original Creatures. Play Free Right Now, Sign Up To Capture Monstars In The Wild, Or Connect Phantom To Battle For SOL.</p>
  <div class="v6-cta"><button class="primary" id="hmFree">Play Free Now</button><button class="smallbtn" id="hmPhantom">Connect Phantom</button></div></div>
  <div class="v6-heroart">${heroes.map(s => `<img src="art/hd/${s.art}_s4.png" alt="${esc(s.name)}" loading="lazy">`).join('')}</div></div>
  <div class="v6-cards">
   <button class="v6-card hot" data-go="pvp"><span class="k">1v1 · 3v3</span><b>Arena</b><span>Practice Free Vs The Computer, Or Stake SOL Against A Real Rival. Every Hit Moves SOL To Your Side.</span></button>
   <button class="v6-card drop" data-go="market"><span class="k">Launch Drop</span><b>Superhero Drop</b><span id="hmDrop">30 One-Of-One Heroes. Top 5 At 1 SOL, The Rest 0.5 SOL.</span></button>
   <button class="v6-card" data-go="play"><span class="k">Capture</span><b>Wild Expedition</b><span>103 Wild Monstars. Get One Into The Red And Capture It. Free With An Account.</span></button>
   <button class="v6-card" data-go="collection"><span class="k">${SPECIES.length} Monstars</span><b>Monstar Dex</b><span>Every Monstar, All Six Evolutions, Stats And Abilities.</span></button>
   <button class="v6-card" data-go="leaders"><span class="k">Ranks</span><b>Leaderboard</b><span>Top Players By SOL Won.</span></button>
   <button class="v6-card" data-go="guide"><span class="k">How It Works</span><b>Guide</b><span>Controls, Evolutions, And How The Money Moves.</span></button>
  </div>`;
home.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
q('hmFree').onclick = () => { go('pvp'); setTimeout(() => q('pvPractice')?.click(), 50); };
q('hmPhantom').onclick = () => { go('pvp'); q('pvSignIn')?.click(); };
let dropInfo = null;
async function renderHome() {
  try { dropInfo ??= await S.drop(); } catch { return; }
  const ms = Math.max(0, dropInfo.endsAt - dropInfo.now), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, sold = dropInfo.heroes.filter(x => x.sold).length;
  q('hmDrop').textContent = ms ? `${30 - sold} Of 30 Heroes Left · Ends In ${d}d ${h}h. Top 5 At 1 SOL, The Rest 0.5 SOL.` : 'The Drop Has Ended.';
}

// ---------- Sign in: only the top-right button (username accounts; Phantom lives under the arena) ----------
const signDlg = el('dialog', { className: 'v6-dlg', id: 'v6Sign' });
signDlg.innerHTML = `<div class="v6-dlg-head"><h3>Sign In</h3><button class="v6-x" data-close aria-label="Close">✕</button></div><div id="v6SignBody"></div>
  <p class="pv-note" style="margin-top:12px">Want to play for SOL? Use <b>Connect Phantom</b> on the Arena.</p>`;
document.body.append(signDlg);
signDlg.addEventListener('click', e => { if (e.target === signDlg || e.target.closest('[data-close]')) signDlg.close(); });
const bar = $('.pv-walletbar');
if (bar) { bar.querySelector('h3')?.remove(); q('v6SignBody').append(bar); bar.classList.add('v6-inbox'); }
const topBtn = q('appSignIn');
if (topBtn) topBtn.onclick = () => { signDlg.showModal(); setTimeout(() => (S.session() ? q('pvSignOut') : q('pvUser'))?.focus(), 30); };

// ---------- Connect Phantom right under the arena, then Choose your Monstar ----------
const stage = q('pvStage'), ph = el('div', { className: 'panel v6-phantom', id: 'v6Phantom' });
ph.innerHTML = `<div class="v6-ph-row"><div><b>Play for SOL</b><small id="v6PhState">Connect Phantom to stake SOL, buy heroes and mint NFTs.</small></div></div>`;
if (stage) {
  stage.after(ph);
  const btn = q('pvSignIn'), hint = q('pvPhantomHint'); $('.pv-or')?.remove();
  if (btn) { btn.textContent = 'Connect Phantom'; ph.querySelector('.v6-ph-row').append(btn); }
  if (hint) ph.append(hint);
  const lobby = q('pvLobby'); if (lobby) ph.after(lobby);
}

// ---------- Referral: a button at the bottom; tap copies your link, then shows the QR code ----------
const refDlg = el('dialog', { className: 'v6-dlg', id: 'v6Ref' });
refDlg.innerHTML = `<div class="v6-dlg-head"><h3>Refer friends · earn 5%</h3><button class="v6-x" data-close aria-label="Close">✕</button></div><div id="v6RefBody"></div>`;
document.body.append(refDlg);
refDlg.addEventListener('click', e => { if (e.target === refDlg || e.target.closest('[data-close]')) refDlg.close(); });
const v5Ref = q('v5Ref'); if (v5Ref) v5Ref.classList.add('app-gone');
async function openReferral(btn) {
  if (!S.session()) { toast('Sign in first to get your referral link.'); signDlg.showModal(); return; }
  btn.disabled = true;
  try {
    const r = await S.referrals(), link = S.referralLink(r.code), acct = r.code.startsWith('@');
    let copied = false; try { await navigator.clipboard.writeText(link); copied = true; } catch {}
    q('v6RefBody').innerHTML = `<p class="v6-copied">${copied ? '✓ Link copied' : 'Copy your link below'}</p>
      <img id="v6Qr" class="v6-qr" alt="QR code for your referral link" width="220" height="220">
      <input class="pv-input" id="v6Link" readonly value="${esc(link)}" aria-label="Your referral link">
      <div class="pv-row" style="margin-top:8px"><button class="smallbtn" id="v6Copy">Copy again</button>${navigator.share ? '<button class="smallbtn" id="v6Share">Share</button>' : ''}</div>
      <p class="pv-note" style="margin-top:10px">When someone who joined with your link wins a SOL match, you get 5% of what they won, forever.${acct ? ' <b>Connect Phantom to receive SOL</b>: payouts only go to wallets.' : ''}</p>
      <p class="pv-note"><b>${r.referred}</b> joined · <b>${(Number(BigInt(r.earnedLamports)) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL</b> earned</p>`;
    S.qrDataUrl(link).then(u => { const i = q('v6Qr'); if (i) i.src = u; }).catch(() => {});
    q('v6Copy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Referral link copied.'); } catch { q('v6Link').select(); } };
    const sh = q('v6Share'); if (sh) sh.onclick = () => navigator.share({ title: 'PocketMonstars', text: 'Battle with me in PocketMonstars', url: link }).catch(() => {});
    refDlg.showModal(); if (copied) toast('Referral link copied.');
  } catch (e) { toast(e.message || String(e), true); } finally { btn.disabled = false; }
}
for (const sec of ['pvp', 'home']) {
  const b = el('button', { className: 'primary wide v6-refbtn' }, '🔗 Refer Friends · Earn 5%');
  b.onclick = () => openReferral(b); q(sec)?.append(b);
}

// ---------- Guide: How the money moves ----------
const money = q('pvMoney'), guide = q('guide');
if (money && guide) { const h = guide.querySelector('h1'); (h?.nextElementSibling || h || guide).after(money); money.classList.add('v6-money'); }

// ---------- Profile: once connected, the Arena shows who you are, with your avatar ----------
const prof = el('div', { className: 'v6-prof', id: 'v6Prof', hidden: true });
ph.prepend(prof);
const avDlg = el('dialog', { className: 'v6-dlg', id: 'v6Av' });
avDlg.innerHTML = `<div class="v6-dlg-head"><h3>Choose your avatar</h3><button class="v6-x" data-close aria-label="Close">✕</button></div><div id="v6AvBody"></div>`;
document.body.append(avDlg);
avDlg.addEventListener('click', e => { if (e.target === avDlg || e.target.closest('[data-close]')) avDlg.close(); });
let myProfile = null;
const shortId = id => (id.startsWith('@') ? id.slice(1) : id.slice(0, 4) + '…' + id.slice(-4));
async function renderProfile(me) {
  prof.hidden = !me; const row = ph.querySelector('.v6-ph-row'), btn = q('pvSignIn'), hint = q('pvPhantomHint');
  const wallet = me && !me.startsWith('@');
  if (row) row.hidden = wallet; if (hint) hint.hidden = wallet; // Phantom already connected: the profile replaces the connect button
  if (!me) { myProfile = null; setTopAvatar(null); return; }
  try { myProfile = await S.profile(); } catch { myProfile = { id: me, avatar: null, photos: [], monstars: [] }; }
  const av = myProfile.avatar;
  prof.innerHTML = `<button class="v6-av" id="v6AvBtn" aria-label="Change avatar">${av ? `<img src="${esc(av.img)}" alt="">` : '<span>?</span>'}<i>✎</i></button>
    <div class="v6-prof-main"><span class="v6-conn">● ${wallet ? 'Phantom connected' : 'Signed in · free account'}</span><b>${esc(shortId(me))}</b>
    <small>${av ? 'Avatar: ' + esc(av.name) : 'Pick an avatar'}${wallet ? '<span id="v6Bal"></span>' : ''}</small></div>
    <button class="smallbtn" id="v6AvChange">Avatar</button>`;
  q('v6AvBtn').onclick = q('v6AvChange').onclick = openAvatars;
  if (wallet) S.balance(me).then(b => { const e = q('v6Bal'); if (e) e.textContent = ' · ' + (Number(b) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' SOL'; }).catch(() => {});
  setTopAvatar(av);
}
function setTopAvatar(av) {
  if (!topBtn) return; const me = S.session()?.wallet;
  topBtn.innerHTML = me ? `${av ? `<img class="v6-topav" src="${esc(av.thumb || av.img)}" alt="">` : ''}<span>${esc(shortId(me))}</span>` : 'Sign In';
}
function openAvatars() {
  const p = myProfile; if (!p) return;
  const cur = p.avatar ? (p.avatar.kind === 'photo' ? 'a:' + p.avatar.id : 'm:' + p.avatar.serial) : '';
  const tile = (v, img, name, sub) => `<button class="v6-avtile${v === cur ? ' on' : ''}" data-v="${v}"><img src="${esc(img)}" alt="" loading="lazy"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  q('v6AvBody').innerHTML = (p.photos.length ? `<h4 class="v6-avh">Your avatar NFTs</h4><div class="v6-avgrid">${p.photos.map(a => tile('a:' + a.id, a.img, a.name, 'One of one')).join('')}</div>` : '')
    + `<h4 class="v6-avh">Your Monstars</h4><div class="v6-avgrid">${p.monstars.map(m => tile('m:' + m.serial, m.img, m.name, 'Lv' + m.level)).join('') || '<p class="pv-note">No Monstars yet.</p>'}</div>
    <p class="pv-note" style="margin-top:10px">More avatars are sold in the <b>Market</b>.</p>`;
  q('v6AvBody').querySelectorAll('[data-v]').forEach(b => b.onclick = async () => { try { myProfile = await S.setAvatar(b.dataset.v); avDlg.close(); renderProfile(S.session()?.wallet); toast('Avatar updated.'); } catch (e) { toast(e.message, true); } });
  avDlg.showModal();
}

// ---------- Market: Avatars ----------
const avShop = el('div', { className: 'panel', id: 'v6AvShop' });
const dropPanel = q('v5Drop'); (dropPanel || q('pvMarket'))?.after(avShop);
async function renderAvatarShop() {
  let list; try { list = (await S.avatars()).avatars; } catch { avShop.innerHTML = ''; return; }
  const me = S.session()?.wallet;
  avShop.innerHTML = `<div class="eyebrow">Profile pictures</div><h2 style="margin:4px 0">Avatars</h2>
    <p class="pv-note">One-of-one profile avatars. Your avatar shows on your profile in the Arena. More are coming soon.</p>
    <div class="v6-avgrid big">${list.map(a => `<div class="v6-avcard"><img src="${esc(a.img)}" alt="${esc(a.name)}" loading="lazy"><b>${esc(a.name)}</b>
      ${a.forSale ? `<button class="primary" data-buyav="${esc(a.id)}">Buy · ${(Number(a.priceLamports) / 1e9).toLocaleString()} SOL</button>`
        : `<span class="pv-chip ok">${a.owner === me ? 'Yours' : 'Owned' + (a.owner ? ' · ' + esc(shortId(a.owner)) : '')}</span>`}
      ${a.note ? `<small>${esc(a.note)}</small>` : ''}</div>`).join('')}
      <div class="v6-avcard soon"><span>+</span><b>More avatars</b><small>Coming soon</small></div></div>`;
  avShop.querySelectorAll('[data-buyav]').forEach(b => b.onclick = async () => {
    if (!S.session() || S.session().wallet.startsWith('@')) return toast('Connect Phantom on the Arena to buy avatars.', true);
    b.disabled = true; try { myProfile = await S.avatarBuy(b.dataset.buyav); toast('Avatar bought and set on your profile.'); renderProfile(S.session().wallet); renderAvatarShop(); } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
  });
}

// ---------- top-right button shows who is signed in ----------
const prev = window.PMV5?.signedIn;
window.PMV5 = { ...(window.PMV5 || {}), signedIn(me) {
  prev?.(me);
  renderProfile(me);
  const st = q('v6PhState'); if (st) st.textContent = me && !me.startsWith('@') ? 'Phantom connected. You can stake SOL, buy heroes and mint NFTs.' : 'Connect Phantom to stake SOL, buy heroes and mint NFTs.';
  if (me && signDlg.open && me.startsWith('@')) signDlg.close();
} };
if (S.session()) window.PMV5.signedIn(S.session().wallet);

// ---------- start on Home (links like #arena, #wild, #market, #free still go straight there) ----------
const h = location.hash.slice(1);
const start = { arena: 'pvp', free: 'pvp', wild: 'play', market: 'market', collection: 'collection', guide: 'guide', leaders: 'leaders', breed: 'breed', guild: 'guild' }[h] || 'home';
setTimeout(() => window.tab(start), 0);
})();
