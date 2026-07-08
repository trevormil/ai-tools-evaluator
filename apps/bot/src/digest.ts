import type { DigestItem, InternalClient } from "./client";
import { buildItemEmbed } from "./embeds";
import {
  readLastPosted,
  writeLastPosted,
  readLastPickDate,
  writeLastPickDate,
  readLastSubmissionPosted,
  writeLastSubmissionPosted,
} from "./state";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/**
 * How often the daily-pick poller checks for a newly published item. Kept short
 * (aligned with the 5-min queue + submission poster) so the day's pick posts
 * within minutes of the scan, decoupled from bot restart time. The watermark in
 * .state.json makes each item post exactly once regardless of poll frequency.
 */
const DIGEST_POLL_MS = 5 * 60 * 1000;

/** Minimal channel surface we need — kept narrow so digest logic stays testable. */
export type SendableChannel = { send: (payload: unknown) => Promise<unknown> };

/** Resolves a Discord channel id to a sendable channel; throws if unreachable. */
export type ChannelFetcher = (id: string) => Promise<SendableChannel>;

/**
 * Resolve the digest channel dynamically: prefer `primaryId` (the new home), but
 * fall back to `fallbackId` while the primary is unreachable — e.g. before the
 * bot has been added to the new server. The moment the primary becomes reachable
 * the resolver returns it and the fallback is dropped, so the cutover happens on
 * its own with no redeploy and no missed daily pick in between.
 */
export function makeDigestChannelResolver(
  fetchChannel: ChannelFetcher,
  primaryId: string,
  fallbackId?: string,
): () => Promise<SendableChannel> {
  return async () => {
    try {
      return await fetchChannel(primaryId);
    } catch (err) {
      if (fallbackId && fallbackId !== primaryId) return fetchChannel(fallbackId);
      throw err;
    }
  };
}

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

  // Once-per-day guard: a pick posts at most once per UTC calendar day. The
  // marker is set only after a real post (below), so an earlier *empty* poll —
  // or any restart/re-rollout — never consumes the day and blocks the real
  // pick. Keyed on UTC day so the post lands each day just after the 13:00 UTC
  // scan, not repeatedly as new items trickle in.
  const today = now.toISOString().slice(0, 10);
  if ((await readLastPickDate(deps.statePath)) === today) return [];

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
  // Mark the day consumed only after a real post, so empty polls don't block it.
  await writeLastPickDate(deps.statePath, today);
  return picks;
}

/** Kick off an immediate run, then repeat on an interval. Returns the timer. */
export function startDigestScheduler(
  deps: DigestDeps,
  intervalMs = DIGEST_POLL_MS,
): ReturnType<typeof setInterval> {
  const tick = () => {
    runDigest(deps).catch((err) => console.error("[digest] run failed:", err));
  };
  tick();
  return setInterval(tick, intervalMs);
}

export type SubmissionDigestDeps = {
  client: InternalClient;
  statePath: string;
  getChannel: () => Promise<SendableChannel>;
  now?: () => Date;
  siteBaseUrl?: string;
  /** First-run lookback when there's no watermark. Default 1h. */
  lookbackMs?: number;
};

/**
 * Auto-post each Discord-requested submission the moment the queue scores it.
 * Watermarked on scoredAt so a restart never double-posts. DISCORD submissions
 * only — web submissions are never echoed here.
 */
export async function runSubmissionDigest(deps: SubmissionDigestDeps): Promise<DigestItem[]> {
  const now = (deps.now ?? (() => new Date()))();
  const last = await readLastSubmissionPosted(deps.statePath);
  const since = last ?? new Date(now.getTime() - (deps.lookbackMs ?? HOUR_MS)).toISOString();

  const items = await deps.client.fetchDigest(since, "discord");
  if (items.length === 0) {
    await writeLastSubmissionPosted(deps.statePath, now.toISOString());
    return [];
  }

  const channel = await deps.getChannel();
  for (const item of items) {
    await channel.send({
      content: "✅ **Scored** — a repo someone dropped with `/score`:",
      embeds: [buildItemEmbed(item, { siteBaseUrl: deps.siteBaseUrl })],
    });
  }
  await writeLastSubmissionPosted(deps.statePath, now.toISOString());
  return items;
}

/** Poll for scored Discord submissions (aligned with the 5-min queue). */
export function startSubmissionDigestScheduler(
  deps: SubmissionDigestDeps,
  intervalMs = 5 * 60 * 1000,
): ReturnType<typeof setInterval> {
  const tick = () => {
    runSubmissionDigest(deps).catch((err) => console.error("[submission-digest] run failed:", err));
  };
  tick();
  return setInterval(tick, intervalMs);
}
