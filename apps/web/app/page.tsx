import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listItems } from "@/lib/queries";
import { getHomeFeed, type FeedActivityView } from "@/lib/activity";
import { timeAgo } from "@/lib/format";
import { PostComposer } from "@/components/post-composer";
import { PostCard } from "@/components/post-card";
import { ItemCard } from "@/components/item-card";
import { NewsletterForm } from "@/components/newsletter-form";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const feed = getHomeFeed(user, 50);
  const trending = listItems({ sort: "hot", limit: 4 });

  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-4">
          <p className="eyebrow">The feed</p>
          <PostComposer signedIn={!!user} />
          {feed.length === 0 ? (
            <div className="card p-8 text-center text-sm text-neutral-500">
              Nothing here yet. Post something or follow a few people to fill your feed.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {feed.map((entry) =>
                entry.kind === "post" ? (
                  <PostCard
                    key={`post-${entry.post.post.id}`}
                    post={entry.post.post}
                    author={entry.post.author}
                    item={entry.post.item}
                    myVote={entry.myVote}
                    signedIn={!!user}
                    repostCount={entry.repostCount}
                    reposted={entry.reposted}
                  />
                ) : (
                  <ActivityRow key={`act-${entry.view.activity.id}`} view={entry.view} />
                ),
              )}
            </div>
          )}
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
            <div className="grid gap-3">
              {trending.map((item) => (
                <ItemCard key={item.id} item={item} />
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

/** A compact non-post activity row ("X added <tool> to their stack"). */
function ActivityRow({ view }: { view: FeedActivityView }) {
  const { actor, activity, label, href } = view;
  return (
    <Link
      href={href}
      className="card flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
    >
      {actor.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actor.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] dark:bg-neutral-700">
          {actor.username.slice(0, 2)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-neutral-800 dark:text-neutral-100">
          @{actor.username}
        </span>{" "}
        {label}
      </span>
      <span className="shrink-0 text-xs text-neutral-400">{timeAgo(activity.createdAt)}</span>
    </Link>
  );
}
