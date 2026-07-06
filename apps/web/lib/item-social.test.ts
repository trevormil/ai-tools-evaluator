import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Item-page practitioner signal (ticket 0026): who runs the tool. */
const DB_PATH = `/tmp/aix-item-social-test-${process.pid}.db`;

let itemStackSummary: typeof import("./item-social").itemStackSummary;
let db: ReturnType<typeof import("@aix/db").getDb>;

const ITEM = "item_x";

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const { getDb, users, items, stackItems } = await import("@aix/db");
  ({ itemStackSummary } = await import("./item-social"));
  runMigrations();
  db = getDb();

  db.insert(users).values({ id: "u1", username: "one" }).run();
  db.insert(users).values({ id: "u2", username: "two" }).run();
  db.insert(items)
    .values({
      id: ITEM,
      slug: "x",
      kind: "github_repo",
      externalId: "x/x",
      url: "https://github.com/x/x",
      title: "X",
      tagline: "x",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 70,
      noiseScore: 10,
      evaluationJson: "{}",
    })
    .run();

  db.insert(stackItems)
    .values({ id: "s1", userId: "u1", itemId: ITEM, status: "using", take: "love it" })
    .run();
  db.insert(stackItems)
    .values({ id: "s2", userId: "u2", itemId: ITEM, status: "dropped", take: null })
    .run();
});

test("itemStackSummary counts runners and surfaces takes with usernames", () => {
  const s = itemStackSummary(ITEM);
  expect(s.total).toBe(2);
  expect(s.byStatus.using).toBe(1);
  expect(s.byStatus.dropped).toBe(1);
  // Only entries with a take are quotable.
  expect(s.takes).toHaveLength(1);
  expect(s.takes[0]!.username).toBe("one");
  expect(s.takes[0]!.take).toBe("love it");
  expect(s.takes[0]!.status).toBe("using");
});
