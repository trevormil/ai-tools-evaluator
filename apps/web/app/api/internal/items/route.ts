import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { Evaluation, computeOverall } from "@aix/core";
import { getDb, items, submissions } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { hotScore } from "@/lib/ranking";
import { pickCover } from "@/lib/covers";
import { rescoreState } from "@/lib/rescore";

export const dynamic = "force-dynamic";

const Body = z.object({
  evaluation: Evaluation,
  submissionId: z.string().optional(),
  /** The repo's own README (markdown) — displayed alongside the evaluation. */
  readmeMd: z.string().max(200_000).optional(),
  /**
   * Trending only: is this THE featured daily pick? Defaults to true so a lone
   * trending publish (the legacy 1/day path) still stamps the pick. In a
   * multi-publish batch the scanner sends true for the top-scored item and false
   * for the runners-up. Ignored for submissions (never picks).
   */
  dailyPick: z.boolean().optional(),
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
  const { evaluation, submissionId, readmeMd, dailyPick } = parsed.data;
  const db = getDb();

  const kind = evaluation.source.kind;
  const externalId = evaluation.source.externalId;

  // Idempotency: an already-SCORED duplicate returns the existing item, no
  // insert. A PENDING item (instant community submission, ticket 0035) is
  // upgraded in place — same row id and slug, so its comments/takes/votes
  // survive the evaluation landing. A scored item with a PENDING RESCORE
  // request (rescoreRequestedAt newer than scoredAt) is likewise re-evaluated
  // in place below instead of being treated as a duplicate.
  const existing = db
    .select()
    .from(items)
    .where(and(eq(items.kind, kind), eq(items.externalId, externalId)))
    .get();
  if (existing && existing.scoreStatus !== "pending") {
    const rescorePending = rescoreState(existing, Math.floor(Date.now() / 1000)).pending;
    if (!rescorePending) {
      if (submissionId) markSubmissionPublished(submissionId, existing.id);
      return NextResponse.json({ duplicate: true, item: existing }, { status: 200 });
    }
  }

  const overallScore = computeOverall(evaluation.scores);
  const stored = { ...evaluation, overallScore };
  // Best displayable image from the media set (personal avatars, social
  // cards, placeholders and SVGs skipped) — null → monogram tile (0073).
  const coverUrl = await pickCover(evaluation.media);
  const cover = coverUrl != null;
  const nowSec = Math.floor(Date.now() / 1000);
  // Exactly ONE trending publish per day is the featured daily pick (dailyPickAt
  // set); the scanner's other batch publishes are runners-up (dailyPick=false →
  // null), matching the schema contract. `dailyPick` defaults to true so the
  // legacy lone-trending publish still stamps the pick. Submissions are never
  // picks. The Discord/home pick is chosen by highest overallScore, which agrees
  // with the stamped item since the scanner stamps the top-scored one.
  const dailyPickAt = submissionId ? undefined : (dailyPick ?? true) ? nowSec : undefined;

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
        coverImageUrl: coverUrl ?? existing.coverImageUrl,
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
      coverImageUrl: coverUrl,
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
