import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { updateArticle, deleteArticle } from "@/lib/articles";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const PatchBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    bodyMd: z.string().min(1).max(100_000).optional(),
    published: z.boolean().optional(),
  })
  .refine((b) => b.title !== undefined || b.bodyMd !== undefined || b.published !== undefined, {
    message: "Nothing to update",
  });

/** Update an article — author only. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const patch = PatchBody.parse(await req.json());
    const article = updateArticle(user.id, slug, patch);
    if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete an article — author only. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { slug } = await ctx.params;
    const ok = deleteArticle(user.id, slug);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
