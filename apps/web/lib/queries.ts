import { and, desc, eq, gte, like, lt, ne, or, sql } from "drizzle-orm";
import { getDb, items, type Item } from "@aix/db";
import type { Evaluation } from "@aix/core";

/* --------------------------------------------------------------- items */

export type ItemSort = "hot" | "new" | "top";

export type ItemFilters = {
  category?: string;
  integration?: string;
  verdict?: string;
  audience?: string; // primaryAudience: ai-engineer | vibe-coder | both | neither
  minScore?: number;
  q?: string;
  sort?: ItemSort;
  limit?: number;
};

function itemConds(f: ItemFilters) {
  const conds = [eq(items.published, true)];
  if (f.category) conds.push(eq(items.category, f.category));
  if (f.integration) conds.push(eq(items.integration, f.integration));
  if (f.verdict) conds.push(eq(items.verdict, f.verdict));
  if (f.audience) conds.push(eq(items.primaryAudience, f.audience));
  if (typeof f.minScore === "number") conds.push(gte(items.overallScore, f.minScore));
  if (f.q) {
    const needle = `%${f.q.toLowerCase()}%`;
    const textMatch = or(
      like(sql`lower(${items.title})`, needle),
      like(sql`lower(${items.tagline})`, needle),
      like(sql`lower(${items.tagsJson})`, needle),
    );
    if (textMatch) conds.push(textMatch);
  }
  return conds;
}

/** True total for a filter set — the directory shows real counts, not page size. */
export function countItems(f: ItemFilters = {}): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(and(...itemConds(f)))
    .get();
  return row?.n ?? 0;
}

export function listItems(f: ItemFilters = {}): Item[] {
  const conds = itemConds(f);

  const order =
    f.sort === "new"
      ? desc(items.createdAt)
      : f.sort === "top"
        ? desc(items.overallScore)
        : desc(items.score); // "hot" (default)

  return getDb()
    .select()
    .from(items)
    .where(and(...conds))
    .orderBy(order)
    .limit(f.limit ?? 60)
    .all();
}

export function getItemBySlug(slug: string): Item | undefined {
  return getDb().select().from(items).where(eq(items.slug, slug)).get();
}

export function parseEvaluation(item: Item): Evaluation {
  return JSON.parse(item.evaluationJson) as Evaluation;
}

/** Opaque cursor position for the bulk dump: last (createdAt, id) served. */
export type DumpCursor = { createdAt: number; id: string };
export type DumpPage = { items: Item[]; nextCursor: DumpCursor | null };

/**
 * One page of the full corpus for the public dump — every published, scored
 * item (pending community submissions have no real evaluation yet, so they are
 * excluded). Ordered newest-first with `id` as a stable tiebreaker so cursor
 * paging never skips or repeats a row. Fetches `limit + 1` to know if more
 * remain without a second COUNT query.
 */
export function dumpItems(opts: { limit: number; cursor?: DumpCursor; kind?: string }): DumpPage {
  const { limit, cursor, kind } = opts;
  const conds = [eq(items.published, true), ne(items.scoreStatus, "pending")];
  if (kind) conds.push(eq(items.kind, kind));
  if (cursor) {
    const after = or(
      lt(items.createdAt, cursor.createdAt),
      and(eq(items.createdAt, cursor.createdAt), lt(items.id, cursor.id)),
    );
    if (after) conds.push(after);
  }

  const rows = getDb()
    .select()
    .from(items)
    .where(and(...conds))
    .orderBy(desc(items.createdAt), desc(items.id))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { items: page, nextCursor };
}
