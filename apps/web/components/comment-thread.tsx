"use client";

import { useState } from "react";
import Link from "next/link";
import { VoteButtons } from "./vote-buttons";
import { CommentForm } from "./comment-form";
import { timeAgo } from "@/lib/format";

/** Plain serializable comment node (server maps CommentNode → this). */
export type CommentView = {
  id: string;
  body: string;
  upvotes: number;
  createdAt: number;
  authorUsername: string;
  authorAvatar: string | null;
  myVote: number;
  children: CommentView[];
};

type ThreadProps = {
  comments: CommentView[];
  itemId?: string;
  postId?: string;
  signedIn: boolean;
};

export function CommentThread({ comments, itemId, postId, signedIn }: ThreadProps) {
  if (!comments.length) {
    return <p className="text-sm text-neutral-500">No comments yet. Be the first.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          node={c}
          itemId={itemId}
          postId={postId}
          signedIn={signedIn}
          depth={0}
        />
      ))}
    </div>
  );
}

function CommentItem({
  node,
  itemId,
  postId,
  signedIn,
  depth,
}: {
  node: CommentView;
  itemId?: string;
  postId?: string;
  signedIn: boolean;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className={depth > 0 ? "border-l border-neutral-200 pl-3 dark:border-neutral-800" : ""}>
      <div className="flex gap-2">
        <VoteButtons
          targetType="comment"
          targetId={node.id}
          initialNet={node.upvotes}
          initialVote={node.myVote}
          signedIn={signedIn}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Link
              href={`/u/${node.authorUsername}`}
              className="font-medium text-neutral-700 hover:underline dark:text-neutral-300"
            >
              @{node.authorUsername}
            </Link>
            <span>· {timeAgo(node.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{node.body}</p>
          <button
            onClick={() => setReplying((v) => !v)}
            className="mt-1 text-xs text-neutral-500 hover:underline"
          >
            {replying ? "Cancel" : "Reply"}
          </button>
          {replying && (
            <div className="mt-2">
              <CommentForm
                itemId={itemId}
                postId={postId}
                parentId={node.id}
                signedIn={signedIn}
                compact
                onDone={() => setReplying(false)}
              />
            </div>
          )}
          {node.children.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {node.children.map((child) => (
                <CommentItem
                  key={child.id}
                  node={child}
                  itemId={itemId}
                  postId={postId}
                  signedIn={signedIn}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
