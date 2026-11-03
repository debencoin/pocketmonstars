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
const PAGES = [['home', 'Home', '⌂'], ['pvp', 'Arena', '⚔'], ['play', 'Wild Expedition', '✦'], ['collection', 'Monstars', '◆'], ['market', 'Market', '◈'], ['breed', 'Breeding', '♥'], ['leaders', 'Leaderboard', '★'], ['guide', 'Guide', '?']];
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
window.tab = function (id) { baseTab(id); drawer.querySelectorAll('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === id)); if (id === 'home') renderHome(); };

// ---------- Home ----------
const home = el('section', { id: 'home', className: 'view hidden' }); main.prepend(home);
const heroes = SPECIES.filter(s => s.hero && s.drop.top).slice(0, 5);
home.innerHTML = `<div class="v6-hero"><div><div class="eyebrow">Battle · capture · evolve</div><h1>Your Monstars.<br><em>Your arena.</em></h1>
  <p class="muted">Real-time battles with original creatures. Play free right now, sign up to capture Monstars in the wild, or connect Phantom to battle for SOL.</p>
  <div class="v6-cta"><button class="primary" id="hmFree">Play free now</button><button class="smallbtn" id="hmPhantom">Connect Phantom</button></div></div>
  <div class="v6-heroart">${heroes.map(s => `<img src="art/hd/${s.art}_s4.png" alt="${esc(s.name)}" loading="lazy">`).join('')}</div></div>
  <div class="v6-cards">
   <button class="v6-card hot" data-go="pvp"><span class="k">1v1 · 3v3</span><b>Arena</b><span>Practice free vs the computer, or stake SOL against a real rival. Every hit moves SOL to your side.</span></button>
   <button class="v6-card drop" data-go="market"><span class="k">Launch drop</span><b>Superhero Drop</b><span id="hmDrop">30 one-of-one heroes. Top 5 at 1 SOL, the rest 0.5 SOL.</span></button>
   <button class="v6-card" data-go="play"><span class="k">Capture</span><b>Wild Expedition</b><span>103 wild Monstars. Get one into the red and capture it. Free with an account.</span></button>
   <button class="v6-card" data-go="collection"><span class="k">${SPECIES.length} Monstars</span><b>Monstar Dex</b><span>Every Monstar, all six evolutions, stats and abilities.</span></button>
   <button class="v6-card" data-go="leaders"><span class="k">Ranks</span><b>Leaderboard</b><span>Top players by SOL won.</span></button>
   <button class="v6-card" data-go="guide"><span class="k">How it works</span><b>Guide</b><span>Controls, evolutions, and how the money moves.</span></button>
  </div>`;
home.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
q('hmFree').onclick = () => { go('pvp'); setTimeout(() => q('pvPractice')?.click(), 50); };
q('hmPhantom').onclick = () => { go('pvp'); q('pvSignIn')?.click(); };
let dropInfo = null;
async function renderHome() {
  try { dropInfo ??= await S.drop(); } catch { return; }
  const ms = Math.max(0, dropInfo.endsAt - dropInfo.now), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, sold = dropInfo.heroes.filter(x => x.sold).length;
  q('hmDrop').textContent = ms ? `${30 - sold} of 30 heroes left · ends in ${d}d ${h}h. Top 5 at 1 SOL, the rest 0.5 SOL.` : 'The drop has ended.';
}

// ---------- Sign in: only the top-right button (username accounts; Phantom lives under the arena) ----------
const signDlg = el('dialog', { className: 'v6-dlg', id: 'v6Sign' });
signDlg.innerHTML = `<div class="v6-dlg-head"><h3>Sign in</h3><button class="v6-x" data-close aria-label="Close">✕</button></div><div id="v6SignBody"></div>
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
  const b = el('button', { className: 'primary wide v6-refbtn' }, '🔗 Refer friends · earn 5%');
  b.onclick = () => openReferral(b); q(sec)?.append(b);
}

// ---------- Guide: How the money moves ----------
const money = q('pvMoney'), guide = q('guide');
if (money && guide) { const h = guide.querySelector('h1'); (h?.nextElementSibling || h || guide).after(money); money.classList.add('v6-money'); }

// ---------- top-right button shows who is signed in ----------
const prev = window.PMV5?.signedIn;
window.PMV5 = { ...(window.PMV5 || {}), signedIn(me) {
  prev?.(me);
  if (topBtn) topBtn.textContent = me ? (me.startsWith('@') ? me.slice(1) : me.slice(0, 4) + '…' + me.slice(-4)) : 'Sign in';
  const st = q('v6PhState'); if (st) st.textContent = me && !me.startsWith('@') ? 'Phantom connected. You can stake SOL, buy heroes and mint NFTs.' : 'Connect Phantom to stake SOL, buy heroes and mint NFTs.';
  if (me && signDlg.open && me.startsWith('@')) signDlg.close();
} };
if (S.session()) window.PMV5.signedIn(S.session().wallet);

// ---------- start on Home (links like #arena, #wild, #market, #free still go straight there) ----------
const h = location.hash.slice(1);
const start = { arena: 'pvp', free: 'pvp', wild: 'play', market: 'market', collection: 'collection', guide: 'guide', leaders: 'leaders', breed: 'breed' }[h] || 'home';
setTimeout(() => window.tab(start), 0);
})();
