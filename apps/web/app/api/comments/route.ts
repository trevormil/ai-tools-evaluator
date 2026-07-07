import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb, comments, items, posts } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { emitActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    body: z.string().trim().min(1).max(4000),
    itemId: z.string().optional().nullable(),
    postId: z.string().optional().nullable(),
    parentId: z.string().optional().nullable(),
  })
  .refine((b) => !!b.itemId !== !!b.postId, {
    message: "Provide exactly one of itemId or postId",
  });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = Body.parse(await req.json());
    const db = getDb();

    if (input.itemId) {
      const item = db.select({ id: items.id }).from(items).where(eq(items.id, input.itemId)).get();
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    } else if (input.postId) {
      const post = db.select({ id: posts.id }).from(posts).where(eq(posts.id, input.postId)).get();
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comment = db
      .insert(comments)
      .values({
        authorId: user.id,
        itemId: input.itemId ?? null,
        postId: input.postId ?? null,
        parentId: input.parentId ?? null,
        body: input.body,
      })
      .returning()
      .get();

    // Keep the denormalized comment counters honest.
    if (input.itemId) {
      db.update(items)
        .set({ commentCount: sql`${items.commentCount} + 1` })
        .where(eq(items.id, input.itemId))
        .run();
    } else if (input.postId) {
      db.update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, input.postId))
        .run();
    }

    // Feed activity + reply notification (best-effort).
    const objectType = input.postId ? "post" : "item";
    const objectId = (input.postId ?? input.itemId)!;
    emitActivity({ actorId: user.id, verb: "commented", objectType, objectId });

    // Notify whoever is being replied to: the parent comment's author, else the
    // post author, else the item's poster.
    let recipientId: string | null = null;
    if (input.parentId) {
      recipientId =
        db
          .select({ id: comments.authorId })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .get()?.id ?? null;
    } else if (input.postId) {
      recipientId =
        db.select({ id: posts.authorId }).from(posts).where(eq(posts.id, input.postId)).get()?.id ??
        null;
    } else if (input.itemId) {
      recipientId =
        db.select({ id: items.postedById }).from(items).where(eq(items.id, input.itemId)).get()
          ?.id ?? null;
    }
    if (recipientId)
      notify({ userId: recipientId, actorId: user.id, type: "reply", objectType, objectId });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
