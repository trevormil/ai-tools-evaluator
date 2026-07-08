import { describe, expect, test } from "bun:test";
import { trendingScore, applicationAffinity, rankCandidates } from "./rank";
import type { Discovered } from "./types";
import { makeGithubSource } from "./test-fixtures";

const NOW = new Date("2026-07-07T00:00:00.000Z");

function repo(
  ext: string,
  stars: number,
  createdDaysAgo: number,
  text: { title?: string; description?: string; readme?: string } = {},
): Discovered {
  const createdAt = new Date(NOW.getTime() - createdDaysAgo * 86_400_000).toISOString();
  return {
    source: makeGithubSource({
      externalId: ext,
      url: `https://github.com/${ext}`,
      title: text.title ?? ext.split("/")[1],
      description: text.description ?? "A tool.",
      stars,
      createdAt,
    }),
    readme: text.readme ?? "readme",
  };
}

function paper(ext: string): Discovered {
  return {
    source: {
      kind: "arxiv_paper",
      externalId: ext,
      url: `https://arxiv.org/abs/${ext}`,
      title: "A Paper",
      publishedAt: NOW.toISOString(),
    },
    readme: "abstract",
  };
}

describe("trendingScore", () => {
  test("heavily weights star velocity — same stars, younger repo scores higher", () => {
    const young = trendingScore(repo("a/young", 1000, 10).source, NOW); // 100 stars/day
    const old = trendingScore(repo("a/old", 1000, 1000).source, NOW); // 1 star/day
    expect(young).toBeGreaterThan(old);
  });

  test("a fast-rising repo outranks a bigger but stale one", () => {
    const rising = trendingScore(repo("a/rising", 3000, 15).source, NOW); // 200/day
    const stale = trendingScore(repo("a/stale", 40000, 3650).source, NOW); // ~11/day
    expect(rising).toBeGreaterThan(stale);
  });

  test("papers (no stars) score below any real GitHub repo", () => {
    const repoScore = trendingScore(repo("a/small", 60, 60).source, NOW); // 1/day
    const paperScore = trendingScore(paper("2607.05393").source, NOW);
    expect(paperScore).toBeLessThan(repoScore);
  });
});

describe("applicationAffinity", () => {
  const appDev = repo("a/agent-cli", 100, 10, {
    description: "A coding agent CLI that drives Claude Code and Codex to build apps.",
    readme: "An MCP server + agent framework for using Claude and Codex to ship features.",
  });
  const modelInternals = repo("a/trainer", 100, 10, {
    description: "Fine-tuning and quantization for LLMs.",
    readme: "Pretraining pipeline with CUDA kernels, LoRA, vLLM inference and GGUF export.",
  });
  const neutral = repo("a/plain", 100, 10);

  test("boosts application-dev / coding-agent repos above 1", () => {
    expect(applicationAffinity(appDev)).toBeGreaterThan(1);
  });

  test("dampens model-internals repos below 1", () => {
    expect(applicationAffinity(modelInternals)).toBeLessThan(1);
  });

  test("leaves a neutral repo at 1", () => {
    expect(applicationAffinity(neutral)).toBe(1);
  });

  test("a coding-agent repo outranks a model-internals repo of equal velocity", () => {
    const ranked = rankCandidates([modelInternals, appDev], NOW);
    expect(ranked[0]!.source.externalId).toBe("a/agent-cli");
  });

  test("weighting can lift an app-dev repo over a modestly faster model-internals repo", () => {
    // model-internals rises a bit faster on raw velocity, but the affinity weight
    // still floats the coding-agent repo to the top (a preference, not a hard filter).
    const app = repo("a/coding-agent", 1000, 20, {
      description: "Use Claude and Codex as autonomous coding agents.",
      readme: "agentic coding assistant, MCP tools, slash commands.",
    });
    const model = repo("a/kernels", 1300, 20, {
      description: "Fast LLM inference engine.",
      readme: "quantization, cuda kernels, flash attention, vllm.",
    });
    const ranked = rankCandidates([model, app], NOW);
    expect(ranked[0]!.source.externalId).toBe("a/coding-agent");
  });
});

describe("rankCandidates", () => {
  test("sorts by trending score descending", () => {
    const ranked = rankCandidates(
      [
        repo("a/slow", 500, 500),
        repo("a/fast", 5000, 10),
        paper("2607.1"),
        repo("a/mid", 2000, 40),
      ],
      NOW,
    );
    expect(ranked.map((d) => d.source.externalId)).toEqual(["a/fast", "a/mid", "a/slow", "2607.1"]);
  });

  test("does not mutate the input array", () => {
    const input = [repo("a/1", 10, 10), repo("a/2", 9999, 5)];
    const before = input.map((d) => d.source.externalId);
    rankCandidates(input, NOW);
    expect(input.map((d) => d.source.externalId)).toEqual(before);
  });
});
