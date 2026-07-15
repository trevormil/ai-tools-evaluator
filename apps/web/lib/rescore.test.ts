import { test, expect } from "bun:test";
import { rescoreState, RESCORE_COOLDOWN_SECONDS } from "./rescore";

const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;

function item(fields: {
  scoreStatus?: string;
  scoredAt?: number | null;
  rescoreRequestedAt?: number | null;
}) {
  return {
    scoreStatus: fields.scoreStatus ?? "scored",
    scoredAt: fields.scoredAt ?? NOW - 30 * DAY,
    rescoreRequestedAt: fields.rescoreRequestedAt ?? null,
  };
}

test("a scored item never rescored is eligible now, nothing pending", () => {
  const s = rescoreState(item({ rescoreRequestedAt: null }), NOW);
  expect(s.eligible).toBe(true);
  expect(s.pending).toBe(false);
  expect(s.nextEligibleAt).toBeNull();
  expect(s.lastRequestedAt).toBeNull();
});

test("a fresh request not yet re-scored is pending and blocked", () => {
  // requested 1d ago, item last scored 30d ago -> request newer than scoredAt.
  const s = rescoreState(item({ rescoreRequestedAt: NOW - DAY }), NOW);
  expect(s.pending).toBe(true);
  expect(s.eligible).toBe(false);
  expect(s.nextEligibleAt).toBe(NOW - DAY + RESCORE_COOLDOWN_SECONDS);
});

test("consumed but still inside the 7-day window: not pending, still blocked", () => {
  // requested 2d ago, then the scan overwrote it (scoredAt just after request).
  const s = rescoreState(
    item({ rescoreRequestedAt: NOW - 2 * DAY, scoredAt: NOW - 2 * DAY + 60 }),
    NOW,
  );
  expect(s.pending).toBe(false);
  expect(s.eligible).toBe(false);
  expect(s.nextEligibleAt).toBe(NOW - 2 * DAY + RESCORE_COOLDOWN_SECONDS);
});

test("past the 7-day window and consumed: eligible again", () => {
  const s = rescoreState(
    item({ rescoreRequestedAt: NOW - 8 * DAY, scoredAt: NOW - 8 * DAY + 60 }),
    NOW,
  );
  expect(s.pending).toBe(false);
  expect(s.eligible).toBe(true);
  expect(s.nextEligibleAt).toBeNull();
});

test("pending (unscored) items are never rescorable", () => {
  const s = rescoreState(item({ scoreStatus: "pending", scoredAt: null }), NOW);
  expect(s.eligible).toBe(false);
  expect(s.pending).toBe(false);
});
