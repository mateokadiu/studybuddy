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

  // react-native-mmkv v4 ships `createMMKV` (factory) and dropped the `MMKV`
  // class export. Earlier versions had `new MMKV(...)`. Support both.
  const mod = require('react-native-mmkv') as {
    createMMKV?: (cfg: { id: string }) => KVDriver;
    MMKV?: new (cfg: { id: string }) => KVDriver;
  };
  if (mod.createMMKV) {
    cachedDriver = mod.createMMKV({ id: STORAGE_ID });
  } else if (mod.MMKV) {
    cachedDriver = new mod.MMKV({ id: STORAGE_ID });
  } else {
    throw new Error('react-native-mmkv: neither createMMKV nor MMKV export found');
  }
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
