import { NextResponse } from "next/server";
import { desc, isNotNull, and, eq } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { toRankedItem } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * The current daily pick (ticket 0058): the most recent item stamped
 * `dailyPickAt` by the daily-pick job. 404 until the first pick lands.
 */
export async function GET() {
  const item = getDb()
    .select()
    .from(items)
    .where(and(eq(items.published, true), isNotNull(items.dailyPickAt)))
    .orderBy(desc(items.dailyPickAt))
    .limit(1)
    .get();
  if (!item) {
    return NextResponse.json({ error: "No daily pick yet" }, { status: 404, headers: CORS });
  }
  return NextResponse.json(
    {
      item: toRankedItem(item),
      pickedAt: new Date(item.dailyPickAt! * 1000).toISOString(),
    },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
