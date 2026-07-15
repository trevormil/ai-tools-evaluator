import { eq } from "drizzle-orm";
import { getDb, items, submissions, type Item } from "@aix/db";
import { rescoreState, RESCORE_COOLDOWN_SECONDS } from "./rescore";

/**
 * Server-only: request a re-evaluation of an already-scored item. Stamps the
 * per-item weekly cooldown (`items.rescoreRequestedAt`) and enqueues a `queued`
 * submission — the scanner drains it and the publish path overwrites the item
 * in place (see `/api/internal/items`). Isolated from the pure `rescore.ts`
 * helpers so client components never pull the DB driver into their bundle.
 */
export type RescoreOutcome =
  | { ok: true; item: Item; nextEligibleAt: number }
  | { ok: false; code: "not_found" | "not_scored" | "pending" }
  | { ok: false; code: "cooldown"; nextEligibleAt: number };

export function requestRescore(slug: string, userId: string, nowSec: number): RescoreOutcome {
  const db = getDb();
  const item = db.select().from(items).where(eq(items.slug, slug)).get();
  if (!item) return { ok: false, code: "not_found" };
  // Pending items are already in the queue — there is nothing to re-score.
  if (item.scoreStatus !== "scored") return { ok: false, code: "not_scored" };

  const state = rescoreState(item, nowSec);
  if (!state.eligible) {
    // A request already in flight (stamped, not yet re-scored) blocks a second
    // enqueue; otherwise we're inside the weekly cooldown window.
    if (state.pending) return { ok: false, code: "pending" };
    return { ok: false, code: "cooldown", nextEligibleAt: state.nextEligibleAt ?? nowSec };
  }

  const updated = db
    .update(items)
    .set({ rescoreRequestedAt: nowSec })
    .where(eq(items.id, item.id))
    .returning()
    .get();

  db.insert(submissions)
    .values({
      url: item.url,
      note: "rescore",
      source: "web",
      submittedById: userId,
      status: "queued",
      itemId: item.id,
    })
    .run();

  return { ok: true, item: updated, nextEligibleAt: nowSec + RESCORE_COOLDOWN_SECONDS };
}
