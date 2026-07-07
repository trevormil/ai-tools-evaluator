/**
 * Pure quality gate applied to GitHub *discovery* candidates before we spend an
 * evaluation on them (architecture §4). It drops low-signal repos to reduce
 * noise and save eval spend:
 *   - archived repos           → always dropped
 *   - forks                    → always dropped
 *   - below the star floor     → dropped UNLESS fast-rising (star velocity)
 *
 * Queue-submitted items never reach this gate (they go through resolveUrl, not
 * discovery) so a human suggestion is always honoured.
 */

const DAY_MS = 86_400_000;

export type QualityThresholds = {
  /** Minimum stars to pass on stars alone. */
  minStars: number;
  /** Stars/day since creation that lets a below-floor repo through as rising. */
  minStarVelocity: number;
};

/** The raw GitHub signals the gate reasons over (kept out of the strict ItemSource). */
export type RepoSignals = {
  stars: number;
  archived: boolean;
  fork: boolean;
  /** Repo creation time (ISO). Used to derive star velocity. */
  createdAt?: string;
};

export type GateDecision = {
  pass: boolean;
  /** Why it passed/failed — logged for observability. */
  reason: "stars" | "fast-rising" | "archived" | "fork" | "below-star-floor";
};

/** Stars per day since creation; 0 when age/createdAt is unknown or non-positive. */
export function starVelocity(signals: RepoSignals, now: Date): number {
  if (!signals.createdAt) return 0;
  const created = Date.parse(signals.createdAt);
  if (Number.isNaN(created)) return 0;
  const ageDays = (now.getTime() - created) / DAY_MS;
  if (ageDays <= 0) return signals.stars; // brand-new: treat all stars as today's velocity
  return signals.stars / ageDays;
}

/** Decide whether a discovered repo is worth evaluating. Pure + deterministic. */
export function evaluateQualityGate(
  signals: RepoSignals,
  thresholds: QualityThresholds,
  now: Date,
): GateDecision {
  if (signals.archived) return { pass: false, reason: "archived" };
  if (signals.fork) return { pass: false, reason: "fork" };
  if (signals.stars >= thresholds.minStars) return { pass: true, reason: "stars" };
  if (starVelocity(signals, now) >= thresholds.minStarVelocity) {
    return { pass: true, reason: "fast-rising" };
  }
  return { pass: false, reason: "below-star-floor" };
}
