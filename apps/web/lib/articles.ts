import { and, desc, eq } from "drizzle-orm";
import { getDb, articles, users, type Article, type User } from "@aix/db";

/** Turn a title into a URL-safe kebab slug (falls back to "article"). */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "article";
}

/** A slug guaranteed unique across the articles table (short suffix on clash). */
function uniqueSlug(title: string): string {
  const db = getDb();
  const base = slugify(title);
  let candidate = base;
  for (let i = 0; i < 5; i++) {
    const taken = db.select({ id: articles.id }).from(articles).where(eq(articles.slug, candidate)).get();
    if (!taken) return candidate;
    candidate = `${base}-${crypto.randomUUID().slice(0, 5)}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function listArticlesByAuthor(authorId: string): Article[] {
  return getDb().select().from(articles).where(eq(articles.authorId, authorId)).orderBy(desc(articles.createdAt)).all();
}

export function getArticleBySlug(slug: string): Article | undefined {
  return getDb().select().from(articles).where(eq(articles.slug, slug)).get();
}

export function getArticleById(id: string): Article | undefined {
  return getDb().select().from(articles).where(eq(articles.id, id)).get();
}

/** An article joined to its author (for the public view's byline). */
export function getArticleWithAuthor(slug: string): { article: Article; author: User } | undefined {
  const row = getDb()
    .select({ article: articles, author: users })
    .from(articles)
    .innerJoin(users, eq(articles.authorId, users.id))
    .where(eq(articles.slug, slug))
    .get();
  return row ?? undefined;
}

export type CreateArticleInput = { title: string; bodyMd: string; published?: boolean };

export function createArticle(authorId: string, input: CreateArticleInput): Article {
  const nowSec = Math.floor(Date.now() / 1000);
  return getDb()
    .insert(articles)
    .values({
      authorId,
      slug: uniqueSlug(input.title),
      title: input.title.trim(),
      bodyMd: input.bodyMd,
      published: input.published ?? true,
      createdAt: nowSec,
      updatedAt: nowSec,
    })
    .returning()
    .get();
}

export type UpdateArticleInput = { title?: string; bodyMd?: string; published?: boolean };

/** Update an article the caller owns. Returns null if missing or not the author. */
export function updateArticle(authorId: string, slug: string, patch: UpdateArticleInput): Article | null {
  const db = getDb();
  const existing = db.select().from(articles).where(eq(articles.slug, slug)).get();
  if (!existing || existing.authorId !== authorId) return null;
  return db
    .update(articles)
    .set({
      title: patch.title?.trim() ?? existing.title,
      bodyMd: patch.bodyMd ?? existing.bodyMd,
      published: patch.published ?? existing.published,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(articles.id, existing.id))
    .returning()
    .get();
}

/** Delete an article the caller owns. Returns false if missing or not the author. */
export function deleteArticle(authorId: string, slug: string): boolean {
  const db = getDb();
  const existing = db.select().from(articles).where(and(eq(articles.slug, slug), eq(articles.authorId, authorId))).get();
  if (!existing) return false;
  // If this article backed anyone's "My Workflow", clear that pointer first.
  db.update(users).set({ workflowArticleId: null }).where(eq(users.workflowArticleId, existing.id)).run();
  db.delete(articles).where(eq(articles.id, existing.id)).run();
  return true;
}
