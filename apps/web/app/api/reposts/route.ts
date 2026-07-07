import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, reposts, posts, items } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { emitActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { repostCount } from "@/lib/reposts";

export const dynamic = "force-dynamic";

const Body = z.object({
  targetType: z.enum(["post", "item"]),
  targetId: z.string().min(1),
  quote: z.string().trim().max(2000).optional().nullable(),
});

/** Resolve the original author of a repost target, for notification. */
function targetAuthorId(targetType: "post" | "item", targetId: string): string | null {
  const db = getDb();
  if (targetType === "post") {
    return (
      db.select({ id: posts.authorId }).from(posts).where(eq(posts.id, targetId)).get()?.id ?? null
    );
  }
  return (
    db.select({ id: items.postedById }).from(items).where(eq(items.id, targetId)).get()?.id ?? null
  );
}

/** Toggle a repost of a post|item. Returns the resulting state + count. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { targetType, targetId, quote } = Body.parse(await req.json());
    const db = getDb();

    const authorId = targetAuthorId(targetType, targetId);
    if (authorId === null && targetType === "post") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existing = db
      .select()
      .from(reposts)
      .where(
        and(
          eq(reposts.userId, user.id),
          eq(reposts.targetType, targetType),
          eq(reposts.targetId, targetId),
        ),
      )
      .get();

    if (existing) {
      db.delete(reposts).where(eq(reposts.id, existing.id)).run();
      return NextResponse.json({ reposted: false, count: repostCount(targetType, targetId) });
    }

    db.insert(reposts)
      .values({ userId: user.id, targetType, targetId, quote: quote ?? null })
      .run();
    emitActivity({
      actorId: user.id,
      verb: "reposted",
      objectType: targetType,
      objectId: targetId,
    });
    if (authorId)
      notify({
        userId: authorId,
        actorId: user.id,
        type: "repost",
        objectType: targetType,
        objectId: targetId,
      });

    return NextResponse.json(
      { reposted: true, count: repostCount(targetType, targetId) },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}

const DeleteBody = z.object({
  targetType: z.enum(["post", "item"]),
  targetId: z.string().min(1),
});

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { targetType, targetId } = DeleteBody.parse(await req.json());
    getDb()
      .delete(reposts)
      .where(
        and(
          eq(reposts.userId, user.id),
          eq(reposts.targetType, targetType),
          eq(reposts.targetId, targetId),
        ),
      )
      .run();
    return NextResponse.json({ reposted: false, count: repostCount(targetType, targetId) });
  } catch (err) {
    return errorResponse(err);
  }
}
