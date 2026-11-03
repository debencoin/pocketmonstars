// Profile avatars. Photo avatars are one-of-one: either reserved for a wallet ("founder" = the legendary
// account holder) or sold once in the market for SOL. Every player can also use any Monstar they own.
export const AVATARS = [
  { id: 'gilded-voyager', name: 'Gilded Voyager', img: 'art/avatars/gilded-voyager.jpg', thumb: 'art/avatars/gilded-voyager-128.jpg', reservedFor: 'founder', priceLamports: null,
    note: 'One of one. Held by the founder (legendary account holder).' },
  // More photo avatars go here, e.g. { id: 'neon-ronin', name: 'Neon Ronin', img: 'art/avatars/neon-ronin.jpg', thumb: '...-128.jpg', reservedFor: null, priceLamports: '500000000' }
];
export const AVATAR_BY_ID = Object.fromEntries(AVATARS.map(a => [a.id, a]));
