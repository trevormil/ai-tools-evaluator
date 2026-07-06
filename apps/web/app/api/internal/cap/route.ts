import { NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { DAILY_CAP } from "@aix/core";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/** Daily-cap accounting. `publishedToday` counts items created since UTC midnight. */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const midnight = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000);

  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(gte(items.createdAt, midnight))
    .get();
  const publishedToday = row?.n ?? 0;

  return NextResponse.json({
    date: now.toISOString().slice(0, 10),
    publishedToday,
    remaining: Math.max(0, DAILY_CAP - publishedToday),
    dailyCap: DAILY_CAP,
  });
}
