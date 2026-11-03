// Server configuration. Everything here is public except the key files under data/keys (gitignored).
import fs from 'node:fs';
import path from 'node:path';

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
  treasury: env.PM_TREASURY || stored.treasury || null,
  // Creator royalty paid to the wallet each Monstar was born to, on every marketplace resale.
  royaltyBps: Number(env.PM_ROYALTY_BPS || stored.royaltyBps || 500),
  collection: env.PM_COLLECTION || stored.collection || null,
  // Wallet that holds the Legendary collection (Seraphon and Psyvolt, fully evolved).
  legendaryOwner: env.PM_LEGENDARY_OWNER || 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ',
  // Wallets granted specific top Monstars (species ids) as elite Legendary-rarity hatchlings on sign-in.
  gifts: { '7psxmCxFNHQztUP9SahuGDShSU4y1JcufEugtFgkgwTx': [64, 65, 85] }, // Aeonox, Anuvax, Semyazar: the three strongest Monstars
  royalOwner: env.PM_ROYAL_OWNER || '54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr', // second founder wallet: the Royal Anunnaki
  // Superhero Drop: 30 heroes sold once each (top 5 at 1 SOL, the rest 0.5 SOL), paid to the founder wallet.
  dropTreasury: env.PM_DROP_TREASURY || env.PM_LEGENDARY_OWNER || 'Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ',
  dropEndsAt: Date.parse(env.PM_DROP_ENDS || '2026-12-03T03:30:00Z'), // 30 days from launch (2026-11-03)
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
