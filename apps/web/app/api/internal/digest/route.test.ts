import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/**
 * The digest endpoint must emit a broad-appeal `pickScore` per item (the bot
 * features the highest pickScore, not the highest overallScore) — computed from
 * the stored evaluation, with a fallback to overallScore for older items.
 */
const DB_PATH = `/tmp/aix-digest-test-${process.pid}.db`;
const TOKEN = "digest-test-token";

let GET: typeof import("./route").GET;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

const nowSec = Math.floor(Date.now() / 1000);

/** An evaluation whose pick signals compute to pickScore 80 (≠ overallScore). */
const richEval = JSON.stringify({
  audience: { aiEngineerFit: 85 },
  scores: {
    utility: { score: 80 },
    traction: { score: 70 },
    easeOfAdoption: { score: 75 },
    composability: { score: 80 },
  },
});

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
    published: true,
    scoreStatus: "scored",
    scoredAt: nowSec,
    createdAt: nowSec,
    ...over,
  };
}

function req() {
  return new Request("http://internal/api/internal/digest?since=2000-01-01T00:00:00.000Z", {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
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

  // Broad item: overallScore 78 but pick signals compute to 80.
  db.insert(schema.items)
    .values(baseItem("broad", { overallScore: 78, evaluationJson: richEval }))
    .run();
  // Legacy item: no audience/scores in the eval → pickScore falls back to overallScore.
  db.insert(schema.items)
    .values(baseItem("legacy", { overallScore: 90, evaluationJson: "{}" }))
    .run();
});

test("each digest item carries a pickScore (computed for rich items)", async () => {
  const res = await GET(req());
  expect(res.status).toBe(200);
  const data = (await res.json()) as {
    items: { slug: string; pickScore: number; overallScore: number }[];
  };
  const broad = data.items.find((i) => i.slug === "broad")!;
  expect(broad.pickScore).toBe(80); // NOT its overallScore of 78
});

test("pickScore falls back to overallScore for items missing the pick signals", async () => {
  const res = await GET(req());
  const data = (await res.json()) as { items: { slug: string; pickScore: number }[] };
  const legacy = data.items.find((i) => i.slug === "legacy")!;
  expect(legacy.pickScore).toBe(90);
});
