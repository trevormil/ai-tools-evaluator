import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { eq } from "drizzle-orm";

const DB_PATH = `/tmp/aix-submissions-test-${process.pid}.db`;
const TOKEN = "submissions-test-token";

let GET: typeof import("./route").GET;
let PATCH: typeof import("./[id]/route").PATCH;
let schema: typeof import("@aix/db");
let db: ReturnType<typeof import("@aix/db").getDb>;

const now = () => Math.floor(Date.now() / 1000);

function get(query = "status=queued") {
  return GET(
    new Request(`http://internal/api/internal/submissions?${query}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    }),
  );
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://internal/api/internal/submissions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function insertSubmission(opts: {
  id: string;
  status: (typeof import("@aix/db").submissions.$inferInsert)["status"];
  createdAt?: number;
  processedAt?: number | null;
}) {
  db.insert(schema.submissions)
    .values({
      id: opts.id,
      url: `https://github.com/acme/${opts.id}`,
      source: "api",
      status: opts.status,
      createdAt: opts.createdAt ?? now(),
      processedAt: opts.processedAt ?? null,
    })
    .run();
}

function statusOf(id: string): { status: string; processedAt: number | null } {
  return db
    .select({ status: schema.submissions.status, processedAt: schema.submissions.processedAt })
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .get()!;
}

beforeAll(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(DB_PATH + s, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = TOKEN;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ GET } = await import("./route"));
  ({ PATCH } = await import("./[id]/route"));
  runMigrations();
  db = schema.getDb();
});

test("listing queued reclaims stale 'processing' submissions back to queued (0056)", async () => {
  const HOUR = 3600;
  // Died mid-flight an hour ago — must be reclaimed and appear in the drain list.
  insertSubmission({ id: "stale", status: "processing", processedAt: now() - HOUR });
  // Picked up seconds ago by a live run — must be left alone.
  insertSubmission({ id: "fresh", status: "processing", processedAt: now() - 5 });
  // Marked processing by an older server that stamped no pickup time (the colibri
  // shape): falls back to createdAt for staleness.
  insertSubmission({
    id: "legacy",
    status: "processing",
    processedAt: null,
    createdAt: now() - HOUR,
  });

  const res = await get();
  expect(res.status).toBe(200);
  const body = await res.json();
  const ids = body.submissions.map((s: { id: string }) => s.id);

  expect(ids).toContain("stale");
  expect(ids).toContain("legacy");
  expect(ids).not.toContain("fresh");
  expect(statusOf("stale").status).toBe("queued");
  expect(statusOf("legacy").status).toBe("queued");
  expect(statusOf("fresh").status).toBe("processing");
});

test("listing a non-queued status does not reclaim anything", async () => {
  insertSubmission({ id: "stale2", status: "processing", processedAt: now() - 7200 });
  const res = await get("status=failed");
  expect(res.status).toBe(200);
  expect(statusOf("stale2").status).toBe("processing");
});

test("PATCH to 'processing' stamps processedAt so staleness is measurable", async () => {
  insertSubmission({ id: "picked", status: "queued" });
  const res = await patch("picked", { status: "processing" });
  expect(res.status).toBe(200);
  const row = statusOf("picked");
  expect(row.status).toBe("processing");
  expect(row.processedAt).toBeGreaterThan(now() - 60);
});

test("rejects unauthorized requests", async () => {
  const res = await GET(new Request("http://internal/api/internal/submissions"));
  expect(res.status).toBe(401);
});
