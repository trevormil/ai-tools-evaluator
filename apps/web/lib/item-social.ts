import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, stackItems, users } from "@aix/db";

/**
 * The item page's practitioner signal (ticket 0026): who actually runs the
 * tool. Takes themselves live in lib/takes.ts (ticket 0036).
 */

export type StackSummary = {
  total: number;
  byStatus: Record<string, number>;
  takes: { username: string; avatarUrl: string | null; status: string; take: string }[];
};

/** "N engineers run this" + a few quotable takes (stack phase 2 from ticket 0018). */
export function itemStackSummary(itemId: string, takeLimit = 3): StackSummary {
  const db = getDb();
  const rows = db
    .select({ status: stackItems.status })
    .from(stackItems)
    .where(eq(stackItems.itemId, itemId))
    .all();
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  const takes = db
    .select({
      username: users.username,
      avatarUrl: users.avatarUrl,
      status: stackItems.status,
      take: stackItems.take,
    })
    .from(stackItems)
    .innerJoin(users, eq(stackItems.userId, users.id))
    .where(and(eq(stackItems.itemId, itemId), isNotNull(stackItems.take)))
    .orderBy(desc(stackItems.updatedAt))
    .limit(takeLimit)
    .all() as StackSummary["takes"];

  return { total: rows.length, byStatus, takes };
}

/** Active-user counts (using/trying) for many items at once — directory rows. */
export function useCountsFor(itemIds: string[]): Record<string, number> {
  if (itemIds.length === 0) return {};
  const rows = getDb()
    .select({ id: stackItems.itemId, n: sql<number>`count(*)` })
    .from(stackItems)
    .where(
      and(inArray(stackItems.itemId, itemIds), inArray(stackItems.status, ["using", "trying"])),
    )
    .groupBy(stackItems.itemId)
    .all();
  const out: Record<string, number> = {};
  for (const r of rows) if (r.id) out[r.id] = r.n;
  return out;
}
