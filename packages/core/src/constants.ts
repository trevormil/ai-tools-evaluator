/**
 * Max trending-discovered items the scanner may publish per calendar day (UTC).
 * Sized to cover the daily mix (5 GitHub + 5 ProductHunt + 3 skills = 13) with
 * headroom for a manual re-run.
 */
export const DAILY_CAP = 15;

/**
 * Max human-submitted items the queue may evaluate per calendar day (UTC).
 * Independent of DAILY_CAP so submissions are never starved by trending (and
 * vice-versa).
 */
export const SUBMISSION_DAILY_CAP = 50;
