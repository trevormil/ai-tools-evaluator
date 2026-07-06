import { z } from "zod";

/** Bot config, parsed once at startup. Fail fast if anything is missing. */
export const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  /** If set, commands register to this guild (instant); else global (~1h). */
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_DIGEST_CHANNEL_ID: z.string().min(1),
  AIX_INTERNAL_TOKEN: z.string().min(1),
  /** Base URL of the `web` service that hosts /api/internal/*. */
  AIX_WEB_URL: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
