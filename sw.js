const CACHE_NAME = "swapno-shastra-v17";

const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logho.jpg"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

// Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", event => {

  // API request cache করবে না
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .then(networkResponse => {

            return caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });

          })
          .catch(() => {
            return caches.match("/index.html");
          });
      })
  );
});
