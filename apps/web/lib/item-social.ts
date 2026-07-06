import { and, desc, eq, isNotNull } from "drizzle-orm";
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
