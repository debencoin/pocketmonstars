// Official Monstar minting and the royalty marketplace (Metaplex Core on Solana).
//
// Mint:   the server builds the create transaction for a registered Monstar, signs as the asset key and as the
//         official collection authority, and the player approves and pays in Phantom. Only registry Monstars
//         can join the collection, so the official collection never holds two identical Monstars.
// Market: a seller lists by approving the market authority as the asset's Transfer Delegate. A buyer gets a
//         transaction that pays seller + origin-owner royalty + 5% company fee and transfers the NFT,
//         all in one atomic transaction co-signed by the market authority. If any part fails, nothing moves.
import { PublicKey, Transaction, SystemProgram, Keypair, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, createNoopSigner, signerIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { mplCore, create, fetchAsset, transferV1, ruleSet, createCollection } from '@metaplex-foundation/mpl-core';

export const COMPANY_SALE_BPS = 500; // PocketMonstars takes 5% of every NFT sale

/** Integer split of a sale price. Every lamport goes somewhere; rounding dust stays with the seller. */
export function saleSplit(price, royaltyBps, creators, withCompanyFee) {
  if (typeof price !== 'bigint' || price <= 0n) throw Error('Price must be a positive lamport amount');
  if (!Number.isInteger(royaltyBps) || royaltyBps < 0 || royaltyBps > 10000) throw Error('Invalid royalty');
  const royalty = price * BigInt(royaltyBps) / 10000n;
  if (royaltyBps > 0 && creators.reduce((s, c) => s + c.percentage, 0) !== 100) throw Error('Creator shares must sum to 100');
  let paid = 0n;
  const payouts = royaltyBps > 0 ? creators.map(c => { const amount = royalty * BigInt(c.percentage) / 100n; paid += amount; return { address: String(c.address), amount }; }) : [];
  const company = withCompanyFee ? price * BigInt(COMPANY_SALE_BPS) / 10000n : 0n;
  if (paid + company >= price) throw Error('Price is too small to cover royalty and fee');
  return { seller: price - paid - company, royalty: paid, company, payouts };
}

export class NftService {
  constructor({ config, keys, chain }) {
    this.config = config; this.keys = keys; this.chain = chain;
    this.umi = createUmi(config.rpc).use(mplCore());
  }
  signer(kp) { return createSignerFromKeypair(this.umi, fromWeb3JsKeypair(kp)); }
  ix(builder) { return builder.getInstructions().map(toWeb3JsInstruction); }

  /** One-time devnet setup: create the official collection. The collection authority wallet pays the rent. */
  async createOfficialCollection() {
    const auth = this.keys.collectionAuthority, collection = Keypair.generate();
    const umi = createUmi(this.config.rpc).use(mplCore()).use(signerIdentity(this.signer(auth)));
    await createCollection(umi, { collection: createSignerFromKeypair(umi, fromWeb3JsKeypair(collection)), name: 'PocketMonstars', uri: `${this.config.publicUrl}/api/meta/collection.json` }).sendAndConfirm(umi);
    return collection.publicKey.toBase58();
  }

  async mintTransaction({ monstar, owner }) {
    const { blockhash, lastValidBlockHeight } = await this.chain.latestBlockhash();
    const assetKp = Keypair.generate(), auth = this.keys.collectionAuthority;
    const uri = `${this.config.publicUrl}/api/meta/${monstar.serial}.json`;
    if (uri.length > 200) throw Error('Public URL too long for NFT metadata');
    const builder = create(this.umi, {
      asset: this.signer(assetKp),
      ...(this.config.collection ? { collection: { publicKey: publicKey(this.config.collection) } } : { updateAuthority: publicKey(auth.publicKey.toBase58()) }),
      authority: this.signer(auth),
      payer: createNoopSigner(publicKey(owner)),
      owner: publicKey(owner),
      name: monstar.displayName.slice(0, 32),
      uri,
      plugins: [
        { type: 'Attributes', attributeList: [
          { key: 'serial', value: String(monstar.serial) }, { key: 'dna', value: monstar.dna },
          { key: 'species', value: monstar.species.name }, { key: 'class', value: monstar.className },
          { key: 'rarity', value: monstar.traits.rarity }, { key: 'origin', value: monstar.originOwner } ] },
        // The wallet the Monstar was born to earns the royalty on every resale, forever, via the in-game market.
        { type: 'Royalties', basisPoints: this.config.royaltyBps, creators: [{ address: publicKey(monstar.originOwner), percentage: 100 }], ruleSet: ruleSet('None') },
      ],
    });
    const tx = new Transaction({ feePayer: new PublicKey(owner), recentBlockhash: blockhash }).add(...this.ix(builder));
    tx.partialSign(assetKp, auth);
    return { transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), asset: assetKp.publicKey.toBase58(), lastValidBlockHeight };
  }

  async readAsset(asset) {
    const a = await fetchAsset(this.umi, publicKey(new PublicKey(asset).toBase58()));
    if (a.oracles?.length || a.lifecycleHooks?.length) throw Error('Assets with external hooks are not supported.');
    return a;
  }
  isOfficial(a) {
    const ua = a.updateAuthority;
    return this.config.collection ? ua.type === 'Collection' && ua.address === this.config.collection
      : ua.type === 'Address' && ua.address === this.keys.collectionAuthority.publicKey.toBase58();
  }

  /** After the player's mint lands, check it on-chain before the registry links it. */
  async verifyMint({ monstar, asset }) {
    const a = await this.readAsset(asset);
    const attrs = Object.fromEntries((a.attributes?.attributeList || []).map(x => [x.key, x.value]));
    if (!this.isOfficial(a)) throw Error('Not an official PocketMonstars asset.');
    if (attrs.dna !== monstar.dna || attrs.serial !== String(monstar.serial)) throw Error('On-chain DNA does not match the registry.');
    return { owner: a.owner };
  }

  async verifyListable({ asset, seller }) {
    const a = await this.readAsset(asset);
    if (!this.isOfficial(a)) throw Error('Only official PocketMonstars can be listed.');
    if (a.owner !== seller) throw Error('You do not own this Monstar.');
    const d = a.transferDelegate?.authority;
    if (d?.type !== 'Address' || d.address !== this.keys.marketAuthority.publicKey.toBase58()) throw Error('Approve the marketplace in Phantom first.');
    return a;
  }

  async treasuryReady() {
    if (!this.config.treasury) return false;
    const [b, min] = await Promise.all([this.chain.balance(this.config.treasury), this.chain.rentExemptMinimum(0)]);
    return b >= min;
  }

  async buyTransaction({ listing, buyer }) {
    if (buyer === listing.seller) throw Error('You cannot buy your own listing.');
    const a = await this.verifyListable({ asset: listing.asset, seller: listing.seller });
    const price = BigInt(listing.price), withFee = await this.treasuryReady();
    const split = saleSplit(price, a.royalties?.basisPoints || 0, a.royalties?.creators || [], withFee);
    const { blockhash, lastValidBlockHeight } = await this.chain.latestBlockhash();
    const tx = new Transaction({ feePayer: new PublicKey(buyer), recentBlockhash: blockhash });
    const pay = (to, lamports) => { if (lamports > 0n) tx.add(SystemProgram.transfer({ fromPubkey: new PublicKey(buyer), toPubkey: new PublicKey(to), lamports })); };
    pay(listing.seller, split.seller);
    for (const p of split.payouts) pay(p.address, p.amount);
    if (split.company) pay(this.config.treasury, split.company);
    const collection = a.updateAuthority.type === 'Collection' ? a.updateAuthority.address : undefined;
    tx.add(...this.ix(transferV1(this.umi, { asset: a.publicKey, collection, newOwner: publicKey(buyer),
      payer: createNoopSigner(publicKey(buyer)), authority: this.signer(this.keys.marketAuthority) })));
    tx.partialSign(this.keys.marketAuthority);
    return { transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), lastValidBlockHeight,
      split: { seller: split.seller.toString(), royalty: split.royalty.toString(), company: split.company.toString(), royaltyTo: split.payouts.map(p => p.address) } };
  }

  async ownerOf(asset) { return (await this.readAsset(asset)).owner; }

  // ---------- Immortal Combat escrow: a minted Monstar is moved into a match escrow before the fight ----------
  /** The owner signs this in Phantom: their NFT moves into the match escrow (they pay the small network fee). */
  async lockTransaction({ asset, owner, escrow }) {
    const a = await this.readAsset(asset);
    if (!this.isOfficial(a)) throw Error('Only official PocketMonstars can be fought for.');
    if (a.owner !== owner) throw Error('You do not hold this NFT in your wallet (is it listed for sale? Cancel the listing first).');
    const { blockhash } = await this.chain.latestBlockhash();
    const collection = a.updateAuthority.type === 'Collection' ? a.updateAuthority.address : undefined;
    const tx = new Transaction({ feePayer: new PublicKey(owner), recentBlockhash: blockhash })
      .add(...this.ix(transferV1(this.umi, { asset: a.publicKey, collection, newOwner: publicKey(escrow), payer: createNoopSigner(publicKey(owner)), authority: createNoopSigner(publicKey(owner)) })));
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  }
  /**
   * Releases an escrowed NFT to `to`. The receiver pays the network fee and signs in Phantom; the escrow key co-signs here.
   * `payments` (lamports) and `memo` are added first, so a buy-back is one atomic transaction: pay the soul fee, get the NFT.
   */
  async releaseTransaction({ asset, escrowSecret, to, payments = [], memo = null }) {
    const kp = Keypair.fromSecretKey(bs58.decode(escrowSecret)), a = await this.readAsset(asset);
    if (a.owner !== kp.publicKey.toBase58()) throw Error('That NFT is not in this escrow any more.');
    const { blockhash } = await this.chain.latestBlockhash(), payer = new PublicKey(to);
    const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
    for (const p of payments) if (BigInt(p.lamports) > 0n) tx.add(SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(p.to), lamports: BigInt(p.lamports) }));
    if (memo) tx.add(new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(memo) }));
    const collection = a.updateAuthority.type === 'Collection' ? a.updateAuthority.address : undefined;
    tx.add(...this.ix(transferV1(this.umi, { asset: a.publicKey, collection, newOwner: publicKey(to), payer: createNoopSigner(publicKey(to)), authority: this.signer(kp) })));
    tx.partialSign(kp);
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
  }
}
