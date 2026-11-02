# Monstar Reward Protocol v0.1

Status: implemented reference code and devnet browser transaction tools; no production mint, server, treasury, verified NFT collection, or reward pool has been deployed. The game currently runs local AI duels. These cannot produce eligible reward receipts. No transaction has been signed or broadcast by the development agent.

## Two separate reward assets

MNRG is the proposed name/symbol of a fungible SPL token issued on Solana. It is not native SOL. Native SOL is the network currency. The protocol supports separate company-funded pools for either asset, with separate ledgers, budgets, denominations, and no automatic exchange rate.

| Parameter | MNRG draft | Native SOL draft |
| --- | --- | --- |
| Smallest unit | 0.000000001 MNRG | 1 lamport = 0.000000001 SOL |
| Valid hit | 0.001 MNRG | 1 lamport |
| Complete match, win/loss/draw | 0.010 MNRG | 10 lamports |
| Eligible hits per match | 100 maximum | 100 maximum |
| Player daily limit | 1 MNRG | 1,000 lamports |
| Default global daily budget | 100 MNRG | 100,000 lamports |
| Source | Company token account | Company SOL wallet |
| Player stake/deposit | None | None |

The completion reward is the same for wins, losses, and draws. Players do not lose balances on hits or losses. No opponent wallet is a source of payout funds. Rewards are not guaranteed income, guaranteed redeemable SOL, or an automatic token conversion.

### Eligibility
- An authoritative server runs a deterministic match simulation and validates ability cooldowns, energy, positions, projectile collisions, damage, and match lifecycle.
- Two distinct authenticated human wallets; no AI opponent, forfeit, or self match.
- At least 60 seconds, 10 verified actions, and 5 verified hits. The current caps prevent more than four hits per second.
- Server must add collusion, repeated-pair, automation, and account-abuse detection; minimum action counts alone do not solve farming.
- Match/participant IDs determine immutable receipt IDs. The server issues at most one receipt per participant per match. Client hit totals and the local practice meter are never authoritative.

### Settlement
1. Authoritative match server creates an Ed25519-signed canonical receipt. It includes wallet, opponent, result, validated hits/actions, duration, policy version, reward asset, issuance time and UTC day. Receipt IDs must be derived deterministically from match and participant.
2. `RewardLedger.reserve` verifies the signature and freshness, rejects replays, and atomically reserves player/day and global/day budgets in SQLite. Use a separate database per reward asset and per network.
3. Trusted company service calls `prepareSettlement` with its signer and the amount returned by that reservation. It uses SPL `TransferChecked` for MNRG or a System Program transfer for SOL. It never requests another player's funds. The company pays network fees and optionally the receiver's token-account rent.
4. Persist exact signed transaction bytes, signature and validity height using `recordSigned` BEFORE sending them. `broadcastReserved` does this in order.
5. Reconcile confirmation with the recorded signature. Retry identical signed bytes while valid. Never generate a new payout for an uncertain receipt. Failed/expired unresolved claims remain reserved for manual reconciliation; the code does not release and resend them automatically.
6. Mark confirmed only after RPC returns a confirmed/finalized successful signature. The public balance UI never substitutes practice estimates for wallet balances.

### Trust model
The reference payout policy and replay database run off-chain. The company treasury signer is trusted and can transfer its own funds independently of this reference policy. Daily limits are not enforced by a deployed custom on-chain program. Production requires an authoritative battle server, wallet challenge authentication, a durable transactional ledger, key management or multisig policy, RPC/indexing, monitoring, and an independent review before funding. No secrets belong in browser code, Git, URLs, or chat.

This approach avoids a transaction and wallet prompt for every hit. The game can show estimated accrual immediately, while actual rewards are batched after match verification. A wallet's chain balance changes after the payout confirms. One-lamport transfers are a denomination, not universally executable: account rent rules and recipient funding matter, and current base fees are larger than that transfer.

## Reward mint creation
The browser's `createRewardMint` devnet action builds a single transaction which:
1. Creates a standard SPL Token mint with nine decimals and no freeze authority.
2. Creates the connected wallet's associated token account.
3. Mints a draft fixed supply of 1,000,000,000 tokens to that account.
4. Revokes mint authority in the same atomic transaction.

It does not upload token name/logo metadata, create an exchange market, set a token price, authorize mainnet deployment, or configure this test mint as the official production reward token. Every invocation creates a new independent test mint. The connected company administrator must review and sign. The transaction is sent exclusively to the devnet RPC. Record and check its returned address and signature before repeating an uncertain action.

## NFT workshop
- Uses Metaplex Core on devnet. Asset inspection reads actual on-chain ownership. Gifts require the current owner's signature.
- Standalone test mint has a distinct asset address, local preview DNA in its Attributes plugin, and a 1% test-origin-creator royalty. It is NOT a verified official collection or proof that visual traits cannot be duplicated.
- Public metadata and artwork must be hosted separately at durable HTTPS URIs. The private Site is not a public metadata host.
- A private seller offer names a specific buyer and includes a short-lived recent blockhash. Seller signs the full exact transaction; buyer verifies it, signs, and submits before expiry. NFT transfer, seller proceeds, royalty payments and optional company fee are atomic instructions in one transaction. The fee payer is the buyer.
- Buyer reconstructs the expected transaction using current asset state and verifies exact message equality and seller signature. Arbitrary transaction blobs are not signed. Seller and buyer must differ; test price is capped at 10 test SOL. Assets with external lifecycle hooks are unsupported in this beta.
- On-chain asset royalty rates and creator shares determine private sale payments. Rounding is integer lamports and any remainder stays with the seller. Optional company treasury receives one lamport, and must already be rent-funded. If omitted, the company fee is zero. No company destination has been configured globally.
- Test NFT royalty rule set is unrestricted. Other marketplaces and gifts do NOT guarantee royalty payments. This workshop's private sale transaction pays the configured royalty, but universal enforcement needs compatible marketplace program restrictions and a verified collection. A current owner receives resale proceeds; a designated origin creator receives the royalty. These are different rights.

## Run and test

Requires Node 24 (SQLite API) and npm.

```sh
npm ci
npm test
npm run build
```

Files:
- `rewards.mjs`: deterministic integer reward and sale-fee policies.
- `ledger.mjs`: Ed25519 attestation verification, replay prevention, budget reservation and transaction state tracking.
- `settlement.mjs`: company-signed native SOL / SPL payout preparation, broadcast and reconciliation helpers. No public HTTP claim endpoint is deployed.
- `../src/nft-client.js`: real devnet NFT mint/gift/private sale and test token transaction builders.
- `../tests/protocol.test.mjs`: reward caps, completed-loss eligibility, rejected bot/forfeit/unverified receipts, replay prevention, signed-message tampering, fee conservation and private offer signature checks.

### Before a real launch
Provide the company's public treasury address, choose the official mint/collection authorities and royalty policy, host immutable metadata, deploy the uniqueness registry and authoritative match server, then run end-to-end devnet wallet tests and review the settlement service. Funding or mainnet signing must be done with the company-controlled wallet. No private key is required in conversation.

## Official references (checked November 2, 2026)
- https://solana.com/docs/tokens/basics/create-mint
- https://solana.com/docs/tokens/quickstart
- https://solana.com/docs/core/fees
- https://www.metaplex.com/docs/smart-contracts/core/create-asset
- https://www.metaplex.com/docs/smart-contracts/core/transfer
- https://www.metaplex.com/docs/smart-contracts/core/plugins/royalties
- https://docs.phantom.com/solana/establishing-a-connection
