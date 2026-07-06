import type { Item } from "@aix/db";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import { absoluteUrl, xmlEscape } from "./public-api";

/**
 * Atom 1.0 feed rendering for published items. Atom (not RSS 2.0) because it has
 * a first-class `updated`/`published` distinction and mandates absolute IDs,
 * which keeps the feed valid across readers. All text is XML-escaped.
 */

/** Summary shown in the feed: tagline plus the harsh verdict and score. */
function itemSummary(item: Item): string {
  const label = CATEGORY_LABELS[item.category as Category] ?? item.category;
  return `${item.tagline} — verdict: ${item.verdict}, ${item.overallScore}/100 (${label})`;
}

function entry(item: Item): string {
  const link = absoluteUrl(`/item/${item.slug}`);
  const published = new Date(item.createdAt * 1000).toISOString();
  const label = CATEGORY_LABELS[item.category as Category] ?? item.category;
  return `  <entry>
    <title>${xmlEscape(item.title)}</title>
    <id>${xmlEscape(link)}</id>
    <link href="${xmlEscape(link)}" />
    <updated>${published}</updated>
    <published>${published}</published>
    <category term="${xmlEscape(item.category)}" label="${xmlEscape(label)}" />
    <summary>${xmlEscape(itemSummary(item))}</summary>
  </entry>`;
}

/**
 * Render a full Atom document. `feedPath` is the self-link path (e.g. `/feed.xml`
 * or `/feed/mcp-server`); `titleSuffix` narrows the feed title for category feeds.
 */
export function renderAtomFeed(items: Item[], feedPath: string, titleSuffix = ""): string {
  const self = absoluteUrl(feedPath);
  const title = `AIx — trending dev tools, harshly judged${titleSuffix}`;
  const updated =
    items.length > 0 ? new Date(items[0]!.createdAt * 1000).toISOString() : new Date().toISOString();

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(title)}</title>
  <subtitle>The fast-moving world of AI dev tools, distilled and judged.</subtitle>
  <id>${xmlEscape(self)}</id>
  <link href="${xmlEscape(self)}" rel="self" />
  <link href="${xmlEscape(absoluteUrl("/"))}" />
  <updated>${updated}</updated>
${items.map(entry).join("\n")}
</feed>
`;
}
