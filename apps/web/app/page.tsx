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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Feed</h1>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Trending tools</h2>
          <Link href="/directory" className="text-xs text-neutral-500 hover:underline">
            Browse all →
          </Link>
        </div>
        {trending.length === 0 ? (
          <p className="text-sm text-neutral-500">The directory is empty. The scanner hasn&apos;t run yet.</p>
        ) : (
          <div className="grid gap-3">
            {trending.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </aside>
    </div>
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
        <span className="font-medium text-neutral-800 dark:text-neutral-100">@{actor.username}</span> {label}
      </span>
      <span className="shrink-0 text-xs text-neutral-400">{timeAgo(activity.createdAt)}</span>
    </Link>
  );
}
