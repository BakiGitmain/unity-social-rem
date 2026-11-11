"use client";

/**
 * Tiny IndexedDB key-value store for Answer Paper ink (vector data) and AI reads (cache).
 * Falls back to memory when IndexedDB is blocked (private mode).
 */
const DB = "usr-ink";
const STORES = ["docs", "reads"] as const;
type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, unknown>();

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => STORES.forEach((s) => req.result.objectStoreNames.contains(s) || req.result.createObjectStore(s));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.get(`${store}:${key}`) as T | undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) return void memory.set(`${store}:${key}`, value);
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      if (value === undefined) tx.objectStore(store).delete(key);
      else tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
