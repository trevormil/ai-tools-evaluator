import { test, expect } from "bun:test";
import type { Item } from "@aix/db";
import { countItems, listItems, getItemBySlug, dumpItems } from "./queries";

/**
 * The read layer is pure over an injected corpus (ADR-0004) — no DB, no file IO.
 * Filters/sort/paging are tested against hand-built Item arrays.
 */
function item(o: Partial<Item> & { slug: string }): Item {
  return {
    id: o.slug,
    kind: "github_repo",
    externalId: `t/${o.slug}`,
    url: `https://github.com/t/${o.slug}`,
    title: `QCount ${o.slug}`,
    category: "cli-tool",
    integration: "standalone-app",
    verdict: "worthwhile",
    primaryAudience: null,
    aiEngineerFit: null,
    vibeCoderFit: null,
    overallScore: 50,
    noiseScore: 10,
    tagline: "a terse hook",
    tagsJson: "[]",
    evaluationJson: "{}",
    mediaJson: "[]",
    coverImageUrl: null,
    readmeMd: null,
    evaluatedBy: "ai",
    model: null,
    published: true,
    scoreStatus: "scored",
    scoredAt: 0,
    dailyPickAt: null,
    score: 0,
    upvotes: 0,
    commentCount: 0,
    createdAt: 0,
    ...o,
  } as Item;
}

const corpus: Item[] = [
  item({ slug: "a", category: "cli-tool", verdict: "worthwhile", overallScore: 50, createdAt: 1 }),
  item({ slug: "b", category: "cli-tool", verdict: "niche", overallScore: 51, createdAt: 2 }),
  item({ slug: "c", category: "cli-tool", verdict: "worthwhile", overallScore: 52, createdAt: 3 }),
  item({ slug: "d", category: "cli-tool", verdict: "niche", overallScore: 53, createdAt: 4 }),
  item({ slug: "e", category: "library", verdict: "worthwhile", overallScore: 54, createdAt: 5 }),
  item({ slug: "f", category: "library", verdict: "niche", overallScore: 55, createdAt: 6 }),
];

test("countItems reports the true filtered total, beyond any page limit", () => {
  expect(countItems({ q: "qcount" }, corpus)).toBe(6);
  expect(countItems({ q: "qcount", category: "cli-tool" }, corpus)).toBe(4);
  expect(countItems({ q: "qcount", verdict: "niche" }, corpus)).toBe(3);
  expect(countItems({ minScore: 53 }, corpus)).toBe(3);
  // The limit caps the page, never the count.
  expect(listItems({ q: "qcount", limit: 2 }, corpus).length).toBe(2);
});

test("listItems sorts: 'top'/'hot' by score desc, 'new' by createdAt desc", () => {
  expect(listItems({ sort: "top" }, corpus).map((i) => i.slug)).toEqual([
    "f",
    "e",
    "d",
    "c",
    "b",
    "a",
  ]);
  expect(listItems({ sort: "new" }, corpus)[0]!.slug).toBe("f");
});

test("getItemBySlug finds by slug", () => {
  expect(getItemBySlug("c", corpus)?.overallScore).toBe(52);
  expect(getItemBySlug("nope", corpus)).toBeUndefined();
});

test("dumpItems pages newest-first with a stable cursor", () => {
  const p1 = dumpItems({ limit: 3 }, corpus);
  expect(p1.items.map((i) => i.slug)).toEqual(["f", "e", "d"]);
  expect(p1.nextCursor).not.toBeNull();
  const p2 = dumpItems({ limit: 3, cursor: p1.nextCursor! }, corpus);
  expect(p2.items.map((i) => i.slug)).toEqual(["c", "b", "a"]);
  expect(p2.nextCursor).toBeNull();
});
