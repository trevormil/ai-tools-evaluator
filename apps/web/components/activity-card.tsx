import Link from "next/link";
import type { FeedEntry, FeedEmbed } from "@/lib/home-feed";
import { VerdictBadge } from "./verdict-badge";
import { timeAgo } from "@/lib/format";

/**
 * An activity timeline entry: actor header line, optional quote, and — for
 * verbs with a real object (reposts, stack adds) — the object embedded as a
 * card instead of a dead one-line link (ticket 0024).
 */
export function ActivityCard({ entry }: { entry: Extract<FeedEntry, { kind: "activity" }> }) {
  const { actor, activity, label, href, quote, embed } = entry;
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        {actor.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actor.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] dark:bg-neutral-700">
            {actor.username.slice(0, 2)}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">
          <Link
            href={`/u/${actor.username}`}
            className="font-medium text-neutral-800 hover:underline dark:text-neutral-100"
          >
            @{actor.username}
          </Link>{" "}
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        </span>
        <span className="shrink-0 text-xs text-neutral-400">{timeAgo(activity.createdAt)}</span>
      </div>
      {quote && <p className="mt-2 whitespace-pre-wrap text-sm">{quote}</p>}
      {embed && <Embed embed={embed} />}
    </div>
  );
}

function Embed({ embed }: { embed: FeedEmbed }) {
  if (embed.type === "post") {
    return (
      <Link
        href={`/post/${embed.post.id}`}
        className="mt-2 block rounded-lg border p-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-xs font-medium text-muted">@{embed.author.username}</span>
        <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap">{embed.post.body}</span>
        {embed.item && (
          <span className="mt-1.5 block text-xs text-faint">
            ↳ {embed.item.title} · {embed.item.overallScore}/100
          </span>
        )}
      </Link>
    );
  }

  if (embed.type === "item") {
    return (
      <Link
        href={`/item/${embed.item.slug}`}
        className="mt-2 flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        style={{ borderColor: "var(--border)" }}
      >
        {embed.item.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={embed.item.coverImageUrl}
            alt=""
            className="h-10 w-10 rounded object-cover"
            style={{ background: "var(--surface-2)" }}
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{embed.item.title}</span>
            <VerdictBadge verdict={embed.item.verdict} />
          </span>
          <span className="line-clamp-1 block text-xs text-muted">{embed.item.tagline}</span>
        </span>
        <span className="data shrink-0 text-xs font-bold">{embed.item.overallScore}/100</span>
      </Link>
    );
  }

  // stack: the take is the content — show it like a mini review.
  const target = embed.item ? `/item/${embed.item.slug}` : undefined;
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs">
        <span className="chip">{embed.status}</span>
        <span className="truncate font-medium">{embed.item?.title ?? embed.toolName}</span>
        {embed.item && <span className="data text-faint">{embed.item.overallScore}/100</span>}
      </span>
      {embed.take && <span className="mt-1.5 block text-sm italic text-muted">“{embed.take}”</span>}
    </>
  );
  return target ? (
    <Link
      href={target}
      className="mt-2 block rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      style={{ borderColor: "var(--border)" }}
    >
      {body}
    </Link>
  ) : (
    <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      {body}
    </div>
  );
}
