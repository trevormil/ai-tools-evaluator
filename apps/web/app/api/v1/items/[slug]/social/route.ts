import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getItemBySlug, getItemComments, userVotes, type CommentNode } from "@/lib/queries";
import { listItemTakes, getMyStackEntryForItem } from "@/lib/takes";
import { itemStackSummary, useCountsFor } from "@/lib/item-social";
import { toPublicUser } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const CORS = { "access-control-allow-origin": "*" } as const;

type Params = { params: Promise<{ slug: string }> };

type PublicComment = {
  id: string;
  body: string;
  createdAt: number;
  upvotes: number;
  parentId: string | null;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
  children: PublicComment[];
};

function toPublicComments(nodes: CommentNode[]): PublicComment[] {
  return nodes.map((n) => ({
    id: n.comment.id,
    body: n.comment.body,
    createdAt: n.comment.createdAt,
    upvotes: n.comment.upvotes,
    parentId: n.comment.parentId,
    author: {
      username: n.author.username,
      displayName: n.author.displayName ?? null,
      avatarUrl: n.author.avatarUrl ?? null,
    },
    children: toPublicComments(n.children),
  }));
}

/**
 * The item page's social surface as JSON (ticket 0058): takes, the comment
 * thread, and use counts. Pending items are socially live — only unpublished
 * items 404. Viewer state (my vote, my stack entry) lights up with a bearer
 * token (ticket 0057).
 */
export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item || !item.published) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  const viewer = await getRequestUser(req);
  const takes = listItemTakes(item.id, viewer?.id).map((t) => ({
    id: t.id,
    status: t.status,
    rating: t.rating,
    take: t.take,
    updatedAt: t.updatedAt,
    followedByViewer: t.followedByViewer,
    user: toPublicUser(t.user),
  }));
  const summary = itemStackSummary(item.id);

  return NextResponse.json(
    {
      social: {
        takes,
        comments: toPublicComments(getItemComments(item.id)),
        useCount: useCountsFor([item.id])[item.id] ?? 0,
        byStatus: summary.byStatus,
        upvotes: item.upvotes,
        commentCount: item.commentCount,
      },
      viewer: viewer
        ? {
            vote: userVotes(viewer.id, "item")[item.id] ?? 0,
            commentVotes: userVotes(viewer.id, "comment"),
            stack: getMyStackEntryForItem(viewer.id, item.id) ?? null,
          }
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
