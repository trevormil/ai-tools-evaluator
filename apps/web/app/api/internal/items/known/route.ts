import { NextResponse } from "next/server";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

const Body = z.object({
  candidates: z
    .array(z.object({ kind: z.string().min(1), externalId: z.string().min(1) }))
    .max(200),
});

/**
 * Pre-eval dedup. Given discovery candidates, return the externalIds already in
 * the catalog with a real score, so the scanner can skip re-grading them (and
 * never re-pick them as the daily trending pick). Pending community submissions
 * are deliberately NOT "known" — discovering one lets the scan fill it in.
 */
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
  const { candidates } = parsed.data;
  if (candidates.length === 0) return NextResponse.json({ known: [] });

  const db = getDb();
  const rows = db
    .select({ externalId: items.externalId, kind: items.kind, scoreStatus: items.scoreStatus })
    .from(items)
    .where(
      inArray(
        items.externalId,
        candidates.map((c) => c.externalId),
      ),
    )
    .all();

  const wanted = new Set(candidates.map((c) => `${c.kind}:${c.externalId}`));
  const known = [
    ...new Set(
      rows
        .filter((r) => r.scoreStatus !== "pending" && wanted.has(`${r.kind}:${r.externalId}`))
        .map((r) => r.externalId),
    ),
  ];
  return NextResponse.json({ known });
}
