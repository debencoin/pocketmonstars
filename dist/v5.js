'use strict';
// v5: Breeding tab, full Monstar dex with every evolution, Superhero Drop (30-day countdown), referral link + QR code.
(() => {
const S = window.PMStake, PA = window.PMArena, API = window.PMArenaApi; if (!S || !API) return;
const { Monstars } = S, { SPECIES, COLLECTIONS } = Monstars;
const q = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const short = a => !a ? '—' : a.startsWith('@') ? a.slice(1) : a.slice(0, 4) + '…' + a.slice(-4);
const sol = l => (Number(BigInt(l)) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 9 });
const nav = document.querySelector('nav'), main = document.querySelector('main');
const toast = (m, err) => API.toast ? API.toast(m, err) : alert(m);
const fail = e => { const m = e?.message || String(e); toast(/4001|reject|declin/i.test(m) ? 'Request declined in Phantom. Nothing was sent.' : m.slice(0, 300), true); };
async function busy(btn, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = 'Working…'; try { return await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; btn.textContent = t; } }
const isAcct = () => (S.session()?.wallet || '').startsWith('@');
const STAGES = ['Infant', 'Rookie', 'Champion', 'Ultimate', 'Mega', 'Ascended'];
const LEVELS = [1, 3, 10, 25, 50, 80];
const art = (sp, st) => `art/hd/${sp.art}_s${st}.png`;

function addTab(id, label, before) {
  const b = el('button', { textContent: label }); b.dataset.tab = id; b.onclick = () => window.tab(id);
  nav.insertBefore(b, before || null);
  const sec = el('section', { id, className: 'view hidden' }); main.append(sec); return sec;
}

// ---------- Breeding tab ----------
const breedSec = addTab('breed', 'Breeding', nav.querySelector('[data-tab=market]'));
breedSec.innerHTML = `<div class="topline"><div><div class="eyebrow">Two parents · two new Infants</div><h1>Breeding</h1>
<p class="muted">Pair one of your Monstars with another player's. Breeding uses a small SOL fee, so it needs Phantom.</p></div></div>`;
const bp = q('pvBreed'); if (bp) breedSec.append(bp);

// ---------- Monstars tab: every species and all six evolutions ----------
const col = q('collection');
if (col) {
  [...col.children].forEach(c => c.hidden = true);
  const groups = [['genesis', 'Genesis'], ['frontier', 'Frontier'], ['anunnaki', 'Anunnaki'], ['watchers', 'Watchers'], ['mythic', 'Mythic'], ['heroes', 'Superhero Drop'], ['legendary', 'Legendary'], ['ascendants', 'Ascendants'], ['royals', 'Royal Anunnaki']];
  const dex = el('div', { id: 'v5Dex' }); col.append(dex);
  let filter = 'all', search = '';
  dex.innerHTML = `<div class="topline"><div><div class="eyebrow">Every Monstar · every evolution</div><h1>Monstar Dex</h1>
   <p class="muted">All ${SPECIES.length} Monstars and the six forms each one evolves into: Infant (Lv1), Rookie (Lv3), Champion (Lv10), Ultimate (Lv25), Mega (Lv50) and Ascended (Lv80). Each evolution unlocks an ability upgrade.</p></div></div>
   <div class="dx-bar"><input class="pv-input" id="dxSearch" placeholder="Search a Monstar" style="flex:1;min-width:0"><div class="dx-chips" id="dxChips"></div></div>
   <div id="dxList"></div>`;
  q('dxChips').innerHTML = [['all', 'All']].concat(groups).map(([k, n]) => `<button class="smallbtn" data-k="${k}" aria-pressed="${k === 'all'}">${n}</button>`).join('');
  q('dxChips').onclick = e => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.k; q('dxChips').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderDex(); };
  q('dxSearch').oninput = e => { search = e.target.value.trim().toLowerCase(); renderDex(); };
  function renderDex() {
    const list = SPECIES.filter(sp => (filter === 'all' || sp.collection === filter) && (!search || sp.forms.concat(sp.name, sp.type).join(' ').toLowerCase().includes(search)));
    q('dxList').innerHTML = list.length ? list.map(sp => `<div class="dx-row"><div class="dx-head"><b>${esc(sp.name)}</b><span>${esc(sp.type)} · ${esc(sp.cls.label)}${sp.tier ? ' · ' + esc(sp.tier) : ''}${sp.hero ? ' · ' + (sp.drop.top ? 'Top 5 hero' : 'Hero') : ''} · ${esc((COLLECTIONS?.[sp.collection]?.name) || sp.collection)}</span></div>
      <div class="dx-evo">${[0, 1, 2, 3, 4, 5].map(st => `<figure><img src="${art(sp, st)}" alt="${esc(Monstars.formName(sp, st))}" loading="lazy"><figcaption><b>${esc(Monstars.formName(sp, st))}</b><small>${STAGES[st]} · Lv${LEVELS[st]}</small></figcaption></figure>`).join('<i class="dx-arrow">›</i>')}</div></div>`).join('')
      : '<div class="pv-empty">No Monstar matches that.</div>';
  }
  renderDex();
  const btn = nav.querySelector('[data-tab=collection]'); if (btn) btn.textContent = 'Monstars';
}

