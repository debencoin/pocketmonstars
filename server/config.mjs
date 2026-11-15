// Server configuration. Everything here is public except the key files under data/keys (gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { SPECIES } from '../shared/monstars.mjs';
/** Species ids by name (throws on a typo so a gift can never silently go missing). */
const GODS = SPECIES.filter(s => s.god).map(s => s.name); // the ten Watcher Gods
const ids = (...names) => names.map(n => { const sp = SPECIES.find(x => x.name === n); if (!sp) throw Error('Unknown species ' + n); return sp.id; });

const env = process.env;
export const DATA_DIR = path.resolve(env.PM_DATA_DIR || 'data');
fs.mkdirSync(path.join(DATA_DIR, 'keys'), { recursive: true });

const cluster = env.SOLANA_CLUSTER || 'devnet';
if (cluster === 'mainnet-beta' && env.PM_ALLOW_MAINNET !== 'yes-reviewed') {
  throw Error('Mainnet is locked. Finish devnet testing and a legal/security review, then set PM_ALLOW_MAINNET=yes-reviewed.');
}

const stored = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8')); } catch { return {}; } })();

export const CONFIG = {
  port: Number(env.PORT || 8080),
  host: env.HOST || (env.RENDER || env.RAILWAY_ENVIRONMENT || env.FLY_APP_NAME ? '0.0.0.0' : '127.0.0.1'),
  cluster,
  rpc: env.SOLANA_RPC || (cluster === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com'),
  // Public HTTPS base URL where /api/meta/*.json and /art/*.png are served. NFT metadata URIs use it.
  publicUrl: (env.PM_PUBLIC_URL || env.RENDER_EXTERNAL_URL || (env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + env.RAILWAY_PUBLIC_DOMAIN : '') || `http://localhost:${env.PORT || 8080}`).replace(/\/$/, ''),
  // Company wallet that receives the 1-lamport match and marketplace fees. Must already hold the rent minimum.
  treasury: env.PM_TREASURY || stored.treasury || env.PM_LEGENDARY_OWNER || 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ', // founder wallet
  // Creator royalty paid to the wallet each Monstar was born to, on every marketplace resale.
  royaltyBps: Number(env.PM_ROYALTY_BPS || stored.royaltyBps || 500),
  collection: env.PM_COLLECTION || stored.collection || null,
  // Wallet that holds the Legendary collection (Seraphon and Psyvolt, fully evolved).
  legendaryOwner: env.PM_LEGENDARY_OWNER || 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ',
  // Wallets granted specific top Monstars (species ids) as elite Legendary-rarity hatchlings on sign-in.
  gifts: Object.fromEntries(Object.entries({
    // Aeonox, Anuvax, Semyazar (the three strongest wild Monstars) + the 10 Elemental Benders + 10 Anunnaki
    // + 5 Legend Heroes and 5 Sky Benders of his own
    '7psxmCxFNHQztUP9SahuGDShSU4y1JcufEugtFgkgwTx': [64, 65, 85, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 66, 67, 68, 71, 72, 79, 69, 73, 74, 76,
      ...ids('Stormvane', 'Bulwarkus', 'Venomaw', 'Quasarion', 'Gorrath', 'Galdris', 'Skyvar', 'Windrik', 'Aeromar', 'Cyrran')],
    // all 10 Elemental Benders + Tempestro, the elite thunder bender (only this wallet has him)
    'q2xb75XhmJ7HL8PYMMFUsanusoakBtMXfYqdqUkHjUW': [163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173],
    // founder: one bender of each element (water, earth, fire, air, thunder)
    // + 5 Legend Heroes and COVO, the final air bender (all five elements)
    // + the 8 Aura Warriors (from the founder's own drawings)
    'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ': [163, 165, 167, 170, 172, ...ids('Aurorex', 'Titanor', 'Phantomir', 'Pyronyx', 'Chronar', 'COVO', 'Dashi', 'Bolo', 'Swish', 'Kapri', 'Nyla', 'Verdo', 'Bunzo', 'Tigo', 'Vikko', 'Noxx', 'Terrok', 'Zephar', 'Tydal', 'Ignar', 'Azaelion', ...GODS)],
    // Ashley: women only. 5 heroines, 5 air bender women, 4 Anunnaki goddesses, a woman bender of water, earth, fire and thunder, KENA (all five elements), and the elite benders Aurelia (golden fire) and Amyah (moonlit ice)
    // the Watcher Gods' creator plays with a set of his own
    '5eKeqSopYotsxwfE2uCJoyFywzqmXFe92NQR8kbHqaGd': ids(...GODS),
    'HgPy9avE7tMVTgpehYwFQRQYGPUPbZKGzKPAuLNoeD3U': ids('Kena', 'Aurelia', 'Amyah', 'Tidewen', 'Terrala', 'Pyreska', 'Voltessa', 'Starlara', 'Lumivra', 'Frostelle', 'Blazara', 'Sylphra', 'Aerisa', 'Sylvane', 'Zephra', 'Windara', 'Skylis', 'Inannox', 'Tiamaw', 'Ninhurra', 'Ereshkyl'),
    // second founder wallet: 5 heroines and 5 air bender women
    '54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr': ids('Starlara', 'Lumivra', 'Frostelle', 'Blazara', 'Sylphra', 'Aerisa', 'Sylvane', 'Zephra', 'Windara', 'Skylis'),
  }).map(([w, list]) => [w, list.filter(sid => !SPECIES[sid].retired)])), // retired benders are never given
  royalOwner: env.PM_ROYAL_OWNER || '54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr', // second founder wallet: the Royal Anunnaki
  // Superhero Drop: 30 heroes sold once each (top 5 at 1 SOL, the rest 0.5 SOL), paid to the founder wallet.
  dropTreasury: env.PM_DROP_TREASURY || env.PM_LEGENDARY_OWNER || 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ',
  // The artist who drew a collection. Its market copies are sold from this wallet (the buyer pays it directly) and the
  // 5% royalty on every later resale goes to it for ever. The founder keeps the gifted copies to play with.
  creators: { aurawarriors: env.PM_AURA_CREATOR || '1jBWaau5EEZK7cwZVqKiEDfJBS9STp6JSYmVbAXgZnj', watchergods: env.PM_GODS_CREATOR || '5eKeqSopYotsxwfE2uCJoyFywzqmXFe92NQR8kbHqaGd' },
  // PocketMonstars' share of a marketplace sale, by collection, in basis points (default 5%).
  companyFeeBps: { watchergods: 100 },
  dropEndsAt: Date.parse(env.PM_DROP_ENDS || '2026-12-03T03:30:00Z'), // 30 days from launch (2026-11-03)
  // Card payments (Stripe). Set these in Render → Environment, never in the repo. Off while STRIPE_SECRET_KEY is empty.
  stripeSecretKey: env.STRIPE_SECRET_KEY || null,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,
  solUsd: env.PM_SOL_USD || null,
  catchPacks: { 1: Number(env.PM_CATCH1_USD || 0.99), 5: Number(env.PM_CATCH5_USD || 3.99) }, // catch passes for free accounts (US dollars) // fixed dollars per SOL for card prices (default: live SOL price)
  freeWildCooldownMs: 45 * 1000, // username accounts play the wild for free, one run every 45 s
  // Breeding fee each player pays to the company treasury, in lamports (0.01 SOL).
  breedFeeLamports: BigInt(env.PM_BREED_FEE_LAMPORTS || 10_000_000),
  wildFeeLamports: BigInt(env.PM_WILD_FEE_LAMPORTS || 100_000), // 0.0001 SOL to enter the wild (paid to the company wallet)
  depositTimeoutMs: 3 * 60 * 1000,
  disconnectGraceMs: 15 * 1000,
};

export function saveStoredConfig(patch) {
  const next = { ...stored, ...patch };
  fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify(next, null, 2));
  Object.assign(stored, next);
  if (patch.collection) CONFIG.collection = patch.collection;
}
