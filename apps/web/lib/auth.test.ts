import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Bearer sessions (ticket 0057): opaque session tokens resolve users for mobile. */
const DB_PATH = `/tmp/aix-auth-test-${process.pid}.db`;

let createSession: typeof import("./auth").createSession;
let destroySession: typeof import("./auth").destroySession;
let resolveSessionUser: typeof import("./auth").resolveSessionUser;
let bearerToken: typeof import("./auth").bearerToken;
let userId: string;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const { getDb, users, sessions } = await import("@aix/db");
  ({ createSession, destroySession, resolveSessionUser, bearerToken } = await import("./auth"));
  runMigrations();

  const user = getDb()
    .insert(users)
    .values({ id: "auth-test-user", username: "auth-test-user", displayName: "Auth Test" })
    .returning()
    .get();
  userId = user.id;

  // An already-expired session for the expiry test.
  getDb()
    .insert(sessions)
    .values({ id: "auth-test-expired", userId, expiresAt: Math.floor(Date.now() / 1000) - 60 })
    .run();
});

test("resolveSessionUser returns the session's user for a live token", () => {
  const { token } = createSession(userId);
  expect(resolveSessionUser(token)?.id).toBe(userId);
});

test("resolveSessionUser rejects unknown and expired tokens", () => {
  expect(resolveSessionUser("no-such-token")).toBeNull();
  expect(resolveSessionUser("auth-test-expired")).toBeNull();
});

test("destroySession invalidates the token", () => {
  const { token } = createSession(userId);
  destroySession(token);
  expect(resolveSessionUser(token)).toBeNull();
});

test("bearerToken extracts the token from an Authorization header", () => {
  expect(bearerToken("Bearer abc123")).toBe("abc123");
  expect(bearerToken("bearer abc123")).toBe("abc123"); // scheme is case-insensitive
  expect(bearerToken("Basic abc123")).toBeNull();
  expect(bearerToken(null)).toBeNull();
  expect(bearerToken("Bearer ")).toBeNull();
});
