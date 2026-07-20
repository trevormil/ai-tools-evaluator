import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/**
 * v1 social read APIs (ticket 0058): the JSON surface a native client needs
 * for parity — item social, profiles, leaderboard, recap, bearer feed.
 * Assertions are presence-scoped with unique needles: bun runs all suites in
 * one process, so the @aix/db singleton shares one DB across test files.
 */
const DB_PATH = `/tmp/aix-v1social-test-${process.pid}.db`;

let itemSocialGET: (req: Request, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;
let userGET: (req: Request, ctx: { params: Promise<{ username: string }> }) => Promise<Response>;
let leaderboardGET: (req: Request) => Promise<Response>;
let recapGET: (req: Request) => Promise<Response>;
let recapDateGET: (req: Request, ctx: { params: Promise<{ date: string }> }) => Promise<Response>;
let archiveGET: (req: Request) => Promise<Response>;
let feedGET: (req: Request) => Promise<Response>;

let aliceToken: string;
let bobToken: string;

const RECAP_DAY = "2001-02-03"; // unique, far-past UTC day no other suite touches
const recapSec = Math.floor(Date.parse(`${RECAP_DAY}T12:00:00Z`) / 1000);

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, users, items, comments, votes, follows, stackItems, posts, profileLinks } =
    await import("@aix/db");
  const { createSession } = await import("@/lib/auth");
  runMigrations();
  const db = getDb();

  ({ GET: itemSocialGET } = await import("./items/[slug]/social/route"));
  ({ GET: userGET } = await import("./users/[username]/route"));
  ({ GET: leaderboardGET } = await import("./leaderboard/route"));
  ({ GET: recapGET } = await import("./recap/route"));
  ({ GET: recapDateGET } = await import("./recap/[date]/route"));
  ({ GET: archiveGET } = await import("./recap/archive/route"));
  ({ GET: feedGET } = await import("../feed/route"));

  const mkUser = (name: string) =>
    db
      .insert(users)
      .values({ id: `v1u-${name}`, username: `v1u-${name}`, displayName: name })
      .returning()
      .get();
  const alice = mkUser("alice");
  const bob = mkUser("bob");
  mkUser("carol");
  aliceToken = createSession(alice.id).token;
  bobToken = createSession(bob.id).token;

  const mkItem = (slug: string, extra: Record<string, unknown> = {}) =>
    db
      .insert(items)
      .values({
        id: `v1i-${slug}`,
        slug,
        kind: "github_repo",
        externalId: `v1/${slug}`,
        url: `https://github.com/v1/${slug}`,
        title: `V1Social ${slug}`,
        tagline: "t",
        category: "cli-tool",
        integration: "standalone-app",
        verdict: "worthwhile",
        overallScore: 80,
        noiseScore: 10,
        evaluationJson: "{}",
        published: true,
        ...extra,
      })
      .returning()
      .get();

  mkItem("v1social-tool", {
    scoreStatus: "scored",
    scoredAt: recapSec,
    overallScore: 100,
    commentCount: 999,
    upvotes: 5,
  });
  mkItem("v1social-pending", { scoreStatus: "pending", overallScore: 0 });
  mkItem("v1social-hidden", { published: false });
  mkItem("v1social-trap", {
    scoreStatus: "scored",
    scoredAt: recapSec,
    verdict: "complexity-trap",
    noiseScore: 99,
    overallScore: 12,
  });

  // Social fixtures on the scored tool.
  db.insert(stackItems)
    .values({
      id: "v1s-alice",
      userId: alice.id,
      itemId: "v1i-v1social-tool",
      status: "using",
      take: "Genuinely great",
      rating: 5,
    })
    .run();
  db.insert(stackItems)
    .values({ id: "v1s-bob", userId: bob.id, itemId: "v1i-v1social-tool", status: "trying" })
    .run();
  db.insert(comments)
    .values({ id: "v1c-root", authorId: alice.id, itemId: "v1i-v1social-tool", body: "root take" })
    .run();
  db.insert(comments)
    .values({
      id: "v1c-child",
      authorId: bob.id,
      itemId: "v1i-v1social-tool",
      parentId: "v1c-root",
      body: "nested reply",
    })
    .run();
  db.insert(votes)
    .values({
      id: "v1v-bob",
      userId: bob.id,
      targetType: "item",
      targetId: "v1i-v1social-tool",
      value: 1,
    })
    .run();
  db.insert(follows).values({ followerId: bob.id, followeeId: alice.id }).run();
  db.insert(profileLinks)
    .values({ id: "v1pl-1", userId: alice.id, kind: "website", url: "https://alice.dev" })
    .run();

  // Posts: alice (followed by bob) and carol (not followed) — the feed-mode probe.
  db.insert(posts)
    .values({ id: "v1p-alice", authorId: alice.id, body: "v1social alice post" })
    .run();
  db.insert(posts)
    .values({ id: "v1p-carol", authorId: "v1u-carol", body: "v1social carol post" })
    .run();
});

