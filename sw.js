/* Service worker: aplikasi tetap bisa dibuka tanpa internet setelah pernah dibuka sekali.
   - Halaman (index.html): ambil dari jaringan dulu, supaya pembaruan langsung terlihat; bila offline pakai salinan tersimpan.
   - File lokal lain (ikon, manifest): dari cache, diperbarui di belakang layar.
   - Sinkronisasi Google dan font luar tidak di-cache oleh sini (font memakai cache bawaan browser). */
var C = 'msq-spin-v3';
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
function save(r, res) {
  if (res && res.ok) { var cp = res.clone(); caches.open(C).then(function (c) { c.put(r, cp); }); }
  return res;
}
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== self.location.origin) return; // sinkronisasi & font: biarkan browser yang urus
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(function (res) { return save(new Request('./'), res.clone()) && res; })
        .catch(function () { return caches.match('./').then(function (h) { return h || Response.error(); }); })
    );
    return;
  }
  e.respondWith(caches.match(r).then(function (hit) {
    var net = fetch(r).then(function (res) { return save(r, res); }).catch(function () { return hit; });
    return hit || net;
  }));
});
