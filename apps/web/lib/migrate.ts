import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getDb } from "@aix/db";

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
    throw new Error(
      `Could not locate packages/db/migrations from cwd=${process.cwd()}`,
    );
  }
  migrate(getDb(), { migrationsFolder: folder });
}
