import { describe, expect, test } from "bun:test";
import type { Octokit } from "@octokit/rest";
import { buildQueries, rotationSeed, createGitHubSource } from "./github";
import { nullLogger } from "../logger";

const now = new Date("2026-07-06T00:00:00.000Z");

describe("buildQueries facet rotation", () => {
  const topicsOf = (queries: string[]) =>
    queries.map((q) => q.match(/topic:(\S+)/)?.[1]).filter((t): t is string => Boolean(t));

  test("consecutive seeds explore different, non-overlapping topic slices", () => {
    const a = topicsOf(buildQueries(now, 0));
    const b = topicsOf(buildQueries(now, 1));
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    // The window walks by exactly the number of topic facets (3) — no overlap.
    expect(new Set([...a, ...b]).size).toBe(6);
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
  const rows: RepoRow[] = [
    {
      full_name: "good/high",
      name: "high",
      html_url: "https://github.com/good/high",
      owner: { login: "good" },
      stargazers_count: 500,
    },
    {
      full_name: "good/rising",
      name: "rising",
      html_url: "https://github.com/good/rising",
      owner: { login: "good" },
      stargazers_count: 30,
      created_at: new Date(now.getTime() - 2 * 86_400_000).toISOString(),
    },
    {
      full_name: "bad/low",
      name: "low",
      html_url: "https://github.com/bad/low",
      owner: { login: "bad" },
      stargazers_count: 5,
      created_at: new Date(now.getTime() - 400 * 86_400_000).toISOString(),
    },
    {
      full_name: "bad/archived",
      name: "arch",
      html_url: "https://github.com/bad/archived",
      owner: { login: "bad" },
      stargazers_count: 800,
      archived: true,
    },
    {
      full_name: "bad/fork",
      name: "fork",
      html_url: "https://github.com/bad/fork",
      owner: { login: "bad" },
      stargazers_count: 800,
      fork: true,
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

  test("with no thresholds the gate is disabled (all repos pass)", async () => {
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
});
