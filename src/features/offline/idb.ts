"use client";

import type { QueueStore } from "./queue";
import { OFFLINE_DB, OFFLINE_DB_VERSION, OFFLINE_STORE, type QueueItem } from "./types";

// A dozen lines of IndexedDB instead of a dependency. The service worker
// opens the same database (public/sw.js) for Background Sync.

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) db.createObjectStore(OFFLINE_STORE, { keyPath: "clientId" }).createIndex("userId", "userId");
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema closes this connection cleanly.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, mode);
    const req = fn(tx.objectStore(OFFLINE_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idbStore: QueueStore = {
  all: () => run("readonly", (s) => s.getAll() as IDBRequest<QueueItem[]>),
  get: (id) => run("readonly", (s) => s.get(id) as IDBRequest<QueueItem | undefined>),
  put: async (item) => void (await run("readwrite", (s) => s.put(item))),
  delete: async (id) => void (await run("readwrite", (s) => s.delete(id))),
};

export const hasIndexedDb = () => typeof indexedDB !== "undefined";
