import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** countItems (ticket 0028): the directory must report true totals per filter. */
const DB_PATH = `/tmp/aix-queries-test-${process.pid}.db`;

let countItems: typeof import("./queries").countItems;
let listItems: typeof import("./queries").listItems;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const { getDb, items } = await import("@aix/db");
  ({ countItems, listItems } = await import("./queries"));
  runMigrations();
  const db = getDb();

  for (let i = 0; i < 7; i++) {
    db.insert(items)
      .values({
        id: `it${i}`,
        slug: `tool-${i}`,
        kind: "github_repo",
        externalId: `t/${i}`,
        url: `https://github.com/t/${i}`,
        title: `QCount Tool ${i}`,
        tagline: "t",
        category: i < 4 ? "cli-tool" : "library",
        integration: "standalone-app",
        verdict: i % 2 === 0 ? "worthwhile" : "niche",
        overallScore: 50 + i,
        noiseScore: 10,
        evaluationJson: "{}",
        published: i !== 6, // one unpublished
      })
      .run();
  }
});

test("shuffledTools deals a shuffled, scored-only, published deck (ticket 0038)", async () => {
  const { shuffledTools } = await import("./queries");
  const deck = shuffledTools(100);
  expect(deck.length).toBeGreaterThan(0);
  for (const item of deck) {
    expect(item.published).toBe(true);
    expect(item.scoreStatus).toBe("scored"); // pending rows have nothing to learn yet
  }
  expect(deck.map((i) => i.slug)).not.toContain("tool-6"); // the unpublished row
  // Limit is respected.
  expect(shuffledTools(3).length).toBe(3);
});

// Scoped by a unique search needle: bun runs all test files in one process, so
// the @aix/db singleton shares one DB across suites — global counts would race.
test("countItems reports the true filtered total, beyond any page limit", () => {
  expect(countItems({ q: "qcount" })).toBe(6); // published only
  expect(countItems({ q: "qcount", category: "cli-tool" })).toBe(4);
  expect(countItems({ q: "qcount", verdict: "niche" })).toBe(3);
  // The limit caps the page, never the count.
  expect(listItems({ q: "qcount", limit: 2 }).length).toBe(2);
  expect(countItems({ q: "qcount" })).toBe(6);
});
