import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, desc } from "drizzle-orm";
import { getDb, subscribers, items } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { sendEmail, renderDigestEmail, type DigestItem } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

const Body = z.object({ since: z.string().datetime().optional() }).optional();

/**
 * Send the daily digest to all `active` subscribers. Called by the newsletter
 * CronJob (internal, shared-secret). Sends per-subscriber so each email carries
 * its own unsubscribe token. No-op (still 200) when there are no new items.
 */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = Body.parse(await req.json().catch(() => ({})));
  const sinceSec = body?.since
    ? Math.floor(new Date(body.since).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 24 * 3600;

  const db = getDb();
  const newItems = db
    .select()
    .from(items)
    .where(
      and(
        eq(items.published, true),
        eq(items.scoreStatus, "scored"),
        gte(items.createdAt, sinceSec),
      ),
    )
    .orderBy(desc(items.overallScore))
    .all();

  if (newItems.length === 0) {
    return NextResponse.json({ sent: 0, items: 0, reason: "no new items" });
  }

  const digestItems: DigestItem[] = newItems.map((i) => ({
    slug: i.slug,
    title: i.title,
    verdict: i.verdict,
    overallScore: i.overallScore,
    tagline: i.tagline,
    category: i.category,
    coverImageUrl: i.coverImageUrl,
  }));

  const active = db.select().from(subscribers).where(eq(subscribers.status, "active")).all();

  let sent = 0;
  for (const sub of active) {
    const { subject, html } = renderDigestEmail(digestItems, sub.token);
    const res = await sendEmail({ to: sub.email, subject, html });
    if (res.ok) sent++;
  }

  return NextResponse.json({ sent, subscribers: active.length, items: newItems.length });
}
