'use strict';
// Immortal Guild: every open Immortal Combat (players who put a Monstar up for a fight). Tap a fighter to join their fight
// with the Monstar you pick here. Your soul claims (buy back a Monstar you lost, or set your soul fee) are on this tab too.
(() => {
const S = window.PMStake, API = window.PMArenaApi, PA = window.PMArena; if (!S || !API) return;
const { SPECIES } = S.Monstars;
const q = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = a => !a ? '—' : a.startsWith('@') ? a.slice(1) : a.slice(0, 4) + '…' + a.slice(-4);
const nav = document.querySelector('header nav'), main = document.querySelector('main');
const btn = document.createElement('button'); btn.textContent = 'Immortal Guild'; btn.dataset.tab = 'guild'; btn.onclick = () => window.tab('guild');
nav?.insertBefore(btn, nav.querySelector('[data-tab=market]'));
const sec = document.createElement('section'); sec.id = 'guild'; sec.className = 'view hidden'; main.insertBefore(sec, main.querySelector('footer'));
sec.innerHTML = `<div class="topline"><div><div class="eyebrow">Winner takes the Monstar</div><h1>Immortal Guild</h1>
  <p class="muted">Every open Immortal Combat 1v1. Tap a fighter to take their challenge: <b>whoever wins keeps both Monstars</b>, and the loser has 24 hours to buy theirs back for the winner's soul fee (0.1 to 0.5 SOL or dollars by card), or it's gone for good. Phantom players sign before the fight.</p></div>
  <span class="pill"><i class="dot"></i> <span id="gdCount">0</span> OPEN FIGHTS</span></div>
  <div class="panel gd-mine"><h3>Your fighter</h3><div id="gdPick"></div>
   <div class="pv-row" style="margin-top:10px"><button class="primary" id="gdCreate">⚔ Put my Monstar up for a fight</button><button class="smallbtn" id="gdRefresh">Refresh</button></div></div>
  <div class="gd-grid" id="gdList"></div>
  <div class="panel" style="margin-top:16px"><h2>Buy Back Your Monstars</h2><p class="pv-note">Monstars you lost (buy them back before the time runs out) and Monstars you won (set your soul fee).</p><div id="gdSouls"></div></div>`;
let fights = [], timer = null;
function pickHtml() {
  const mine = API.mine?.() || [], cur = API.pickedMon?.();
  if (!S.session()) return '<p class="pv-note">Sign in (top right) to fight in the guild.</p>';
  if (!mine.length) return '<p class="pv-note">You have no Monstars yet.</p>';
  return `<select class="pv-input" id="gdSel">${mine.map(m => `<option value="${m.serial}" ${cur?.serial === m.serial ? 'selected' : ''}>${esc(m.form || m.name)} · Lv${m.level}${m.asset ? ' · NFT' : ''}</option>`).join('')}</select>`;
}
async function render() {
  q('gdPick').innerHTML = pickHtml();
  const sel = q('gdSel'); if (sel) { if (!API.pickedMon?.()) API.pick(Number(sel.value)); sel.onchange = () => API.pick(Number(sel.value)); }
  try { fights = (await fetch('/api/immortal/open').then(r => r.json())).fights || []; } catch { fights = []; }
  const me = S.session()?.wallet; q('gdCount').textContent = fights.length;
  q('gdList').innerHTML = fights.length ? fights.map(f => { const sp = SPECIES[f.monstar.speciesId], you = f.owner === me;
    return `<button class="gd-card${you ? ' you' : ''}" data-code="${esc(f.code)}" ${you ? 'disabled' : ''}>
      <img src="${PA.spriteSrc(f.monstar.speciesId, f.monstar.stageId)}" alt="${esc(sp.name)}" loading="lazy">
      <b>${esc(f.monstar.form || sp.name)}</b><small>Lv${f.monstar.level} · ${esc(sp.type)}${f.nft ? ' · NFT' : ''} · power ${f.power}</small>
      <span class="gd-owner">${you ? 'Your fight · waiting' : esc(short(f.owner))}</span><span class="gd-code">${esc(f.code)}</span>
      ${you ? '' : '<span class="gd-go">⚔ Fight</span>'}</button>`; }).join('')
    : '<div class="pv-empty">No open fights right now. Put your Monstar up and wait for a challenger.</div>';
  q('gdList').querySelectorAll('[data-code]').forEach(b => b.onclick = () => join(b.dataset.code));
  if (S.session()) API.renderSouls?.(q('gdSouls')); else q('gdSouls').innerHTML = '<p class="pv-note">Sign in to see your soul claims.</p>';
}
function join(code) {
  try {
    if (!S.session()) throw Error('Sign in (top right) first.');
    const f = fights.find(x => x.code === code), m = API.pickedMon?.(); if (!m) throw Error('Pick your fighter first.');
    if (!confirm(`IMMORTAL COMBAT vs ${short(f.owner)}'s ${f.monstar.form || f.monstar.name} (Lv${f.monstar.level}).\n\nYou put ${m.form || m.name} (Lv${m.level}) on the line. Whoever wins takes the other's Monstar. The loser has 24 hours to buy it back for the winner's soul fee, or it's gone for good.\n\nFight?`)) return;
    API.joinImmortal(code);
  } catch (e) { API.toast(e.message, true); }
}
q('gdRefresh').onclick = render;
q('gdCreate').onclick = () => { window.tab('pvp'); setTimeout(() => q('pvImmortal')?.click(), 50); };
const baseTab = window.tab;
window.tab = function (id) { baseTab(id); btn.classList.toggle('active', id === 'guild'); clearInterval(timer); if (id === 'guild') { render(); timer = setInterval(render, 8000); } };
})();
