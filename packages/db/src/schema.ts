import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;
const cuid = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

/* ------------------------------------------------------------------ users */

export const users = sqliteTable(
  "users",
  {
    id: cuid(),
    githubId: integer("github_id").unique(),
    username: text("username").notNull().unique(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: text("role", { enum: ["user", "mod", "admin", "bot"] }).notNull().default("user"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("users_username_idx").on(t.username)],
);

/* ------------------------------------------------------ items (evaluated) */

/**
 * A discovered + evaluated thing (repo, paper, link). Denormalized columns power
 * fast filter/sort; `evaluationJson` holds the full canonical @aix/core Evaluation.
 */
export const items = sqliteTable(
  "items",
  {
    id: cuid(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").notNull(), // github_repo | arxiv_paper | external_link
    externalId: text("external_id").notNull(), // owner/repo or arxiv id
    url: text("url").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    integration: text("integration").notNull(),
    verdict: text("verdict").notNull(),
    primaryAudience: text("primary_audience"), // ai-engineer | vibe-coder | both | neither
    aiEngineerFit: integer("ai_engineer_fit"),
    vibeCoderFit: integer("vibe_coder_fit"),
    overallScore: integer("overall_score").notNull(),
    noiseScore: integer("noise_score").notNull(),
    tagline: text("tagline").notNull(),
    tagsJson: text("tags_json").notNull().default("[]"),
    evaluationJson: text("evaluation_json").notNull(), // full Evaluation
    mediaJson: text("media_json").notNull().default("[]"),
    coverImageUrl: text("cover_image_url"),
    evaluatedBy: text("evaluated_by").notNull().default("ai"),
    model: text("model"),
    postedById: text("posted_by_id").references(() => users.id),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    score: real("score").notNull().default(0), // hot-ranking score, recomputed
    upvotes: integer("upvotes").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("items_external_idx").on(t.kind, t.externalId),
    index("items_category_idx").on(t.category),
    index("items_verdict_idx").on(t.verdict),
    index("items_audience_idx").on(t.primaryAudience),
    index("items_created_idx").on(t.createdAt),
    index("items_score_idx").on(t.score),
  ],
);

/* --------------------------------------------- suggestion (link-drop) queue */

/**
 * A user pastes a URL (web or Discord); the scanner drains this queue FIRST on
 * its next run, before trending discovery, subject to the daily cap + dedup.
 */
export const submissions = sqliteTable(
  "submissions",
  {
    id: cuid(),
    url: text("url").notNull(),
    note: text("note"),
    source: text("source", { enum: ["web", "discord", "api"] }).notNull().default("web"),
    submittedById: text("submitted_by_id").references(() => users.id),
    discordUserId: text("discord_user_id"),
    status: text("status", {
      enum: ["queued", "processing", "published", "duplicate", "rejected", "failed"],
    })
      .notNull()
      .default("queued"),
    reason: text("reason"), // why rejected/duplicate/failed
    itemId: text("item_id").references(() => items.id),
    createdAt: integer("created_at").notNull().default(now),
    processedAt: integer("processed_at"),
  },
  (t) => [index("submissions_status_idx").on(t.status), index("submissions_url_idx").on(t.url)],
);

/* --------------------------------------------------------- social: posts */

export const posts = sqliteTable(
  "posts",
  {
    id: cuid(),
    authorId: text("author_id").notNull().references(() => users.id),
    itemId: text("item_id").references(() => items.id), // optional: post about an item
    body: text("body").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("posts_author_idx").on(t.authorId), index("posts_item_idx").on(t.itemId), index("posts_created_idx").on(t.createdAt)],
);

/* ----------------------------------------------------- social: comments */

/** Comments thread against an item OR a post; `parentId` gives nested replies. */
export const comments = sqliteTable(
  "comments",
  {
    id: cuid(),
    authorId: text("author_id").notNull().references(() => users.id),
    itemId: text("item_id").references(() => items.id),
    postId: text("post_id").references(() => posts.id),
    parentId: text("parent_id"),
    body: text("body").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [index("comments_item_idx").on(t.itemId), index("comments_post_idx").on(t.postId), index("comments_parent_idx").on(t.parentId)],
);

/* ---------------------------------------------------------------- votes */

export const votes = sqliteTable(
  "votes",
  {
    id: cuid(),
    userId: text("user_id").notNull().references(() => users.id),
    targetType: text("target_type", { enum: ["item", "post", "comment"] }).notNull(),
    targetId: text("target_id").notNull(),
    value: integer("value").notNull(), // +1 / -1
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("votes_unique_idx").on(t.userId, t.targetType, t.targetId)],
);

/* -------------------------------------------------------------- follows */

export const follows = sqliteTable(
  "follows",
  {
    followerId: text("follower_id").notNull().references(() => users.id),
    followeeId: text("followee_id").notNull().references(() => users.id),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("follows_unique_idx").on(t.followerId, t.followeeId)],
);

/* ------------------------------------------------------------ scan runs */

/** Audit trail for each scanner invocation — powers the daily-cap accounting. */
export const scanRuns = sqliteTable("scan_runs", {
  id: cuid(),
  source: text("source").notNull(), // github | arxiv | queue | mixed
  status: text("status", { enum: ["running", "success", "error"] }).notNull().default("running"),
  discovered: integer("discovered").notNull().default(0),
  published: integer("published").notNull().default(0),
  skippedDuplicate: integer("skipped_duplicate").notNull().default(0),
  error: text("error"),
  startedAt: integer("started_at").notNull().default(now),
  finishedAt: integer("finished_at"),
});

/* ---------------------------------------------- newsletter subscribers */

/**
 * Email newsletter list. Double opt-in: a new signup is `pending` until the
 * confirm link is clicked (`active`); `token` is a single opaque secret used for
 * BOTH the confirm and one-click unsubscribe links.
 */
export const subscribers = sqliteTable(
  "subscribers",
  {
    id: cuid(),
    email: text("email").notNull().unique(),
    status: text("status", { enum: ["pending", "active", "unsubscribed"] }).notNull().default("pending"),
    token: text("token").notNull(),
    createdAt: integer("created_at").notNull().default(now),
    confirmedAt: integer("confirmed_at"),
    unsubscribedAt: integer("unsubscribed_at"),
  },
  (t) => [index("subscribers_status_idx").on(t.status), uniqueIndex("subscribers_token_idx").on(t.token)],
);

/* ------------------------------------------------------ auth sessions */

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque session token
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
