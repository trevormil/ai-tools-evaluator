import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb, items, submissions } from "@aix/db";
import { DAILY_CAP, SUBMISSION_DAILY_CAP } from "@aix/core";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Daily-cap accounting — two INDEPENDENT budgets so submissions and trending
 * never starve each other:
 *   - trending: actual daily picks featured today (items.dailyPickAt) vs DAILY_CAP
 *   - submissions: link-drops published today (web + Discord) vs SUBMISSION_DAILY_CAP
 * Counting picks (not "items created today") means seed rows, backfills, and
 * community submissions never saturate the trending budget (ticket 0043).
 */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const midnight = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
  );
  const db = getDb();

  const trending =
    db
      .select({ n: sql<number>`count(*)` })
      .from(items)
      .where(and(isNotNull(items.dailyPickAt), gte(items.dailyPickAt, midnight)))
      .get()?.n ?? 0;

  const submissionsToday =
    db
      .select({ n: sql<number>`count(*)` })
      .from(submissions)
      .where(and(gte(submissions.createdAt, midnight), eq(submissions.status, "published")))
      .get()?.n ?? 0;

  return NextResponse.json({
    date: now.toISOString().slice(0, 10),
    // Flat fields describe the trending budget (kept for backward compatibility).
    publishedToday: trending,
    remaining: Math.max(0, DAILY_CAP - trending),
    dailyCap: DAILY_CAP,
    submissions: {
      publishedToday: submissionsToday,
      remaining: Math.max(0, SUBMISSION_DAILY_CAP - submissionsToday),
      cap: SUBMISSION_DAILY_CAP,
    },
  });
}
