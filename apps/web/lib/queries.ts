import { and, desc, eq, gte, like, or, sql } from "drizzle-orm";
import {
  getDb,
  items,
  posts,
  comments,
  votes,
  follows,
  submissions,
  users,
  type Item,
  type Post,
  type Comment,
  type User,
} from "@aix/db";
import type { Evaluation } from "@aix/core";
import { hotScore } from "./ranking";

/* --------------------------------------------------------------- items */

export type ItemSort = "hot" | "new" | "top";

export type ItemFilters = {
  category?: string;
  integration?: string;
  verdict?: string;
  audience?: string; // primaryAudience: ai-engineer | vibe-coder | both | neither
  minScore?: number;
  q?: string;
  sort?: ItemSort;
  limit?: number;
};

export function listItems(f: ItemFilters = {}): Item[] {
  const conds = [eq(items.published, true)];
  if (f.category) conds.push(eq(items.category, f.category));
  if (f.integration) conds.push(eq(items.integration, f.integration));
  if (f.verdict) conds.push(eq(items.verdict, f.verdict));
  if (f.audience) conds.push(eq(items.primaryAudience, f.audience));
  if (typeof f.minScore === "number") conds.push(gte(items.overallScore, f.minScore));
  if (f.q) {
    const needle = `%${f.q.toLowerCase()}%`;
    const textMatch = or(
      like(sql`lower(${items.title})`, needle),
      like(sql`lower(${items.tagline})`, needle),
      like(sql`lower(${items.tagsJson})`, needle),
    );
    if (textMatch) conds.push(textMatch);
  }

  const order =
    f.sort === "new"
      ? desc(items.createdAt)
      : f.sort === "top"
        ? desc(items.overallScore)
        : desc(items.score); // "hot" (default)

  return getDb()
    .select()
    .from(items)
    .where(and(...conds))
    .orderBy(order)
    .limit(f.limit ?? 60)
    .all();
}

export function getItemBySlug(slug: string): Item | undefined {
  return getDb().select().from(items).where(eq(items.slug, slug)).get();
}

export function parseEvaluation(item: Item): Evaluation {
  return JSON.parse(item.evaluationJson) as Evaluation;
}

/* --------------------------------------------------------------- posts */

export type PostWithAuthor = { post: Post; author: User; item: Item | null };

export function listPosts(sort: "hot" | "new" = "hot", limit = 60): PostWithAuthor[] {
  const rows = getDb()
    .select({ post: posts, author: users, item: items })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id))
    .orderBy(desc(posts.createdAt))
    .limit(200)
    .all();

  const shaped = rows.map((r) => ({ post: r.post, author: r.author, item: r.item }));
  if (sort === "new") return shaped.slice(0, limit);
  return shaped
    .sort(
      (a, b) =>
        hotScore(b.post.upvotes, b.post.createdAt) - hotScore(a.post.upvotes, a.post.createdAt),
    )
    .slice(0, limit);
}

export function getPost(id: string): PostWithAuthor | undefined {
  const r = getDb()
    .select({ post: posts, author: users, item: items })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id))
    .where(eq(posts.id, id))
    .get();
  return r ? { post: r.post, author: r.author, item: r.item } : undefined;
}

export function listPostsByAuthor(authorId: string): PostWithAuthor[] {
  return getDb()
    .select({ post: posts, author: users, item: items })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(items, eq(posts.itemId, items.id))
    .where(eq(posts.authorId, authorId))
    .orderBy(desc(posts.createdAt))
    .all()
    .map((r) => ({ post: r.post, author: r.author, item: r.item }));
}

/* ------------------------------------------------------------ comments */

export type CommentNode = { comment: Comment; author: User; children: CommentNode[] };

function buildTree(rows: { comment: Comment; author: User }[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows)
    byId.set(r.comment.id, { comment: r.comment, author: r.author, children: [] });
  for (const node of byId.values()) {
    const parentId = node.comment.parentId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function getItemComments(itemId: string): CommentNode[] {
  const rows = getDb()
    .select({ comment: comments, author: users })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.itemId, itemId))
    .orderBy(comments.createdAt)
    .all();
  return buildTree(rows);
}

export function getPostComments(postId: string): CommentNode[] {
  const rows = getDb()
    .select({ comment: comments, author: users })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt)
    .all();
  return buildTree(rows);
}

/* --------------------------------------------------------------- users */

export function getUserByUsername(username: string): User | undefined {
  return getDb().select().from(users).where(eq(users.username, username)).get();
}

export function listItemsByPoster(userId: string): Item[] {
  return getDb()
    .select()
    .from(items)
    .where(eq(items.postedById, userId))
    .orderBy(desc(items.createdAt))
    .all();
}

export function listSubmissionsByUser(userId: string) {
  return getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.submittedById, userId))
    .orderBy(desc(submissions.createdAt))
    .all();
}

export function followCounts(userId: string): { followers: number; following: number } {
  const followers = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followeeId, userId))
    .get();
  const following = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId))
    .get();
  return { followers: followers?.n ?? 0, following: following?.n ?? 0 };
}

export function isFollowing(followerId: string, followeeId: string): boolean {
  const row = getDb()
    .select({ f: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .get();
  return !!row;
}

/* ----------------------------------------------------------------- votes */

export type VoteTarget = "item" | "post" | "comment";

/** The signed-in user's current vote value for a set of targets, keyed by id. */
export function userVotes(userId: string, targetType: VoteTarget): Record<string, number> {
  const rows = getDb()
    .select({ targetId: votes.targetId, value: votes.value })
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.targetType, targetType)))
    .all();
  const out: Record<string, number> = {};
  for (const r of rows) out[r.targetId] = r.value;
  return out;
}

/** Recompute the denormalized net-vote count (and hot score for items). */
export function recomputeAggregate(targetType: VoteTarget, targetId: string): number {
  const db = getDb();
  const agg = db
    .select({ net: sql<number>`coalesce(sum(${votes.value}), 0)` })
    .from(votes)
    .where(and(eq(votes.targetType, targetType), eq(votes.targetId, targetId)))
    .get();
  const net = agg?.net ?? 0;

  if (targetType === "item") {
    const item = db
      .select({ createdAt: items.createdAt })
      .from(items)
      .where(eq(items.id, targetId))
      .get();
    const score = item ? hotScore(net, item.createdAt) : 0;
    db.update(items).set({ upvotes: net, score }).where(eq(items.id, targetId)).run();
  } else if (targetType === "post") {
    db.update(posts).set({ upvotes: net }).where(eq(posts.id, targetId)).run();
  } else {
    db.update(comments).set({ upvotes: net }).where(eq(comments.id, targetId)).run();
  }
  return net;
}
