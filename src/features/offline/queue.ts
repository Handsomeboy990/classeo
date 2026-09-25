// The device queue of entries typed without network. Pure logic over a small
// storage interface: IndexedDB in the browser (idb.ts), a Map in the tests
// (queue.test.ts).
//
// Rules:
// - every entry belongs to one account; lists and replays only ever see the
//   entries of the signed in account;
// - signing out seals the entries (kept, never replayed nor shown to another
//   account); the same account signing in again unseals its own;
// - nothing is deleted without a decision: an entry leaves the queue when
//   the server applied it, or when the user discards it.

import type { BaselineOf, OfflineKind, PayloadOf, QueueItem, ReplayOutcome } from "./types";

export type QueueStore = {
  all(): Promise<QueueItem[]>;
  get(clientId: string): Promise<QueueItem | undefined>;
  put(item: QueueItem): Promise<void>;
  delete(clientId: string): Promise<void>;
};

export type NewEntry<K extends OfflineKind> = {
  clientId: string;
  userId: string;
  kind: K;
  target: string;
  payload: PayloadOf<K>;
  baseline: BaselineOf<K>;
  page: string;
  label: string;
};

export async function enqueue<K extends OfflineKind>(store: QueueStore, entry: NewEntry<K>, now = Date.now()): Promise<QueueItem<K>> {
  const item: QueueItem<K> = { ...entry, createdAt: now, updatedAt: now, status: "pending", sealed: false, attempts: 0 };
  await store.put(item as QueueItem);
  return item;
}

const byAge = (a: QueueItem, b: QueueItem) => a.createdAt - b.createdAt;

// Entries of one account, oldest first. Sealed entries stay hidden until the
// account signs in again.
export async function entriesOf(store: QueueStore, userId: string) {
  return (await store.all()).filter((i) => i.userId === userId && !i.sealed).sort(byAge);
}

export async function entriesFor(store: QueueStore, userId: string, kind: OfflineKind, target: string) {
  return (await entriesOf(store, userId)).filter((i) => i.kind === kind && i.target === target);
}

// An entry left "sending" by a page closed mid request is sent again: the
// server answers a duplicate without writing twice.
export async function replayable(store: QueueStore, userId: string, now = Date.now(), staleSendingMs = 60_000) {
  return (await entriesOf(store, userId)).filter((i) => i.status === "pending" || (i.status === "sending" && now - i.updatedAt > staleSendingMs));
}

export function counts(items: QueueItem[]) {
  return {
    pending: items.filter((i) => i.status !== "rejected").length,
    rejected: items.filter((i) => i.status === "rejected").length,
  };
}

async function update(store: QueueStore, clientId: string, patch: Partial<QueueItem>, now = Date.now()) {
  const item = await store.get(clientId);
  if (!item) return undefined;
  const next = { ...item, ...patch, updatedAt: now } as QueueItem;
  await store.put(next);
  return next;
}

export const markSending = (store: QueueStore, clientId: string, now = Date.now()) => update(store, clientId, { status: "sending" }, now);

// Applies the server's answer to an entry. Returns what the interface
// should tell the user.
export async function settle(store: QueueStore, item: QueueItem, outcome: ReplayOutcome, now = Date.now()): Promise<"applied" | "rejected" | "kept"> {
  switch (outcome.outcome) {
    case "applied":
      await store.delete(item.clientId);
      return "applied";
    case "rejected":
      await update(store, item.clientId, { status: "rejected", error: outcome.reason, attempts: item.attempts + 1 }, now);
      return "rejected";
    case "other-user":
      // The session belongs to another account: the entry waits, sealed.
      await update(store, item.clientId, { status: "pending", sealed: true }, now);
      return "kept";
    default:
      await update(store, item.clientId, { status: "pending", attempts: item.attempts + 1 }, now);
      return "kept";
  }
}

// The user dropped a refused entry, or resent it corrected (the new send
// carries a new identifier). Only the owner can remove it.
export async function discard(store: QueueStore, userId: string, clientId: string) {
  const item = await store.get(clientId);
  if (item && item.userId === userId) await store.delete(clientId);
}

export async function sealAll(store: QueueStore, now = Date.now()) {
  for (const item of await store.all()) if (!item.sealed) await store.put({ ...item, sealed: true, status: item.status === "sending" ? "pending" : item.status, updatedAt: now });
}

export async function unseal(store: QueueStore, userId: string, now = Date.now()) {
  for (const item of await store.all()) if (item.sealed && item.userId === userId) await store.put({ ...item, sealed: false, updatedAt: now });
}

// Values to put back on a page: pending entries show as waiting, refused
// ones are restored for correction. Oldest first, so a later entry of the
// same cell wins.
export function draftsOf<K extends OfflineKind>(items: QueueItem[], kind: K, target: string) {
  const mine = items.filter((i): i is QueueItem<K> => i.kind === kind && i.target === target).sort(byAge);
  return { pending: mine.filter((i) => i.status !== "rejected"), rejected: mine.filter((i) => i.status === "rejected") };
}

export function memoryStore(initial: QueueItem[] = []): QueueStore {
  const map = new Map(initial.map((i) => [i.clientId, i]));
  return {
    all: async () => [...map.values()],
    get: async (id) => map.get(id),
    put: async (item) => void map.set(item.clientId, item),
    delete: async (id) => void map.delete(id),
  };
}
