import { test, expect } from "bun:test";
import type { Item } from "@aix/db";
import { getRecap, latestRecapDate, recentRecapDates } from "./recap";

/** Nightly recap (ticket 0040): the day's verdicts, grouped from the git corpus. */

// Two UTC days of judgments. Noon UTC keeps them unambiguous across timezones.
const DAY1 = Math.floor(Date.parse("2026-07-05T12:00:00Z") / 1000);
const DAY2 = Math.floor(Date.parse("2026-07-06T12:00:00Z") / 1000);

function item(o: {
  slug: string;
  verdict: string;
  score: number;
  noise: number;
  scoredAt: number | null;
}): Item {
  return {
    id: o.slug,
    slug: o.slug,
    kind: "github_repo",
    externalId: `x/${o.slug}`,
    url: `https://github.com/x/${o.slug}`,
    title: o.slug.toUpperCase(),
    category: "cli-tool",
    integration: "standalone-app",
    verdict: o.verdict,
    primaryAudience: null,
    aiEngineerFit: null,
    vibeCoderFit: null,
    overallScore: o.score,
    noiseScore: o.noise,
    tagline: `${o.slug} tagline`,
    tagsJson: "[]",
    evaluationJson: "{}",
    mediaJson: "[]",
    coverImageUrl: null,
    readmeMd: null,
    evaluatedBy: "ai",
    model: null,
    published: true,
    scoreStatus: "scored",
    scoredAt: o.scoredAt,
    dailyPickAt: null,
    score: 0,
    upvotes: 0,
    commentCount: 0,
    createdAt: o.scoredAt ?? DAY2,
  } as Item;
}

const corpus: Item[] = [
  // DAY2: three judged tools — one essential (lead), one trap (noisiest), one niche.
  item({ slug: "aces", verdict: "essential", score: 91, noise: 5, scoredAt: DAY2 }),
  item({
    slug: "trapzilla",
    verdict: "complexity-trap",
    score: 38,
    noise: 84,
    scoredAt: DAY2 + 100,
  }),
  item({ slug: "nichey", verdict: "niche", score: 60, noise: 30, scoredAt: DAY2 + 200 }),
  // An item with no scoredAt must not appear in any recap.
  item({ slug: "unscored", verdict: "niche", score: 0, noise: 0, scoredAt: null }),
  // DAY1: one tool, judged the previous day — a separate recap.
  item({ slug: "yesterday", verdict: "worthwhile", score: 72, noise: 20, scoredAt: DAY1 }),
];

test("getRecap groups a UTC day's judged items only (no unscored, no other days)", () => {
  const r = getRecap("2026-07-06", corpus)!;
  expect(r).not.toBeNull();
  expect(r.date).toBe("2026-07-06");
  expect(r.items.map((i) => i.slug).sort()).toEqual(["aces", "nichey", "trapzilla"]);
  expect(r.total).toBe(3);
});

test("verdict counts summarize the night", () => {
  const r = getRecap("2026-07-06", corpus)!;
  expect(r.verdictCounts.essential).toBe(1);
  expect(r.verdictCounts["complexity-trap"]).toBe(1);
  expect(r.verdictCounts.niche).toBe(1);
  expect(r.verdictCounts.worthwhile ?? 0).toBe(0);
});

test("the lead pick is the highest-scoring tool of the day", () => {
  expect(getRecap("2026-07-06", corpus)!.leadPick?.slug).toBe("aces");
});

test("the complexity trap of the night is the noisiest trap/redundant verdict", () => {
  expect(getRecap("2026-07-06", corpus)!.complexityTrap?.slug).toBe("trapzilla");
});

test("empty day returns null (no recap)", () => {
  expect(getRecap("2026-07-04", corpus)).toBeNull();
});

test("latestRecapDate + recentRecapDates reflect judged days, newest first", () => {
  expect(latestRecapDate(corpus)).toBe("2026-07-06");
  expect(recentRecapDates(10, corpus)).toEqual(["2026-07-06", "2026-07-05"]);
});
