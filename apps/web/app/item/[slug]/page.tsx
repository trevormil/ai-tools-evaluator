import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import { getCurrentUser } from "@/lib/auth";
import { getItemBySlug, parseEvaluation, getItemComments, userVotes } from "@/lib/queries";
import { toCommentViews } from "@/lib/comment-view";
import { VerdictBadge } from "@/components/verdict-badge";
import { Scorecard } from "@/components/scorecard";
import { AudienceFit } from "@/components/audience-fit";
import { MediaGallery } from "@/components/media-gallery";
import { VoteButtons } from "@/components/vote-buttons";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

const SECTIONS: { key: "whatItIs" | "vsVanilla" | "surfaceArea" | "devilsAdvocate" | "steelman"; title: string }[] = [
  { key: "whatItIs", title: "What it is" },
  { key: "vsVanilla", title: "How it differs from vanilla Claude" },
  { key: "surfaceArea", title: "Skill, plugin, or workflow shift?" },
  { key: "devilsAdvocate", title: "Devil's advocate — is this just complexity?" },
  { key: "steelman", title: "The honest case for it" },
];

export default async function ItemPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item) notFound();

  const evaluation = parseEvaluation(item);
  const user = await getCurrentUser();
  const commentNodes = getItemComments(item.id);
  const myItemVote = user ? userVotes(user.id, "item")[item.id] ?? 0 : 0;
  const myCommentVotes = user ? userVotes(user.id, "comment") : {};
  const comments = toCommentViews(commentNodes, myCommentVotes);

  return (
    <article className="flex flex-col gap-8">
      <header className="flex gap-4">
        <VoteButtons targetType="item" targetId={item.id} initialNet={item.upvotes} initialVote={myItemVote} signedIn={!!user} />
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={item.verdict} />
            <span className="chip">{CATEGORY_LABELS[item.category as Category] ?? item.category}</span>
            <span className="chip">{item.integration}</span>
            <span className="chip">noise {item.noiseScore}/100</span>
            <span className="chip font-semibold">overall {item.overallScore}/100</span>
          </div>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{item.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <a href={item.url} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline dark:text-orange-400">
              {item.kind === "arxiv_paper" ? "View paper ↗" : "Source ↗"}
            </a>
            <span className="text-neutral-400">{evaluation.source.externalId}</span>
            {evaluation.source.stars != null && <span className="text-neutral-400">★ {evaluation.source.stars}</span>}
          </div>
        </div>
      </header>

      {evaluation.media.length > 0 && <MediaGallery media={evaluation.media} />}

      <div className="prose-none flex flex-col gap-6">
        {SECTIONS.map(({ key, title }) => {
          const content = evaluation.body[key];
          if (!content) return null;
          return (
            <section key={key}>
              <h2 className="mb-1 text-lg font-semibold">{title}</h2>
              <p className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{content}</p>
            </section>
          );
        })}
      </div>

      {evaluation.audience && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Who it&apos;s for</h2>
          <AudienceFit audience={evaluation.audience} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Scorecard</h2>
        <div className="card p-4">
          <Scorecard scores={evaluation.scores} overall={item.overallScore} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Discussion</h2>
          <Link href={`/directory`} className="text-xs text-neutral-500 hover:underline">
            ← Directory
          </Link>
        </div>
        <div className="card p-4">
          <CommentForm itemId={item.id} signedIn={!!user} />
        </div>
        <CommentThread comments={comments} itemId={item.id} signedIn={!!user} />
      </section>
    </article>
  );
}
