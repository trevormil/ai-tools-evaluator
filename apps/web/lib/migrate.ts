import { createRequire } from "node:module";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getDb } from "@aix/db";

// The migrator must match the driver getDb() picked: better-sqlite3 on the Node
// runtime, bun:sqlite under the bun test runner (see @aix/db getDb).
const require = createRequire(import.meta.url);
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
// Literal requires (not a computed expression) so the bundler can extract them.
const { migrate } = (
  isBun
    ? require("drizzle-orm/bun-sqlite/migrator")
    : require("drizzle-orm/better-sqlite3/migrator")
) as { migrate: (db: unknown, cfg: { migrationsFolder: string }) => void };

/**
 * Apply the Drizzle migrations that live in `packages/db/migrations`. Run once at
 * server startup (see `instrumentation.ts`). Idempotent — Drizzle tracks applied
 * migrations in its own bookkeeping table, so re-running on every boot is safe.
 *
 * We can't import `@aix/db/src/migrate` (not exported from the package's public
 * surface) and we must stay inside `apps/web`, so we point the migrator at the
 * sibling package's migrations folder ourselves.
 */
export function runMigrations(): void {
  const candidates = [
    join(process.cwd(), "..", "..", "packages", "db", "migrations"),
    join(process.cwd(), "packages", "db", "migrations"),
  ];
  const folder = candidates.find((p) => existsSync(p));
  if (!folder) {
    throw new Error(`Could not locate packages/db/migrations from cwd=${process.cwd()}`);
  }
  migrate(getDb(), { migrationsFolder: folder });
}
