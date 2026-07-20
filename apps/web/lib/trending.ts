import { getEnv } from "./env";

/**
 * Live "what's rising" proxies for the iOS Trending tab (ticket 0067).
 * GitHub: the official search API (github.com/trending has no API — young
 * repos ranked by stars is the same proxy the scanner uses). Product Hunt:
 * the v2 GraphQL API with the server-side developer token. Both cached
 * in-memory so casual browsing never touches upstream rate limits.
 */

export type TrendingWindow = "daily" | "weekly";

export type TrendingRepo = {
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
  createdAt: string | null;
  avatarUrl: string | null;
  forks: number;
  openIssues: number;
  topics: string[];
  homepage: string | null;
  license: string | null;
  pushedAt: string | null;
};

export type TrendingProduct = {
  name: string;
  tagline: string;
  url: string;
  votes: number;
  topics: string[];
  thumbnailUrl: string | null;
  description: string | null;
  commentsCount: number;
  website: string | null;
  mediaUrls: string[];
};

export type TrendingStory = {
  title: string;
  url: string | null; // the linked article/repo (null for text posts)
  hnUrl: string; // the HN discussion
  points: number;
  comments: number;
  author: string | null;
  createdAt: string | null;
  /** owner/name when the story links a GitHub repo (enables in-app README). */
  githubRepo: string | null;
};

export type TrendingModel = {
  id: string; // "owner/name"
  url: string; // huggingface.co page
  likes: number;
  downloads: number;
  pipelineTag: string | null;
  tags: string[];
  createdAt: string | null;
};

/** Thrown when an upstream source isn't configured (→ 503, not 500). */
export class TrendingUnavailable extends Error {}

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

/** Test hook: reset the memo between suites. */
export function clearTrendingCache(): void {
  cache.clear();
}

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  const data = await fetcher();
  cache.set(key, { at: Date.now(), data });
  return data;
}

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export async function githubTrending(window: TrendingWindow): Promise<TrendingRepo[]> {
  return cached(`github:${window}`, async () => {
    // "Trending" proxy: repos created in the window, ranked by stars. A
    // 2-day daily window smooths timezone edges around midnight UTC.
    const q =
      window === "daily"
        ? `created:>${daysAgoDate(2)} stars:>5`
        : `created:>${daysAgoDate(7)} stars:>20`;
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", q);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "25");

    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "user-agent": "aix-web",
    };
    const token = getEnv().GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub search failed: HTTP ${res.status}`);
    const body = (await res.json()) as {
      items?: {
        full_name?: string;
        html_url?: string;
        description?: string | null;
        stargazers_count?: number;
        language?: string | null;
        created_at?: string;
        owner?: { avatar_url?: string };
        forks_count?: number;
        open_issues_count?: number;
        topics?: string[];
        homepage?: string | null;
        license?: { spdx_id?: string | null; name?: string | null } | null;
        pushed_at?: string;
      }[];
    };
    return (body.items ?? []).map((r) => ({
      fullName: r.full_name ?? "",
      url: r.html_url ?? "",
      description: r.description ?? null,
      stars: r.stargazers_count ?? 0,
      language: r.language ?? null,
      createdAt: r.created_at ?? null,
      avatarUrl: r.owner?.avatar_url ?? null,
      forks: r.forks_count ?? 0,
      openIssues: r.open_issues_count ?? 0,
      topics: r.topics ?? [],
      homepage: r.homepage || null,
      license:
        r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION"
          ? r.license.spdx_id
          : (r.license?.name ?? null),
      pushedAt: r.pushed_at ?? null,
    }));
  });
}

/**
 * Fetch a trending repo's README as GitHub-rendered HTML (cached per repo).
 * The `html` media type gives exactly what github.com renders — full GFM
 * (tables, code, task lists) with relative links resolved and GitHub's own
 * sanitizer applied.
 */
export async function githubReadmeHtml(fullName: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
    throw new TrendingUnavailable("repo must look like owner/name");
  }
  return cached(`readme-html:${fullName.toLowerCase()}`, async () => {
    const headers: Record<string, string> = {
      accept: "application/vnd.github.html+json",
      "user-agent": "aix-web",
    };
    const token = getEnv().GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/repos/${fullName}/readme`, { headers });
    if (res.status === 404) return null; // repo has no README — not an error
    if (!res.ok) throw new Error(`GitHub readme failed: HTTP ${res.status}`);
    // Cap at ~300KB so a giant README can't balloon the cache or the client.
    return (await res.text()).slice(0, 300_000);
  });
}

