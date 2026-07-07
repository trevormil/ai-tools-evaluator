import type { DigestItem, InternalClient } from "./client";
import { buildItemEmbed } from "./embeds";
import { readLastPosted, writeLastPosted } from "./state";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal channel surface we need — kept narrow so digest logic stays testable. */
export type SendableChannel = { send: (payload: unknown) => Promise<unknown> };

export type DigestDeps = {
  client: InternalClient;
  statePath: string;
  /** Resolves the target channel lazily (fetched from the gateway at post time). */
  getChannel: () => Promise<SendableChannel>;
  now?: () => Date;
  /** How far back to look when there's no prior state. Default 24h. */
  lookbackMs?: number;
  /** Public site base URL, so embeds link to the AIx item page. */
  siteBaseUrl?: string;
  /** Max items to post per run — the daily pick. Default 1. */
  maxPerRun?: number;
};

/**
 * Fetch items published since the last successful post and send one embed each,
 * then advance the stored watermark. Idempotent across restarts via .state.json.
 * Returns the items that were posted.
 */
export async function runDigest(deps: DigestDeps): Promise<DigestItem[]> {
  const now = (deps.now ?? (() => new Date()))();
  const last = await readLastPosted(deps.statePath);
  const since = last ?? new Date(now.getTime() - (deps.lookbackMs ?? DAY_MS)).toISOString();

  const items = await deps.client.fetchDigest(since);
  if (items.length === 0) {
    // Advance the watermark even on an empty run so a restart never re-posts
    // the whole lookback window.
    await writeLastPosted(deps.statePath, now.toISOString());
    return [];
  }

  // Post at most `maxPerRun` (default 1) — the highest-scored item in the window
  // is the "pick of the day". The rest stay on the site.
  const max = deps.maxPerRun ?? 1;
  const picks = [...items].sort((a, b) => b.overallScore - a.overallScore).slice(0, max);

  const channel = await deps.getChannel();
  for (const item of picks) {
    // Plainspoken summary as the message text above the rich embed (Discord
    // caps content at 2000 chars; whatItIs is ≤1200 but slice defensively).
    const content = item.summary ? `📌 ${item.summary}`.slice(0, 1900) : undefined;
    await channel.send({
      content,
      embeds: [buildItemEmbed(item, { siteBaseUrl: deps.siteBaseUrl })],
    });
  }
  await writeLastPosted(deps.statePath, now.toISOString());
  return picks;
}

/** Kick off an immediate run, then repeat on an interval. Returns the timer. */
export function startDigestScheduler(
  deps: DigestDeps,
  intervalMs = DAY_MS,
): ReturnType<typeof setInterval> {
  const tick = () => {
    runDigest(deps).catch((err) => console.error("[digest] run failed:", err));
  };
  tick();
  return setInterval(tick, intervalMs);
}
