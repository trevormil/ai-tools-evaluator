import { getDb, activities } from "@aix/db";

/* --------------------------------------------------------- emission */

export type EmitActivityInput = {
  actorId: string;
  verb: string; // posted | reposted | commented | stack_added | followed
  objectType: string; // post | item | comment | user | stack
  objectId: string;
};

/**
 * Insert an activity-feed row. Best-effort: a failure here must never break the
 * underlying mutation, so we swallow (and log) any error.
 *
 * Reading the feed lives in `home-feed.ts` (unified timeline, ticket 0024).
 */
export function emitActivity(input: EmitActivityInput): void {
  try {
    getDb().insert(activities).values(input).run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[aix/web] emitActivity failed", err);
  }
}
