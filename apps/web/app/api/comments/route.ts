import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb, comments, items, posts } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

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
      db.update(items).set({ commentCount: sql`${items.commentCount} + 1` }).where(eq(items.id, input.itemId)).run();
    } else if (input.postId) {
      db.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, input.postId)).run();
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
