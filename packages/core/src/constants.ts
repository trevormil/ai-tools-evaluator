/** Max trending-discovered items the scanner may publish per calendar day (UTC). */
export const DAILY_CAP = 10;

/**
 * Max human-submitted items the queue may evaluate per calendar day (UTC).
 * Independent of DAILY_CAP so submissions are never starved by trending (and
 * vice-versa).
 */
export const SUBMISSION_DAILY_CAP = 50;
