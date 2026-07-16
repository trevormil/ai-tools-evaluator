import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/**
 * Rescore request (ticket: item-rescore): stamps the per-item weekly cooldown
 * and enqueues a submission the scanner drains — verified against a real DB.
 */
const DB_PATH = `/tmp/aix-rescore-req-test-${process.pid}.db`;
const DAY = 24 * 60 * 60;

let requestRescore: typeof import("./rescore-request").requestRescore;
let RESCORE_COOLDOWN_SECONDS: typeof import("./rescore").RESCORE_COOLDOWN_SECONDS;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");
let eq: typeof import("drizzle-orm").eq;

const SCORED_SLUG = "dispatch";
let scoredId: string;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ eq } = await import("drizzle-orm"));
  ({ requestRescore } = await import("./rescore-request"));
  ({ RESCORE_COOLDOWN_SECONDS } = await import("./rescore"));
  runMigrations();
  db = schema.getDb();

  db.insert(schema.users).values({ id: "rq_u", username: "rescore-requester" }).run();

  const nowSec = Math.floor(Date.now() / 1000);
  scoredId = "rq_item";
  db.insert(schema.items)
    .values({
      id: scoredId,
      slug: SCORED_SLUG,
      kind: "github_repo",
      externalId: "acme/dispatch",
      url: "https://github.com/acme/dispatch",
      title: "Dispatch",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 60,
      noiseScore: 20,
      tagline: "t",
      evaluationJson: "{}",
      evaluatedBy: "ai",
      scoreStatus: "scored",
      scoredAt: nowSec - 30 * DAY, // scored a month ago
    })
    .run();
  // A pending (unscored) item to prove it's rejected.
  db.insert(schema.items)
    .values({
      id: "rq_pending",
      slug: "pending-tool",
      kind: "github_repo",
      externalId: "acme/pending",
      url: "https://github.com/acme/pending",
      title: "Pending",
      category: "other",
      integration: "standalone-app",
      verdict: "niche",
      overallScore: 0,
      noiseScore: 0,
      tagline: "t",
      evaluationJson: "{}",
      evaluatedBy: "pending",
      scoreStatus: "pending",
    })
    .run();
});

test("unknown slug → not_found", () => {
  const out = requestRescore("nope", "rq_u", Math.floor(Date.now() / 1000));
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe("not_found");
});

test("a pending (unscored) item → not_scored", () => {
  const out = requestRescore("pending-tool", "rq_u", Math.floor(Date.now() / 1000));
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe("not_scored");
});

test("first request stamps the item and enqueues a rescore submission", () => {
  const now = Math.floor(Date.now() / 1000);
  const out = requestRescore(SCORED_SLUG, "rq_u", now);
  expect(out.ok).toBe(true);
  if (out.ok) expect(out.nextEligibleAt).toBe(now + RESCORE_COOLDOWN_SECONDS);

  const item = db.select().from(schema.items).where(eq(schema.items.id, scoredId)).get()!;
  expect(item.rescoreRequestedAt).toBe(now);

  const subs = db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.itemId, scoredId))
    .all();
  expect(subs).toHaveLength(1);
  expect(subs[0]!.status).toBe("queued");
  expect(subs[0]!.note).toBe("rescore");
  expect(subs[0]!.submittedById).toBe("rq_u");
});

test("a second request while the first is still pending → pending (no double enqueue)", () => {
  const out = requestRescore(SCORED_SLUG, "rq_u", Math.floor(Date.now() / 1000));
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.code).toBe("pending");
  const subs = db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.itemId, scoredId))
    .all();
  expect(subs).toHaveLength(1); // still just the one
});

test("consumed but inside the 7-day window → cooldown with nextEligibleAt", () => {
  const now = Math.floor(Date.now() / 1000);
  // Simulate: the scan consumed it 2 days ago (scoredAt just after the request).
  db.update(schema.items)
    .set({ rescoreRequestedAt: now - 2 * DAY, scoredAt: now - 2 * DAY + 60 })
    .where(eq(schema.items.id, scoredId))
    .run();

  const out = requestRescore(SCORED_SLUG, "rq_u", now);
  expect(out.ok).toBe(false);
  if (!out.ok && out.code === "cooldown") {
    expect(out.nextEligibleAt).toBe(now - 2 * DAY + RESCORE_COOLDOWN_SECONDS);
  } else {
    throw new Error(`expected cooldown, got ${JSON.stringify(out)}`);
  }
});

test("past the 7-day window → eligible again, re-enqueues", () => {
  const now = Math.floor(Date.now() / 1000);
  db.update(schema.items)
    .set({ rescoreRequestedAt: now - 8 * DAY, scoredAt: now - 8 * DAY + 60 })
    .where(eq(schema.items.id, scoredId))
    .run();

  const out = requestRescore(SCORED_SLUG, "rq_u", now);
  expect(out.ok).toBe(true);
  const subs = db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.itemId, scoredId))
    .all();
  expect(subs).toHaveLength(2); // a fresh rescore submission
});
