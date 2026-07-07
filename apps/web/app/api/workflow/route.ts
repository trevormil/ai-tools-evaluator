import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { setWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const PutBody = z
  .object({
    url: z.string().trim().url().max(2000).nullish(),
    articleId: z.string().trim().nullish(),
  })
  .refine((b) => !(b.url && b.articleId), { message: "Provide a url OR an articleId, not both" });

/** Set or clear the current user's "My Workflow" (self-only). */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = PutBody.parse(await req.json());
    const updated = setWorkflow(user.id, body);
    if (!updated) return NextResponse.json({ error: "Article not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
