import { NextResponse } from "next/server";
import { getDb, items } from "@aix/db";
import { eq } from "drizzle-orm";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { hotScore } from "@/lib/ranking";

export const dynamic = "force-dynamic";

/**
 * Recompute the hot-ranking `score` for every item from its current
 * `upvotes` and `createdAt`. The score decays with age relative to votes, so it
 * must be recomputed on a cadence (hourly CronJob) for "hot" ordering to stay
 * fresh even when no new votes arrive. Internal-token guarded.
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = db
    .select({ id: items.id, upvotes: items.upvotes, createdAt: items.createdAt })
    .from(items)
    .all();

  let updated = 0;
  for (const r of rows) {
    db.update(items)
      .set({ score: hotScore(r.upvotes, r.createdAt) })
      .where(eq(items.id, r.id))
      .run();
    updated++;
  }

  return NextResponse.json({ ok: true, updated });
}
