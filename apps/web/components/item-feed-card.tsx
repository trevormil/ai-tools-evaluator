import Link from "next/link";
import type { Item } from "@aix/db";
import { VerdictBadge } from "./verdict-badge";
import { VoteButtons } from "./vote-buttons";
import { RepostButton } from "./repost-button";
import { InlineReply } from "./inline-reply";
import { timeAgo } from "@/lib/format";

/**
 * A freshly published evaluation as a first-class timeline entry (ticket 0024):
 * same action row as a post so items are content, not just directory rows.
 */
export function ItemFeedCard({
  item,
  myVote,
  repostCount,
  reposted,
  signedIn,
}: {
  item: Item;
  myVote: number;
  repostCount: number;
  reposted: boolean;
  signedIn: boolean;
}) {
  return (
    <div className="card flex gap-3 p-4">
      <VoteButtons
        targetType="item"
        targetId={item.id}
        initialNet={item.upvotes}
        initialVote={myVote}
        signedIn={signedIn}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-faint">
          <span className="eyebrow !text-[10px]">Fresh evaluation</span>
          <span>· {timeAgo(item.createdAt)}</span>
        </div>
        <div className="mt-1 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/item/${item.slug}`} className="block hover:opacity-90">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold tracking-tight">{item.title}</span>
                <VerdictBadge verdict={item.verdict} />
                <span className="data text-xs font-bold">{item.overallScore}/100</span>
              </span>
              <span className="mt-1 line-clamp-2 block text-sm text-muted">{item.tagline}</span>
            </Link>
          </div>
          {item.coverImageUrl && (
            <Link href={`/item/${item.slug}`} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.coverImageUrl}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
                style={{ background: "var(--surface-2)" }}
              />
            </Link>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <Link href={`/item/${item.slug}`} className="hover:underline">
            {item.commentCount} comments
          </Link>
          <InlineReply itemId={item.id} signedIn={signedIn} />
          <RepostButton
            targetType="item"
            targetId={item.id}
            initialCount={repostCount}
            initialReposted={reposted}
            signedIn={signedIn}
          />
        </div>
      </div>
    </div>
  );
}
