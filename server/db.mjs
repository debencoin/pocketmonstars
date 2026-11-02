import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS monstars(
      serial INTEGER PRIMARY KEY AUTOINCREMENT,
      species INTEGER NOT NULL,
      origin_owner TEXT NOT NULL,
      owner TEXT NOT NULL,
      dna TEXT NOT NULL UNIQUE,
      trait_sig TEXT NOT NULL UNIQUE,
      nonce INTEGER NOT NULL,
      genesis INTEGER NOT NULL DEFAULT 1,
      asset TEXT UNIQUE,
      mint_signature TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_genesis_per_wallet_species ON monstars(origin_owner, species) WHERE genesis=1;
    CREATE TABLE IF NOT EXISTS matches(
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      stake TEXT NOT NULL,
      player_a TEXT NOT NULL, player_b TEXT,
      monstar_a TEXT, monstar_b TEXT,
      escrow TEXT, escrow_secret TEXT,
      deposit_a TEXT UNIQUE, deposit_b TEXT UNIQUE,
      state TEXT NOT NULL,
      winner INTEGER, reason TEXT,
      shares TEXT, hits TEXT,
      settlement_bytes TEXT, settlement_signature TEXT UNIQUE,
      created_at INTEGER NOT NULL, ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS hit_log(
      match_id TEXT NOT NULL, seq INTEGER NOT NULL, t REAL NOT NULL,
      attacker INTEGER NOT NULL, damage INTEGER NOT NULL, fee TEXT NOT NULL,
      PRIMARY KEY(match_id, seq)
    );
    CREATE TABLE IF NOT EXISTS listings(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset TEXT NOT NULL, serial INTEGER, seller TEXT NOT NULL,
      price TEXT NOT NULL, state TEXT NOT NULL,
      buyer TEXT, signature TEXT UNIQUE,
      created_at INTEGER NOT NULL, closed_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_listing ON listings(asset) WHERE state='active';
  `);
  return db;
}
