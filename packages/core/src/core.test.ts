import { expect, test, describe } from "bun:test";
import {
  Evaluation,
  EvaluationDraft,
  METRICS,
  METRIC_KEYS,
  computeOverall,
  toMarkdown,
  parseArtifact,
  scoreBand,
} from "./index";

const scores = Object.fromEntries(
  METRIC_KEYS.map((k, i) => [k, { score: 40 + i * 5, rationale: `rationale for ${k}` }]),
) as Evaluation["scores"];

const sample: Evaluation = {
  schemaVersion: 1,
  slug: "some-mcp-server",
  source: {
    kind: "github_repo",
    externalId: "acme/some-mcp-server",
    url: "https://github.com/acme/some-mcp-server",
    title: "Some MCP Server",
    stars: 1200,
    language: "TypeScript",
  },
  category: "mcp-server",
  integration: "mcp",
  tags: ["mcp", "typescript"],
  verdict: "marginal",
  noiseScore: 62,
  audience: {
    primary: "ai-engineer",
    aiEngineerFit: 55,
    vibeCoderFit: 20,
    rationale:
      "Only an engineer running sandboxed/remote setups gets value; a vibe coder gains nothing over native file tools.",
  },
  scores,
  productShape: {
    score: 40,
    rationale: "A server other software talks to, not an app a person opens.",
  },
  overallScore: computeOverall(scores),
  tagline: "A tidy MCP wrapper, but Claude already reads files fine on its own.",
  body: {
    whatItIs:
      "It exposes a filesystem over MCP so an agent can read and write files through a server process instead of native tools.",
    vsVanilla:
      "Vanilla Claude Code already has first-class file read/write tools; this routes the same operations through an extra network hop and config surface.",
    surfaceArea:
      "It is an MCP server: you register it, it advertises tools. Additive, but it is real infrastructure you now run and secure.",
    devilsAdvocate:
      "The base agent reads and writes files natively with better ergonomics and no server to run. The only genuine delta is remote/sandboxed access, which most users do not need. For the common case this is complexity for complexity's sake.",
    whatWouldMakeItBetter:
      "Add capabilities native file tools lack — sandboxed remote hosts, audit logging, fine-grained ACLs — so it earns the extra process instead of duplicating what Claude already does.",
  },
  media: [],
  evaluatedBy: "ai",
  model: "claude-opus-4-8",
  evaluatedAt: "2026-07-06T00:00:00.000Z",
};