const social = (slug: string, token?: string) =>
  itemSocialGET(
    new Request(`https://x/api/v1/items/${slug}/social`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    { params: Promise.resolve({ slug }) },
  );

test("item social: takes, nested comments, use counts — public, no auth", async () => {
  const res = await social("v1social-tool");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.social.takes.length).toBe(1);
  expect(body.social.takes[0].take).toBe("Genuinely great");
  expect(body.social.takes[0].user.username).toBe("v1u-alice");
  // Raw DB user columns must not leak through the public surface.
  expect(body.social.takes[0].user.githubId).toBeUndefined();
  expect(body.social.useCount).toBe(2); // using + trying
  const root = body.social.comments.find((c: { id: string }) => c.id === "v1c-root");
  expect(root.author.username).toBe("v1u-alice");
  expect(root.children[0].body).toBe("nested reply");
  expect(body.viewer).toBeNull();
});

test("item social: bearer viewer sees their vote and stack entry", async () => {
  const res = await social("v1social-tool", bobToken);
  const body = await res.json();
  expect(body.viewer.vote).toBe(1);
  expect(body.viewer.stack.status).toBe("trying");
  const res2 = await social("v1social-tool", aliceToken);
  const body2 = await res2.json();
  expect(body2.viewer.vote).toBe(0);
  expect(body2.viewer.stack.take).toBe("Genuinely great");
});

test("item social: pending items are socially live; unpublished 404", async () => {
  expect((await social("v1social-pending")).status).toBe(200);
  expect((await social("v1social-hidden")).status).toBe(404);
  expect((await social("v1social-nope")).status).toBe(404);
});

test("user profile: user, links, counts, takes, stack, viewer follow state", async () => {
  const res = await userGET(
    new Request("https://x/api/v1/users/v1u-alice", {
      headers: { authorization: `Bearer ${bobToken}` },
    }),
    { params: Promise.resolve({ username: "v1u-alice" }) },
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.user.username).toBe("v1u-alice");
  expect(body.user.githubId).toBeUndefined();
  expect(body.links).toEqual([{ kind: "website", url: "https://alice.dev" }]);
  expect(body.counts.followers).toBe(1);
  expect(body.takes[0].take).toBe("Genuinely great");
  expect(body.takes[0].item.slug).toBe("v1social-tool");
  expect(body.stack.length).toBe(1);
  expect(body.viewer.following).toBe(true);
  // Unknown user 404s.
  const missing = await userGET(new Request("https://x/api/v1/users/v1u-ghost"), {
    params: Promise.resolve({ username: "v1u-ghost" }),
  });
  expect(missing.status).toBe(404);
});

test("leaderboard: three lists with ranked public projections", async () => {
  const res = await leaderboardGET(new Request("https://x/api/v1/leaderboard"));
  expect(res.status).toBe(200);
  const body = await res.json();
  const top = body.topRated.map((i: { slug: string }) => i.slug);
  expect(top).toContain("v1social-tool"); // overallScore 100
  const discussed = body.mostDiscussed.map((i: { slug: string }) => i.slug);
  expect(discussed).toContain("v1social-tool"); // commentCount 999
  expect(
    body.mostDiscussed.find((i: { slug: string }) => i.slug === "v1social-tool").commentCount,
  ).toBe(999);
  const shame = body.hallOfShame.map((i: { slug: string }) => i.slug);
  expect(shame).toContain("v1social-trap"); // noiseScore 99 trap
  expect(shame).not.toContain("v1social-tool");
});

test("recap by date: judged items with lead pick and complexity trap", async () => {
  const res = await recapDateGET(new Request(`https://x/api/v1/recap/${RECAP_DAY}`), {
    params: Promise.resolve({ date: RECAP_DAY }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.recap.date).toBe(RECAP_DAY);
  expect(body.recap.total).toBe(2);
  expect(body.recap.leadPick.slug).toBe("v1social-tool");
  expect(body.recap.complexityTrap.slug).toBe("v1social-trap");
  expect(body.recap.leadPick.uses).toBe(2);
  // No recap that day → 404.
  const empty = await recapDateGET(new Request("https://x/api/v1/recap/2001-02-04"), {
    params: Promise.resolve({ date: "2001-02-04" }),
  });
  expect(empty.status).toBe(404);
});

test("recap archive lists judged dates; latest recap endpoint returns 200", async () => {
  const res = await archiveGET(new Request("https://x/api/v1/recap/archive"));
  const body = await res.json();
  expect(body.dates).toContain(RECAP_DAY);
  const latest = await recapGET(new Request("https://x/api/v1/recap"));
  expect(latest.status).toBe(200);
  expect((await latest.json()).recap.date).toBeDefined();
});

test("feed: bearer token activates following mode", async () => {
  const all = await feedGET(new Request("https://x/api/feed?mode=all&limit=100"));
  const allKeys = JSON.stringify(await all.json());
  expect(allKeys).toContain("v1social carol post");

  const following = await feedGET(
    new Request("https://x/api/feed?mode=following&limit=100", {
      headers: { authorization: `Bearer ${bobToken}` },
    }),
  );
  const body = JSON.stringify(await following.json());
  expect(body).toContain("v1social alice post"); // bob follows alice
  expect(body).not.toContain("v1social carol post"); // not followed
});

test("feed: mode=following without auth falls back to everything", async () => {
  const res = await feedGET(new Request("https://x/api/feed?mode=following&limit=100"));
  expect(res.status).toBe(200);
  const body = JSON.stringify(await res.json());
  expect(body).toContain("v1social carol post");
});
