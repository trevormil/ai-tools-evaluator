import { createRequire } from "node:module";
// Type-only surface: importing the better-sqlite3 ORM adapter is pure JS (no
// native dlopen — only `new Database()` from better-sqlite3 loads the addon), so
// it is safe to reference for typing even under the bun runner.
import type { drizzle as drizzleBetter } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export * as schema from "./schema";
export * from "./schema";

/** Path to the SQLite file. In k8s this lives on a PVC mounted by the web pod. */
export const DB_PATH = process.env.AIX_DB_PATH ?? "./aix.db";

/** Resolve the DB path live so tests that set AIX_DB_PATH after import are honored. */
function dbPath(): string {
  return process.env.AIX_DB_PATH ?? "./aix.db";
}

type DbClient = ReturnType<typeof drizzleBetter<typeof schema>>;
let _db: DbClient | null = null;
let _dbPath: string | null = null;

const require = createRequire(import.meta.url);

/**
 * Singleton Drizzle client backed by SQLite with WAL enabled. Only the web app
 * opens SQLite — the scanner/bot are pure API clients.
 *
 * Two drivers, one query surface: the web app runs on the **Node runtime**, where
 * `better-sqlite3` (a native N-API addon) is used — it stopped the Next-on-Bun
 * RSS leak. Under the **bun test runner** `better-sqlite3` can't `dlopen`
 * (oven-sh/bun#4290), so we fall back to `bun:sqlite`. Both go through Drizzle
 * with the same schema, so tests exercise the real query layer.
 */
export function getDb() {
  const path = dbPath();
  // Cache-key on the path: production opens once (constant path); tests that
  // point AIX_DB_PATH at a fresh file get a fresh connection instead of the
  // first file's cached handle (cross-file pollution under the bun runner).
  if (_db && _dbPath === path) return _db;
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";

  if (isBun) {
    const { Database } = require("bun:sqlite");
    const { drizzle } = require("drizzle-orm/bun-sqlite");
    const sqlite = new Database(path);
    sqlite.exec("PRAGMA journal_mode = WAL");
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec("PRAGMA busy_timeout = 5000");
    // Same schema + query surface as the better-sqlite3 client; cast so consumers
    // keep the one production-driver type.
    _db = drizzle(sqlite, { schema }) as unknown as DbClient;
    _dbPath = path;
    return _db;
  }

  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  _db = drizzle(sqlite, { schema }) as DbClient;
  _dbPath = path;
  return _db;
}

export type Db = ReturnType<typeof getDb>;
