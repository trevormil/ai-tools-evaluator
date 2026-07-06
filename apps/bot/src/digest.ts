import type { DigestItem, InternalClient } from "./client";
import { buildItemEmbed } from "./embeds";
import {
  readLastPosted,
  writeLastPosted,
  readLastWeeklyPosted,
  writeLastWeeklyPosted,
} from "./state";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

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
  if (items.length === 0) return [];

  const channel = await deps.getChannel();
  for (const item of items) {
    await channel.send({ embeds: [buildItemEmbed(item)] });
  }
  await writeLastPosted(deps.statePath, now.toISOString());
  return items;
}

/** Kick off an immediate run, then repeat on an interval. Returns the timer. */
export function startDigestScheduler(deps: DigestDeps, intervalMs = DAY_MS): ReturnType<typeof setInterval> {
  const tick = () => {
    runDigest(deps).catch((err) => console.error("[digest] run failed:", err));
  };
  tick();
  return setInterval(tick, intervalMs);
}

export type WeeklyDigestDeps = {
  client: InternalClient;
  statePath: string;
  getChannel: () => Promise<SendableChannel>;
  now?: () => Date;
  /** How many top items to feature. Default 5. */
  topN?: number;
};

/**
 * Post a weekly "🏆 Best of the week" — the top items (by overallScore) from the
 * last 7 days. Guarded by a per-week watermark in .state.json so a restart (or a
 * more frequent tick) never double-posts within the same week. Returns the items
 * featured (empty when skipped or when there was nothing to show).
 */
export async function runWeeklyDigest(deps: WeeklyDigestDeps): Promise<DigestItem[]> {
  const now = (deps.now ?? (() => new Date()))();
  const last = await readLastWeeklyPosted(deps.statePath);
  if (last && now.getTime() - new Date(last).getTime() < WEEK_MS) return [];

  const since = new Date(now.getTime() - WEEK_MS).toISOString();
  const items = await deps.client.fetchDigest(since);
  if (items.length === 0) return [];

  const top = [...items]
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, deps.topN ?? 5);

  const channel = await deps.getChannel();
  await channel.send({ content: "🏆 **Best of the week**" });
  for (const item of top) {
    await channel.send({ embeds: [buildItemEmbed(item)] });
  }
  await writeLastWeeklyPosted(deps.statePath, now.toISOString());
  return top;
}

/**
 * Kick off an immediate weekly run, then re-check on an interval. Checks DAILY by
 * default; the 7-day watermark inside `runWeeklyDigest` enforces once-per-week,
 * so a mid-week restart still fires when a week is genuinely due.
 */
export function startWeeklyDigestScheduler(
  deps: WeeklyDigestDeps,
  checkIntervalMs = DAY_MS,
): ReturnType<typeof setInterval> {
  const tick = () => {
    runWeeklyDigest(deps).catch((err) => console.error("[weekly-digest] run failed:", err));
  };
  tick();
  return setInterval(tick, checkIntervalMs);
}
