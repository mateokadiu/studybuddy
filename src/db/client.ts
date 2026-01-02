/**
 * SQLite client backed by react-native-quick-sqlite, wrapped with the
 * drizzle-orm proxy driver so the rest of the codebase talks to a typed
 * drizzle handle. The native dep is required lazily so the module can
 * also be imported by node-side tooling (drizzle-kit, vitest).
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type * as Schema from './schema';

const DB_NAME = 'studybuddy.db';

type SqlRow = Record<string, unknown>;

type DriverResult = { rows: SqlRow[]; rowsAffected?: number; insertId?: number };

type SqlDriver = {
  executeAsync(sql: string, params?: unknown[]): Promise<DriverResult>;
  executeBatchAsync(commands: { sql: string; args?: unknown[] }[]): Promise<void>;
};

let cachedDriver: SqlDriver | null = null;

function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function loadDriver(): SqlDriver {
  if (cachedDriver) return cachedDriver;

  if (isNode()) {
    // Node-side: provide a tiny in-memory shim that holds no rows.
    // The real app loads quick-sqlite; node-side tooling never opens this.
    cachedDriver = {
      async executeAsync() {
        return { rows: [], rowsAffected: 0 };
      },
      async executeBatchAsync() {
        /* no-op */
      },
    };
    return cachedDriver;
  }

  // dynamic require so node doesn't try to resolve the native module
  const mod = require('react-native-quick-sqlite') as {
    open: (cfg: { name: string }) => {
      executeAsync: (sql: string, params?: unknown[]) => Promise<{ rows?: { _array: SqlRow[] }; rowsAffected?: number; insertId?: number }>;
      executeBatchAsync: (cmds: { sql: string; args?: unknown[] }[]) => Promise<void>;
    };
  };
  const conn = mod.open({ name: DB_NAME });

  cachedDriver = {
    async executeAsync(sql, params) {
      const r = await conn.executeAsync(sql, params);
      return { rows: r.rows?._array ?? [], rowsAffected: r.rowsAffected, insertId: r.insertId };
    },
    async executeBatchAsync(cmds) {
      await conn.executeBatchAsync(cmds);
    },
  };
  return cachedDriver;
}

export type Db = ReturnType<typeof buildDb>;

function buildDb() {
  const driver = loadDriver();
  return drizzle(
    async (sql: string, params: unknown[], _method: string) => {
      const { rows } = await driver.executeAsync(sql, params);
      // sqlite-proxy expects { rows: unknown[][] } shaped like raw column tuples
      const tuples = rows.map((row) => Object.values(row));
      return { rows: tuples };
    },
    { logger: false },
  );
}

let cachedDb: Db | null = null;

export function getDb(): Db {
  if (!cachedDb) cachedDb = buildDb();
  return cachedDb;
}

/** Test/diagnostic hook — drop the cached driver + db. */
export function _resetDbForTests(): void {
  cachedDriver = null;
  cachedDb = null;
}

export { DB_NAME };
export type { Schema };
