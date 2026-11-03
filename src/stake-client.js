// Browser side of Stake Duel, unique Monstars and the marketplace. Bundled to dist/stake-client.js (window.PMStake).
// Phantom only ever signs: a sign-in message, the stake deposit, a mint, a marketplace approval, or a purchase.
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, createNoopSigner, signerIdentity } from '@metaplex-foundation/umi';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { mplCore, fetchAsset, addPlugin, approvePluginAuthority } from '@metaplex-foundation/mpl-core';
import * as Monstars from '../shared/monstars.mjs';
import * as Stake from '../shared/stake.mjs';
import * as Sim from '../shared/sim.mjs';
import QRCode from 'qrcode';
const { ARENA } = Sim;
globalThis.Buffer ??= Buffer;

const RPC = 'https://api.devnet.solana.com';
const conn = new Connection(RPC, 'confirmed');
let token = null, wallet = null, config = null;
try { token = sessionStorage.getItem('pm-token'); wallet = sessionStorage.getItem('pm-wallet'); } catch {}
// Referral links (?ref=<wallet or @name>) are remembered until the player signs up.
try { const r = new URLSearchParams(location.search).get('ref'); if (r) localStorage.setItem('pm-ref', r.slice(0, 64)); } catch {}
const savedRef = () => { try { return localStorage.getItem('pm-ref') || undefined; } catch { return undefined; } };
function keep(s) { token = s.token; wallet = s.wallet; try { sessionStorage.setItem('pm-token', token); sessionStorage.setItem('pm-wallet', wallet); } catch {} return wallet; }

function phantom() {
  const p = window.phantom?.solana;
  if (!p?.isPhantom) throw Error('Phantom not found. On a phone, open this game inside the Phantom app browser.');
  return p;
}
export function phantomBrowseLink() {
  const u = new URL(location.href); u.hash = 'arena'; // open straight on the Arena inside Phantom
  return `https://phantom.com/ul/browse/${encodeURIComponent(u.href)}?ref=${encodeURIComponent(location.origin)}`;
}

async function api(path, body) {
  const res = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { token = null; try { sessionStorage.removeItem('pm-token'); } catch {} }
  if (!res.ok) throw Error(data.error || 'Request failed');
  return data;
}

export async function getConfig() { return config ??= await api('/api/config'); }

/** Connect Phantom and prove wallet ownership by signing a message. No funds move. */
export async function signIn() {
  const p = phantom();
  const { publicKey: pk } = p.isConnected && p.publicKey ? { publicKey: p.publicKey } : await p.connect();
  const w = pk.toBase58();
  const { message } = await api('/api/auth/challenge', { wallet: w });
  const { signature } = await p.signMessage(new TextEncoder().encode(message), 'utf8');
  return keep(await api('/api/auth/verify', { wallet: w, signature: bs58.encode(signature), ref: savedRef() }));
}
/** Username + password accounts: free online play, no wallet. */
export async function accountRegister(username, password) { return keep(await api('/api/account/register', { username, password, ref: savedRef() })); }
export async function accountLogin(username, password) { return keep(await api('/api/account/login', { username, password })); }
export function signOut() { token = null; wallet = null; try { sessionStorage.removeItem('pm-token'); sessionStorage.removeItem('pm-wallet'); } catch {} }
export function session() {
  const p = window.phantom?.solana;
  if (token && wallet && !wallet.startsWith('@') && p?.publicKey && p.publicKey.toBase58() !== wallet) { token = null; wallet = null; } // account switched in Phantom
  return token ? { wallet, token } : null;
}
export async function balance(address = wallet) { return BigInt(await conn.getBalance(new PublicKey(address), 'confirmed')); }

/** Sign a server-built (possibly partially signed) transaction in Phantom and send it to devnet. */
async function signAndSend(base64) {
  const p = phantom();
  const tx = Transaction.from(Buffer.from(base64, 'base64'));
  if (tx.feePayer?.toBase58() !== p.publicKey.toBase58()) throw Error('This transaction is for a different wallet.');
  const signed = await p.signTransaction(tx);
  const sig = bs58.encode(signed.signature);
  await conn.sendRawTransaction(signed.serialize());
  for (let i = 0; i < 40; i++) {
    const s = (await conn.getSignatureStatuses([sig], { searchTransactionHistory: true })).value[0];
    if (s?.err) throw Error('Transaction failed: ' + JSON.stringify(s.err));
    if (['confirmed', 'finalized'].includes(s?.confirmationStatus)) return sig;
    await new Promise(r => setTimeout(r, 1000));
  }
  return sig;
}

