import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPost, getPostComments, userVotes } from "@/lib/queries";
import { toCommentViews } from "@/lib/comment-view";
import { PostCard } from "@/components/post-card";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function PostPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = getPost(id);
  if (!data) notFound();

  const user = await getCurrentUser();
  const myPostVote = user ? userVotes(user.id, "post")[data.post.id] ?? 0 : 0;
  const myCommentVotes = user ? userVotes(user.id, "comment") : {};
  const comments = toCommentViews(getPostComments(data.post.id), myCommentVotes);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PostCard post={data.post} author={data.author} item={data.item} myVote={myPostVote} signedIn={!!user} />
      <div className="card p-4">
        <CommentForm postId={data.post.id} signedIn={!!user} />
      </div>
      <CommentThread comments={comments} postId={data.post.id} signedIn={!!user} />
    </div>
  );
}
