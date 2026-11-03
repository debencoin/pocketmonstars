// Authoritative Monstar registry. Every Monstar gets a DNA derived from the wallet it was born to,
// and the database refuses any repeat DNA or repeat visible-trait combination. Serials never change.
// Levels (EXP) are stored here; Legendary and Bred collections are created here too.
import { createHash, randomBytes } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { HERO_IDS, legendaryIdsFor, nftArt, SPECIES, GENESIS_IDS, LEGENDARY_IDS, WILD_IDS, RARITIES, Monstar, traitsFromDna, traitSignature, composeDna, rarityIndex, expForLevel } from '../shared/monstars.mjs';

export function deriveDna(owner, speciesId, nonce) {
  return createHash('sha256').update(`pocketmonstars:dna:v1:${owner}:${speciesId}:${nonce}`).digest('hex');
}

/** Players are wallets (base58) or username accounts ("@name"). */
export const isAccount = id => typeof id === 'string' && id.startsWith('@');
export const normOwner = id => (isAccount(id) ? id : new PublicKey(id).toBase58());
/** Species a new player can start with: the Genesis nine plus every Common, Uncommon and Rare wild Monstar. */
export const STARTER_POOL = SPECIES.filter(s => GENESIS_IDS.includes(s.id) || (WILD_IDS.includes(s.id) && ['Common', 'Uncommon', 'Rare'].includes(s.tier))).map(s => s.id);
/** Every new player gets ONE random Monstar from the pool (fixed per player, so it is the same after a server reset). */
export function starterSpecies(owner) {
  const h = createHash('sha256').update('pocketmonstars:starter:v2:' + owner).digest();
  return [STARTER_POOL[h.readUInt32BE(0) % STARTER_POOL.length]];
}

