import { z } from "zod";

/**
 * All runtime configuration, parsed through zod at startup (global §6). Secrets
 * are optional in the schema so tests never need them; presence is enforced at
 * the point of real use via `requireLiveSecrets`.
 */
/**
 * Optional secret: k8s `envFrom` injects unset/placeholder secret keys as `""`,
 * so treat an empty string as absent rather than failing `.min(1)`.
 */
const optionalSecret = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional(),
);

const EnvSchema = z.object({
  GITHUB_TOKEN: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  /** OpenRouter (OpenAI-compatible) key — preferred when set, for cheap inference. */
  OPENROUTER_API_KEY: optionalSecret,
  AIX_INTERNAL_TOKEN: optionalSecret,
  /** ProductHunt developer token. When absent, the PH trending source is
   *  disabled and the scan runs GitHub-only (no failure). */
  PRODUCTHUNT_API_TOKEN: optionalSecret,
  /** skills.sh proxy URL + shared secret (see docs/skills-proxy). When either is
   *  absent, the skills trending source is disabled (no failure). */
  SKILLS_PROXY_URL: optionalSecret,
  SKILLS_PROXY_TOKEN: optionalSecret,
  AIX_WEB_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Evaluator model. Defaults to the cheapest OpenRouter model that reliably
   * produces the strict nested scorecard (each metric = {score, rationale}).
   * `gemini-*-flash-lite` is cheaper but fails the schema; `openai/gpt-4o-mini`
   * or `google/gemini-3.5-flash` are pricier but more reliable. An Anthropic id
   * (e.g. `claude-haiku-4-5-20251001`) routes via ANTHROPIC_API_KEY instead.
   */
  AIX_MODEL: z.string().min(1).default("deepseek/deepseek-v4-flash"),
  AIX_DAILY_CAP: z.coerce.number().int().positive().max(100).default(10),
  /**
   * MASTER cap on total trending items published per scan, across all sources.
   * The queue-only cronjob sets this to 0 to disable trending entirely. Default
   * 13 (= 5 GitHub + 5 ProductHunt + 3 skills). The single Discord "pick of the
   * day" is chosen downstream (highest overallScore); the queue is separate.
   */
  AIX_TRENDING_PICKS: z.coerce.number().int().nonnegative().max(40).default(13),
  /** Per-source trending budget: how many GitHub repos to grade+publish per scan. */
  AIX_TRENDING_PICKS_GITHUB: z.coerce.number().int().nonnegative().max(20).default(5),
  /** Per-source trending budget: how many ProductHunt launches per scan (needs token). */
  AIX_TRENDING_PICKS_PRODUCTHUNT: z.coerce.number().int().nonnegative().max(20).default(5),
  /** Per-source trending budget: how many skills.sh skills per scan (needs proxy). */
  AIX_TRENDING_PICKS_SKILLS: z.coerce.number().int().nonnegative().max(20).default(3),
  /**
   * Quality gate on GitHub *discovery* (queue submissions bypass it — a human
   * asked for those). Repos below the star floor are dropped unless they are
   * fast-rising; archived repos and forks are always dropped.
   */
  AIX_MIN_STARS: z.coerce.number().int().nonnegative().default(50),
  /** Stars/day (since creation) that counts a below-floor repo as fast-rising. */
  AIX_MIN_STAR_VELOCITY: z.coerce.number().nonnegative().default(5),
  AIX_DRY_RUN: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
});

export type ScannerEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ScannerEnv {
  return EnvSchema.parse(source);
}

/**
 * Fail fast if the secrets a *live* run needs are missing. Dry-run still needs
 * GitHub + a model provider (it discovers and evaluates for real), but not the
 * internal token (it never touches the web app). Exactly one model provider key
 * is required — OPENROUTER_API_KEY (preferred, cheap) or ANTHROPIC_API_KEY.
 */
export function requireLiveSecrets(env: ScannerEnv): void {
  const missing: string[] = [];
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!env.OPENROUTER_API_KEY && !env.ANTHROPIC_API_KEY) {
    missing.push("OPENROUTER_API_KEY or ANTHROPIC_API_KEY");
  }
  if (!env.AIX_DRY_RUN && !env.AIX_INTERNAL_TOKEN) missing.push("AIX_INTERNAL_TOKEN");
  if (missing.length) {
    throw new Error(`missing required env: ${missing.join(", ")}`);
  }
}
