import { and, desc, eq, inArray, lt, ne, or, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  getDb,
  activities,
  articles,
  follows,
  items,
  posts,
  reposts,
  stackItems,
  users,
  type Activity,
  type Item,
  type Post,
  type User,
} from "@aix/db";
import { userVotes } from "./queries";
import { repostCountsFor, userRepostSet } from "./reposts";

/**
 * Unified home timeline (ticket 0024): posts, freshly published items, and
 * rich activities merged newest-first behind a compound (createdAt, id) cursor.
 * "following" narrows to the viewer's circle explicitly — there is no silent
 * global fallback — and carries only human entries (posts + activities).
 */

export type FeedMode = "all" | "following";

export type FeedEmbed =
  | { type: "post"; post: Post; author: User; item: Item | null }
  | { type: "item"; item: Item }
  | {
      type: "stack";
      item: Item | null;
      toolName: string | null;
      status: string;
      take: string | null;
    };

export type FeedEntry =
  | {
      kind: "post";
      createdAt: number;
      post: Post;
      author: User;
      item: Item | null;
      myVote: number;
      repostCount: number;
      reposted: boolean;
    }
  | {
      kind: "item";
      createdAt: number;
      item: Item;
      myVote: number;
      repostCount: number;
      reposted: boolean;
    }
  | {
      kind: "activity";
      createdAt: number;
      activity: Activity;
      actor: User;
      label: string;
      href: string;
      quote: string | null;
      embed: FeedEmbed | null;
    };

export type FeedPage = { entries: FeedEntry[]; nextCursor: string | null };

/** Stable per-entry identity — used for cursor tiebreaks and client-side dedup. */
export function feedEntryKey(e: FeedEntry): string {
  if (e.kind === "post") return `post:${e.post.id}`;
  if (e.kind === "item") return `item:${e.item.id}`;
  return `act:${e.activity.id}`;
}

function entryId(e: FeedEntry): string {
  if (e.kind === "post") return e.post.id;
  if (e.kind === "item") return e.item.id;
  return e.activity.id;
}

/** Cursor is "<createdAt>:<id>" of the last returned entry. */
function parseCursor(cursor?: string): { ts: number; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf(":");
  if (sep < 1) return null;
  const ts = Number(cursor.slice(0, sep));
  if (!Number.isFinite(ts)) return null;
  return { ts, id: cursor.slice(sep + 1) };
}

/** WHERE clause for "strictly older than the cursor" on (createdAt, id). */
function olderThan(
  c: { ts: number; id: string } | null,
  createdAt: AnySQLiteColumn,
  id: AnySQLiteColumn,
): SQL | undefined {
  if (!c) return undefined;
  return or(lt(createdAt, c.ts), and(eq(createdAt, c.ts), lt(id, c.id)));
}

/** Total order: newest first, id desc as the same-second tiebreak. */
function compareEntries(a: FeedEntry, b: FeedEntry): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return entryId(b) < entryId(a) ? -1 : 1;
}

export function getUnifiedFeed(
  viewer: User | null,
  opts: { mode: FeedMode; limit?: number; cursor?: string },
): FeedPage {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const cur = parseCursor(opts.cursor);
  const following = opts.mode === "following" && viewer;

  let circle: string[] | null = null;
  if (following) {
    const rows = db
      .select({ id: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, viewer.id))
      .all();
    circle = [viewer.id, ...rows.map((r) => r.id)];
  }

  // Over-fetch each source by the page size; the merge keeps the newest `limit`.
  const postWhere = [olderThan(cur, posts.createdAt, posts.id)];
  if (circle) postWhere.push(inArray(posts.authorId, circle));
  const postRows = db
    .select({ post: posts, author: users, item: items })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id))
    .where(and(...postWhere.filter(Boolean)))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit)
    .all();

  const itemRows = following
    ? []
    : db
        .select()
        .from(items)
        .where(and(eq(items.published, true), olderThan(cur, items.createdAt, items.id)))
        .orderBy(desc(items.createdAt), desc(items.id))
        .limit(limit)
        .all();

  // `posted` is excluded — those posts are already first-class entries above.
  const actWhere = [
    ne(activities.verb, "posted"),
    olderThan(cur, activities.createdAt, activities.id),
  ];
  if (circle) actWhere.push(inArray(activities.actorId, circle));
  const actRows = db
    .select({ activity: activities, actor: users })
    .from(activities)
    .innerJoin(users, eq(activities.actorId, users.id))
    .where(and(...actWhere.filter(Boolean)))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit)
    .all();

  const myPostVotes = viewer ? userVotes(viewer.id, "post") : {};
  const myItemVotes = viewer ? userVotes(viewer.id, "item") : {};
  const postRepostCounts = repostCountsFor(
    "post",
    postRows.map((r) => r.post.id),
  );
  const itemRepostCounts = repostCountsFor(
    "item",
    itemRows.map((r) => r.id),
  );
  const myPostReposts = viewer ? userRepostSet(viewer.id, "post") : new Set<string>();
  const myItemReposts = viewer ? userRepostSet(viewer.id, "item") : new Set<string>();

  const entries: FeedEntry[] = [];

  for (const r of postRows) {
    entries.push({
      kind: "post",
      createdAt: r.post.createdAt,
      post: r.post,
      author: r.author,
      item: r.item,
      myVote: myPostVotes[r.post.id] ?? 0,
      repostCount: postRepostCounts[r.post.id] ?? 0,
      reposted: myPostReposts.has(r.post.id),
    });
  }

  for (const item of itemRows) {
    entries.push({
      kind: "item",
      createdAt: item.createdAt,
      item,
      myVote: myItemVotes[item.id] ?? 0,
      repostCount: itemRepostCounts[item.id] ?? 0,
      reposted: myItemReposts.has(item.id),
    });
  }

  for (const r of actRows) {
    const resolved = resolveActivity(r.activity, r.actor);
    if (resolved) entries.push(resolved);
  }

  entries.sort(compareEntries);
  const page = entries.slice(0, limit);
  // More may exist whenever any source could still have older rows beyond this page.
  const hasMore = entries.length > limit || page.length === limit;
  const last = page[page.length - 1];
  return {
    entries: page,
    nextCursor: hasMore && last ? `${last.createdAt}:${entryId(last)}` : null,
  };
}

