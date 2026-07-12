import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, items, type Item } from "@aix/db";

/**
 * Leaderboard queries — read-only rankings that give the directory a sense of
 * "best / most-talked-about / worst." Kept separate from queries.ts (the general
 * filter surface) because these are fixed, opinionated top-N lists.
 */

/** Highest weighted overallScore. The tools worth adopting. */
export function topRated(limit = 12): Item[] {
  return (
    getDb()
      .select()
      .from(items)
      // Pending submissions carry a placeholder 0 — a score ranking is scored-only.
      .where(and(eq(items.published, true), eq(items.scoreStatus, "scored")))
      .orderBy(desc(items.overallScore), desc(items.score))
      .limit(limit)
      .all()
  );
}

/**
 * The Hall of Shame: things judged `complexity-trap` or `redundant`, worst
 * (noisiest) first. The site's whole point is to name these out loud.
 */
export function hallOfShame(limit = 12): Item[] {
  return getDb()
    .select()
    .from(items)
    .where(and(eq(items.published, true), inArray(items.verdict, ["complexity-trap", "redundant"])))
    .orderBy(desc(items.noiseScore))
    .limit(limit)
    .all();
}
