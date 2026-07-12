"use client";

import { useState } from "react";
import type { FeedEntry, FeedMode, FeedPage } from "@/lib/home-feed";
import { PostCard } from "./post-card";
import { ItemFeedCard } from "./item-feed-card";
import { ActivityCard } from "./activity-card";

/** Client copy of lib/home-feed's feedEntryKey — the lib itself is server-only (better-sqlite3). */
function keyOf(e: FeedEntry): string {
  if (e.kind === "post") return `post:${e.post.id}`;
  if (e.kind === "item") return `item:${e.item.id}`;
  return `act:${e.activity.id}`;
}

/**
 * The timeline (ticket 0024): renders a server-provided first page, then
 * appends further pages from /api/feed on "Load more" (cursor-based, deduped).
 */
export function FeedList({
  initial,
  mode,
  signedIn,
}: {
  initial: FeedPage;
  mode: FeedMode;
  signedIn: boolean;
}) {
  const [entries, setEntries] = useState<FeedEntry[]>(initial.entries);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [busy, setBusy] = useState(false);

  async function loadMore() {
    if (busy || !cursor) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/feed?mode=${mode}&cursor=${encodeURIComponent(cursor)}&limit=30`,
      );
      if (!res.ok) return;
      const page = (await res.json()) as FeedPage;
      const seen = new Set(entries.map(keyOf));
      setEntries([...entries, ...page.entries.filter((e) => !seen.has(keyOf(e)))]);
      setCursor(page.nextCursor);
    } finally {
      setBusy(false);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-neutral-500">
        {mode === "following"
          ? "Nobody you follow has been active yet. Follow a few people — or switch to Everything."
          : "Nothing here yet. Post something to get the feed going."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) =>
        entry.kind === "post" ? (
          <PostCard
            key={keyOf(entry)}
            post={entry.post}
            author={entry.author}
            item={entry.item}
            myVote={entry.myVote}
            signedIn={signedIn}
            repostCount={entry.repostCount}
            reposted={entry.reposted}
          />
        ) : entry.kind === "item" ? (
          <ItemFeedCard
            key={keyOf(entry)}
            item={entry.item}
            myVote={entry.myVote}
            repostCount={entry.repostCount}
            reposted={entry.reposted}
            signedIn={signedIn}
          />
        ) : (
          <ActivityCard key={keyOf(entry)} entry={entry} />
        ),
      )}
      {cursor && (
        <button onClick={loadMore} disabled={busy} className="btn-ghost self-center">
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
