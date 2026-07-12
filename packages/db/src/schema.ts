import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch())`;
const cuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

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
    // The repo's own README (markdown), shown alongside our evaluation.
    // null = never fetched, "" = fetched-and-absent; capped on write.
    readmeMd: text("readme_md"),
    evaluatedBy: text("evaluated_by").notNull().default("ai"),
    model: text("model"),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    // "pending" = user-submitted, awaiting the evaluation queue; placeholder
    // score/verdict values are never displayed (ticket 0035).
    scoreStatus: text("score_status").notNull().default("scored"),
    // When the item was actually JUDGED — the nightly recap's grouping key
    // (ticket 0040). Set on scored insert + pending→scored upgrade; null until
    // scored. Distinct from createdAt (submission time for pending items).
    scoredAt: integer("scored_at"),
    // When this item was featured as the daily trending pick (ticket 0043).
    dailyPickAt: integer("daily_pick_at"),
    score: real("score").notNull().default(0), // ranking score, recomputed
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
 * A pasted URL (web form via the submission Worker, or Discord); the scanner
 * drains this queue FIRST on its next run, before trending discovery, subject
 * to the daily cap + dedup.
 */
export const submissions = sqliteTable(
  "submissions",
  {
    id: cuid(),
    url: text("url").notNull(),
    note: text("note"),
    source: text("source", { enum: ["web", "discord", "api"] })
      .notNull()
      .default("web"),
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

/* ------------------------------------------------------------ scan runs */

/** Audit trail for each scanner invocation — powers the daily-cap accounting. */
export const scanRuns = sqliteTable("scan_runs", {
  id: cuid(),
  source: text("source").notNull(), // github | arxiv | queue | mixed
  status: text("status", { enum: ["running", "success", "error"] })
    .notNull()
    .default("running"),
  discovered: integer("discovered").notNull().default(0),
  published: integer("published").notNull().default(0),
  skippedDuplicate: integer("skipped_duplicate").notNull().default(0),
  error: text("error"),
  startedAt: integer("started_at").notNull().default(now),
  finishedAt: integer("finished_at"),
});

export type Item = typeof items.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
