import { and, desc, eq, isNotNull, inArray } from "drizzle-orm";
import { getDb, follows, items, stackItems, users, type Item, type User } from "@aix/db";

/**
 * Takes — the social primitive (ticket 0036). A take is a stack entry with a
 * blurb: @user's honest word on how they use a tool / what they think.
 */

export type ItemTake = {
  id: string;
  user: User;
  username: string;
  status: string;
  rating: number | null;
  take: string;
  updatedAt: number;
  followedByViewer: boolean;
};

/**
 * All takes on one tool: people the viewer follows first, then newest.
 * Entries without a blurb (bare "I use this") are not takes.
 */
export function listItemTakes(itemId: string, viewerId?: string, limit = 50): ItemTake[] {
  const db = getDb();
  const rows = db
    .select({ stack: stackItems, user: users })
    .from(stackItems)
    .innerJoin(users, eq(stackItems.userId, users.id))
    .where(and(eq(stackItems.itemId, itemId), isNotNull(stackItems.take)))
    .orderBy(desc(stackItems.updatedAt))
    .limit(limit)
    .all();

  let circle = new Set<string>();
  if (viewerId && rows.length > 0) {
    const authorIds = [...new Set(rows.map((r) => r.stack.userId))];
    const followed = db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), inArray(follows.followeeId, authorIds)))
      .all();
    circle = new Set(followed.map((f) => f.id));
  }

  return rows
    .map((r) => ({
      id: r.stack.id,
      user: r.user,
      username: r.user.username,
      status: r.stack.status,
      rating: r.stack.rating,
      take: r.stack.take!,
      updatedAt: r.stack.updatedAt,
      followedByViewer: circle.has(r.stack.userId),
    }))
    .sort((a, b) => {
      if (a.followedByViewer !== b.followedByViewer) return a.followedByViewer ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

export type UserTake = {
  id: string;
  status: string;
  rating: number | null;
  take: string;
  updatedAt: number;
  toolName: string | null;
  item: Pick<Item, "id" | "slug" | "title" | "verdict" | "overallScore" | "coverImageUrl"> | null;
};

/** One user's takes across tools, newest first — the profile's lead tab. */
export function getUserTakes(userId: string, limit = 50): UserTake[] {
  const rows = getDb()
    .select({ stack: stackItems, item: items })
    .from(stackItems)
    .leftJoin(items, eq(stackItems.itemId, items.id))
    .where(and(eq(stackItems.userId, userId), isNotNull(stackItems.take)))
    .orderBy(desc(stackItems.updatedAt))
    .limit(limit)
    .all();
  return rows.map((r) => ({
    id: r.stack.id,
    status: r.stack.status,
    rating: r.stack.rating,
    take: r.stack.take!,
    updatedAt: r.stack.updatedAt,
    toolName: r.stack.toolName,
    item: r.item
      ? {
          id: r.item.id,
          slug: r.item.slug,
          title: r.item.title,
          verdict: r.item.verdict,
          overallScore: r.item.overallScore,
          coverImageUrl: r.item.coverImageUrl,
        }
      : null,
  }));
}

/** The viewer's own stack entry for an item (take composer prefill + I-use-this state). */
export function getMyStackEntryForItem(userId: string, itemId: string) {
  return getDb()
    .select()
    .from(stackItems)
    .where(and(eq(stackItems.userId, userId), eq(stackItems.itemId, itemId)))
    .get();
}
