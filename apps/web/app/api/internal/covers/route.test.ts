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

  const mk = (slug: string, cover: string | null, media: unknown[] = []) =>
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
        mediaJson: JSON.stringify(
          media.length ? media : cover ? [{ type: "image", url: cover }] : [],
        ),
        published: true,
      })
      .run();

  // User avatar cover BUT a real README screenshot in the gallery → promoted.
  mk("cov-face", "https://github.com/some-person.png?size=200", [
    { type: "image", url: "https://github.com/some-person.png?size=200", source: "repo-avatar" },
    { type: "image", url: "https://raw.githubusercontent.com/a/b/shot.png", source: "repo-readme" },
    {
      type: "image",
      url: "https://opengraph.githubassets.com/1/a/b",
      source: "repo-social-preview",
    },
  ]);
  mk("cov-logo", "https://github.com/org-arize.png?size=200"); // Org avatar → kept
  // Placeholder cover, nothing else usable (svg + social only) → cleared.
  mk("cov-placehold", "https://placehold.co/1200x630/0b1020/e2e8f0.png?text=X", [
    { type: "image", url: "https://placehold.co/1200x630/0b1020/e2e8f0.png?text=X" },
    { type: "image", url: "https://raw.githubusercontent.com/a/b/logo.svg", source: "repo-readme" },
    {
      type: "image",
      url: "https://opengraph.githubassets.com/1/a/b",
      source: "repo-social-preview",
    },
  ]);
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

test("promotes README imagery over selfies, clears junk, keeps real covers", async () => {
  const res = await request();
  expect(res.status).toBe(200);
  const body = await res.json();
  const bySlug = Object.fromEntries(
    body.changes.map((c: { slug: string; cover: string | null }) => [c.slug, c.cover]),
  );
  // Selfie cover with a README screenshot available → promoted, not cleared.
  expect(bySlug["cov-face"]).toBe("https://raw.githubusercontent.com/a/b/shot.png");
  // Placeholder with only svg/social alternatives → cleared to monogram.
  expect(bySlug["cov-placehold"]).toBeNull();
  // Untouched: org logo + real image covers.
  expect(bySlug).not.toHaveProperty("cov-logo");
  expect(bySlug).not.toHaveProperty("cov-real");

  const { getDb, items } = await import("@aix/db");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  expect(db.select().from(items).where(eq(items.slug, "cov-face")).get()?.coverImageUrl).toContain(
    "shot.png",
  );
  expect(db.select().from(items).where(eq(items.slug, "cov-logo")).get()?.coverImageUrl).toContain(
    "org-arize",
  );

  // Idempotent: a second run changes nothing.
  const again = await (await request()).json();
  expect(again.changed).toBe(0);
});

test("wrong internal token → 401", async () => {
  expect((await request("nope")).status).toBe(401);
});
