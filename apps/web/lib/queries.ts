import type { Item } from "@aix/db";
import type { Evaluation } from "@aix/core";
import { loadCorpus } from "./corpus";

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

function matches(item: Item, f: ItemFilters): boolean {
  if (f.category && item.category !== f.category) return false;
  if (f.integration && item.integration !== f.integration) return false;
  if (f.verdict && item.verdict !== f.verdict) return false;
  if (f.audience && item.primaryAudience !== f.audience) return false;
  if (typeof f.minScore === "number" && item.overallScore < f.minScore) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = `${item.title} ${item.tagline} ${item.tagsJson}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function sorted(items: Item[], sort: ItemSort | undefined): Item[] {
  const by =
    sort === "new"
      ? (a: Item, b: Item) => b.createdAt - a.createdAt
      : // "hot" and "top" both rank by score at rest (no votes in the static model);
        // fall back to recency as a stable tiebreaker.
        (a: Item, b: Item) => b.overallScore - a.overallScore || b.createdAt - a.createdAt;
  return [...items].sort(by);
}

/** True total for a filter set — the directory shows real counts, not page size. */
export function countItems(f: ItemFilters = {}, corpus: Item[] = loadCorpus()): number {
  return corpus.filter((i) => matches(i, f)).length;
}

export function listItems(f: ItemFilters = {}, corpus: Item[] = loadCorpus()): Item[] {
  const filtered = corpus.filter((i) => matches(i, f));
  return sorted(filtered, f.sort).slice(0, f.limit ?? 60);
}

export function getItemBySlug(slug: string, corpus: Item[] = loadCorpus()): Item | undefined {
  return corpus.find((i) => i.slug === slug);
}

export function parseEvaluation(item: Item): Evaluation {
  return JSON.parse(item.evaluationJson) as Evaluation;
}

/** Opaque cursor position for the bulk dump: last (createdAt, id) served. */
export type DumpCursor = { createdAt: number; id: string };
export type DumpPage = { items: Item[]; nextCursor: DumpCursor | null };

/**
 * One page of the full corpus for the public dump — every item, newest-first
 * with `id` (slug) as a stable tiebreaker so cursor paging never skips or
 * repeats a row.
 */
export function dumpItems(
  opts: { limit: number; cursor?: DumpCursor; kind?: string },
  corpus: Item[] = loadCorpus(),
): DumpPage {
  const { limit, cursor, kind } = opts;
  const ordered = [...corpus]
    .filter((i) => (kind ? i.kind === kind : true))
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

  const start = cursor
    ? ordered.findIndex(
        (i) =>
          i.createdAt < cursor.createdAt || (i.createdAt === cursor.createdAt && i.id < cursor.id),
      )
    : 0;
  const from = start === -1 ? ordered.length : start;
  const page = ordered.slice(from, from + limit);
  const hasMore = from + limit < ordered.length;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { items: page, nextCursor };
}
