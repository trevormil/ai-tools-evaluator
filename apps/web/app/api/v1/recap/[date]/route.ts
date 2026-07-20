import { getRecap } from "@/lib/recap";
import { recapOptions, recapResponse } from "@/lib/recap-public";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ date: string }> };

/** One UTC day's recap as JSON (ticket 0058). 404 when nothing was judged. */
export async function GET(_req: Request, { params }: Params) {
  const { date } = await params;
  return recapResponse(getRecap(date));
}

export const OPTIONS = recapOptions;
