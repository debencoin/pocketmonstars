# PocketMonstars: Your Monstars. Your Arena!

Real-time creature battles on Solana. Battle, capture and evolve original Monstars: free to play in the browser (installable as a phone app), or connect Phantom to stake SOL against real rivals.

**Live (Solana devnet beta, free test SOL):** https://pocketmonstars.onrender.com

## What's in the game

- **Arena**: 1v1, 3v3 tag team, and **3v3 squad** (all six Monstars on the field; tap a teammate's ⇄ button to take control, the others fight on their own). Free practice vs the computer (Easy / Normal / Hard) or real rivals online.
- **Stake SOL (Phantom)**: both players deposit into a match escrow; every hit moves part of the rival's stake to you; KO wins the pot, paid in one settlement transaction.
- **Wild Expedition**: 103 wild Monstars from Common to Divine. Get one into the red and tap **Capture!**; every species has its own odds and they change every throw.
- **226 Monstars** in 12 collections: Genesis (9), Frontier (50), Anunnaki (20), Watchers (20), Mythic (4), Legendary (2), Ascendants (20), Royal Anunnaki (8), Superhero Drop (30), Elemental Benders (11), Legend Heroes (15, gifted), Sky Benders (37: 10 gifted, 25 in the market, plus COVO and COVA).
- **Evolution**: six forms (Infant, Rookie, Champion, Ultimate, Mega, Ascended), even mid-battle, each with an ability upgrade. Every Monstar has its own stats, attack, special, dash, guard and Mega Shot.
- **Signature Mega Shots**: Neferion Storm Orbs, Tempestro Sky Splitter, Aerokai/Zephyrine Tornado Gust, Tidewen Hailstorm, Granitus Boulder Storm, Thundrik Soul Storm, and more.
- **Elemental Benders**: original water, earth, fire, air and thunder martial artists, drawn at double detail with real run cycles. Gifted to chosen wallets only. Bred benders combine both parents' powers.
- **Sky Bender Market**: 25 one-of-one air benders (boys and girls, each also bending water, earth, fire or thunder) at 1 SOL, and COVA, the final air bender, at 10 SOL. COVO, her counterpart, belongs to the founder: all five elements, teleport dash, very fast, and the Five Element Storm (60% of the rival's HP, then a bolt heals him 10%).
- **Superhero Drop**: 30 one-of-one heroes for 30 days (top 5 at 1 SOL, the rest 0.5 SOL), paid on-chain and rebuilt from the chain after a server reset.
- **Market**: mint Monstars as NFTs (Metaplex Core), list and buy them. Each sale pays 5% royalty to the wallet the Monstar was born to and 5% to PocketMonstars.
- **Accounts and profiles**: free username + password accounts, or Phantom sign-in; profile card with avatar (one-of-one photo avatars or any owned Monstar).
- **Referrals**: share your link or QR code; when a player you referred wins a SOL match, you get 5% of what they won.
- **Breeding**, **Monstar Dex** with attributes and every evolution, **Leaderboard**, **Guide** (controls and how the money moves).
- **Phone app**: installable PWA (Share → Add to Home Screen), ☰ menu, touch controls (drag to move, swipe or double-tap to dodge).

## Run it

Requires Node 22.13+.

```sh
npm ci
npm test        # game, protocol and server tests
npm run build   # browser bundle -> dist/stake-client.js
npm start       # http://localhost:8080
```

Deploying: see **DEPLOY.md** (Render). The server runs on Solana **devnet** by default. Mainnet is locked unless `SOLANA_CLUSTER=mainnet-beta` and `PM_ALLOW_MAINNET=yes-reviewed` are both set, which should only happen after a security and legal review.

## Important notes

- **Devnet only right now.** All SOL is free test SOL until mainnet is switched on.
- **Data on the free Render plan resets on every deploy** (accounts, captured Monstars, referrals). Superhero Drop and avatar purchases are rebuilt from on-chain payments. Use a paid plan with a disk (`PM_DATA_DIR`) before real-money play.
- **Never enter a seed phrase.** Phantom only signs messages and transactions; the server never sees private keys. Server keys live in `data/keys/` (gitignored).
- Staked PvP for real money can fall under gambling laws depending on where players are. Get legal advice before going to mainnet.
- All characters and art are original.

## Project layout

| Path | What it is |
|---|---|
| `shared/` | Game rules shared by server and browser: `sim.mjs` (real-time battle), `monstars.mjs` (species, stats, evolutions, kits), `frontier.mjs` (species lists), `abilities.mjs`, `stake.mjs`, `avatars.mjs` |
| `server/` | Node server: `index.mjs` (HTTP API + WebSocket), `matches.mjs` (rooms, escrow, settlement, capture), `registry.mjs` (unique Monstars per wallet/account), `players.mjs` (accounts, referrals, drop sales, avatars), `nft.mjs`, `escrow.mjs`, `auth.mjs`, `config.mjs` |
| `src/` | Browser wallet/API client, bundled into `dist/stake-client.js` |
| `dist/` | The web app: `index.html`, `pvp-v4.js` (Arena), `wild.js`, `v5.js` (Dex, drop, breeding), `v6.js` (Home, menu, sign-in, profile, referrals), `app.js` (PWA), `pixel-arena.js` (renderer), `art/` |
| `scripts/` | Art generators (`make_heroes.py`, `make_benders.py`, `make_walkers.py`, `make_stages.py`, `make_cards.py`, …) |
| `tests/` | `pvp.test.mjs`, `v5.test.mjs`, `protocol.test.mjs`, `game-mechanics.cjs` |
| `STAKE_DUEL.md` | Change log for every version (v4 → v34) with design details |

## Configuration (environment variables)

| Variable | Purpose |
|---|---|
| `PM_SESSION_SECRET` | Signs session tokens (set it so sign-ins survive redeploys) |
| `PM_TREASURY` | Wallet that receives company fees (defaults to the founder wallet) |
| `PM_DROP_TREASURY`, `PM_DROP_ENDS` | Superhero Drop payment wallet and end time |
| `PM_LEGENDARY_OWNER`, `PM_ROYAL_OWNER` | Founder wallets that hold the legendary collections |
| `PM_DATA_DIR` | Where the database and keys are stored (point at a persistent disk) |
| `SOLANA_CLUSTER`, `SOLANA_RPC`, `PM_ALLOW_MAINNET` | Network selection (devnet by default) |
