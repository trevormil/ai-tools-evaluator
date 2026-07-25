import { test, expect } from "bun:test";
import {
  pickScore,
  pickScoreOf,
  PICK_WEIGHTS,
  PICK_ELIGIBLE_VERDICTS,
  PICK_INELIGIBLE_INTEGRATIONS,
  PICK_COOLDOWN_DAYS,
  PICK_REPEAT_PENALTY,
  isPickEligible,
  isFeaturable,
  selectDailyPick,
} from "./pick";
import type { Evaluation } from "./schema";

/**
 * pickScore (daily-pick tuning, ticket 0078): the featured pick should be a real
 * product or usable tool, NOT the most famous infra primitive we happened to
 * grade. `productShape` carries the most weight; `traction` is gone entirely
 * (double-counted with star-velocity discovery, and it was a fame tax that made
 * vector DBs win 10 of 18 picks).
 */

/** Minimal Evaluation stand-in — only the fields pick logic reads. */
function ev(o: {
  slug: string;
  verdict?: string;
  integration?: string;
  category?: string;
  productShape?: number;
  aiEngineerFit: number;
  utility: number;
  easeOfAdoption: number;
  composability: number;
}): Evaluation {
  return {
    slug: o.slug,
    verdict: o.verdict ?? "worthwhile",
    integration: o.integration ?? "standalone-app",
    category: o.category ?? "devtools",
    ...(o.productShape != null ? { productShape: { score: o.productShape, rationale: "x" } } : {}),
    audience: { aiEngineerFit: o.aiEngineerFit },
    scores: {
      utility: { score: o.utility },
      easeOfAdoption: { score: o.easeOfAdoption },
      composability: { score: o.composability },
      // Present but deliberately unread — proves traction no longer moves the pick.
      traction: { score: 100 },
    },
  } as unknown as Evaluation;
}

test("weights sum to 1, productShape dominates, and traction is not a factor", () => {
  const total = Object.values(PICK_WEIGHTS).reduce((a, b) => a + b, 0);
  expect(total).toBeCloseTo(1, 10);
  expect(PICK_WEIGHTS).not.toHaveProperty("traction");
  const others = Object.entries(PICK_WEIGHTS)
    .filter(([k]) => k !== "productShape")
    .map(([, w]) => w);
  expect(PICK_WEIGHTS.productShape).toBeGreaterThan(Math.max(...others));
});

test("pickScore bottoms/tops out at 0/100", () => {
  const zero = {
    productShape: 0,
    aiEngineerFit: 0,
    utility: 0,
    easeOfAdoption: 0,
    composability: 0,
  };
  expect(pickScore(zero)).toBe(0);
  expect(
    pickScore({
      productShape: 100,
      aiEngineerFit: 100,
      utility: 100,
      easeOfAdoption: 100,
      composability: 100,
    }),
  ).toBe(100);
});

test("a product-shaped tool outranks an infra primitive that beats it on every other axis", () => {
  // The exact failure this ticket fixes. Real prod numbers (2026-07-21/23).
  // qdrant wins utility, ease AND composability — and still must lose.
  const qdrant = pickScore({
    productShape: 15,
    aiEngineerFit: 95,
    utility: 100,
    easeOfAdoption: 70,
    composability: 80,
  });
  const buzz = pickScore({
    productShape: 90,
    aiEngineerFit: 85,
    utility: 80,
    easeOfAdoption: 40,
    composability: 75,
  });
  expect(buzz).toBeGreaterThan(qdrant);
});

test("pickScore renormalizes when productShape is absent (pre-0078 items)", () => {
  // The 134 items already in prod carry no productShape. They must still score
  // on the remaining axes, not collapse toward zero as if productShape were 0.
  const parts = { aiEngineerFit: 80, utility: 80, easeOfAdoption: 80, composability: 80 };
  expect(pickScore(parts)).toBe(80);
  // …and scoring 0 on productShape is strictly worse than not having it at all.
  expect(pickScore({ ...parts, productShape: 0 })).toBeLessThan(pickScore(parts));
});

test("pickScoreOf reads productShape off the Evaluation, never traction", () => {
  const withShape = ev({
    slug: "a",
    productShape: 90,
    aiEngineerFit: 85,
    utility: 80,
    easeOfAdoption: 40,
    composability: 75,
  });
  expect(pickScoreOf(withShape)).toBe(
    pickScore({
      productShape: 90,
      aiEngineerFit: 85,
      utility: 80,
      easeOfAdoption: 40,
      composability: 75,
    }),
  );
  // traction is 100 on the fixture; dropping productShape must change the score
  // via renormalization alone, proving traction contributes nothing.
  const noShape = ev({
    slug: "b",
    aiEngineerFit: 85,
    utility: 80,
    easeOfAdoption: 40,
    composability: 75,
  });
  expect(pickScoreOf(noShape)).toBe(
    pickScore({ aiEngineerFit: 85, utility: 80, easeOfAdoption: 40, composability: 75 }),
  );
});

test("only essential/worthwhile verdicts are eligible to be featured", () => {
  expect(PICK_ELIGIBLE_VERDICTS).toEqual(["essential", "worthwhile"]);
  expect(isPickEligible("essential")).toBe(true);
  expect(isPickEligible("worthwhile")).toBe(true);
  expect(isPickEligible("niche")).toBe(false);
  expect(isPickEligible("marginal")).toBe(false);
  expect(isPickEligible("complexity-trap")).toBe(false);
});

