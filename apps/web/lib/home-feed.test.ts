import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { eq } from "drizzle-orm";

/**
 * Unified home feed (ticket 0024): posts + published items + rich activities in
 * one cursor-paginated timeline, with an explicit following mode (no silent
 * global fallback).
 *
 * DB path must be set before @aix/db loads — same dynamic-import pattern as
 * stack.test.ts.
 */
const DB_PATH = `/tmp/aix-home-feed-test-${process.pid}.db`;

let getUnifiedFeed: typeof import("./home-feed").getUnifiedFeed;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

const ALICE = "u_alice";
const BOB = "u_bob";
const CARA = "u_cara";

/** Deterministic timeline base (seconds). Entries get distinct offsets from here. */
const T0 = 1_750_000_000;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  schema = await import("@aix/db");
  ({ getUnifiedFeed } = await import("./home-feed"));
  runMigrations();
  db = schema.getDb();

  const { users, items, posts, follows, activities, reposts, stackItems } = schema;

  for (const [id, username] of [
    [ALICE, "alice"],
    [BOB, "bob"],
    [CARA, "cara"],
  ] as const) {
    db.insert(users).values({ id, username }).run();
  }

  // Two items: one published (enters the feed), one not.
  db.insert(items)
    .values({
      id: "item_pub",
      slug: "pub-tool",
      kind: "github_repo",
      externalId: "pub/tool",
      url: "https://github.com/pub/tool",
      title: "Pub Tool",
      tagline: "a published tool",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 70,
      noiseScore: 10,
      evaluationJson: "{}",
      tagsJson: "[]",
      mediaJson: "[]",
      published: true,
      createdAt: T0 + 50,
    })
    .run();
  db.insert(items)
    .values({
      id: "item_unpub",
      slug: "unpub-tool",
      kind: "github_repo",
      externalId: "unpub/tool",
      url: "https://github.com/unpub/tool",
      title: "Unpub Tool",
      tagline: "not yet published",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 60,
      noiseScore: 10,
      evaluationJson: "{}",
      tagsJson: "[]",
      mediaJson: "[]",
      published: false,
      createdAt: T0 + 55,
    })
    .run();

  // Bob posts (newer than the item), Cara posts (older).
  db.insert(posts)
    .values({ id: "post_bob", authorId: BOB, body: "bob take", createdAt: T0 + 60 })
    .run();
  db.insert(posts)
    .values({ id: "post_cara", authorId: CARA, body: "cara take", createdAt: T0 + 40 })
    .run();

  // Alice follows Bob only.
  db.insert(follows).values({ followerId: ALICE, followeeId: BOB, createdAt: T0 }).run();

  // Cara reposts Bob's post with a quote (activity + repost row).
  db.insert(reposts)
    .values({
      id: "rp_1",
      userId: CARA,
      targetType: "post",
      targetId: "post_bob",
      quote: "this exactly",
      createdAt: T0 + 70,
    })
    .run();
  db.insert(activities)
    .values({
      id: "act_repost",
      actorId: CARA,
      verb: "reposted",
      objectType: "post",
      objectId: "post_bob",
      createdAt: T0 + 70,
    })
    .run();

  // Bob adds the published item to his stack with a take (activity + stack row).
  db.insert(stackItems)
    .values({
      id: "st_1",
      userId: BOB,
      itemId: "item_pub",
      status: "using",
      take: "daily driver",
      createdAt: T0 + 80,
      updatedAt: T0 + 80,
    })
    .run();
  db.insert(activities)
    .values({
      id: "act_stack",
      actorId: BOB,
      verb: "stack_added",
      objectType: "item",
      objectId: "item_pub",
      createdAt: T0 + 80,
    })
    .run();
});

test("published items enter the timeline as item entries; unpublished never do", () => {
  const { entries } = getUnifiedFeed(null, { mode: "all", limit: 50 });
  const itemEntries = entries.filter((e) => e.kind === "item");
  expect(itemEntries.map((e) => (e.kind === "item" ? e.item.slug : ""))).toContain("pub-tool");
  expect(itemEntries.map((e) => (e.kind === "item" ? e.item.slug : ""))).not.toContain(
    "unpub-tool",
  );
});

test("entries are strictly newest-first across kinds", () => {
  const { entries } = getUnifiedFeed(null, { mode: "all", limit: 100 });
  const times = entries.map((e) => e.createdAt);
  expect([...times].sort((a, b) => b - a)).toEqual(times);
  // Relative order of THIS suite's entries (other suites share the process-wide
  // test DB): stack activity (T0+80) > repost (T0+70) > bob's post (T0+60) > item (T0+50).
  const mine = entries
    .map((e) =>
      e.kind === "post" && e.post.id === "post_bob"
        ? "bob-post"
        : e.kind === "item" && e.item.id === "item_pub"
          ? "pub-item"
          : e.kind === "activity" && e.activity.id === "act_stack"
            ? "stack"
            : e.kind === "activity" && e.activity.id === "act_repost"
              ? "repost"
              : null,
    )
    .filter(Boolean);
  expect(mine).toEqual(["stack", "repost", "bob-post", "pub-item"]);
});

