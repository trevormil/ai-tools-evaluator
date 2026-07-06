import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, items, posts, comments } from "@aix/db";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  type: z.enum(["item", "post"]),
  id: z.string().min(1),
});

/**
 * Moderator hide action. Guarded by role (admin/mod).
 *  - item: toggles `items.published`. Unpublished items vanish from every public
 *    query (all list queries filter published=true) but the row is preserved.
 *  - post: removes the post and its comments (FK-safe). Posts have no soft-hide
 *    column, so removal is the mod lever.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "mod")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { type, id } = Body.parse(await req.json());
    const db = getDb();

    if (type === "item") {
      const item = db.select({ published: items.published }).from(items).where(eq(items.id, id)).get();
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const published = !item.published;
      db.update(items).set({ published }).where(eq(items.id, id)).run();
      return NextResponse.json({ ok: true, type, id, published });
    }

    const post = db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).get();
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    db.delete(comments).where(eq(comments.postId, id)).run();
    db.delete(posts).where(eq(posts.id, id)).run();
    return NextResponse.json({ ok: true, type, id, removed: true });
  } catch (err) {
    return errorResponse(err);
  }
}
