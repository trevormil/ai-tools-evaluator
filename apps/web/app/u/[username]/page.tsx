import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserByUsername,
  listPostsByAuthor,
  listItemsByPoster,
  listSubmissionsByUser,
  followCounts,
  isFollowing,
  userVotes,
} from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { ItemCard } from "@/components/item-card";
import { FollowButton } from "@/components/follow-button";
import { StackSection } from "@/components/stack-section";
import { getUserStack } from "@/lib/stack";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;

export default async function ProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const profile = getUserByUsername(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;
  const posts = listPostsByAuthor(profile.id);
  const stack = getUserStack(profile.id);
  const submittedItems = listItemsByPoster(profile.id);
  const submissions = isSelf ? listSubmissionsByUser(profile.id) : [];
  const counts = followCounts(profile.id);
  const following = viewer && !isSelf ? isFollowing(viewer.id, profile.id) : false;
  const myVotes = viewer ? userVotes(viewer.id, "post") : {};

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt={profile.username} className="h-20 w-20 rounded-full" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200 text-2xl font-bold dark:bg-neutral-800">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold">{profile.displayName ?? profile.username}</h1>
          <p className="text-sm text-neutral-500">@{profile.username}</p>
          {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
          <p className="mt-1 text-xs text-neutral-500">
            {counts.followers} followers · {counts.following} following · joined {timeAgo(profile.createdAt)} ago
          </p>
        </div>
        {viewer && !isSelf && <FollowButton targetUserId={profile.id} initialFollowing={following} signedIn />}
        {!viewer && <a href="/api/auth/github" className="btn-ghost">Sign in to follow</a>}
      </header>

      {isSelf && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your submissions</h2>
            <a href="/api/auth/logout" className="text-xs text-neutral-500 hover:underline">
              Sign out
            </a>
          </div>
          {submissions.length === 0 ? (
            <p className="text-sm text-neutral-500">No submissions yet. Drop a link on the Submit page.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {submissions.map((s) => (
                <li key={s.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="truncate">{s.url}</span>
                  <span className="chip">{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <StackSection stack={stack} isSelf={isSelf} username={profile.username} />

      {submittedItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Published items</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submittedItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-neutral-500">No posts yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((p) => (
              <PostCard
                key={p.post.id}
                post={p.post}
                author={p.author}
                item={p.item}
                myVote={myVotes[p.post.id] ?? 0}
                signedIn={!!viewer}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