// ---------- Superhero Drop (in the market tab) ----------
const mk = q('pvMarket');
const dropBox = el('div', { id: 'v5Drop', className: 'panel' });
if (mk) mk.insertBefore(dropBox, mk.children[1] || null);
let dropData = null, dropAt = 0, offset = 0;
async function loadDrop() { try { dropData = await S.drop(); offset = dropData.now - Date.now(); dropAt = Date.now(); renderDrop(); } catch { dropBox.innerHTML = '<div class="pv-empty">The drop is unavailable right now.</div>'; } }
function left() {
  const ms = Math.max(0, dropData.endsAt - (Date.now() + offset)), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60;
  return ms ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s` : 'Ended';
}
function renderDrop() {
  if (!dropData) return;
  const sold = dropData.heroes.filter(h => h.sold).length, ended = Date.now() + offset > dropData.endsAt, me = S.session()?.wallet;
  const card = h => { const sp = SPECIES[h.speciesId];
    return `<div class="dr-card${h.top ? ' top' : ''}${h.sold ? ' sold' : ''}">${h.top ? '<span class="dr-badge">TOP 5</span>' : ''}
      <img src="art/hd/${sp.art}_s2.png" alt="${esc(sp.name)}" loading="lazy"><div class="dr-evo">${[0, 3, 5].map(st => `<img src="${art(sp, st)}" alt="" loading="lazy">`).join('')}</div>
      <b>${esc(sp.name)}</b><small>${esc(sp.type)} · ${esc(sp.cls.label)} · Lv1</small>
      ${h.sold ? `<span class="pv-chip ok">Sold${h.owner ? ' · ' + esc(short(h.owner)) + (h.owner === me ? ' (you)' : '') : ''}</span>`
        : ended ? '<span class="pv-chip">Drop ended</span>'
        : `<button class="primary" data-buy="${h.speciesId}" ${h.held ? 'disabled' : ''}>${h.held ? 'Being bought…' : 'Buy · ' + sol(h.priceLamports) + ' SOL'}</button>`}</div>`; };
  dropBox.innerHTML = `<div class="dr-head"><div><div class="eyebrow">Launch drop · ${dropData.cluster === 'devnet' ? 'devnet test SOL' : 'SOL'}</div><h2>Superhero Drop</h2>
     <p class="pv-note">30 one-of-one hero Monstars. The top 5 are 1 SOL and stronger, the other 25 are 0.5 SOL. Each one hatches at level 1 and evolves into six hero forms. Buying needs Phantom.</p></div>
     <div class="dr-clock"><small>Ends in</small><b id="drClock">${left()}</b><small>${sold} / 30 sold</small></div></div>
    <h3 class="dr-sub">Top 5 · 1 SOL</h3><div class="dr-grid">${dropData.heroes.filter(h => h.top).map(card).join('')}</div>
    <h3 class="dr-sub">Heroes · 0.5 SOL</h3><div class="dr-grid">${dropData.heroes.filter(h => !h.top).map(card).join('')}</div>`;
  dropBox.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => busy(b, async () => {
    if (!S.session()) throw Error('Sign in with Phantom on the Arena tab to buy.');
    if (isAcct()) throw Error('The drop is paid in SOL. Sign out, then connect Phantom on the Arena tab to buy.');
    const sid = Number(b.dataset.buy), sp = SPECIES[sid];
    if (!confirm(`Buy ${sp.name} for ${sol(dropData.heroes.find(h => h.speciesId === sid).priceLamports)} SOL? Phantom will show the payment to approve.`)) return;
    const m = await S.dropBuy(sid); toast(`${m.form || sp.name} is yours! Find it in the Arena picker.`); API.refreshMine?.(); loadDrop();
  }));
}
setInterval(() => { const c = q('drClock'); if (c && dropData) c.textContent = left(); if (dropData && Date.now() - dropAt > 30000 && !q('market')?.classList.contains('hidden')) loadDrop(); }, 1000);

// ---------- Referral link + QR code ----------
const refBox = el('div', { id: 'v5Ref', className: 'panel', hidden: true });
const walletBar = document.querySelector('.pv-walletbar'); if (walletBar) walletBar.after(refBox);
async function renderRef() {
  const s = S.session(); refBox.hidden = !s; if (!s) return;
  let r; try { r = await S.referrals(); } catch { return; }
  const link = S.referralLink(r.code), acct = r.code.startsWith('@');
  refBox.innerHTML = `<h3>Refer friends · earn 5%</h3>
    <p class="pv-note" style="margin:6px 0 10px">Every time a player who joined with your link wins a SOL match, you get 5% of what they won, forever.${acct ? ' <b>Connect Phantom to receive SOL</b>: payouts only go to wallet referrers.' : ''}</p>
    <div class="rf-row"><img id="rfQr" alt="QR code for your referral link" width="120" height="120"><div class="rf-main">
     <input class="pv-input" id="rfLink" readonly value="${esc(link)}" aria-label="Your referral link">
     <div class="pv-row" style="margin-top:8px"><button class="smallbtn" id="rfCopy">Copy link</button>${navigator.share ? '<button class="smallbtn" id="rfShare">Share</button>' : ''}</div>
     <p class="pv-note" style="margin-top:8px"><b>${r.referred}</b> joined · <b>${sol(r.earnedLamports)} SOL</b> earned from ${r.payouts} win${r.payouts === 1 ? '' : 's'}</p></div></div>`;
  S.qrDataUrl(link).then(u => { const i = q('rfQr'); if (i) i.src = u; }).catch(() => {});
  q('rfCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Referral link copied.'); } catch { q('rfLink').select(); } };
  const sh = q('rfShare'); if (sh) sh.onclick = () => navigator.share({ title: 'PocketMonstars', text: 'Battle with me in PocketMonstars', url: link }).catch(() => {});
}

window.PMV5 = { signedIn() { renderRef(); renderDrop(); } };
const baseTab = window.tab;
window.tab = function (id) { baseTab(id); if (id === 'market') loadDrop(); };
loadDrop(); renderRef();
// Front page "Play free" opens a practice battle straight away.
if (location.hash === '#market') setTimeout(() => window.tab('market'), 300);
if (location.hash === '#free') setTimeout(() => { window.tab('pvp'); q('pvPractice')?.click(); }, 400);
})();
