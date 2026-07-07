import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, scanRuns } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

const Body = z.object({ source: z.string().min(1).max(40) });

/** Open a scan_runs audit row. Returns its id for the closing PATCH. */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const run = getDb()
    .insert(scanRuns)
    .values({ source: parsed.data.source, status: "running" })
    .returning()
    .get();
  return NextResponse.json({ id: run.id }, { status: 201 });
}
