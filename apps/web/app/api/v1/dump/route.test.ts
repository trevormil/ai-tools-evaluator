import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * The public bulk dump: every item with its full official evaluation ("take")
 * and metadata, cursor-paginated so a consumer can walk the entire corpus.
 * Reads the git corpus (ADR-0004) from an isolated temp content dir.
 */
let GET: typeof import("./route").GET;
let OPTIONS: typeof import("./route").OPTIONS;
let dir: string;

function artifact(e: Record<string, unknown>): string {
  return `# ${(e.source as { title: string }).title}\n\n\`\`\`json\n${JSON.stringify(e)}\n\`\`\`\n`;
}

function evalObj(i: number, kind = "github_repo", at = `2026-07-01T0${i}:00:00.000Z`) {
  const slug = `dumpx-${i}`;
  return {
    schemaVersion: 1,
    slug,
    source: {
      kind,
      externalId: `dumpx/${i}`,
      url: `https://github.com/dumpx/${i}`,
      title: `Dumpx ${i}`,
    },
    category: "cli-tool",
    integration: "standalone-app",
    tags: ["cli"],
    verdict: "worthwhile",
    noiseScore: 10,
    audience: { primary: "ai-engineer", aiEngineerFit: 80, vibeCoderFit: 30 },
    scores: {},
    overallScore: 70 + i,
    tagline: `official take ${i}`,
    body: { whatItIs: "what it is", devilsAdvocate: "harsh honest take" },
    media: [],
    evaluatedBy: "ai",
    evaluatedAt: at,
  };
}

function get(url: string) {
  return GET(new Request(url));
}

type DumpItem = {
  externalId: string;
  slug: string;
  kind: string;
  evaluation: { verdict?: string; tagline?: string };
};
type DumpResp = { items: DumpItem[]; count: number; nextCursor: string | null };

async function walk(qs: string): Promise<DumpItem[]> {
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
  return all;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "aix-dump-"));
  for (let i = 0; i < 4; i++) writeFileSync(join(dir, `dumpx-${i}.md`), artifact(evalObj(i)));
  writeFileSync(
    join(dir, "dumpx-6.md"),
    artifact(evalObj(6, "arxiv_paper", "2026-07-06T00:00:00.000Z")),
  );
  process.env.AIX_CONTENT_DIR = dir;
  ({ GET, OPTIONS } = await import("./route"));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("dumps every corpus item exactly once across page boundaries", async () => {
  const mine = await walk("?limit=2"); // tiny page → forces multiple cursor hops
  const slugs = mine.map((it) => it.slug);
  expect(new Set(slugs).size).toBe(slugs.length); // no dupes
  expect(slugs.sort()).toEqual(["dumpx-0", "dumpx-1", "dumpx-2", "dumpx-3", "dumpx-6"]);
});

test("each item carries the official evaluation take + metadata", async () => {
  const mine = await walk("?limit=50");
  const one = mine.find((it) => it.slug === "dumpx-3")!;
  expect(one.evaluation.verdict).toBe("worthwhile");
  expect(one.evaluation.tagline).toBe("official take 3");
  expect(one.kind).toBe("github_repo");
});

test("items come back newest-first (createdAt desc)", async () => {
  const mine = await walk("?limit=2");
  expect(mine.map((it) => it.slug)).toEqual([
    "dumpx-6",
    "dumpx-3",
    "dumpx-2",
    "dumpx-1",
    "dumpx-0",
  ]);
});

test("kind filter narrows the dump", async () => {
  const repos = await walk("?limit=50&kind=github_repo");
  expect(repos.map((it) => it.slug).sort()).toEqual(["dumpx-0", "dumpx-1", "dumpx-2", "dumpx-3"]);
  const papers = await walk("?limit=50&kind=arxiv_paper");
  expect(papers.map((it) => it.slug)).toEqual(["dumpx-6"]);
});

test("page size never exceeds limit and nextCursor is set while more remain", async () => {
  const res = await get("http://x/api/v1/dump?limit=1");
  const data = (await res.json()) as DumpResp;
  expect(data.items.length).toBeLessThanOrEqual(1);
  expect(data.count).toBe(data.items.length);
  expect(data.nextCursor).toBeTruthy();
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
