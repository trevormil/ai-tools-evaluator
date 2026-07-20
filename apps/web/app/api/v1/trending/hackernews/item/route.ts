import { NextResponse } from "next/server";
import { hackerNewsItem, TrendingUnavailable } from "@/lib/trending";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * One HN story + its top-level comments (ticket 0071 follow-up) so the app
 * can show the discussion in-app. `?id=<story id>` → HnItemDetail.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    return NextResponse.json(await hackerNewsItem(id), { headers: CORS });
  } catch (err) {
    if (err instanceof TrendingUnavailable) {
      return NextResponse.json({ error: err.message }, { status: 400, headers: CORS });
    }
    console.error("[aix/web] hn item failed", err);
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502, headers: CORS });
  }
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
