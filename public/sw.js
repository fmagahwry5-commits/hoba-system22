/* نظام هوبا — Service Worker لتحميل أسرع للواجهة */
const CACHE = 'hoba-v2';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// الواجهة من الكاش (للسرعة) — أما البيانات فدائماً من السيرفر مباشرة
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // البيانات دائماً حية من الكمبيوتر
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
