import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deriveSource } from "./queue";

/** The submission queue strip (ADR-0004): content/queue/*.json → enriched views. */
let listQueued: typeof import("./queue").listQueued;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "aix-queue-"));
  writeFileSync(
    join(dir, "a.json"),
    JSON.stringify({
      url: "https://github.com/acme/supertool",
      source: "web",
      submittedAt: "2026-07-10T00:00:00Z",
    }),
  );
  writeFileSync(
    join(dir, "b.json"),
    JSON.stringify({
      url: "https://arxiv.org/abs/2210.03629",
      source: "web",
      submittedAt: "2026-07-11T00:00:00Z",
    }),
  );
  writeFileSync(join(dir, "bad.json"), "{ not json");
  process.env.AIX_QUEUE_DIR = dir;
  ({ listQueued } = await import("./queue"));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("deriveSource classifies github / arxiv / external urls", () => {
  const gh = deriveSource("https://github.com/BurntSushi/ripgrep");
  expect(gh.title).toBe("ripgrep");
  expect(gh.coverImageUrl).toMatch(
    /^https:\/\/opengraph\.githubassets\.com\/[a-f0-9]{32}\/BurntSushi\/ripgrep$/,
  );
  expect(deriveSource("https://arxiv.org/abs/2210.03629").title).toBe("arXiv:2210.03629");
  expect(deriveSource("https://zed.dev/x").title).toBe("zed.dev");
});

test("listQueued reads queue files newest-first, enriched, skipping malformed", () => {
  const rows = listQueued();
  expect(rows.map((r) => r.title)).toEqual(["arXiv:2210.03629", "supertool"]);
  expect(rows[1]!.coverImageUrl).toContain("opengraph.githubassets.com/");
});
