import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { createArticle } from "@/lib/articles";
import { emitActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  bodyMd: z.string().min(1).max(100_000),
  published: z.boolean().optional(),
});

/** Create a long-form article authored by the current user. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = CreateBody.parse(await req.json());
    const article = createArticle(user.id, body);
    if (article.published) {
      emitActivity({
        actorId: user.id,
        verb: "article_published",
        objectType: "article",
        objectId: article.id,
      });
    }
    return NextResponse.json({ article }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
