import { expect, test, describe } from "bun:test";
import { sanitizeEvaluationDraft } from "./sanitize";
import { EvaluationDraft, METRIC_KEYS } from "./index";

type Draft = Record<string, unknown>;

/** A schema-valid draft; individual tests corrupt one field the way a cheap model does. */
function validDraft(over: Draft = {}): Draft {
  const scores = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, { score: 70, rationale: `a solid rationale for ${k} here` }]),
  );
  const para = "A long-enough plainspoken paragraph that satisfies the strict schema bounds. ";
  return {
    category: "cli-tool",
    integration: "standalone-app",
    tags: ["cli", "typescript"],
    verdict: "worthwhile",
    noiseScore: 20,
    audience: {
      primary: "ai-engineer",
      aiEngineerFit: 80,
      vibeCoderFit: 30,
      rationale: "Built for terminal-first engineers who want leverage.",
    },
    scores,
    productShape: { score: 80, rationale: "A CLI you run yourself, not a library you import." },
    tagline: "A terse, honest hook that fits.",
    body: {
      whatItIs: para,
      vsVanilla: para,
      surfaceArea: para,
      devilsAdvocate: para + para,
      whatWouldMakeItBetter: para,
    },
    ...over,
  };
}

describe("sanitizeEvaluationDraft", () => {
  test("the colibri failure mode: a junk tag no longer hard-fails validation", () => {
    // deepseek emitted a 3rd tag that was too short (< 2 chars) → schema reject.
    const dirty = validDraft({ tags: ["rag", "retrieval", "x"] });
    expect(EvaluationDraft.safeParse(dirty).success).toBe(false); // before: fails
    const clean = sanitizeEvaluationDraft(dirty);
    expect(EvaluationDraft.safeParse(clean).success).toBe(true); // after: passes
    expect((clean as Draft).tags).toEqual(["rag", "retrieval"]); // junk dropped
  });

  test("tags are slugified, de-duped, and capped at 12", () => {
    const clean = sanitizeEvaluationDraft(
      validDraft({ tags: ["AI Agent", "ai-agent", "", "!!", ...Array(15).fill("x-tag")] }),
    ) as Draft;
    const tags = clean.tags as string[];
    expect(tags[0]).toBe("ai-agent");
    expect(tags.filter((t) => t === "ai-agent")).toHaveLength(1); // deduped
    expect(tags).not.toContain(""); // empties dropped
    expect(tags.length).toBeLessThanOrEqual(12);
  });

  test("an over-length tagline is clamped to 160 (was the smoke-test failure)", () => {
    const long = "word ".repeat(60); // ~300 chars
    const clean = sanitizeEvaluationDraft(validDraft({ tagline: long })) as Draft;
    expect((clean.tagline as string).length).toBeLessThanOrEqual(160);
    expect(EvaluationDraft.safeParse(clean).success).toBe(true);
  });

  test("decision.insteadOf clamps to 120 and bullets to 4×140", () => {
    const clean = sanitizeEvaluationDraft(
      validDraft({
        decision: {
          adoptIf: ["a".repeat(200), "b", "c", "d", "e"],
          skipIf: ["x"],
          insteadOf: "z".repeat(300),
        },
      }),
    ) as Draft;
    const dec = clean.decision as { adoptIf: string[]; insteadOf: string };
    expect(dec.insteadOf.length).toBeLessThanOrEqual(120);
    expect(dec.adoptIf.length).toBeLessThanOrEqual(4);
    expect(dec.adoptIf[0]!.length).toBeLessThanOrEqual(140);
  });

  test("leaves already-valid drafts untouched and non-objects alone", () => {
    const ok = validDraft();
    expect(EvaluationDraft.safeParse(sanitizeEvaluationDraft(ok)).success).toBe(true);
    expect(sanitizeEvaluationDraft(null)).toBeNull();
    expect(sanitizeEvaluationDraft("nope")).toBe("nope");
  });
});
