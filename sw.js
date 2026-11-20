/* 官兵衛 営業入力：オフライン用のキャッシュ。アプリの本体（HTML・アイコン）を、iPhoneの中に保存し、通信なしでも開けるようにする。営業のデータは、ここには入れない（端末内の保存領域だけ）。
   v4（2026-11-20）：古い画面が出続ける問題の修正。
   ・原因：画面（HTML）を「先に保存済みの版を返し、裏で更新する」方式で、しかも更新の取得が、ブラウザの一時保存（10分）に当たっていたため、公開後も、何度か開くまで、古い版が出ていた。
   ・対策：画面（HTML）は、通信できる時は、必ず、最新を確認して表示する（通信の確認は no-cache＝一時保存を使わず、サーバーに最新かを問い合わせる）。電波が悪い・圏外の時は、3秒待って、保存済みの版で開く。
   ・版を v4 に上げ、古い保存（v3以前）は、起動時に、整理する。更新を受け取った時は、開いている画面を、1回だけ、再読み込みする。
   ・営業の記録（localStorage・IndexedDB）には、一切、触れない（ここで扱うのは、アプリ本体のキャッシュだけ）。 */
var CACHE = 'kanbei-input-v4';
var FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
var WAIT_MS = 3000;
self.addEventListener('install', function (e) {
  /* 保存するときも、ブラウザの一時保存を使わず、サーバーから最新を取る */
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  var upgraded = false;
  e.waitUntil(
    caches.keys().then(function (ks) {
      var old = ks.filter(function (k) { return k !== CACHE && k.indexOf('kanbei-input-') === 0; });
      upgraded = old.length > 0;                                                 /* 古い版（v3以前）が、あった＝更新を受け取った */
      return Promise.all(old.map(function (k) { return caches.delete(k); }));
    })
      .then(function () { return self.clients.claim(); })
      .then(function () { return upgraded ? self.clients.matchAll({ type: 'window' }) : []; })
      .then(function (cs) { cs.forEach(function (c) { if (c.navigate) { try { c.navigate(c.url); } catch (x) {} } }); })   /* 更新を受け取った時だけ：開いている画面を、最新に（初めて入れた時は、しない） */
  );
});
/* 最新を、確実に取る：ブラウザの一時保存（GitHubは10分）にも、途中の中継にも当たらないよう、毎回、違うURL（?_sw=時刻）で、保存なしで取りに行く（同じサイトの中だけ）。
   （試験で確認：fetch(e.request, {cache:'no-cache'}) だけでは、画面の読み込みが、一時保存から返り、新しい版が出なかった） */
function fresh(req) {
  var u = new URL(req.url);
  u.searchParams.set('_sw', String(Date.now()));
  return fetch(u.toString(), { cache: 'no-store', credentials: 'same-origin' });
}
function isPage(req) {
  var p = new URL(req.url).pathname;
  return req.mode === 'navigate' || /\/$/.test(p) || /\.html$/.test(p);
}
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  if (isPage(e.request)) {                                                       /* 画面（HTML）：最新を優先。取れなければ、保存済みの版 */
    var net = fresh(e.request).then(function (r) {
      if (r && r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return r;
    });
    var cached = function () { return caches.match(e.request, { ignoreSearch: true }).then(function (h) { return h || caches.match('./index.html') || caches.match('./'); }); };
    var timer = new Promise(function (res) { setTimeout(function () { res(null); }, WAIT_MS); });
    e.respondWith(Promise.race([net.catch(function () { return null; }), timer]).then(function (r) {
      if (r) return r;                                                           /* 3秒待っても、通信できない／圏外：保存済みの版で開く（通信は、裏で続き、取れたら保存） */
      return cached().then(function (h) { return h || net; });
    }));
    e.waitUntil(net.catch(function () {}));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {   /* アイコンなど：保存済みを返し、裏で最新に */
    if (hit) { fresh(e.request).then(function (r) { if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, r); }); }).catch(function () {}); return hit; }
    return fetch(e.request).catch(function () { return caches.match('./index.html'); });
  }));
});
