import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** GET /api/submissions (ticket 0061 support): the viewer's own submissions. */
const DB_PATH = `/tmp/aix-mysubs-test-${process.pid}.db`;

let GET: (req: Request) => Promise<Response>;
let token: string;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, users, submissions } = await import("@aix/db");
  const { createSession } = await import("@/lib/auth");
  const mod = await import("./route");
  GET = (mod as unknown as { GET: typeof GET }).GET;
  runMigrations();
  const db = getDb();

  const me = db
    .insert(users)
    .values({ id: "subs-user", username: "subs-user", displayName: "S" })
    .returning()
    .get();
  const other = db
    .insert(users)
    .values({ id: "subs-other", username: "subs-other", displayName: "O" })
    .returning()
    .get();
  token = createSession(me.id).token;

  db.insert(submissions)
    .values({ url: "https://github.com/subs/mine", source: "web", submittedById: me.id, status: "queued" })
    .run();
  db.insert(submissions)
    .values({ url: "https://github.com/subs/theirs", source: "web", submittedById: other.id, status: "queued" })
    .run();
});

test("returns only the viewer's submissions, newest first", async () => {
  const res = await GET(
    new Request("https://x/api/submissions", { headers: { authorization: `Bearer ${token}` } }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  const urls = body.submissions.map((s: { url: string }) => s.url);
  expect(urls).toContain("https://github.com/subs/mine");
  expect(urls).not.toContain("https://github.com/subs/theirs");
});

test("no auth → 401", async () => {
  const res = await GET(new Request("https://x/api/submissions"));
  expect(res.status).toBe(401);
});
