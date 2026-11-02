// Authoritative Monstar registry. Every Monstar gets a DNA derived from the wallet it was born to,
// and the database refuses any repeat DNA or repeat visible-trait combination. Serials never change.
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { SPECIES, Monstar, traitsFromDna, traitSignature } from '../shared/monstars.mjs';

export function deriveDna(owner, speciesId, nonce) {
  return createHash('sha256').update(`pocketmonstars:dna:v1:${owner}:${speciesId}:${nonce}`).digest('hex');
}

export class Registry {
  constructor(db) { this.db = db; }

  /** Give a wallet its own one-of-a-kind version of a species (one genesis per species per wallet). */
  claimGenesis(owner, speciesId, now = Date.now()) {
    owner = new PublicKey(owner).toBase58();
    if (!SPECIES[speciesId]) throw Error('Unknown species');
    const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, speciesId);
    if (existing) return this.toMonstar(existing);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (let nonce = 0; nonce < 1000; nonce++) {
        const dna = deriveDna(owner, speciesId, nonce);
        const sig = traitSignature(speciesId, traitsFromDna(dna));
        const clash = this.db.prepare('SELECT serial FROM monstars WHERE dna=? OR trait_sig=?').get(dna, sig);
        if (clash) continue; // never reuse a look/stat combination that already exists
        this.db.prepare('INSERT INTO monstars(species,origin_owner,owner,dna,trait_sig,nonce,genesis,created_at) VALUES(?,?,?,?,?,?,1,?)')
          .run(speciesId, owner, owner, dna, sig, nonce, now);
        this.db.exec('COMMIT');
        return this.get(this.db.prepare('SELECT serial FROM monstars WHERE dna=?').get(dna).serial);
      }
      throw Error('Could not find a unique DNA');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }

  claimAll(owner) { return SPECIES.map(s => this.claimGenesis(owner, s.id)); }

  get(serial) { const row = this.db.prepare('SELECT * FROM monstars WHERE serial=?').get(serial); return row ? this.toMonstar(row) : null; }
  byAsset(asset) { const row = this.db.prepare('SELECT * FROM monstars WHERE asset=?').get(asset); return row ? this.toMonstar(row) : null; }
  ownedBy(owner) { return this.db.prepare('SELECT * FROM monstars WHERE owner=? ORDER BY serial').all(owner).map(r => this.toMonstar(r)); }

  bindAsset(serial, asset, signature) {
    const r = this.db.prepare('UPDATE monstars SET asset=?, mint_signature=? WHERE serial=? AND asset IS NULL').run(asset, signature, serial);
    if (r.changes !== 1) throw Error('This Monstar is already minted');
    return this.get(serial);
  }
  setOwner(serial, owner) { this.db.prepare('UPDATE monstars SET owner=? WHERE serial=?').run(owner, serial); return this.get(serial); }

  toMonstar(row) {
    return new Monstar({ speciesId: row.species, dna: row.dna, serial: row.serial, originOwner: row.origin_owner, owner: row.owner, asset: row.asset });
  }
}

/** Public NFT metadata JSON (Metaplex token standard). */
export function metadataJson(monstar, publicUrl, royaltyBps) {
  return {
    name: monstar.displayName,
    symbol: 'MONSTAR',
    description: `${monstar.displayName}, a one-of-a-kind ${monstar.traits.rarity} ${monstar.type} ${monstar.className}. ${monstar.cls.passive} Born to ${monstar.originOwner}.`,
    image: `${publicUrl}/art/${monstar.species.art}.png`,
    external_url: `${publicUrl}/play#monstar-${monstar.serial}`,
    seller_fee_basis_points: royaltyBps,
    attributes: monstar.toAttributes(),
    properties: { category: 'image', files: [{ uri: `${publicUrl}/art/${monstar.species.art}.png`, type: 'image/png' }],
      creators: [{ address: monstar.originOwner, share: 100 }] },
  };
}
