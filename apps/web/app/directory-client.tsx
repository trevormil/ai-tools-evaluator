"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { QueuedView } from "@/lib/queue";
import { Filters } from "@/components/filters";
import { ItemRow, type DirectoryItem } from "@/components/item-row";
import { QueueStrip } from "@/components/queue-strip";
import { VerdictBadge } from "@/components/verdict-badge";

const PAGE_SIZE = 24;
const SORTS = ["hot", "new", "top"] as const;
type Sort = (typeof SORTS)[number];

type Filter = {
  category?: string;
  integration?: string;
  verdict?: string;
  audience?: string;
  minScore?: number;
  q?: string;
};

/** Mirrors `lib/queries.ts` `matches` — the slim, client-side filter predicate. */
function matches(item: DirectoryItem, f: Filter): boolean {
  if (f.category && item.category !== f.category) return false;
  if (f.integration && item.integration !== f.integration) return false;
  if (f.verdict && item.verdict !== f.verdict) return false;
  if (f.audience && item.primaryAudience !== f.audience) return false;
  if (typeof f.minScore === "number" && item.overallScore < f.minScore) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = `${item.title} ${item.tagline} ${item.tagsJson}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/** Mirrors `lib/queries.ts` `sorted` — recency for "new", score-at-rest otherwise. */
function sorted(items: DirectoryItem[], sort: Sort): DirectoryItem[] {
  const by =
    sort === "new"
      ? (a: DirectoryItem, b: DirectoryItem) => b.createdAt - a.createdAt
      : (a: DirectoryItem, b: DirectoryItem) =>
          b.overallScore - a.overallScore || b.createdAt - a.createdAt;
  return [...items].sort(by);
}

/**
 * The directory, filtered in the browser. Static export (ADR-0004) ships the
 * whole slim catalog to the client; filter/search/sort/page all live in the URL
 * (`useSearchParams`), so `<Filters>` keeps writing to it and this reacts.
 */
export function DirectoryClient({
  items,
  queued,
  pick,
}: {
  items: DirectoryItem[];
  queued: QueuedView[];
  pick: DirectoryItem | null;
}) {
  const params = useSearchParams();

  const filters: Filter = {
    category: params.get("category") ?? undefined,
    integration: params.get("integration") ?? undefined,
    verdict: params.get("verdict") ?? undefined,
    audience: params.get("audience") ?? undefined,
    q: params.get("q") ?? undefined,
    minScore: params.get("minScore") ? Number(params.get("minScore")) : undefined,
  };
  const sortRaw = params.get("sort") ?? "";
  const sort: Sort = (SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as Sort) : "hot";
  const pageRaw = Number(params.get("page") ?? 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const filtered = sorted(
    items.filter((i) => matches(i, filters)),
    sort,
  );
  const total = filtered.length;
  const shown = filtered.slice(0, page * PAGE_SIZE);

  const moreParams = new URLSearchParams(params.toString());
  moreParams.set("page", String(page + 1));

  return (
    <div className="flex flex-col gap-6">
      {/* Pick of the day — the anchor of the directory. */}
      {pick && (
        <section className="card relative overflow-hidden p-5 sm:p-6">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-[0.12] blur-2xl"
            style={{ background: "var(--brand)" }}
            aria-hidden
          />
          <p className="eyebrow">Today&apos;s pick</p>
          <Link href={`/item/${pick.slug}`} className="mt-2 block hover:opacity-90">
            <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl">
              {pick.title}
            </h2>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <VerdictBadge verdict={pick.verdict} />
            <span className="data text-xs text-faint">{pick.overallScore}/100</span>
          </div>
        </section>
      )}

      <div>
        <p className="eyebrow">The directory</p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Every AI tool, <span className="text-brand">harshly judged.</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Search and filter the catalog. Sort by <span className="text-ink">Top</span> for the
          leaderboard.
        </p>
      </div>

      {queued.length > 0 && <QueueStrip queued={queued} />}

      <section className="flex flex-col gap-3">
        <Filters />
        {shown.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No items match. Try clearing filters, or the directory may still be empty.
          </div>
        ) : (
          <>
            <p className="data text-[11px] uppercase tracking-wider text-faint">
              {shown.length < total ? `${shown.length} of ${total} tools` : `${total} tools`}
            </p>
            <div className="flex flex-col gap-2">
              {shown.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
            {shown.length < total && (
              <Link href={`/?${moreParams.toString()}`} className="btn-ghost self-center">
                Show more ({total - shown.length} left)
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
