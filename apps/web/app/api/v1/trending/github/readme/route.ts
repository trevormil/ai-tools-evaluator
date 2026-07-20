import { NextResponse } from "next/server";
import { githubReadme, TrendingUnavailable } from "@/lib/trending";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * README markdown for a trending repo (ticket 0070) — lets the app show the
 * whole story in-app instead of bouncing to github.com.
 * `?repo=owner/name` → `{ repo, readmeMd }` (readmeMd null when absent).
 */
export async function GET(req: Request) {
  const repo = new URL(req.url).searchParams.get("repo") ?? "";
  try {
    const readmeMd = await githubReadme(repo);
    return NextResponse.json({ repo, readmeMd }, { headers: CORS });
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