// ---------- Monstars ----------
export async function myMonstars() { return (await api('/api/monstars/mine')).monstars; }
export async function mint(serial) {
  const prep = await api('/api/mint/prepare', { serial });
  const signature = await signAndSend(prep.transaction);
  return api('/api/mint/confirm', { serial, asset: prep.asset, signature });
}
export async function syncOwner(serial) { return api('/api/monstars/sync', { serial }); }

// ---------- Marketplace ----------
export async function listings() { return (await api('/api/market')).listings; }
async function approveMarket(assetAddress) {
  const cfg = await getConfig(), p = phantom(), owner = p.publicKey.toBase58();
  const umi = createUmi(RPC).use(mplCore()).use(signerIdentity(createNoopSigner(publicKey(owner))));
  const asset = await fetchAsset(umi, publicKey(assetAddress));
  if (asset.transferDelegate?.authority?.address === cfg.marketAuthority) return null;
  const collection = asset.updateAuthority.type === 'Collection' ? asset.updateAuthority.address : undefined;
  const newAuthority = { type: 'Address', address: publicKey(cfg.marketAuthority) };
  const builder = asset.transferDelegate
    ? approvePluginAuthority(umi, { asset: asset.publicKey, collection, plugin: { type: 'TransferDelegate' }, newAuthority })
    : addPlugin(umi, { asset: asset.publicKey, collection, plugin: { type: 'TransferDelegate', authority: newAuthority } });
  const { blockhash } = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: p.publicKey, recentBlockhash: blockhash }).add(...builder.getInstructions().map(toWeb3JsInstruction));
  return signAndSend(tx.serialize({ requireAllSignatures: false }).toString('base64'));
}
export async function list(monstar, priceSol) {
  if (!monstar.asset) throw Error('Mint this Monstar first.');
  await approveMarket(monstar.asset);
  return api('/api/market/list', { serial: monstar.serial, priceLamports: Stake.toLamports(priceSol).toString() });
}
export async function cancelListing(id) { return api('/api/market/cancel', { id }); }
export async function buy(id) {
  const prep = await api('/api/market/buy', { id });
  const signature = await signAndSend(prep.transaction);
  return { ...(await api('/api/market/confirm', { id, signature })), split: prep.split, signature };
}

