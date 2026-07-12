import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb } from "./index";

/** Apply all generated SQL migrations. Idempotent — safe to run on every boot. */
export function runMigrations() {
  const here = dirname(fileURLToPath(import.meta.url));
  migrate(getDb(), { migrationsFolder: join(here, "..", "migrations") });
}

if (import.meta.main) {
  runMigrations();
  console.log("migrations applied");
}
