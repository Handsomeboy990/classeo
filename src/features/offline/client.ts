"use client";

import { useSyncExternalStore } from "react";

import { toast } from "@/components/kit/toaster";

import { hasIndexedDb, idbStore } from "./idb";
import { discard, enqueue, entriesOf, markSending, replayable, sealAll, settle, unseal, type NewEntry } from "./queue";
import { SYNC_TAG, type OfflineKind, type QueueItem, type ReplayOutcome } from "./types";

// Browser side of the offline queue: which account is signed in, the live
// list of its entries for the interface, the replay loop and the helper the
// forms call instead of their server action.

let userId: string | null = null;
let entries: QueueItem[] = [];
const listeners = new Set<() => void>();
const appliedListeners = new Set<() => void>();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("classeo-offline") : null;

function emit() {
  listeners.forEach((l) => l());
}

async function reload() {
  entries = userId && hasIndexedDb() ? await entriesOf(idbStore, userId).catch(() => []) : [];
  emit();
}

// Other tabs and the service worker announce their changes here.
channel?.addEventListener("message", () => void reload());
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "offline-queue-changed") void reload();
    if (event.data?.type === "offline-replay") void syncNow();
  });
}

function changed() {
  channel?.postMessage("changed");
  return reload();
}

export async function setOfflineUser(id: string) {
  if (userId === id) return;
  userId = id;
  if (hasIndexedDb()) await unseal(idbStore, id).catch(() => undefined);
  await reload();
}

// Sign in page: no account is signed in. Every entry is kept but sealed.
export async function sealOfflineQueue() {
  userId = null;
  if (hasIndexedDb()) await sealAll(idbStore).catch(() => undefined);
  await changed();
}

const EMPTY: QueueItem[] = [];

export function useOfflineEntries(): QueueItem[] {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => entries,
    () => EMPTY,
  );
}

export function onReplayApplied(listener: () => void) {
  appliedListeners.add(listener);
  return () => void appliedListeners.delete(listener);
}

export function newClientId() {
  return crypto.randomUUID();
}

type Entry<K extends OfflineKind> = Omit<NewEntry<K>, "userId" | "clientId">;

export async function queueEntry<K extends OfflineKind>(entry: Entry<K>, clientId = newClientId()) {
  if (!userId || !hasIndexedDb()) return false;
  await enqueue(idbStore, { ...entry, clientId, userId });
  await changed();
  // Background Sync (Chrome, Edge, Android): the service worker replays the
  // queue when the network returns, even after the page is closed.
  navigator.serviceWorker?.ready
    .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register(SYNC_TAG))
    .catch(() => undefined);
  return true;
}

export async function discardEntry(clientId: string) {
  if (!userId) return;
  await discard(idbStore, userId, clientId);
  await changed();
}

// Sends through the online server action; without network the entry is
// queued instead. A server action that cannot reach the server rejects:
// that is the signal. The same identifier travels with the queued entry, so
// a request that reached the server before the connection dropped is not
// written twice.
export async function sendOrQueue<K extends OfflineKind, R>(entry: Entry<K>, send: (clientId: string) => Promise<R>): Promise<{ queued: true } | { queued: false; result: R }> {
  const clientId = newClientId();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (await queueEntry(entry, clientId)) return { queued: true };
  }
  try {
    return { queued: false, result: await send(clientId) };
  } catch (error) {
    if (await queueEntry(entry, clientId)) return { queued: true };
    throw error;
  }
}

async function post(item: QueueItem): Promise<ReplayOutcome | null> {
  try {
    const response = await fetch("/api/offline/replay", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: item.clientId, userId: item.userId, kind: item.kind, payload: item.payload, baseline: item.baseline, createdAt: item.createdAt }),
    });
    const body = (await response.json().catch(() => null)) as ReplayOutcome | null;
    if (body && typeof body.outcome === "string") return body;
    return { outcome: "retry" };
  } catch {
    // Still no network: stop here, the next trigger tries again.
    return null;
  }
}

