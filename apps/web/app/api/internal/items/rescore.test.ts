import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { METRIC_KEYS } from "@aix/core";

/**
 * Rescore (ticket: item-rescore): a SCORED item whose `rescoreRequestedAt` is
 * newer than its `scoredAt` is re-evaluated in place on the next publish —
 * overwriting score/verdict while keeping id, slug, and social data. Without a
 * pending request, a re-publish of a scored item stays a plain duplicate.
 */
const DB_PATH = `/tmp/aix-rescore-test-${process.pid}.db`;
const TOKEN = "rescore-test-token";

let POST: typeof import("./route").POST;
let createPendingItem: typeof import("@/lib/pending-items").createPendingItem;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");
let eq: typeof import("drizzle-orm").eq;
let itemId: string;
let itemSlug: string;

function evaluation(overallScore: number) {
  const scores = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, { score: overallScore, rationale: "steady across the board here" }]),
  );
  const para =
    "A long-enough plainspoken paragraph describing the tool for the strict schema bounds. ";
  return {
    schemaVersion: 1,
    slug: "dispatch-evaluated", // eval slug differs from stored slug on upgrade
    source: {
      kind: "github_repo",
      externalId: "acme/dispatch",
      url: "https://github.com/acme/dispatch",
      title: "Dispatch",
    },
    category: "cli-tool",
    integration: "standalone-app",
    tags: ["cli"],
    verdict: overallScore >= 80 ? "essential" : "worthwhile",
    noiseScore: 20,
    audience: {
      primary: "ai-engineer",
      aiEngineerFit: 80,
      vibeCoderFit: 40,
      rationale: "Built for engineers who live in the terminal.",
    },
    scores,
    overallScore,
    tagline: "A real, narrow win for terminal-first engineers.",
    body: {
      whatItIs: para,
      vsVanilla: para,
      surfaceArea: para,
      devilsAdvocate: para + para,
      whatWouldMakeItBetter: para,
      steelman: para,
    },
    media: [],
    evaluatedBy: "ai",
    model: "test",
    evaluatedAt: "2026-07-06T00:00:00.000Z",
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://internal/api/internal/items", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = TOKEN;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ eq } = await import("drizzle-orm"));
  ({ POST } = await import("./route"));
  ({ createPendingItem } = await import("@/lib/pending-items"));
  runMigrations();
  db = schema.getDb();

  db.insert(schema.users).values({ id: "rs_u", username: "rescore-user" }).run();
  const { item } = createPendingItem("https://github.com/acme/dispatch", "rs_u");
  itemId = item.id;
  itemSlug = item.slug;
  // Land the first evaluation so the item is SCORED.
  await post({ evaluation: evaluation(60), submissionId: "rs_sub0" });
  db.insert(schema.comments)
    .values({ id: "rs_c1", authorId: "rs_u", itemId, body: "curious how the update scores" })
    .run();
});

test("without a rescore request, re-publishing a scored item is a plain duplicate", async () => {
  const res = await post({ evaluation: evaluation(90), submissionId: "rs_sub_dup" });
  const data = (await res.json()) as { duplicate?: boolean; item: { overallScore: number } };
  expect(data.duplicate).toBe(true);
  // score untouched by the duplicate publish
  const item = db.select().from(schema.items).where(eq(schema.items.id, itemId)).get()!;
  expect(item.overallScore).toBe(60);
});

test("a pending rescore request re-evaluates the item in place (new score, same id/slug, comments intact)", async () => {
  // Realistic timeline: the item was scored a while ago, the user requested a
  // rescore since, and the scan (this publish) lands now. Backdate scoredAt so
  // the fresh publish's now-stamp clearly exceeds the request (what happens in
  // production where the scanner runs minutes after the click).
  const nowSec = Math.floor(Date.now() / 1000);
  db.update(schema.items)
    .set({ scoredAt: nowSec - 100, rescoreRequestedAt: nowSec - 50 })
    .where(eq(schema.items.id, itemId))
    .run();

  const res = await post({ evaluation: evaluation(88), submissionId: "rs_sub1" });
  const data = (await res.json()) as {
    duplicate?: boolean;
    upgraded?: boolean;
    item: { id: string; slug: string };
  };
  expect(data.duplicate).toBeFalsy();
  expect(data.item.id).toBe(itemId); // same row
  expect(data.item.slug).toBe(itemSlug); // permalink stable

  const item = db.select().from(schema.items).where(eq(schema.items.id, itemId)).get()!;
  expect(item.overallScore).toBe(88); // re-scored
  expect(item.verdict).toBe("essential");
  expect(item.scoreStatus).toBe("scored");
  // scoredAt now bumped PAST the request → the rescore is consumed.
  expect(item.scoredAt!).toBeGreaterThan(item.rescoreRequestedAt!);

  const comments = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.itemId, itemId))
    .all();
  expect(comments).toHaveLength(1); // social data survived
});

test("after the rescore is consumed, a further re-publish is a duplicate again", async () => {
  const res = await post({ evaluation: evaluation(50), submissionId: "rs_sub2" });
  const data = (await res.json()) as { duplicate?: boolean };
  expect(data.duplicate).toBe(true);
  const item = db.select().from(schema.items).where(eq(schema.items.id, itemId)).get()!;
  expect(item.overallScore).toBe(88); // unchanged — no loop
});
