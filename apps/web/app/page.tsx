import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listItems, countItems, type ItemSort } from "@/lib/queries";
import { latestRecap, verdictSummary, recapDateLabel } from "@/lib/recap";
import { Filters } from "@/components/filters";
import { ItemRow } from "@/components/item-row";
import { VerdictBadge } from "@/components/verdict-badge";
import { useCountsFor } from "@/lib/item-social";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Home is the directory, fronted by the nightly recap (ticket 0040): the
 * briefing is the hero + Discord CTA, the browsable directory sits below.
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
            <a
              href="https://discord.gg/Xc2yyrwDv"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex shrink-0 items-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M20.317 4.369A19.79 19.79 0 0016.558 3.2a.074.074 0 00-.079.037c-.34.607-.717 1.4-.98 2.02a18.27 18.27 0 00-5.487 0 12.6 12.6 0 00-.997-2.02.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C1.144 8.09.532 11.71.833 15.284a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.009c.12.099.246.198.373.292a.077.077 0 01-.006.127c-.598.35-1.22.645-1.873.892a.076.076 0 00-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.055c.5-4.154-.838-7.741-3.549-10.939a.06.06 0 00-.031-.028zM8.02 13.05c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.955 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
              </svg>
              Join the Discord
            </a>
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
