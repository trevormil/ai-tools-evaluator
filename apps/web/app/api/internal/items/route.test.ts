import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { METRIC_KEYS } from "@aix/core";

/**
 * Ticket 0035: publishing an evaluation for a PENDING community submission
 * upgrades the same row in place — id and slug stable, social data preserved.
 */
const DB_PATH = `/tmp/aix-upgrade-test-${process.pid}.db`;
const TOKEN = "upgrade-test-token";

let POST: typeof import("./route").POST;
let createPendingItem: typeof import("@/lib/pending-items").createPendingItem;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");
let pendingId: string;
let pendingSlug: string;

function validEvaluation() {
  const scores = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, { score: 80, rationale: "solid across the board in practice" }]),
  );
  const para =
    "A long-enough plainspoken paragraph describing the tool for the strict schema bounds. ";
  return {
    schemaVersion: 1,
    slug: "up-tool-evaluated",
    source: {
      kind: "github_repo",
      externalId: "up/tool",
      url: "https://github.com/up/tool",
      title: "Up Tool",
    },
    category: "cli-tool",
    integration: "standalone-app",
    tags: ["cli"],
    verdict: "worthwhile",
    noiseScore: 20,
    audience: {
      primary: "ai-engineer",
      aiEngineerFit: 80,
      vibeCoderFit: 40,
      rationale: "Built for engineers who live in the terminal.",
    },
    scores,
    overallScore: 80,
    tagline: "A real, narrow win for terminal-first engineers.",
    body: {
      whatItIs: para,
      vsVanilla: para,
      surfaceArea: para,
      devilsAdvocate: para + para,
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
  ({ POST } = await import("./route"));
  ({ createPendingItem } = await import("@/lib/pending-items"));
  runMigrations();
  db = schema.getDb();

  db.insert(schema.users).values({ id: "up_u", username: "upgrade-user" }).run();
  const { item } = createPendingItem("https://github.com/up/tool", "up_u");
  pendingId = item.id;
  pendingSlug = item.slug;

  // Social data that must survive the upgrade.
  db.insert(schema.comments)
    .values({ id: "up_c1", authorId: "up_u", itemId: pendingId, body: "hyped for the score" })
    .run();
});

test("publishing upgrades the pending item in place (same id + slug, comments intact)", async () => {
  const res = await post({ evaluation: validEvaluation(), readmeMd: "# Up Tool\n\nTheir words." });
  expect(res.status).toBe(200);
  const data = (await res.json()) as { item: { id: string; slug: string; scoreStatus: string } };
  expect(data.item.id).toBe(pendingId); // SAME row
  expect(data.item.slug).toBe(pendingSlug); // permalink stable (not the eval's slug)
  expect(data.item.scoreStatus).toBe("scored");
});

test("the upgraded item keeps its social data and scores render real values", async () => {
  const { eq } = await import("drizzle-orm");
  const item = db.select().from(schema.items).where(eq(schema.items.id, pendingId)).get()!;
  expect(item.scoreStatus).toBe("scored");
  expect(item.overallScore).toBe(80);
  expect(item.verdict).toBe("worthwhile");
  expect(item.readmeMd).toContain("Their words"); // README persisted at publish
  expect(item.scoredAt).toBeGreaterThan(0); // judged-at stamped on the upgrade (0040)
  const comments = db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.itemId, pendingId))
    .all();
  expect(comments).toHaveLength(1);
});

test("a second publish for the same source is a plain duplicate (no second upgrade)", async () => {
  const res = await post({ evaluation: validEvaluation() });
  const data = (await res.json()) as { duplicate?: boolean; item: { id: string } };
  expect(data.duplicate).toBe(true);
  expect(data.item.id).toBe(pendingId);
});

/** A fresh source with a distinct slug/externalId — forces the INSERT path. */
function freshEvaluation(key: string) {
  const ev = validEvaluation();
  ev.slug = `${key}-tool`;
  ev.source = {
    kind: "github_repo",
    externalId: `${key}/tool`,
    url: `https://github.com/${key}/tool`,
    title: `${key} tool`,
  };
  return ev;
}

test("a trending publish (no submissionId) is stamped as the daily pick (ticket 0043)", async () => {
  const res = await post({ evaluation: freshEvaluation("pick") });
  expect(res.status).toBe(201);
  const data = (await res.json()) as { item: { dailyPickAt: number | null } };
  expect(data.item.dailyPickAt).toBeGreaterThan(0);
});

test("a submission publish (submissionId set) is NOT a daily pick — leaves dailyPickAt null", async () => {
  const res = await post({ evaluation: freshEvaluation("sub"), submissionId: "sub_none" });
  expect(res.status).toBe(201);
  const data = (await res.json()) as { item: { dailyPickAt: number | null } };
  expect(data.item.dailyPickAt).toBeNull();
});
