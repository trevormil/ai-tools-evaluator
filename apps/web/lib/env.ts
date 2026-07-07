import { z } from "zod";

/**
 * Runtime environment. Parsed lazily (not at module load) so a missing OAuth
 * secret never breaks `next build` — only the routes that actually need a value
 * assert its presence, at request time.
 */
const EnvSchema = z.object({
  AIX_DB_PATH: z.string().optional(),
  AIX_INTERNAL_TOKEN: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  // Public base URL (OAuth redirect origin, absolute links).
  AIX_PUBLIC_URL: z.string().optional(),
  // Opt-in dev-only login (/api/auth/dev). NEVER set in production.
  AIX_DEV_LOGIN: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}

/** Read a required env var at request time, throwing a clear error if unset. */
export function required(key: keyof Env): string {
  const value = getEnv()[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
