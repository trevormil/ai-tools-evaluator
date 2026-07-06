import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, stackItems, items, type StackItem, type Item } from "@aix/db";
import { STACK_STATUSES, STACK_STATUS_LABELS, type StackStatus } from "./stack-types";

export { STACK_STATUSES, STACK_STATUS_LABELS, type StackStatus };

/** A stack entry joined to its catalogued item (if any). */
export type StackEntry = StackItem & {
  item: Pick<Item, "slug" | "title" | "verdict" | "overallScore" | "coverImageUrl"> | null;
};

/** A user's full stack, newest first, each joined to its directory item. */
export function getUserStack(userId: string): StackEntry[] {
  const db = getDb();
  const rows = db
    .select({ stack: stackItems, item: items })
    .from(stackItems)
    .leftJoin(items, eq(stackItems.itemId, items.id))
    .where(eq(stackItems.userId, userId))
    .orderBy(desc(stackItems.updatedAt))
    .all();
  return rows.map((r) => ({
    ...r.stack,
    item: r.item
      ? {
          slug: r.item.slug,
          title: r.item.title,
          verdict: r.item.verdict,
          overallScore: r.item.overallScore,
          coverImageUrl: r.item.coverImageUrl,
        }
      : null,
  }));
}

/** Display name for an entry: the catalogued title or the free-form tool name. */
export function stackEntryName(e: StackEntry): string {
  return e.item?.title ?? e.toolName ?? "Unknown tool";
}

export type UpsertStackInput = {
  itemId?: string | null;
  toolName?: string | null;
  status: StackStatus;
  take?: string | null;
  rating?: number | null;
};

/** Create or update a stack entry for a user, enforcing the item/tool identity. */
export function upsertStackEntry(userId: string, input: UpsertStackInput): StackItem {
  const db = getDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const itemId = input.itemId ?? null;
  const toolName = itemId ? null : input.toolName?.trim() || null;

  // Find an existing entry for the same identity (item or tool name).
  const existing = itemId
    ? db
        .select()
        .from(stackItems)
        .where(and(eq(stackItems.userId, userId), eq(stackItems.itemId, itemId)))
        .get()
    : toolName
      ? db
          .select()
          .from(stackItems)
          .where(
            and(
              eq(stackItems.userId, userId),
              sql`lower(${stackItems.toolName}) = lower(${toolName})`,
            ),
          )
          .get()
      : undefined;

  if (existing) {
    return db
      .update(stackItems)
      .set({
        status: input.status,
        take: input.take ?? null,
        rating: input.rating ?? null,
        updatedAt: nowSec,
      })
      .where(eq(stackItems.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(stackItems)
    .values({
      userId,
      itemId,
      toolName,
      status: input.status,
      take: input.take ?? null,
      rating: input.rating ?? null,
      createdAt: nowSec,
      updatedAt: nowSec,
    })
    .returning()
    .get();
}

/** Delete a stack entry, but only if it belongs to the user (ownership check). */
export function deleteStackEntry(userId: string, entryId: string): boolean {
  const db = getDb();
  const row = db.select().from(stackItems).where(eq(stackItems.id, entryId)).get();
  if (!row || row.userId !== userId) return false;
  db.delete(stackItems).where(eq(stackItems.id, entryId)).run();
  return true;
}
