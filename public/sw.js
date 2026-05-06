// Service Worker for Задачник.
// Strategy:
// - Same-origin GET requests → network-first, fall back to cache. Successful
//   responses are cached so the app shell (HTML, JS, CSS, icons) remains
//   available offline.
// - Cross-origin requests (Supabase, Telegram) → pass through, no caching.
//   Those go through online detection in the app.
// - Non-GET requests → pass through.
//
// Bumping CACHE_NAME invalidates older caches automatically on activate.

const CACHE_NAME = "planner-cache-v6";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Skip Next.js dev/HMR endpoints.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, clone))
            .catch(() => {
              // ignore cache write errors
            });
        }
        return response;
      })
      .catch(() =>
        caches.match(req).then(
          (cached) =>
            cached ||
            new Response("Офлайн — нет в кеше", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Задачник", body: "", tag: undefined, url: "/" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && targetUrl !== "/") {
              try {
                client.navigate(targetUrl);
              } catch {
                // ignore
              }
            }
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
