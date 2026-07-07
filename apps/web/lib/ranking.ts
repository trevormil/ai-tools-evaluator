/**
 * Reddit-style "hot" ranking. Combines net votes (log-scaled) with recency so
 * fresh, upvoted content floats without letting a single mega-thread dominate
 * forever. `createdAtSec` is a unix-seconds timestamp (matches the DB columns).
 */
const EPOCH = 1_700_000_000; // arbitrary recent anchor to keep numbers small

export function hotScore(net: number, createdAtSec: number): number {
  const order = Math.log10(Math.max(Math.abs(net), 1));
  const sign = net > 0 ? 1 : net < 0 ? -1 : 0;
  return sign * order + (createdAtSec - EPOCH) / 45000;
}
