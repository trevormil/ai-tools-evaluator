import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listPosts, userVotes, listItems } from "@/lib/queries";
import { PostComposer } from "@/components/post-composer";
import { PostCard } from "@/components/post-card";
import { ItemCard } from "@/components/item-card";
import { NewsletterForm } from "@/components/newsletter-form";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const posts = listPosts("hot", 50);
  const myVotes = user ? userVotes(user.id, "post") : {};
  const trending = listItems({ sort: "hot", limit: 4 });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">Feed</h1>
        <PostComposer signedIn={!!user} />
        {posts.length === 0 ? (
          <div className="card p-8 text-center text-sm text-neutral-500">
            No posts yet. Be the first to start a discussion.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((p) => (
              <PostCard
                key={p.post.id}
                post={p.post}
                author={p.author}
                item={p.item}
                myVote={myVotes[p.post.id] ?? 0}
                signedIn={!!user}
              />
            ))}
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
