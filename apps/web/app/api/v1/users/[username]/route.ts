import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { followCounts, getUserByUsername, isFollowing, listItemsByPoster } from "@/lib/queries";
import { getUserTakes } from "@/lib/takes";
import { getUserStack } from "@/lib/stack";
import { getUserActivity } from "@/lib/home-feed";
import { getProfileLinks } from "@/lib/profile-links";
import { toPublicItem, toPublicUser } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ username: string }> };

/**
 * Profile as JSON (ticket 0058): the /u/[username] page's data — user, links,
 * follow counts, takes, stack, activity, tools they brought in. Viewer follow
 * state lights up with a bearer token.
 */
export async function GET(req: Request, { params }: Params) {
  const { username } = await params;
  const user = getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  const viewer = await getRequestUser(req);
  const stack = getUserStack(user.id).map((e) => ({
    id: e.id,
    status: e.status,
    rating: e.rating,
    take: e.take,
    toolName: e.toolName,
    updatedAt: e.updatedAt,
    item: e.item
      ? {
          slug: e.item.slug,
          title: e.item.title,
          verdict: e.item.verdict,
          overallScore: e.item.overallScore,
          coverImageUrl: e.item.coverImageUrl,
        }
      : null,
  }));

  return NextResponse.json(
    {
      user: toPublicUser(user),
      links: getProfileLinks(user.id).map((l) => ({ kind: l.kind, url: l.url })),
      counts: followCounts(user.id),
      takes: getUserTakes(user.id),
      stack,
      activity: getUserActivity(user.id, 30),
      broughtIn: listItemsByPoster(user.id).map(toPublicItem),
      viewer: viewer
        ? { following: isFollowing(viewer.id, user.id), self: viewer.id === user.id }
        : null,
    },
    { headers: CORS },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
    },
  });
}
