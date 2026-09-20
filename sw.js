const CACHE = 'checkin-v4';
const FILES = ['./', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));

// Cache our own files and the pinned Firebase library files (so the app loads offline).
// Firebase API calls (googleapis.com) are never cached: they pass straight through.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const ours = url.origin === self.location.origin;
  const lib = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (e.request.method !== 'GET' || !(ours || lib)) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (lib && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  })));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
