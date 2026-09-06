










const CACHE_PREFIX = 'heli-record-';
const CACHE_NAME = 'heli-record-v5.1.20-20260906b';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './apple-touch-icon.png'
];

const NETWORK_FIRST_PATH_RE = /\.(html|js)(\?|$)/i;

function isNetworkFirstRequest(request) {
  if (request.method !== 'GET') return false;
  if (request.mode === 'navigate') return true;
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    return NETWORK_FIRST_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => (
          cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME
            ? caches.delete(cacheName)
            : null
        ))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!isNetworkFirstRequest(event.request)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