// ---------- Stake Duel ----------
export function connectSocket(onMessage) {
  const s = session(); if (!s) throw Error('Sign in first.');
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${encodeURIComponent(s.token)}`);
  ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch {} };
  return ws;
}
export async function deposit() {
  const { transaction } = await api('/api/stake/deposit-tx', {});
  return signAndSend(transaction);
}
// ---------- Breeding ----------
export const breedCreate = serial => api('/api/breed/create', { serial });
export const breedJoin = (code, serial) => api('/api/breed/join', { code, serial });
export const breedStatus = code => api('/api/breed/status', { code });
export async function breedPay(code) {
  const { transaction } = await api('/api/breed/fee-tx', { code });
  const signature = await signAndSend(transaction);
  return api('/api/breed/confirm', { code, signature });
}
/** Pay the 0.0001 SOL wild entry fee in Phantom. Returns the signature the server checks on-chain. */
export async function wildPay() {
  const { transaction } = await api('/api/wild/fee-tx', {});
  return signAndSend(transaction);
}
// ---------- Superhero Drop ----------
export const drop = () => api('/api/drop');
export async function dropBuy(speciesId) {
  const { transaction } = await api('/api/drop/tx', { speciesId });
  const signature = await signAndSend(transaction);
  for (let i = 0; ; i++) { try { return await api('/api/drop/confirm', { speciesId, signature }); } catch (e) { if (i >= 6 || !/not (found|confirmed) yet/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000)); } }
}
// ---------- Card payments (Stripe) and dollar resale ----------
export const cardStatus = () => api('/api/card/status');
/** Opens Stripe Checkout for a store Monstar (same price as in SOL, in dollars). Comes back to /play?paid=<session>. */
export async function cardBuy(speciesId) { const { url } = await api('/api/card/checkout', { speciesId }); location.href = url; }
export const cardConfirm = session => api('/api/card/confirm', { session });
export const payoutsMe = () => api('/api/payouts/me');
export const catchesMe = () => api('/api/catches/me');
// ---------- Immortal Combat soul claims ----------
export const soulMine = () => api('/api/soul/mine');
export const soulFee = (id, feeSol, feeUsd) => api('/api/soul/fee', { id, feeSol, feeUsd });
export async function soulBuy(id) { const { transaction } = await api('/api/soul/tx', { id }); const signature = await signAndSend(transaction);
  for (let i = 0; ; i++) { try { return await api('/api/soul/confirm', { id, signature }); } catch (e) { if (i >= 6 || !/not (found|confirmed) yet/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000)); } } }
/** Immortal Combat: sign the agreement that the winner takes your Monstar (no transaction, no fee). */
export async function immortalSign(message) { const { signature } = await phantom().signMessage(new TextEncoder().encode(message), 'utf8'); return api('/api/immortal/sign', { signature: bs58.encode(signature) }); }
const retryConfirm = async (path, b) => { for (let i = 0; ; i++) { try { return await api(path, b); } catch (e) { if (i >= 6 || !/not (found|confirmed|in the match escrow|arrived) yet/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000)); } } };
/** Immortal Combat with a minted NFT: move it into the match escrow (you sign in Phantom). */
export async function immortalLock() { const { transaction } = await api('/api/immortal/lock-tx', {}); const signature = await signAndSend(transaction); return retryConfirm('/api/immortal/lock-confirm', { signature }); }
/** Collect an NFT waiting for you in an Immortal Combat escrow. */
export async function escrowCollect(id) { const { transaction } = await api('/api/escrow/release-tx', { id }); const signature = await signAndSend(transaction); return retryConfirm('/api/escrow/release-confirm', { id, signature }); }
export async function soulCard(id) { const { url } = await api('/api/card/soul', { id }); location.href = url; }
export async function catchPassBuy(pack) { const { url } = await api('/api/card/catches', { pack }); location.href = url; }
export async function payoutsConnect() { const { url } = await api('/api/payouts/connect', {}); location.href = url; }
export const usdListings = () => api('/api/usd/listings');
export const usdList = (serial, priceUsd) => api('/api/usd/list', { serial, priceUsd });
export const usdCancel = serial => api('/api/usd/cancel', { serial });
export async function usdBuy(serial) { const { url } = await api('/api/usd/buy', { serial }); location.href = url; }
// ---------- Profile avatars ----------
export const profile = () => api('/api/profile/me');
export const setAvatar = avatar => api('/api/profile/avatar', { avatar });
export const avatars = () => api('/api/avatars');
export async function avatarBuy(id) {
  const { transaction } = await api('/api/avatar/tx', { id });
  const signature = await signAndSend(transaction);
  for (let i = 0; ; i++) { try { return await api('/api/avatar/confirm', { id, signature }); } catch (e) { if (i >= 6 || !/not (found|confirmed) yet/i.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000)); } }
}
// ---------- Referrals ----------
export const referrals = () => api('/api/referrals/me');
export const referralLink = code => `${location.origin}/play?ref=${encodeURIComponent(code)}`;
export const qrDataUrl = text => QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: '#080c18', light: '#ffffff' } });
export const explorer = sig => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

if (typeof window !== 'undefined') window.PMStake = { signIn, session, balance, getConfig, myMonstars, mint, syncOwner, listings, list, cancelListing, buy,
  connectSocket, deposit, explorer, phantomBrowseLink, breedCreate, breedJoin, breedStatus, breedPay, wildPay, signOut, accountRegister, accountLogin, drop, dropBuy, cardStatus, cardBuy, cardConfirm, catchesMe, soulMine, soulFee, soulBuy, soulCard, immortalSign, immortalLock, escrowCollect, catchPassBuy, payoutsMe, payoutsConnect, usdListings, usdList, usdCancel, usdBuy, profile, setAvatar, avatars, avatarBuy, referrals, referralLink, qrDataUrl, Monstars, Stake, ARENA, Sim };
