import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, posts, items } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  body: z.string().trim().min(1).max(2000),
  itemId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = Body.parse(await req.json());

    let itemId: string | null = null;
    if (input.itemId) {
      const item = getDb().select({ id: items.id }).from(items).where(eq(items.id, input.itemId)).get();
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      itemId = item.id;
    }

    const post = getDb()
      .insert(posts)
      .values({ authorId: user.id, itemId, body: input.body })
      .returning()
      .get();

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
