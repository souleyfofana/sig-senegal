const CACHE_NAME = 'sig-senegal-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/leaflet.css',
  '/css/L.Control.Layers.Tree.css',
  '/css/L.Control.Locate.min.css',
  '/css/qgis2web.css',
  '/css/fontawesome-all.min.css',
  '/css/MarkerCluster.css',
  '/css/MarkerCluster.Default.css',
  '/css/leaflet-search.css',
  '/css/leaflet.photon.css',
  '/css/leaflet-measure.css',
  '/css/modern-app.css',
  '/js/leaflet.js',
  '/js/L.Control.Layers.Tree.min.js',
  '/js/L.Control.Locate.min.js',
  '/js/labelgun.min.js',
  '/js/leaflet-hash.js',
  '/js/leaflet-heat.js',
  '/js/leaflet-measure.js',
  '/js/leaflet-search.js',
  '/js/leaflet-svg-shape-markers.min.js',
  '/js/leaflet-tilelayer-wmts.js',
  '/js/leaflet.js',
  '/js/leaflet.markercluster.js',
  '/js/leaflet.pattern.js',
  '/js/leaflet.photon.js',
  '/js/leaflet.rotatedMarker.js',
  '/js/Leaflet.VectorGrid.js',
  '/js/leaflet.wms.js',
  '/js/multi-style-layer.js',
  '/js/OSMBuildings-Leaflet.js',
  '/js/qgis2web_expressions.js',
  '/js/rbush.min.js',
  '/js/app.js',
  '/js/Autolinker.min.js',
  '/data/Region_3.js',
  '/data/Departement_4.js',
  '/data/Arrondissement_5.js',
  '/data/localites_7.js',
  '/data/Routes_6.js',
  '/manifest.json'
];

self.addEventListener('install', function(event) {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        var fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});