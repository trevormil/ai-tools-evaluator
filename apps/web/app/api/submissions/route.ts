import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, items, submissions } from "@aix/db";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().url().max(500),
  note: z.string().max(1000).optional(),
});

/**
 * Public (session-authed) link submission → inserts a `queued` row for the
 * scanner. Duplicates are PERSISTED as `duplicate` rows with a reason (ticket
 * 0028) so the submitter sees the outcome instead of a silent no-op.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { url, note } = Body.parse(await req.json());
    const db = getDb();

    // Already catalogued? Point at the existing evaluation.
    const catalogued = db
      .select({ slug: items.slug, title: items.title })
      .from(items)
      .where(eq(items.url, url))
      .get();
    // Already pending? Don't enqueue a second copy.
    const pending = catalogued
      ? undefined
      : db
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(eq(submissions.url, url), inArray(submissions.status, ["queued", "processing"])),
          )
          .get();

    const duplicate = !!catalogued || !!pending;
    const submission = db
      .insert(submissions)
      .values({
        url,
        note: note ?? null,
        source: "web",
        submittedById: user.id,
        status: duplicate ? "duplicate" : "queued",
        reason: catalogued
          ? `Already catalogued as “${catalogued.title}” (/item/${catalogued.slug}).`
          : pending
            ? "This URL is already in the queue."
            : null,
      })
      .returning()
      .get();

    return NextResponse.json({ submission, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
