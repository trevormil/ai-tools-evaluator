import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { DAILY_CAP, SUBMISSION_DAILY_CAP } from "@aix/core";

/**
 * Ticket 0043: the trending budget counts ACTUAL daily picks (items.dailyPickAt),
 * so seed rows and community submissions created today never saturate it.
 */
const DB_PATH = `/tmp/aix-cap-test-${process.pid}.db`;
const TOKEN = "cap-test-token";

let GET: typeof import("./route").GET;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

// Stamp "now" so the rows land inside the route's real-clock UTC day window.
const nowSec = Math.floor(Date.now() / 1000);

function baseItem(id: string, over: Record<string, unknown>) {
  return {
    id,
    slug: id,
    kind: "github_repo",
    externalId: `x/${id}`,
    url: `https://github.com/x/${id}`,
    title: id,
    category: "cli-tool",
    integration: "standalone-app",
    verdict: "worthwhile",
    overallScore: 70,
    noiseScore: 20,
    tagline: "t",
    evaluationJson: "{}",
    scoredAt: nowSec,
    createdAt: nowSec,
    ...over,
  };
}

function req() {
  return GET(
    new Request("http://internal/api/internal/cap", {
      headers: { authorization: `Bearer ${TOKEN}` },
    }),
  );
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = TOKEN;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ GET } = await import("./route"));
  runMigrations();
  db = schema.getDb();

  // Two real daily picks today, plus noise that must NOT count as trending:
  db.insert(schema.items)
    .values(baseItem("pick-a", { dailyPickAt: nowSec }))
    .run();
  db.insert(schema.items)
    .values(baseItem("pick-b", { dailyPickAt: nowSec }))
    .run();
  // seed/backfill row created today but never featured → dailyPickAt null
  db.insert(schema.items)
    .values(baseItem("seed-1", { dailyPickAt: null }))
    .run();
  // a community submission published today (counts against the SUBMISSION budget)
  db.insert(schema.items)
    .values(baseItem("sub-item", { dailyPickAt: null }))
    .run();
  db.insert(schema.submissions)
    .values({
      id: "s1",
      url: "https://github.com/x/sub-item",
      status: "published",
      createdAt: nowSec,
    })
    .run();
});

test("trending budget counts only actual daily picks (dailyPickAt), not seed rows", async () => {
  const data = (await (await req()).json()) as {
    publishedToday: number;
    remaining: number;
    submissions: { publishedToday: number; remaining: number };
  };
  // 2 picks today — seed-1 and sub-item are ignored by the trending count.
  expect(data.publishedToday).toBe(2);
  expect(data.remaining).toBe(DAILY_CAP - 2);
  // The one published submission counts on the independent submission budget.
  expect(data.submissions.publishedToday).toBe(1);
  expect(data.submissions.remaining).toBe(SUBMISSION_DAILY_CAP - 1);
});
