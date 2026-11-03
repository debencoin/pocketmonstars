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
// Attributes: stats (at a given level, average DNA), class passive and the five abilities of a species.
const { STAT_KEYS, STAT_LABELS } = Monstars;
function statsOf(sp, level) { const m = new Monstars.Monstar({ speciesId: sp.id, level }); return m.stats; }
function attrHtml(sp, level = 50, compact = false) {
  const st = statsOf(sp, level), K = sp.kit, total = STAT_KEYS.reduce((t, k) => t + st[k], 0);
  const bars = STAT_KEYS.map(k => `<span>${STAT_LABELS[k]}</span><i><s style="width:${Math.min(100, st[k] / (level >= 50 ? 3.2 : 2.6))}%"></s></i><em>${st[k]}</em>`).join('');
  const abil = [['Attack', K.basic.name], ['Special', K.special.name], ['Dash', K.dash.name + ': ' + K.dash.note], ['Guard', K.guard.name + ': ' + K.guard.note], ['Mega Shot', K.mega.name + ': ' + K.mega.note]];
  return `<div class="at-box${compact ? ' compact' : ''}"><div class="at-stats"><div class="pv-stats">${bars}</div><small>Stats at Lv${level} · total ${total}${sp.starter ? ' · +20% starter bender power' : sp.bender ? (sp.elite ? ' · +80% elite bender power' : ' · +55% bender power') : sp.giftHero ? ' · +45% legend hero power' : sp.drop ? (sp.drop.top ? ' · +25% hero bonus' : ' · +15% hero bonus') : sp.legendary ? ' · +20% legendary bonus' : ''}</small></div>
    <details class="at-abil"${compact ? '' : ' open'}><summary>Abilities &amp; passive</summary><ul>${abil.map(([k, v]) => `<li><b>${k}</b> ${esc(v)}</li>`).join('')}<li><b>Passive</b> ${esc(sp.cls.passive)}</li></ul></details></div>`;
}

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
  const groups = [['skybenders', 'Sky Benders'], ['legendheroes', 'Legend Heroes'], ['benders', 'Elemental Benders'], ['heroes', 'Superhero Drop'], ['frontier', 'Frontier'], ['anunnaki', 'Anunnaki'], ['watchers', 'Watchers'], ['mythic', 'Mythic'], ['legendary', 'Legendary'], ['ascendants', 'Ascendants'], ['royals', 'Royal Anunnaki'], ['genesis', 'Original nine']];
  const ORDER = Object.fromEntries(groups.map(([k], i) => [k, i]));
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
    const list = SPECIES.slice().sort((a, b) => (ORDER[a.collection] ?? 99) - (ORDER[b.collection] ?? 99) || a.id - b.id).filter(sp => (filter === 'all' || sp.collection === filter) && (!search || sp.forms.concat(sp.name, sp.type).join(' ').toLowerCase().includes(search)));
    q('dxList').innerHTML = list.length ? list.map(sp => `<div class="dx-row"><div class="dx-head"><b>${esc(sp.name)}</b><span>${esc(sp.type)} · ${esc(sp.cls.label)}${sp.tier ? ' · ' + esc(sp.tier) : ''}${sp.hero ? ' · ' + (sp.drop.top ? 'Top 5 hero' : 'Hero') : ''} · ${esc((COLLECTIONS?.[sp.collection]?.name) || sp.collection)}</span></div>
      <div class="dx-evo">${[0, 1, 2, 3, 4, 5].map(st => `<figure><img src="${art(sp, st)}" alt="${esc(Monstars.formName(sp, st))}" loading="lazy"><figcaption><b>${esc(Monstars.formName(sp, st))}</b><small>${STAGES[st]} · Lv${LEVELS[st]}</small></figcaption></figure>`).join('<i class="dx-arrow">›</i>')}</div>
      <details class="dx-more"><summary>Attributes</summary>${attrHtml(sp, 50)}</details></div>`).join('')
      : '<div class="pv-empty">No Monstar matches that.</div>';
  }
  renderDex();
  const btn = nav.querySelector('[data-tab=collection]'); if (btn) btn.textContent = 'Monstars';
}

