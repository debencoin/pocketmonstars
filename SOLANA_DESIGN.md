# Current Solana implementation

The current design and operating instructions are in [protocol/README.md](protocol/README.md).

The application now includes illustrated Monstars, Phantom connection and balance reading, devnet NFT inspection/minting/gifting/private sale offers, a devnet SPL reward-mint builder, and a local practice reward meter. Transaction builders and policy tests are in `src/`, `protocol/` and `tests/`.

No mainnet reward token, company treasury, verified collection, public marketplace, production payout service, or authoritative online battle server is deployed. Tests have not included real Phantom transaction signing or an end-to-end Solana validator. All transaction tools send only to devnet.

MNRG is a proposed standard SPL token issued on Solana, not native SOL. Rewards come only from company-controlled pools. Per-hit estimates can update during play; confirmed wallet balances change only after a separately verified, batched payout. There is no opponent-funded combat transfer or player stake.

Production uniqueness requires an authoritative mint and trait registry. The local DNA previews and standalone devnet mint tools do not enforce globally unique artwork. Test creator royalties are paid by this private sale flow; they are not guaranteed on arbitrary external marketplaces.
