import { describe, expect, test } from "bun:test";
import { Evaluation, computeOverall } from "@aix/core";
import { evaluateItem, type ModelClient } from "./evaluate";
import { buildMedia } from "./media";
import { makeDraft, makeDiscovered } from "./test-fixtures";

/** A model that returns fixed strings in sequence (one per attempt). */
function scriptedModel(responses: string[]): ModelClient & { calls: number } {
  let i = 0;
  return {
    calls: 0,
    async complete() {
      this.calls++;
      return responses[Math.min(i++, responses.length - 1)]!;
    },
  };
}

describe("evaluateItem", () => {
  test("valid model JSON produces a schema-valid Evaluation with recomputed overallScore", async () => {
    const draft = makeDraft();
    const model = scriptedModel([JSON.stringify(draft)]);
    const now = () => new Date("2026-07-06T00:00:00.000Z");

    const evaluation = await evaluateItem(makeDiscovered(), {
      model,
      modelName: "claude-opus-4-8",
      deriveMedia: buildMedia,
      now,
    });

    // Strictly valid against the shared schema.
    expect(() => Evaluation.parse(evaluation)).not.toThrow();
    // overallScore is recomputed, not trusted from the model.
    expect(evaluation.overallScore).toBe(computeOverall(draft.scores));
    // Provenance + assembled fields.
    expect(evaluation.evaluatedBy).toBe("ai");
    expect(evaluation.model).toBe("claude-opus-4-8");
    expect(evaluation.evaluatedAt).toBe("2026-07-06T00:00:00.000Z");
    expect(evaluation.slug).toBe("acme-some-tool");
    expect(evaluation.source.externalId).toBe("acme/some-tool");
    // Media cover cascades to the README image (demo.gif), card second.
    expect(evaluation.media[0]?.source).toBe("repo-readme");
    expect(evaluation.media[0]?.url).toContain("demo.gif");
    expect(evaluation.media.some((m) => m.source === "repo-social-preview")).toBe(true);
    expect(model.calls).toBe(1);
  });

  test("tolerates code fences and surrounding prose", async () => {
    const draft = makeDraft();
    const wrapped = "Here you go:\n```json\n" + JSON.stringify(draft) + "\n```\nHope that helps.";
    const model = scriptedModel([wrapped]);
    const evaluation = await evaluateItem(makeDiscovered(), { model, modelName: "m" });
    expect(() => Evaluation.parse(evaluation)).not.toThrow();
  });

  test("retries with a repair instruction after invalid output, then succeeds", async () => {
    const good = JSON.stringify(makeDraft());
    const model = scriptedModel(["not json at all", good]);
    const evaluation = await evaluateItem(makeDiscovered(), { model, modelName: "m" });
    expect(() => Evaluation.parse(evaluation)).not.toThrow();
    expect(model.calls).toBe(2);
  });

  test("rejects invalid output that never repairs (never returns unvalidated)", async () => {
    const badDraft = { ...makeDraft(), verdict: "totally-made-up" };
    const model = scriptedModel([JSON.stringify(badDraft)]);
    await expect(
      evaluateItem(makeDiscovered(), { model, modelName: "m", maxRetries: 1 }),
    ).rejects.toThrow(/after 2 attempts/);
    expect(model.calls).toBe(2);
  });
});
