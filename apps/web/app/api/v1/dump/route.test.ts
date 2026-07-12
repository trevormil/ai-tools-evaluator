import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * The public bulk dump: every item with its full official evaluation ("take")
 * and metadata, returned in ONE static response (ADR-0004 static export — a
 * prerendered handler gets no request params). Reads the git corpus from an
 * isolated temp content dir.
 */
let GET: typeof import("./route").GET;
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

type DumpItem = {
  externalId: string;
  slug: string;
  kind: string;
  evaluation: { verdict?: string; tagline?: string };
};
type DumpResp = { items: DumpItem[]; count: number };

async function dump(): Promise<DumpResp> {
  const res = GET();
  expect(res.status).toBe(200);
  return (await res.json()) as DumpResp;
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "aix-dump-"));
  for (let i = 0; i < 4; i++) writeFileSync(join(dir, `dumpx-${i}.md`), artifact(evalObj(i)));
  writeFileSync(
    join(dir, "dumpx-6.md"),
    artifact(evalObj(6, "arxiv_paper", "2026-07-06T00:00:00.000Z")),
  );
  process.env.AIX_CONTENT_DIR = dir;
  ({ GET } = await import("./route"));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("dumps every corpus item exactly once in a single response", async () => {
  const { items, count } = await dump();
  const slugs = items.map((it) => it.slug);
  expect(new Set(slugs).size).toBe(slugs.length); // no dupes
  expect(count).toBe(items.length);
  expect(slugs.slice().sort()).toEqual(["dumpx-0", "dumpx-1", "dumpx-2", "dumpx-3", "dumpx-6"]);
});

test("each item carries the official evaluation take + metadata", async () => {
  const { items } = await dump();
  const one = items.find((it) => it.slug === "dumpx-3")!;
  expect(one.evaluation.verdict).toBe("worthwhile");
  expect(one.evaluation.tagline).toBe("official take 3");
  expect(one.kind).toBe("github_repo");
});

test("items come back newest-first (createdAt desc)", async () => {
  const { items } = await dump();
  expect(items.map((it) => it.slug)).toEqual([
    "dumpx-6",
    "dumpx-3",
    "dumpx-2",
    "dumpx-1",
    "dumpx-0",
  ]);
});

test("the response carries permissive CORS headers", () => {
  const res = GET();
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
});