export class Registry {
  constructor(db, { legendaryOwner = null, royalOwner = null, gifts = {} } = {}) {
    this.gifts = Object.fromEntries(Object.entries(gifts || {}).map(([w, ids]) => [normOwner(w), ids]));
    this.db = db;
    this.legendaryOwner = legendaryOwner ? new PublicKey(legendaryOwner).toBase58() : null;
    this.royalOwner = royalOwner ? new PublicKey(royalOwner).toBase58() : null;
    // one-time: legendaries used to hatch at level 80; reset those to level 1 Infants
    db.exec('CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT)');
    if (!db.prepare("SELECT 1 FROM meta WHERE k='legend-infants-v1'").get()) {
      const ids = LEGENDARY_IDS.join(',') || '-1';
      db.exec(`UPDATE monstars SET exp=0 WHERE genesis=1 AND species IN (${ids}) AND exp>=${expForLevel(80)}`);
      db.prepare("INSERT INTO meta(k,v) VALUES('legend-infants-v1','done')").run();
    }
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
    owner = normOwner(owner);
    if (!STARTER_POOL.includes(speciesId)) throw Error('Unknown species');
    const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, speciesId);
    if (existing) return this.toMonstar(existing);
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: true, collection: SPECIES[speciesId].collection, dnaFor: n => deriveDna(owner, speciesId, n) });
  }

  /** The founder wallet holds the Legendary collections. They hatch as level 1 Infants with elite attributes (Legendary rarity, near-perfect rolls, +20% stats). */
  claimLegendaries(owner) {
    owner = normOwner(owner);
    const key = owner === this.legendaryOwner ? 'founder' : owner === this.royalOwner ? 'royal' : null;
    const ids = [...(key ? legendaryIdsFor(key) : []), ...(this.gifts[owner] || [])];
    if (!ids.length) return [];
    return ids.map(sid => {
      const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, sid);
      if (existing) return this.toMonstar(existing);
      return this.insertUnique({ speciesId: sid, originOwner: owner, owner, genesis: true, collection: SPECIES[sid].collection, exp: 0,
        dnaFor: n => composeDna(deriveDna(owner, sid, n), { rarity: 'Legendary', ivs: [15, 15, 15, 15, 15, 15].map((v, k) => v - ((n + k) % 2)) }) });
    });
  }

  /**
   * Every wallet starts with three Genesis Monstars of its own, picked from its address (so players get
   * different starters). The rest of the species are caught in the Wild Expedition.
   * Wallets that already hatched more before this rule keep everything they have.
   */
  claimAll(owner) {
    owner = normOwner(owner);
    const had = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND genesis=1').all(owner).map(r => this.toMonstar(r)).filter(m => !m.species.legendary && !(this.gifts[owner] || []).includes(m.species.id));
    const starters = (had.length ? had : starterSpecies(owner).map(id => this.claimGenesis(owner, id))).sort((x, y) => x.serial - y.serial);
    return [...starters, ...this.claimLegendaries(owner)];
  }

  /**
   * Breeding: each player gets one Infant. Stat rolls are averaged from both parents with a random
   * mutation (-3..+3), and rarity can move one tier up or down, so a child can be stronger or weaker.
   */
  breed({ a, b, seed = randomBytes(16).toString('hex') }) {
    if (a.owner === b.owner) throw Error('Breeding needs Monstars from two different players.');
    const rnd = (k) => parseInt(createHash('sha256').update(seed + ':' + k).digest('hex').slice(0, 8), 16) / 0xffffffff;
    const genesisOf = m => (m.species.legendary || m.species.hero ? null : m.species.id); // legendaries and drop heroes never breed copies
    const children = [];
    const benders = [a, b].filter(m => m.species.bender);
    for (const [i, parent] of [a, b].entries()) {
      let sid = rnd('sp' + i) < 0.5 ? genesisOf(a) : genesisOf(b);
      if (sid == null) sid = genesisOf(a) ?? genesisOf(b) ?? 8;
      // Benders breed true: the baby is a bender whose powers combine both parents (see Monstar.kit / fusion)
      if (benders.length) sid = (benders.length === 2 ? (rnd('bd' + i) < 0.5 ? a : b) : benders[0]).species.id;
      const ivs = a.traits.ivs.map((v, k) => Math.max(0, Math.min(15, Math.round((v + b.traits.ivs[k]) / 2 + Math.floor(rnd(`iv${i}${k}`) * 7) - 3))));
      const avgR = (rarityIndex(a.traits.rarity) + rarityIndex(b.traits.rarity)) / 2;
      const rIdx = Math.max(0, Math.min(RARITIES.length - 1, Math.round(avgR + (rnd('r' + i) < 0.2 ? 1 : rnd('r' + i) > 0.8 ? -1 : 0))));
      children.push(this.insertUnique({ speciesId: sid, originOwner: parent.owner, owner: parent.owner, genesis: false, collection: 'bred',
        parents: `${a.serial},${b.serial}`,
        dnaFor: n => composeDna(createHash('sha256').update(`pocketmonstars:breed:${seed}:${i}:${n}`).digest('hex'), { rarity: RARITIES[rIdx].name, ivs }) }));
    }
    return children;
  }

  /** A wild Monstar caught in the Wild Expedition. It always hatches as an Infant with its own unique DNA. */
  catchWild(owner, speciesId) {
    owner = normOwner(owner);
    if (!WILD_IDS.includes(speciesId)) throw Error('That is not a wild species.');
    const seed = randomBytes(8).toString('hex'), sp = SPECIES[speciesId];
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: false, collection: sp.collection, exp: 0,
      dnaFor: n => createHash('sha256').update(`pocketmonstars:wild:${owner}:${speciesId}:${seed}:${n}`).digest('hex') });
  }

  /** A Superhero Drop Monstar bought with SOL: one of each hero ever, level 1, unique DNA. */
  grantHero(owner, speciesId, signature) {
    owner = normOwner(owner);
    if (!HERO_IDS.includes(speciesId)) throw Error('That is not a drop hero.');
    const had = this.db.prepare('SELECT * FROM monstars WHERE species=? ORDER BY serial LIMIT 1').get(speciesId);
    if (had) return this.toMonstar(had);
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: false, collection: 'heroes', exp: 0,
      dnaFor: n => composeDna(createHash('sha256').update(`pocketmonstars:hero:${speciesId}:${signature}:${n}`).digest('hex'), { rarity: 'Legendary', ivs: [15, 15, 14, 15, 14, 15] }) });
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

  /** A bred bender carries the other parent's powers: the parent whose species differs from the baby's. */
  fusionOf(row) {
    if (!row.parents || !SPECIES[row.species].bender) return null;
    for (const s of String(row.parents).split(',').map(Number)) { const p = this.db.prepare('SELECT species FROM monstars WHERE serial=?').get(s); if (p && p.species !== row.species) return p.species; }
    return null;
  }
  toMonstar(row) {
    return new Monstar({ speciesId: row.species, dna: row.dna, serial: row.serial, originOwner: row.origin_owner, owner: row.owner, asset: row.asset,
      exp: row.exp || 0, collection: row.collection || SPECIES[row.species].collection, parents: row.parents || null, fusion: this.fusionOf(row) });
  }
}

/** Public NFT metadata JSON (Metaplex token standard). */
export function metadataJson(monstar, publicUrl, royaltyBps) {
  return {
    name: monstar.displayName,
    symbol: 'MONSTAR',
    description: `${monstar.displayName}, a one-of-a-kind ${monstar.traits.rarity} ${monstar.type} ${monstar.className} (${monstar.stage.name}, level ${monstar.level}). ${monstar.cls.passive} Born to ${monstar.originOwner}.`,
    image: `${publicUrl}/art/nft/${nftArt(monstar.species)}`,
    external_url: `${publicUrl}/play#monstar-${monstar.serial}`,
    seller_fee_basis_points: royaltyBps,
    attributes: monstar.toAttributes(),
    properties: { category: 'image', files: [{ uri: `${publicUrl}/art/nft/${nftArt(monstar.species)}`, type: monstar.species.portrait ? 'image/jpeg' : 'image/png' }],
      creators: [{ address: monstar.originOwner, share: 100 }] },
  };
}
