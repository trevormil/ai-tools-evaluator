import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { latestRecap } from "@/lib/recap";
import { getUnifiedFeed, type FeedMode } from "@/lib/home-feed";
import { FeedList } from "@/components/feed-list";
import { FeedTabs } from "@/components/feed-tabs";
import { VerdictBadge } from "@/components/verdict-badge";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Home is the Feed: today's pick up top, then the community activity feed —
 * new tools, takes, posts. The searchable catalog lives at /directory.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const mode: FeedMode = user && sp.feed === "following" ? "following" : "all";
  const feed = getUnifiedFeed(user, { mode, limit: 30 });
  const recap = latestRecap();
  const pick = recap?.leadPick;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Pick of the day — the anchor of the feed. */}
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-[0.12] blur-2xl"
          style={{ background: "var(--brand)" }}
          aria-hidden
        />
        <p className="eyebrow">Today&apos;s pick</p>
        {pick ? (
          <>
            <Link href={`/item/${pick.slug}`} className="mt-2 block hover:opacity-90">
              <h1 className="font-display text-xl font-black tracking-tight sm:text-2xl">
                {pick.title}
              </h1>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <VerdictBadge verdict={pick.verdict} />
              <span className="data text-xs text-faint">{pick.overallScore}/100</span>
              {recap && (
                <span className="data text-xs text-faint">· {recap.total} judged today</span>
              )}
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-xl text-sm text-muted">
            The daily pick lands the next time the scanner runs — one trending tool, harshly judged.
          </p>
        )}
      </section>

      {/* The community feed — new tools, takes, posts. */}
      <div>
        <p className="eyebrow mb-2">The feed</p>
        {user && (
          <div className="mb-4">
            <FeedTabs mode={mode} />
          </div>
        )}
        <FeedList key={mode} initial={feed} mode={mode} signedIn={!!user} />
      </div>
    </div>
  );
}
