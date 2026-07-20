import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Bearer logout (ticket 0057): mobile clients sign out with their token, no cookie. */
const DB_PATH = `/tmp/aix-logout-test-${process.pid}.db`;

let POST: typeof import("./route").POST;
let createSession: typeof import("@/lib/auth").createSession;
let resolveSessionUser: typeof import("@/lib/auth").resolveSessionUser;
let userId: string;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, users } = await import("@aix/db");
  ({ createSession, resolveSessionUser } = await import("@/lib/auth"));
  ({ POST } = await import("./route"));
  runMigrations();

  userId = getDb()
    .insert(users)
    .values({ id: "logout-test-user", username: "logout-test-user", displayName: "L" })
    .returning()
    .get().id;
});

test("POST with a bearer token destroys that session and returns JSON, not a redirect", async () => {
  const { token } = createSession(userId);
  const res = await POST(
    new Request("https://aix.trevormil.com/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(resolveSessionUser(token)).toBeNull();
});

test("POST with an unknown bearer token still returns 200 (idempotent sign-out)", async () => {
  const res = await POST(
    new Request("https://aix.trevormil.com/api/auth/logout", {
      method: "POST",
      headers: { authorization: "Bearer bogus" },
    }),
  );
  expect(res.status).toBe(200);
});
