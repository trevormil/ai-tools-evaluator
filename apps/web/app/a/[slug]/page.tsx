import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getArticleWithAuthor } from "@/lib/articles";
import { MarkdownContent } from "@/components/markdown-content";
import { ArticleDeleteControl } from "@/components/article-controls";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const found = getArticleWithAuthor(slug);
  if (!found) return { title: "Article not found — AIx" };
  return { title: `${found.article.title} — AIx` };
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const found = getArticleWithAuthor(slug);
  if (!found) notFound();
  const { article, author } = found;

  const viewer = await getCurrentUser();
  const isAuthor = viewer?.id === article.authorId;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex flex-col gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-2xl font-bold sm:text-3xl">{article.title}</h1>
        <div className="flex items-center justify-between gap-3 text-sm text-neutral-500">
          <span>
            by{" "}
            <Link href={`/u/${author.username}`} className="font-medium hover:underline">
              {author.displayName ?? author.username}
            </Link>{" "}
            · {timeAgo(article.createdAt)} ago
            {article.updatedAt > article.createdAt && ` · updated ${timeAgo(article.updatedAt)} ago`}
          </span>
          {isAuthor && (
            <span className="flex shrink-0 items-center gap-3 text-xs">
              <Link href={`/articles/${article.slug}/edit`} className="hover:underline">
                Edit
              </Link>
              <ArticleDeleteControl slug={article.slug} redirectTo={`/u/${author.username}`} />
            </span>
          )}
        </div>
      </header>

      <MarkdownContent md={article.bodyMd} />
    </article>
  );
}
