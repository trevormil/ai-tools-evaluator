import { desc, eq, ne } from "drizzle-orm";
import {
  getDb,
  activities,
  items,
  posts,
  users,
  stackItems,
  articles,
  follows,
  type Activity,
  type User,
} from "@aix/db";
import { listPosts, userVotes, type PostWithAuthor } from "./queries";
import { repostCountsFor, userRepostSet } from "./reposts";

/* --------------------------------------------------------- emission */

export type EmitActivityInput = {
  actorId: string;
  verb: string; // posted | reposted | commented | stack_added | followed | article_published
  objectType: string; // post | item | comment | user | stack | article
  objectId: string;
};

/**
 * Insert an activity-feed row. Best-effort: a failure here must never break the
 * underlying mutation, so we swallow (and log) any error.
 */
export function emitActivity(input: EmitActivityInput): void {
  try {
    getDb().insert(activities).values(input).run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[aix/web] emitActivity failed", err);
  }
}

/* ------------------------------------------------------- home feed */

export type FeedActivityView = {
  activity: Activity;
  actor: User;
  label: string;
  href: string;
};

export type FeedEntry =
  | {
      kind: "post";
      createdAt: number;
      actorId: string;
      post: PostWithAuthor;
      myVote: number;
      repostCount: number;
      reposted: boolean;
    }
  | { kind: "activity"; createdAt: number; actorId: string; view: FeedActivityView };

/** Turn a raw activity row into a display label + link, or null if unresolvable. */
function resolveActivity(activity: Activity, actor: User): FeedActivityView | null {
  const db = getDb();
  switch (activity.verb) {
    case "stack_added": {
      if (activity.objectType === "item") {
        const it = db
          .select({ slug: items.slug, title: items.title })
          .from(items)
          .where(eq(items.id, activity.objectId))
          .get();
        if (!it) return null;
        return {
          activity,
          actor,
          label: `added ${it.title} to their stack`,
          href: `/item/${it.slug}`,
        };
      }
      const s = db
        .select({ toolName: stackItems.toolName })
        .from(stackItems)
        .where(eq(stackItems.id, activity.objectId))
        .get();
      return {
        activity,
        actor,
        label: `added ${s?.toolName ?? "a tool"} to their stack`,
        href: `/u/${actor.username}`,
      };
    }
    case "reposted": {
      if (activity.objectType === "item") {
        const it = db
          .select({ slug: items.slug, title: items.title })
          .from(items)
          .where(eq(items.id, activity.objectId))
          .get();
        if (!it) return null;
        return { activity, actor, label: `reposted ${it.title}`, href: `/item/${it.slug}` };
      }
      const p = db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, activity.objectId))
        .get();
      if (!p) return null;
      return { activity, actor, label: `reposted a post`, href: `/post/${p.id}` };
    }
    case "commented": {
      if (activity.objectType === "item") {
        const it = db
          .select({ slug: items.slug, title: items.title })
          .from(items)
          .where(eq(items.id, activity.objectId))
          .get();
        if (!it) return null;
        return { activity, actor, label: `commented on ${it.title}`, href: `/item/${it.slug}` };
      }
      const p = db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, activity.objectId))
        .get();
      if (!p) return null;
      return { activity, actor, label: `commented on a post`, href: `/post/${p.id}` };
    }
    case "followed": {
      const u = db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, activity.objectId))
        .get();
      if (!u) return null;
      return { activity, actor, label: `followed @${u.username}`, href: `/u/${u.username}` };
    }
    case "article_published": {
      const art = db
        .select({ slug: articles.slug, title: articles.title })
        .from(articles)
        .where(eq(articles.id, activity.objectId))
        .get();
      if (!art) return null;
      return { activity, actor, label: `published “${art.title}”`, href: `/a/${art.slug}` };
    }
    default:
      return null;
  }
}

/**
 * Blended home feed: recent posts + notable activity (reposts, stack adds,
 * comments, follows, articles), newest first. When the viewer follows people
 * and there is enough of their activity, the feed narrows to that circle;
 * otherwise it falls back to the global stream (signed-out or sparse network).
 */
export function getHomeFeed(viewer: User | null, limit = 50): FeedEntry[] {
  const db = getDb();

  const postRows = listPosts("new", 80);
  const postIds = postRows.map((p) => p.post.id);
  const myPostVotes = viewer ? userVotes(viewer.id, "post") : {};
  const repostCounts = repostCountsFor("post", postIds);
  const myReposts = viewer ? userRepostSet(viewer.id, "post") : new Set<string>();

  const postEntries: FeedEntry[] = postRows.map((p) => ({
    kind: "post",
    createdAt: p.post.createdAt,
    actorId: p.post.authorId,
    post: p,
    myVote: myPostVotes[p.post.id] ?? 0,
    repostCount: repostCounts[p.post.id] ?? 0,
    reposted: myReposts.has(p.post.id),
  }));

  // Everything except `posted` — the posts themselves are already rendered above.
  const actRows = db
    .select({ activity: activities, actor: users })
    .from(activities)
    .innerJoin(users, eq(activities.actorId, users.id))
    .where(ne(activities.verb, "posted"))
    .orderBy(desc(activities.createdAt))
    .limit(80)
    .all();

  const activityEntries: FeedEntry[] = [];
  for (const r of actRows) {
    const view = resolveActivity(r.activity, r.actor);
    if (!view) continue;
    activityEntries.push({
      kind: "activity",
      createdAt: r.activity.createdAt,
      actorId: r.activity.actorId,
      view,
    });
  }

  let entries = [...postEntries, ...activityEntries].sort((a, b) => b.createdAt - a.createdAt);

  if (viewer) {
    const following = db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, viewer.id))
      .all();
    if (following.length > 0) {
      const circle = new Set<string>([viewer.id, ...following.map((f) => f.id)]);
      const focused = entries.filter((e) => circle.has(e.actorId));
      if (focused.length >= 5) entries = focused;
    }
  }

  return entries.slice(0, limit);
}
