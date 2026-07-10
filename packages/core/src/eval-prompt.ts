import { METRICS } from "./metrics";
import { CATEGORIES, INTEGRATION_KINDS } from "./categories";
import { LENS_DEFS, LENS_SECTIONS, lensFor, type Lens } from "./lenses";
import type { ItemSource } from "./schema";

/**
 * The evaluator's job is to be the harsh, skeptical reviewer the product
 * promises — default to "this is probably incremental" and make the item earn a
 * higher verdict. The frame (what it's judged against) comes from the item's
 * lens, so a skill is measured against a base agent, a product against its
 * incumbents, and a paper against prior work.
 */
export function evaluatorSystem(lens: Lens): string {
  const def = LENS_DEFS[lens];
  return `You are the resident skeptic for AIx, a catalog of trending AI tools, products, and research for AI-assisted developers.

Your reputation is for being HARSH and USEFUL. ${def.framing}

Rules:
- Be concrete and technical. No marketing language, no hedging, no "it depends".
- The devil's-advocate section is the point of the product. Argue, specifically, against the item measured against ${def.baseline}. If it genuinely can't be replaced, say exactly why.
- Only call something "essential" or score >85 if it delivers something ${def.baseline} plainly cannot.
- Score every one of the ten metrics 0–100 with a one-line rationale grounded in the specifics you were given. Higher is always better (including for "leanness" = fewer moving parts and "ease of adoption"). Judge "Δ vs. Baseline" against ${def.baseline}.
- Keep prose within the length limits; dense and skimmable beats verbose.`;
}

/**
 * The agent-tool system prompt. Retained for back-compat and as the default;
 * new call sites should use `evaluatorSystem(lensFor(source))`.
 */
export const EVALUATOR_SYSTEM = evaluatorSystem("agent-tool");

/** Build the user turn describing the item to evaluate, framed by its lens. */
export function buildEvaluatorPrompt(source: ItemSource, readme: string): string {
  const lens = lensFor(source);
  const def = LENS_DEFS[lens];
  const sections = LENS_SECTIONS[lens];

  const signals: string[] = [
    `kind: ${source.kind}`,
    `title: ${source.title}`,
    `url: ${source.url}`,
    source.description ? `description: ${source.description}` : null,
    source.language ? `language: ${source.language}` : null,
    source.license ? `license: ${source.license}` : null,
    source.stars != null ? `stars: ${source.stars}` : null,
    source.starsGainedRecently != null
      ? `stars gained recently: ${source.starsGainedRecently}`
      : null,
    source.authors?.length ? `authors: ${source.authors.join(", ")}` : null,
    source.publishedAt ? `published: ${source.publishedAt}` : null,
  ].filter(Boolean) as string[];

  const bodyKeys = sections.map((s) => s.key).join(", ");
  const bodyGuide = sections.map((s) => `    - ${s.prompt}`).join("\n");

  return `Evaluate this item and return ONLY a JSON object matching the EvaluationDraft schema.

You are judging it as a ${def.noun}, against ${def.baseline}.

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
- body: an object with exactly these keys [${bodyKeys}]:
${bodyGuide}
- quickstart (include when the README shows how to install/run): { install: THE exact one-line
    install or run command copied/adapted from the README (one line, no prose), requires?: up to 6
    hidden prerequisites a reader must already have (API key, account, Docker, runtime version) }
- decision: { adoptIf: 1-4 concrete situations (<=140 chars each) where this earns its keep,
    skipIf: 1-4 concrete situations where it is noise for the reader, insteadOf?: the incumbent
    it replaces ("grep", "joi", "raw SDK + a loop") }. Write these for a reader deciding in ten
    seconds — situational and specific, never marketing.
- coverImageUrl (optional): from the images embedded in the README above, the single best
    SQUARE-friendly cover for a small thumbnail — a clean logo, icon, or mark that crops well to a
    square. AVOID wide banners, screenshots, diagrams, and animated GIFs. Copy the image URL EXACTLY
    as it appears in the README. Use null if the README has no suitable square logo (a GitHub avatar
    is used instead).

Return raw JSON only, no code fences, no commentary.`;
}
