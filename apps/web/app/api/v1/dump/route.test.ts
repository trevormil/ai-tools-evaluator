import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/**
 * The public bulk dump: every published, scored item with its full official
 * evaluation ("take"), README, and metadata — cursor-paginated so a consumer
 * can walk the entire corpus.
 *
 * bun runs every test file in one process and @aix/db is a singleton, so the
 * dump (a global query) also sees rows other suites insert. Every assertion is
 * therefore scoped to a unique MARK prefix; pagination correctness is proven by
 * walking ALL pages and checking our marked rows appear exactly once, in order.
 */
const DB_PATH = `/tmp/aix-dump-test-${process.pid}.db`;
const MARK = "dumpx";

let GET: typeof import("./route").GET;
let OPTIONS: typeof import("./route").OPTIONS;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

function evalJson(verdict: string, tagline: string) {
  return JSON.stringify({
    schemaVersion: 1,
    verdict,
    tagline,
    body: { whatItIs: "what it is", devilsAdvocate: "the harsh honest take" },
  });
}

function seedItem(i: number, opts: { kind?: string; published?: boolean; pending?: boolean } = {}) {
  db.insert(schema.items)
    .values({
      id: `${MARK}_it${i}`,
      slug: `${MARK}-${i}`,
      kind: opts.kind ?? "github_repo",
      externalId: `${MARK}/${i}`,
      url: `https://github.com/${MARK}/${i}`,
      title: `Dumpx Tool ${i}`,
      tagline: `t${i}`,
      category: "cli-tool",
      integration: "standalone-app",
      verdict: "worthwhile",
      overallScore: 70 + i,
      noiseScore: 10,
      evaluationJson: evalJson("worthwhile", `official take ${i}`),
      readmeMd: `# Dumpx ${i}\n\nReadme body ${i}.`,
      published: opts.published ?? true,
      scoreStatus: opts.pending ? "pending" : "scored",
      // Distinct + far-future so our rows sort as the newest in the shared DB.
      createdAt: 1_900_000_000 + i,
    })
    .run();
}

function get(url: string) {
  return GET(new Request(url));
}

type DumpItem = {
  externalId: string;
  slug: string;
  kind: string;
  tagline: string;
  readmeMd: string | null;
  evaluation: { verdict?: string; tagline?: string };
};
type DumpResp = { items: DumpItem[]; count: number; nextCursor: string | null };

/** Walk the whole endpoint via nextCursor, returning only our marked rows. */
async function walkMine(qs: string): Promise<DumpItem[]> {
  const all: DumpItem[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 200; guard++) {
    const sep = qs.includes("?") ? "&" : "?";
    const url = `http://x/api/v1/dump${qs}${cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await get(url);
    expect(res.status).toBe(200);
    const data = (await res.json()) as DumpResp;
    all.push(...data.items);
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all.filter((it) => it.externalId?.startsWith(`${MARK}/`));
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  schema = await import("@aix/db");
  ({ GET, OPTIONS } = await import("./route"));
  runMigrations();
  db = schema.getDb();

  for (let i = 0; i < 4; i++) seedItem(i); // 4 published, scored repos
  seedItem(4, { published: false }); // excluded: unpublished
  seedItem(5, { pending: true }); // excluded: pending (no real eval yet)
  seedItem(6, { kind: "arxiv_paper" }); // published paper
});

test("dumps every published+scored item exactly once, excluding unpublished and pending", async () => {
  const mine = await walkMine("?limit=2"); // tiny page → forces multiple cursor hops
  const slugs = mine.map((it) => it.slug);
  expect(new Set(slugs).size).toBe(slugs.length); // no dupes across page boundaries
  expect(slugs.sort()).toEqual(["dumpx-0", "dumpx-1", "dumpx-2", "dumpx-3", "dumpx-6"]);
  expect(slugs).not.toContain("dumpx-4"); // unpublished
  expect(slugs).not.toContain("dumpx-5"); // pending
});

test("each item carries the official evaluation take, README, and metadata", async () => {
  const mine = await walkMine("?limit=50");
  const one = mine.find((it) => it.slug === "dumpx-3")!;
  expect(one).toBeDefined();
  expect(one.evaluation.verdict).toBe("worthwhile");
  expect(one.evaluation.tagline).toBe("official take 3");
  expect(one.readmeMd).toContain("Readme body 3");
  expect(one.tagline).toBe("t3");
  expect(one.kind).toBe("github_repo");
});

test("items come back newest-first (createdAt desc)", async () => {
  const mine = await walkMine("?limit=2");
  expect(mine.map((it) => it.slug)).toEqual([
    "dumpx-6",
    "dumpx-3",
    "dumpx-2",
    "dumpx-1",
    "dumpx-0",
  ]);
});

test("kind filter narrows the dump", async () => {
  const repos = await walkMine("?limit=50&kind=github_repo");
  expect(repos.every((it) => it.kind === "github_repo")).toBe(true);
  expect(repos.map((it) => it.slug).sort()).toEqual(["dumpx-0", "dumpx-1", "dumpx-2", "dumpx-3"]);
  const papers = await walkMine("?limit=50&kind=arxiv_paper");
  expect(papers.map((it) => it.slug)).toEqual(["dumpx-6"]);
});

test("page size never exceeds limit and nextCursor is set while more remain", async () => {
  const res = await get("http://x/api/v1/dump?limit=1");
  const data = (await res.json()) as DumpResp;
  expect(data.items.length).toBeLessThanOrEqual(1);
  expect(data.count).toBe(data.items.length);
  expect(data.nextCursor).toBeTruthy(); // ≥6 published rows exist → more pages
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});

test("a malformed cursor is rejected with 400", async () => {
  const res = await get("http://x/api/v1/dump?cursor=%%%not-base64%%%");
  expect(res.status).toBe(400);
});

test("a non-numeric limit falls back to the default instead of erroring", async () => {
  const res = await get("http://x/api/v1/dump?limit=abc");
  expect(res.status).toBe(200);
  const data = (await res.json()) as DumpResp;
  expect(data.items.length).toBeGreaterThan(0);
});

test("OPTIONS preflight returns 204 with CORS", () => {
  const res = OPTIONS();
  expect(res.status).toBe(204);
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});
