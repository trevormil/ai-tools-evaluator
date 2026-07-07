import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, items, submissions } from "@aix/db";
import { DAILY_CAP, SUBMISSION_DAILY_CAP } from "@aix/core";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Daily-cap accounting — two INDEPENDENT budgets so submissions and trending
 * never starve each other:
 *   - trending: scanner-discovered items today (no matching submission row) vs DAILY_CAP
 *   - submissions: link-drops published today (web + Discord) vs SUBMISSION_DAILY_CAP
 * An item "is a submission" iff its url has a submission row — the only signal
 * that works for both web (postedById set) and Discord (postedById null) drops.
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
      .where(
        and(gte(items.createdAt, midnight), sql`${items.url} NOT IN (SELECT url FROM submissions)`),
      )
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
