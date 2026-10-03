// Herbstfarben – Service Worker: sorgt dafür, dass die App auch ohne Internet startet.
// Wer Bilder oder das Manifest ändert, erhöht hier die Versionsnummer (v1 -> v2).
const VERSION = 'herbstfarben-v1';
const FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(openPage(req, url));
    return;
  }
  // Bilder und Manifest: zuerst aus dem Speicher
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))
  );
});

// Seite: zuerst aus dem Netz (damit Änderungen ankommen), nach 3 Sekunden
// oder ohne Netz die gespeicherte Version.
async function openPage(req, url) {
  const cache = await caches.open(VERSION);
  const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const network = fetch(req).then(res => {
    if (res.ok && isApp) cache.put('./index.html', res.clone());
    return res;
  });
  network.catch(() => {});
  const timeout = new Promise(resolve => setTimeout(resolve, 3000, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (err) { /* kein Netz */ }
  const cached = isApp ? await cache.match('./index.html') : null;
  if (cached) return cached;
  return network;
}
