import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

// The DB module captures its path as a load-time const, so the env var must be set
// BEFORE @aix/db is imported. We therefore dynamic-import all DB-backed modules
// inside beforeAll, after pointing the singleton at a throwaway file.
const DB_PATH = `/tmp/aix-stack-test-${process.pid}.db`;
const USER_ID = "u_stack_test";

let upsertStackEntry: typeof import("./stack").upsertStackEntry;
let getUserStack: typeof import("./stack").getUserStack;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const { getDb, users } = await import("@aix/db");
  ({ upsertStackEntry, getUserStack } = await import("./stack"));

  runMigrations();
  getDb().insert(users).values({ id: USER_ID, username: "stacktester" }).run();
});

test("partial upsert preserves an existing take/rating (ticket 0033: I-use-this must not wipe takes)", () => {
  upsertStackEntry(USER_ID, { toolName: "Zed", status: "trying", take: "fast editor", rating: 4 });
  // Status-only upsert (what the I-use-this toggle sends) — take + rating survive.
  upsertStackEntry(USER_ID, { toolName: "zed", status: "using" });
  const entry = getUserStack(USER_ID).find((e) => e.toolName === "Zed")!;
  expect(entry.status).toBe("using");
  expect(entry.take).toBe("fast editor");
  expect(entry.rating).toBe(4);
  // Explicit null clears.
  upsertStackEntry(USER_ID, { toolName: "zed", status: "using", take: null, rating: null });
  const cleared = getUserStack(USER_ID).find((e) => e.toolName === "Zed")!;
  expect(cleared.take).toBeNull();
  expect(cleared.rating).toBeNull();
});

test("free-form tool names dedup case-insensitively (ticket 0018: lower(toolName))", () => {
  upsertStackEntry(USER_ID, { toolName: "Cursor", status: "using" });
  // Same tool, different casing + whitespace — must UPDATE the same entry, not add a new one.
  upsertStackEntry(USER_ID, { toolName: "  cursor ", status: "dropped", take: "moved off it" });

  const stack = getUserStack(USER_ID).filter((e) => e.toolName?.toLowerCase() === "cursor");
  expect(stack).toHaveLength(1);
  expect(stack[0]!.status).toBe("dropped");
  expect(stack[0]!.take).toBe("moved off it");
  // Original display casing is preserved (we dedup on lower(), we don't rewrite the name).
  expect(stack[0]!.toolName).toBe("Cursor");
});