/**
 * One actor's resolved activity stream, newest first — powers the profile
 * Activity tab (ticket 0029). Posts are excluded (they have their own tab).
 */
export function getUserActivity(
  actorId: string,
  limit = 30,
): Extract<FeedEntry, { kind: "activity" }>[] {
  const rows = getDb()
    .select({ activity: activities, actor: users })
    .from(activities)
    .innerJoin(users, eq(activities.actorId, users.id))
    .where(and(eq(activities.actorId, actorId), ne(activities.verb, "posted")))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit)
    .all();
  const out: Extract<FeedEntry, { kind: "activity" }>[] = [];
  for (const r of rows) {
    const resolved = resolveActivity(r.activity, r.actor);
    if (resolved && resolved.kind === "activity") out.push(resolved);
  }
  return out;
}

/* ------------------------------------------------- activity resolution */

/**
 * Attach a human label, link, and (where the verb has a real object) an
 * embedded card so the feed row is content, not a dead one-liner.
 */
function resolveActivity(activity: Activity, actor: User): FeedEntry | null {
  const db = getDb();
  const base = {
    kind: "activity" as const,
    createdAt: activity.createdAt,
    activity,
    actor,
    quote: null as string | null,
    embed: null as FeedEmbed | null,
  };

  switch (activity.verb) {
    case "reposted": {
      const quote =
        db
          .select({ quote: reposts.quote })
          .from(reposts)
          .where(
            and(
              eq(reposts.userId, actor.id),
              eq(reposts.targetType, activity.objectType === "item" ? "item" : "post"),
              eq(reposts.targetId, activity.objectId),
            ),
          )
          .get()?.quote ?? null;

      if (activity.objectType === "item") {
        const item = db.select().from(items).where(eq(items.id, activity.objectId)).get();
        if (!item) return null;
        return {
          ...base,
          label: "reposted an evaluation",
          href: `/item/${item.slug}`,
          quote,
          embed: { type: "item", item },
        };
      }
      const row = db
        .select({ post: posts, author: users, item: items })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .leftJoin(items, eq(posts.itemId, items.id))
        .where(eq(posts.id, activity.objectId))
        .get();
      if (!row) return null;
      return {
        ...base,
        label: "reposted",
        href: `/post/${row.post.id}`,
        quote,
        embed: { type: "post", post: row.post, author: row.author, item: row.item },
      };
    }

    case "stack_added": {
      if (activity.objectType === "item") {
        const item = db.select().from(items).where(eq(items.id, activity.objectId)).get();
        if (!item) return null;
        const stack = db
          .select({ status: stackItems.status, take: stackItems.take })
          .from(stackItems)
          .where(and(eq(stackItems.userId, actor.id), eq(stackItems.itemId, item.id)))
          .get();
        return {
          ...base,
          label: stack?.take
            ? `shared a take on ${item.title}`
            : `added ${item.title} to their stack`,
          href: `/item/${item.slug}`,
          embed: {
            type: "stack",
            item,
            toolName: null,
            status: stack?.status ?? "using",
            take: stack?.take ?? null,
          },
        };
      }
      const stack = db
        .select({ toolName: stackItems.toolName, status: stackItems.status, take: stackItems.take })
        .from(stackItems)
        .where(eq(stackItems.id, activity.objectId))
        .get();
      if (!stack) return null;
      return {
        ...base,
        label: stack.take
          ? `shared a take on ${stack.toolName ?? "a tool"}`
          : `added ${stack.toolName ?? "a tool"} to their stack`,
        href: `/u/${actor.username}`,
        embed: {
          type: "stack",
          item: null,
          toolName: stack.toolName,
          status: stack.status,
          take: stack.take,
        },
      };
    }

    case "commented": {
      if (activity.objectType === "item") {
        const it = db
          .select({ slug: items.slug, title: items.title })
          .from(items)
          .where(eq(items.id, activity.objectId))
          .get();
        if (!it) return null;
        return { ...base, label: `commented on ${it.title}`, href: `/item/${it.slug}` };
      }
      const p = db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, activity.objectId))
        .get();
      if (!p) return null;
      return { ...base, label: "commented on a post", href: `/post/${p.id}` };
    }

    case "followed": {
      const u = db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, activity.objectId))
        .get();
      if (!u) return null;
      return { ...base, label: `followed @${u.username}`, href: `/u/${u.username}` };
    }

    case "article_published": {
      const art = db
        .select({ slug: articles.slug, title: articles.title })
        .from(articles)
        .where(eq(articles.id, activity.objectId))
        .get();
      if (!art) return null;
      return { ...base, label: `published “${art.title}”`, href: `/a/${art.slug}` };
    }

    default:
      return null;
  }
}
