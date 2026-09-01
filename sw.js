/* 2026-08-28 | v5.1.20 | 累積QAでボタン・文書句読点・JSON復元を安定化 */
/* 2026-08-28 | v5.1.19 | 搬送先選定理由の病態別例文ボタンを確実に配信 */
/* 2026-08-28 | v5.1.18 | 心肺停止の頻用病名・症状詳記・専用文章生成を確実に配信 */
/* 2026-08-28 | v5.1.17 | 救急隊・FD初回バイタル時刻の接触時刻連動を確実に配信 */
/* 2026-08-28 | v5.1.16 | 既往歴・常用薬・アレルギーの不詳入力を確実に配信 */
/* 2026-08-28 | v5.1.15 | 自動胸骨圧迫装置の一般名称化を確実に配信 */
/* 2026-08-28 | v5.1.14 | CPA継続引継ぎとプレホスLow Flow暫定値を確実に配信 */
/* 2026-08-28 | v5.1.13 | FD身体所見と時刻別瞳孔所見などの更新を確実に配信 */
/* 2026-08-23 | privacy | 車両電話番号削除後のHTMLを配信 */
/* 2026-07-19 | v5.1.12 | Iターン活動終了の誤推定を停止 */
/* 2026-07-19 | v5.1.11 | 臨床時刻メトリクス追加版を確実に配信 */
/* 2026-07-19 | v5.1.10 | メトリクス信頼性改善版を確実に配信 */
/* 2026-07-14 | v5.1.9 | 搬送スキーム未選択・要請キャンセル終了を反映 */
const CACHE_PREFIX = 'heli-record-';
const CACHE_NAME = 'heli-record-v5.1.20-metrics-stop-20260908';
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
