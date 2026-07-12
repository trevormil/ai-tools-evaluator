import { NextResponse } from "next/server";
import { listItems } from "@/lib/queries";
import { toPublicItem } from "@/lib/public-api";

export const dynamic = "force-static";

const CORS = { "access-control-allow-origin": "*" } as const;

/**
 * `GET /api/v1/items.json` — public, read-only list of every published item.
 * Static export (ADR-0004: the iOS API v1 becomes static `/api/v1/*.json`): a
 * prerendered handler gets no request params, so it returns the FULL catalog
 * (newest first) — consumers filter client-side. The `.json` path keeps this
 * file from colliding with the `items/[slug]` directory on the static FS.
 */
export function GET() {
  const rows = listItems({ sort: "new", limit: Number.MAX_SAFE_INTEGER });
  // Pending community submissions carry placeholder scores — never serve them
  // to API consumers that render scorecards (ticket 0035).
  const scored = rows.filter((r) => r.scoreStatus !== "pending");

  return NextResponse.json(
    { items: scored.map(toPublicItem), count: scored.length },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
