import { CATEGORY_LABELS, type Category } from "@aix/core";

/**
 * Shared formatting for the item share surface — the OG/unfurl description
 * (server metadata) and the copy-to-clipboard summary (client share button)
 * speak with one voice, so a pasted link and a pasted blurb read the same.
 */

export type ShareItem = {
  title: string;
  tagline: string;
  verdict: string;
  overallScore: number;
  noiseScore: number;
  category: string;
};

/** "complexity-trap" → "Complexity Trap". */
export function verdictTitle(verdict: string): string {
  return verdict.replace(/(^|-)([a-z])/g, (_, sep, ch: string) => (sep ? " " : "") + ch.toUpperCase());
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as Category] ?? category;
}

/** One-line judgment for unfurl descriptions and the X share text. */
export function shareBlurb(item: ShareItem): string {
  return `Verdict: ${verdictTitle(item.verdict)} · ${item.overallScore}/100 overall · Noise ${item.noiseScore}/100 · ${categoryLabel(
    item.category,
  )} — ${item.tagline}`;
}

/**
 * Multi-line summary for pasting into a chat (Discord/Slack). The trailing URL
 * still unfurls into the rich card; the text carries the scorecard above it.
 */
export function shareSummary(item: ShareItem, url: string): string {
  return [
    `**${item.title}** — ${item.tagline}`,
    "",
    `Verdict: ${verdictTitle(item.verdict)} · Overall ${item.overallScore}/100 · Noise ${item.noiseScore}/100 · ${categoryLabel(
      item.category,
    )}`,
    "",
    `Full evaluation on AIx: ${url}`,
  ].join("\n");
}
