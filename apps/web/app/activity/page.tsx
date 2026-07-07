import { getCurrentUser } from "@/lib/auth";
import { getUnifiedFeed, type FeedMode } from "@/lib/home-feed";
import { FeedList } from "@/components/feed-list";
import { FeedTabs } from "@/components/feed-tabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The community timeline — a secondary surface in the directory-first pivot
 * (ticket 0032). The directory is home; this is where the talk lives.
 */
export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const mode: FeedMode = user && sp.feed === "following" ? "following" : "all";
  const page = getUnifiedFeed(user, { mode, limit: 30 });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <p className="eyebrow">Activity</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          New tools, new takes.
        </h1>
        <p className="mt-1 text-sm text-muted">
          Fresh evaluations and what the people running them actually think. Add your own take from
          any tool page.
        </p>
      </div>
      {user && <FeedTabs mode={mode} />}
      <FeedList key={mode} initial={page} mode={mode} signedIn={!!user} />
    </div>
  );
}
