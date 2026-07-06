import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, items, posts, stackItems, users, type Post, type User } from "@aix/db";

/**
 * The item page's social surface (ticket 0026): the discussion *around* a tool
 * — posts that reference it and the practitioners who actually run it.
 */

export type ItemPost = { post: Post; author: User };

/** Posts attached to an item, newest first, with authors. */
export function listPostsByItem(itemId: string, limit = 20): ItemPost[] {
  return getDb()
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.itemId, itemId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .all();
}

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
