import { ItemSource } from "@aix/core";
import type { Discovered, DiscoverySource } from "../types";
import { nullLogger, type Logger } from "../logger";

/**
 * ProductHunt discovery via the v2 GraphQL API. Launched products are judged
 * through the `product` lens (baseline = incumbents / DIY), so a SaaS launch is
 * evaluated as a product, not against a base agent. Auth is a server-side
 * developer token; when it's absent the scanner never constructs this source.
 * The tagline + description serve as the evaluator's "readme" (PH has no README).
 */

const API = "https://api.producthunt.com/v2/api/graphql";

const TRENDING_QUERY = `query Trending($first: Int!) {
  posts(order: VOTES, first: $first) {
    edges {
      node {
        id
        name
        tagline
        description
        url
        website
        votesCount
        createdAt
        slug
        topics(first: 5) { edges { node { name } } }
      }
    }
  }
}`;

type PhNode = {
  id?: string;
  name?: string;
  tagline?: string;
  description?: string;
  url?: string;
  website?: string;
  votesCount?: number;
  createdAt?: string;
  slug?: string;
  topics?: { edges?: { node?: { name?: string } }[] };
};

type PhResponse = {
  data?: { posts?: { edges?: { node?: PhNode }[] } };
  errors?: { message?: string }[];
};

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** The evaluator's "readme": everything PH gives us about the product, as text. */
function bodyText(n: PhNode): string {
  const topics = (n.topics?.edges ?? [])
    .map((e) => e.node?.name)
    .filter(Boolean)
    .join(", ");
  return [
    n.name && n.tagline ? `${n.name} — ${n.tagline}` : (n.name ?? n.tagline ?? ""),
    n.description ? clean(n.description) : "",
    topics ? `Topics: ${topics}` : "",
    n.votesCount != null ? `ProductHunt upvotes: ${n.votesCount}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Parse a PH GraphQL `posts` response into `Discovered[]`. Pure + network-free so
 * it can be unit-tested against a fixed payload. Malformed nodes are skipped.
 */
export function parsePostsResponse(json: PhResponse): Discovered[] {
  const edges = json.data?.posts?.edges ?? [];
  const out: Discovered[] = [];
  for (const edge of edges) {
    const n = edge.node;
    if (!n?.slug || !n.name) continue;
    // Prefer the product's own site for the canonical link; fall back to PH.
    const url = n.website || n.url;
    if (!url) continue;
    try {
      const source = ItemSource.parse({
        kind: "producthunt",
        externalId: n.slug,
        url,
        title: clean(n.name).slice(0, 200),
        description: n.tagline ? clean(n.tagline).slice(0, 2000) : undefined,
        upvotes: typeof n.votesCount === "number" ? n.votesCount : undefined,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : undefined,
      });
      out.push({ source, readme: bodyText(n) });
    } catch {
      // Skip a malformed node rather than failing the whole batch.
    }
  }
  return out;
}

/** Most ProductHunt upvotes first — the source's trending signal. */
export function rankByUpvotes(cands: Discovered[]): Discovered[] {
  return [...cands].sort((a, b) => (b.source.upvotes ?? 0) - (a.source.upvotes ?? 0));
}

export type ProductHuntSourceOptions = {
  token: string;
  log?: Logger;
  fetchImpl?: typeof fetch;
};

export function createProductHuntSource(opts: ProductHuntSourceOptions): DiscoverySource {
  const log = opts.log ?? nullLogger;
  const doFetch = opts.fetchImpl ?? fetch;

  async function graphql(query: string, variables: Record<string, unknown>): Promise<PhResponse> {
    const res = await doFetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`producthunt ${res.status}: ${await res.text()}`);
    return (await res.json()) as PhResponse;
  }

  return {
    name: "producthunt",

    async discoverTrending(limit: number): Promise<Discovered[]> {
      try {
        const json = await graphql(TRENDING_QUERY, { first: limit });
        if (json.errors?.length) {
          log.warn(`producthunt errors: ${json.errors.map((e) => e.message).join("; ")}`);
        }
        const items = rankByUpvotes(parsePostsResponse(json)).slice(0, limit);
        log.info(`producthunt discovered ${items.length}`);
        return items;
      } catch (err) {
        log.warn(`producthunt discovery failed: ${String(err)}`);
        return [];
      }
    },

    // Human-submitted PH links are an edge case; discovery is the primary path.
    // Return null (not ours) rather than guess at slug-based lookup semantics.
    async resolveUrl(): Promise<Discovered | null> {
      return null;
    },
  };
}
