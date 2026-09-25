const CACHE_NAME = 'gallina-parkour-v1';
const ASSETS = [
  'index.html',
  'style.css',
  'script.js',
  'gallina_subiendo.png'
];

// Instalar el Service Worker y almacenar los recursos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Almacenando recursos en caché...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activar el Service Worker y limpiar cachés antiguas si las hay
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Responder con los recursos de la caché cuando esté offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});

