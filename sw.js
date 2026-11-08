/* Service worker: aplikasi tetap bisa dibuka tanpa internet setelah pernah dibuka sekali. */
var C = 'msq-spin-v2';
var PRE = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) {
    return Promise.all(PRE.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== C; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.hostname === 'script.google.com' || /googleusercontent\.com$/.test(u.hostname)) return; // sinkronisasi jangan di-cache
  e.respondWith(caches.match(r, { ignoreSearch: r.mode === 'navigate' }).then(function (hit) {
    var net = fetch(r).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () { return hit || (r.mode === 'navigate' ? caches.match('./') : undefined); });
    return hit || net;
  }));
});
