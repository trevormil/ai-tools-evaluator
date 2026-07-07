import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

const DB_PATH = `/tmp/aix-known-test-${process.pid}.db`;
const TOKEN = "known-test-token";

let POST: typeof import("./route").POST;
let schema: typeof import("@aix/db");
let db: ReturnType<typeof import("@aix/db").getDb>;

function post(body: unknown, token: string | null = TOKEN) {
  return POST(
    new Request("http://internal/api/internal/items/known", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function insertItem(id: string, kind: string, externalId: string, scoreStatus = "scored") {
  db.insert(schema.items)
    .values({
      id,
      slug: id,
      kind,
      externalId,
      url: `https://example.com/${externalId}`,
      title: externalId,
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 60,
      noiseScore: 20,
      tagline: "a tagline",
      evaluationJson: "{}",
      scoreStatus,
    })
    .run();
}

beforeAll(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(DB_PATH + s, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = TOKEN;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ POST } = await import("./route"));
  runMigrations();
  db = schema.getDb();

  insertItem("it_scored", "github_repo", "acme/scored");
  insertItem("it_pending", "github_repo", "acme/pending", "pending");
});

test("returns scored externalIds as known; pending and unseen are excluded", async () => {
  const res = await post({
    candidates: [
      { kind: "github_repo", externalId: "acme/scored" },
      { kind: "github_repo", externalId: "acme/pending" },
      { kind: "github_repo", externalId: "acme/brand-new" },
    ],
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.known).toEqual(["acme/scored"]);
});

test("matches on (kind, externalId) — same id, different kind is not known", async () => {
  const res = await post({ candidates: [{ kind: "arxiv_paper", externalId: "acme/scored" }] });
  const body = await res.json();
  expect(body.known).toEqual([]);
});

test("rejects unauthorized requests", async () => {
  const res = await post({ candidates: [] }, null);
  expect(res.status).toBe(401);
});
