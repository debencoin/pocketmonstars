// Server-held devnet keys. Production must move these into a KMS/HSM or multisig; never ship them to the browser.
import fs from 'node:fs';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import { DATA_DIR } from './config.mjs';

function loadOrCreate(name) {
  const file = path.join(DATA_DIR, 'keys', name + '.json');
  if (fs.existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, 'utf8'))));
  const kp = Keypair.generate();
  fs.writeFileSync(file, JSON.stringify([...kp.secretKey]), { mode: 0o600 });
  return kp;
}

let cache = null;
export function serverKeys() {
  if (!cache) cache = {
    // Signs as the official collection's update authority, so only registry-approved mints join the collection.
    collectionAuthority: loadOrCreate('collection-authority'),
    // Holds the transfer-delegate role for listed Monstars and co-signs sales that pay seller + royalty + fee atomically.
    marketAuthority: loadOrCreate('market-authority'),
  };
  return cache;
}
