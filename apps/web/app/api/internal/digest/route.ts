import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/** Items published since `?since=<iso>` — data for the bot's daily digest. */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sinceParam = new URL(req.url).searchParams.get("since");
  const sinceMs = sinceParam ? Date.parse(sinceParam) : NaN;
  const sinceSec = Number.isNaN(sinceMs) ? 0 : Math.floor(sinceMs / 1000);

  const rows = getDb()
    .select({
      slug: items.slug,
      title: items.title,
      url: items.url,
      verdict: items.verdict,
      overallScore: items.overallScore,
      tagline: items.tagline,
      category: items.category,
      coverImageUrl: items.coverImageUrl,
    })
    .from(items)
    .where(and(eq(items.published, true), gte(items.createdAt, sinceSec)))
    .all();

  return NextResponse.json({ items: rows });
}
