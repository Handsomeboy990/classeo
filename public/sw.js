/*
 * Classéo service worker. Hand written, no library.
 *
 * - Pages: network first. Private pages are kept in a cache of the signed in
 *   account only (classeo-user-<version>-<account id>), after checking that
 *   the page was rendered for that account (data-offline-user marker). Any
 *   other page falls back to /hors-ligne when the network is down.
 * - After sign in the page sends the list of the key pages of the account's
 *   role; they are downloaded in the background, one at a time, with a low
 *   priority and a size budget, even if never opened (see precachePages).
 * - Static assets (scripts, styles, fonts, icons): stale while revalidate.
 * - Never cached: anything that is not GET (server actions are POST), React
 *   Server Component payloads, prefetches, API routes, development
 *   endpoints, other origins.
 * - Private copies are deleted when the sign in page is reached (sign out,
 *   expired session, account switch).
 * - Entries typed offline wait in IndexedDB (src/features/offline); Background
 *   Sync replays them when the network returns (see replayQueue).
 * - Caches are versioned: a new VERSION removes the previous ones.
 * - Push notifications are shown here and open their link when touched.
 */

const VERSION = "2026-09-26.2";
const SHELL = `classeo-shell-${VERSION}`;
const ASSETS = `classeo-assets-${VERSION}`;
const META = `classeo-meta-${VERSION}`;
const USER_PREFIX = `classeo-user-${VERSION}-`;
const CURRENT = [SHELL, ASSETS, META];
const OFFLINE_URL = "/hors-ligne";
const PRECACHE = [OFFLINE_URL, "/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest"];
const STATE_KEY = "/__classeo/offline-state";
const MAX_PAGES = 80;
// Background download budget per account: pages and the scripts they need.
const BUDGET_BYTES = 6 * 1024 * 1024;
// Key pages are downloaded again at most this often.
const REFRESH_MS = 30 * 60 * 1000;
const USER_MARKER = /data-offline-user="([\w-]{1,64})"/;

// The offline page must render with no network at all: keep its HTML and
// every script and stylesheet it references.
async function precache() {
  const shell = await caches.open(SHELL);
  await shell.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })));
  const html = await (await shell.match(OFFLINE_URL)).text();
  await (await caches.open(ASSETS)).addAll(assetsOf(html));
}

function assetsOf(html) {
  return [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("classeo-") && !CURRENT.includes(k) && !k.startsWith(USER_PREFIX)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* ---------------------------------------------------------------------------
 * Account state: which account the private cache belongs to, and what was
 * downloaded for it. Stored in a cache entry so it survives the worker
 * being stopped.
 * ------------------------------------------------------------------------ */

async function readState() {
  const hit = await (await caches.open(META)).match(STATE_KEY);
  return hit ? hit.json().catch(() => null) : null;
}

async function writeState(state) {
  await (await caches.open(META)).put(STATE_KEY, new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }));
  const windows = await self.clients.matchAll({ type: "window" });
  for (const w of windows) w.postMessage({ type: "offline-precache", state });
}

function userCache(userId) {
  return USER_PREFIX + userId;
}

async function purgePrivate() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("classeo-user-") || k.startsWith("classeo-pages-")).map((k) => caches.delete(k)));
  await (await caches.open(META)).delete(STATE_KEY);
}

// A page rendered for another account than the one the private cache
// belongs to means the account changed: the previous copies go.
async function switchTo(userId) {
  const state = await readState();
  if (state && state.userId === userId) return state;
  await purgePrivate();
  const fresh = { userId, updatedAt: 0, pages: [], running: false };
  await writeState(fresh);
  return fresh;
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "purge-private") event.waitUntil(purgePrivate());
  if (data.type === "precache" && typeof data.userId === "string" && Array.isArray(data.urls)) {
    event.waitUntil(precachePages(data.userId, data.urls, { force: data.force === true, saveData: data.saveData === true }));
  }
});

function isPrivatePage(pathname) {
  return pathname === "/espace" || pathname.startsWith("/espace/");
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
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs")
  );
}

