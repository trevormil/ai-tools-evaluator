import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, submissions } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().url().max(500),
  note: z.string().max(1000).optional(),
});

/** Public (session-authed) link submission → inserts a `queued` row for the scanner. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { url, note } = Body.parse(await req.json());
    const db = getDb();

    // Dedup: if the same URL is already pending, don't enqueue a second copy.
    const existing = db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.url, url), inArray(submissions.status, ["queued", "processing"])))
      .get();
    if (existing) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }

    const submission = db
      .insert(submissions)
      .values({ url, note: note ?? null, source: "web", submittedById: user.id, status: "queued" })
      .returning()
      .get();

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
