import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { pickCover } from "@/lib/covers";

export const dynamic = "force-dynamic";

/**
 * Cover backfill (ticket 0073): recompute every item's cover from its media
 * via pickCover — junk (personal avatars, placeholders, social cards, SVGs)
 * cleared, real README imagery promoted. Idempotent; internal-only.
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const rows = db
    .select({
      id: items.id,
      slug: items.slug,
      coverImageUrl: items.coverImageUrl,
      mediaJson: items.mediaJson,
    })
    .from(items)
    .all();

  const changed: { slug: string; cover: string | null }[] = [];
  for (const row of rows) {
    let media: unknown[] = [];
    try {
      media = JSON.parse(row.mediaJson ?? "[]");
    } catch {
      media = [];
    }
    const next = pickCover(media as Parameters<typeof pickCover>[0]);
    if (next !== (row.coverImageUrl ?? null)) {
      db.update(items).set({ coverImageUrl: next }).where(eq(items.id, row.id)).run();
      changed.push({ slug: row.slug, cover: next });
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    changed: changed.length,
    promoted: changed.filter((c) => c.cover !== null).length,
    cleared: changed.filter((c) => c.cover === null).length,
    changes: changed,
  });
}
