import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, submissions } from "@aix/db";
import { validateGithubRepoUrl } from "@aix/core";
import { getRequestUser, requireUser, Unauthorized } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { createPendingItem } from "@/lib/pending-items";
import { listSubmissionsByUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** The viewer's own submissions, newest first (the Submit screen's status list). */
export async function GET(req: Request) {
  try {
    const user = await getRequestUser(req);
    if (!user) throw new Unauthorized();
    return NextResponse.json({ submissions: listSubmissionsByUser(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

const Body = z.object({
  url: z.string().url().max(500),
  note: z.string().max(1000).optional(),
});

/**
 * Public (session-authed) link submission. The tool appears in the directory
 * IMMEDIATELY as a pending item ("Awaiting score…", ticket 0035) and a
 * `queued` row feeds the evaluation queue. Duplicates are PERSISTED as
 * `duplicate` rows with a reason (ticket 0028) so the submitter sees the
 * outcome instead of a silent no-op.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { url, note } = Body.parse(await req.json());

    // Safeguard: GitHub repos only, no reserved/non-repo pages.
    const check = validateGithubRepoUrl(url);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

    const db = getDb();

    const { item, existed } = createPendingItem(url, user.id);
    const duplicate = existed;

    const submission = db
      .insert(submissions)
      .values({
        url,
        note: note ?? null,
        source: "web",
        submittedById: user.id,
        status: duplicate ? "duplicate" : "queued",
        itemId: item.id,
        reason: duplicate
          ? item.scoreStatus === "pending"
            ? `Already submitted — “${item.title}” is awaiting evaluation (/item/${item.slug}).`
            : `Already catalogued as “${item.title}” (/item/${item.slug}).`
          : null,
      })
      .returning()
      .get();

    return NextResponse.json(
      { submission, duplicate, item: { slug: item.slug, title: item.title } },
      { status: duplicate ? 200 : 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