test("integration: knowledge can never be featured — a link-dump is not a daily pick", () => {
  // Regression: 2026-07-24 featured liguodongiot/llm-action, a Chinese-language
  // README link list with integration `knowledge`. Not runnable software.
  expect(PICK_INELIGIBLE_INTEGRATIONS).toContain("knowledge");
  expect(isFeaturable({ verdict: "essential", integration: "knowledge" })).toBe(false);
  expect(isFeaturable({ verdict: "worthwhile", integration: "knowledge" })).toBe(false);
  expect(isFeaturable({ verdict: "worthwhile", integration: "standalone-app" })).toBe(true);
  expect(isFeaturable({ verdict: "niche", integration: "standalone-app" })).toBe(false);
});

test("selectDailyPick takes the highest pickScore among featurable items", () => {
  const winner = ev({
    slug: "product",
    productShape: 90,
    aiEngineerFit: 85,
    utility: 80,
    easeOfAdoption: 40,
    composability: 75,
  });
  const loser = ev({
    slug: "infra",
    productShape: 15,
    aiEngineerFit: 95,
    utility: 100,
    easeOfAdoption: 70,
    composability: 80,
  });
  expect(selectDailyPick([loser, winner])?.slug).toBe("product");
});

test("selectDailyPick never returns an ineligible verdict or a knowledge item", () => {
  const knowledge = ev({
    slug: "link-dump",
    verdict: "worthwhile",
    integration: "knowledge",
    productShape: 5,
    aiEngineerFit: 90,
    utility: 85,
    easeOfAdoption: 90,
    composability: 40,
  });
  const niche = ev({
    slug: "niche-thing",
    verdict: "niche",
    productShape: 95,
    aiEngineerFit: 95,
    utility: 95,
    easeOfAdoption: 95,
    composability: 95,
  });
  // The integration gate is HARD: with only knowledge items there is no pick.
  expect(selectDailyPick([knowledge])).toBeNull();
  expect(selectDailyPick([])).toBeNull();
  // The verdict gate is SOFT: a thin day with nothing essential/worthwhile still
  // features its best runnable candidate rather than skipping the day…
  expect(selectDailyPick([knowledge, niche])?.slug).toBe("niche-thing");
  // …but a knowledge item must not win even as that thin-day fallback.
  const weak = ev({
    slug: "weak-but-real",
    verdict: "niche",
    productShape: 40,
    aiEngineerFit: 40,
    utility: 40,
    easeOfAdoption: 40,
    composability: 40,
  });
  expect(selectDailyPick([knowledge, weak])?.slug).toBe("weak-but-real");
});

test("a category featured within the cooldown is penalized", () => {
  expect(PICK_COOLDOWN_DAYS).toBeGreaterThanOrEqual(2);
  const rag = ev({
    slug: "another-rag-db",
    category: "rag",
    productShape: 60,
    aiEngineerFit: 90,
    utility: 90,
    easeOfAdoption: 80,
    composability: 80,
  });
  const other = ev({
    slug: "something-else",
    category: "productivity",
    productShape: 60,
    aiEngineerFit: 85,
    utility: 85,
    easeOfAdoption: 75,
    composability: 75,
  });
  // Head to head with no history, the stronger RAG item wins.
  expect(selectDailyPick([rag, other])?.slug).toBe("another-rag-db");
  // With `rag` featured in the last few days, the margin flips.
  expect(selectDailyPick([rag, other], ["rag"])?.slug).toBe("something-else");
  expect(pickScoreOf(rag) - pickScoreOf(other)).toBeLessThan(PICK_REPEAT_PENALTY);
});

test("cooldown never starves the pick — all-penalized still yields the best one", () => {
  const a = ev({
    slug: "rag-a",
    category: "rag",
    productShape: 70,
    aiEngineerFit: 90,
    utility: 90,
    easeOfAdoption: 80,
    composability: 80,
  });
  const b = ev({
    slug: "rag-b",
    category: "rag",
    productShape: 30,
    aiEngineerFit: 90,
    utility: 90,
    easeOfAdoption: 80,
    composability: 80,
  });
  expect(selectDailyPick([b, a], ["rag"])?.slug).toBe("rag-a");
});

test("calibration: replaying real picks, products beat the RAG/vector/reference field", () => {
  // Metric values are verbatim from the prod dump; productShape is the value the
  // evaluator prompt is expected to produce for each shape (app/CLI vs. engine,
  // library, link-list). This is the spec for the prompt, not a tautology.
  const buzz = ev({
    slug: "buzz",
    category: "productivity",
    integration: "workflow-shift",
    productShape: 90,
    aiEngineerFit: 85,
    utility: 80,
    easeOfAdoption: 40,
    composability: 75,
  });
  const field = [
    ev({
      slug: "qdrant-qdrant",
      category: "data-pipeline",
      verdict: "essential",
      productShape: 15,
      aiEngineerFit: 95,
      utility: 100,
      easeOfAdoption: 70,
      composability: 80,
    }),
    ev({
      slug: "meilisearch-meilisearch",
      category: "data-pipeline",
      verdict: "essential",
      productShape: 15,
      aiEngineerFit: 95,
      utility: 95,
      easeOfAdoption: 85,
      composability: 75,
    }),
    ev({
      slug: "hkuds-lightrag",
      category: "rag",
      integration: "library",
      productShape: 10,
      aiEngineerFit: 85,
      utility: 85,
      easeOfAdoption: 50,
      composability: 80,
    }),
    ev({
      slug: "liguodongiot-llm-action",
      category: "other",
      integration: "knowledge",
      productShape: 5,
      aiEngineerFit: 90,
      utility: 85,
      easeOfAdoption: 90,
      composability: 40,
    }),
  ];
  for (const infra of field) {
    expect(pickScoreOf(buzz)).toBeGreaterThan(pickScoreOf(infra));
  }
  expect(selectDailyPick([...field, buzz])?.slug).toBe("buzz");
});
