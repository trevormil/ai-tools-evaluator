import { METRICS } from "./metrics";
import { CATEGORIES, INTEGRATION_KINDS } from "./categories";
import type { ItemSource } from "./schema";

/**
 * The system prompt for the AI evaluator. Its whole job is to be the harsh,
 * skeptical reviewer the product promises — default to "this is probably
 * incremental" and make the tool earn a higher verdict.
 */
export const EVALUATOR_SYSTEM = `You are the resident skeptic for AIx, a catalog of trending GitHub repos, tools, and papers for AI-assisted developers.

Your reputation is for being HARSH and USEFUL. The dirty secret of this space is that most repos are thin optimizations over what a capable base agent (Claude) already does unaided — a prompt in a trench coat, a wrapper, or complexity for its own sake. Your default stance is skepticism; the item must EARN a positive verdict with concrete, specific capability it adds.

Rules:
- Be concrete and technical. No marketing language, no hedging, no "it depends".
- The devil's-advocate section is the point of the product. Argue, specifically, why a vanilla capable agent can already do this (or will soon), and whether the project is complexity for complexity's sake. If it genuinely can't be replicated, say exactly why.
- Only call something "essential" or score >85 if it delivers a capability a base agent plainly cannot reproduce.
- Score every one of the ten metrics 0–100 with a one-line rationale grounded in the specifics you were given. Higher is always better (including for "leanness" = fewer moving parts and "ease of adoption").
- Keep prose within the length limits; dense and skimmable beats verbose.`;

/** Build the user turn describing the item to evaluate. */
export function buildEvaluatorPrompt(source: ItemSource, readme: string): string {
  const signals: string[] = [
    `kind: ${source.kind}`,
    `title: ${source.title}`,
    `url: ${source.url}`,
    source.description ? `description: ${source.description}` : null,
    source.language ? `language: ${source.language}` : null,
    source.license ? `license: ${source.license}` : null,
    source.stars != null ? `stars: ${source.stars}` : null,
    source.starsGainedRecently != null ? `stars gained recently: ${source.starsGainedRecently}` : null,
    source.authors?.length ? `authors: ${source.authors.join(", ")}` : null,
    source.publishedAt ? `published: ${source.publishedAt}` : null,
  ].filter(Boolean) as string[];

  return `Evaluate this item and return ONLY a JSON object matching the EvaluationDraft schema.

## Signals
${signals.join("\n")}

## README / abstract (truncated)
${readme.slice(0, 12000)}

## Required output shape
- category: one of [${CATEGORIES.join(", ")}]
- integration: one of [${INTEGRATION_KINDS.join(", ")}]
- tags: up to 12 kebab-case tags
- verdict: one of essential | worthwhile | niche | marginal | redundant | complexity-trap
- noiseScore: 0 (pure signal) .. 100 (pure noise)
- audience: { primary: ai-engineer | vibe-coder | both | neither, aiEngineerFit: 0-100, vibeCoderFit: 0-100, rationale }
    AIx is for AI-first ENGINEERS who want to upskill and sharpen their workflow — not vibe coders who just want a flashier tool to do the work for them. Score aiEngineerFit on depth/leverage for a technical engineer; score vibeCoderFit on accessible does-it-for-you value. They are independent (a real workflow tool can rate high on both). Set primary honestly.
- tagline: one line, <=160 chars, states the verdict's reasoning
- scores: object with keys [${METRICS.map((m) => m.key).join(", ")}], each { score: 0-100, rationale: string }
- body: { whatItIs, vsVanilla, surfaceArea, devilsAdvocate, steelman? }

Return raw JSON only, no code fences, no commentary.`;
}
