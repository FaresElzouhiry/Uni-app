/* Student Portal — service worker: the app opens instantly and works with NO internet.
   Put this file next to index.html. Whenever you upload new files, change CACHE_VERSION (v5 → v6 …)
   so every phone downloads the new version. */
const CACHE_VERSION = 'v23';
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

// Is this a real file? Some hosts (Cloudflare Pages without a 404.html) answer EVERY unknown address with
// index.html — such an answer must never be saved or served as if it were a css / js / json file.
const isHtml = r => (r.headers.get('content-type') || '').includes('text/html');
function good(req, res) {
  if (!res) return false;
  if (res.type === 'opaque') return true;
  if (res.status !== 200) return false;
  const p = new URL(req.url).pathname;
  const page = req.mode === 'navigate' || p.endsWith('/') || /\.html?$/.test(p);
  return page || !isHtml(res);
}
// a page reached through a redirect can't be served to a navigation as it is, so save a clean copy
async function store(c, req, res) {
  if (res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
  return c.put(req, res);
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(FILES.map(async f => {
      const req = new Request(f, { cache: 'reload' }), res = await fetch(req);
      if (good(req, res)) await store(c, req, res.clone());
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

// data.json / manifest.json: try the internet first (so changes show up), give up after 3.5 s and use the saved copy
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, 3500))]);
    if (good(req, res)) { store(c, req, res.clone()); return res; }
    return (await c.match(req, { ignoreSearch: true })) || (res.status === 200 ? new Response('', { status: 404 }) : res);
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || new Response('', { status: 404 });
  }
}

// everything else: show the saved copy instantly, refresh it in the background
async function staleWhileRevalidate(req, evt) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (good(req, res)) { store(c, req, res.clone()); return res; }
    return req.mode === 'navigate' || res.type === 'opaqueredirect' || res.status !== 200 ? res : new Response('', { status: 404 });
  }).catch(() => null);
  if (hit) { evt.waitUntil(net); return hit; }
  const res = await net;
  if (res) return res;
  if (req.mode === 'navigate') return (await c.match('index.html')) || (await c.match('./')) || new Response('Offline', { status: 503 });
  return new Response('', { status: 404 });
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const same = url.origin === location.origin;
  if (!same && !EXTERNAL.includes(url.hostname)) return;      // feedback, Cloudflare analytics… go straight to the network
  e.respondWith(same && /(data|manifest)\.json$/.test(url.pathname) ? networkFirst(req) : staleWhileRevalidate(req, e));
});