import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Nightly recap (ticket 0040): the day's verdicts, editorially framed. */
const DB_PATH = `/tmp/aix-recap-test-${process.pid}.db`;

let getRecap: typeof import("./recap").getRecap;
let latestRecapDate: typeof import("./recap").latestRecapDate;
let recentRecapDates: typeof import("./recap").recentRecapDates;
let db: ReturnType<typeof import("@aix/db").getDb>;

// Two UTC days of judgments. Noon UTC keeps them unambiguous across timezones.
const DAY1 = Math.floor(Date.parse("2026-07-05T12:00:00Z") / 1000);
const DAY2 = Math.floor(Date.parse("2026-07-06T12:00:00Z") / 1000);

function insertItem(
  o: {
    id: string;
    slug: string;
    verdict: string;
    score: number;
    noise: number;
    scoredAt: number | null;
    status?: string;
  },
  extra: Record<string, unknown> = {},
) {
  const { items } = require("@aix/db");
  db.insert(items)
    .values({
      id: o.id,
      slug: o.slug,
      kind: "github_repo",
      externalId: `x/${o.slug}`,
      url: `https://github.com/x/${o.slug}`,
      title: o.slug.toUpperCase(),
      tagline: `${o.slug} tagline`,
      category: "cli-tool",
      integration: "standalone-app",
      verdict: o.verdict,
      overallScore: o.score,
      noiseScore: o.noise,
      evaluationJson: "{}",
      published: true,
      scoreStatus: o.status ?? "scored",
      scoredAt: o.scoredAt,
      createdAt: o.scoredAt ?? DAY2,
      ...extra,
    })
    .run();
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  const schema = await import("@aix/db");
  ({ getRecap, latestRecapDate, recentRecapDates } = await import("./recap"));
  runMigrations();
  db = schema.getDb();

  // DAY2: three judged tools — one essential (the lead), one trap (highest noise), one niche.
  insertItem({
    id: "d2_ess",
    slug: "aces",
    verdict: "essential",
    score: 91,
    noise: 5,
    scoredAt: DAY2,
  });
  insertItem({
    id: "d2_trap",
    slug: "trapzilla",
    verdict: "complexity-trap",
    score: 38,
    noise: 84,
    scoredAt: DAY2 + 100,
  });
  insertItem({
    id: "d2_niche",
    slug: "nichey",
    verdict: "niche",
    score: 60,
    noise: 30,
    scoredAt: DAY2 + 200,
  });
  // A pending submission created on DAY2 but NOT yet judged — must not appear.
  insertItem({
    id: "d2_pend",
    slug: "waiting",
    verdict: "niche",
    score: 0,
    noise: 0,
    scoredAt: null,
    status: "pending",
  });
  // DAY1: one tool, judged the previous day — separate recap.
  insertItem({
    id: "d1_wor",
    slug: "yesterday",
    verdict: "worthwhile",
    score: 72,
    noise: 20,
    scoredAt: DAY1,
  });
});

test("getRecap groups a UTC day's JUDGED items only (no pending, no other days)", () => {
  const r = getRecap("2026-07-06");
  expect(r).not.toBeNull();
  expect(r!.date).toBe("2026-07-06");
  expect(r!.items.map((i) => i.slug).sort()).toEqual(["aces", "nichey", "trapzilla"]);
  expect(r!.total).toBe(3);
});

test("verdict counts summarize the night", () => {
  const r = getRecap("2026-07-06")!;
  expect(r.verdictCounts.essential).toBe(1);
  expect(r.verdictCounts["complexity-trap"]).toBe(1);
  expect(r.verdictCounts.niche).toBe(1);
  expect(r.verdictCounts.worthwhile ?? 0).toBe(0);
});

test("the lead pick is the highest-scoring tool of the day", () => {
  const r = getRecap("2026-07-06")!;
  expect(r.leadPick?.slug).toBe("aces");
});

test("the complexity trap of the night is the noisiest trap/redundant verdict", () => {
  const r = getRecap("2026-07-06")!;
  expect(r.complexityTrap?.slug).toBe("trapzilla");
});

test("empty day returns null (no recap to send)", () => {
  expect(getRecap("2026-07-04")).toBeNull();
});

test("latestRecapDate + recentRecapDates reflect the judged days, newest first", () => {
  expect(latestRecapDate()).toBe("2026-07-06");
  expect(recentRecapDates(10)).toEqual(["2026-07-06", "2026-07-05"]);
});
