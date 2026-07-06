import Link from "next/link";
import type { Post, Item, User } from "@aix/db";
import { VoteButtons } from "./vote-buttons";
import { RepostButton } from "./repost-button";
import { InlineReply } from "./inline-reply";
import { timeAgo } from "@/lib/format";

export function PostCard({
  post,
  author,
  item,
  myVote,
  signedIn,
  repostCount = 0,
  reposted = false,
}: {
  post: Post;
  author: User;
  item: Item | null;
  myVote: number;
  signedIn: boolean;
  repostCount?: number;
  reposted?: boolean;
}) {
  return (
    <div className="card flex gap-3 p-4">
      <VoteButtons
        targetType="post"
        targetId={post.id}
        initialNet={post.upvotes}
        initialVote={myVote}
        signedIn={signedIn}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Link
            href={`/u/${author.username}`}
            className="flex items-center gap-1 font-medium text-neutral-700 hover:underline dark:text-neutral-300"
          >
            {author.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
            )}
            @{author.username}
          </Link>
          <span>· {timeAgo(post.createdAt)}</span>
        </div>
        <Link
          href={`/post/${post.id}`}
          className="mt-1 block whitespace-pre-wrap text-sm hover:opacity-90"
        >
          {post.body}
        </Link>
        {item && (
          <Link
            href={`/item/${item.slug}`}
            className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-200 p-2 text-xs hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
          >
            {item.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverImageUrl} alt="" className="h-8 w-8 rounded object-cover" />
            )}
            <span className="font-medium">{item.title}</span>
            <span className="text-neutral-400">· {item.overallScore}/100</span>
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <Link href={`/post/${post.id}`} className="hover:underline">
            {post.commentCount} comments
          </Link>
          <InlineReply postId={post.id} signedIn={signedIn} />
          <RepostButton
            targetType="post"
            targetId={post.id}
            initialCount={repostCount}
            initialReposted={reposted}
            signedIn={signedIn}
          />
        </div>
      </div>
    </div>
  );
}
