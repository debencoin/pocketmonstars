# PocketMonstars v4: Stake Duel, unique Monstars, Monstar Market

Status: built and tested locally against a mocked chain. Everything is locked to **Solana devnet**. Real Phantom signing and real devnet transactions still need to be tried by the owner (the build environment cannot reach Solana RPC).

## Run it

```sh
npm ci
npm test            # gameplay checks + 18 tests: gameplay, rewards, stake math, registry uniqueness, auth, escrow flow, marketplace
npm run build       # bundles dist/chain-client.js and dist/stake-client.js
npm start           # game + API + WebSocket on http://localhost:8080
```

Optional, once per environment:

```sh
PM_TREASURY=<company wallet> npm start   # receives the 1-lamport fees; must already hold ~0.00089 SOL (rent minimum)
npm run setup:collection                 # creates the official PocketMonstars collection (fund the printed authority with devnet SOL first)
PM_PUBLIC_URL=https://your-domain npm start   # public HTTPS base for NFT metadata and art
```

On a phone, Phantom only injects into its own in-app browser. The 1v1 tab shows an "Open this game in the Phantom app" link (`https://phantom.com/ul/browse/<url>?ref=<origin>`). Phantom requires HTTPS, so host the server behind TLS for phone testing.

## Smallest increment on Solana

- 1 lamport = 0.000000001 SOL. It is the smallest amount any SOL balance can change by. SPL tokens have their own smallest unit set by decimals (MNRG draft: 9 decimals).
- Every transaction pays a 5,000-lamport base fee per signature, so sending 1 lamport per hit as its own transaction would cost 5,000× more in fees than the hit is worth, and need a Phantom approval each time.
- An account must hold the rent-exempt minimum (~890,880 lamports for an empty account) or be emptied to zero. That sets the minimum stake at 0.001 SOL.

## Stake Duel (1v1)

1. Both players sign in (Phantom signs a message, no funds move).
2. Player A creates a match with a stake; player B joins with the 6-letter code.
3. Each player approves one deposit in Phantom: a plain System Program transfer of exactly the stake into that match's escrow account. The server verifies each deposit on-chain and refuses to reuse a deposit signature.
4. The server runs the fight at 30 Hz. Clients only send inputs, so hits cannot be faked.
5. Every landed hit moves `stake × damage ÷ victim max HP` lamports (minimum 1) from the victim's share to the attacker's share. Both screens show the shares changing live, with a +SOL pop on every hit. Every hit is logged in `hit_log`.
6. KO: winner takes the whole pot. Time up: higher HP % takes the whole pot. Exact tie: each keeps their share. Disconnect for 15 s: forfeit.
7. Settlement is one transaction signed by the escrow key: the escrow pays the 5,000-lamport network fee itself, 1 lamport goes to the company treasury, and the rest goes to the players by final share. The escrow drains to exactly zero. Signed bytes are saved before broadcast.
8. If a match never starts, verified deposits are refunded with no company fee.

**Why balances change live in the game but in Phantom at the end:** per-hit on-chain transfers would cost more in fees than they move and would need a wallet popup per hit. The live shares are the server's authoritative ledger of the escrowed pot; the wallet balances change when the settlement confirms, a few seconds after the KO. A future option for true per-hit on-chain state is MagicBlock Ephemeral Rollups (delegate the match account, update it gaslessly in real time, commit the result to Solana).

**Trust model today:** the escrow key is generated and held by the server (stored in SQLite on devnet). Players trust the company to settle honestly. Before real money, replace this with an on-chain escrow program that only releases funds against a referee-signed result, plus KMS-managed keys.

## Unique Monstars

- On first sign-in, a wallet receives its own version of all nine species. DNA = SHA-256 of the wallet address, species and a nonce.
- DNA sets rarity (Common 60%, Uncommon 25%, Rare 10%, Epic 4%, Legendary 1%), aura, pattern, nature (±10% stats), hue, markings and six stat rolls (0–15 each).
- The registry has UNIQUE constraints on DNA and on the full visible trait signature. If a new roll matches any existing Monstar, it re-rolls. Serials never change.
- Minting: the server builds a Metaplex Core create transaction, signs as the asset key and the collection authority, and the player approves and pays the rent in Phantom. Only registry Monstars can join the official collection. On-chain attributes carry serial and DNA; the server checks them before linking the asset.

## Classes

`shared/monstars.mjs` defines a `MonstarClass` base and nine subclasses with base stats and a combat passive the server applies:

| Class | Species | Passive |
| --- | --- | --- |
| Striker | Cindercub | +12% damage |
| Warden | Mossprout | −15% damage taken |
| Skirmisher | Ripplefin | Dash recharges 35% faster |
| Ranger | Voltwing | Projectiles 25% faster |
| Mystic | Duskhorn | Energy regen +30% |
| Sentinel | Pebblit | Guard lasts twice as long |
| Arcanist | Frostuft | Special recharges 25% faster |
| Support | Bloomtail | Regenerates 0.8% HP/s |
| Titan | Soloryx | Immune to knockback |

Stats: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed. Types: EMBER, GROVE, TIDE, SPARK, SHADE, STONE, FROST, ASTRAL (1.5× strong / 0.7× weak).

## Monstar Market

