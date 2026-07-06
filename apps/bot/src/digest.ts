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
