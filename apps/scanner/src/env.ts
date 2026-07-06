import { z } from "zod";

/**
 * All runtime configuration, parsed through zod at startup (global §6). Secrets
 * are optional in the schema so tests never need them; presence is enforced at
 * the point of real use via `requireLiveSecrets`.
 */
const EnvSchema = z.object({
  GITHUB_TOKEN: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AIX_INTERNAL_TOKEN: z.string().min(1).optional(),
  AIX_WEB_URL: z.string().url().default("http://localhost:3000"),
  AIX_MODEL: z.string().min(1).default("claude-opus-4-8"),
  AIX_DAILY_CAP: z.coerce.number().int().positive().max(100).default(10),
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
 * GitHub + Anthropic (it discovers and evaluates for real), but not the internal
 * token (it never touches the web app).
 */
export function requireLiveSecrets(env: ScannerEnv): void {
  const missing: string[] = [];
  if (!env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!env.AIX_DRY_RUN && !env.AIX_INTERNAL_TOKEN) missing.push("AIX_INTERNAL_TOKEN");
  if (missing.length) {
    throw new Error(`missing required env: ${missing.join(", ")}`);
  }
}
