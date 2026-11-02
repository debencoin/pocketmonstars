# Put PocketMonstars online and play a devnet match on two phones

The server serves everything from one HTTPS address:

- `/` responsive website
- `/play` the game (1v1 Stake, Monstars, Market)
- `/api/*` sign-in, registry, minting, marketplace
- `/ws` live 1v1 matches (WebSocket)
- `/healthz` health check

Phantom only connects on HTTPS, so the game must be deployed before phones can play it.

## Option A: Railway (fastest, has persistent volumes)

1. Put this folder in a GitHub repo (private is fine).
2. railway.com → New Project → Deploy from GitHub repo → pick it. Railway reads `railway.json` and the `Dockerfile`.
3. In the service: **Settings → Networking → Generate Domain**. You get `https://<name>.up.railway.app`.
4. **Add a Volume** mounted at `/data` (keeps the Monstar registry, matches and the server's devnet keys across deploys).
5. Variables (optional): `PM_TREASURY` = your company wallet address, `PM_ROYALTY_BPS` = `500`.

## Option B: Render

1. Push to GitHub, then render.com → New → **Blueprint** → pick the repo. It reads `render.yaml`.
2. It creates a web service with a 1 GB disk at `/data` (Starter plan; the free plan has no disk, so the registry would reset on every deploy).
3. Your address is `https://pocketmonstars.onrender.com` (or the name Render gives). Set `PM_TREASURY` when prompted.

Either platform: the server picks up its public HTTPS address automatically for NFT metadata. Add your own domain in the platform's domain settings any time, then set `PM_PUBLIC_URL=https://yourdomain.com`.

## After the first deploy

- Open the logs. They print the **collection authority** and **market authority** addresses.
- Optional but recommended: send ~0.5 devnet SOL to the collection authority (faucet.solana.com), then run `npm run setup:collection` in the platform's shell. Mints then join an official PocketMonstars collection.
- If you set `PM_TREASURY`, send it ~0.001 devnet SOL so it can receive the 1-lamport fees.

## Two-phone devnet test (about 10 minutes)

On **both** phones:

1. Install **Phantom** (App Store / Google Play). Create a new wallet, or import a test wallet. Use a separate wallet on each phone.
2. Phantom → Settings → **Developer Settings** → turn on **Testnet Mode** → choose **Solana Devnet**.
3. Copy the wallet address, open **faucet.solana.com** and request devnet SOL (1–2 SOL is plenty).
4. Open your site in Safari/Chrome and tap **Play in Phantom**. The game opens inside Phantom's browser. (Or paste `https://<your-domain>/play` into Phantom's browser tab.)
5. Tap **1v1 Stake → Connect Phantom & sign in**. Approve the connection, then approve the sign-in message (no fee).
6. Your nine one-of-a-kind Monstars appear. Tap **Use in duel** on one.

Then:

| Phone A | Phone B |
| --- | --- |
| Pick a stake (0.001 SOL), tap **Create match** | |
| Read out the 6-letter code | Type the code, tap **Join** |
| Tap **Deposit 0.001 SOL**, approve in Phantom | Tap **Deposit 0.001 SOL**, approve in Phantom |
| 3-second countdown, fight (turn the phone sideways for full screen) | same |

Watch the SOL numbers under each health bar change on every hit. After the KO, the winner's screen shows **View transaction**; it opens the settlement on Solana Explorer (devnet). Check both Phantom balances: the winner gains about 0.001 SOL (minus the 0.000005 SOL network fee and 1 lamport company fee).

Also worth testing:

- **Free match**: stake 0 to test controls without SOL.
- **Refund**: create a staked match, both join, only one deposits, then tap **Leave**. The deposit comes back.
- **Disconnect**: close Phantom mid-fight; after 15 s the other phone wins.
- **Mint**: tap **Mint NFT** on a Monstar (costs a little devnet SOL for rent).
- **Market**: on Phone A list a minted Monstar for 0.01 SOL on the NFT Market tab; buy it on Phone B. Phone A's wallet that was born with it gets the 5% royalty on any later resale.
- **Send**: send a minted Monstar to the other phone's address.

## Troubleshooting

- **"Phantom not found"**: you're in a normal phone browser. Use the Play in Phantom button or Phantom's own browser tab.
- **Phantom warns the transaction may fail**: Phantom is on mainnet. Turn on Testnet Mode → Solana Devnet.
- **Deposit not found yet**: devnet can be slow. The game re-checks the same deposit automatically, and the button changes to **Check my deposit**, so you never pay twice.
- **Public devnet RPC rate limits**: set `SOLANA_RPC` to a free devnet endpoint from Helius, QuickNode or Triton.
