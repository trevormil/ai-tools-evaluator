import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Takes as the social primitive (ticket 0036). */
const DB_PATH = `/tmp/aix-takes-test-${process.pid}.db`;

let listItemTakes: typeof import("./takes").listItemTakes;
let getUserTakes: typeof import("./takes").getUserTakes;
let db: ReturnType<typeof import("@aix/db").getDb>;

const ITEM = "tk_item";

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const { getDb, users, items, follows, stackItems } = await import("@aix/db");
  ({ listItemTakes, getUserTakes } = await import("./takes"));
  runMigrations();
  db = getDb();

  for (const id of ["tk_me", "tk_friend", "tk_stranger"]) {
    db.insert(users)
      .values({ id, username: id.replace("tk_", "takes-") })
      .run();
  }
  db.insert(items)
    .values({
      id: ITEM,
      slug: "tk-tool",
      kind: "github_repo",
      externalId: "tk/tool",
      url: "https://github.com/tk/tool",
      title: "TK Tool",
      tagline: "t",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 70,
      noiseScore: 10,
      evaluationJson: "{}",
    })
    .run();

  // I follow tk_friend, not tk_stranger.
  db.insert(follows).values({ followerId: "tk_me", followeeId: "tk_friend" }).run();

  // Stranger's take is NEWER than friend's — follow-first must still win.
  db.insert(stackItems)
    .values({
      id: "tk_s1",
      userId: "tk_friend",
      itemId: ITEM,
      status: "using",
      take: "friend take",
      createdAt: 100,
      updatedAt: 100,
    })
    .run();
  db.insert(stackItems)
    .values({
      id: "tk_s2",
      userId: "tk_stranger",
      itemId: ITEM,
      status: "trying",
      take: "stranger take",
      createdAt: 200,
      updatedAt: 200,
    })
    .run();
  // An entry WITHOUT a take (pure "I use this") is not a take.
  db.insert(stackItems)
    .values({ id: "tk_s3", userId: "tk_me", itemId: ITEM, status: "using" })
    .run();
});

test("listItemTakes returns only entries with a blurb, followed users first", () => {
  const anon = listItemTakes(ITEM);
  expect(anon.map((t) => t.take)).toEqual(["stranger take", "friend take"]); // newest first

  const mine = listItemTakes(ITEM, "tk_me");
  expect(mine.map((t) => t.username)).toEqual(["takes-friend", "takes-stranger"]);
  expect(mine[0]!.followedByViewer).toBe(true);
});

test("getUserTakes lists a user's takes with their items, newest first", () => {
  const takes = getUserTakes("tk_friend");
  expect(takes).toHaveLength(1);
  expect(takes[0]!.take).toBe("friend take");
  expect(takes[0]!.item?.slug).toBe("tk-tool");
});