let running: Promise<void> | null = null;

// Replays the pending entries of the signed in account, oldest first. One
// loop per tab, and one tab at a time where Web Locks exist; the server
// answers a duplicate anyway.
export function syncNow(): Promise<void> {
  if (!userId || !hasIndexedDb() || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve();
  running ??= (async () => {
    try {
      const locks = (navigator as Navigator & { locks?: LockManager }).locks;
      if (locks) await locks.request("classeo-offline-replay", { ifAvailable: true }, async (lock) => (lock ? replayAll() : undefined));
      else await replayAll();
    } finally {
      running = null;
    }
  })();
  return running;
}

async function replayAll() {
  const owner = userId;
  if (!owner) return;
  const items = await replayable(idbStore, owner);
  if (!items.length) return;
  let applied = 0;
  let refused = 0;
  let askedToSignIn = false;
  for (const item of items) {
    if (userId !== owner) break;
    await markSending(idbStore, item.clientId);
    const outcome = await post(item);
    if (!outcome) {
      await settle(idbStore, item, { outcome: "retry" });
      break;
    }
    const result = await settle(idbStore, item, outcome);
    if (result === "applied") applied++;
    if (result === "rejected") refused++;
    if (result === "rejected" && outcome.outcome === "rejected") toast("error", `Saisie refusée, ${item.label} : ${outcome.reason} Vos valeurs sont gardées dans « À revoir ».`);
    if (outcome.outcome === "auth") askedToSignIn = true;
    if (outcome.outcome === "auth" || outcome.outcome === "retry") break;
  }
  await changed();
  if (applied) toast("success", applied > 1 ? `${applied} saisies faites hors ligne ont été enregistrées.` : "Votre saisie faite hors ligne a été enregistrée.");
  // Fresh data either way: the saved values, or the current ones to compare
  // a refused entry with.
  if (applied || refused) appliedListeners.forEach((l) => l());
  if (askedToSignIn) toast("error", "Reconnectez-vous pour envoyer les saisies en attente. Elles restent gardées sur cet appareil.");
}

// ---------------------------------------------------------------------------
// Pages kept for offline use (downloaded by the service worker).
// ---------------------------------------------------------------------------

export type OfflinePage = { url: string; title: string | null; heading?: string | null; detail?: string | null; at: number };
export type OfflineState = {
  userId: string;
  updatedAt: number;
  pages: OfflinePage[];
  running?: boolean;
  complete?: boolean;
  saveData?: boolean;
  stopped?: "budget" | "network" | "session" | null;
};

let pagesRequest: { userId: string; urls: string[] } | null = null;

function saveDataOn() {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

// Asks the service worker to download the key pages of the account. It
// skips the work when they are recent, unless forced from the preferences.
export async function requestOfflinePages(request?: { userId: string; urls: string[] }, force = false) {
  if (request) pagesRequest = request;
  if (!pagesRequest || !("serviceWorker" in navigator)) return false;
  // Resolves once the worker is active (never in development, where it is
  // not registered).
  const worker = (await navigator.serviceWorker.ready).active;
  if (!worker) return false;
  worker.postMessage({ type: "precache", userId: pagesRequest.userId, urls: pagesRequest.urls, force, saveData: saveDataOn() });
  return true;
}

export function isDataSaverOn() {
  return typeof navigator !== "undefined" && saveDataOn();
}

// The state the service worker keeps in its meta cache.
export async function readOfflineState(): Promise<OfflineState | null> {
  if (typeof caches === "undefined") return null;
  const name = (await caches.keys()).filter((k) => k.startsWith("classeo-meta-")).sort().pop();
  if (!name) return null;
  const hit = await (await caches.open(name)).match("/__classeo/offline-state");
  return hit ? ((await hit.json().catch(() => null)) as OfflineState | null) : null;
}
