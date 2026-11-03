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

## v9: blue theme and reference-style UI

- Whole site and game moved from green to the navy palette (`#080c18` / `#10172a` / `#2a3550`, yellow `#ffd84a` buttons, cyan accents) with Inter type instead of the pixel font for HUD, cards and text.
- Move cards are dark with a type-coloured border, type pill, number badge and cyan ⚡ cost; cooling-down moves show dashed. The message box reads "A wild X appeared!" then "What will X do?".
- Front page header: title, subtitle and Monstar picker icons; the mini battle has the arena on the left and the HP/SOL cards, message box and moves on the right, with wins/streak/best and Speed / Auto / Full screen.
- Smooth `art/hd` sprites are used everywhere (cards, roster, picker); in-canvas numbers use Inter.

## v10: Frontier (50 wild Monstars), Mythics, 3v3, paid wild catching

- **54 new species** (`shared/frontier.mjs`): 50 Frontier Monstars in four rarity tiers (Common, Uncommon, Rare, Epic) plus Mythic angels Aurielle, Valkyra and Nimbiel and the Divine god Aeonox (new Deity class). Four new types: VENOM, STEEL, GALE, DRACO. Tiers set how often they appear, a stat multiplier (×0.94 to ×1.45) and the catch chance (60% to 3%). Sprites are drawn by `scripts/make_frontier.py`.
- **Wild Expedition**: signed-in players pay **0.0001 SOL** (`PM_WILD_FEE_LAMPORTS`, default 100,000) to the treasury; the server verifies the transfer on-chain, refuses reused signatures (`wild_runs` table), picks a weighted random wild Monstar, runs the battle, and on a win rolls the catch. Caught Monstars always hatch as Infants. Mythic and Divine ones are higher level and fight harder. Guests can practice locally with no catching.
- **3v3**: `createMatch` takes teams; the next member comes in on a faint, players can switch (tap the team strip, or keys 5–7) with a 3 s cooldown; per-hit SOL fees use the whole team's HP so the pot still moves in proportion. Works for practice, server AI and free or staked PvP rooms (`mode: '3v3'`, `serials`).
- The 50 wild species and the Mythics are only playable once caught; Genesis stays free for everyone.

## v11: slower, longer fights where powers do things (modelled on poke2darena.com)

