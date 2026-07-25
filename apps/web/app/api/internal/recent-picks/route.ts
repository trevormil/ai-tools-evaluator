import { NextResponse } from "next/server";
import { and, gte, isNotNull } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { PICK_COOLDOWN_DAYS } from "@aix/core";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Categories featured as the daily pick within the cooldown window (ticket
 * 0078). The scanner penalizes these when choosing today's pick, so the feature
 * slot can't be a vector DB three days running.
 */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 30) : PICK_COOLDOWN_DAYS;
  const since = Math.floor(Date.now() / 1000) - days * 86_400;

  const rows = getDb()
    .selectDistinct({ category: items.category })
    .from(items)
    .where(and(isNotNull(items.dailyPickAt), gte(items.dailyPickAt, since)))
    .all();

  return NextResponse.json({ days, categories: rows.map((r) => r.category) });
}
