import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { STACK_STATUS_LABELS, type StackStatus } from "@/lib/stack-types";

/**
 * One take (ticket 0036): @user's blurb on a tool. `tool` renders the item
 * chip for contexts away from the item page (profiles, feed).
 */
export function TakeCard({
  username,
  avatarUrl,
  status,
  rating,
  take,
  updatedAt,
  followedByViewer = false,
  tool,
}: {
  username: string;
  avatarUrl: string | null;
  status: string;
  rating: number | null;
  take: string;
  updatedAt: number;
  followedByViewer?: boolean;
  tool?: { slug: string | null; title: string; coverImageUrl: string | null } | null;
}) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-bold dark:bg-neutral-700">
            {username.slice(0, 2).toUpperCase()}
          </span>
        )}
        <Link
          href={`/u/${username}`}
          className="font-semibold text-neutral-800 hover:underline dark:text-neutral-100"
        >
          @{username}
        </Link>
        <span className="text-faint">&apos;s take</span>
        {followedByViewer && <span className="chip !text-brand">following</span>}
        <span className="ml-auto shrink-0 text-neutral-400">{timeAgo(updatedAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{take}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="chip">{STACK_STATUS_LABELS[status as StackStatus] ?? status}</span>
        {rating != null && <span className="chip">{"★".repeat(rating)}</span>}
        {tool && (
          <Link
            href={tool.slug ? `/item/${tool.slug}` : "#"}
            className="ml-auto flex min-w-0 items-center gap-1.5 text-muted hover:text-brand"
          >
            {tool.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.coverImageUrl} alt="" className="h-4 w-4 rounded object-cover" />
            )}
            <span className="truncate">{tool.title}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
