import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listItems, countItems, type ItemSort } from "@/lib/queries";
import { getUnifiedFeed, type FeedEntry } from "@/lib/home-feed";
import { Filters } from "@/components/filters";
import { ItemCard } from "@/components/item-card";
import { ActivityCard } from "@/components/activity-card";
import { NewsletterForm } from "@/components/newsletter-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Home IS the directory (ticket 0032): search-first tool browsing, with the
 * community's pulse in a side rail — social inside each tool, not a timeline.
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

  const moreParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val && k !== "page") moreParams.set(k, val);
  }
  moreParams.set("page", String(page + 1));

  // The pulse rail: latest takes / new tools / community motion, compact.
  const pulse = getUnifiedFeed(null, { mode: "all", limit: 12 }).entries.filter(
    (e): e is Extract<FeedEntry, { kind: "activity" }> => e.kind === "activity",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">The directory</p>
        <h1 className="mt-2 max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-4xl">
          Every dev tool, on the record —{" "}
          <span className="text-brand">harshly scored, honestly used.</span>
        </h1>
        {!user && (
          <p className="mt-2 max-w-xl text-sm text-muted">
            Ten-metric scorecards and blunt verdicts from the evaluator, real takes from the
            engineers running each tool. Submit anything —{" "}
            <Link href="/submit" className="link-brand">
              it shows up instantly
            </Link>
            .
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-4">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
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

        <aside className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="eyebrow">The pulse</p>
            <Link href="/activity" className="data text-[11px] text-muted hover:text-brand">
              All activity →
            </Link>
          </div>
          {pulse.length === 0 ? (
            <p className="text-sm text-muted">No community activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pulse.slice(0, 6).map((entry) => (
                <ActivityCard key={entry.activity.id} entry={entry} />
              ))}
            </div>
          )}
          <NewsletterForm />
        </aside>
      </div>
    </div>
  );
}
