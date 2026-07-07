import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getArticleBySlug } from "@/lib/articles";
import { ArticleEditor } from "@/components/article-editor";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function EditArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/github");

  const article = getArticleBySlug(slug);
  if (!article) notFound();
  if (article.authorId !== user.id) redirect(`/a/${slug}`);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Edit article</h1>
      <ArticleEditor
        article={{ slug: article.slug, title: article.title, bodyMd: article.bodyMd }}
      />
    </div>
  );
}
