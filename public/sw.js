const CACHE_NAME = "signbridge-models-v2";
const MEDIAPIPE_PREFIX = "cdn.jsdelivr.net/npm/@mediapipe/holistic";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/translate", "/manifest.json"]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith("signbridge-") && k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // MediaPipe CDN — cache-first (pre-warmed by ModelDownloader)
  if (url.includes(MEDIAPIPE_PREFIX)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        } catch {
          return cached ?? Response.error();
        }
      })
    );
    return;
  }

  // Local LSTM config + app pages — cache-first when offline
  if (
    request.method === "GET" &&
    (url.includes("/models/lstm/") || url.endsWith("/manifest.json"))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        } catch {
          return cached ?? Response.error();
        }
      })
    );
    return;
  }

  // Navigation — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match("/translate") ?? cache.match("/"))
      )
    );
  }
});
