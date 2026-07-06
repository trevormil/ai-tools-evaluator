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
import { WorkflowSection } from "@/components/workflow-section";
import { ArticleList } from "@/components/article-list";
import { ProfileTabs, type ProfileTab } from "@/components/profile-tabs";
import { ProfileLinks } from "@/components/profile-links";
import { ProfileLinksEditor } from "@/components/profile-links-editor";
import { getUserStack } from "@/lib/stack";
import { listArticlesByAuthor } from "@/lib/articles";
import { getProfileLinks } from "@/lib/profile-links";
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
  const articles = listArticlesByAuthor(profile.id);
  const submittedItems = listItemsByPoster(profile.id);
  const submissions = isSelf ? listSubmissionsByUser(profile.id) : [];
  const counts = followCounts(profile.id);
  const following = viewer && !isSelf ? isFollowing(viewer.id, profile.id) : false;
  const myVotes = viewer ? userVotes(viewer.id, "post") : {};
  const links = getProfileLinks(profile.id);
  const linksByKind = Object.fromEntries(links.map((l) => [l.kind, l.url]));

  const postsTab = (
    <section className="flex flex-col gap-6">
      {isSelf && submissions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Your submissions</h3>
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => (
              <li key={s.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                <span className="truncate">{s.url}</span>
                <span className="chip">{s.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {submittedItems.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Published items</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submittedItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Posts</h3>
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
      </div>
    </section>
  );

  const tabs: ProfileTab[] = [
    { key: "posts", label: "Posts", content: postsTab },
    { key: "stack", label: "My Stack", content: <StackSection stack={stack} isSelf={isSelf} username={profile.username} /> },
    { key: "workflow", label: "My Workflow", content: <WorkflowSection profile={profile} isSelf={isSelf} articles={articles} /> },
    { key: "articles", label: "Articles", content: <ArticleList articles={articles} isSelf={isSelf} /> },
  ];

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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProfileLinks links={links} />
            {isSelf && <ProfileLinksEditor initial={linksByKind} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewer && !isSelf && (
            <>
              <FollowButton targetUserId={profile.id} initialFollowing={following} signedIn />
              <a href={`/messages/${profile.id}`} className="btn-ghost">
                Message
              </a>
            </>
          )}
          {!viewer && <a href="/api/auth/github" className="btn-ghost">Sign in to follow</a>}
          {isSelf && (
            <a href="/api/auth/logout" className="text-xs text-neutral-500 hover:underline">
              Sign out
            </a>
          )}
        </div>
      </header>

      <ProfileTabs tabs={tabs} />
    </div>
  );
}
