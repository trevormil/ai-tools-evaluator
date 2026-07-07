import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  EVALUATOR_SYSTEM,
  buildEvaluatorPrompt,
  EvaluationDraft,
  Evaluation,
  computeOverall,
  type ItemSource,
  type MediaAsset,
} from "@aix/core";
import { slugify } from "./slug";
import type { Discovered } from "./types";

/**
 * The model, abstracted to a single call so tests can inject a fake without a
 * network round-trip. `complete` returns the raw assistant text.
 */
export type ModelClient = {
  complete(system: string, user: string): Promise<string>;
};

/** Real Anthropic-backed model client (model id + key come from env). */
export function createAnthropicModel(opts: {
  apiKey: string;
  model: string;
  maxTokens?: number;
}): ModelClient {
  const client = new Anthropic({ apiKey: opts.apiKey });
  return {
    async complete(system, user) {
      const msg = await client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        system,
        messages: [{ role: "user", content: user }],
      });
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    },
  };
}

export type EvaluateOptions = {
  model: ModelClient;
  /** Recorded as `Evaluation.model` (provenance). */
  modelName: string;
  /** Optional media derivation; if omitted, `media` is empty. */
  deriveMedia?: (source: ItemSource, readme: string) => MediaAsset[];
  /** Injectable clock for deterministic `evaluatedAt` in tests. */
  now?: () => Date;
  /** Max repair retries after the first attempt (default 2 → 3 attempts total). */
  maxRetries?: number;
};

/**
 * Best-effort JSON extraction: tolerate stray prose or code fences around the
 * object the model was asked to return raw.
 */
function extractJson(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

/**
 * Evaluate one item into a full, schema-valid `Evaluation`. The model output is
 * validated against `EvaluationDraft`; on any parse/validation failure we retry
 * with a repair instruction (up to `maxRetries`). We NEVER return unvalidated
 * output — `overallScore` is recomputed deterministically and the assembled
 * object is re-parsed against the strict `Evaluation` schema before returning.
 */
export async function evaluateItem(d: Discovered, opts: EvaluateOptions): Promise<Evaluation> {
  const basePrompt = buildEvaluatorPrompt(d.source, d.readme);
  const maxRetries = opts.maxRetries ?? 2;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const user =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n## Repair\nYour previous response was rejected: ${lastError}\nReturn ONLY corrected raw JSON that matches the schema — no code fences, no commentary.`;

    const raw = await opts.model.complete(EVALUATOR_SYSTEM, user);

    let draft: z.infer<typeof EvaluationDraft>;
    try {
      draft = EvaluationDraft.parse(extractJson(raw));
    } catch (err) {
      lastError =
        err instanceof z.ZodError
          ? JSON.stringify(err.issues.slice(0, 8))
          : err instanceof Error
            ? err.message
            : String(err);
      continue;
    }

    return assembleEvaluation(d, draft, opts);
  }

  throw new Error(
    `evaluator failed for ${d.source.externalId} after ${maxRetries + 1} attempts: ${lastError}`,
  );
}

function assembleEvaluation(
  d: Discovered,
  draft: z.infer<typeof EvaluationDraft>,
  opts: EvaluateOptions,
): Evaluation {
  const evaluation = {
    schemaVersion: 1 as const,
    slug: slugify(d.source.externalId),
    source: d.source,
    category: draft.category,
    integration: draft.integration,
    tags: draft.tags,
    verdict: draft.verdict,
    noiseScore: draft.noiseScore,
    audience: draft.audience,
    scores: draft.scores,
    overallScore: computeOverall(draft.scores),
    tagline: draft.tagline,
    body: draft.body,
    media: opts.deriveMedia ? opts.deriveMedia(d.source, d.readme) : [],
    evaluatedBy: "ai" as const,
    model: opts.modelName,
    evaluatedAt: (opts.now?.() ?? new Date()).toISOString(),
  };
  // Final strict gate: never hand back anything that isn't a valid Evaluation.
  return Evaluation.parse(evaluation);
}