// A response that went through a redirect cannot answer a navigation: copy it.
function servable(response) {
  if (!response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function trim(cacheName, max, keep) {
  const cache = await caches.open(cacheName);
  const keys = (await cache.keys()).filter((k) => !keep.has(new URL(k.url).pathname + new URL(k.url).search));
  const over = keys.length - max;
  if (over > 0) await Promise.all(keys.slice(0, over).map((k) => cache.delete(k)));
}

function plain(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;|&#xa0;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

// Names a kept page for the lists: its title, its heading and the line
// under it (the class and the day of a register, the subject of a sheet).
function pageInfo(html) {
  const title = html.match(/<title>([^<]{1,200})<\/title>/);
  const main = html.match(/<main[\s\S]*$/);
  const heading = main && main[0].match(/<h1[^>]*>([\s\S]{1,400}?)<\/h1>\s*(?:<p[^>]*>([\s\S]{1,400}?)<\/p>)?/);
  return {
    title: title ? plain(title[1]).replace(/ · Classéo$/, "") : null,
    heading: heading ? plain(heading[1]) : null,
    detail: heading && heading[2] ? plain(heading[2]) : null,
  };
}

// Keeps a private page only when it was rendered for the account the
// private cache belongs to.
async function keepPrivate(key, response) {
  const html = await response.clone().text();
  const marker = html.match(USER_MARKER);
  if (!marker) return;
  const state = await switchTo(marker[1]);
  const cache = await caches.open(userCache(state.userId));
  await cache.put(key, response);
  await trim(userCache(state.userId), MAX_PAGES, new Set(state.pages.map((p) => p.url)));
}

async function handlePage(event, url) {
  try {
    const response = await fetch(event.request);
    if (url.pathname === "/connexion" && response.ok) {
      // Reaching the sign in page means no session: drop private copies.
      event.waitUntil(purgePrivate());
    } else if (response.ok && response.type === "basic" && !response.redirected) {
      if (isPrivatePage(url.pathname)) {
        event.waitUntil(keepPrivate(url.pathname + url.search, response.clone()).catch(() => undefined));
      } else if (isPublicPage(url.pathname)) {
        const copy = response.clone();
        event.waitUntil(caches.open(SHELL).then((cache) => cache.put(url.pathname, copy)));
      }
    }
    return response;
  } catch {
    const key = url.pathname + url.search;
    const state = await readState();
    const own = state && isPrivatePage(url.pathname) ? await caches.match(key, { cacheName: userCache(state.userId) }) : null;
    const cached = own || (await caches.match(url.pathname, { cacheName: SHELL }));
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

/* ---------------------------------------------------------------------------
 * Key pages downloaded after sign in (list from src/features/offline/pages.ts).
 * One page at a time, low priority, within a size budget. With data saver on,
 * only the dashboard is downloaded unless the user asks for all of it.
 * ------------------------------------------------------------------------ */

let precaching = null;

function precachePages(userId, urls, options) {
  precaching = (precaching || Promise.resolve()).then(() => downloadPages(userId, urls, options)).catch(() => undefined);
  return precaching;
}

function sameList(a, b) {
  return a.length === b.length && a.every((u, i) => u === b[i]);
}

async function downloadPages(userId, rawUrls, { force, saveData }) {
  const urls = rawUrls.filter((u) => typeof u === "string" && isPrivatePage(new URL(u, self.location.origin).pathname) && u.startsWith("/")).slice(0, 60);
  let state = await switchTo(userId);
  const fresh = Date.now() - (state.updatedAt || 0) < REFRESH_MS;
  if (!force && fresh && state.complete && sameList(state.requested || [], urls)) return;

  const wanted = saveData && !force ? urls.slice(0, 1) : urls;
  const cache = await caches.open(userCache(userId));
  const assets = await caches.open(ASSETS);
  const pages = [];
  let bytes = 0;
  let stopped = null;
  state = { ...state, running: true, requested: urls, saveData: saveData && !force };
  await writeState(state);

  for (const url of wanted) {
    if (bytes > BUDGET_BYTES) {
      stopped = "budget";
      break;
    }
    let response;
    try {
      response = await fetch(url, { credentials: "same-origin", cache: "no-store", priority: "low", redirect: "follow" });
    } catch {
      stopped = "network";
      break;
    }
    // Redirected to the sign in page: the session ended, nothing to keep.
    if (response.redirected || response.type !== "basic") {
      stopped = "session";
      break;
    }
    if (!response.ok) continue;
    const html = await response.text();
    const marker = html.match(USER_MARKER);
    if (!marker || marker[1] !== userId) {
      stopped = "session";
      break;
    }
    bytes += html.length;
    await cache.put(url, new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    // The scripts and styles the page needs to come alive without network.
    for (const asset of assetsOf(html)) {
      if (await assets.match(asset)) continue;
      try {
        const res = await fetch(asset, { priority: "low" });
        if (res.ok) {
          const blob = await res.clone().blob();
          bytes += blob.size;
          await assets.put(asset, res);
        }
      } catch {
        stopped = "network";
        break;
      }
    }
    pages.push({ url, ...pageInfo(html), at: Date.now() });
    await writeState({ ...state, pages: mergePages(state.pages, pages) });
    if (stopped) break;
  }

  // Pages downloaded earlier that are no longer in the list go.
  const keep = new Set(urls);
  const merged = mergePages(state.pages, pages).filter((p) => keep.has(p.url));
  await writeState({ ...state, running: false, complete: !stopped && wanted.length === urls.length, stopped, updatedAt: Date.now(), pages: merged });
}

function mergePages(before, after) {
  const map = new Map((before || []).map((p) => [p.url, p]));
  for (const p of after) map.set(p.url, p);
  return [...map.values()];
}

/* ---------------------------------------------------------------------------
 * Background Sync. An open window replays the queue itself (it can show the
 * results); with no window open the worker sends the pending entries of the
 * signed in account through the same route. Refused entries stay in the
 * queue with their reason, for the "À revoir" list.
 * ------------------------------------------------------------------------ */

const OFFLINE_DB = "classeo-offline";
const OFFLINE_STORE = "items";

self.addEventListener("sync", (event) => {
  if (event.tag === "classeo-replay") event.waitUntil(replayQueue());
});

function openQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) db.createObjectStore(OFFLINE_STORE, { keyPath: "clientId" }).createIndex("userId", "userId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function queueOp(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, mode);
    const req = fn(tx.objectStore(OFFLINE_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function replayQueue() {
  const windows = await self.clients.matchAll({ type: "window" });
  if (windows.length) {
    for (const w of windows) w.postMessage({ type: "offline-replay" });
    return;
  }
  const state = await readState();
  if (!state || !state.userId) return;
  const db = await openQueue();
  const items = (await queueOp(db, "readonly", (s) => s.getAll()))
    .filter((i) => i.userId === state.userId && !i.sealed && i.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const item of items) {
    let outcome;
    try {
      const res = await fetch("/api/offline/replay", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: item.clientId, userId: item.userId, kind: item.kind, payload: item.payload, baseline: item.baseline, createdAt: item.createdAt }),
      });
      outcome = await res.json();
    } catch {
      // Still offline: the browser fires the sync event again later.
      throw new Error("offline");
    }
    const now = Date.now();
    if (outcome.outcome === "applied") await queueOp(db, "readwrite", (s) => s.delete(item.clientId));
    else if (outcome.outcome === "rejected") await queueOp(db, "readwrite", (s) => s.put({ ...item, status: "rejected", error: outcome.reason, attempts: item.attempts + 1, updatedAt: now }));
    else if (outcome.outcome === "other-user") await queueOp(db, "readwrite", (s) => s.put({ ...item, sealed: true, updatedAt: now }));
    else break;
  }
}

/*
 * Push notifications (see src/lib/channels/push.ts). The payload carries a
 * title, a body, a link inside the private space and a tag: a newer
 * notification of the same kind replaces the previous one.
 */

// Status bar badge: white silhouette of the logo on a transparent 96 px
// square, as Android requires. Inlined so it needs no request.
const BADGE = "data:image/png;base64,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";

function safeLink(link) {
  return typeof link === "string" && /^\/espace(\/[\w\-/]*)?(\?[\w\-=&%]*)?$/.test(link) ? link : "/espace/notifications";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // Sound: a web page cannot choose the sound of a system notification.
  // silent: false asks for the device's own notification sound, the one the
  // person chose in the phone's settings; Android also vibrates with the
  // short pattern below. An open Classéo window is told at once, so it
  // plays its own soft chime and updates its counters.
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Classéo", {
        body: data.body || "Une nouvelle notification vous attend.",
        icon: "/icons/icon-192.png",
        badge: BADGE,
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        silent: false,
        vibrate: [120, 60, 120],
        lang: "fr",
        data: { link: safeLink(data.link) },
      }),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windows) => windows.forEach((w) => w.postMessage({ type: "push-received" }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safeLink(event.notification.data && event.notification.data.link), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // An open Classéo window is reused: brought to the front, then sent to the link.
      const client = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        const focused = await client.focus();
        if (focused.url !== target && "navigate" in focused) await focused.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
