/**
 * MMKV wrapper.
 *
 * In production: backed by react-native-mmkv (sync, persistent, ~10x faster
 *   than AsyncStorage; fine for the few-kB of settings + ui state we keep).
 * In dev / node-tooling: backed by an in-memory Map so vitest + drizzle-kit
 *   can import modules that touch storage without the native dep.
 *
 * Exposes a zustand-compatible `persist` storage adapter via mmkvStorage().
 */

const STORAGE_ID = 'studybuddy.kv';

type KVDriver = {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  delete(key: string): void;
  clearAll(): void;
};

function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

let cachedDriver: KVDriver | null = null;

function loadDriver(): KVDriver {
  if (cachedDriver) return cachedDriver;

  if (isNode()) {
    const mem = new Map<string, string>();
    cachedDriver = {
      set: (k, v) => {
        mem.set(k, v);
      },
      getString: (k) => mem.get(k),
      delete: (k) => {
        mem.delete(k);
      },
      clearAll: () => mem.clear(),
    };
    return cachedDriver;
  }

  const { MMKV } = require('react-native-mmkv') as { MMKV: new (cfg: { id: string }) => KVDriver };
  cachedDriver = new MMKV({ id: STORAGE_ID });
  return cachedDriver;
}

/** Read a raw string. */
export function kvGet(key: string): string | undefined {
  return loadDriver().getString(key);
}

/** Write a raw string. */
export function kvSet(key: string, value: string): void {
  loadDriver().set(key, value);
}

/** Delete a single key. */
export function kvDel(key: string): void {
  loadDriver().delete(key);
}

/** Wipe everything (danger zone). */
export function kvClearAll(): void {
  loadDriver().clearAll();
}

/** Read + parse JSON, or return `fallback` if missing/invalid. */
export function kvGetJson<T>(key: string, fallback: T): T {
  const raw = kvGet(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Stringify + write JSON. */
export function kvSetJson<T>(key: string, value: T): void {
  kvSet(key, JSON.stringify(value));
}

/** zustand/persist-compatible storage. */
export function mmkvStorage() {
  return {
    getItem: (name: string): string | null => kvGet(name) ?? null,
    setItem: (name: string, value: string): void => kvSet(name, value),
    removeItem: (name: string): void => kvDel(name),
  };
}

/** Test/diagnostic hook. */
export function _resetKvForTests(): void {
  cachedDriver = null;
}
