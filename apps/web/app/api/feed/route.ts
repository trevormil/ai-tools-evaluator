import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getUnifiedFeed, type FeedMode } from "@/lib/home-feed";

export const dynamic = "force-dynamic";

/** Timeline pages for the client feed (ticket 0024; bearer viewers via 0057). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const viewer = await getRequestUser(req);
  const mode: FeedMode =
    url.searchParams.get("mode") === "following" && viewer ? "following" : "all";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 30;

  return NextResponse.json(getUnifiedFeed(viewer, { mode, cursor, limit }));
}
