import Link from "next/link";
import type { Article, User } from "@aix/db";
import { getWorkflow } from "@/lib/workflow";
import { MarkdownContent } from "@/components/markdown-content";
import { WorkflowEditor } from "@/components/workflow-editor";

/** "My Workflow" panel: external link OR an inline article, plus owner editor. */
export function WorkflowSection({
  profile,
  isSelf,
  articles,
}: {
  profile: User;
  isSelf: boolean;
  articles: Article[];
}) {
  const workflow = getWorkflow(profile);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isSelf ? "My Workflow" : `${profile.username}'s Workflow`}
        </h2>
      </div>

      {isSelf && (
        <WorkflowEditor
          articles={articles.map((a) => ({ id: a.id, title: a.title }))}
          currentUrl={profile.workflowUrl}
          currentArticleId={profile.workflowArticleId}
        />
      )}

      {!workflow ? (
        <p className="text-sm text-neutral-500">
          {isSelf
            ? "Share how you actually work — link an external write-up or feature one of your articles."
            : "No workflow shared yet."}
        </p>
      ) : workflow.kind === "url" ? (
        <a
          href={workflow.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-fit"
        >
          View my workflow ↗
        </a>
      ) : (
        <article className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">{workflow.article.title}</h3>
            <Link
              href={`/a/${workflow.article.slug}`}
              className="shrink-0 text-xs text-neutral-500 hover:underline"
            >
              Open ↗
            </Link>
          </div>
          <MarkdownContent md={workflow.article.bodyMd} />
        </article>
      )}
    </section>
  );
}