// ---------- Superhero Drop (in the market tab) ----------
const mk = q('pvMarket');
const dropBox = el('div', { id: 'v5Drop', className: 'panel' });
if (mk) mk.insertBefore(dropBox, mk.children[1] || null);
let dropData = null, dropAt = 0, offset = 0, card = null;
// Card price: the same price as in SOL, in dollars at the live SOL price (Stripe's minimum is $0.50)
const usdOf = lam => '$' + (Math.max(50, Math.round(Number(lam) / 1e9 * (card?.solUsd || 0) * 100)) / 100).toFixed(2);
const cardBtn = (sid, lam) => card?.enabled && card.solUsd ? `<button class="smallbtn pay-card" data-card="${sid}">💳 Pay with card · ${usdOf(lam)}</button>` : '';
function wireCard(box) { box.querySelectorAll('[data-card]').forEach(b => b.onclick = () => busy(b, async () => {
  if (!S.session()) throw Error('Sign in first (top right): a free account or Phantom both work for card payments.');
  const sp = SPECIES[Number(b.dataset.card)]; if (!confirm(`Pay for ${sp.name} with a debit or credit card? You'll go to Stripe's secure checkout and come back here.`)) return;
  await S.cardBuy(sp.id); })); }
async function loadDrop() { try { if (!card) card = await S.cardStatus().catch(() => ({ enabled: false })); dropData = await S.drop(); offset = dropData.now - Date.now(); dropAt = Date.now(); renderDrop(); } catch { dropBox.innerHTML = '<div class="pv-empty">The drop is unavailable right now.</div>'; } }
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
      <b>${esc(sp.name)}</b><small>${esc(sp.type)} · ${esc(sp.cls.label)} · Lv1</small>${attrHtml(sp, 1, true)}
      ${h.sold ? `<span class="pv-chip ok">Sold${h.owner ? ' · ' + esc(short(h.owner)) + (h.owner === me ? ' (you)' : '') : ''}</span>`
        : ended ? '<span class="pv-chip">Drop ended</span>'
        : `<button class="primary" data-buy="${h.speciesId}" ${h.held ? 'disabled' : ''}>${h.held ? 'Being bought…' : 'Buy · ' + sol(h.priceLamports) + ' SOL'}</button>${h.held ? '' : cardBtn(h.speciesId, h.priceLamports)}`}</div>`; };
  dropBox.innerHTML = `<div class="dr-head"><div><div class="eyebrow">Launch drop · ${dropData.cluster === 'devnet' ? 'devnet test SOL' : 'SOL'}</div><h2>Superhero Drop</h2>
     <p class="pv-note">30 one-of-one hero Monstars. The top 5 are 1 SOL and stronger, the other 25 are 0.5 SOL. Each one hatches at level 1 and evolves into six hero forms. Buying needs Phantom.</p></div>
     <div class="dr-clock"><small>Ends in</small><b id="drClock">${left()}</b><small>${sold} / 30 sold</small></div></div>
    <h3 class="dr-sub">Top 5 · 1 SOL</h3><div class="dr-grid">${dropData.heroes.filter(h => h.top).map(card).join('')}</div>
    <h3 class="dr-sub">Heroes · 0.5 SOL</h3><div class="dr-grid">${dropData.heroes.filter(h => !h.top).map(card).join('')}</div>`;
  renderShop(); wireCard(dropBox); renderUsd();
  dropBox.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => busy(b, async () => {
    if (!S.session()) throw Error('Sign in with Phantom on the Arena tab to buy.');
    if (isAcct()) throw Error('The drop is paid in SOL. Sign out, then connect Phantom on the Arena tab to buy.');
    const sid = Number(b.dataset.buy), sp = SPECIES[sid];
    if (!confirm(`Buy ${sp.name} for ${sol(dropData.heroes.find(h => h.speciesId === sid).priceLamports)} SOL? Phantom will show the payment to approve.`)) return;
    const m = await S.dropBuy(sid); toast(`${m.form || sp.name} is yours! Find it in the Arena picker.`); API.refreshMine?.(); loadDrop();
  }));
}
// ---------- Sky Bender market: 25 air benders (one of each, 1 SOL) + COVA, the final air bender (10 SOL) ----------
const shopBox = el('div', { id: 'v5Shop', className: 'panel' });
if (mk) mk.insertBefore(shopBox, dropBox);
const EL_NAME = { air: 'Air', water: 'Water + air', earth: 'Earth + air', fire: 'Fire + air', thunder: 'Thunder + air', all: 'All five elements' };
let shopEl = 'all';
function renderShop() {
  const list = dropData?.shop; if (!list) { shopBox.hidden = true; return; } shopBox.hidden = false;
  const me = S.session()?.wallet, sold = list.filter(h => h.sold).length, star = list.find(h => h.unique), rest = list.filter(h => !h.unique);
  const card = h => { const sp = SPECIES[h.speciesId], K = sp.kit;
    return `<div class="dr-card${h.unique ? ' top' : ''}${h.sold ? ' sold' : ''}">${h.unique ? '<span class="dr-badge">FINAL AIR BENDER</span>' : `<span class="dr-badge sb-el sb-${h.element}">${esc(EL_NAME[h.element])}</span>`}
      <img src="art/hd/${sp.art}_s2.png" alt="${esc(sp.name)}" loading="lazy"><div class="dr-evo">${[0, 3, 5].map(st => `<img src="${art(sp, st)}" alt="" loading="lazy">`).join('')}</div>
      <b>${esc(sp.name)}</b><small>${h.female ? 'Air bender (girl)' : 'Air bender (boy)'} · ${esc(sp.cls.label)} · Lv1</small>
      <small class="sb-kit"><b>Special</b> ${esc(K.special.name)} · <b>Mega Shot</b> ${esc(K.mega.name)}${h.unique ? '<br>' + esc(K.mega.note) + '<br><b>Dash</b> ' + esc(K.dash.name) + ': ' + esc(K.dash.note) : ''}</small>${attrHtml(sp, 1, true)}
      ${h.sold ? `<span class="pv-chip ok">Sold${h.owner ? ' · ' + esc(short(h.owner)) + (h.owner === me ? ' (you)' : '') : ''}</span>`
        : `<button class="primary" data-sbuy="${h.speciesId}" ${h.held ? 'disabled' : ''}>${h.held ? 'Being bought…' : 'Buy · ' + sol(h.priceLamports) + ' SOL'}</button>${h.held ? '' : cardBtn(h.speciesId, h.priceLamports)}`}</div>`; };
  const shown = rest.filter(h => shopEl === 'all' || h.element === shopEl);
  shopBox.innerHTML = `<div class="dr-head"><div><div class="eyebrow">Market · ${dropData.cluster === 'devnet' ? 'devnet test SOL' : 'SOL'}</div><h2>Sky Bender Market</h2>
     <p class="pv-note">25 one-of-one air benders, boys and girls. Each also bends a second element: water, earth, fire or thunder (or pure air). Strong from level 1 and they evolve into six forms. Buying needs Phantom.</p></div>
     <div class="dr-clock"><small>Sold</small><b>${sold} / ${list.length}</b><small>no time limit</small></div></div>
    ${star ? `<h3 class="dr-sub">The final air bender · ${sol(star.priceLamports)} SOL</h3><div class="dr-grid sb-star">${card(star)}</div>` : ''}
    <div class="dx-chips sb-chips">${[['all', 'All'], ['air', 'Air'], ['water', 'Water'], ['earth', 'Earth'], ['fire', 'Fire'], ['thunder', 'Thunder']].map(([k, n]) => `<button class="smallbtn" data-sel="${k}" aria-pressed="${k === shopEl}">${n}</button>`).join('')}</div>
    <div class="dr-grid">${shown.map(card).join('')}</div>`;
  wireCard(shopBox);
  shopBox.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { shopEl = b.dataset.sel; renderShop(); });
  shopBox.querySelectorAll('[data-sbuy]').forEach(b => b.onclick = () => busy(b, async () => {
    if (!S.session()) throw Error('Sign in with Phantom on the Arena tab to buy.');
    if (isAcct()) throw Error('Sky Benders are paid in SOL. Sign out, then connect Phantom on the Arena tab to buy.');
    const sid = Number(b.dataset.sbuy), sp = SPECIES[sid], h = list.find(x => x.speciesId === sid);
    if (!confirm(`Buy ${sp.name} for ${sol(h.priceLamports)} SOL? Phantom will show the payment to approve.`)) return;
    const m = await S.dropBuy(sid); toast(`${m.form || sp.name} is yours! Find it in the Arena picker.`); API.refreshMine?.(); loadDrop();
  }));
}
// ---------- Sell for dollars: list a Monstar for a card price; buyers pay with a card; you get 90% paid out by Stripe ----------
const usdBox = el('div', { id: 'v5Usd', className: 'panel' });
if (mk) mk.insertBefore(usdBox, shopBox.nextSibling);
let usdData = null, payout = null;
async function renderUsd() {
  if (!card?.enabled) { usdBox.innerHTML = `<h2>Sell for dollars</h2><p class="pv-note">Card payments are being set up. Soon you can buy store Monstars with a debit card and resell your Monstars for dollars.</p>`; return; }
  try { usdData = await S.usdListings(); } catch { return; }
  if (S.session()) payout = await S.payoutsMe().catch(() => null);
  const me = S.session()?.wallet, mine = (window.PMArenaApi?.mine?.() || []).filter(m => !m.asset && !usdData.listings.some(l => l.serial === m.serial));
  usdBox.innerHTML = `<div class="dr-head"><div><div class="eyebrow">Player market · US dollars</div><h2>Sell For Dollars</h2>
    <p class="pv-note">List a Monstar for a dollar price. Buyers pay with a debit or credit card. You get <b>90%</b>, the player it was born to gets <b>5%</b> royalty and PocketMonstars keeps 5% (it covers card fees). Payouts go to your bank through Stripe. Minted NFTs sell for SOL in the NFT market instead.</p></div></div>
    ${!me ? '<p class="pv-note">Sign in (top right) to sell.</p>' : !payout?.ready ? `<button class="primary" id="usdConnect">${payout?.account ? 'Finish payout setup' : 'Get paid in dollars'}</button> <small class="muted">Stripe asks for your name and bank details (one time).</small>`
      : `<div class="pv-row usd-sell"><select class="pv-input" id="usdPick">${mine.map(m => `<option value="${m.serial}">${esc(m.form || m.name)} · Lv${m.level}</option>`).join('')}</select><input class="pv-input" id="usdPrice" inputmode="decimal" placeholder="Price in $" style="max-width:110px"><button class="primary" id="usdList" ${mine.length ? '' : 'disabled'}>List for $</button></div>`}
    <div class="dr-grid" style="margin-top:12px">${usdData.listings.map(l => { const sp = SPECIES[l.monstar.speciesId];
      return `<div class="dr-card"><img src="art/hd/${sp.art}_s${l.monstar.stageId}.png" alt="${esc(sp.name)}" loading="lazy"><b>${esc(l.monstar.form || sp.name)}</b><small>${esc(sp.type)} · Lv${l.monstar.level} · #${l.serial}</small><small>Seller ${esc(short(l.seller))}</small>
        ${l.seller === me ? `<button class="smallbtn" data-ucancel="${l.serial}">Remove · ${l.usd}</button>` : `<button class="primary" data-ubuy="${l.serial}">💳 Buy · ${l.usd}</button>`}</div>`; }).join('') || '<div class="pv-empty">No Monstars for sale in dollars yet.</div>'}</div>`;
  const c = q('usdConnect'); if (c) c.onclick = () => busy(c, () => S.payoutsConnect());
  const ls = q('usdList'); if (ls) ls.onclick = () => busy(ls, async () => { const r = await S.usdList(Number(q('usdPick').value), Number(q('usdPrice').value)); toast('Listed for ' + r.usd + '.'); renderUsd(); });
  usdBox.querySelectorAll('[data-ucancel]').forEach(b => b.onclick = () => busy(b, async () => { await S.usdCancel(Number(b.dataset.ucancel)); renderUsd(); }));
  usdBox.querySelectorAll('[data-ubuy]').forEach(b => b.onclick = () => busy(b, async () => { if (!S.session()) throw Error('Sign in first (top right).'); await S.usdBuy(Number(b.dataset.ubuy)); }));
}
// Back from Stripe Checkout: /play?paid=<session> -> hand over the Monstar
(async () => { const id = new URLSearchParams(location.search).get('paid'); if (!id || !S.session()) return;
  history.replaceState(null, '', location.pathname + location.hash);
  for (let i = 0; i < 8; i++) { try { const r = await S.cardConfirm(id); if (r.pending) { await new Promise(x => setTimeout(x, 2500)); continue; }
      if (r.ok) { toast(`Payment done! ${r.monstar.form || r.monstar.name} is yours. Find it in the Arena picker.`); API.refreshMine?.(); } else toast(r.error || 'Payment problem.', true);
      loadDrop(); return; } catch (e) { toast(e.message, true); return; } }
  toast('Your card payment is still processing. Your Monstar will appear in a minute.'); })();
setInterval(() => { const c = q('drClock'); if (c && dropData) c.textContent = left(); if (dropData && Date.now() - dropAt > 30000 && !q('market')?.classList.contains('hidden')) loadDrop(); }, 1000);

// ---------- Referral link + QR code ----------
const refBox = el('div', { id: 'v5Ref', className: 'panel', hidden: true });
document.body.append(refBox); // v6 shows it in the referral pop-up
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
