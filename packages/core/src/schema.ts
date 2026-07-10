import { z } from "zod";
import { CATEGORIES, INTEGRATION_KINDS, ITEM_KINDS } from "./categories";
import { METRIC_KEYS } from "./metrics";
import { PRIMARY_AUDIENCES } from "./audience";
import { LENSES, lensFor, requiredBodySections } from "./lenses";

/**
 * Who this is actually for. AIx targets AI-first engineers who want to upskill,
 * not vibe coders chasing flashier tools — but the line is fuzzy, so both
 * audiences are scored independently rather than forced into a binary.
 */
export const AudienceFit = z.object({
  primary: z.enum(PRIMARY_AUDIENCES),
  aiEngineerFit: z.number().int().min(0).max(100),
  vibeCoderFit: z.number().int().min(0).max(100),
  rationale: z.string().min(10).max(400),
});
export type AudienceFit = z.infer<typeof AudienceFit>;

/** A single scorecard metric: a number 0–100 plus a one-line justification. */
export const MetricScore = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(10).max(280),
});
export type MetricScore = z.infer<typeof MetricScore>;

/** All ten metrics, keyed. Built dynamically so METRICS stays the source of truth. */
export const Scorecard = z.object(
  Object.fromEntries(METRIC_KEYS.map((k) => [k, MetricScore])) as Record<
    (typeof METRIC_KEYS)[number],
    typeof MetricScore
  >,
);
export type Scorecard = z.infer<typeof Scorecard>;

/**
 * The strict evaluation schema. Every discovered item is distilled into exactly
 * this shape — by the AI evaluator, by a Discord submission, or by hand. It is
 * the contract shared by the DB, the .md artifact, the web UI, and the bot.
 *
 * Design rule: NO free-for-all. Prose fields have length bounds so artifacts
 * stay skimmable; every categorical field is a closed enum; the verdict is
 * forced (no "it depends" escape hatch).
 */

const slug = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

const url = z.string().url().max(500);

/**
 * The headline verdict — deliberately harsh and forced. The whole point of the
 * site is to cut through hype: most repos are thin optimizations over what a
 * capable base agent already does. `worth` is the one-word takeaway; `noise`
 * is 0 (pure signal, genuinely new capability) → 100 (pure noise, complexity
 * for its own sake).
 */
export const Verdict = z.enum([
  "essential", // genuinely expands what you can do; adopt it
  "worthwhile", // real, narrow win; adopt if it fits your workflow
  "niche", // useful only for a specific situation
  "marginal", // minor convenience over doing it yourself
  "redundant", // the base agent already does this about as well
  "complexity-trap", // adds moving parts without a real payoff
]);
export type Verdict = z.infer<typeof Verdict>;

export const MediaAsset = z.object({
  type: z.enum(["image", "video"]),
  url,
  /** Locally cached / self-hosted copy (object storage or /public), if mirrored. */
  cachedUrl: url.optional(),
  alt: z.string().max(300).optional(),
  source: z.enum([
    "repo-readme",
    "repo-avatar",
    "repo-social-preview",
    "screenshot",
    "ai-generated",
    "submitted",
  ]),
});
export type MediaAsset = z.infer<typeof MediaAsset>;

/** Raw signal captured from the source, before/around evaluation. */
export const ItemSource = z.object({
  kind: z.enum(ITEM_KINDS),
  /**
   * Evaluation lens override. Absent → derived from `kind` (see `lensFor`), so
   * existing items keep their frame; a source sets this only when the kind's
   * default is wrong (e.g. a GitHub repo that is really a launched product).
   */
  lens: z.enum(LENSES).optional(),
  /** Canonical external id: "owner/repo" for GitHub, arXiv id for papers. */
  externalId: z.string().min(1).max(200),
  url,
  title: z.string().min(1).max(200),
  author: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  // GitHub-ish signals (optional; papers won't have them)
  stars: z.number().int().nonnegative().optional(),
  starsGainedRecently: z.number().int().optional(),
  language: z.string().max(60).optional(),
  license: z.string().max(60).optional(),
  pushedAt: z.string().datetime().optional(),
  /** Repo creation time (ISO) — used to rank discovery by star velocity. */
  createdAt: z.string().datetime().optional(),
  // Paper-ish signals
  publishedAt: z.string().datetime().optional(),
  authors: z.array(z.string().max(120)).max(50).optional(),
});
export type ItemSource = z.infer<typeof ItemSource>;

/**
 * THE strict document schema. `body.*` are the five required plaintext
 * explanations the product is built around.
 */
