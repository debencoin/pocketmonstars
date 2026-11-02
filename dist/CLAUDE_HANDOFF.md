# Claude handoff: PocketMonstars MVP

You are continuing an existing game, not starting a replacement. Read README.md, package.json, protocol/README.md, then run npm ci, npm test, npm run build and npm run dev.

## User's intended product
PocketMonstars is a mobile-friendly monster arena game with original anime/fantasy creature artwork, direct finger movement, creature classes/attributes, Phantom wallets, unique collectible Monstars, NFT trading/gifting, and company-funded rewards for verified hits and finishing matches even after a loss.

All creatures must remain original. The visual direction combines approachable collectible creature appeal with more evolved fantasy anatomy and armor; the user explicitly rejected pixel Monstars. Nine original illustrations are included in dist/art. Do not replace them with pixel sprites or existing franchise characters.

Update (November 2, 2026, product owner): the owner asked for an opt-in **Stake Duel** where both players stake equal SOL, every hit moves lamports from the victim's share to the attacker's share, and the winner takes the pot, with a 1-lamport company fee. v4 implements this on devnet only; see STAKE_DUEL.md. It needs legal review (gambling / skill-gaming rules) and an audited on-chain escrow before mainnet. The company-funded MNRG/SOL reward pool below remains a separate system. Never treat client-side counters or localStorage as proof of rewards or NFT ownership.

## What works in this package
- v4: `npm start` runs the authoritative server (WebSocket 1v1 Stake Duel, Phantom message sign-in, devnet escrow deposits and one-transaction settlement), the unique-DNA Monstar registry with nine classes, server-co-signed Core minting into an official collection, and the Monstar Market (transfer-delegate listings, atomic buy with origin-owner royalty and 1-lamport fee, gifting). Start with STAKE_DUEL.md.
- Browser gameplay against AI, four modes, capture/collection, local saves and progression.
- Smooth artwork in the arena, collection, selected partner and team strip.
- Phantom wallet connection and confirmed SOL balance requests, with error handling and mobile browse link.
- Real transaction BUILDERS for devnet NFT mint/gift/private sale and a devnet SPL test reward mint. These require a real connected wallet's approval and test SOL; no development-agent wallet was used and no chain transaction has been executed here.
- Server-side reference reward policy, attested receipt verification, replay prevention, budget reservations, exact signed transaction persistence, company-funded SOL/SPL payout helpers, and reconciliation helpers.
- Tests covering gameplay, completed-loss reward eligibility, caps, bot/forfeit rejection, signature tampering, replay prevention, private offer signature/message verification and fee conservation.

## Architecture
This is a buildless static game plus one bundled browser chain SDK, with Node server-side reference modules. Browser scripts currently share classic-script globals and load in this order:
1. dist/game.js — original gameplay/canvas and persistence.
2. dist/arena-v2.js — stadium duel mode, type/class stats, finger movement, Phantom connection, local DNA.
3. dist/chain-client.js — esbuild output from src/nft-client.js; exposes window.PMChain.
4. dist/monstars-v3.js — illustrated render overrides, practice reward UI, devnet NFT workshop and review dialogs.

The overlay structure preserves earlier modes but should eventually be refactored into explicit modules/state management. Preserve working behavior and local save compatibility while doing that. The package has no private hosting project manifest or credentials; choose deployment configuration for the target environment.

## Implementation priorities
1. Run and inspect the MVP before changing it. Fix observed issues, keep existing tests, and add meaningful transaction/security tests where needed.
2. Implement an authoritative FREE human 1v1 battle server and wallet challenge authentication. The server, not the browser, validates movement, abilities, hits and match completion. Add replay logs and farming/collusion detection before reward eligibility.
3. Build an authoritative unique DNA/trait registry with database uniqueness constraints and immutable serials. Distinct asset addresses alone do not guarantee unique artwork. Current local preview DNA is not an NFT or proof of ownership.
4. Add durable PUBLIC metadata/artwork hosting, a verified company collection and a controlled mint flow. The current standalone devnet test mint is explicitly unverified. Do not silently claim an official collection exists.
5. Develop a public marketplace/listing system if desired. The current workshop is buyer-specific private signed offers that expire with a recent blockhash; it is not a public durable listing order book.
6. Confirm company public treasury address, creator royalty rate/recipient policy, official mint authorities, supply parameters and reward funding limits with the product owner. Do not request seed phrases or put secrets into the browser or repository.
7. Deploy a secure reward service using protocol modules only after server-authoritative matches exist. MNRG and native SOL are separate company-funded pools and separate ledgers. Signed bytes must be persisted before broadcast; uncertain claims must not be re-signed automatically, or duplicate payouts can occur.
8. Test everything end-to-end on devnet, including actual Phantom signatures, mint/gift/sale confirmation, expiry and wallet account changes. Only then prepare a separately reviewed production/mainnet rollout.

## Draft economy
MNRG: standard SPL token, 9 decimals, illustrative fixed supply 1,000,000,000, company-funded distribution. Verified hit = 0.001 MNRG; completed match = 0.010 MNRG on win/loss/draw; 100 eligible hits/match; 1 MNRG/player/day. Native SOL alternative = 1 lamport/hit, 10 lamports/completion, 1,000 lamports/player/day. These pools are NOT funded, deployed, interchangeable, or guaranteed to have financial value.

The current test NFT creator royalty is 1% in the included private-sale flow. An optional pre-funded company treasury receives one lamport per sale. Gifts have no sale proceeds and no royalty. Creator royalties are not a promise that every previous owner receives perpetual income or that outside marketplaces will pay them.

## Validation and limits
Node unit tests and browser UI checks passed during development. Real Phantom signing and end-to-end Solana validator execution are still outstanding. Public Solana RPC can rate limit. Node SQLite is a reference ledger for one trusted service; production concurrency/durability/secret management must be deliberately designed. No custom on-chain reward program has been deployed; reward policy enforcement is currently an off-chain reference design.

Keep these distinctions clear in the UI and any user-facing claims.
