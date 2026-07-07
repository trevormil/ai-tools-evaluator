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
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="https://discord.gg/Xc2yyrwDv"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex shrink-0 items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.369A19.79 19.79 0 0016.558 3.2a.074.074 0 00-.079.037c-.34.607-.717 1.4-.98 2.02a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.997-2.02.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C1.144 8.09.532 11.71.833 15.284a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.099.246.198.373.292a.077.077 0 01-.006.127c-.598.35-1.22.645-1.873.892a.076.076 0 00-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.055c.5-4.154-.838-7.741-3.549-10.939a.06.06 0 00-.031-.028zM8.02 13.05c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
            </svg>
            Join the Discord
          </a>
          <Link href="/directory" className="btn-ghost shrink-0">
            Browse the directory →
          </Link>
        </div>
      </section>

      {/* The community feed — new tools, takes, posts. */}
      <div>
        <p className="eyebrow mb-2">The feed</p>
        {user && <FeedTabs mode={mode} />}
        <FeedList key={mode} initial={feed} mode={mode} signedIn={!!user} />
      </div>
    </div>
  );
}
