import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { pickScore } from "@aix/core";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/**
 * Digest data for the bot. Two modes:
 *   - default: items created since `?since=` (the daily digest / top pick)
 *   - `?source=discord`: items that are Discord-requested submissions, SCORED
 *     since `?since=` — so the bot can echo each result back automatically.
 */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const source = url.searchParams.get("source");
  const sinceMs = sinceParam ? Date.parse(sinceParam) : NaN;
  const sinceSec = Number.isNaN(sinceMs) ? 0 : Math.floor(sinceMs / 1000);

  const cols = {
    slug: items.slug,
    title: items.title,
    url: items.url,
    verdict: items.verdict,
    overallScore: items.overallScore,
    noiseScore: items.noiseScore,
    tagline: items.tagline,
    category: items.category,
    primaryAudience: items.primaryAudience,
    aiEngineerFit: items.aiEngineerFit,
    coverImageUrl: items.coverImageUrl,
    evaluationJson: items.evaluationJson,
  };

  const rows =
    source === "discord"
      ? getDb()
          .select(cols)
          .from(items)
          .where(
            and(
              eq(items.published, true),
              eq(items.scoreStatus, "scored"),
              gte(items.scoredAt, sinceSec),
              sql`${items.url} IN (SELECT url FROM submissions WHERE source = 'discord' AND status = 'published')`,
            ),
          )
          .all()
      : getDb()
          .select(cols)
          .from(items)
          .where(
            and(
              eq(items.published, true),
              eq(items.scoreStatus, "scored"),
              gte(items.createdAt, sinceSec),
            ),
          )
          .all();

  // Surface the decision layer (install one-liner + adopt-if/skip-if) that lives
  // inside the stored Evaluation, so the digest can post a genuinely useful card.
  const enriched = rows.map(({ evaluationJson, ...rest }) => {
    let install: string | undefined;
    let adoptIf: string[] = [];
    let skipIf: string[] = [];
    let summary: string | undefined;
    // Broad-appeal pick score (audience fit + utility + traction + ease); the
    // bot features the highest, NOT the highest overallScore. Fall back to
    // overallScore for older items missing the audience/metric fields.
    let pick = rest.overallScore;
    try {
      const ev = JSON.parse(evaluationJson) as {
        quickstart?: { install?: string };
        decision?: { adoptIf?: string[]; skipIf?: string[] };
        body?: { whatItIs?: string };
        audience?: { aiEngineerFit?: number };
        scores?: Record<string, { score?: number }>;
      };
      install = ev.quickstart?.install;
      if (Array.isArray(ev.decision?.adoptIf)) adoptIf = ev.decision!.adoptIf;
      if (Array.isArray(ev.decision?.skipIf)) skipIf = ev.decision!.skipIf;
      // Plainspoken "what it is" — posted as the Discord message text.
      summary = ev.body?.whatItIs;
      const fit = ev.audience?.aiEngineerFit;
      const s = ev.scores;
      if (
        typeof fit === "number" &&
        typeof s?.utility?.score === "number" &&
        typeof s?.traction?.score === "number" &&
        typeof s?.easeOfAdoption?.score === "number" &&
        typeof s?.composability?.score === "number"
      ) {
        pick = pickScore({
          aiEngineerFit: fit,
          utility: s.utility.score,
          traction: s.traction.score,
          easeOfAdoption: s.easeOfAdoption.score,
          composability: s.composability.score,
        });
      }
    } catch {
      // Older items may predate the decision layer — degrade gracefully.
    }
    return { ...rest, install, adoptIf, skipIf, summary, pickScore: pick };
  });

  return NextResponse.json({ items: enriched });
}
