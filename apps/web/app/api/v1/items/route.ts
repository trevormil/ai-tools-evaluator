import { NextResponse } from "next/server";
import { listItems, type ItemSort } from "@/lib/queries";
import { toPublicItem } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;
const SORTS: ItemSort[] = ["hot", "new", "top"];

/** Public, read-only list of published items. Filters mirror `listItems`. */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;

  const minScoreRaw = q.get("minScore");
  const minScore = minScoreRaw != null ? Number(minScoreRaw) : undefined;
  const limitRaw = q.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw ?? 30) || 30, 1), 100);
  const sortRaw = q.get("sort");
  const sort = SORTS.includes(sortRaw as ItemSort) ? (sortRaw as ItemSort) : undefined;

  const rows = listItems({
    category: q.get("category") ?? undefined,
    integration: q.get("integration") ?? undefined,
    verdict: q.get("verdict") ?? undefined,
    audience: q.get("audience") ?? undefined,
    minScore: typeof minScore === "number" && !Number.isNaN(minScore) ? minScore : undefined,
    q: q.get("q") ?? undefined,
    sort,
    limit,
  });

  return NextResponse.json(
    { items: rows.map(toPublicItem), count: rows.length },
    {
      headers: {
        ...CORS,
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
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
