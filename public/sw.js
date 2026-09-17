/* CineVerse service worker — offline shell + cache strategies
 * v2: network-first for navigations so watch routes never stick on a cached 404
 */
const CACHE = "cineverse-v3";
const SHELL = ["/", "/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("cineverse-") && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache cross-origin (embeds, TMDB images, etc.)
  if (url.origin !== self.location.origin) return;

  // Never cache authentication, playback tokens, user data, or React route payloads.
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;

  // HTML navigations (watch pages, catalog): always network-first.
  // Cache-first here previously served stale 404 "Lost in the nebula" on mobile.
  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache successful navigations
          if (res.ok && SHELL.includes(url.pathname) && !url.search) {
            const clone = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(request, clone)));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then(async (cached) => cached || await caches.match("/offline") || Response.error()),
        ),
    );
    return;
  }

  // Only immutable application assets; do not store videos or arbitrary GET responses.
  if (!url.pathname.startsWith("/_next/static/") && !url.pathname.startsWith("/icons/")) return;
  // Static assets: stale-while-revalidate, with a bounded cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            event.waitUntil(caches.open(CACHE).then(async (c) => {
              await c.put(request, clone);
              const keys = (await c.keys()).filter((key) => !SHELL.includes(new URL(key.url).pathname));
              await Promise.all(keys.slice(0, Math.max(0, keys.length - 100)).map((key) => c.delete(key)));
            }));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || fetched;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
