import { z } from "zod";

/** Bot config, parsed once at startup. Fail fast if anything is missing. */
export const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),
  /** If set, commands register to this guild (instant); else global (~1h). */
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_DIGEST_CHANNEL_ID: z.string().min(1),
  /**
   * Old digest channel to post to while the bot can't yet reach the primary
   * (e.g. before it's been added to the new server). Once the primary becomes
   * reachable the bot switches to it automatically — a zero-downtime cutover.
   */
  DISCORD_DIGEST_FALLBACK_CHANNEL_ID: z.string().min(1).optional(),
  AIX_INTERNAL_TOKEN: z.string().min(1),
  /** Base URL of the `web` service that hosts /api/internal/*. */
  AIX_WEB_URL: z.string().url(),
  /** Public site URL — embeds link to `${AIX_PUBLIC_URL}/item/<slug>`. */
  AIX_PUBLIC_URL: z.string().url().default("https://aix.trevormil.com"),
  /** Directory for durable digest state (PVC-backed in prod). Defaults to cwd. */
  AIX_BOT_STATE_DIR: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(source);
}
