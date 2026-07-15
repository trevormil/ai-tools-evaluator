import type { Evaluation } from "./schema";

/**
 * Daily-pick tuning: which item to FEATURE (the Discord digest + the site's
 * daily pick). Deliberately distinct from `overallScore` — that's a quality
 * measure that rewards `novelty` + `Δ-vs-baseline`, which floats clever-but-
 * niche repos (a fine-tuning lib scores high but almost no one adopts it). The
 * featured pick should be something a LOT of AI engineers would actually run,
 * so this weights broad-adoption signals and ignores the niche-favoring ones.
 */

export const PICK_WEIGHTS = {
  aiEngineerFit: 0.4, // how well it fits AI engineers (audience block)
  utility: 0.25, // real day-to-day usefulness
  traction: 0.15, // actual adoption momentum — lots of people use it
  easeOfAdoption: 0.12, // low barrier → broad uptake
  composability: 0.08, // slots into an existing workflow
} as const;

export type PickParts = {
  aiEngineerFit: number;
  utility: number;
  traction: number;
  easeOfAdoption: number;
  composability: number;
};

/** Broad-adoption score 0–100 (higher = more AI engineers would actually use it). */
export function pickScore(p: PickParts): number {
  return Math.round(
    PICK_WEIGHTS.aiEngineerFit * p.aiEngineerFit +
      PICK_WEIGHTS.utility * p.utility +
      PICK_WEIGHTS.traction * p.traction +
      PICK_WEIGHTS.easeOfAdoption * p.easeOfAdoption +
      PICK_WEIGHTS.composability * p.composability,
  );
}

/** Extract the pick signals from a full Evaluation and score it. */
export function pickScoreOf(e: Evaluation): number {
  return pickScore({
    aiEngineerFit: e.audience.aiEngineerFit,
    utility: e.scores.utility.score,
    traction: e.scores.traction.score,
    easeOfAdoption: e.scores.easeOfAdoption.score,
    composability: e.scores.composability.score,
  });
}

/**
 * Verdicts allowed to be the FEATURED daily pick — broadly-recommended only.
 * `niche` / `marginal` / `redundant` / `complexity-trap` are never featured
 * (a niche tool being the daily pick is exactly the thing we're fixing).
 */
export const PICK_ELIGIBLE_VERDICTS = ["essential", "worthwhile"] as const;

export function isPickEligible(verdict: string): boolean {
  return (PICK_ELIGIBLE_VERDICTS as readonly string[]).includes(verdict);
}
