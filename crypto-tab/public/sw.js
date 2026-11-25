// Crypto Tab service worker: offline app shell + push alarms with a STOP action.
const SHELL = 'ct-shell-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/') || u.origin !== location.origin) return;
  // network first, cache fallback (keeps the app fresh, still opens offline)
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Crypto Tab', body: e.data && e.data.text() }; }
  const alarm = d.kind === 'alarm';
  e.waitUntil(self.registration.showNotification(d.title || 'Crypto Tab', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: true,
    requireInteraction: alarm,
    silent: false,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: alarm ? [900, 300, 900, 300, 900, 300, 900] : [200, 100, 200],
    data: d,
    actions: alarm ? [{ action: 'stop', title: '⏹ Stop alarm' }, { action: 'open', title: 'Open' }] : [],
  }));
});

async function auth() { try { const c = await caches.open('ct-auth'); const r = await c.match('/__auth'); return r ? r.json() : null; } catch { return null; } }

self.addEventListener('notificationclick', (e) => {
  const d = e.notification.data || {};
  e.notification.close();
  e.waitUntil((async () => {
    if (d.kind === 'alarm') {
      const a = await auth();
      if (a) await fetch(`${a.base}/api/alerts/${d.id}/ack`, { method: 'POST', headers: { 'x-ct-token': a.token, 'content-type': 'application/json' }, body: '{}' }).catch(() => {});
      const all = await self.clients.matchAll({ type: 'window' });
      all.forEach((c) => c.postMessage({ type: 'alarm-stopped', id: d.id }));
      if (e.action === 'stop') return;
    }
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow(d.kind === 'alarm' ? `/?view=chart&ack=${d.id}` : '/?view=bots');
  })());
});
