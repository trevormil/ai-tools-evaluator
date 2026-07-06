import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserByUsername,
  listItemsByPoster,
  listSubmissionsByUser,
  followCounts,
  isFollowing,
} from "@/lib/queries";
import { getUserTakes } from "@/lib/takes";
import { TakeCard } from "@/components/take-card";
import { SubmissionRow } from "@/components/submission-row";
import { ItemCard } from "@/components/item-card";
import { FollowButton } from "@/components/follow-button";
import { StackSection } from "@/components/stack-section";
import { WorkflowSection } from "@/components/workflow-section";
import { ArticleList } from "@/components/article-list";
import { ProfileTabs, type ProfileTab } from "@/components/profile-tabs";
import { ProfileLinks } from "@/components/profile-links";
import { ProfileLinksEditor } from "@/components/profile-links-editor";
import { EditProfile } from "@/components/edit-profile";
import { ActivityCard } from "@/components/activity-card";
import { getUserStack } from "@/lib/stack";
import { listArticlesByAuthor } from "@/lib/articles";
import { getProfileLinks } from "@/lib/profile-links";
import { getUserActivity } from "@/lib/home-feed";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ username: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const initialTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const profile = getUserByUsername(username);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;
  const takes = getUserTakes(profile.id);
  const stack = getUserStack(profile.id);
  const articles = listArticlesByAuthor(profile.id);
  const submittedItems = listItemsByPoster(profile.id);
  const submissions = isSelf ? listSubmissionsByUser(profile.id) : [];
  const counts = followCounts(profile.id);
  const following = viewer && !isSelf ? isFollowing(viewer.id, profile.id) : false;
  const links = getProfileLinks(profile.id);
  const linksByKind = Object.fromEntries(links.map((l) => [l.kind, l.url]));

  // Takes lead the profile (ticket 0036): @user's word on the tools they run.
  const takesTab = (
    <section className="flex flex-col gap-6">
      {isSelf && submissions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Your submissions
          </h3>
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </ul>
        </div>
      )}

      {submittedItems.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Tools they brought in
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submittedItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Takes
        </h3>
        {takes.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No takes yet{isSelf ? " — visit a tool page and add yours." : "."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {takes.map((t) => (
              <TakeCard
                key={t.id}
                username={profile.username}
                avatarUrl={profile.avatarUrl}
                status={t.status}
                rating={t.rating}
                take={t.take}
                updatedAt={t.updatedAt}
                tool={
                  t.item
                    ? {
                        slug: t.item.slug,
                        title: t.item.title,
                        coverImageUrl: t.item.coverImageUrl,
                      }
                    : { slug: null, title: t.toolName ?? "Unknown tool", coverImageUrl: null }
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const activity = getUserActivity(profile.id);

  const tabs: ProfileTab[] = [
    { key: "takes", label: "Takes", content: takesTab },
    {
      key: "stack",
      label: "My Stack",
      content: (
        <StackSection
          stack={stack}
          isSelf={isSelf}
          username={profile.username}
          messageHref={viewer && !isSelf ? `/messages/${profile.id}` : undefined}
        />
      ),
    },
    {
      key: "workflow",
      label: "My Workflow",
      content: <WorkflowSection profile={profile} isSelf={isSelf} articles={articles} />,
    },
    {
      key: "articles",
      label: "Articles",
      content: <ArticleList articles={articles} isSelf={isSelf} />,
    },
    {
      key: "activity",
      label: "Activity",
      content:
        activity.length === 0 ? (
          <p className="text-sm text-neutral-500">No activity yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {activity.map((entry) => (
              <ActivityCard key={entry.activity.id} entry={entry} />
            ))}
          </div>
        ),
    },
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
            {counts.followers} followers · {counts.following} following · joined{" "}
            {timeAgo(profile.createdAt)} ago
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProfileLinks links={links} />
            {isSelf && <ProfileLinksEditor initial={linksByKind} />}
            {isSelf && (
              <EditProfile displayName={profile.displayName ?? ""} bio={profile.bio ?? ""} />
            )}
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
          {!viewer && (
            <a href="/api/auth/github" className="btn-ghost">
              Sign in to follow
            </a>
          )}
          {isSelf && (
            <a href="/api/auth/logout" className="text-xs text-neutral-500 hover:underline">
              Sign out
            </a>
          )}
        </div>
      </header>

      <ProfileTabs tabs={tabs} initialTab={initialTab} />
    </div>
  );
}
