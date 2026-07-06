import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, scanRuns } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["success", "error"]),
  discovered: z.number().int().nonnegative().default(0),
  published: z.number().int().nonnegative().default(0),
  skippedDuplicate: z.number().int().nonnegative().default(0),
  error: z.string().max(2000).optional(),
});

/** Close a scan_runs audit row with final counts. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { status, discovered, published, skippedDuplicate, error } = parsed.data;

  const run = getDb()
    .update(scanRuns)
    .set({ status, discovered, published, skippedDuplicate, error: error ?? null, finishedAt: Math.floor(Date.now() / 1000) })
    .where(eq(scanRuns.id, id))
    .returning()
    .get();

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ scanRun: run });
}
