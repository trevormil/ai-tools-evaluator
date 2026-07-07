import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { getDb, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

/** Items published since `?since=<iso>` — data for the bot's daily digest. */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sinceParam = new URL(req.url).searchParams.get("since");
  const sinceMs = sinceParam ? Date.parse(sinceParam) : NaN;
  const sinceSec = Number.isNaN(sinceMs) ? 0 : Math.floor(sinceMs / 1000);

  const rows = getDb()
    .select({
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
    })
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
    try {
      const ev = JSON.parse(evaluationJson) as {
        quickstart?: { install?: string };
        decision?: { adoptIf?: string[]; skipIf?: string[] };
      };
      install = ev.quickstart?.install;
      if (Array.isArray(ev.decision?.adoptIf)) adoptIf = ev.decision!.adoptIf;
      if (Array.isArray(ev.decision?.skipIf)) skipIf = ev.decision!.skipIf;
    } catch {
      // Older items may predate the decision layer — degrade gracefully.
    }
    return { ...rest, install, adoptIf, skipIf };
  });

  return NextResponse.json({ items: enriched });
}