describe("scorecard", () => {
  test("weights sum to 1", () => {
    const total = METRICS.reduce((a, m) => a + m.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });

  test("computeOverall is a weighted mean in range", () => {
    const overall = computeOverall(scores);
    expect(overall).toBeGreaterThanOrEqual(0);
    expect(overall).toBeLessThanOrEqual(100);
  });

  test("scoreBand thresholds", () => {
    expect(scoreBand(85)).toBe("strong");
    expect(scoreBand(65)).toBe("solid");
    expect(scoreBand(45)).toBe("mixed");
    expect(scoreBand(20)).toBe("weak");
  });
});

describe("schema", () => {
  test("sample validates", () => {
    expect(() => Evaluation.parse(sample)).not.toThrow();
  });

  test("rejects a tagline that ends mid-sentence (0076, the qdrant truncation)", () => {
    const bad = structuredClone(sample);
    bad.tagline =
      "A Rust-based engine with rich filtering, quantization, and distributed scaling that";
    expect(Evaluation.safeParse(bad).success).toBe(false);
  });

  test("accepts taglines ending in ., !, ? — with or without a closing quote/paren", () => {
    for (const t of [
      "The one search tool you reach for first.",
      "Is this just complexity in a trench coat?",
      "Skip the wrapper — the base agent already does this!",
      'They call it "essential" (it is not).',
    ]) {
      const ok = structuredClone(sample);
      ok.tagline = t;
      expect(Evaluation.safeParse(ok).success).toBe(true);
    }
  });

  test("rejects out-of-range metric score", () => {
    const bad = structuredClone(sample);
    (bad.scores.novelty as { score: number }).score = 130;
    expect(() => Evaluation.parse(bad)).toThrow();
  });

  test("decision layer blocks are optional and backward-compatible (ticket 0039)", () => {
    // Old artifacts (no quickstart/decision) still validate — `sample` has neither.
    expect(Evaluation.safeParse(sample).success).toBe(true);

    const withDecision = Evaluation.parse({
      ...sample,
      quickstart: {
        install: "npx -y @acme/some-mcp-server",
        requires: ["Node 18+", "MCP-capable client"],
      },
      decision: {
        adoptIf: ["You run agents in a sandbox without native file tools"],
        skipIf: ["Your agent already has first-class file access", "You want zero moving parts"],
        insteadOf: "native file tools",
      },
    });
    expect(withDecision.quickstart?.install).toContain("npx");
    expect(withDecision.decision?.adoptIf).toHaveLength(1);

    // Bounds are enforced: at most 4 bullets per side, install is one line.
    expect(
      Evaluation.safeParse({
        ...sample,
        decision: { adoptIf: ["a", "b", "c", "d", "e"], skipIf: ["x"] },
      }).success,
    ).toBe(false);
    expect(
      Evaluation.safeParse({
        ...sample,
        quickstart: { install: "line one\nline two" },
      }).success,
    ).toBe(false);
  });

  test("rejects non-kebab slug", () => {
    expect(() => Evaluation.parse({ ...sample, slug: "Not Kebab" })).toThrow();
  });

  test("EvaluationDraft omits recomputed + provenance fields", () => {
    const draft = {
      category: sample.category,
      integration: sample.integration,
      tags: sample.tags,
      verdict: sample.verdict,
      noiseScore: sample.noiseScore,
      audience: sample.audience,
      scores: sample.scores,
      productShape: sample.productShape,
      tagline: sample.tagline,
      body: sample.body,
    };
    expect(() => EvaluationDraft.parse(draft)).not.toThrow();
  });

  test("productShape is required of the evaluator but optional once stored", () => {
    // Ticket 0078: enforcing it on the draft means a model that stops emitting it
    // fails loudly per-item, rather than silently reverting the daily pick to the
    // old infra-favoring behavior. Stored Evaluations predate the field.
    const { productShape: _omitted, ...draftWithout } = {
      category: sample.category,
      integration: sample.integration,
      tags: sample.tags,
      verdict: sample.verdict,
      noiseScore: sample.noiseScore,
      audience: sample.audience,
      scores: sample.scores,
      productShape: sample.productShape,
      tagline: sample.tagline,
      body: sample.body,
    };
    expect(EvaluationDraft.safeParse(draftWithout).success).toBe(false);

    const { productShape: _dropped, ...storedWithout } = sample;
    expect(Evaluation.safeParse(storedWithout).success).toBe(true);
  });

  test("productShape never moves overallScore", () => {
    // It is a pick-only signal, deliberately not one of the ten metrics.
    const flipped = Evaluation.parse({
      ...sample,
      productShape: { score: 100, rationale: "A polished app you open and use every day." },
    });
    expect(flipped.overallScore).toBe(sample.overallScore);
    expect(computeOverall(flipped.scores)).toBe(computeOverall(sample.scores));
  });

  test("rejects out-of-range audience fit", () => {
    const bad = structuredClone(sample);
    bad.audience.aiEngineerFit = 150;
    expect(() => Evaluation.parse(bad)).toThrow();
  });
});

describe("markdown round-trip", () => {
  test("toMarkdown then parseArtifact recovers the object", () => {
    const md = toMarkdown(sample);
    expect(md).toContain("## Devil's advocate");
    expect(md).toContain("## What would make it better");
    expect(md).toContain(sample.body.whatWouldMakeItBetter);
    expect(md).toContain("| **Overall** |");
    const back = parseArtifact(md);
    expect(back).toEqual(sample);
  });

  test("agent-tool markdown is unchanged (vanilla-Claude heading preserved)", () => {
    const md = toMarkdown(sample);
    expect(md).toContain("## How it differs from vanilla Claude");
    expect(md).toContain("## Skill, plugin, or workflow shift?");
  });
});

/** A product-lens item: judged against incumbents, so its write-up carries
 *  `vsAlternatives` instead of the agent-only `vsVanilla`/`surfaceArea`. */
const productSample: Evaluation = {
  ...sample,
  slug: "some-product",
  source: {
    kind: "external_link",
    lens: "product",
    externalId: "https://acme.dev",
    url: "https://acme.dev",
    title: "Acme",
  },
  body: {
    whatItIs: sample.body.whatItIs,
    vsAlternatives:
      "Versus Linear and a spreadsheet, it adds AI triage — but the triage is a thin GPT call you could wire yourself in an afternoon.",
    devilsAdvocate: sample.body.devilsAdvocate,
    whatWouldMakeItBetter: sample.body.whatWouldMakeItBetter,
  },
};

describe("evaluation lenses", () => {
  test("an agent-tool item missing vsVanilla is now rejected", () => {
    const bad = structuredClone(sample) as Evaluation;
    delete (bad.body as { vsVanilla?: string }).vsVanilla;
    expect(Evaluation.safeParse(bad).success).toBe(false);
  });

  test("a product-lens item validates with vsAlternatives and no agent-only sections", () => {
    expect(Evaluation.safeParse(productSample).success).toBe(true);
  });

  test("a product-lens item missing vsAlternatives is rejected", () => {
    const bad = structuredClone(productSample) as Evaluation;
    delete (bad.body as { vsAlternatives?: string }).vsAlternatives;
    expect(Evaluation.safeParse(bad).success).toBe(false);
  });

  test("product-lens markdown uses the alternatives heading, never vanilla Claude", () => {
    const md = toMarkdown(productSample);
    expect(md).toContain("## How it compares to the alternatives");
    expect(md).not.toContain("vanilla Claude");
    expect(md).not.toContain("## Skill, plugin, or workflow shift?");
  });
});
