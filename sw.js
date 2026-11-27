const CACHE_NAME = "daily-audit-v9";
const APP_FILES = [
  "./",
  "./index.html",
  "./login.html",
  "./login.css",
  "./auth-background.png",
  "./login-background.png",
  "./change.html",
  "./change.css",
  "./Dashboard.html",
  "./Dashboard.css",
  "./Aduit.html",
  "./Aduit.css",
  "./History.html",
  "./History.css",
  "./styles.css",
  "./app.js",
  "./auth.js",
  "./offline-db.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./login.html")))
  );
});
