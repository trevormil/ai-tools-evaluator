import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb } from "./index";

// The migrator must match the driver getDb() picked (see ./index): better-sqlite3
// on the Node runtime, bun:sqlite under bun (e.g. the e2e migrate step).
const require = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
const { migrate } = (
  isBun
    ? require("drizzle-orm/bun-sqlite/migrator")
    : require("drizzle-orm/better-sqlite3/migrator")
) as { migrate: (db: unknown, cfg: { migrationsFolder: string }) => void };

/** Apply all generated SQL migrations. Idempotent — safe to run on every boot. */
export function runMigrations() {
  const here = dirname(fileURLToPath(import.meta.url));
  migrate(getDb(), { migrationsFolder: join(here, "..", "migrations") });
}

if (import.meta.main) {
  runMigrations();
  console.log("migrations applied");
}
