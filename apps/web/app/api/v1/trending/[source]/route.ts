import { NextResponse } from "next/server";
import {
  githubTrending,
  hackerNewsTrending,
  huggingFaceTrending,
  productHuntTrending,
  TrendingUnavailable,
  type TrendingWindow,
} from "@/lib/trending";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ source: string }> };

/**
 * Live trending proxies (ticket 0067): what's rising on GitHub / Product Hunt
 * today or this week. Public read-only; upstream calls are memoized ~30 min.
 */
export async function GET(req: Request, { params }: Params) {
  const { source } = await params;
  const windowParam = new URL(req.url).searchParams.get("window") ?? "daily";
  if (windowParam !== "daily" && windowParam !== "weekly") {
    return NextResponse.json(
      { error: "window must be daily or weekly" },
      { status: 400, headers: CORS },
    );
  }
  const window = windowParam as TrendingWindow;

  try {
    if (source === "github") {
      return NextResponse.json(
        { source, window, repos: await githubTrending(window) },
        { headers: CORS },
      );
    }
    if (source === "producthunt") {
      return NextResponse.json(
        { source, window, products: await productHuntTrending(window) },
        { headers: CORS },
      );
    }
    if (source === "hackernews") {
      return NextResponse.json(
        { source, window, stories: await hackerNewsTrending(window) },
        { headers: CORS },
      );
    }
    if (source === "huggingface") {
      // HF's trending score is inherently recent — the window doesn't apply.
      return NextResponse.json(
        { source, window, models: await huggingFaceTrending() },
        { headers: CORS },
      );
    }
    return NextResponse.json({ error: "Unknown source" }, { status: 404, headers: CORS });
  } catch (err) {
    if (err instanceof TrendingUnavailable) {
      return NextResponse.json({ error: err.message }, { status: 503, headers: CORS });
    }
    console.error("[aix/web] trending fetch failed", err);
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
