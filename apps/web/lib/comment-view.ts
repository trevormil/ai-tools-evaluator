import type { CommentNode } from "./queries";
import type { CommentView } from "@/components/comment-thread";

/** Map server-side CommentNode trees into the plain, serializable view the
 *  client CommentThread renders, folding in the viewer's own vote per comment. */
export function toCommentViews(
  nodes: CommentNode[],
  myVotes: Record<string, number>,
): CommentView[] {
  return nodes.map((n) => ({
    id: n.comment.id,
    body: n.comment.body,
    upvotes: n.comment.upvotes,
    createdAt: n.comment.createdAt,
    authorUsername: n.author.username,
    authorAvatar: n.author.avatarUrl ?? null,
    myVote: myVotes[n.comment.id] ?? 0,
    children: toCommentViews(n.children, myVotes),
  }));
}
