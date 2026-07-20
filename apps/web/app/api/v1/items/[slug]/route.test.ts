import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** GET /api/v1/items/[slug]: evaluation + readmeMd (README tab for native clients). */
const DB_PATH = `/tmp/aix-itemdetail-test-${process.pid}.db`;

let GET: (req: Request, ctx: { params: Promise<{ slug: string }> }) => Promise<Response>;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, items } = await import("@aix/db");
  ({ GET } = await import("./route"));
  runMigrations();

  getDb()
    .insert(items)
    .values({
      id: "itemdetail-1",
      slug: "itemdetail-tool",
      kind: "github_repo",
      externalId: "itemdetail/tool",
      url: "https://github.com/itemdetail/tool",
      title: "ItemDetail Tool",
      tagline: "t",
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 70,
      noiseScore: 10,
      evaluationJson: JSON.stringify({ slug: "itemdetail-tool" }),
      readmeMd: "# Hello readme",
      coverImageUrl: "https://raw.githubusercontent.com/x/y/logo.png",
      published: true,
      scoreStatus: "scored",
    })
    .run();
});

test("returns the evaluation plus the repo README as markdown AND rendered HTML", async () => {
  const res = await GET(new Request("https://x/api/v1/items/itemdetail-tool"), {
    params: Promise.resolve({ slug: "itemdetail-tool" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.evaluation.slug).toBe("itemdetail-tool");
  expect(body.readmeMd).toBe("# Hello readme");
  // Rendered with the site's safe renderer (markdown-it, html:false).
  expect(body.readmeHtml).toContain("<h1>Hello readme</h1>");
  // Canonical display cover — clients must not read evaluation.media[0].
  expect(body.coverImageUrl).toContain("logo.png");
});
