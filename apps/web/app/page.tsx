import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listItems } from "@/lib/queries";
import { getUnifiedFeed, type FeedMode } from "@/lib/home-feed";
import { PostComposer } from "@/components/post-composer";
import { FeedList } from "@/components/feed-list";
import { FeedTabs } from "@/components/feed-tabs";
import { TrendRow } from "@/components/trend-row";
import { NewsletterForm } from "@/components/newsletter-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const mode: FeedMode = user && sp.feed === "following" ? "following" : "all";
  const page = getUnifiedFeed(user, { mode, limit: 30 });
  const trending = listItems({ sort: "hot", limit: 6 });

  return (
    <div className="flex flex-col gap-8">
      {/* Feed-first for returning users; the pitch is for visitors (ticket 0024). */}
      {!user && <Hero />}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          {user ? <FeedTabs mode={mode} /> : <p className="eyebrow">The feed</p>}
          <PostComposer signedIn={!!user} />
          <FeedList key={mode} initial={page} mode={mode} signedIn={!!user} />
        </section>

        <aside className="flex flex-col gap-4">
          <NewsletterForm />
          <div className="flex items-center justify-between">
            <p className="eyebrow">Trending tools</p>
            <Link href="/directory" className="data text-[11px] text-muted hover:text-brand">
              Browse all →
            </Link>
          </div>
          {trending.length === 0 ? (
            <p className="text-sm text-muted">
              The directory is empty. The scanner hasn&apos;t run yet.
            </p>
          ) : (
            <div className="card flex flex-col p-2">
              {trending.map((item, i) => (
                <TrendRow key={item.id} rank={i + 1} item={item} />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Landing thesis: the promise + the verdict color language, up front. */
const VERDICT_LEGEND: { label: string; cls: string }[] = [
  { label: "essential", cls: "verdict-essential" },
  { label: "worthwhile", cls: "verdict-worthwhile" },
  { label: "niche", cls: "verdict-niche" },
  { label: "marginal", cls: "verdict-marginal" },
  { label: "redundant", cls: "verdict-redundant" },
  { label: "complexity trap", cls: "verdict-trap" },
];

function Hero() {
  return (
    <section className="card relative overflow-hidden p-6 sm:p-9">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.14] blur-2xl"
        style={{ background: "var(--brand)" }}
        aria-hidden
      />
      <p className="eyebrow">The verdict is in</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
        The fast-moving world of dev tools, <span className="text-brand">harshly judged.</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-muted sm:text-base">
        Every trending AI tool and paper, run through a ten-metric scorecard and handed a blunt
        verdict — so you adopt the signal and skip the complexity traps.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/directory" className="btn-primary">
          Browse the directory
        </Link>
        <Link href="/leaderboard" className="btn-ghost">
          See the leaderboard
        </Link>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-1.5">
        {VERDICT_LEGEND.map((v) => (
          <span key={v.label} className={`verdict ${v.cls}`}>
            {v.label}
          </span>
        ))}
      </div>
    </section>
  );
}
