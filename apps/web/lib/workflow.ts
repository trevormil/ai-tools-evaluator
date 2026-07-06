import { eq } from "drizzle-orm";
import { getDb, users, type Article, type User } from "@aix/db";
import { getArticleById } from "./articles";

/**
 * A user's "My Workflow" is EITHER an external link OR one of their own
 * articles, never both. Resolved to a discriminated shape for rendering.
 */
export type WorkflowRef =
  | { kind: "url"; url: string }
  | { kind: "article"; article: Article }
  | null;

export function getWorkflow(user: User): WorkflowRef {
  if (user.workflowArticleId) {
    const article = getArticleById(user.workflowArticleId);
    if (article) return { kind: "article", article };
  }
  if (user.workflowUrl) return { kind: "url", url: user.workflowUrl };
  return null;
}

export type SetWorkflowInput = { url?: string | null; articleId?: string | null };

/**
 * Set (or clear) a user's workflow. An `articleId` wins over `url` and must
 * belong to the user; passing neither clears the workflow. Returns the updated
 * user, or null if an articleId was given that the user doesn't own.
 */
export function setWorkflow(userId: string, input: SetWorkflowInput): User | null {
  const db = getDb();
  const articleId = input.articleId?.trim() || null;
  const url = input.url?.trim() || null;

  if (articleId) {
    const article = getArticleById(articleId);
    if (!article || article.authorId !== userId) return null;
    return db.update(users).set({ workflowArticleId: articleId, workflowUrl: null }).where(eq(users.id, userId)).returning().get();
  }

  return db.update(users).set({ workflowArticleId: null, workflowUrl: url }).where(eq(users.id, userId)).returning().get();
}
