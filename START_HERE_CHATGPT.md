# PocketMonstars: handoff for ChatGPT (or any coding assistant)

Live site: https://pocketmonstars.onrender.com (game at /play)
Repo: https://github.com/debencoin/pocketmonstars
Network: Solana **devnet** only. Mainnet is locked unless `PM_ALLOW_MAINNET=yes-reviewed` after legal and security review.

## What it is
Real-time 2D creature arena on Solana with Phantom. Monstars move on their own; players call moves from four move cards.
Staked 1v1/3v3 duels: every hit moves a tiny, level-based amount of SOL between the players' shares; the winner takes the pot when the match ends (paid in one settlement transaction from a per-match escrow). 105 species, Wild Expedition catching (0.0001 SOL entry), breeding, NFT minting (Metaplex Core) and a royalty marketplace.

## Run it
```
npm install
npm run build      # bundles src/stake-client.js -> dist/stake-client.js (needed after any change in shared/ or src/)
npm test           # 33 tests (node:test)
npm start          # http://localhost:8080 (Node 22+, uses node:sqlite)
```
Env vars (see DEPLOY.md): `PM_TREASURY` (company wallet), `PM_LEGENDARY_OWNER`, `PM_DATA_DIR`, `PM_WILD_FEE_LAMPORTS`, `PM_BREED_FEE_LAMPORTS`, `PORT`. Server keypairs are generated into `PM_DATA_DIR` on first run and are never committed.

## Where things are
| Area | File |
|---|---|
| Battle engine (server + browser), statuses, 3v3, ULT, pickups, speed/damage tuning | `shared/sim.mjs` |
| Species, classes, types, tiers, stats, evolution (6 stages: 1/3/10/25/50/80) | `shared/monstars.mjs` |
| Frontier, Mythic, Anunnaki, Watchers species data + art descriptors | `shared/frontier.mjs` |
| Stake ledger, per-hit SOL fee (`hitFee`), settlement split | `shared/stake.mjs` |
| Match rooms, escrow, settlement, AI, paid wild battles | `server/matches.mjs` |
| HTTP/WebSocket routes (auth, mint, market, breeding, wild fee) | `server/index.mjs` |
| Registry: unique DNA, 3 starters per wallet, catching, breeding | `server/registry.mjs` |
| Renderer (canvas arena, powers, status visuals) | `dist/pixel-arena.js` |
| Arena UI, HUD, move cards, 3v3, lobby, market | `dist/pvp-v4.js`, `dist/pvp-v4.css` |
| Wild Expedition UI | `dist/wild.js` |
| Landing page with playable mini battle | `dist/site.html` |
| Sprite / card generators | `scripts/make_sprites.py`, `scripts/make_frontier.py`, `scripts/make_cards.py` |
| Change history and design notes | `STAKE_DUEL.md`, `SOLANA_DESIGN.md`, `DEPLOY.md` |

## Key numbers (current)
- Game speed 0.7x, damage x0.7, battle HP x1.7; 1v1 round 60 s, 3v3 150 s.
- Stakes: min 0.001 SOL; presets 0.001/0.002/0.005/0.01. Company fee 1 lamport per match.
- Per-hit SOL: ~0.00000026 (Lv1 jab) up to 0.00001 cap (Lv50+ specials).
- Wild entry 0.0001 SOL; catch chance by tier: Common 60% ... Divine 3%. Caught Monstars hatch as Infants.
- Breeding fee 0.01 SOL per player.

## Rules to keep
- Never ask for or store seed phrases or private keys; Phantom signs everything client-side.
- No secrets in the repo or the browser.
- Keep devnet until a security and legal review.
- After editing `shared/*`, run `npm run build` and `npm test`.
- Original creatures only: do not copy Pokemon, Digimon or other existing characters or art.
