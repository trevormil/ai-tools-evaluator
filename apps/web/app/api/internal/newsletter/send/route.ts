import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, subscribers } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { sendEmail, renderRecapEmail, type RecapEmail } from "@/lib/newsletter";
import { getRecap, latestRecapDate, recapDateLabel, verdictSummary } from "@/lib/recap";
import { parseEvaluation } from "@/lib/queries";

export const dynamic = "force-dynamic";

const Body = z.object({ date: z.string().optional() }).optional();

/** First sentence of the devil's-advocate section — the email hook. */
function hook(evaluationJson: string): string | null {
  try {
    const ev = JSON.parse(evaluationJson) as { body?: { devilsAdvocate?: string } };
    const da = ev.body?.devilsAdvocate;
    if (!da) return null;
    const m = da.match(/^.*?[.!?](\s|$)/);
    return (m ? m[0] : da).trim();
  } catch {
    return null;
  }
}

/**
 * Send the nightly recap to all `active` subscribers (ticket 0040). Called by
 * the recap CronJob (internal, shared-secret). Per-subscriber so each email
 * carries its own unsubscribe token. No-op (still 200) when nothing was judged.
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = Body.parse(await req.json().catch(() => ({})));
  const date = body?.date ?? latestRecapDate();
  const recap = date ? getRecap(date) : null;

  if (!recap) {
    return NextResponse.json({ sent: 0, items: 0, reason: "no recap for date" });
  }

  const install = (item: { scoreStatus: string; evaluationJson: string }): string | null => {
    if (item.scoreStatus !== "scored") return null;
    try {
      return parseEvaluation(item as never).quickstart?.install ?? null;
    } catch {
      return null;
    }
  };

  const emailData: RecapEmail = {
    date: recap.date,
    dateLabel: recapDateLabel(recap.date),
    summary: verdictSummary(recap.verdictCounts),
    items: recap.items.map((i) => ({
      slug: i.slug,
      title: i.title,
      verdict: i.verdict,
      overallScore: i.overallScore,
      tagline: i.tagline,
      category: i.category,
      coverImageUrl: i.coverImageUrl,
      install: install(i),
    })),
    lead: recap.leadPick
      ? {
          slug: recap.leadPick.slug,
          title: recap.leadPick.title,
          verdict: recap.leadPick.verdict,
          overallScore: recap.leadPick.overallScore,
          tagline: recap.leadPick.tagline,
          category: recap.leadPick.category,
          coverImageUrl: recap.leadPick.coverImageUrl,
          hook: hook(recap.leadPick.evaluationJson),
        }
      : null,
    trap: recap.complexityTrap
      ? {
          slug: recap.complexityTrap.slug,
          title: recap.complexityTrap.title,
          verdict: recap.complexityTrap.verdict,
          overallScore: recap.complexityTrap.overallScore,
          tagline: recap.complexityTrap.tagline,
          category: recap.complexityTrap.category,
          coverImageUrl: recap.complexityTrap.coverImageUrl,
          hook: hook(recap.complexityTrap.evaluationJson),
        }
      : null,
    topAdopted: recap.topAdopted.map((i) => ({ slug: i.slug, title: i.title, uses: i.uses })),
  };

  const active = getDb().select().from(subscribers).where(eq(subscribers.status, "active")).all();

  let sent = 0;
  for (const sub of active) {
    const { subject, html } = renderRecapEmail(emailData, sub.token);
    const res = await sendEmail({ to: sub.email, subject, html });
    if (res.ok) sent++;
  }

  return NextResponse.json({
    sent,
    subscribers: active.length,
    items: recap.total,
    date: recap.date,
  });
}
