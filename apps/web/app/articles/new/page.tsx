import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ArticleEditor } from "@/components/article-editor";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/github");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">Write an article</h1>
      <ArticleEditor />
    </div>
  );
}
