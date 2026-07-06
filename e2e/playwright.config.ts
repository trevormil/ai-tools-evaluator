import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a real, seeded build of the web app. The webServer command does
 * ALL DB prep (migrate + seed + test user/session) BEFORE `next start`, so the
 * server opens an already-seeded DB — seeding after boot would leave the server
 * with a stale handle to a replaced file. Dedicated port/DB avoids collisions.
 */
export const E2E_DB = "/tmp/aix-e2e-pw.db";
export const E2E_PORT = 3222;
export const E2E_TOKEN = "e2e-internal";

const prep = [
  `rm -f "$AIX_DB_PATH" "$AIX_DB_PATH-wal" "$AIX_DB_PATH-shm"`,
  "bun packages/db/src/migrate.ts",
  "bun packages/db/src/seed.ts",
  "bun e2e/seed-user.ts",
  "cd apps/web",
  "bun run build",
  `bun --bun next start -p ${E2E_PORT}`,
].join(" && ");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${E2E_PORT}`, trace: "on-first-retry" },
  webServer: {
    command: `bash -c 'cd .. && ${prep}'`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { AIX_DB_PATH: E2E_DB, AIX_INTERNAL_TOKEN: E2E_TOKEN, AIX_PUBLIC_URL: `http://localhost:${E2E_PORT}` },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
