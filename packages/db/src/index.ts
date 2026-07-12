import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export * as schema from "./schema";
export * from "./schema";

/** Path to the SQLite file. In k8s this lives on a PVC mounted by the web pod. */
export const DB_PATH = process.env.AIX_DB_PATH ?? "./aix.db";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Singleton Drizzle client backed by better-sqlite3 with WAL enabled.
 * The web app runs on the Node runtime (better-sqlite3 is a native N-API addon);
 * this replaced bun:sqlite to stop the Next-on-Bun RSS leak. Only the web app
 * opens SQLite — the scanner/bot are pure API clients.
 */
export function getDb() {
  if (_db) return _db;
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  _db = drizzle(sqlite, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
