import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORY_LABELS, LENS_DEFS, LENS_SECTIONS, lensFor, type Category } from "@aix/core";
import { getItemBySlug, parseEvaluation } from "@/lib/queries";
import { VerdictBadge } from "@/components/verdict-badge";
import { Scorecard } from "@/components/scorecard";
import { AudienceFit } from "@/components/audience-fit";
import { MediaGallery } from "@/components/media-gallery";
import { CoverImage } from "@/components/cover-image";
import { ShareButton } from "@/components/share-button";
import { ReadmeSection } from "@/components/readme-section";
import { SegMeter } from "@/components/seg-meter";
import { CopyButton } from "@/components/copy-button";
import { IntegrationDiagram } from "@/components/integration-diagram";
import { ContentTabs, type ContentTab } from "@/components/content-tabs";
import { getOrFetchReadme, prepareReadme } from "@/lib/github-readme";
import { renderMarkdown } from "@/lib/markdown";
import { shareBlurb, shareSummary } from "@/lib/share";
import { absoluteUrl } from "@/lib/public-api";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item) return { title: "Not found — AIx" };

  const title = `${item.title} — AIx`;
  // Pending items have no scores yet; keep the unfurl honest.
  const description =
    item.scoreStatus === "pending"
      ? `${item.tagline} — awaiting its ten-metric AIx evaluation.`
      : shareBlurb(item);

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const initialTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const item = getItemBySlug(slug);
  if (!item) notFound();

  const pending = item.scoreStatus === "pending";
  const evaluation = pending ? null : parseEvaluation(item);

  // Share surface: link unfurls to the OG card; summary carries the scorecard.
  const shareUrl = absoluteUrl(`/item/${item.slug}`);
  const shareText = pending ? item.tagline : shareBlurb(item);
  const shareBlob = pending
    ? `**${item.title}** — ${item.tagline}\n\n${shareUrl}`
    : shareSummary(item, shareUrl);

  // Lens (ADR-0003) drives which signals + framing the readout shows.
  const lens = lensFor(evaluation?.source ?? { kind: item.kind });
  const sourceLinkLabel =
    lens === "research" ? "Read paper ↗" : lens === "product" ? "Visit site ↗" : "Source ↗";

  // The repo's own README — stored at publish time, lazy-fetched for
  // pending/legacy GitHub items (best-effort).
  const readmeMd = await getOrFetchReadme(item);
  const readmeHtml = readmeMd ? renderMarkdown(prepareReadme(readmeMd, item.externalId)) : null;

  /** One pane per concern — the page reads one thing at a time. */
  const buildTabs = (): ContentTab[] => {
    const tabs: ContentTab[] = [];

    if (pending) {
      tabs.push({
        key: "status",
        label: "Status",
        content: (
          <section className="card border-dashed p-6 text-sm text-muted">
            <p className="eyebrow mb-2 !text-amber-600 dark:!text-amber-400">In the queue</p>
            This tool was submitted by the community and is awaiting its ten-metric evaluation. The
            scorecard, verdict, and full write-up land on the next scanner run.
          </section>
        ),
      });
    } else {
      tabs.push({
        key: "evaluation",
        label: "Evaluation",
        content: (
          <div className="flex flex-col gap-8">
            {evaluation!.media.length > 0 && <MediaGallery media={evaluation!.media} />}
            <div className="prose-none flex flex-col gap-6">
              {LENS_SECTIONS[lensFor(evaluation!.source)].map(({ key, title }) => {
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
          </div>
        ),
      });
      tabs.push({
        key: "scorecard",
        label: "Scorecard",
        content: (
          <section>
            <p className="eyebrow mb-2">The report card</p>
            <div className="card p-4 sm:p-5">
              <Scorecard scores={evaluation!.scores} overall={item.overallScore} />
            </div>
          </section>
        ),
      });
    }

    if (readmeHtml) {
      tabs.push({ key: "readme", label: "README", content: <ReadmeSection html={readmeHtml} /> });
    }

    return tabs;
  };

  return (
    <article className="flex flex-col gap-8">
      {/* Bench header: identity + one-line judgment, actions on the same line. */}
      <header className="min-w-0">
        <div className="flex items-start gap-4">
          <CoverImage item={item} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
                {item.title}
              </h1>
              {pending ? (
                <span className="chip !border-amber-500 font-semibold !text-amber-600 dark:!text-amber-400">
                  Awaiting score…
                </span>
              ) : (
                <>
                  <VerdictBadge verdict={item.verdict} />
                  {/* Badge the frame only for non-default lenses; agent-tool
                      (the common case) stays visually unchanged. */}
                  {lens !== "agent-tool" && (
                    <span className="chip text-xs">{LENS_DEFS[lens].label}</span>
                  )}
                </>
              )}
            </div>
            <p className="mt-1.5 text-muted">{item.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="link-brand font-medium"
              >
                {sourceLinkLabel}
              </a>
              <span className="text-xs">
                <ShareButton url={shareUrl} blurb={shareText} summary={shareBlob} />
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
        {/* Main column: tabbed so the page reads one thing at a time
            (Evaluation · Scorecard · README). */}
        <div className="min-w-0">
          <ContentTabs initialTab={initialTab} tabs={buildTabs()} />
        </div>

        {/* Spec rail: the instrument readout, pinned while you read. */}
        <aside className="top-20 flex flex-col gap-3 lg:sticky">
          <div className="card p-4">
            {pending ? (
              <div className="flex flex-col gap-2">
                <p className="eyebrow">Readout</p>
                <span className="chip w-fit !border-amber-500 font-semibold !text-amber-600 dark:!text-amber-400">
                  Awaiting score…
                </span>
                <p className="text-xs text-muted">
                  Queued for the next evaluation run. Metrics appear here when it lands.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="eyebrow">Readout</p>
                <div className="flex items-baseline gap-1">
                  <span className="data text-4xl font-semibold leading-none">
                    {item.overallScore}
                  </span>
                  <span className="data text-xs text-faint">/100 overall</span>
                </div>
                <SegMeter score={item.overallScore} />
                <dl className="mt-1 flex flex-col gap-1.5 text-sm">
                  <SpecRow label="verdict">
                    <VerdictBadge verdict={item.verdict} />
                  </SpecRow>
                  <SpecRow label="noise">
                    <span className="data">{item.noiseScore}/100</span>
                  </SpecRow>
                  <SpecRow label="category">
                    <span className="data text-xs">
                      {CATEGORY_LABELS[item.category as Category] ?? item.category}
                    </span>
                  </SpecRow>
                  {lens === "agent-tool" && (
                    <SpecRow label="integration">
                      <span className="data text-xs">{item.integration}</span>
                    </SpecRow>
                  )}
                  {evaluation?.source.stars != null && (
                    <SpecRow label="stars">
                      <span className="data text-xs">★ {evaluation.source.stars}</span>
                    </SpecRow>
                  )}
                  {evaluation?.source.authors?.length ? (
                    <SpecRow label="authors">
                      <span className="data max-w-[170px] truncate text-xs">
                        {evaluation.source.authors.join(", ")}
                      </span>
                    </SpecRow>
                  ) : null}
                  {evaluation?.source.publishedAt && (
                    <SpecRow label="published">
                      <span className="data text-xs">
                        {timeAgo(Math.floor(Date.parse(evaluation.source.publishedAt) / 1000))} ago
                      </span>
                    </SpecRow>
                  )}
                  {evaluation?.source.language && (
                    <SpecRow label="language">
                      <span className="data text-xs">{evaluation.source.language}</span>
                    </SpecRow>
                  )}
                  {evaluation?.source.license && (
                    <SpecRow label="license">
                      <span className="data text-xs">{evaluation.source.license}</span>
                    </SpecRow>
                  )}
                  {evaluation?.source.pushedAt && (
                    <SpecRow label="last push">
                      <span className="data text-xs">
                        {timeAgo(Math.floor(Date.parse(evaluation.source.pushedAt) / 1000))} ago
                      </span>
                    </SpecRow>
                  )}
                  <SpecRow label="source">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="data max-w-[170px] truncate text-xs text-brand hover:underline"
                    >
                      {item.externalId}
                    </a>
                  </SpecRow>
                </dl>
              </div>
            )}
          </div>
          {evaluation && (evaluation.decision || evaluation.quickstart) && (
            <div className="card flex flex-col gap-3 p-4">
              <p className="eyebrow">Make the call</p>
              {evaluation.quickstart && (
                <div className="flex flex-col gap-1.5">
                  <div
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <code className="data min-w-0 flex-1 truncate text-xs">
                      {evaluation.quickstart.install}
                    </code>
                    <CopyButton text={evaluation.quickstart.install} />
                  </div>
                  {evaluation.quickstart.requires && evaluation.quickstart.requires.length > 0 && (
                    <p className="text-[11px] text-faint">
                      needs: {evaluation.quickstart.requires.join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {evaluation.decision && (
                <>
                  <div>
                    <p className="data mb-1 text-[11px] uppercase tracking-wider text-[var(--band-strong)]">
                      Adopt if
                    </p>
                    <ul className="flex flex-col gap-1 text-sm text-muted">
                      {evaluation.decision.adoptIf.map((line) => (
                        <li key={line} className="flex gap-1.5">
                          <span aria-hidden className="text-[var(--band-strong)]">
                            +
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="data mb-1 text-[11px] uppercase tracking-wider text-[var(--band-weak)]">
                      Skip if
                    </p>
                    <ul className="flex flex-col gap-1 text-sm text-muted">
                      {evaluation.decision.skipIf.map((line) => (
                        <li key={line} className="flex gap-1.5">
                          <span aria-hidden className="text-[var(--band-weak)]">
                            −
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {evaluation.decision.insteadOf && (
                    <p className="text-xs text-muted">
                      <span className="data uppercase tracking-wider text-faint">instead of</span>{" "}
                      {evaluation.decision.insteadOf}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {!pending && lens === "agent-tool" && (
            <div className="card flex flex-col gap-2 p-4">
              <p className="eyebrow">Where it sits</p>
              <IntegrationDiagram integration={item.integration} title={item.title} />
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="data text-[11px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}
