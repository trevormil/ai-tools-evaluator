import { notFound } from "next/navigation";
import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import { getCurrentUser } from "@/lib/auth";
import { getItemBySlug, parseEvaluation, getItemComments, userVotes } from "@/lib/queries";
import { listItemTakes, getMyStackEntryForItem } from "@/lib/takes";
import { itemStackSummary } from "@/lib/item-social";
import { repostCount, hasReposted } from "@/lib/reposts";
import { toCommentViews } from "@/lib/comment-view";
import { VerdictBadge } from "@/components/verdict-badge";
import { Scorecard } from "@/components/scorecard";
import { AudienceFit } from "@/components/audience-fit";
import { MediaGallery } from "@/components/media-gallery";
import { VoteButtons } from "@/components/vote-buttons";
import { RepostButton } from "@/components/repost-button";
import { UseThisButton } from "@/components/use-this-button";
import { TakeComposer } from "@/components/take-composer";
import { TakeCard } from "@/components/take-card";
import { CommentForm } from "@/components/comment-form";
import { CommentThread } from "@/components/comment-thread";
import { ReadmeSection } from "@/components/readme-section";
import { getOrFetchReadme, prepareReadme } from "@/lib/github-readme";
import { renderMarkdown } from "@/lib/markdown";
import type { StackStatus } from "@/lib/stack-types";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

const SECTIONS: {
  key: "whatItIs" | "vsVanilla" | "surfaceArea" | "devilsAdvocate" | "steelman";
  title: string;
}[] = [
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

  const pending = item.scoreStatus === "pending";
  const evaluation = pending ? null : parseEvaluation(item);
  const user = await getCurrentUser();
  const commentNodes = getItemComments(item.id);
  const myItemVote = user ? (userVotes(user.id, "item")[item.id] ?? 0) : 0;
  const myCommentVotes = user ? userVotes(user.id, "comment") : {};
  const comments = toCommentViews(commentNodes, myCommentVotes);

  // Takes are the social spine (ticket 0036); usage count powers I-use-this (0033).
  const takes = listItemTakes(item.id, user?.id);
  const myEntry = user ? getMyStackEntryForItem(user.id, item.id) : undefined;
  const stack = itemStackSummary(item.id);
  const usingCount = (stack.byStatus["using"] ?? 0) + (stack.byStatus["trying"] ?? 0);
  const itemReposts = repostCount("item", item.id);
  const iReposted = user ? hasReposted(user.id, "item", item.id) : false;

  // The repo's own README — stored at publish time, lazy-fetched for
  // pending/legacy GitHub items (best-effort).
  const readmeMd = await getOrFetchReadme(item);
  const readmeHtml = readmeMd ? renderMarkdown(prepareReadme(readmeMd, item.externalId)) : null;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex gap-4">
        <VoteButtons
          targetType="item"
          targetId={item.id}
          initialNet={item.upvotes}
          initialVote={myItemVote}
          signedIn={!!user}
        />
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {pending ? (
              <span className="chip !border-amber-500 font-bold !text-amber-600 dark:!text-amber-400">
                Awaiting score…
              </span>
            ) : (
              <>
                <VerdictBadge verdict={item.verdict} />
                <span className="chip">
                  {CATEGORY_LABELS[item.category as Category] ?? item.category}
                </span>
                <span className="chip">{item.integration}</span>
                <span className="chip">noise {item.noiseScore}/100</span>
                <span className="chip !border-[var(--brand)] !text-brand font-bold">
                  overall {item.overallScore}/100
                </span>
              </>
            )}
          </div>
          <div className="flex items-start gap-3">
            {item.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.coverImageUrl}
                alt=""
                className="h-14 w-14 rounded-xl object-cover"
                style={{ background: "var(--surface-2)" }}
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{item.title}</h1>
              <p className="mt-1.5 text-muted">{item.tagline}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <UseThisButton
              itemId={item.id}
              initialUsing={myEntry?.status === "using" || myEntry?.status === "trying"}
              initialEntryId={myEntry?.id ?? null}
              initialHasTake={!!myEntry?.take}
              initialCount={usingCount}
              signedIn={!!user}
            />
            <a href={item.url} target="_blank" rel="noreferrer" className="link-brand font-medium">
              {item.kind === "arxiv_paper" ? "View paper ↗" : "Source ↗"}
            </a>
            <span className="data text-xs text-faint">{item.externalId}</span>
            {evaluation?.source.stars != null && (
              <span className="data text-xs text-faint">★ {evaluation.source.stars}</span>
            )}
            <span className="text-xs">
              <RepostButton
                targetType="item"
                targetId={item.id}
                initialCount={itemReposts}
                initialReposted={iReposted}
                signedIn={!!user}
              />
            </span>
          </div>
        </div>
      </header>

      {pending ? (
        <section className="card border-dashed p-6 text-sm text-muted">
          <p className="eyebrow mb-2 !text-amber-600 dark:!text-amber-400">In the queue</p>
          This tool was submitted by the community and is awaiting its ten-metric evaluation. The
          scorecard, verdict, and full write-up land on the next scanner run — takes, comments, and
          votes are already live.
        </section>
      ) : (
        <>
          {evaluation!.media.length > 0 && <MediaGallery media={evaluation!.media} />}

          <div className="prose-none flex flex-col gap-6">
            {SECTIONS.map(({ key, title }) => {
              const content = evaluation!.body[key];
              if (!content) return null;
              return (
                <section key={key} className="border-l-2 border-[var(--border-strong)] pl-4">
                  <h2 className="mb-1.5 text-lg font-bold tracking-tight">{title}</h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-muted">{content}</p>
                </section>
              );
            })}
          </div>

          {evaluation!.audience && (
            <section>
              <p className="eyebrow mb-2">Who it&apos;s for</p>
              <h2 className="mb-3 text-lg font-bold tracking-tight">Audience fit</h2>
              <AudienceFit audience={evaluation!.audience} />
            </section>
          )}

          <section>
            <p className="eyebrow mb-2">The report card</p>
            <h2 className="mb-3 text-lg font-bold tracking-tight">Scorecard</h2>
            <div className="card p-4 sm:p-5">
              <Scorecard scores={evaluation!.scores} overall={item.overallScore} />
            </div>
          </section>
        </>
      )}

      {readmeHtml && <ReadmeSection html={readmeHtml} />}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow mb-1">From the people running it</p>
            <h2 className="text-lg font-bold tracking-tight">
              Takes{takes.length > 0 ? ` · ${takes.length}` : ""}
            </h2>
          </div>
        </div>
        <TakeComposer
          itemId={item.id}
          initialTake={myEntry?.take ?? null}
          initialStatus={(myEntry?.status as StackStatus | undefined) ?? null}
          initialRating={myEntry?.rating ?? null}
          signedIn={!!user}
        />
        {takes.length === 0 ? (
          <p className="text-sm text-muted">No takes yet — be the first to say how it holds up.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {takes.map((t) => (
              <TakeCard
                key={t.id}
                username={t.username}
                avatarUrl={t.user.avatarUrl}
                status={t.status}
                rating={t.rating}
                take={t.take}
                updatedAt={t.updatedAt}
                followedByViewer={t.followedByViewer}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Discussion</h2>
          <Link href={`/`} className="data text-[11px] text-muted hover:text-brand">
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
