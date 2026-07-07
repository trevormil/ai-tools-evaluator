import { Octokit } from "@octokit/rest";
import { ItemSource } from "@aix/core";
import type { Discovered, DiscoverySource } from "../types";
import { nullLogger, type Logger } from "../logger";
import { evaluateQualityGate, type QualityThresholds } from "./quality-gate";

/**
 * GitHub discovery. Surfaces recently-created AND fast-rising repos across a
 * ROTATING set of search facets (topics + time windows) so we spread load
 * instead of hammering one query. Scope is AI/LLM tooling — the stuff an AI
 * engineer actually reaches for (agents, MCP servers, RAG, LLM frameworks,
 * inference/eval tooling). Every facet is topic-scoped to an AI topic, and a
 * relevance filter (isAiRelevant) drops anything that slips through before it
 * costs a README fetch or an evaluation.
 *
 * Resilience (architecture.md §5): authenticated Octokit, in-memory conditional
 * requests (ETag), exponential backoff on 403 secondary-rate-limit, and a hard
 * per-run API-call budget after which discovery stops gracefully.
 */

// Rotating facets — all AI/LLM topics (ticket 0043: AI-engineer scope only).
const TOPICS = [
  "llm",
  "large-language-models",
  "ai-agents",
  "agents",
  "agentic-ai",
  "mcp",
  "model-context-protocol",
  "rag",
  "langchain",
  "llmops",
  "generative-ai",
  "prompt-engineering",
  "ai-tools",
  "vector-database",
  "chatbot",
  "openai",
] as const;

/**
 * AI-relevance signal terms — matched against a repo's name, description, and
 * topics. Broad enough to keep AI-adjacent infra (vector stores, eval harnesses,
 * inference servers) but tight enough to drop a non-AI repo that a loose topic
 * happened to surface (ticket 0043).
 */
const AI_SIGNALS = [
  "llm",
  "gpt",
  " ai ",
  "ai-",
  "a.i.",
  "artificial intelligence",
  "machine learning",
  " ml ", // whole word only — avoid html/xml/yaml/toml
  "agent",
  "agentic",
  " rag ", // whole word only — avoid storage/fragment/drag
  "retrieval-augmented",
  "embedding",
  "prompt",
  "chatbot",
  "langchain",
  "llamaindex",
  "transformer",
  "diffusion",
  "neural",
  "openai",
  "anthropic",
  "claude",
  "gemini",
  "mistral",
  "llama",
  "mcp",
  "model context protocol",
  "generative",
  "inference",
  "fine-tun",
  "fine tun",
  "vector",
  "semantic search",
  "copilot",
  "assistant",
  "chatgpt",
  "text-to-",
  "speech-to-text",
  "multimodal",
] as const;

/**
 * True when the repo looks AI/LLM-relevant. Checks name + description + topics
 * against AI_SIGNALS. Padded with spaces so " ai "/" ml " match as whole words.
 */
export function isAiRelevant(input: {
  name?: string;
  description?: string | null;
  topics?: string[];
}): boolean {
  const hay = ` ${[input.name ?? "", input.description ?? "", ...(input.topics ?? [])]
    .join(" ")
    .toLowerCase()} `;
  return AI_SIGNALS.some((s) => hay.includes(s));
}

