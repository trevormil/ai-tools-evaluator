import { test, expect } from "bun:test";
import { pickScore, pickScoreOf, PICK_ELIGIBLE_VERDICTS, isPickEligible } from "./pick";
import type { Evaluation } from "./schema";

/**
 * pickScore (daily-pick tuning): the featured pick should favor tools a lot of
 * AI engineers would actually adopt — NOT clever-but-niche repos. It weights
 * audience fit + utility + traction + ease + composability, and deliberately
 * ignores novelty / Δ-vs-baseline (which inflate the site's overallScore).
 */

test("pickScore is a weighted blend that bottoms/tops out at 0/100", () => {
  expect(
    pickScore({ aiEngineerFit: 0, utility: 0, traction: 0, easeOfAdoption: 0, composability: 0 }),
  ).toBe(0);
  expect(
    pickScore({
      aiEngineerFit: 100,
      utility: 100,
      traction: 100,
      easeOfAdoption: 100,
      composability: 100,
    }),
  ).toBe(100);
});

test("a broadly-adopted tool outranks a clever-but-niche one", () => {
  // Niche fine-tuning repo: narrow audience, low traction/ease — but it might
  // score high on novelty/Δ, which pickScore ignores.
  const niche = pickScore({
    aiEngineerFit: 45,
    utility: 55,
    traction: 30,
    easeOfAdoption: 40,
    composability: 50,
  });
  // Broad "second brain on Cloudflare": high fit, utility, traction, ease.
  const broad = pickScore({
    aiEngineerFit: 85,
    utility: 80,
    traction: 70,
    easeOfAdoption: 75,
    composability: 80,
  });
  expect(broad).toBeGreaterThan(niche);
  expect(niche).toBe(45); // 0.40*45 + 0.25*55 + 0.15*30 + 0.12*40 + 0.08*50
  expect(broad).toBe(80);
});

test("pickScoreOf pulls the fields from a full Evaluation", () => {
  const e = {
    audience: { aiEngineerFit: 85 },
    scores: {
      utility: { score: 80 },
      traction: { score: 70 },
      easeOfAdoption: { score: 75 },
      composability: { score: 80 },
    },
  } as unknown as Evaluation;
  expect(pickScoreOf(e)).toBe(80);
});

test("only essential/worthwhile verdicts are eligible to be featured", () => {
  expect(PICK_ELIGIBLE_VERDICTS).toEqual(["essential", "worthwhile"]);
  expect(isPickEligible("essential")).toBe(true);
  expect(isPickEligible("worthwhile")).toBe(true);
  // The whole point: a "niche" tool must never be the daily pick.
  expect(isPickEligible("niche")).toBe(false);
  expect(isPickEligible("marginal")).toBe(false);
  expect(isPickEligible("complexity-trap")).toBe(false);
});
