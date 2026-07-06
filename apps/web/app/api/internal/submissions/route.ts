import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, submissions } from "@aix/db";
import { isInternalAuthorized } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

const SUB_STATUSES = [
  "queued",
  "processing",
  "published",
  "duplicate",
  "rejected",
  "failed",
] as const;

/** List submissions (default queued, oldest-first — the scanner's drain order). */
export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "queued";
  const status = (SUB_STATUSES as readonly string[]).includes(statusParam) ? statusParam : "queued";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);

  const rows = getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.status, status as (typeof SUB_STATUSES)[number]))
    .orderBy(asc(submissions.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ submissions: rows });
}

const PostBody = z.object({
  url: z.string().url().max(500),
  note: z.string().max(1000).optional(),
  source: z.enum(["discord", "api"]),
  discordUserId: z.string().optional(),
});

/** Enqueue a link (Discord `/submit`). Dedups obvious repeats. */
export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { url, note, source, discordUserId } = parsed.data;
  const db = getDb();

  const existing = db
    .select({ id: submissions.id })
    .from(submissions)
    .where(and(eq(submissions.url, url), inArray(submissions.status, ["queued", "processing"])))
    .get();
  if (existing) return NextResponse.json({ duplicate: true }, { status: 200 });

  const submission = db
    .insert(submissions)
    .values({
      url,
      note: note ?? null,
      source,
      discordUserId: discordUserId ?? null,
      status: "queued",
    })
    .returning()
    .get();

  return NextResponse.json({ submission }, { status: 201 });
}
