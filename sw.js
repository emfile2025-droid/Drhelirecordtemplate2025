const CACHE_PREFIX = 'heli-record-';
const CACHE_NAME = CACHE_PREFIX + 'v5.1.34' + '@' + self.registration.scope;
const ASSETS = ["./index.html", "./StrokeNotify_v1.0.html", "./related-apps.js", "./manifest.json", "./apple-touch-icon.png"];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS.map(asset => new Request(asset, {cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()) {
      if(!key.startsWith(CACHE_PREFIX) || key === CACHE_NAME) continue;
      if(key.includes('@')) {
        if(key.endsWith('@'+self.registration.scope)) await caches.delete(key);
      } else {
        const old = await caches.open(key);
        const entries = await old.keys();
        if(entries.length && entries.every(r=>r.url.startsWith(self.registration.scope))) await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const root = new URL('./',self.location.href);
  if(url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return;
  const asset = './' + (url.pathname.slice(root.pathname.length) || 'index.html');
  if(!ASSETS.includes(asset)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(new URL(asset,root).href) || fetch(event.request);
  })());
});
