import { XMLParser } from "fast-xml-parser";
import { ItemSource } from "@aix/core";
import type { Discovered, DiscoverySource } from "../types";
import { nullLogger, type Logger } from "../logger";

/**
 * arXiv discovery via the Atom export API. Polled POLITELY — at most one request
 * per 3s (architecture.md §5) — across the categories relevant to AI-assisted dev
 * (cs.AI, cs.LG, cs.CL, cs.SE, cs.IR, stat.ML). The abstract serves as the
 * evaluator's "readme".
 */

const CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.SE", "cs.IR", "stat.ML"] as const;
const MIN_INTERVAL_MS = 3000;
const API = "http://export.arxiv.org/api/query";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

type AtomAuthor = { name?: string };
type AtomEntry = {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  author?: AtomAuthor | AtomAuthor[];
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Parse an arXiv Atom feed into `ItemSource[]`. Pure + network-free so it can be
 * unit-tested against a fixed feed.
 */
export function parseArxivFeed(xml: string): ItemSource[] {
  const feed = parser.parse(xml) as { feed?: { entry?: AtomEntry | AtomEntry[] } };
  const raw = feed?.feed?.entry;
  const entries: AtomEntry[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const out: ItemSource[] = [];
  for (const e of entries) {
    if (!e.id || !e.title) continue;
    const idUrl = String(e.id);
    const arxivId = idUrl
      .replace(/^https?:\/\/arxiv\.org\/abs\//i, "")
      .replace(/v\d+$/i, "");
    const authorsRaw: AtomAuthor[] = Array.isArray(e.author) ? e.author : e.author ? [e.author] : [];
    const authors = authorsRaw
      .map((a) => (a.name ? clean(String(a.name)).slice(0, 120) : ""))
      .filter(Boolean)
      .slice(0, 50);
    const published = e.published ? new Date(e.published).toISOString() : undefined;

    try {
      out.push(
        ItemSource.parse({
          kind: "arxiv_paper",
          externalId: arxivId,
          url: idUrl,
          title: clean(String(e.title)).slice(0, 200),
          author: authors[0],
          description: e.summary ? clean(String(e.summary)).slice(0, 2000) : undefined,
          authors: authors.length ? authors : undefined,
          publishedAt: published,
        }),
      );
    } catch {
      // Skip a malformed entry rather than failing the whole feed.
    }
  }
  return out;
}

export type ArxivSourceOptions = {
  log?: Logger;
  fetchImpl?: (url: string) => Promise<Response>;
};

export function createArxivSource(opts: ArxivSourceOptions = {}): DiscoverySource {
  const log = opts.log ?? nullLogger;
  const fetchImpl = opts.fetchImpl ?? ((url: string) => fetch(url));
  let lastRequestAt = 0;

  async function polite<T>(fn: () => Promise<T>): Promise<T> {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  }

  const toDiscovered = (s: ItemSource): Discovered => ({ source: s, readme: s.description ?? "" });

  return {
    name: "arxiv",

    async discoverTrending(limit: number): Promise<Discovered[]> {
      const query = CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
      const url = `${API}?search_query=${query}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
      try {
        const res = await polite(() => fetchImpl(url));
        const xml = await res.text();
        const items = parseArxivFeed(xml).slice(0, limit);
        log.info(`arxiv discovered ${items.length}`);
        return items.map(toDiscovered);
      } catch (err) {
        log.warn(`arxiv discovery failed: ${String(err)}`);
        return [];
      }
    },

    async resolveUrl(url: string): Promise<Discovered | null> {
      const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]+)/i);
      if (!m) return null;
      const id = m[1]!;
      try {
        const res = await polite(() => fetchImpl(`${API}?id_list=${id}`));
        const xml = await res.text();
        const items = parseArxivFeed(xml);
        return items[0] ? toDiscovered(items[0]) : null;
      } catch (err) {
        log.warn(`arxiv resolve failed for ${id}: ${String(err)}`);
        return null;
      }
    },
  };
}
