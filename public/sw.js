// Service Worker for Задачник.
// Pass-through (no caching) — keeps PWA installability and unblocks notifications,
// while letting the browser/CDN handle freshness. Removes any stale caches from
// previous versions so users automatically recover after deploys.

const CACHE_NAME = "planner-cache-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => caches.delete(k))),
      ),
      self.clients.claim(),
    ]),
  );
});

// Future hook: handle push notifications when we wire them up.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "Задачник", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});
