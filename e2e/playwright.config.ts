import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a real, seeded build of the web app. The web server is built +
 * started by Playwright; global-setup seeds the SQLite DB and creates a test
 * user + session so authed flows can run. Runs on a dedicated port/DB so it
 * never collides with a dev server.
 */
export const E2E_DB = "/tmp/aix-e2e-pw.db";
export const E2E_PORT = 3222;
export const E2E_TOKEN = "e2e-internal";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `bash -c "cd ../apps/web && bun run build && bun --bun next start -p ${E2E_PORT}"`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { AIX_DB_PATH: E2E_DB, AIX_INTERNAL_TOKEN: E2E_TOKEN, AIX_PUBLIC_URL: `http://localhost:${E2E_PORT}` },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
