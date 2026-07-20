import { NextResponse } from "next/server";
import { hallOfShame, mostDiscussed, topRated } from "@/lib/leaderboard";
import { toRankedItem } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/** The /leaderboard page's three ranked lists as JSON (ticket 0058). */
export async function GET() {
  return NextResponse.json(
    {
      topRated: topRated().map(toRankedItem),
      mostDiscussed: mostDiscussed().map(toRankedItem),
      hallOfShame: hallOfShame().map(toRankedItem),
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
