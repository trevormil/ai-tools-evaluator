import type { ItemSource } from "@aix/core";
import { starVelocity } from "./sources/quality-gate";
import type { Discovered } from "./types";

/**
 * Trending score for ranking discovery candidates before we spend an eval.
 * Heavily weighted toward recent **star velocity** (stars/day since creation) so
 * fast-rising GitHub repos float to the top; a small log-stars term breaks ties
 * toward proven repos. Papers / starless repos score 0 (GitHub-first by design).
 */
export function trendingScore(source: ItemSource, now: Date): number {
  const stars = source.stars ?? 0;
  if (stars <= 0) return 0;
  const velocity = starVelocity(
    { stars, archived: false, fork: false, createdAt: source.createdAt },
    now,
  );
  return velocity * 10 + Math.log10(stars + 1);
}

/** Rank candidates by trending score, descending. Pure — never mutates input. */
export function rankCandidates(candidates: Discovered[], now: Date): Discovered[] {
  return [...candidates].sort(
    (a, b) => trendingScore(b.source, now) - trendingScore(a.source, now),
  );
}
