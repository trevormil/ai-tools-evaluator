import { NextResponse } from "next/server";
import { githubReadmeHtml, TrendingUnavailable } from "@/lib/trending";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * README for a trending repo (ticket 0070/0071) as GitHub-rendered HTML —
 * full GFM exactly as github.com shows it, so the app renders the whole
 * story in-app. `?repo=owner/name` → `{ repo, readmeHtml }` (null when the
 * repo has no README).
 */
export async function GET(req: Request) {
  const repo = new URL(req.url).searchParams.get("repo") ?? "";
  try {
    const readmeHtml = await githubReadmeHtml(repo);
    return NextResponse.json({ repo, readmeHtml }, { headers: CORS });
  } catch (err) {
    if (err instanceof TrendingUnavailable) {
      return NextResponse.json({ error: err.message }, { status: 400, headers: CORS });
    }
    console.error("[aix/web] trending readme failed", err);
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
