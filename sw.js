const LICHTLOOT_CACHE = "lichtloot-app-v1";
const STATIC_ASSETS = [
  "./",
  "start.html",
  "manifest.webmanifest",
  "images/app-icon.svg",
  "images/app-logo.svg",
  "images/app-background.svg",
  "images/lichtbuff-addon-icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(LICHTLOOT_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== LICHTLOOT_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if(request.method !== "GET") return;

  const url = new URL(request.url);
  if(url.pathname.startsWith("/api/") || url.hostname.includes("google") || url.hostname.includes("railway.app")){
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(LICHTLOOT_CACHE).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then(response => response || caches.match("start.html")))
  );
});
