const CACHE_NAME = 'sig-senegal-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/leaflet.css',
  '/css/qgis2web.css',
  '/css/modern-app.css',
  '/js/leaflet.js',
  '/js/app.js',
  '/data/Region_3.js',
  '/data/Departement_4.js',
  '/data/Arrondissement_5.js',
  '/data/localites_7.js',
  '/data/Routes_6.js',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});