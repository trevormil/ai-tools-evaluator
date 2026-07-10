import { ItemSource } from "@aix/core";
import type { Discovered, DiscoverySource } from "../types";
import { nullLogger, type Logger } from "../logger";

/**
 * HackerNews discovery via the public Firebase API (https://github.com/HackerNews/API).
 *
 * SCAFFOLDING — not yet wired into the daily scan (ticket 0054). HN is a *router*,
 * not its own item type: a Show-HN linking a GitHub repo should become a
 * `github_repo` (agent-tool lens), a product launch an `external_link` (product
 * lens), so it dedups against and reuses the existing sources/lenses. This module
 * fetches + classifies stories; how they enter the catalog (or a separate digest)
 * is the open decision. Enriching non-GitHub links with the target page's content
 * for the evaluator is a TODO (HN gives only the title/url).
 */

const BASE = "https://hacker-news.firebaseio.com/v0";

/** Which HN list to pull. Show HN skews toward launches/projects; top is broad. */
export type HnList = "topstories" | "newstories" | "beststories" | "showstories";

export type HnItem = {
  id?: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  text?: string;
  descendants?: number;
};

const GH_RE = /github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/;
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Classify + map an HN story to a Discovered, routing by its link target:
 *  - a GitHub repo  → `github_repo` (agent-tool lens), externalId `owner/repo`
 *    so it dedups with the GitHub source;
 *  - any other link → `external_link` (product lens).
 * Returns null for text-only posts (Ask/Show HN with no url) — nothing to evaluate.
 */
export function parseHnStory(item: HnItem): Discovered | null {
  if (item.type !== "story" || !item.title || !item.url) return null;

  const gh = item.url.match(GH_RE);
  const kind = gh ? "github_repo" : "external_link";
  const externalId = gh ? `${gh[1]}/${gh[2]!.replace(/\.git$/, "")}` : item.url.slice(0, 200);
  const url = gh ? `https://github.com/${gh[1]}/${gh[2]!.replace(/\.git$/, "")}` : item.url;

  const points = typeof item.score === "number" ? item.score : 0;
  const comments = typeof item.descendants === "number" ? item.descendants : 0;
  const hnContext = `Surfaced on HackerNews: ${points} points, ${comments} comments.`;
  const readme = [strip(item.title), item.text ? strip(item.text) : "", hnContext]
    .filter(Boolean)
    .join("\n\n");

  try {
    const source = ItemSource.parse({
      kind,
      externalId,
      url,
      title: strip(item.title).slice(0, 200),
      author: item.by,
      description: hnContext,
      createdAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    });
    return { source, readme };
  } catch {
    return null;
  }
}

export type HackerNewsSourceOptions = {
  log?: Logger;
  fetchImpl?: (url: string) => Promise<Response>;
  /** Which list to pull (default topstories). */
  list?: HnList;
};

export function createHackerNewsSource(opts: HackerNewsSourceOptions = {}): DiscoverySource {
  const log = opts.log ?? nullLogger;
  const fetchImpl = opts.fetchImpl ?? ((url: string) => fetch(url));
  const list = opts.list ?? "topstories";

  const getItem = async (id: number): Promise<HnItem | null> => {
    try {
      const res = await fetchImpl(`${BASE}/item/${id}.json`);
      return (await res.json()) as HnItem;
    } catch {
      return null;
    }
  };

  return {
    name: "hackernews",

    async discoverTrending(limit: number): Promise<Discovered[]> {
      try {
        const res = await fetchImpl(`${BASE}/${list}.json`);
        const ids = (await res.json()) as number[];
        const out: Discovered[] = [];
        // Walk the ranked list, fetching items until we have `limit` routable ones
        // (bounded so a page of text-posts can't spin forever).
        for (const id of ids.slice(0, limit * 3)) {
          if (out.length >= limit) break;
          const item = await getItem(id);
          const d = item ? parseHnStory(item) : null;
          if (d) out.push(d);
        }
        log.info(`hackernews discovered ${out.length} from ${list}`);
        return out;
      } catch (err) {
        log.warn(`hackernews discovery failed: ${String(err)}`);
        return [];
      }
    },

    async resolveUrl(url: string): Promise<Discovered | null> {
      const m = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/i);
      if (!m) return null;
      const item = await getItem(Number(m[1]));
      return item ? parseHnStory(item) : null;
    },
  };
}
