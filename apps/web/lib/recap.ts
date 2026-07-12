import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, items, type Item } from "@aix/db";

/**
 * The nightly recap (ticket 0040): the tools JUDGED on one UTC calendar day,
 * framed editorially. This is the product's spine — the web archive and the
 * email are both rendered from getRecap().
 */

export type RecapItem = Item;

export type Recap = {
  /** UTC calendar day, "YYYY-MM-DD". */
  date: string;
  items: RecapItem[];
  total: number;
  /** verdict → count, for the "2 essential, 1 trap" summary line. */
  verdictCounts: Record<string, number>;
  /** The night's headline — highest overall score. */
  leadPick: RecapItem | null;
  /** The harsh callout — noisiest complexity-trap / redundant verdict, if any. */
  complexityTrap: RecapItem | null;
};

/** [startSec, endSec) bounds of a UTC "YYYY-MM-DD" day. Returns null if malformed. */
function dayBounds(date: string): { start: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  if (!Number.isFinite(start)) return null;
  return { start, end: start + 86_400 };
}

/** The recap for one UTC day, or null when nothing was judged that day. */
export function getRecap(date: string): Recap | null {
  const bounds = dayBounds(date);
  if (!bounds) return null;

  const rows = getDb()
    .select()
    .from(items)
    .where(
      and(
        eq(items.published, true),
        eq(items.scoreStatus, "scored"),
        isNotNull(items.scoredAt),
        gte(items.scoredAt, bounds.start),
        lt(items.scoredAt, bounds.end),
      ),
    )
    .orderBy(desc(items.overallScore))
    .all();
  if (rows.length === 0) return null;

  const items_: RecapItem[] = rows;

  const verdictCounts: Record<string, number> = {};
  for (const i of items_) verdictCounts[i.verdict] = (verdictCounts[i.verdict] ?? 0) + 1;

  const traps = items_
    .filter((i) => i.verdict === "complexity-trap" || i.verdict === "redundant")
    .sort((a, b) => b.noiseScore - a.noiseScore);

  return {
    date,
    items: items_,
    total: items_.length,
    verdictCounts,
    leadPick: items_[0] ?? null, // already sorted by score desc
    complexityTrap: traps[0] ?? null,
  };
}

/** UTC dates (newest first) that have at least one judged item. */
export function recentRecapDates(limit = 30): string[] {
  const rows = getDb()
    .select({
      day: sql<string>`strftime('%Y-%m-%d', ${items.scoredAt}, 'unixepoch')`,
    })
    .from(items)
    .where(
      and(eq(items.published, true), eq(items.scoreStatus, "scored"), isNotNull(items.scoredAt)),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`)
    .limit(limit)
    .all();
  return rows.map((r) => r.day).filter(Boolean);
}

/** The most recent day with a recap, or null if none exist yet. */
export function latestRecapDate(): string | null {
  return recentRecapDates(1)[0] ?? null;
}

/** Convenience for the pages/email: the latest recap object, or null. */
export function latestRecap(): Recap | null {
  const d = latestRecapDate();
  return d ? getRecap(d) : null;
}

/** Human date label, e.g. "Monday, July 6, 2026" (UTC). */
export function recapDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "2 essential · 1 complexity trap" — the summary line, verdict order. */
const VERDICT_ORDER = [
  "essential",
  "worthwhile",
  "niche",
  "marginal",
  "redundant",
  "complexity-trap",
] as const;

export function verdictSummary(counts: Record<string, number>): string {
  return VERDICT_ORDER.filter((v) => counts[v])
    .map((v) => `${counts[v]} ${v.replace("-", " ")}`)
    .join(" · ");
}
