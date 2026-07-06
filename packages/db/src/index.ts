import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

export * as schema from "./schema";
export * from "./schema";

/** Path to the SQLite file. In k8s this lives on a PVC mounted by the web pod. */
export const DB_PATH = process.env.AIX_DB_PATH ?? "./aix.db";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Singleton Drizzle client backed by bun:sqlite with WAL enabled. */
export function getDb() {
  if (_db) return _db;
  const sqlite = new Database(DB_PATH, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  _db = drizzle(sqlite, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