const PH_API = "https://api.producthunt.com/v2/api/graphql";

const PH_QUERY = `query Trending($first: Int!, $postedAfter: DateTime) {
  posts(order: VOTES, first: $first, postedAfter: $postedAfter) {
    edges {
      node {
        name
        tagline
        description
        url
        website
        votesCount
        commentsCount
        thumbnail { url }
        media { url type }
        topics(first: 5) { edges { node { name } } }
      }
    }
  }
}`;

export async function productHuntTrending(window: TrendingWindow): Promise<TrendingProduct[]> {
  const token = getEnv().PRODUCTHUNT_API_TOKEN;
  if (!token) {
    throw new TrendingUnavailable("Product Hunt trending needs PRODUCTHUNT_API_TOKEN");
  }
  return cached(`producthunt:${window}`, async () => {
    // Daily = launches since midnight UTC; weekly = the last 7 days.
    const postedAfter =
      window === "daily"
        ? `${new Date().toISOString().slice(0, 10)}T00:00:00Z`
        : `${daysAgoDate(7)}T00:00:00Z`;

    const res = await fetch(PH_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: PH_QUERY, variables: { first: 25, postedAfter } }),
    });
    if (!res.ok) throw new Error(`Product Hunt API failed: HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        posts?: {
          edges?: {
            node?: {
              name?: string;
              tagline?: string;
              description?: string;
              url?: string;
              website?: string;
              votesCount?: number;
              commentsCount?: number;
              thumbnail?: { url?: string };
              media?: { url?: string; type?: string }[];
              topics?: { edges?: { node?: { name?: string } }[] };
            };
          }[];
        };
      };
      errors?: { message?: string }[];
    };
    if (body.errors?.length) {
      throw new Error(`Product Hunt API error: ${body.errors[0]?.message ?? "unknown"}`);
    }
    return (body.data?.posts?.edges ?? [])
      .map((e) => e.node)
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({
        name: n.name ?? "",
        tagline: n.tagline ?? "",
        url: n.url ?? "",
        votes: n.votesCount ?? 0,
        topics: (n.topics?.edges ?? []).map((t) => t.node?.name).filter((t): t is string => !!t),
        thumbnailUrl: n.thumbnail?.url ?? null,
        description: n.description ?? null,
        commentsCount: n.commentsCount ?? 0,
        website: n.website ?? null,
        mediaUrls: (n.media ?? [])
          .filter((m) => m.type === "image" && m.url)
          .map((m) => m.url as string)
          .slice(0, 4),
      }));
  });
}

/**
 * AI-affinity filter for HN — the community this serves cares about coding
 * agents and the tooling around them (mirrors the scanner's ranking signals).
 */
const AI_SIGNALS = [
  "ai",
  "llm",
  "agent",
  "claude",
  "codex",
  "gpt",
  "openai",
  "anthropic",
  "gemini",
  "llama",
  "mistral",
  "mcp",
  "rag",
  "copilot",
  "prompt",
  "model",
  "ml",
  "neural",
  "transformer",
  "diffusion",
  "embedding",
  "fine-tun",
  "inference",
  "cursor",
  "openclaw",
];

function looksAI(title: string): boolean {
  const words = title.toLowerCase();
  return AI_SIGNALS.some((s) =>
    s.length <= 3 ? new RegExp(`\\b${s}\\b`, "i").test(words) : words.includes(s),
  );
}

const GH_REPO_RE = /github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/;

/**
 * Show HN via the public Algolia API (no auth): top stories in the window,
 * filtered to AI-relevant titles, topped up with the unfiltered leaders when
 * the filter over-prunes a quiet day.
 */
export async function hackerNewsTrending(window: TrendingWindow): Promise<TrendingStory[]> {
  return cached(`hackernews:${window}`, async () => {
    const since = Math.floor(Date.now() / 1000) - (window === "daily" ? 2 : 7) * 86_400;
    const url = new URL("https://hn.algolia.com/api/v1/search");
    url.searchParams.set("tags", "show_hn");
    url.searchParams.set("numericFilters", `created_at_i>${since}`);
    url.searchParams.set("hitsPerPage", "100");

    const res = await fetch(url, { headers: { "user-agent": "aix-web" } });
    if (!res.ok) throw new Error(`HN search failed: HTTP ${res.status}`);
    const body = (await res.json()) as {
      hits?: {
        title?: string;
        url?: string | null;
        objectID?: string;
        points?: number;
        num_comments?: number;
        author?: string;
        created_at?: string;
      }[];
    };

    const toStory = (h: NonNullable<typeof body.hits>[number]): TrendingStory => ({
      title: (h.title ?? "").replace(/^show hn:\s*/i, ""),
      url: h.url ?? null,
      hnUrl: `https://news.ycombinator.com/item?id=${h.objectID ?? ""}`,
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      author: h.author ?? null,
      createdAt: h.created_at ?? null,
      githubRepo: h.url?.match(GH_REPO_RE)?.[1]?.replace(/\.git$/, "") ?? null,
    });

    const hits = (body.hits ?? []).filter((h) => h.title);
    const ai = hits.filter((h) => looksAI(h.title!));
    // Quiet day for AI launches → top up with the unfiltered leaders rather
    // than showing a near-empty list.
    const pool = ai.length >= 10 ? ai : [...ai, ...hits.filter((h) => !looksAI(h.title!))];
    return pool.slice(0, 25).map(toStory);
  });
}

