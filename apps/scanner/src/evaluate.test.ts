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
    // The evaluator's coverImageUrl pick (a README image) drives the cover.
    const draft = makeDraft({ coverImageUrl: "https://example.com/demo.gif" });
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
    // Optional evaluator-owned blocks survive assembly (0088 dropped them all;
    // productShape is the 0078 daily-pick signal).
    expect(evaluation.productShape?.score).toBe(draft.productShape.score);
    // Provenance + assembled fields.
    expect(evaluation.evaluatedBy).toBe("ai");
    expect(evaluation.model).toBe("claude-opus-4-8");
    expect(evaluation.evaluatedAt).toBe("2026-07-06T00:00:00.000Z");
    expect(evaluation.slug).toBe("acme-some-tool");
    expect(evaluation.source.externalId).toBe("acme/some-tool");
    // The picked README image (demo.gif) is the cover; social card present too.
    expect(evaluation.media[0]?.source).toBe("repo-readme");
    expect(evaluation.media[0]?.url).toContain("demo.gif");
    expect(evaluation.media.some((m) => m.source === "repo-social-preview")).toBe(true);
    expect(model.calls).toBe(1);
  });

  test("without a cover pick, the cover defaults to the square owner avatar", async () => {
    const model = scriptedModel([JSON.stringify(makeDraft())]); // no coverImageUrl
    const evaluation = await evaluateItem(makeDiscovered(), {
      model,
      modelName: "m",
      deriveMedia: buildMedia,
    });
    expect(evaluation.media[0]?.source).toBe("repo-avatar");
    expect(evaluation.media[0]?.url).toBe("https://github.com/acme.png?size=200");
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

  test("a deepDive from a failed attempt is grafted into a repair that dropped it (0088)", async () => {
    // Prod shape (kaas, qwen): attempt 1 carries a full deepDive but fails
    // validation on an unrelated field; the model's repaired output is valid
    // but regenerated WITHOUT the optional block. Preservation must be
    // deterministic, not prompt-obedience.
    const deepDive = {
      howItWorks:
        "The service accepts webhook events, verifies signatures, and fans work out to per-tenant queues. " +
        "Workers process each job with idempotency keys so retries never double-apply, and results stream " +
        "back over server-sent events to the dashboard.",
      architecture: {
        components: [
          { id: "ingest", label: "Webhook ingest", role: "verifies + enqueues events" },
          { id: "workers", label: "Worker pool", role: "idempotent per-tenant processing" },
        ],
        flows: [{ from: "ingest", to: "workers", label: "jobs" }],
      },
      internals: [{ title: "Idempotency keys", detail: "Retries can never double-apply a job." }],
    };
    const withDeepDiveButBadVerdict = { ...makeDraft(), deepDive, verdict: "not-a-verdict" };
    const repairedWithoutDeepDive = makeDraft(); // valid, but the block is gone
    const model = scriptedModel([
      JSON.stringify(withDeepDiveButBadVerdict),
      JSON.stringify(repairedWithoutDeepDive),
    ]);

    const evaluation = await evaluateItem(makeDiscovered(), { model, modelName: "m" });
    expect(model.calls).toBe(2);
    expect(() => Evaluation.parse(evaluation)).not.toThrow();
    expect(evaluation.deepDive?.howItWorks).toContain("idempotency keys");
    expect(evaluation.deepDive?.architecture?.components).toHaveLength(2);
  });

  test("a repair that KEEPS its own deepDive is not overwritten by the graft (0088)", async () => {
    const earlier = {
      howItWorks: "e".repeat(250),
      architecture: {
        components: [
          { id: "a", label: "Old A", role: "the earlier attempt's component" },
          { id: "b", label: "Old B", role: "the earlier attempt's component" },
        ],
        flows: [{ from: "a", to: "b" }],
      },
    };
    const final = {
      howItWorks: "f".repeat(250),
    };
    const model = scriptedModel([
      JSON.stringify({ ...makeDraft(), deepDive: earlier, verdict: "nope" }),
      JSON.stringify({ ...makeDraft(), deepDive: final }),
    ]);
    const evaluation = await evaluateItem(makeDiscovered(), { model, modelName: "m" });
    expect(evaluation.deepDive?.howItWorks).toBe("f".repeat(250));
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
