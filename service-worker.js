/* Student Portal — service worker: the app opens and works with NO internet.
   Put this file next to index.html. Whenever you upload new files, change CACHE_VERSION (v1 → v2 …)
   so every phone downloads the new version automatically. */
const CACHE_VERSION = 'v29';
const CACHE = 'portal-' + CACHE_VERSION;

// Everything the app needs. Both layouts are listed (all files in one folder, or css/ js/ data/ folders);
// files that don't exist are simply skipped.
const FILES = [
  './', 'index.html', 'manifest.json',
  'style.css', 'script.js', 'data.json',
  'css/style.css', 'js/script.js', 'data/data.json',
  'icons/icon-192.png', 'icons/icon-512.png'
];
const EXTERNAL = ['fonts.googleapis.com', 'fonts.gstatic.com'];   // the Outfit font is kept too
const ok = r => r && (r.status === 200 || r.type === 'opaque');
// a page that was reached through a redirect can't be served to a navigation as it is, so store a clean copy
async function store(c, req, res) {
  if (res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
  return c.put(req, res);
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(FILES.map(async f => {
      const req = new Request(f, { cache: 'reload' }), res = await fetch(req);
      if (ok(res)) await store(c, req, res.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('portal-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// data.json: try the internet first (so schedule changes show up), but give up after 3.5 s and use the saved copy
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 3500))]);
    if (ok(res)) store(c, req, res.clone());
    return res;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || new Response('', { status: 404 });
  }
}

// everything else: show the saved copy instantly, refresh it in the background
async function staleWhileRevalidate(req, evt) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (ok(res)) store(c, req, res.clone()); return res; }).catch(() => null);
  if (hit) { evt.waitUntil(net); return hit; }
  const res = await net;
  if (res) return res;
  if (req.mode === 'navigate') return (await c.match('index.html')) || (await c.match('./')) || new Response('Offline', { status: 503 });
  return new Response('', { status: 404 });
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // استثني سكريبت Umami عشان يشتغل من غير تدخل الـ Service Worker
  if (url.includes('script.googles.com')) {
    return; // سيبه يروح للنت مباشرة
  }
  if (url.includes('clarity.ms')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});