import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, submissions } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["processing", "published", "duplicate", "rejected", "failed"]),
  reason: z.string().max(1000).optional(),
  itemId: z.string().optional(),
});

/** Update a submission's status while the scanner processes it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const db = getDb();

  const terminal = ["published", "duplicate", "rejected", "failed"].includes(parsed.data.status);
  const submission = db
    .update(submissions)
    .set({
      status: parsed.data.status,
      reason: parsed.data.reason ?? null,
      itemId: parsed.data.itemId ?? null,
      processedAt: terminal ? Math.floor(Date.now() / 1000) : null,
    })
    .where(eq(submissions.id, id))
    .returning()
    .get();

  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ submission });
}
