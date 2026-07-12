import type { Item } from "@aix/db";
import { loadCorpus } from "./corpus";

/**
 * The nightly recap (ticket 0040): the tools JUDGED on one UTC calendar day,
 * framed editorially. This is the product's spine — the web archive is rendered
 * from getRecap(), grouping the git corpus by each item's `scoredAt` day.
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

/** UTC "YYYY-MM-DD" for a unix-seconds timestamp. */
function utcDay(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

/** The recap for one UTC day, or null when nothing was judged that day. */
export function getRecap(date: string, corpus: Item[] = loadCorpus()): Recap | null {
  const bounds = dayBounds(date);
  if (!bounds) return null;

  const rows = corpus
    .filter((i) => i.scoredAt != null && i.scoredAt >= bounds.start && i.scoredAt < bounds.end)
    .sort((a, b) => b.overallScore - a.overallScore);
  if (rows.length === 0) return null;

  const verdictCounts: Record<string, number> = {};
  for (const i of rows) verdictCounts[i.verdict] = (verdictCounts[i.verdict] ?? 0) + 1;

  const traps = rows
    .filter((i) => i.verdict === "complexity-trap" || i.verdict === "redundant")
    .sort((a, b) => b.noiseScore - a.noiseScore);

  return {
    date,
    items: rows,
    total: rows.length,
    verdictCounts,
    leadPick: rows[0] ?? null, // already sorted by score desc
    complexityTrap: traps[0] ?? null,
  };
}

/** UTC dates (newest first) that have at least one judged item. */
export function recentRecapDates(limit = 30, corpus: Item[] = loadCorpus()): string[] {
  const days = new Set<string>();
  for (const i of corpus) if (i.scoredAt != null) days.add(utcDay(i.scoredAt));
  return [...days].sort((a, b) => b.localeCompare(a)).slice(0, limit);
}

/** The most recent day with a recap, or null if none exist yet. */
export function latestRecapDate(corpus: Item[] = loadCorpus()): string | null {
  return recentRecapDates(1, corpus)[0] ?? null;
}

/** Convenience for the pages: the latest recap object, or null. */
export function latestRecap(corpus: Item[] = loadCorpus()): Recap | null {
  const d = latestRecapDate(corpus);
  return d ? getRecap(d, corpus) : null;
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
