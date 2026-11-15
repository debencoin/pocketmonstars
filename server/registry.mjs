// Authoritative Monstar registry. Every Monstar gets a DNA derived from the wallet it was born to,
// and the database refuses any repeat DNA or repeat visible-trait combination. Serials never change.
// Levels (EXP) are stored here; Legendary and Bred collections are created here too.
import { createHash, randomBytes } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { WILD_ONE_IDS, HERO_IDS, SALE_IDS, STARTER_IDS, expForLevel as expAt, legendaryIdsFor, nftArt, SPECIES, GENESIS_IDS, LEGENDARY_IDS, WILD_IDS, RARITIES, Monstar, traitsFromDna, traitSignature, composeDna, rarityIndex, expForLevel } from '../shared/monstars.mjs';

export function deriveDna(owner, speciesId, nonce) {
  return createHash('sha256').update(`pocketmonstars:dna:v1:${owner}:${speciesId}:${nonce}`).digest('hex');
}

/** Players are wallets (base58) or username accounts ("@name"). */
export const isAccount = id => typeof id === 'string' && id.startsWith('@');
export const normOwner = id => (isAccount(id) ? id : new PublicKey(id).toBase58());
/** Species a new player can start with: the Genesis nine plus every Common, Uncommon and Rare wild Monstar. */
/** New players start with ONE Starter Bender (water, earth, fire, air or thunder), picked at random. */
export const STARTER_POOL = STARTER_IDS.slice();
/** Every new player gets ONE random Monstar from the pool (fixed per player, so it is the same after a server reset). */
export function starterSpecies(owner) {
  const h = createHash('sha256').update('pocketmonstars:starter:v3:' + randomBytes(8).toString('hex') + owner).digest();
  return [STARTER_POOL[h.readUInt32BE(0) % STARTER_POOL.length]];
}