test("a repost activity embeds the original post and carries the quote", () => {
  const { entries } = getUnifiedFeed(null, { mode: "all", limit: 50 });
  const repost = entries.find((e) => e.kind === "activity" && e.activity.verb === "reposted");
  expect(repost).toBeDefined();
  if (repost?.kind !== "activity") throw new Error("unreachable");
  expect(repost.quote).toBe("this exactly");
  expect(repost.embed?.type).toBe("post");
  if (repost.embed?.type !== "post") throw new Error("unreachable");
  expect(repost.embed.post.id).toBe("post_bob");
  expect(repost.embed.author.username).toBe("bob");
});

test("a stack_added activity embeds the item and the take", () => {
  const { entries } = getUnifiedFeed(null, { mode: "all", limit: 50 });
  const stack = entries.find((e) => e.kind === "activity" && e.activity.verb === "stack_added");
  expect(stack).toBeDefined();
  if (stack?.kind !== "activity") throw new Error("unreachable");
  expect(stack.embed?.type).toBe("stack");
  if (stack.embed?.type !== "stack") throw new Error("unreachable");
  expect(stack.embed.item?.slug).toBe("pub-tool");
  expect(stack.embed.take).toBe("daily driver");
});

test("following mode shows ONLY the circle — no silent global fallback, no items", () => {
  const { users } = schema;
  const alice = db.select().from(users).where(eq(users.id, ALICE)).get()!;
  const { entries } = getUnifiedFeed(alice, { mode: "following", limit: 50 });

  // Bob's post + Bob's stack activity qualify. Cara's post/repost and site items must NOT,
  // even though the circle yields fewer than 5 entries (the old magic-threshold fallback).
  expect(entries.length).toBe(2);
  for (const e of entries) {
    const actor = e.kind === "post" ? e.author.id : e.kind === "activity" ? e.actor.id : "site";
    expect(actor).toBe(BOB);
  }
});

test("comment activities carry the discussion content as an embed (ticket 0038)", async () => {
  const { comments, activities } = schema;
  db.insert(comments)
    .values({
      id: "cm_1",
      authorId: CARA,
      itemId: "item_pub",
      body: "does this handle monorepos?",
      createdAt: T0 + 85,
    })
    .run();
  db.insert(activities)
    .values({
      id: "act_comment",
      actorId: CARA,
      verb: "commented",
      objectType: "item",
      objectId: "item_pub",
      createdAt: T0 + 85,
    })
    .run();

  const { entries } = getUnifiedFeed(null, { mode: "all", limit: 100 });
  const disc = entries.find((e) => e.kind === "activity" && e.activity.id === "act_comment");
  if (disc?.kind !== "activity") throw new Error("comment activity missing from feed");
  expect(disc.embed?.type).toBe("comment");
  if (disc.embed?.type !== "comment") throw new Error("unreachable");
  expect(disc.embed.body).toBe("does this handle monorepos?");
  expect(disc.embed.item?.slug).toBe("pub-tool");
});

test("getUserActivity returns one actor's resolved activity, newest first (ticket 0029)", async () => {
  const { getUserActivity } = await import("./home-feed");
  const entries = getUserActivity(BOB, 50);
  // Bob's only non-post activity is the stack add; Cara's repost must not appear.
  expect(entries.length).toBe(1);
  expect(entries[0]!.activity.verb).toBe("stack_added");
  expect(entries[0]!.embed?.type).toBe("stack");
});

test("cursor pagination walks the whole timeline exactly once, even with same-second entries", () => {
  const { posts } = schema;
  // Two extra posts in the SAME second to prove the compound (createdAt, id) cursor.
  db.insert(posts)
    .values({ id: "post_same_a", authorId: CARA, body: "same-second a", createdAt: T0 + 90 })
    .run();
  db.insert(posts)
    .values({ id: "post_same_b", authorId: CARA, body: "same-second b", createdAt: T0 + 90 })
    .run();

  const all = getUnifiedFeed(null, { mode: "all", limit: 50 }).entries;

  const seen: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 10; i++) {
    const page = getUnifiedFeed(null, { mode: "all", limit: 2, cursor: cursor ?? undefined });
    for (const e of page.entries) {
      const key =
        e.kind === "post"
          ? `post:${e.post.id}`
          : e.kind === "item"
            ? `item:${e.item.id}`
            : `act:${e.activity.id}`;
      expect(seen).not.toContain(key); // no duplicates across pages
      seen.push(key);
    }
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  expect(seen.length).toBe(all.length); // no gaps
});
