import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { Evaluation, computeOverall } from "@aix/core";
import { getDb, items, submissions } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { hotScore } from "@/lib/ranking";

export const dynamic = "force-dynamic";

const Body = z.object({
  evaluation: Evaluation,
  submissionId: z.string().optional(),
  /** The repo's own README (markdown) — displayed alongside the evaluation. */
  readmeMd: z.string().max(200_000).optional(),
});

/**
 * Publish an evaluated item. Idempotent on (kind, externalId). `overallScore` is
 * recomputed from the scorecard so the DB can never drift from the weights.
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid evaluation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { evaluation, submissionId, readmeMd } = parsed.data;
  const db = getDb();

  const kind = evaluation.source.kind;
  const externalId = evaluation.source.externalId;

  // Idempotency: an already-SCORED duplicate returns the existing item, no
  // insert. A PENDING item (instant community submission, ticket 0035) is
  // upgraded in place — same row id and slug, so its comments/takes/votes
  // survive the evaluation landing.
  const existing = db
    .select()
    .from(items)
    .where(and(eq(items.kind, kind), eq(items.externalId, externalId)))
    .get();
  if (existing && existing.scoreStatus !== "pending") {
    if (submissionId) markSubmissionPublished(submissionId, existing.id);
    return NextResponse.json({ duplicate: true, item: existing }, { status: 200 });
  }

  const overallScore = computeOverall(evaluation.scores);
  const stored = { ...evaluation, overallScore };
  const cover = evaluation.media.find((m) => m.type === "image");
  const nowSec = Math.floor(Date.now() / 1000);
  // A trending publish (no submissionId) IS the daily pick — stamp it so the
  // daily-pick budget counts real picks (not seed rows / submissions) and the
  // repo is never re-featured (ticket 0043). Submissions are never picks.
  const dailyPickAt = submissionId ? undefined : nowSec;

  if (existing) {
    const upgraded = db
      .update(items)
      .set({
        // slug intentionally kept — permalinks to the pending page stay valid.
        url: evaluation.source.url,
        title: evaluation.source.title,
        category: evaluation.category,
        integration: evaluation.integration,
        verdict: evaluation.verdict,
        primaryAudience: evaluation.audience.primary,
        aiEngineerFit: evaluation.audience.aiEngineerFit,
        vibeCoderFit: evaluation.audience.vibeCoderFit,
        overallScore,
        noiseScore: evaluation.noiseScore,
        tagline: evaluation.tagline,
        tagsJson: JSON.stringify(evaluation.tags),
        evaluationJson: JSON.stringify(stored),
        mediaJson: JSON.stringify(evaluation.media),
        coverImageUrl: cover ? (cover.cachedUrl ?? cover.url) : existing.coverImageUrl,
        evaluatedBy: evaluation.evaluatedBy,
        readmeMd: readmeMd ?? existing.readmeMd,
        model: evaluation.model ?? null,
        scoreStatus: "scored",
        scoredAt: nowSec, // judged now — the pending→scored transition (ticket 0040)
        // Preserve any prior pick stamp; a trending re-publish of a pending row
        // features it now. Submissions leave it untouched.
        dailyPickAt: dailyPickAt ?? existing.dailyPickAt,
        score: hotScore(existing.upvotes, existing.createdAt),
      })
      .where(eq(items.id, existing.id))
      .returning()
      .get();
    if (submissionId) markSubmissionPublished(submissionId, upgraded.id);
    return NextResponse.json({ item: upgraded, upgraded: true }, { status: 200 });
  }

  const item = db
    .insert(items)
    .values({
      slug: evaluation.slug,
      kind,
      externalId,
      url: evaluation.source.url,
      title: evaluation.source.title,
      category: evaluation.category,
      integration: evaluation.integration,
      verdict: evaluation.verdict,
      primaryAudience: evaluation.audience.primary,
      aiEngineerFit: evaluation.audience.aiEngineerFit,
      vibeCoderFit: evaluation.audience.vibeCoderFit,
      overallScore,
      noiseScore: evaluation.noiseScore,
      tagline: evaluation.tagline,
      tagsJson: JSON.stringify(evaluation.tags),
      evaluationJson: JSON.stringify(stored),
      mediaJson: JSON.stringify(evaluation.media),
      coverImageUrl: cover ? (cover.cachedUrl ?? cover.url) : null,
      evaluatedBy: evaluation.evaluatedBy,
      readmeMd: readmeMd ?? null,
      model: evaluation.model ?? null,
      published: true,
      scoredAt: nowSec, // scanner-discovered items are born judged (ticket 0040)
      dailyPickAt, // set for a trending pick, undefined (→ null) for submissions
      score: hotScore(0, nowSec),
      createdAt: nowSec,
    })
    .returning()
    .get();

  if (submissionId) markSubmissionPublished(submissionId, item.id);

  return NextResponse.json({ item }, { status: 201 });
}

function markSubmissionPublished(submissionId: string, itemId: string): void {
  getDb()
    .update(submissions)
    .set({ status: "published", itemId, processedAt: Math.floor(Date.now() / 1000) })
    .where(eq(submissions.id, submissionId))
    .run();
}
