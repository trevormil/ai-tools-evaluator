import { NextResponse } from "next/server";
import { recentRecapDates } from "@/lib/recap";
import { recapOptions, RECAP_CORS } from "@/lib/recap-public";

export const dynamic = "force-dynamic";

/** UTC dates (newest first) that have a recap (ticket 0058). */
export async function GET() {
  return NextResponse.json({ dates: recentRecapDates(90) }, { headers: RECAP_CORS });
}

export const OPTIONS = recapOptions;
