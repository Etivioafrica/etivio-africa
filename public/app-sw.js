// Etivio app service worker. Keeps the app shell (offline page, icons, onboarding images) cached so the installed
// app opens instantly and shows a friendly page when there's no connection. Pages and data always come from the
// network: courses, progress and payments must never be served stale.
const CACHE = "etivio-app-v1";
const OFFLINE_URL = "/offline";
const SHELL = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/etiviologo.svg",
  "/onboarding/slide-1.jpg",
  "/onboarding/slide-2.jpg",
  "/onboarding/slide-3.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

// Also clears caches left by the old Etivio app (and the kill-switch workers at /sw.js and /sw-push.js).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always the network; the offline page only when there is no connection.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Build files never change once published, so they can be served from the cache.
  const immutable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/onboarding/");
  if (immutable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
