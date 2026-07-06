import Link from "next/link";
import type { Article } from "@aix/db";
import { timeAgo } from "@/lib/format";
import { ArticleDeleteControl } from "@/components/article-controls";

/** List of a user's articles; owner sees write/edit/delete controls. */
export function ArticleList({ articles, isSelf }: { articles: Article[]; isSelf: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {isSelf && (
        <Link href="/articles/new" className="btn-primary w-fit">
          Write an article
        </Link>
      )}

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {isSelf ? "No articles yet. Write up a deep-dive, guide, or opinion piece." : "No articles yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <li key={a.id} className="card flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/a/${a.slug}`} className="font-medium hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-neutral-500">{timeAgo(a.updatedAt)} ago</p>
              </div>
              {isSelf && (
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <Link href={`/articles/${a.slug}/edit`} className="text-neutral-500 hover:underline">
                    Edit
                  </Link>
                  <ArticleDeleteControl slug={a.slug} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