- **List:** the seller approves the market authority as the asset's Transfer Delegate in Phantom (it can move only that Monstar, and Core clears the delegate on every transfer).
- **Buy:** the server builds one transaction: buyer pays seller, pays the royalty to the Monstar's origin wallet (default 5%, `PM_ROYALTY_BPS`), pays 1 lamport to the treasury, and the market authority transfers the NFT. The server co-signs; the buyer signs and submits. All parts succeed together or nothing moves.
- **Send:** owners can gift a minted Monstar to any wallet (no royalty, no fee).
- **Royalty scope:** royalties are guaranteed on sales through this market. Sales on outside marketplaces only pay them if those marketplaces honour Core royalties. Full enforcement would need a `ProgramAllowList` rule set naming approved marketplace programs, which also restricts transfers through other programs.

## Before mainnet

- Get legal advice. Staking SOL on the outcome of a 1v1 match can be treated as gambling or a regulated skill-gaming contest depending on the state or country (Arizona included). Age and location checks may be required.
- Replace the server-held escrow with an audited on-chain escrow program; move keys into a KMS or multisig.
- Add matchmaking limits, collusion detection (repeat pairs, self-play across wallets) and replay review before raising stake caps.
- Host metadata/art on durable public HTTPS (or Arweave) and set `PM_PUBLIC_URL`.
- Run the full flow on devnet with real Phantom wallets: sign-in, deposit, settlement, refund, mint, list, buy, send.
- Mainnet is blocked in code unless `SOLANA_CLUSTER=mainnet-beta PM_ALLOW_MAINNET=yes-reviewed`.

## Files added in v4

- `shared/monstars.mjs` classes, species, DNA traits · `shared/stake.mjs` lamport math · `shared/sim.mjs` authoritative combat
- `server/` HTTP + WebSocket server, auth, registry, escrow, matches, NFT mint + market
- `src/stake-client.js` → `dist/stake-client.js` browser client (window.PMStake)
- `dist/pvp-v4.js`, `dist/pvp-v4.css` the 1v1 Stake tab, touch controls, Monstar cards, market UI
- `tests/pvp.test.mjs`

## v7 gameplay: autopilot, EXP, evolution, legendaries, breeding

- **Autopilot movement.** Each species moves and dodges on its own in its style (pounce, dart, glide, stomp, blink-teleport, skate, prance, charge, hover). Players tap A (attack) and B (special); dragging or WASD takes over movement until released. Aim is automatic unless a desktop player moves the mouse.
- **EXP and levels.** Each landed hit earns EXP (≈1.2 × damage, ×1.5 on a critical). Finishing a match gives +15, a win +40. EXP to the next level is `12 × level^1.5`. Levels persist on registered Monstars (online matches and signed-in Practice vs AI); guest practice saves on the device.
- **Evolution.** Infant (Lv1) → Rookie (3) → Champion (10) → Ultimate (25) → Mega (50) → Ascended (80). Stats grow 3% per level and by a stage multiplier (×1.0 → ×1.75). A Monstar can evolve mid-match: it flashes, grows and gets a short invulnerability window. Looks: Infant sits in an egg shell, Ultimate gets a glowing outline, Mega grows two wings, Ascended has four wings, a gold glow and a halo.
- **SOL is paid only at the end.** Per-hit lamports show live as "SOL at end"; leaving or disconnecting for 15 s forfeits the pot.
- **Legendary collection.** Seraphon (four-winged Seraph, holy lance + Heaven's Judgment) and Psyvolt (Psion that levitates boulders and hurls them, then finishes with chained lightning) are created only for `PM_LEGENDARY_OWNER` (default Dc9s1YwNHE2xDBzpprDvyruzxj8j5HvBSvfbvdups5LJ), at Lv80 Ascended with Legendary rarity.
- **Breeding.** Player A starts with one Monstar and gets a code; player B joins with one of theirs. Each pays `PM_BREED_FEE_LAMPORTS` (default 0.01 SOL) to `PM_TREASURY`, verified on-chain. Each player receives a new Infant (Bred collection): species from either parent, stat rolls averaged with a −3..+3 mutation, rarity can move one tier up or down. Breeding is paused until `PM_TREASURY` is set.
- **Arenas.** Stone Coliseum, Dust Bowl, Grass Pitch and Cosmic Dome, picked at random per match.

## v8: battle screen, powers, Wild Expedition, front page

- **Battle screen** (`dist/pvp-v4.js`, `dist/pvp-v4.css`): HUD cards with round portrait, name, level, type pill (turns into the red move name when a power is used), HP and EXP bars, and each side's SOL with the +/− change. The round A/B/DASH/G buttons are gone; a "What will X do?" panel holds four move cards (attack, special, dash, guard) with type, energy cost, effectiveness vs the rival and a cooldown strip. Keys 1–4 also work. Phones in portrait stack HUD / arena / moves; landscape and desktop put the moves on the right.
- **SOL in every match**: staked matches show real shares (paid when the match ends). Practice, AI and free matches show a pretend 0.01 SOL pot that moves on every hit and is clearly labeled as not real SOL.
- **Powers** (`dist/pixel-arena.js`): smooth full-resolution layer on top of the pixel arena: dust clouds, impact star flashes, shockwave rings, flying rock chunks and cracked craters, thick glowing curved lightning, swirling water streams for Maelstrom, glowing fireball with flame trail, dash dust and ghost trails, broken stone pillars in the Stone Coliseum. Sprites are the cleaner `art/hd` set, drawn larger.
- **Wild Expedition** (`dist/wild.js`): replaces the old Adventure mode. Four zones (Grass Pitch, Dust Bowl, Stone Coliseum, Cosmic Dome), three wild battles and a boss per zone, using the same engine, HUD and move cards. Progress is saved on the device. `/play#wild` opens it.
- **Front page** (`dist/site.html`): notice bar, pixel title with Monstar picker icons, a playable mini battle with move cards, wins/streak, speed and full screen controls, and CTA cards on the right.
