# PocketMonstars MVP

An original touch-controlled creature arena game with nine illustrated Monstars, local progression, Phantom connection, Solana devnet NFT tools, and a company-funded reward protocol reference.

## Start here

Requires Node 24+ and npm. The artwork and prebuilt browser bundle are included.

```sh
npm ci
npm test
npm run build
npm start   # game server with 1v1 Stake Duel, registry and market
```

To put it online and test on two phones, see **DEPLOY.md**. New in v4: see **STAKE_DUEL.md** for the staked 1v1 mode, unique Monstars per wallet, classes and the royalty marketplace.

Open http://localhost:8080. For a quick static preview without installing dependencies:

```sh
python3 -m http.server 8080 --directory dist --bind 127.0.0.1
```

Phantom works through its supported desktop extension or mobile in-app browser. The deployed private Site requires ChatGPT sign-in in that browser. The localhost preview needs no ChatGPT sign-in. Do not enter a seed phrase anywhere in this app.

## Included

- Four game modes: Stadium duel vs AI, Wild expedition/capture, Survival arena, Titan challenge.
- Drag/tap touchscreen movement, keyboard movement, four abilities, energy, cooldowns, shields, team switching, elemental advantages, leveling and local saves.
- Nine original smooth illustrated creature assets, class types, six stats, local wallet-scoped DNA previews.
- Phantom connect/disconnect/account changes and read-only mainnet/devnet SOL balances.
- Devnet Core NFT inspection, standalone test minting, gifting, and buyer-specific, short-lived signed private sales. Public marketplace listings are not implemented.
- Devnet SPL reward-token mint creation with nine decimals, fixed draft supply, no freeze authority, and mint-authority revocation.
- Company-funded MNRG/native SOL reward policy, signed authoritative receipts, replay/budget ledger, payout transaction helpers, and tests.
- A local practice reward estimate that is clearly not claimable money or an on-chain token balance.

## Important status

No production reward mint, mainnet payments, official verified collection, global uniqueness registry, authoritative multiplayer battle server, or deployed reward service exists yet. Real Phantom signing and end-to-end chain execution have not been tested in this environment. There are no private keys, seed phrases, real treasury funds, or deployment credentials in this package.

The draft MNRG token is an SPL token issued on Solana; it is not native SOL. No exchange rate, liquidity, or financial value is configured. All browser transaction tools are hardcoded to devnet. Creating a test mint requires the wallet owner's explicit approval and test SOL for account rent/network fees. Repeating it creates a different independent mint.

Test NFT royalties are paid in the included private-sale flow, not universally across outside marketplaces. Test mint IDs are distinct asset addresses; the current local DNA previews do not guarantee unique artwork across every device or wallet.

## Files

- `START_HERE_CLAUDE.md`: Claude handoff and recommended next work.
- `dist/`: ready-to-serve browser MVP and all nine original creature images.
- `src/nft-client.js`: browser transaction builders; rebuild into `dist/chain-client.js`.
- `protocol/README.md`: precise reward and marketplace specification.
- `protocol/rewards.mjs`: deterministic reward policy and integer fee math.
- `protocol/ledger.mjs`: server-only signed receipt ledger (Node SQLite).
- `protocol/settlement.mjs`: server-only company treasury payout helpers.
- `tests/`: gameplay and protocol/transaction signature tests.
- `ARTWORK.md`: original image prompts and asset map.

See `protocol/README.md` before connecting the reward helpers to any service or funded account.