const EvaluationShape = z.object({
  schemaVersion: z.literal(1),
  slug,
  source: ItemSource,

  category: z.enum(CATEGORIES),
  integration: z.enum(INTEGRATION_KINDS),
  /** Free-tagging on top of the closed category, e.g. "cli", "typescript". */
  tags: z.array(slug).max(12).default([]),

  verdict: Verdict,
  /** 0 = pure signal, 100 = pure noise. Forces a number, no hedging. */
  noiseScore: z.number().int().min(0).max(100),
  /** Who it's for — independent fit scores for AI engineers vs vibe coders. */
  audience: AudienceFit,
  /** Ten-metric report card, each 0–100 with a rationale. */
  scores: Scorecard,
  /** Weighted final score, 0–100. Recomputed from `scores` on write. */
  overallScore: z.number().int().min(0).max(100),
  /** One-line hook shown in feeds. Must state the verdict's reasoning tersely. */
  tagline: z.string().min(10).max(160),

  /**
   * The write-up. Three sections are common to every lens (whatItIs,
   * devilsAdvocate, whatWouldMakeItBetter); the rest are lens-specific and
   * optional at the field level. Which optional sections are REQUIRED is
   * enforced per lens by the refinement on `Evaluation` below (see LENS_SECTIONS).
   */
  body: z.object({
    /** Common — plainspoken, no marketing: what the thing actually is. */
    whatItIs: z.string().min(40).max(1200),
    /** agent-tool — how it differs from a vanilla capable base agent (Claude). */
    vsVanilla: z.string().min(40).max(1200).optional(),
    /** agent-tool — skill vs plugin vs workflow-shift; justify `integration`. */
    surfaceArea: z.string().min(40).max(1000).optional(),
    /** product — how it compares to incumbents and to doing it yourself. */
    vsAlternatives: z.string().min(40).max(1200).optional(),
    /** research — the specific delta over prior work. */
    vsPriorWork: z.string().min(40).max(1200).optional(),
    /** research — can a practitioner actually reproduce / apply it. */
    reproducibility: z.string().min(40).max(1000).optional(),
    /** Common — THE devil's advocate; framed per lens. Be harsh. */
    devilsAdvocate: z.string().min(80).max(1600),
    /** Common — concrete, forward-looking changes that would raise the verdict. */
    whatWouldMakeItBetter: z.string().min(40).max(1200),
    /** Optional — when it genuinely IS worth it, the honest case for adoption. */
    steelman: z.string().max(1200).optional(),
  }),

  /**
   * Decision layer (optional, ticket 0039) — everything an engineer needs to
   * adopt-or-skip in one look. Extracted from the README by the evaluator.
   */
  quickstart: z
    .object({
      /** The exact one-line install/run command. One line, no prose. */
      install: z
        .string()
        .min(2)
        .max(200)
        .refine((s) => !s.includes("\n"), "install must be a single line"),
      /** Hidden prerequisites: API keys, accounts, runtimes, Docker, etc. */
      requires: z.array(z.string().min(2).max(80)).max(6).optional(),
    })
    .optional(),
  decision: z
    .object({
      /** "Adopt if…" — concrete situations where this earns its keep. */
      adoptIf: z.array(z.string().min(5).max(140)).min(1).max(4),
      /** "Skip if…" — concrete situations where it's noise for you. */
      skipIf: z.array(z.string().min(5).max(140)).min(1).max(4),
      /** The incumbent it replaces ("grep", "joi", "raw SDK + a loop"). */
      insteadOf: z.string().min(2).max(120).optional(),
    })
    .optional(),

  media: z.array(MediaAsset).max(6).default([]),

  /** Provenance of this evaluation. */
  evaluatedBy: z.enum(["ai", "human", "import"]),
  model: z.string().max(80).optional(),
  evaluatedAt: z.string().datetime(),
});

/**
 * THE strict document schema: the base shape plus per-lens body enforcement.
 * The three common sections are required at the field level; the lens (derived
 * from `source`) decides which lens-specific sections must also be present.
 */
export const Evaluation = EvaluationShape.superRefine((data, ctx) => {
  const lens = lensFor(data.source);
  for (const key of requiredBodySections(lens)) {
    const value = (data.body as Record<string, unknown>)[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", key],
        message: `body.${key} is required for the "${lens}" lens`,
      });
    }
  }
});
export type Evaluation = z.infer<typeof Evaluation>;

/** Input the AI evaluator must produce (everything it can't know, or that we
 *  recompute deterministically like `overallScore`, is omitted). */
export const EvaluationDraft = EvaluationShape.omit({
  schemaVersion: true,
  source: true,
  media: true,
  evaluatedBy: true,
  model: true,
  evaluatedAt: true,
  slug: true,
  overallScore: true,
}).extend({
  /**
   * The LLM's pick of the best SQUARE-friendly cover image URL from the README
   * (a clean logo/icon, not a banner/screenshot/GIF), or null. Best-effort and
   * never part of the final Evaluation — the scanner validates it against the
   * README's actual images and derives `media` from it. Bad values coerce to
   * undefined so a cosmetic pick never fails the whole evaluation.
   */
  coverImageUrl: url.nullish().catch(undefined),
});
export type EvaluationDraft = z.infer<typeof EvaluationDraft>;
