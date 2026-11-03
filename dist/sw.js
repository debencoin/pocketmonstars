// PocketMonstars app service worker: the game shell and art work offline-fast; live data never comes from cache.
const V = 'pm-v39', SHELL = ['/play', '/pvp-v4.css', '/game.js', '/arena-v2.js', '/monstars-v3.js', '/stake-client.js', '/pixel-arena.js', '/lock.js', '/pvp-v4.js', '/wild.js', '/v5.js', '/app.js', '/v6.js', '/manifest.webmanifest', '/app/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/ws') return; // live data: always the network
  if (u.pathname.startsWith('/art/')) { // art: cache first
    e.respondWith(caches.open(V).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  // game code and pages: network first so updates arrive at once, cache when offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('/play'))));
});
