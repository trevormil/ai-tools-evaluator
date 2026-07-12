import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** The corpus loader (ADR-0004): parse content/items/*.md → Item[], tolerantly. */
let loadCorpus: typeof import("./corpus").loadCorpus;
let _resetCorpus: typeof import("./corpus")._resetCorpus;
let dir: string;

/** A minimal valid `.md` artifact: prose + the canonical JSON block at the end. */
function artifact(e: Record<string, unknown>): string {
  return `# ${(e.source as { title: string }).title}\n\nblurb\n\n\`\`\`json\n${JSON.stringify(e)}\n\`\`\`\n`;
}

function evalObj(slug: string, over: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    slug,
    source: {
      kind: "github_repo",
      externalId: `o/${slug}`,
      url: `https://github.com/o/${slug}`,
      title: slug,
    },
    category: "cli-tool",
    integration: "standalone-app",
    tags: ["cli"],
    verdict: "worthwhile",
    noiseScore: 10,
    audience: { primary: "ai-engineer", aiEngineerFit: 80, vibeCoderFit: 30 },
    scores: {},
    overallScore: 77,
    tagline: "a terse hook line",
    body: { whatItIs: "x" },
    media: [{ type: "image", url: "https://img/x.png" }],
    evaluatedBy: "ai",
    evaluatedAt: "2026-07-06T12:00:00.000Z",
    ...over,
  };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "aix-corpus-"));
  writeFileSync(join(dir, "alpha.md"), artifact(evalObj("alpha", { overallScore: 90 })));
  writeFileSync(join(dir, "beta.md"), artifact(evalObj("beta", { overallScore: 40 })));
  writeFileSync(join(dir, "broken.md"), "# Broken\n\nno json block here\n");
  process.env.AIX_CONTENT_DIR = dir;
  ({ loadCorpus, _resetCorpus } = await import("./corpus"));
  _resetCorpus();
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("loadCorpus parses each artifact's canonical JSON into an Item", () => {
  const items = loadCorpus();
  const alpha = items.find((i) => i.slug === "alpha")!;
  expect(alpha).toBeDefined();
  expect(alpha.overallScore).toBe(90);
  expect(alpha.kind).toBe("github_repo");
  expect(alpha.externalId).toBe("o/alpha");
  expect(alpha.scoreStatus).toBe("scored");
  // createdAt/scoredAt derive from evaluatedAt.
  expect(alpha.scoredAt).toBe(Math.floor(Date.parse("2026-07-06T12:00:00.000Z") / 1000));
  // cover comes from the first image media asset.
  expect(alpha.coverImageUrl).toBe("https://img/x.png");
});

test("a malformed artifact is skipped, not fatal", () => {
  const items = loadCorpus();
  expect(items.map((i) => i.slug).sort()).toEqual(["alpha", "beta"]);
});
