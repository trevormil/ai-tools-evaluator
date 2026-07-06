import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { E2E_DB } from "./playwright.config";

/**
 * Seed the e2e DB before the suite. All DB work shells out to `bun` (bun:sqlite
 * isn't available under the node-based Playwright runner). Idempotent.
 */
export default async function globalSetup() {
  const root = resolve(__dirname, "..");
  const env = { ...process.env, AIX_DB_PATH: E2E_DB };
  const run = (cmd: string) => execSync(cmd, { cwd: root, env, stdio: "inherit", shell: "/bin/bash" });

  run(`rm -f ${E2E_DB} ${E2E_DB}-wal ${E2E_DB}-shm`);
  run("bun packages/db/src/migrate.ts");
  run("bun packages/db/src/seed.ts");

  // A deterministic test user + session for authed flows.
  const seedUser = `
    import { getDb, users, sessions } from "./packages/db/src/index";
    const db = getDb();
    const existing = db.select().from(users).all().find((u) => u.username === "e2euser");
    if (!existing) db.insert(users).values({ id: "e2euser", username: "e2euser", displayName: "E2E User" }).run();
    const hasSession = db.select().from(sessions).all().find((s) => s.id === "e2e-token");
    if (!hasSession) db.insert(sessions).values({ id: "e2e-token", userId: "e2euser", expiresAt: Math.floor(Date.now()/1000) + 86400 }).run();
    console.log("e2e user + session ready");
  `;
  run(`bun -e '${seedUser.replace(/\n/g, " ")}'`);
}
