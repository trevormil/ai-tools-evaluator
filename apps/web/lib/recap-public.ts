import { NextResponse } from "next/server";
import { verdictSummary, type Recap, type RecapItem } from "@/lib/recap";
import { toRankedItem, type RankedItem } from "@/lib/public-api";

/** Shared serializer for the three recap endpoints (ticket 0058). */

export const RECAP_CORS = { "access-control-allow-origin": "*" } as const;

type PublicRecapItem = RankedItem & { uses: number };

const toPublicRecapItem = (i: RecapItem): PublicRecapItem => ({ ...toRankedItem(i), uses: i.uses });

export function recapResponse(recap: Recap | null): NextResponse {
  if (!recap) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: RECAP_CORS });
  }
  return NextResponse.json(
    {
      recap: {
        date: recap.date,
        total: recap.total,
        verdictCounts: recap.verdictCounts,
        summary: verdictSummary(recap.verdictCounts),
        items: recap.items.map(toPublicRecapItem),
        leadPick: recap.leadPick ? toPublicRecapItem(recap.leadPick) : null,
        complexityTrap: recap.complexityTrap ? toPublicRecapItem(recap.complexityTrap) : null,
        topAdopted: recap.topAdopted.map(toPublicRecapItem),
      },
    },
    { headers: RECAP_CORS },
  );
}

export function recapOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...RECAP_CORS,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
