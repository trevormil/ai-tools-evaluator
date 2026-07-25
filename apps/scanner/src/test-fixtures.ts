import { METRIC_KEYS, type EvaluationDraft, type ItemSource } from "@aix/core";
import type { Discovered } from "./types";

/** A complete, valid EvaluationDraft (all ten metrics) for tests. */
export function makeDraft(overrides: Partial<EvaluationDraft> = {}): EvaluationDraft {
  const scores = Object.fromEntries(
    METRIC_KEYS.map((k, i) => [k, { score: 30 + i * 6, rationale: `rationale for ${k} metric` }]),
  ) as EvaluationDraft["scores"];

  return {
    category: "mcp-server",
    integration: "mcp",
    tags: ["mcp", "typescript"],
    verdict: "marginal",
    noiseScore: 55,
    audience: {
      primary: "ai-engineer",
      aiEngineerFit: 62,
      vibeCoderFit: 30,
      rationale: "Useful leverage for a technical engineer; little for a non-technical vibe coder.",
    },
    scores,
    productShape: {
      score: 45,
      rationale: "A server you run for other software, not something a person opens and uses.",
    },
    tagline: "A tidy wrapper, but the base agent already handles most of this itself.",
    body: {
      whatItIs:
        "It exposes a small set of tools over MCP so an agent can call them through a server process instead of native tooling.",
      vsVanilla:
        "A vanilla capable agent already does the underlying operations natively; this adds a network hop and a config surface without new capability.",
      surfaceArea:
        "It is an MCP server you register and secure — additive infrastructure rather than a slash-command skill.",
      devilsAdvocate:
        "The base agent reproduces this unaided with better ergonomics and nothing extra to run. The only genuine delta is remote/sandboxed access most users never need, so for the common case it is complexity for its own sake.",
      whatWouldMakeItBetter:
        "Ship a genuinely remote/sandboxed capability the base agent can't do locally, and drop the config surface to a single command — otherwise it stays a wrapper.",
    },
    ...overrides,
  };
}

export function makeGithubSource(overrides: Partial<ItemSource> = {}): ItemSource {
  return {
    kind: "github_repo",
    externalId: "acme/some-tool",
    url: "https://github.com/acme/some-tool",
    title: "some-tool",
    author: "acme",
    description: "A tool.",
    stars: 1200,
    language: "TypeScript",
    ...overrides,
  };
}

export function makeDiscovered(overrides: Partial<Discovered> = {}): Discovered {
  return {
    source: makeGithubSource(),
    readme: "# some-tool\n\nDoes a thing.\n\n![demo](https://example.com/demo.gif)",
    ...overrides,
  };
}
