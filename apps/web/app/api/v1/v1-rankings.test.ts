import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/**
 * v1 read APIs for the native client (ticket 0058, read-only scope):
 * recap + daily pick. Assertions are presence-scoped with unique
 * needles: bun runs all suites in one process, so the @aix/db singleton
 * shares one DB across test files.
 */
const DB_PATH = `/tmp/aix-v1rankings-test-${process.pid}.db`;

let recapGET: (req: Request) => Promise<Response>;
let recapDateGET: (req: Request, ctx: { params: Promise<{ date: string }> }) => Promise<Response>;
let archiveGET: (req: Request) => Promise<Response>;
let dailyPickGET: (req: Request) => Promise<Response>;

const RECAP_DAY = "2001-02-03"; // unique, far-past UTC day no other suite touches
const recapSec = Math.floor(Date.parse(`${RECAP_DAY}T12:00:00Z`) / 1000);

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, items, stackItems, users } = await import("@aix/db");
  runMigrations();
  const db = getDb();

  ({ GET: recapGET } = await import("./recap/route"));
  ({ GET: recapDateGET } = await import("./recap/[date]/route"));
  ({ GET: archiveGET } = await import("./recap/archive/route"));
  ({ GET: dailyPickGET } = await import("./daily-pick/route"));

  const mkItem = (slug: string, extra: Record<string, unknown> = {}) =>
    db
      .insert(items)
      .values({
        id: `v1r-${slug}`,
        slug,
        kind: "github_repo",
        externalId: `v1r/${slug}`,
        url: `https://github.com/v1r/${slug}`,
        title: `V1Rank ${slug}`,
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
      .run();

  mkItem("v1rank-tool", {
    scoreStatus: "scored",
    scoredAt: recapSec,
    overallScore: 100,
    commentCount: 999,
    upvotes: 5,
    dailyPickAt: recapSec,
  });
  mkItem("v1rank-trap", {
    scoreStatus: "scored",
    scoredAt: recapSec,
    verdict: "complexity-trap",
    noiseScore: 99,
    overallScore: 12,
  });
  // A newer daily pick than v1rank-tool's, and one hidden pick that must not win.
  mkItem("v1rank-pick", {
    scoreStatus: "scored",
    scoredAt: recapSec,
    overallScore: 90,
    dailyPickAt: recapSec + 60,
  });
  mkItem("v1rank-hidden-pick", { published: false, dailyPickAt: recapSec + 120 });

  // One "using" row so recap items carry a uses count.
  const user = db
    .insert(users)
    .values({ id: "v1r-user", username: "v1r-user", displayName: "R" })
    .returning()
    .get();
  db.insert(stackItems)
    .values({ id: "v1r-stack", userId: user.id, itemId: "v1r-v1rank-tool", status: "using" })
    .run();
});

test("recap by date: judged items, lead pick, complexity trap, uses; empty day 404s", async () => {
  const res = await recapDateGET(new Request(`https://x/api/v1/recap/${RECAP_DAY}`), {
    params: Promise.resolve({ date: RECAP_DAY }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.recap.total).toBe(3);
  expect(body.recap.leadPick.slug).toBe("v1rank-tool");
  expect(body.recap.leadPick.uses).toBe(1);
  expect(body.recap.complexityTrap.slug).toBe("v1rank-trap");

  const empty = await recapDateGET(new Request("https://x/api/v1/recap/2001-02-04"), {
    params: Promise.resolve({ date: "2001-02-04" }),
  });
  expect(empty.status).toBe(404);
});

test("recap archive lists judged dates; latest recap returns 200", async () => {
  const res = await archiveGET(new Request("https://x/api/v1/recap/archive"));
  expect((await res.json()).dates).toContain(RECAP_DAY);
  const latest = await recapGET(new Request("https://x/api/v1/recap"));
  expect(latest.status).toBe(200);
  expect((await latest.json()).recap.date).toBeDefined();
});

test("daily pick: newest published dailyPickAt wins; unpublished never leaks", async () => {
  const res = await dailyPickGET(new Request("https://x/api/v1/daily-pick"));
  expect(res.status).toBe(200);
  const body = await res.json();
  // v1rank-hidden-pick is newer but unpublished; v1rank-pick must win.
  // (Other suites don't set dailyPickAt, so this is safe to assert exactly.)
  expect(body.item.slug).toBe("v1rank-pick");
  expect(body.pickedAt).toBeDefined();
});
