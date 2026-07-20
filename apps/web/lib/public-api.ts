import type { Item } from "@aix/db";
import type { Evaluation } from "@aix/core";

/**
 * Shared helpers for the public, unauthenticated distribution surface (RSS/Atom
 * feeds, the read-only JSON API, sitemap, OG images). Kept separate from the
 * internal/authoring code so the "clean public shape" is defined in exactly one
 * place and can never leak a raw DB column.
 */

/** Absolute site base URL, no trailing slash. */
export function baseUrl(): string {
  const base = process.env.AIX_PUBLIC_URL ?? "https://aix.trevormil.com";
  return base.replace(/\/$/, "");
}

/** Absolute URL for a site path (which must start with "/"). */
export function absoluteUrl(path: string): string {
  return `${baseUrl()}${path}`;
}

/** Escape text for safe inclusion in XML/HTML element bodies and attributes. */
export function xmlEscape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

/** The clean, stable public projection of an item — never the raw DB row. */
export type PublicItem = {
  slug: string;
  title: string;
  url: string;
  kind: string;
  category: string;
  integration: string;
  verdict: string;
  overallScore: number;
  noiseScore: number;
  tagline: string;
  audience: string | null;
  coverImageUrl: string | null;
  createdAt: string; // ISO-8601
};

/** Project a DB item row into the whitelisted public shape. */
export function toPublicItem(item: Item): PublicItem {
  return {
    slug: item.slug,
    title: item.title,
    url: item.url,
    kind: item.kind,
    category: item.category,
    integration: item.integration,
    verdict: item.verdict,
    overallScore: item.overallScore,
    noiseScore: item.noiseScore,
    tagline: item.tagline,
    audience: item.primaryAudience ?? null,
    coverImageUrl: item.coverImageUrl ?? null,
    createdAt: new Date(item.createdAt * 1000).toISOString(),
  };
}

/** PublicItem plus the social counters the ranked lists display. */
export type RankedItem = PublicItem & { upvotes: number; commentCount: number };

export function toRankedItem(item: Item): RankedItem {
  return { ...toPublicItem(item), upvotes: item.upvotes, commentCount: item.commentCount };
}

/**
 * The full public projection for the bulk dump: everything a consumer needs to
 * mirror an item — the light `PublicItem` fields plus our official evaluation
 * ("take"), the repo's README, and the remaining descriptive metadata. Still a
 * whitelist (no raw internal columns like `postedById` or `score`).
 */
export type DumpItem = PublicItem & {
  externalId: string;
  tags: string[];
  media: unknown[];
  aiEngineerFit: number | null;
  vibeCoderFit: number | null;
  evaluatedBy: string;
  model: string | null;
  scoredAt: string | null; // ISO-8601, null until judged
  dailyPickAt: string | null; // ISO-8601, null unless a daily trending pick
  upvotes: number;
  commentCount: number;
  readmeMd: string | null; // the repo's own README markdown
  evaluation: Evaluation; // the full canonical @aix/core evaluation
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Project a DB item row into the full dump shape. */
export function toDumpItem(item: Item): DumpItem {
  return {
    ...toPublicItem(item),
    externalId: item.externalId,
    tags: parseJson<string[]>(item.tagsJson, []),
    media: parseJson<unknown[]>(item.mediaJson, []),
    aiEngineerFit: item.aiEngineerFit ?? null,
    vibeCoderFit: item.vibeCoderFit ?? null,
    evaluatedBy: item.evaluatedBy,
    model: item.model ?? null,
    scoredAt: item.scoredAt ? new Date(item.scoredAt * 1000).toISOString() : null,
    dailyPickAt: item.dailyPickAt ? new Date(item.dailyPickAt * 1000).toISOString() : null,
    upvotes: item.upvotes,
    commentCount: item.commentCount,
    readmeMd: item.readmeMd ?? null,
    evaluation: parseJson<Evaluation>(item.evaluationJson, {} as Evaluation),
  };
}