- `GAME_SPEED = 0.7` (all movement, timers and animations; the round clock stays real), `DAMAGE_SCALE = 0.7`, `BATTLE_HP = 1.7`; 1v1 rounds are 60 s (3v3 150 s). AI-vs-AI 1v1 now lasts ~50 s on average.
- **Status effects** (`STATUS`, `TYPE_STATUS`): specials always, basics 15%. Spark paralyzes (slow, moves can fail), Frost freezes, Ember/Draco burn and Venom poisons (damage over time, still moves SOL per tick), Grove entangles, Stone/Steel stun, Shade confuses (controls reversed), Psychic **levitates** (the rival is lifted, carried around in the air and can't act, then dropped), Tide/Gale sweep away (big knockback, slowed), Astral dazzles. Heavy hits cause a short "recovering" stagger. Each has its own on-sprite effect and label.
- **ULT meter** fills from damage dealt and taken; at 100% the next special is an Ultimate (×1.7 power, longer status).
- **HP +20% pickups** spawn every ~14 s. **CPU difficulty** Easy / Normal / Hard. Quick battle defaults to 3v3 and fills empty slots. New Volcano and Ice arenas.
- **Stakes**: presets 0.001 / 0.002 / 0.005 / 0.01 SOL, minimum 0.001 (no free PvP preset); practice pot is 0.001 SOL a side.
- **Market / NFT pictures**: `scripts/make_cards.py` makes a 512×512 framed card for every species (`dist/art/nft`), used by market cards and NFT metadata.

## v12: level-based hit fees, three starters, Anunnaki and Watchers

- **Per-hit SOL** (`hitFee` in `shared/stake.mjs`): no longer a share of the stake. Each hit moves lamports sized by the attacker's level, its attack stat for that move and the move's power (basic, special, Ultimate, crit; damage over time moves half). Lv1 jab ≈ 0.00000026 SOL, Lv25 special ≈ 0.0000047, Lv50+ specials reach the 0.00001 SOL cap. A KO still takes the whole pot.
- **Starters**: each wallet now hatches three Genesis Monstars chosen from a hash of its address (different players start differently); guests get three at random on their device. Wallets that already had all nine keep them. Everything else is caught in the wild; the Genesis nine now also roam the wild.
- **40 new species**: 20 **Anunnaki** (Mesopotamian sky lords, winged genies, lamassu guardians, fish-cloaked sages, chaos dragons) and 20 **Watchers** (Book of Enoch: many-eyed wheels, many-winged seers, fallen teachers, a Nephilim giant). New types ANCIENT (hits curse: −35% damage dealt) and WATCHER (hits mark: +25% damage taken). Anuvax and Semyazar are Divine; Enlilor and Azazelith Mythic. 105 species total, 103 in the wild.

## v13: finger/mouse movement, range guides, DNA shields, leaderboard, Ascendants

- **Movement**: touch the arena with a finger (or click/hold the mouse) and your Monstar runs there and follows the finger; thumb taps the move cards. Keyboard: 1-4 / Q,J / E,K / Space / L for moves, 5-7 switch, WASD steer. Aim is automatic.
- **Range guides**: your basic reach as a dashed ring; when the special is ready its landing area (strike target ring, cone, beam lane, levitation radius). A blue ring marks where you sent it.
- **Shields**: each Monstar has a DNA `shield` trait (55-98%), unique per wallet. With Guard up, a hit is blocked completely at that chance ("BLOCKED!", no damage, SOL or status); otherwise only 25% gets through.
- **Leaderboard** tab (`GET /api/leaderboard`): connected wallets ranked by net SOL earned in staked matches, then wins.
- **Ascendants**: 20 founder-supplied portraits (`dist/art/src/ascendants`) become legendary Monstars held by the founder wallet at Lv80. `scripts/make_portraits.py` puts each portrait's head on a drawn winged body so they animate like the others; their NFT picture is the original portrait (`art/nft/<name>.jpg`). Mint from the Monstars list to make each an NFT in the founder's wallet.
- Battle lock (`dist/lock.js`): no zoom and Back can't leave while a battle is live.

## v14: Ascendants as animated pixel characters
- The 20 Ascendants no longer use the photos in game or as NFT art. `scripts/make_walkers.py` draws each as a Game Boy-style pixel character inspired by its reference portrait (headdress, colours, glowing eyes, jewellery, staff/sword), with a 6-frame sheet in `dist/art/walk/`: two breathing idle frames and a 4-frame run cycle (striding legs, swinging arms, body bob). The renderer plays the run cycle while they move (faster on dashes) and the idle when they stop. They now run on the field (dart, charge, pounce, prance, stomp, skate) instead of hovering. The reference portraits stay in `dist/art/src/ascendants` but are not used.

## v15: founder legendaries hatch as elite Infants
- Legendary, Ascendant and other founder Monstars now start at level 1 (Infant) instead of 80, with elite attributes: Legendary rarity, near-perfect stat rolls and +20% stats at every level (`elite` in `statsAt`). Existing level-80 copies are reset to Infant once on server start (`meta` flag `legend-infants-v1`). They level up and evolve through play like everyone else.

## v16: Ascendants evolve into different characters
- Each Ascendant has six forms with their own names and art (`forms`, `formName`): Infant (small child in a plain cap, e.g. Kaelkit), Rookie (apprentice with a circlet, Kaelling), Champion (full design, Kaelor), Ultimate (cape, gold chestplate, spiked crown, weapon: Kaelor Prime), Mega (two great wings: Mega Kaelor), Ascended (four wings, halo, sparkling aura: Ascended Kaelor). `scripts/make_walkers.py` draws a 6-frame run/idle sheet per form (`dist/art/walk/<name>_s0..5.png`, icons `dist/art/hd/<name>_s0..5.png`). In battle the sprite, HUD name and picture switch the moment it evolves, with an "X evolved into Y!" banner.

## v17: every Monstar has its own five abilities; Phantom glitch fix
- `shared/abilities.mjs` gives each of the 125 species a kit: basic (own power, cooldown, shot speed; some fire double or homing shots), special (own power, cooldown, reach), **dash** (10 mechanics: Dash, Blink, Rush that slams the rival, Leap with a landing shockwave, Shadow Step behind the rival, Sprint, Trail that applies its type effect, Quake Step knockback, Mending Step heal, Phase Shift), **guard** (10: Ward block, Mirror Shell reflects shots, Riposte counterattack, Renewal heal, Thorn Guard damage back, Vanish, Siphon Guard charges ULT, Bastion, Repulse knock-away, Hex Mirror bounces status) and a **Mega Shot** fired from a full ULT meter (10: Barrage, Nova, Meteor Rain, Vortex, Chain Storm, Grand Lance, Stasis Field, Soul Drain, Pillar Line, Judgment). Each is tuned per species and named after it; tests prove no two dashes, guards, Mega Shots or kits are the same, and no two species share the same dash+guard+Mega mechanics.
- Move panel: Attack, Special, own Dash, own Guard and a wide Mega Shot card (keys 1-5, R = Mega; team switch moved to 6-8). The CPU uses Mega Shots too. ULT gain lowered to 1.0 per damage.
- **Glitch fix for the Phantom in-app browser**: Ascendant animation sheets are now loaded only for Monstars in the current battle (6 instead of 120), unloaded frames fall back to a loaded form instead of flickering, and the sprite cache is capped. The end screen of wild battles no longer overlaps the HUD.

## v18: fix for "blinking then Ready" in 1v1 (Phantom)
- Root cause: after a match ended the server kept broadcasting that finished room to the player for 30 s, and a match the player had left kept streaming until it closed. Starting a new fight within that window made the phone receive two matches at once: it flipped between them (blinking) and then dropped to "Ready" when the old one ended. Now every server message carries its match `code`, a player moving to a new match is detached from the old one (`release`), finished rooms are never re-broadcast, and the client ignores anything from other or finished matches.
- Sign-ins were held in server memory, so every restart/redeploy invalidated them and the client reconnected every 1.5 s forever. Session tokens are now HMAC-signed (`PM_SESSION_SECRET`, set on Render) and survive restarts; an invalid token closes once with code 4001 and the client asks to sign in again (no loop). Reconnects back off; on reconnect the server tells the client its current match or `noroom`.
- Practice falls back to on-device play if the server doesn't answer within 2.5 s. One failing match can no longer crash the server loop (per-room try/catch).

## v19: no passive healing
- HP only goes up from healing powers (Mending Step dash, Renewal guard, Soul Drain Mega Shot). Removed: class regeneration (Support, Seraph, Deity now have other passives), the HP +20% field pickups, and the 10% heal on level-up (a level-up keeps the same share of HP). Burn and poison can now finish a Monstar; at 0 HP it faints and the match ends (or the next 3v3 member comes in).

## v20: every Monstar becomes a new character at each evolution
- All 125 species have six named forms (e.g. Duskkit > Duskling > Duskhorn > Duskhorn Prime > Mega Duskhorn > Ascended Duskhorn) with their own art in `dist/art/hd/<name>_s0..5.png`: procedurally drawn species are redesigned per stage by `scripts/make_frontier.py` (baby with big eyes and no horns, young, adult, armoured with horns/spikes/stripes, winged Mega, golden Ascended with halo); the hand-drawn eleven get stage forms from `scripts/make_stages.py` (egg, tuft, original, horns + back spikes + aura, wings, gold + four wings + halo); Ascendants keep their animated sheets. The renderer loads stage art on demand and swaps it the moment a Monstar evolves mid-fight.
- Each evolution unlocks an upgrade (`STAGE_PERKS`, cumulative): Rookie +10% attack, Champion dash 25% farther and 20% faster recharge, Ultimate special +20% power/reach and 30% longer effects, Mega guard 40% longer and shield +10, Ascended Mega Shot +35% and ULT fills 25% faster. The evolution banner names the new form and the upgrade.

## v21: second founder wallet and the Royal Anunnaki
- Wallet `54y46qyavsX1hWXgx5W76WrBjghXxUfkcNftswaXNTbr` (`PM_ROYAL_OWNER`) holds its own legendary collection, different from the first founder wallet: eight Royal Anunnaki led by Queen Ninshara (horned crown of heaven, long hair, royal purple robe, golden side wings, staff), with Kingaru, Lahmuron, Gulani, Zababor, Shalira, Nisabel and Ninurtax. Animated walkers with six evolution forms each, elite level 1 Infants, never in the wild, mintable as NFTs. Species carry `legendFor` (founder | royal) and `legendaryIdsFor(key)` decides who gets which.

## v22 — finger dodge, 0.8x pace
- Touch: drag in the move zone to walk; a quick swipe (or double-tap toward a side) dashes/dodges that way.
- Game speed 0.7 → 0.56 (0.8x). Battle HP x1.6 so fights still end by KO in ~30–40 s typical.
- Fixed burn/poison accumulator (a comment had swallowed its reset, making DoT escalate).

## v23 — accounts, Superhero Drop, referrals, capture
- **Free play** on the front page (`/play#free` starts a battle at once, no sign-in).
- **Username + password accounts** (`server/players.mjs`, scrypt): free online play, free wild runs (one per 45 s). SOL actions (staking, drop, mint, market, breeding) still need Phantom.
- **One starter**: every new player gets one random Monstar from the Genesis nine + Common/Uncommon/Rare wild species. Existing players keep theirs.
- **Capture**: in a server wild battle, once the wild Monstar is at ≤25% HP a Capture! button appears. 3 throws per battle; odds are per species (25–65% base × rarity × lower-HP bonus × a new random roll each throw). A KO still gets the old catch roll.
- **Superhero Drop**: 30 original hero species (ids 133–162, `HEROES` in frontier.mjs, art from `scripts/make_heroes.py`). Top 5 = 1 SOL (×1.25 stats), others 0.5 SOL (×1.15). One of each, level 1. Paid to `dropTreasury` (founder wallet) with memo `PMDROP:<id>`; ends `PM_DROP_ENDS` (2026-12-03 03:30 UTC). On start the server rebuilds sales from on-chain memos, so buyers keep heroes after a wipe.
- **Referrals**: `?ref=<wallet or @name>` link + QR. When a referred player wins a staked match, 5% of their profit (payout − stake) goes to a wallet referrer in the same settlement tx.
- Tabs: Breeding has its own tab; Monstars tab is a full dex with all six evolutions per species.
- Free Render plan: accounts and referral records reset on each deploy (drop sales are rebuilt from chain).

## v24 — phone app, 0.9x pace, attributes
- Installable app (PWA): `manifest.webmanifest`, `sw.js` (art cached; /api and /ws never cached), icons in `dist/app/`. `app.js` adds an Install banner (Android prompt, iPhone Share → Add to Home Screen) and a bottom tab bar on phones.
- Simpler menu: Journey and Rewards removed (hidden), old Genesis 1–9 NFT designer hidden in the market, header shows one Sign in button.
- `GAME_SPEED` 0.63 (0.9x of the original 0.7); walking and dashing run at `MOVE_SPEED` 0.9 so players can dodge.
- Every Monstar in the dex and every drop hero shows attributes: six stats, total, bonus, five abilities and passive.

## v26 — Home, ☰ menu, sign-in pop-up
- `/` and `/play` both open the app on its **Home** tab (old one-page site moved to `/site`). `v6.js` adds the ☰ menu (Home, Arena, Wild, Monstars, Market, Breeding, Leaderboard, Guide); the old tab bar is hidden.
- Username sign-in lives only in the top-right button (pop-up). **Connect Phantom** sits right under the arena, then Choose your Monstar. On a phone without Phantom it opens the game inside the Phantom app (`phantom.com/ul/browse/<url>#arena`); on desktop it opens phantom.com/download.
- Referral button at the bottom of Home and Arena: copies your link, then shows the QR code.
- "How the money moves" moved to the Guide. NFT sales: 5% royalty to the origin wallet + **5% to PocketMonstars** (`COMPANY_SALE_BPS`). Treasury defaults to the founder wallet when `PM_TREASURY` is unset.
- Monstar Dex lists the original nine last.

## v27 — 1v1 first, 3v3 squad
- The Arena picker starts on **1v1**. Three modes: 1v1, 3v3 tag team (one at a time, swap in), **3v3 squad** (`createMatch(..., { squad: true })`).
- Squad: all six Monstars on the field. Each side controls one (`m.fighters[side]`); tapping a teammate's picture switches control (0.4 s cooldown). The rest use `aiFor()` and fight on their own; every Monstar targets the nearest rival and shots/powers hit any rival they reach. A side loses when all three are down. Snapshot `x` carries the uncontrolled Monstars; the renderer draws them with HP bars.
- Hit events now carry the victim position (`vx`, `vy`) so damage numbers appear on the Monstar actually hit.

## v28 — squad pace and swap buttons
- Squad battles run at `SQUAD_PACE` 0.8 of the normal pace (`m.pace`, applied to the sim step, autopilot and the snapshot `gs`).
- A ⇄ swap button is drawn over each of your teammates in a squad battle; tapping it (or the teammate) takes control of that Monstar. The team pictures still work too.

## v29 — profile + avatars
- Once signed in, the Arena shows a profile card (avatar, "Phantom connected" or "Signed in", address/name, SOL balance) in place of the Connect button; the top-right button shows the avatar.
- Avatars (`shared/avatars.mjs`): one-of-one photo avatars, either reserved for a wallet (`reservedFor: 'founder'` = legendary account holder) or sold once for SOL (`priceLamports`, memo `PMAVATAR:<id>` to the treasury, rebuilt from chain on start). Any owned Monstar can also be your avatar. Routes: `GET /api/profile/me`, `POST /api/profile/avatar`, `GET /api/avatars`, `POST /api/avatar/tx|confirm`.
- First photo avatar: **Gilded Voyager** (`dist/art/avatars/gilded-voyager.jpg`), held by the founder wallet. Add more by dropping images in `dist/art/avatars/` and adding entries with a price.
- Script and CSS tags in `index.html` carry `?v=29` so phones and Phantom's browser load the newest code.

## v30 — Neferion Storm Orbs
- Signature Mega Shots can replace a species' generated one (`MEGA_SIGNATURE` in monstars.mjs). Neferion (Neferkit → Neferling → Neferion …) gets **Storm Orbs** (`kind: 'lightning'`): 7 lightning balls launched 0.16 s apart that home in on the rival. The first ball to hit stuns briefly (0.33 s); the rest zap it. A rival that keeps moving usually takes 3–6; one that stands still or stays stunned takes all 7.
- Shield test now samples 24 wallets (one starter each) so it no longer fails by chance.

## v32 — Elemental Benders, Sky Splitter, 0.75x pace
- 11 **Elemental Benders** (ids 163–173, `BENDERS` in frontier.mjs, collection `benders`, legendary `legendFor: 'benders'`, never wild): Tidewen, Marovek (water), Granitus, Terrala (earth), Pyreska, Emberon (fire), Zephyrine, Aerokai (air), Voltessa, Thundrik (thunder) and **Tempestro**, the elite thunder bender (+35% stats). Art from `scripts/make_benders.py` at 96x112 per frame (twice the detail) with real run cycles.
- Tempestro's Mega Shot **Sky Splitter** (`kind: 'thunderstrike'`): 6 lightning strikes from the sky that track the rival; the first stuns. A rival standing still takes all 6.
- Gifts (`config.gifts`): q2xb… gets all 10 benders + Tempestro; the founder gets one per element (Tidewen, Granitus, Pyreska, Aerokai, Thundrik); 7psx… gets the 10 benders + 10 Anunnaki on top of its three wild specials.
- Pace: `GAME_SPEED` 0.47 and `MOVE_SPEED` 0.675 (0.75x), squad uses the same pace (`SQUAD_PACE` 1). 1v1 rounds are 90 s, `BATTLE_HP` 1.3 (median fight ~36 s, all by KO in tests).

## v33 — air benders: Tornado Gust, Gale Push, Gust Volley; fused breeding
- `KIT_SIGNATURE` in monstars.mjs overrides parts of a kit. **Aerokai**: Gale Push (attack, knockback ×6), Gust Volley (special, 3–4 wind balls), **Tornado Gust** Mega (`kind: 'tornado'`): every rival on the field is caught (`whirl` status), spun up, slammed down for damage, then **dazed** (`daze` status) so you can follow up. **Zephyrine** also gets the tornado (Cyclone Gust), so q2xb… has one of each.
- Benders are much stronger from level 1: stats ×1.55 (Tempestro ×1.8).
- Breeding with a bender always gives a bender baby whose powers combine both parents (`Monstar.fusion` → its own attack, the other parent's special and, if that parent is a bender, its Mega Shot, all +15%). Cards show "Fused · <parent>".
- Air benders look different at every stage (staff, hood + fan staff, blue fins, white robes on a whirlwind, white and gold).
- Gifts also work for username accounts (`normOwner`).

## v34 — water, earth and thunder bender signatures
- **Tidewen** (water): special **Ice Balls** (2–3 balls, each freezes); Mega **Hailstorm** (`hailstorm`): 6 waves of sharp ice over a big area that follows the rival; each wave freezes and takes 5% HP (30% in all).
- **Granitus** (earth): special **Slab Slide** (3–4 tall slabs at different angles and speeds, extra knockback); Mega **Boulder Storm** (`boulderstorm`): 7 boulders rain around the rival (3–6 usually hit a moving rival, all 7 a still one), then every rival hit is dazed.
- **Thundrik** (thunder): Mega **Soul Storm** (`stormdrain`): 7 big-radius lightning strikes; 45% of the damage heals the caster.
- `land()` takes an optional fixed share of HP (`frac`); strike effects can track the rival with an offset (`trackRate`, `ox`, `oy`), heal the caster (`heal`) and daze everyone hit when the storm ends (`grp`, `endDaze`).


## v35: rematch fix, fairer SOL per hit, Legend Heroes, Sky Benders, COVO and COVA
- Rematch no longer freezes: the battle screen runs a single animation loop (each Rematch used to start another one), a bad canvas frame is skipped instead of stopping the screen, and a server rematch clears the finished match first.
- SOL per hit now also scales with the HP the hit took, so a rival landing many weak ticks no longer drains your share while you win the fight.
- Legend Heroes (15, gifted): founder Aurorex, Titanor, Phantomir, Pyronyx, Chronar; 7psx… Stormvane, Bulwarkus, Venomaw, Quasarion, Gorrath; 54y4… heroines Starlara, Lumivra, Frostelle, Blazara, Sylphra.
- Sky Benders: 7psx… Galdris, Skyvar, Windrik, Aeromar, Cyrran; 54y4… Aerisa, Sylvane, Zephra, Windara, Skylis; 25 in the Sky Bender Market at 1 SOL (memo PMDROP:<id>, rebuilt from the chain like the drop).
- COVO (founder) and COVA (market, 10 SOL): Fire Gust attack (burns), Ice Balls special (freeze), long teleport dash, +35% speed, Five Element Storm mega (`omnistorm`): wind grab, fire gust, lightning, hail, ice wave at 12% each = 60%, then a returning bolt heals 10%. They never breed copies or pass the storm on.

## v36: Starter Benders, wild level rules, card payments and dollar resale
- New players (username accounts and Phantom wallets) start with ONE random Starter Bender: Aquari (water), Rokko (earth), Blazen (fire), Gusti (air) or Voltz (thunder). Existing players keep what they have.
- The wild now holds the 5 Starter Benders (Rare) and the 10 Elemental Benders (Epic; Tempestro stays one of a kind), alongside the Anunnaki. 118 wild species.
- Wild levels (`wildLevel`): always above your Monstar, usually +1 to +3, sometimes far more; Anunnaki, benders and mythics at least +2, with a 1% chance of a level 1 one. Same for free, card and Phantom players. The zone minimum still applies.
- Catching: Phantom wallets keep the level they beat; username accounts get a level 1 Infant.
- Card payments (server/stripe.mjs, off until STRIPE_SECRET_KEY is set): Stripe Checkout for every store Monstar at the same price as in SOL, converted at the live SOL price (or PM_SOL_USD). Fulfilled by /api/card/confirm on return and by the signed webhook /api/stripe/webhook; a double sale is refunded. Paid sessions to Phantom wallets are replayed after a reset.
- Sell for dollars: sellers connect a Stripe Express payout account, list an unminted Monstar ($1-$10,000); buyers pay by card; the Monstar moves and Stripe transfers 90% to the seller and 5% royalty to the creator (if they have a payout account); PocketMonstars keeps 5%.
- SOL per hit is tied to the damage the hit did (v35) and tested.

## v37: no running away, Catch button, catch passes, catch beam and soul orb
- The Run button is gone. In wild battles it is now **Catch** (it glows when the wild Monstar's HP is in the red; key C). Other battles play out to the end.
- Free (username) accounts catch 2 wild Monstars free; after that each catch uses a catch pass bought by card (1 pass $0.99, 5 for $3.99; PM_CATCH1_USD / PM_CATCH5_USD). Phantom wallets pay SOL per wild run and are not limited.
- A catch plays a vortex beam in the Monstar's own colour (bender element, else its type: red, blue, yellow, black, purple, orange, white, pink, green and more), the Monstar is pulled up and vanishes, and a soul orb of that colour floats before the result and Rematch buttons show.

## v38: Immortal Combat 1v1
- New 1v1 mode with no SOL stake: the winner takes the loser's Monstar (registry owner moves at the end of the match; a forfeit counts as a loss). Minted NFTs can't be put on the line, and the joiner must confirm (IMMORTAL_CONFIRM).
- A soul claim opens for 24 hours: the winner sets the soul fee (0.1-0.5 SOL, default 0.1, and optionally a dollar price if they have a Stripe payout account). The loser buys it back with SOL (paid straight to the winner, memo PMSOUL:<id>) or by card (winner gets 95% through Stripe). After 24 hours it belongs to the winner for good.
- While a claim is open the Monstar can't be minted, listed for dollars or put into another Immortal Combat.

## v39: Immortal Combat signatures, NFT escrow, company cut on SOL buy-backs
- Phantom players sign before an Immortal Combat starts (new room state `lock`): an unminted Monstar is put on the line with a signed agreement (signMessage, checked with Ed25519), a minted NFT is moved into the match escrow by a transaction they sign. The fight starts only when both have signed, so the winner always gets the Monstar.
- After the match: the winner's own NFT is released back to them; the loser's NFT stays in escrow during the 24 h buy-back. A SOL buy-back is one transaction: soul fee (95% winner, 5% PocketMonstars) + the NFT back. If time runs out the NFT is released to the winner. Card buy-backs release it to the loser. Released NFTs are collected from Soul claims (the receiver pays the network fee; the escrow co-signs).
- A cancelled match releases escrowed NFTs back to their owners.

## v40: Immortal Guild tab, orb teleport intro
- New **Immortal Guild** tab (☰ menu and nav): every open Immortal Combat (`GET /api/immortal/open`) with the fighter's Monstar, level, power and code. Tap a card to take the challenge with the Monstar picked on the tab (confirm first). "Put my Monstar up" creates a fight; the soul claims list (buy back / set soul fee / collect NFTs) is on the tab too.
- Every fight in every arena now opens with the Monstars teleporting in as soul orbs of their own colour (`createMatch({ intro: true })`, `INTRO_SECONDS` 1.3): the battle waits until they land, flash and appear.

## v41: Target Practice
- New **Target Practice** tab (dist/targets.js): 30 seconds on a shooting range with random targets: bullseye boards (50/25/10 by ring), hay stacks (an HP bar, take several hits), cans on a fence (tip over in one hit) and rows of moving ducks (one hit each). Tap a target to fire your Monstar's own attack, special (multi-shot where it has one) or Mega Shot (charges from hits). Every hit shows its damage.
- Nothing is earned yet; the result shows what the same hits would earn in a real match (EXP from EXP_RULES, SOL from hitFee). Best score is kept on the device.

## v43: no rematch
- The Rematch button is gone. After a fight the result shows with one button, "Back to pick your Monstar": the page reloads to the Arena picker (a clean start every time). Free fights go back on their own after 6 seconds; staked SOL matches wait for the tap so the payout can be seen.

## v44: Ashley's wallet and KENA
- New species KENA (id 231, Sky Benders): a final air bender like COVA (all five elements, Five Element Storm, teleport dash, +35% speed), one of a kind, gifted.
- HgPy9avE7tMVTgpehYwFQRQYGPUPbZKGzKPAuLNoeD3U (Ashley) gets women only, all as elite Legendary-rarity hatchlings: KENA; the woman benders of water, earth, fire and thunder (Tidewen, Terrala, Pyreska, Voltessa); the 5 heroines (Starlara, Lumivra, Frostelle, Blazara, Sylphra); the 5 air bender women (Aerisa, Sylvane, Zephra, Windara, Skylis); and 4 Anunnaki goddesses (Inannox, Tiamaw, Ninhurra, Ereshkyl).
