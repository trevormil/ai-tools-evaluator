import { describe, expect, test } from "bun:test";
import type { Octokit } from "@octokit/rest";
import { buildQueries, rotationSeed, createGitHubSource, isAiRelevant } from "./github";
import { nullLogger } from "../logger";

const now = new Date("2026-07-06T00:00:00.000Z");

describe("buildQueries facet rotation", () => {
  const topicsOf = (queries: string[]) =>
    queries.map((q) => q.match(/topic:(\S+)/)?.[1]).filter((t): t is string => Boolean(t));

  test("consecutive seeds explore different, non-overlapping topic slices", () => {
    const a = topicsOf(buildQueries(now, 0));
    const b = topicsOf(buildQueries(now, 1));
    // Every facet is now AI-topic-scoped (ticket 0043) — 4 topics per run.
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    // The window walks by exactly the number of topic facets (4) — no overlap.
    expect(new Set([...a, ...b]).size).toBe(8);
  });

  test("is deterministic for a given seed", () => {
    expect(buildQueries(now, 4)).toEqual(buildQueries(now, 4));
  });

  test("rotationSeed advances once per calendar day", () => {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    expect(rotationSeed(tomorrow)).toBe(rotationSeed(now) + 1);
  });

  test("defaults the seed from now so runs vary day to day", () => {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    expect(topicsOf(buildQueries(now))).not.toEqual(topicsOf(buildQueries(tomorrow)));
  });
});

/** A repo row as GitHub search returns it (only the fields discovery reads). */
type RepoRow = {
  full_name: string;
  name: string;
  html_url: string;
  owner: { login: string };
  stargazers_count: number;
  archived?: boolean;
  fork?: boolean;
  created_at?: string;
  description?: string | null;
  topics?: string[];
};

function fakeOctokit(rows: RepoRow[]): { octokit: Octokit; readmeCalls: string[] } {
  const readmeCalls: string[] = [];
  const octokit = {
    rest: {
      search: {
        async repos() {
          return { data: { items: rows }, headers: {} };
        },
      },
      repos: {
        async getReadme({ owner, repo }: { owner: string; repo: string }) {
          readmeCalls.push(`${owner}/${repo}`);
          return { data: "# readme", headers: {} };
        },
      },
    },
  } as unknown as Octokit;
  return { octokit, readmeCalls };
}

describe("createGitHubSource discovery quality gate", () => {
  // All AI-relevant (topic:llm) so these cases isolate the STARS gate; the
  // separate test below covers the AI-scope filter.
  const rows: RepoRow[] = [
    {
      full_name: "good/high",
      name: "high",
      html_url: "https://github.com/good/high",
      owner: { login: "good" },
      stargazers_count: 500,
      topics: ["llm"],
    },
    {
      full_name: "good/rising",
      name: "rising",
      html_url: "https://github.com/good/rising",
      owner: { login: "good" },
      stargazers_count: 30,
      created_at: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
      topics: ["ai-agents"],
    },
    {
      full_name: "bad/low",
      name: "low",
      html_url: "https://github.com/bad/low",
      owner: { login: "bad" },
      stargazers_count: 5,
      created_at: new Date(now.getTime() - 400 * 86_400_000).toISOString(),
      topics: ["llm"],
    },
    {
      full_name: "bad/archived",
      name: "arch",
      html_url: "https://github.com/bad/archived",
      owner: { login: "bad" },
      stargazers_count: 800,
      archived: true,
      topics: ["llm"],
    },
    {
      full_name: "bad/fork",
      name: "fork",
      html_url: "https://github.com/bad/fork",
      owner: { login: "bad" },
      stargazers_count: 800,
      fork: true,
      topics: ["llm"],
    },
  ];

  test("only surfaces repos that clear the gate, and never fetches READMEs for the rest", async () => {
    const { octokit, readmeCalls } = fakeOctokit(rows);
    const source = createGitHubSource({
      token: "t",
      octokit,
      log: nullLogger,
      now: () => now,
      quality: { minStars: 50, minStarVelocity: 5 },
    });

    const discovered = await source.discoverTrending!(10);
    const ids = discovered.map((d) => d.source.externalId).sort();
    expect(ids).toEqual(["good/high", "good/rising"]);
    // Dropped repos must not cost a README fetch (eval-spend saving is the point).
    expect(readmeCalls).not.toContain("bad/low");
    expect(readmeCalls).not.toContain("bad/archived");
    expect(readmeCalls).not.toContain("bad/fork");
  });

  test("with no thresholds the gate is disabled (all AI repos pass)", async () => {
    const { octokit } = fakeOctokit(rows);
    const source = createGitHubSource({ token: "t", octokit, log: nullLogger, now: () => now });
    const discovered = await source.discoverTrending!(10);
    expect(discovered.map((d) => d.source.externalId).sort()).toEqual([
      "bad/archived",
      "bad/fork",
      "bad/low",
      "good/high",
      "good/rising",
    ]);
  });

  test("a non-AI repo is dropped by the AI-scope filter — and never costs a README fetch", async () => {
    const mixed: RepoRow[] = [
      {
        full_name: "ai/agent-kit",
        name: "agent-kit",
        html_url: "https://github.com/ai/agent-kit",
        owner: { login: "ai" },
        stargazers_count: 400,
        description: "An LLM agent framework",
      },
      {
        full_name: "games/knockoff",
        name: "knockoff",
        html_url: "https://github.com/games/knockoff",
        owner: { login: "games" },
        stargazers_count: 900,
        description: "A tabletop card game clone in Rails",
        topics: ["rails", "game"],
      },
    ];
    const { octokit, readmeCalls } = fakeOctokit(mixed);
    const source = createGitHubSource({ token: "t", octokit, log: nullLogger, now: () => now });
    const discovered = await source.discoverTrending!(10);
    expect(discovered.map((d) => d.source.externalId)).toEqual(["ai/agent-kit"]);
    expect(readmeCalls).not.toContain("games/knockoff"); // dropped before the fetch
  });
});

describe("isAiRelevant", () => {
  test("keeps AI/LLM repos via name, description, or topics", () => {
    expect(isAiRelevant({ name: "x/langchain-tools" })).toBe(true);
    expect(isAiRelevant({ description: "A retrieval-augmented chatbot" })).toBe(true);
    expect(isAiRelevant({ topics: ["mcp", "typescript"] })).toBe(true);
    expect(isAiRelevant({ description: "Claude-powered code assistant" })).toBe(true);
  });

  test("drops repos with no AI signal", () => {
    expect(isAiRelevant({ name: "games/knockoff", description: "A card game clone" })).toBe(false);
    expect(isAiRelevant({ name: "acme/csv-parser", topics: ["rust", "parsing"] })).toBe(false);
    expect(isAiRelevant({})).toBe(false);
  });
});