class BudgetExceeded extends Error {
  constructor() {
    super("github per-run API budget exhausted");
    this.name = "BudgetExceeded";
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const day = (now: Date, back: number) =>
  new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10);

/** Default rotation seed: the calendar-day index, so consecutive days differ. */
export function rotationSeed(now: Date): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * Rotating query facets — every one topic-scoped to an AI topic (ticket 0043).
 * The four topic facets sweep a NON-overlapping window of the topic list per run
 * (`seed*4 + {0,1,2,3}`), so consecutive runs explore genuinely different slices
 * and the window walks the whole list over time. `seed` is injectable (defaults
 * to the day index) to keep rotation testable.
 */
export function buildQueries(now: Date, seed: number = rotationSeed(now)): string[] {
  const base = seed * 4;
  const pick = (offset: number) =>
    TOPICS[(((base + offset) % TOPICS.length) + TOPICS.length) % TOPICS.length]!;
  const week = day(now, 7);
  const month = day(now, 30);
  return [
    `created:>${week} stars:>15 topic:${pick(0)}`, // freshly created, already noticed
    `pushed:>${week} stars:>200 topic:${pick(1)}`, // fast-rising in a rotating topic
    `created:>${month} stars:>75 topic:${pick(2)}`,
    `created:>${week} stars:>10 topic:${pick(3)}`,
  ];
}

type EtagEntry = { etag: string; data: unknown };

export type GitHubSourceOptions = {
  token: string;
  /** Hard cap on GitHub API calls per run. */
  callBudget?: number;
  log?: Logger;
  now?: () => Date;
  octokit?: Octokit; // injectable for tests
  /** Discovery quality gate thresholds. Omitted → gate is disabled (all pass). */
  quality?: QualityThresholds;
};

export function createGitHubSource(opts: GitHubSourceOptions): DiscoverySource {
  const octokit = opts.octokit ?? new Octokit({ auth: opts.token });
  const log = opts.log ?? nullLogger;
  const now = opts.now ?? (() => new Date());
  const callBudget = opts.callBudget ?? 80;
  const quality = opts.quality;
  const etags = new Map<string, EtagEntry>();
  let calls = 0;

  /** One budgeted API call with exponential backoff on secondary rate limits. */
  async function guarded<T>(fn: () => Promise<T>): Promise<T> {
    if (calls >= callBudget) throw new BudgetExceeded();
    calls++;
    let delay = 1000;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const e = err as {
          status?: number;
          message?: string;
          response?: { headers?: Record<string, string> };
        };
        const msg = e?.message ?? "";
        const remaining = e?.response?.headers?.["x-ratelimit-remaining"];
        const rateLimited =
          e?.status === 403 && (/secondary rate limit/i.test(msg) || remaining === "0");
        if (rateLimited && attempt < 4) {
          log.warn(`github rate-limited, backing off ${delay}ms`);
          await sleep(delay);
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error("unreachable");
  }

  /** Conditional (ETag) GET: reuse cached data on a 304. */
  async function conditional<T>(
    key: string,
    run: (headers: Record<string, string>) => Promise<{ data: T; headers: Record<string, string> }>,
  ): Promise<T> {
    const prev = etags.get(key);
    try {
      const res = await guarded(() => run(prev ? { "if-none-match": prev.etag } : {}));
      const etag = res.headers?.etag;
      if (etag) etags.set(key, { etag, data: res.data });
      return res.data;
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 304 && prev) return prev.data as T;
      throw err;
    }
  }

  function repoToSource(repo: {
    full_name: string;
    name: string;
    html_url: string;
    description?: string | null;
    topics?: string[];
    owner?: { login?: string } | null;
    stargazers_count?: number;
    language?: string | null;
    license?: { spdx_id?: string | null; key?: string | null } | null;
    pushed_at?: string | null;
    created_at?: string | null;
    archived?: boolean;
    fork?: boolean;
  }): ItemSource {
    return ItemSource.parse({
      kind: "github_repo",
      externalId: repo.full_name,
      url: repo.html_url,
      title: repo.name.slice(0, 200),
      author: repo.owner?.login ?? undefined,
      description: repo.description ? repo.description.slice(0, 2000) : undefined,
      stars: repo.stargazers_count,
      language: repo.language ?? undefined,
      license: repo.license?.spdx_id ?? repo.license?.key ?? undefined,
      pushedAt: repo.pushed_at ? new Date(repo.pushed_at).toISOString() : undefined,
      createdAt: repo.created_at ? new Date(repo.created_at).toISOString() : undefined,
    });
  }

  async function fetchReadme(owner: string, repo: string): Promise<string> {
    try {
      return await conditional<string>(`readme:${owner}/${repo}`, async (headers) => {
        const res = await octokit.rest.repos.getReadme({
          owner,
          repo,
          headers: { accept: "application/vnd.github.raw+json", ...headers },
        });
        // With the raw media type, `data` is the file contents as a string.
        const data =
          typeof res.data === "string"
            ? res.data
            : (res.data as { content?: string }).content
              ? Buffer.from((res.data as { content: string }).content, "base64").toString("utf8")
              : "";
        return { data, headers: res.headers as Record<string, string> };
      });
    } catch (err) {
      if (err instanceof BudgetExceeded) throw err;
      log.debug(`no README for ${owner}/${repo}`);
      return "";
    }
  }

  return {
    name: "github",

    async discoverTrending(limit: number): Promise<Discovered[]> {
      const queries = buildQueries(now());
      const seen = new Set<string>();
      const out: Discovered[] = [];

      for (const q of queries) {
        if (out.length >= limit) break;
        let items: Array<Parameters<typeof repoToSource>[0]>;
        try {
          items = await conditional(`search:${q}`, async (headers) => {
            const res = await octokit.rest.search.repos({
              q,
              sort: "stars",
              order: "desc",
              per_page: 15,
              headers,
            });
            return {
              data: res.data.items as Array<Parameters<typeof repoToSource>[0]>,
              headers: res.headers as Record<string, string>,
            };
          });
        } catch (err) {
          if (err instanceof BudgetExceeded) break;
          log.warn(`github search failed (${q}): ${String(err)}`);
          continue;
        }

        for (const item of items) {
          if (out.length >= limit) break;
          if (!item.full_name || seen.has(item.full_name)) continue;
          seen.add(item.full_name);
          if (quality) {
            const decision = evaluateQualityGate(
              {
                stars: item.stargazers_count ?? 0,
                archived: item.archived ?? false,
                fork: item.fork ?? false,
                createdAt: item.created_at ?? undefined,
              },
              quality,
              now(),
            );
            if (!decision.pass) {
              log.debug(`gate drop ${item.full_name}: ${decision.reason}`);
              continue;
            }
          }
          // AI/LLM scope: drop non-AI repos a loose topic surfaced, before they
          // cost a README fetch or an evaluation (ticket 0043).
          if (
            !isAiRelevant({
              name: item.full_name,
              description: item.description,
              topics: item.topics,
            })
          ) {
            log.debug(`ai-scope drop ${item.full_name}`);
            continue;
          }
          const owner = item.owner?.login ?? item.full_name.split("/")[0]!;
          try {
            const readme = await fetchReadme(owner, item.name);
            out.push({ source: repoToSource(item), readme });
          } catch (err) {
            if (err instanceof BudgetExceeded) {
              log.info("github budget reached during discovery");
              return out.slice(0, limit);
            }
            log.warn(`skip ${item.full_name}: ${String(err)}`);
          }
        }
      }
      log.info(`github discovered ${out.length} (${calls} api calls)`);
      return out.slice(0, limit);
    },

    async resolveUrl(url: string): Promise<Discovered | null> {
      const m = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
      if (!m) return null;
      const owner = m[1]!;
      const repo = m[2]!.replace(/\.git$/, "");
      try {
        const res = await guarded(() => octokit.rest.repos.get({ owner, repo }));
        const readme = await fetchReadme(owner, repo);
        return { source: repoToSource(res.data as Parameters<typeof repoToSource>[0]), readme };
      } catch (err) {
        log.warn(`github resolve failed for ${owner}/${repo}: ${String(err)}`);
        return null;
      }
    },
  };
}
