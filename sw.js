/* 오프라인 실행용 서비스 워커: 앱 파일과 피아노 소리를 저장해 두고, 곡 데이터는 처음 받을 때 저장 */
const VERSION = 'piano-v2';
const NOTES = ['A0'];
for (let o = 1; o <= 7; o++) for (const n of ['C', 'Ds', 'Fs', 'A']) NOTES.push(n + o);
NOTES.push('C8');
const CORE = ['./', './index.html', './catalog.json', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  ...NOTES.map(n => './samples/' + n + '.mp3')];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});

// 페이지에서 "전체 곡 저장" 요청이 오면 남은 곡 데이터를 모두 받아 둠
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'cacheAll') return;
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    let done = 0;
    for (const url of e.data.urls) {
      try {
        if (!(await cache.match(url))) { const res = await fetch(url); if (res.ok) await cache.put(url, res); }
      } catch (err) {}
      done++;
    }
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'cachedAll', done, total: e.data.urls.length }));
  })());
});
