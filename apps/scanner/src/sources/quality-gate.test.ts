import { describe, expect, test } from "bun:test";
import { evaluateQualityGate, starVelocity, type QualityThresholds } from "./quality-gate";

const thresholds: QualityThresholds = { minStars: 50, minStarVelocity: 5 };
const now = new Date("2026-07-06T00:00:00.000Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("evaluateQualityGate", () => {
  test("passes a repo at/above the star floor", () => {
    const d = evaluateQualityGate({ stars: 50, archived: false, fork: false }, thresholds, now);
    expect(d).toEqual({ pass: true, reason: "stars" });
  });

  test("drops a below-floor repo with no velocity", () => {
    const d = evaluateQualityGate(
      { stars: 20, archived: false, fork: false, createdAt: daysAgo(365) },
      thresholds,
      now,
    );
    expect(d.pass).toBe(false);
    expect(d.reason).toBe("below-star-floor");
  });

  test("lets a below-floor but fast-rising repo through", () => {
    // 20 stars in 2 days = 10 stars/day >= minStarVelocity 5 → rising.
    const d = evaluateQualityGate(
      { stars: 20, archived: false, fork: false, createdAt: daysAgo(2) },
      thresholds,
      now,
    );
    expect(d).toEqual({ pass: true, reason: "fast-rising" });
  });

  test("drops archived repos even when they clear the star floor", () => {
    const d = evaluateQualityGate({ stars: 9000, archived: true, fork: false }, thresholds, now);
    expect(d).toEqual({ pass: false, reason: "archived" });
  });

  test("drops forks even when they clear the star floor", () => {
    const d = evaluateQualityGate({ stars: 9000, archived: false, fork: true }, thresholds, now);
    expect(d).toEqual({ pass: false, reason: "fork" });
  });
});

describe("starVelocity", () => {
  test("is stars/day since creation", () => {
    expect(
      starVelocity({ stars: 30, archived: false, fork: false, createdAt: daysAgo(3) }, now),
    ).toBeCloseTo(10);
  });

  test("is 0 when createdAt is missing or unparseable", () => {
    expect(starVelocity({ stars: 30, archived: false, fork: false }, now)).toBe(0);
    expect(
      starVelocity({ stars: 30, archived: false, fork: false, createdAt: "not-a-date" }, now),
    ).toBe(0);
  });
});
