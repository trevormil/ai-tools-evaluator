import type { Item } from "@aix/db";

/**
 * Shared helpers for the public, unauthenticated distribution surface (RSS/Atom
 * feeds, the read-only JSON API, sitemap, OG images). Kept separate from the
 * internal/authoring code so the "clean public shape" is defined in exactly one
 * place and can never leak a raw DB column.
 */

/** Absolute site base URL, no trailing slash. Mirrors `newsletter.publicUrl`. */
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
