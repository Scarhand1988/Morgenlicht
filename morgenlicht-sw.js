// Offline-Speicher für Morgenlicht: erst Netz, bei fehlender Verbindung der gespeicherte Stand.
const CACHE = 'morgenlicht-v9';
const FILES = [
  'Morgenlicht.html',
  'morgenlicht.css',
  'morgenlicht.js',
  'morgenlicht-zeit.js',
  'morgenlicht-klang.js',
  'sounds/meer.wav',
  'sounds/regen.wav',
  'sounds/wald.wav',
  'sounds/bach.wav',
  'sounds/fluss.wav',
  'sounds/nachtigall.wav',
  'sounds/froesche.wav',
  'sounds/gewitter.wav',
  'morgenlicht.webmanifest',
  'morgenlicht-icon.svg',
  'morgenlicht-180.png',
  'morgenlicht-192.png',
  'morgenlicht-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, {ignoreSearch: true}))
  );
});
