import type { Item } from "@aix/db";
import { loadCorpus } from "./corpus";

/**
 * Leaderboard queries — read-only rankings over the git corpus that give the
 * directory a sense of "best / worst." Fixed, opinionated top-N lists.
 */

/** Highest weighted overallScore. The tools worth adopting. */
export function topRated(limit = 12, corpus: Item[] = loadCorpus()): Item[] {
  return [...corpus]
    .sort((a, b) => b.overallScore - a.overallScore || b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * The Hall of Shame: things judged `complexity-trap` or `redundant`, worst
 * (noisiest) first. The site's whole point is to name these out loud.
 */
export function hallOfShame(limit = 12, corpus: Item[] = loadCorpus()): Item[] {
  return corpus
    .filter((i) => i.verdict === "complexity-trap" || i.verdict === "redundant")
    .sort((a, b) => b.noiseScore - a.noiseScore)
    .slice(0, limit);
}
