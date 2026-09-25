/*
 * Classéo service worker. Hand written, no library.
 *
 * - Pages: network first. A copy of the pages a family reads most (dashboard,
 *   student files, guide) is kept so they stay readable offline. Any other
 *   page falls back to /hors-ligne when the network is down.
 * - Static assets (scripts, styles, fonts, icons): stale while revalidate.
 * - Never cached: anything that is not GET (server actions are POST), React
 *   Server Component payloads, prefetches, development endpoints, other
 *   origins.
 * - Private copies are deleted when the user signs out or the session ends.
 * - Caches are versioned: a new VERSION removes the previous ones.
 */

const VERSION = "2026-09-25.1";
const SHELL = `classeo-shell-${VERSION}`;
const ASSETS = `classeo-assets-${VERSION}`;
const PAGES = `classeo-pages-${VERSION}`;
const CURRENT = [SHELL, ASSETS, PAGES];
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest"];
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("classeo-") && !CURRENT.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "purge-private") event.waitUntil(caches.delete(PAGES));
});

function isPrivatePage(pathname) {
  return pathname === "/espace" || pathname === "/espace/aide" || pathname === "/espace/suivi" || pathname.startsWith("/espace/suivi/");
}

function isPublicPage(pathname) {
  return pathname === "/" || pathname === OFFLINE_URL;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname.startsWith("/apple-icon") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|png|svg|ico|webp)$/.test(url.pathname)
  );
}

function isFrameworkData(request, url) {
  return (
    request.headers.has("rsc") ||
    request.headers.has("next-action") ||
    request.headers.has("next-router-prefetch") ||
    url.searchParams.has("_rsc") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  );
}

// A response that went through a redirect cannot answer a navigation: copy it.
function servable(response) {
  if (!response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function handlePage(event, url) {
  try {
    const response = await fetch(event.request);
    if (url.pathname === "/connexion" && response.ok) {
      // Reaching the sign in page means no session: drop private copies.
      event.waitUntil(caches.delete(PAGES));
    } else if (response.ok && response.type === "basic" && !response.redirected) {
      if (isPrivatePage(url.pathname)) {
        const copy = response.clone();
        event.waitUntil(
          caches
            .open(PAGES)
            .then((cache) => cache.put(url.pathname + url.search, copy))
            .then(() => trim(PAGES, MAX_PAGES)),
        );
      } else if (isPublicPage(url.pathname)) {
        const copy = response.clone();
        event.waitUntil(caches.open(SHELL).then((cache) => cache.put(url.pathname, copy)));
      }
    }
    return response;
  } catch {
    const key = url.pathname + url.search;
    const cached = (await caches.match(key, { cacheName: PAGES })) || (await caches.match(url.pathname, { cacheName: SHELL }));
    if (cached) return servable(cached);
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL });
    return offline ? servable(offline) : new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function handleAsset(event) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(event.request);
  const network = fetch(event.request)
    .then((response) => {
      if (response.ok && response.type === "basic") cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  if (cached) {
    event.waitUntil(network.then(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isFrameworkData(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(handlePage(event, url));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(handleAsset(event));
});
