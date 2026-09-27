// Gwandkastl Service Worker – App offline starten, Fotos zwischenspeichern
const APP = 'gk-app-v1', CDN = 'gk-cdn-v1', IMG = 'gk-img';
const SHELL = ['./', './index.html', './manifest.json', './apple-touch-icon.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => ![APP, CDN, IMG].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // Fotos aus Supabase: einmal geladen, dann aus dem Speicher (Link-Code wird ignoriert)
  if (u.pathname.includes('/storage/v1/object/sign/')) {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(r, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === 'opaque') c.put(r, res.clone());
      return res;
    }));
    return;
  }
  // Die Seite selbst: zuerst aus dem Netz (immer aktuell), offline aus dem Speicher
  if (u.origin === location.origin) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(APP).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  // Bibliotheken und Schrift: fixe Versionen, daher aus dem Speicher
  if (/(^|\.)cdn\.jsdelivr\.net$|(^|\.)cdnjs\.cloudflare\.com$|^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(CDN).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok || res.type === 'opaque') c.put(r, res.clone());
      return res;
    }));
  }
});
