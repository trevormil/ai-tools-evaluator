import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listItems, countItems, type ItemSort } from "@/lib/queries";
import { latestRecap, verdictSummary, recapDateLabel } from "@/lib/recap";
import { Filters } from "@/components/filters";
import { ItemRow } from "@/components/item-row";
import { VerdictBadge } from "@/components/verdict-badge";
import { NewsletterForm } from "@/components/newsletter-form";
import { useCountsFor } from "@/lib/item-social";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Home is the directory, fronted by the nightly recap (ticket 0040): the
 * briefing is the hero + subscribe hook, the browsable directory sits below.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const minScoreRaw = one(sp.minScore);
  const sortRaw = one(sp.sort);
  const pageRaw = Number(one(sp.page) ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const filters = {
    category: one(sp.category),
    integration: one(sp.integration),
    verdict: one(sp.verdict),
    audience: one(sp.audience),
    q: one(sp.q),
    minScore: minScoreRaw ? Number(minScoreRaw) : undefined,
  };
  const items = listItems({
    ...filters,
    sort: (["hot", "new", "top"].includes(sortRaw ?? "") ? sortRaw : "hot") as ItemSort,
    limit: page * PAGE_SIZE,
  });
  const total = countItems(filters);
  const uses = useCountsFor(items.map((i) => i.id));
  const filtering = Object.values(filters).some(Boolean) || page > 1;

  const moreParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val && k !== "page") moreParams.set(k, val);
  }
  moreParams.set("page", String(page + 1));

  const recap = latestRecap();

  return (
    <div className="flex flex-col gap-8">
      {/* Hero: the nightly briefing. Only when not mid-filter, so browsing the
          directory doesn't keep the marketing surface in the way. */}
      {!filtering && (
        <section className="card relative overflow-hidden p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.12] blur-2xl"
            style={{ background: "var(--brand)" }}
            aria-hidden
          />
          <p className="eyebrow">The nightly recap</p>
          <h1 className="mt-3 max-w-2xl font-display text-2xl font-black leading-[1.05] tracking-tight sm:text-4xl">
            Every dev tool, harshly judged —{" "}
            <span className="text-brand">one briefing a night.</span>
          </h1>
          {recap ? (
            <>
              <p className="mt-3 text-sm text-muted">
                <span className="text-ink">{recapDateLabel(recap.date)}</span> — {recap.total} tool
                {recap.total === 1 ? "" : "s"} judged:{" "}
                <span className="text-ink">{verdictSummary(recap.verdictCounts)}</span>.
              </p>
              {recap.leadPick && (
                <Link
                  href={`/item/${recap.leadPick.slug}`}
                  className="mt-3 inline-flex flex-wrap items-center gap-2 text-sm hover:opacity-90"
                >
                  <span className="data text-[11px] uppercase tracking-wider text-faint">
                    Tonight&apos;s pick
                  </span>
                  <span className="font-semibold">{recap.leadPick.title}</span>
                  <VerdictBadge verdict={recap.leadPick.verdict} />
                  <span className="data text-xs text-faint">{recap.leadPick.overallScore}/100</span>
                </Link>
              )}
            </>
          ) : (
            <p className="mt-3 max-w-xl text-sm text-muted">
              Ten-metric scorecards and blunt verdicts, plus the takes of the engineers who run each
              tool. The first recap lands the next time the scanner runs.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:max-w-sm sm:flex-1">
              <NewsletterForm variant="inline" />
            </div>
            {recap && (
              <Link href={`/recap/${recap.date}`} className="btn-ghost shrink-0">
                Read tonight&apos;s recap →
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <p className="eyebrow">The directory</p>
          <a href="/random" className="btn-ghost !py-1.5 shrink-0" title="Open a random tool">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <rect
                x="0.75"
                y="0.75"
                width="12.5"
                height="12.5"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="4.6" cy="4.6" r="1.15" fill="currentColor" />
              <circle cx="9.4" cy="4.6" r="1.15" fill="currentColor" />
              <circle cx="7" cy="7" r="1.15" fill="currentColor" />
              <circle cx="4.6" cy="9.4" r="1.15" fill="currentColor" />
              <circle cx="9.4" cy="9.4" r="1.15" fill="currentColor" />
            </svg>
            Shuffle
          </a>
        </div>
        <Filters />
        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No items match. Try clearing filters, or the directory may still be empty.
          </div>
        ) : (
          <>
            <p className="data text-[11px] uppercase tracking-wider text-faint">
              {items.length < total ? `${items.length} of ${total} tools` : `${total} tools`}
            </p>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <ItemRow key={item.id} item={item} uses={uses[item.id] ?? 0} />
              ))}
            </div>
            {items.length < total && (
              <Link href={`/?${moreParams.toString()}`} className="btn-ghost self-center">
                Show more ({total - items.length} left)
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
