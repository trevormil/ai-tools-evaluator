import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, reposts } from "@aix/db";

export type RepostTarget = "post" | "item";

/** Total reposts for one target. */
export function repostCount(targetType: RepostTarget, targetId: string): number {
  const r = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(reposts)
    .where(and(eq(reposts.targetType, targetType), eq(reposts.targetId, targetId)))
    .get();
  return r?.n ?? 0;
}

/** Repost counts for many targets of one type, keyed by target id. */
export function repostCountsFor(targetType: RepostTarget, ids: string[]): Record<string, number> {
  if (ids.length === 0) return {};
  const rows = getDb()
    .select({ id: reposts.targetId, n: sql<number>`count(*)` })
    .from(reposts)
    .where(and(eq(reposts.targetType, targetType), inArray(reposts.targetId, ids)))
    .groupBy(reposts.targetId)
    .all();
  const out: Record<string, number> = {};
  for (const r of rows) out[r.id] = r.n;
  return out;
}

/** The set of target ids of one type that the given user has reposted. */
export function userRepostSet(userId: string, targetType: RepostTarget): Set<string> {
  const rows = getDb()
    .select({ id: reposts.targetId })
    .from(reposts)
    .where(and(eq(reposts.userId, userId), eq(reposts.targetType, targetType)))
    .all();
  return new Set(rows.map((r) => r.id));
}

export function hasReposted(userId: string, targetType: RepostTarget, targetId: string): boolean {
  const row = getDb()
    .select({ id: reposts.id })
    .from(reposts)
    .where(
      and(
        eq(reposts.userId, userId),
        eq(reposts.targetType, targetType),
        eq(reposts.targetId, targetId),
      ),
    )
    .get();
  return !!row;
}
