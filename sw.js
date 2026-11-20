/* 官兵衛 営業入力：オフライン用のキャッシュ。アプリの本体（HTML・アイコン）を、iPhoneの中に保存し、通信なしでも開けるようにする。営業のデータは、ここには入れない（端末内の保存領域だけ）。 */
var CACHE = 'kanbei-input-v3';
var FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k.indexOf('kanbei-input-') === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    if (hit) { fetch(e.request).then(function (r) { if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r); }); }).catch(function () {}); return hit; }   /* あれば、すぐ返す（通信なしでも開く）。つながっていれば、裏で更新 */
    return fetch(e.request).catch(function () { return caches.match('./index.html'); });
  }));
});
