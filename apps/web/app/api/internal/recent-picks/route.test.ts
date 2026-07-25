import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { PICK_COOLDOWN_DAYS } from "@aix/core";

/**
 * Ticket 0078: the scanner needs to know which categories were featured recently
 * so the daily pick can't be the same category on consecutive days.
 */
const DB_PATH = `/tmp/aix-recent-picks-test-${process.pid}.db`;
const TOKEN = "recent-picks-test-token";
const DAY = 86_400;

let GET: typeof import("./route").GET;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

const nowSec = Math.floor(Date.now() / 1000);

function item(id: string, over: Record<string, unknown>) {
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

function req(qs = "") {
  return GET(
    new Request(`http://internal/api/internal/recent-picks${qs}`, {
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

  // Shared singleton test DB — neutralize picks other suites may have seeded.
  db.update(schema.items).set({ dailyPickAt: null }).run();

  db.insert(schema.items)
    .values(item("rp-today", { category: "rag", dailyPickAt: nowSec }))
    .run();
  db.insert(schema.items)
    // 25h ago — inside the default 3-day window, outside a 1-day one.
    .values(item("rp-yesterday", { category: "devtools", dailyPickAt: nowSec - DAY - 3600 }))
    .run();
  // Outside any sane cooldown window — must not be reported.
  db.insert(schema.items)
    .values(item("rp-ancient", { category: "notetaking", dailyPickAt: nowSec - 30 * DAY }))
    .run();
  // Never featured — must not be reported even though it exists.
  db.insert(schema.items)
    .values(item("rp-unfeatured", { category: "security", dailyPickAt: null }))
    .run();
});

test("reports the categories featured inside the cooldown window, deduped", async () => {
  const res = await req();
  expect(res.status).toBe(200);
  const data = (await res.json()) as { days: number; categories: string[] };
  expect(data.days).toBe(PICK_COOLDOWN_DAYS);
  expect([...data.categories].sort()).toEqual(["devtools", "rag"]);
  expect(data.categories).not.toContain("notetaking"); // 30 days ago
  expect(data.categories).not.toContain("security"); // never featured
});

test("?days= narrows the window", async () => {
  const data = (await (await req("?days=1")).json()) as { days: number; categories: string[] };
  expect(data.days).toBe(1);
  expect(data.categories).toEqual(["rag"]);
});

test("requires the internal token", async () => {
  const res = await GET(new Request("http://internal/api/internal/recent-picks"));
  expect(res.status).toBe(401);
});
