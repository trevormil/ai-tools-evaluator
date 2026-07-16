import type { Item } from "@aix/db";

/**
 * Rescore (ticket: item-rescore): a signed-in user can ask for an already-scored
 * item to be re-evaluated (e.g. the repo shipped a big update). The request
 * stamps `items.rescoreRequestedAt`; the next scanner pass overwrites the item
 * in place. To keep load bounded and stop spam, each item may be rescored at
 * most once per week — a PER-ITEM cooldown, not per-user.
 */
export const RESCORE_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

export type RescoreState = {
  /** A rescore is requested but not yet consumed by the evaluator. */
  pending: boolean;
  /** Last time a rescore was requested (unix seconds), or null if never. */
  lastRequestedAt: number | null;
  /** Unix seconds a new rescore becomes allowed again (null once eligible/never). */
  nextEligibleAt: number | null;
  /** Can a rescore be requested right now? */
  eligible: boolean;
};

type RescoreFields = Pick<Item, "scoreStatus" | "scoredAt" | "rescoreRequestedAt">;

/**
 * Derive the rescore state for an item. Only SCORED items are rescorable —
 * pending items are already in the queue. `pending` is true while a request
 * has not yet been overwritten by a fresh evaluation (request newer than the
 * last judged-at); the cooldown runs off the request time regardless of outcome.
 */
export function rescoreState(item: RescoreFields, nowSec: number): RescoreState {
  const last = item.rescoreRequestedAt;
  const scored = item.scoreStatus === "scored";
  const pending = scored && last != null && last > (item.scoredAt ?? 0);
  const nextEligibleAt = last == null ? null : last + RESCORE_COOLDOWN_SECONDS;
  const cooledDown = nextEligibleAt == null || nowSec >= nextEligibleAt;
  const eligible = scored && !pending && cooledDown;
  return {
    pending,
    lastRequestedAt: last,
    nextEligibleAt: eligible ? null : nextEligibleAt,
    eligible,
  };
}
