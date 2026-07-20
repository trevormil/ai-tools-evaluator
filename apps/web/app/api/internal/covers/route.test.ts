import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { pickCover } from "@/lib/covers";

/** Cover selection + backfill (ticket 0073, round 3: avatars are valid fallbacks). */
const DB_PATH = `/tmp/aix-covers-test-${process.pid}.db`;

let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.AIX_INTERNAL_TOKEN = "covers-test-token";

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, items } = await import("@aix/db");
  ({ POST } = await import("./route"));
  runMigrations();
  const db = getDb();

  const mk = (slug: string, cover: string | null, media: unknown[]) =>
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
        mediaJson: JSON.stringify(media),
        published: true,
      })
      .run();

  // Avatar cover but a README screenshot available → README image wins.
  mk("cov-upgrade", "https://github.com/some-person.png?size=200", [
    { type: "image", url: "https://github.com/some-person.png?size=200", source: "repo-avatar" },
    { type: "image", url: "https://raw.githubusercontent.com/a/b/shot.png", source: "repo-readme" },
  ]);
  // Cover was nulled by the earlier over-aggressive pass; only the avatar
  // exists → avatar RESTORED (kepano-obsidian case).
  mk("cov-restore", null, [
    { type: "image", url: "https://github.com/kepano.png?size=200", source: "repo-avatar" },
    {
      type: "image",
      url: "https://opengraph.githubassets.com/1/a/b",
      source: "repo-social-preview",
    },
  ]);
  // Placeholder cover, only svg/social besides → cleared to monogram.
  mk("cov-junk", "https://placehold.co/1200x630/0b1020/e2e8f0.png?text=X", [
    { type: "image", url: "https://placehold.co/1200x630/0b1020/e2e8f0.png?text=X" },
    { type: "image", url: "https://raw.githubusercontent.com/a/b/logo.svg", source: "repo-readme" },
    {
      type: "image",
      url: "https://opengraph.githubassets.com/1/a/b",
      source: "repo-social-preview",
    },
  ]);
  // Already correct → untouched.
  mk("cov-good", "https://raw.githubusercontent.com/a/b/logo.png", [
    { type: "image", url: "https://raw.githubusercontent.com/a/b/logo.png", source: "repo-readme" },
  ]);
});

test("pickCover ranking: README image > avatar > null; junk always skipped", () => {
  expect(
    pickCover([
      { type: "image", url: "https://github.com/x.png", source: "repo-avatar" },
      { type: "image", url: "https://cdn.example/logo.png", source: "repo-readme" },
    ]),
  ).toBe("https://cdn.example/logo.png");
  expect(
    pickCover([{ type: "image", url: "https://github.com/x.png", source: "repo-avatar" }]),
  ).toBe("https://github.com/x.png");
  expect(
    pickCover([
      { type: "image", url: "https://placehold.co/x.png?text=Y" },
      { type: "image", url: "https://a.io/logo.svg", source: "repo-readme" },
      {
        type: "image",
        url: "https://opengraph.githubassets.com/1/a/b",
        source: "repo-social-preview",
      },
    ]),
  ).toBeNull();
});

const request = (token = "covers-test-token") =>
  POST(
    new Request("https://x/api/internal/covers", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  );

test("backfill upgrades, restores, clears, and leaves good covers alone", async () => {
  const res = await request();
  expect(res.status).toBe(200);
  const body = await res.json();
  const bySlug = Object.fromEntries(
    body.changes.map((c: { slug: string; cover: string | null }) => [c.slug, c.cover]),
  );
  expect(bySlug["cov-upgrade"]).toContain("shot.png"); // README beats avatar
  expect(bySlug["cov-restore"]).toContain("kepano.png"); // avatar beats monogram
  expect(bySlug["cov-junk"]).toBeNull(); // junk-only → monogram
  expect(bySlug).not.toHaveProperty("cov-good");

  // Idempotent.
  const again = await (await request()).json();
  expect(again.changed).toBe(0);
});

test("wrong internal token → 401", async () => {
  expect((await request("nope")).status).toBe(401);
});