const hasTable = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
export class Registry {
  constructor(db, { legendaryOwner = null, royalOwner = null, gifts = {}, creators = {} } = {}) {
    // collection -> creator wallet: the artist who drew that collection. Its Monstars are "born to" the creator, so the
    // 5% resale royalty goes to that wallet for ever, whoever holds or sells them.
    this.creators = Object.fromEntries(Object.entries(creators || {}).map(([c, w]) => [c, new PublicKey(w).toBase58()]));
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
    // the old benders were retired (the Element Masters replace them): unminted ones leave every wallet
    if (!db.prepare("SELECT 1 FROM meta WHERE k='retire-benders-v1'").get()) {
      const gone = SPECIES.filter(s => s.retired).map(s => s.id).join(',') || '-1';
      try { db.exec(`DELETE FROM monstars WHERE species IN (${gone}) AND asset IS NULL`); } catch (e) { console.error('retire benders:', e.message); }
      db.prepare("INSERT INTO meta(k,v) VALUES('retire-benders-v1','done')").run();
    }
    // one-of-a-kind wild Monstars the founder released: the one wild copy of each species, recorded when it is caught (the
    // primary key makes a second catch impossible). The founder wallet's unminted, unlisted copies leave it so the wild one is the
    // copy players chase. A minted copy is a real NFT: it stays.
    db.exec('CREATE TABLE IF NOT EXISTS wild_ones(species INTEGER PRIMARY KEY, serial INTEGER NOT NULL, owner TEXT NOT NULL, caught_at INTEGER NOT NULL)');
    if (WILD_ONE_IDS.length && this.legendaryOwner) {
      const ids = WILD_ONE_IDS.join(','), f = this.legendaryOwner, keep = 'serial NOT IN (SELECT serial FROM wild_ones)' + (hasTable(db, 'usd_listings') ? ' AND serial NOT IN (SELECT serial FROM usd_listings)' : '');
      try {
        const r = db.prepare(`DELETE FROM monstars WHERE species IN (${ids}) AND owner=? AND asset IS NULL AND ${keep}`).run(f);
        db.prepare(`DELETE FROM gift_claims WHERE owner=? AND species IN (${ids})`).run(f);
        if (r.changes) console.log(`released ${r.changes} one-of-a-kind Monstar(s) from the founder wallet to the wild`);
        for (const x of db.prepare(`SELECT serial, species FROM monstars WHERE species IN (${ids}) AND owner=? AND (asset IS NOT NULL OR NOT (${keep}))`).all(f))
          console.warn(`#${x.serial} (${SPECIES[x.species].name}) is minted or listed, so it stays in the founder wallet`);
      } catch (e) { console.error('release to wild:', e.message); }
    }
    // gifts handed out (so a gift is given once, even when the Monstar is born to its creator and not to the holder)
    db.exec('CREATE TABLE IF NOT EXISTS gift_claims(owner TEXT NOT NULL, species INTEGER NOT NULL, serial INTEGER NOT NULL, PRIMARY KEY(owner, species))');
    for (const [coll, creator] of Object.entries(this.creators)) { // existing unminted Monstars of a creator's collection: the royalty moves to the creator
      for (const r of db.prepare('SELECT serial, species, origin_owner, genesis FROM monstars WHERE collection=? AND origin_owner<>? AND asset IS NULL').all(coll, creator)) {
        if (r.genesis) db.prepare('INSERT OR IGNORE INTO gift_claims(owner, species, serial) VALUES(?,?,?)').run(r.origin_owner, r.species, r.serial);
        db.prepare('UPDATE monstars SET origin_owner=? WHERE serial=?').run(creator, r.serial);
      }
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

  /** The starter a player may still swap: their own unminted starter, until they have chosen once. */
  starterState(owner) {
    owner = normOwner(owner);
    const row = this.db.prepare(`SELECT * FROM monstars WHERE origin_owner=? AND owner=? AND genesis=1 AND asset IS NULL AND species IN (${STARTER_POOL.join(',') || '-1'}) ORDER BY serial LIMIT 1`).get(owner, owner);
    const chosen = !!this.db.prepare('SELECT 1 FROM meta WHERE k=?').get('starter-chosen:' + owner);
    return { canChoose: !!row && !chosen, current: row ? row.species : null, options: STARTER_POOL.slice() };
  }
  /** New players pick their element: once, their random starter is swapped for the Element Master they choose. */
  chooseStarter(owner, speciesId) {
    owner = normOwner(owner); speciesId = Number(speciesId);
    if (!STARTER_POOL.includes(speciesId)) throw Error('Choose earth, air, water or fire.');
    const st = this.starterState(owner); if (!st.canChoose) throw Error('You have already chosen your element.');
    if (st.current !== speciesId) { this.db.prepare('DELETE FROM monstars WHERE origin_owner=? AND owner=? AND genesis=1 AND asset IS NULL AND species=?').run(owner, owner, st.current); }
    const m = this.claimGenesis(owner, speciesId);
    this.db.prepare('INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)').run('starter-chosen:' + owner, String(speciesId));
    return m;
  }

  /** Give a wallet its own one-of-a-kind version of a Genesis species (one per species per wallet). Starts as an Infant. */
  claimGenesis(owner, speciesId) {
    owner = normOwner(owner);
    if (!STARTER_POOL.includes(speciesId) && !GENESIS_IDS.includes(speciesId)) throw Error('Unknown species');
    const existing = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1').get(owner, speciesId);
    if (existing) return this.toMonstar(existing);
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: true, collection: SPECIES[speciesId].collection, dnaFor: n => deriveDna(owner, speciesId, n) });
  }

  /** The founder wallet holds the Legendary collections. They hatch as level 1 Infants with elite attributes (Legendary rarity, near-perfect rolls, +20% stats). */
  claimLegendaries(owner) {
    owner = normOwner(owner);
    const key = owner === this.legendaryOwner ? 'founder' : owner === this.royalOwner ? 'royal' : null;
    const ids = [...(key ? legendaryIdsFor(key) : []), ...(this.gifts[owner] || [])].filter(sid => !(SPECIES[sid].wildOne && owner === this.legendaryOwner)); // the founder's released one-of-a-kinds are only caught now
    if (!ids.length) return [];
    return ids.map(sid => {
      const creator = this.creators[SPECIES[sid].collection];
      const claim = creator && this.db.prepare('SELECT serial FROM gift_claims WHERE owner=? AND species=?').get(owner, sid);
      const existing = claim ? this.db.prepare('SELECT * FROM monstars WHERE serial=?').get(claim.serial)
        : this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND species=? AND genesis=1' + (creator ? ' AND owner=?' : '')).get(...(creator ? [creator, sid, owner] : [owner, sid]));
      if (existing) return this.toMonstar(existing);
      const m = this.insertUnique({ speciesId: sid, originOwner: creator || owner, owner, genesis: !creator || creator === owner, /* one genesis per (born-to wallet, species): other holders' gifts are tracked in gift_claims */ collection: SPECIES[sid].collection, exp: 0,
        dnaFor: n => composeDna(deriveDna(owner, sid, n), { rarity: 'Legendary', ivs: [15, 15, 15, 15, 15, 15].map((v, k) => v - ((n + k) % 2)) }) });
      if (creator) this.db.prepare('INSERT OR IGNORE INTO gift_claims(owner, species, serial) VALUES(?,?,?)').run(owner, sid, m.serial);
      return m;
    });
  }

