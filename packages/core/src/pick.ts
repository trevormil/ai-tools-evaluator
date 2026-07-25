import type { Evaluation } from "./schema";

/**
 * Daily-pick tuning: which item to FEATURE (the Discord digest + the site's
 * daily pick). Deliberately distinct from `overallScore` — that's a quality
 * measure that rewards `novelty` + `Δ-vs-baseline`, which floats clever-but-
 * niche repos.
 *
 * Retuned in ticket 0078. The first cut weighted audience fit + utility +
 * traction + ease, which sounded like "broad appeal" but in practice described
 * a mature infrastructure primitive: 10 of the first 18 picks were RAG/vector/
 * search infra, and one was a README link-dump. Two specific faults:
 *
 *   - Nothing in the schema knew whether a thing was a PRODUCT or an
 *     INGREDIENT, so `productShape` was added as a pick-only signal (see
 *     ADR-0004). It carries the most weight.
 *   - `traction` is gone. Discovery already ranks the candidate pool by star
 *     velocity, so weighting it again just taxed anything not yet famous — and
 *     the most famous AI repos are vector databases.
 */

export const PICK_WEIGHTS = {
  productShape: 0.35, // is it a usable product/tool, or an ingredient?
  utility: 0.22, // real day-to-day usefulness
  aiEngineerFit: 0.2, // how well it fits AI engineers (audience block)
  easeOfAdoption: 0.13, // low barrier → you can actually try it today
  composability: 0.1, // slots into an existing workflow
} as const;

export type PickParts = {
  /** Absent on items evaluated before ticket 0078 — the score renormalizes. */
  productShape?: number;
  aiEngineerFit: number;
  utility: number;
  easeOfAdoption: number;
  composability: number;
};

/**
 * Product-appeal score 0–100 (higher = more likely to be a thing people use).
 * Components absent from `p` are skipped and the remaining weights renormalized,
 * so a pre-0078 item without `productShape` still ranks on the axes it does
 * have instead of being scored as if its productShape were zero.
 */
export function pickScore(p: PickParts): number {
  let weighted = 0;
  let present = 0;
  for (const [key, weight] of Object.entries(PICK_WEIGHTS)) {
    const value = p[key as keyof PickParts];
    if (typeof value !== "number") continue;
    weighted += weight * value;
    present += weight;
  }
  return present === 0 ? 0 : Math.round(weighted / present);
}

/** Extract the pick signals from a full Evaluation and score it. */
export function pickScoreOf(e: Evaluation): number {
  return pickScore({
    productShape: e.productShape?.score,
    aiEngineerFit: e.audience.aiEngineerFit,
    utility: e.scores.utility.score,
    easeOfAdoption: e.scores.easeOfAdoption.score,
    composability: e.scores.composability.score,
  });
}

/**
 * Verdicts allowed to be the FEATURED daily pick — broadly-recommended only.
 * `niche` / `marginal` / `redundant` / `complexity-trap` are never featured.
 */
export const PICK_ELIGIBLE_VERDICTS = ["essential", "worthwhile"] as const;

export function isPickEligible(verdict: string): boolean {
  return (PICK_ELIGIBLE_VERDICTS as readonly string[]).includes(verdict);
}

/**
 * Integrations that can never be THE featured pick, whatever they score.
 * `knowledge` is a paper/reading-list/idea rather than runnable software — the
 * 2026-07-24 pick was a curated link list, which is not a daily pick.
 */
export const PICK_INELIGIBLE_INTEGRATIONS = ["knowledge"] as const;

/** The integration gate alone — a hard bar, applied even to thin-day fallbacks. */
export function isFeaturableIntegration(integration: string): boolean {
  return !(PICK_INELIGIBLE_INTEGRATIONS as readonly string[]).includes(integration);
}

/** Can this item be the featured pick at all (verdict AND integration gates)? */
export function isFeaturable(item: { verdict: string; integration: string }): boolean {
  return isFeaturableIntegration(item.integration) && isPickEligible(item.verdict);
}

/**
 * Anti-repetition: a category featured within the last `PICK_COOLDOWN_DAYS`
 * takes a flat penalty, so the pick can't be a vector DB three days running.
 * A penalty (not a ban) means a thin day where everything is on cooldown still
 * yields the best available item rather than nothing.
 */
export const PICK_COOLDOWN_DAYS = 3;
export const PICK_REPEAT_PENALTY = 15;

/**
 * Choose THE featured daily pick from a graded batch, or null if nothing in it
 * is featurable. `recentCategories` are the categories featured within the
 * cooldown window (see `GET /api/internal/recent-picks`).
 *
 * The verdict gate is a soft preference — a thin day with no essential/
 * worthwhile item still features its best candidate — but the integration gate
 * is hard: a `knowledge` item is never featured, even as the fallback.
 */
export function selectDailyPick(
  evaluations: readonly Evaluation[],
  recentCategories: readonly string[] = [],
): Evaluation | null {
  const runnable = evaluations.filter((e) => isFeaturableIntegration(e.integration));
  const preferred = runnable.filter((e) => isPickEligible(e.verdict));
  const pool = preferred.length > 0 ? preferred : runnable;

  let best: { e: Evaluation; score: number } | null = null;
  for (const e of pool) {
    const penalty = recentCategories.includes(e.category) ? PICK_REPEAT_PENALTY : 0;
    const score = pickScoreOf(e) - penalty;
    if (!best || score > best.score) best = { e, score };
  }
  return best?.e ?? null;
}
