// Blocker Rush service worker: makes the single-player game work offline.
// Registered by components/ServiceWorker.tsx in production builds only.
//
// - Pages (navigations): network first, so a new deploy shows up as soon as
//   the player is online; the cached copy is the offline fallback.
// - /_next/static/*: cache first. Those files are content-hashed and never
//   change, so a cached copy is always correct.
// - Anything else under the base path (icons, manifest, RSC payloads):
//   network first with the cache as fallback.
//
// Install precaches the main pages and every /_next/static file they
// reference, so one online visit is enough to play offline later. The
// puzzle dataset is bundled into those scripts.
//
// Bump VERSION to drop every cache when the caching scheme changes; normal
// deploys don't need it.

const VERSION = "v1";
const PAGES = `blocker-rush-pages-${VERSION}`;
const STATIC = `blocker-rush-static-${VERSION}`;
const OTHER = `blocker-rush-other-${VERSION}`;
const CACHES = [PAGES, STATIC, OTHER];

// "/blocker-rush" (the scope has a trailing slash only if registered with one).
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const PRECACHE_PAGES = [BASE, `${BASE}/casual`, `${BASE}/daily`];
const STATIC_PREFIX = `${BASE}/_next/static/`;
// Old deploys' hashed files pile up in STATIC; keep it bounded.
const MAX_STATIC_ENTRIES = 300;

const staticUrlsIn = (html) => {
  const urls = new Set();
  const pattern = new RegExp(
    `${STATIC_PREFIX.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^"'\\s)\\\\]+`,
    "g",
  );
  for (const match of html.matchAll(pattern)) urls.add(match[0]);
  return [...urls];
};

const precache = async () => {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  await Promise.allSettled(
    PRECACHE_PAGES.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      // A redirected response can't answer a navigation later.
      if (!response.ok || response.redirected) return;
      const html = await response.clone().text();
      await pages.put(path, response);
      await Promise.allSettled(
        staticUrlsIn(html).map(async (url) => {
          if (await statics.match(url)) return;
          const asset = await fetch(url);
          if (asset.ok) await statics.put(url, asset);
        }),
      );
    }),
  );
};

const trim = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Cache.keys() is in insertion order: drop the oldest.
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)),
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("blocker-rush-") && !CACHES.includes(name)) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

const offlineResponse = () =>
  new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>" +
      "<title>Offline | Blocker Rush</title>" +
      "<body style='font-family:sans-serif;background:#06101b;color:#eaf6ff;padding:24px'>" +
      `<h1>You're offline</h1><p>This page hasn't been saved for offline play yet. ` +
      `<a style='color:#f2c14e' href='${BASE}'>Play the daily puzzle</a></p>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

const handleNavigation = async (request) => {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      // Keyed without the query string: /casual?p=… shares /casual's page.
      const url = new URL(request.url);
      await cache.put(url.origin + url.pathname, response.clone());
    }
    return response;
  } catch {
    const url = new URL(request.url);
    // A page never opened online (e.g. an archive day) gets a short offline
    // page linking to today's puzzle, which is always precached.
    return (
      (await cache.match(url.origin + url.pathname, { ignoreVary: true })) ??
      offlineResponse()
    );
  }
};

const handleStatic = async (request) => {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(STATIC, MAX_STATIC_ENTRIES);
  }
  return response;
};

const handleOther = async (request) => {
  const cache = await caches.open(OTHER);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Same-origin game files only: leaves analytics, the multiplayer server
  // and the host site alone.
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== BASE && !url.pathname.startsWith(`${BASE}/`)) return;
  if (url.pathname === `${BASE}/sw.js`) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(handleStatic(request));
  } else {
    event.respondWith(handleOther(request));
  }
});