/**
 * Hugging Face trending models via the public hub API (no auth). HF's
 * trending score is inherently recent, so the window doesn't apply.
 */
export async function huggingFaceTrending(): Promise<TrendingModel[]> {
  return cached("huggingface", async () => {
    const url = new URL("https://huggingface.co/api/models");
    url.searchParams.set("sort", "trendingScore");
    url.searchParams.set("direction", "-1");
    url.searchParams.set("limit", "25");

    const res = await fetch(url, { headers: { "user-agent": "aix-web" } });
    if (!res.ok) throw new Error(`HF API failed: HTTP ${res.status}`);
    const body = (await res.json()) as {
      id?: string;
      likes?: number;
      downloads?: number;
      pipeline_tag?: string;
      tags?: string[];
      createdAt?: string;
    }[];

    return (Array.isArray(body) ? body : [])
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id!,
        url: `https://huggingface.co/${m.id}`,
        likes: m.likes ?? 0,
        downloads: m.downloads ?? 0,
        pipelineTag: m.pipeline_tag ?? null,
        tags: (m.tags ?? []).filter((t) => !t.includes(":")).slice(0, 6),
        createdAt: m.createdAt ?? null,
      }));
  });
}

/**
 * A Hugging Face model card as raw markdown with the YAML frontmatter block
 * stripped (the caller renders it). Cached per model.
 */
export async function huggingFaceModelCard(modelId: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(modelId)) {
    throw new TrendingUnavailable("model must look like owner/name");
  }
  return cached(`hf-card:${modelId.toLowerCase()}`, async () => {
    const res = await fetch(`https://huggingface.co/${modelId}/raw/main/README.md`, {
      headers: { "user-agent": "aix-web" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HF model card failed: HTTP ${res.status}`);
    const raw = (await res.text()).slice(0, 300_000);
    // Strip the metadata frontmatter (--- ... ---) HF model cards lead with.
    return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  });
}
