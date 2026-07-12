import { NextResponse } from "next/server";
import { dumpItems } from "@/lib/queries";
import { toDumpItem } from "@/lib/public-api";

export const dynamic = "force-static";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * Public, read-only bulk dump of the whole corpus — every published, scored item
 * with its official evaluation, README, and metadata. Static export (ADR-0004):
 * a prerendered handler gets no request params, so the entire corpus comes back
 * in one response (newest first), no cursor paging.
 */
export function GET() {
  const { items } = dumpItems({ limit: Number.MAX_SAFE_INTEGER });

  return NextResponse.json(
    { items: items.map(toDumpItem), count: items.length },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
