// Authoritative Monstar registry. Every Monstar gets a DNA derived from the wallet it was born to,
// and the database refuses any repeat DNA or repeat visible-trait combination. Serials never change.
// Levels (EXP) are stored here; Legendary and Bred collections are created here too.
import { createHash, randomBytes } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { SPECIES, GENESIS_IDS, LEGENDARY_IDS, RARITIES, Monstar, traitsFromDna, traitSignature, composeDna, rarityIndex, expForLevel } from '../shared/monstars.mjs';

export function deriveDna(owner, speciesId, nonce) {
  return createHash('sha256').update(`pocketmonstars:dna:v1:${owner}:${speciesId}:${nonce}`).digest('hex');
}

export class Registry {
  constructor(db, { legendaryOwner = null } = {}) {
    this.db = db;
    this.legendaryOwner = legendaryOwner ? new PublicKey(legendaryOwner).toBase58() : null;
  }

  /** Insert a Monstar with a DNA that no other Monstar shares (looks and stat rolls included). */
  insertUnique({ speciesId, originOwner, owner, genesis, collection, exp = 0, parents = null, dnaFor }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (let nonce = 0; nonce < 1000; nonce++) {
        const dna = dnaFor(nonce), sig = traitSignature(speciesId, traitsFromDna(dna));
        if (this.db.prepare('SELECT serial FROM monstars WHERE dna=? OR trait_sig=?').get(dna, sig)) continue; // never repeat a Monstar
        this.db.prepare('INSERT INTO monstars(species,origin_owner,owner,dna,trait_sig,nonce,genesis,collection,exp,parents,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
          .run(speciesId, originOwner, owner, dna, sig, nonce, genesis ? 1 : 0, collection, exp, parents, Date.now());
        this.db.exec('COMMIT');
        return this.get(this.db.prepare('SELECT serial FROM monstars WHERE dna=?').get(dna).serial);
      }
      throw Error('Could not find a unique DNA');
    } catch (e) { try { this.db.exec('ROLLBACK'); } catch {} throw e; }
  }

  /** Give a wallet its own one-of-a-kind version of a Genesis species (one per species per wallet). Starts as an Infant. */
  claimGenesis(owner, speciesId) {
    owner = new PublicKey(owner).toBase58();
    if (!GENESIS_IDS.includes(speciesId)) throw Error('Unknown species');
    const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, speciesId);
    if (existing) return this.toMonstar(existing);
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: true, collection: 'genesis', dnaFor: n => deriveDna(owner, speciesId, n) });
  }

  /** The founder wallet holds the Legendary collection, fully evolved (level 80, Ascended). */
  claimLegendaries(owner) {
    owner = new PublicKey(owner).toBase58();
    if (owner !== this.legendaryOwner) return [];
    return LEGENDARY_IDS.map(sid => {
      const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, sid);
      if (existing) return this.toMonstar(existing);
      return this.insertUnique({ speciesId: sid, originOwner: owner, owner, genesis: true, collection: 'legendary', exp: expForLevel(80),
        dnaFor: n => composeDna(deriveDna(owner, sid, n), { rarity: 'Legendary', ivs: [15, 15, 15, 15, 15, 15].map((v, k) => v - ((n + k) % 2)) }) });
    });
  }

  claimAll(owner) { return [...GENESIS_IDS.map(id => this.claimGenesis(owner, id)), ...this.claimLegendaries(owner)]; }

  /**
   * Breeding: each player gets one Infant. Stat rolls are averaged from both parents with a random
   * mutation (-3..+3), and rarity can move one tier up or down, so a child can be stronger or weaker.
   */
  breed({ a, b, seed = randomBytes(16).toString('hex') }) {
    if (a.owner === b.owner) throw Error('Breeding needs Monstars from two different players.');
    const rnd = (k) => parseInt(createHash('sha256').update(seed + ':' + k).digest('hex').slice(0, 8), 16) / 0xffffffff;
    const genesisOf = m => (m.species.legendary ? null : m.species.id);
    const children = [];
    for (const [i, parent] of [a, b].entries()) {
      let sid = rnd('sp' + i) < 0.5 ? genesisOf(a) : genesisOf(b);
      if (sid == null) sid = genesisOf(a) ?? genesisOf(b) ?? 8;
      const ivs = a.traits.ivs.map((v, k) => Math.max(0, Math.min(15, Math.round((v + b.traits.ivs[k]) / 2 + Math.floor(rnd(`iv${i}${k}`) * 7) - 3))));
      const avgR = (rarityIndex(a.traits.rarity) + rarityIndex(b.traits.rarity)) / 2;
      const rIdx = Math.max(0, Math.min(RARITIES.length - 1, Math.round(avgR + (rnd('r' + i) < 0.2 ? 1 : rnd('r' + i) > 0.8 ? -1 : 0))));
      children.push(this.insertUnique({ speciesId: sid, originOwner: parent.owner, owner: parent.owner, genesis: false, collection: 'bred',
        parents: `${a.serial},${b.serial}`,
        dnaFor: n => composeDna(createHash('sha256').update(`pocketmonstars:breed:${seed}:${i}:${n}`).digest('hex'), { rarity: RARITIES[rIdx].name, ivs }) }));
    }
    return children;
  }

  get(serial) { const row = this.db.prepare('SELECT * FROM monstars WHERE serial=?').get(serial); return row ? this.toMonstar(row) : null; }
  byAsset(asset) { const row = this.db.prepare('SELECT * FROM monstars WHERE asset=?').get(asset); return row ? this.toMonstar(row) : null; }
  ownedBy(owner) { return this.db.prepare('SELECT * FROM monstars WHERE owner=? ORDER BY collection DESC, serial').all(owner).map(r => this.toMonstar(r)); }

  setExp(serial, exp) { this.db.prepare('UPDATE monstars SET exp=MAX(exp, ?) WHERE serial=?').run(Math.floor(exp), serial); return this.get(serial); }
  bindAsset(serial, asset, signature) {
    const r = this.db.prepare('UPDATE monstars SET asset=?, mint_signature=? WHERE serial=? AND asset IS NULL').run(asset, signature, serial);
    if (r.changes !== 1) throw Error('This Monstar is already minted');
    return this.get(serial);
  }
  setOwner(serial, owner) { this.db.prepare('UPDATE monstars SET owner=? WHERE serial=?').run(owner, serial); return this.get(serial); }

  toMonstar(row) {
    return new Monstar({ speciesId: row.species, dna: row.dna, serial: row.serial, originOwner: row.origin_owner, owner: row.owner, asset: row.asset,
      exp: row.exp || 0, collection: row.collection || SPECIES[row.species].collection, parents: row.parents || null });
  }
}

/** Public NFT metadata JSON (Metaplex token standard). */
export function metadataJson(monstar, publicUrl, royaltyBps) {
  return {
    name: monstar.displayName,
    symbol: 'MONSTAR',
    description: `${monstar.displayName}, a one-of-a-kind ${monstar.traits.rarity} ${monstar.type} ${monstar.className} (${monstar.stage.name}, level ${monstar.level}). ${monstar.cls.passive} Born to ${monstar.originOwner}.`,
    image: `${publicUrl}/art/pixel/${monstar.species.art}.png`,
    external_url: `${publicUrl}/play#monstar-${monstar.serial}`,
    seller_fee_basis_points: royaltyBps,
    attributes: monstar.toAttributes(),
    properties: { category: 'image', files: [{ uri: `${publicUrl}/art/pixel/${monstar.species.art}.png`, type: 'image/png' }],
      creators: [{ address: monstar.originOwner, share: 100 }] },
  };
}
