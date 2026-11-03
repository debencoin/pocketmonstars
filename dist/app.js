'use strict';
// Phone app layer: installable app (PWA), bottom tab bar on phones, and a simpler menu.
(() => {
const q = id => document.getElementById(id), nav = document.querySelector('nav');
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (standalone) document.body.classList.add('in-app');

// Simpler menu: drop the old Journey and Rewards pages (the old 1-9 starter tracker and a token preview).
for (const id of ['journey', 'rewards']) { nav?.querySelector(`[data-tab=${id}]`)?.remove(); q(id)?.classList.add('app-gone'); } // hidden, not deleted: old code still updates them
// Old single-player NFT designer in the market tab (Genesis 1-9 only): the live market and the drop replace it.
const market = q('market'); if (market) [...market.children].forEach(c => { if (!['pvMarket'].includes(c.id)) c.hidden = true; });
// Header: one clear Sign in button, no old shard coins.
document.querySelector('.coins')?.classList.add('app-gone'); document.querySelector('.avatar')?.classList.add('app-gone');
const wb = q('walletOpen'); if (wb) { const nb = wb.cloneNode(false); nb.id = 'appSignIn'; nb.textContent = 'Sign in'; wb.after(nb); wb.classList.add('app-gone');
  nb.onclick = () => { window.tab('pvp'); setTimeout(() => { document.querySelector('.pv-walletbar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50); }; }

// Menu order and short labels with icons (a bottom tab bar on phones).
const ORDER = [['pvp', 'Arena', '⚔'], ['play', 'Wild', '✦'], ['collection', 'Monstars', '◆'], ['market', 'Market', '◈'], ['breed', 'Breed', '♥'], ['leaders', 'Ranks', '★'], ['guide', 'Guide', '?']];
if (nav) for (const [id, label, icon] of ORDER) { const b = nav.querySelector(`[data-tab=${id}]`); if (!b) continue; b.innerHTML = `<i aria-hidden="true">${icon}</i><span>${label}</span>`; b.setAttribute('aria-label', label); nav.append(b); }

// No install banner: players can still add the app from the browser menu (Share -> Add to Home Screen).
})();
const show = () => { if (!standalone && !seen) bar.hidden = false; };
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(); });
if (ios && !window.phantom) setTimeout(show, 2500); // Safari on iPhone; inside Phantom's browser there is no Add to Home Screen
q('appGo').onclick = async () => {
  if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; bar.hidden = true; return; }
  q('appHow').innerHTML = 'Tap <b>Share</b> <span aria-hidden="true">⎋</span> at the bottom of Safari, then <b>Add to Home Screen</b>.'; q('appGo').hidden = true;
};
q('appX').onclick = () => { bar.hidden = true; try { localStorage.setItem('pm-install-x', '1'); } catch {} };
addEventListener('appinstalled', () => { bar.hidden = true; });
})();
