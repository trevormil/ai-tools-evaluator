import { latestRecap } from "@/lib/recap";
import { recapOptions, recapResponse } from "@/lib/recap-public";

export const dynamic = "force-dynamic";

/** The latest nightly recap as JSON (ticket 0058). 404 until the first judged night. */
export async function GET() {
  return recapResponse(latestRecap());
}

export const OPTIONS = recapOptions;