  /**
   * Every wallet starts with three Genesis Monstars of its own, picked from its address (so players get
   * different starters). The rest of the species are caught in the Wild Expedition.
   * Wallets that already hatched more before this rule keep everything they have.
   */
  claimAll(owner) {
    owner = normOwner(owner);
    const had = this.db.prepare('SELECT * FROM monstars WHERE origin_owner=? AND genesis=1').all(owner).map(r => this.toMonstar(r)).filter(m => !m.species.legendary && !(this.gifts[owner] || []).includes(m.species.id) && !this.creators[m.species.collection]);
    const starters = (had.length ? had : starterSpecies(owner).map(id => this.claimGenesis(owner, id))).sort((x, y) => x.serial - y.serial);
    const all = [...starters, ...this.claimLegendaries(owner)], seen = new Set();
    return all.filter(m => !seen.has(m.serial) && seen.add(m.serial)); // a gifted starter is the same Monstar, listed once
  }

  /**
   * Breeding: each player gets one Infant. Stat rolls are averaged from both parents with a random
   * mutation (-3..+3), and rarity can move one tier up or down, so a child can be stronger or weaker.
   */
  breed({ a, b, seed = randomBytes(16).toString('hex') }) {
    if (a.owner === b.owner) throw Error('Breeding needs Monstars from two different players.');
    const rnd = (k) => parseInt(createHash('sha256').update(seed + ':' + k).digest('hex').slice(0, 8), 16) / 0xffffffff;
    const genesisOf = m => (m.species.legendary || m.species.hero || m.species.drop || m.species.unique || m.species.wildOne ? null : m.species.id); // one-of-a-kind wild ones never breed copies // legendaries and drop heroes never breed copies
    const children = [];
    const benders = [a, b].filter(m => m.species.bender && !m.species.unique); // COVO and COVA stay one of a kind
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
  /** A caught wild Monstar. Phantom wallets keep the level it had when they beat it; username accounts get it as a level 1 Infant. */
  catchWild(owner, speciesId, level = 1) {
    owner = normOwner(owner);
    if (!WILD_IDS.includes(speciesId)) throw Error('That is not a wild species.');
    // one of a kind: the first catch wins it, for good (the check and the insert run in one synchronous step, so two catches can't both pass)
    if (!SPECIES[speciesId].wildOne) return this.catchAny(owner, speciesId, level);
    if (this.wildOneTaken(speciesId)) throw Error(`${SPECIES[speciesId].name} is one of a kind and was already caught by another player.`);
    const m = this.catchAny(owner, speciesId, level);
    this.db.prepare('INSERT INTO wild_ones(species, serial, owner, caught_at) VALUES(?,?,?,?)').run(speciesId, m.serial, owner, Date.now());
    return m;
  }
  /** True once the one wild copy of a one-of-a-kind Monstar has been caught. */
  wildOneTaken(speciesId) { return !!this.db.prepare('SELECT 1 FROM wild_ones WHERE species=?').get(speciesId); }
  catchAny(owner, speciesId, level) {
    const seed = randomBytes(8).toString('hex'), sp = SPECIES[speciesId], keep = !owner.startsWith('@') && level > 1;
    return this.insertUnique({ speciesId, originOwner: owner, owner, genesis: false, collection: sp.collection, exp: keep ? expAt(Math.min(100, Math.floor(level))) : 0,
      dnaFor: n => createHash('sha256').update(`pocketmonstars:wild:${owner}:${speciesId}:${seed}:${n}`).digest('hex') });
  }

  /** A Superhero Drop Monstar bought with SOL: one of each hero ever, level 1, unique DNA. */
  grantHero(owner, speciesId, signature) {
    owner = normOwner(owner);
    if (!SALE_IDS.includes(speciesId)) throw Error('That Monstar is not for sale.');
    const had = this.db.prepare('SELECT * FROM monstars WHERE species=? AND genesis=0 AND serial NOT IN (SELECT serial FROM gift_claims) ORDER BY serial LIMIT 1').get(speciesId); // the one market copy (gifts are genesis)
    if (had) return this.toMonstar(had);
    return this.insertUnique({ speciesId, originOwner: this.creators[SPECIES[speciesId].collection] || owner, owner, genesis: false, collection: SPECIES[speciesId].collection, exp: 0,
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
