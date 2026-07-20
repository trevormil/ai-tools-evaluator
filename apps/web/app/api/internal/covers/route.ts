import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { sanitizeCoverUrl } from "@/lib/covers";

export const dynamic = "force-dynamic";

/**
 * One-time-ish backfill (ticket 0073): null out existing covers that are
 * personal-account avatars or placehold.co placeholders. Idempotent — rerun
 * whenever. Internal-only (single-writer: this pod owns the DB).
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const rows = db
    .select({ id: items.id, slug: items.slug, coverImageUrl: items.coverImageUrl })
    .from(items)
    .all();

  const cleared: string[] = [];
  for (const row of rows) {
    if (!row.coverImageUrl) continue;
    const sanitized = await sanitizeCoverUrl(row.coverImageUrl);
    if (sanitized === null) {
      db.update(items).set({ coverImageUrl: null }).where(eq(items.id, row.id)).run();
      cleared.push(row.slug);
    }
  }

  return NextResponse.json({ scanned: rows.length, cleared: cleared.length, slugs: cleared });
}
