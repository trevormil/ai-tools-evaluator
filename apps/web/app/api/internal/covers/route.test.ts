import { test, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { clearOwnerTypeCache } from "@/lib/covers";

/** Cover sanitation backfill (ticket 0073). */
const DB_PATH = `/tmp/aix-covers-test-${process.pid}.db`;

let POST: (req: Request) => Promise<Response>;

const realFetch = globalThis.fetch;

/** GitHub /users/{owner} mock: humans vs orgs by name. */
function mockGithubUsers() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const owner = url.split("/").pop() ?? "";
    return Response.json({ type: owner.startsWith("org-") ? "Organization" : "User" });
  }) as typeof fetch;
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = "covers-test-token";

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, items } = await import("@aix/db");
  ({ POST } = await import("./route"));
  runMigrations();
  const db = getDb();

  const mk = (slug: string, cover: string | null) =>
    db
      .insert(items)
      .values({
        id: `cov-${slug}`,
        slug,
        kind: "github_repo",
        externalId: `cov/${slug}`,
        url: `https://github.com/cov/${slug}`,
        title: slug,
        tagline: "t",
        category: "cli-tool",
        integration: "standalone-app",
        verdict: "worthwhile",
        overallScore: 50,
        noiseScore: 10,
        evaluationJson: "{}",
        coverImageUrl: cover,
        published: true,
      })
      .run();

  mk("cov-face", "https://github.com/some-person.png?size=200"); // User avatar → cleared
  mk("cov-logo", "https://github.com/org-arize.png?size=200"); // Org avatar → kept
  mk("cov-placehold", "https://placehold.co/1200x630/0b1020/e2e8f0.png?text=X"); // → cleared
  mk("cov-real", "https://raw.githubusercontent.com/a/b/logo.png"); // README pick → kept
  mk("cov-none", null);
});

beforeEach(() => {
  clearOwnerTypeCache();
  mockGithubUsers();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const request = (token = "covers-test-token") =>
  POST(
    new Request("https://x/api/internal/covers", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  );

test("clears personal avatars + placeholders, keeps org logos and real images", async () => {
  const res = await request();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.slugs).toContain("cov-face");
  expect(body.slugs).toContain("cov-placehold");
  expect(body.slugs).not.toContain("cov-logo");
  expect(body.slugs).not.toContain("cov-real");

  const { getDb, items } = await import("@aix/db");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  expect(db.select().from(items).where(eq(items.slug, "cov-face")).get()?.coverImageUrl).toBeNull();
  expect(db.select().from(items).where(eq(items.slug, "cov-logo")).get()?.coverImageUrl).toContain(
    "org-arize",
  );

  // Idempotent: a second run clears nothing new.
  const again = await (await request()).json();
  expect(again.cleared).toBe(0);
});

test("wrong internal token → 401", async () => {
  expect((await request("nope")).status).toBe(401);
});
