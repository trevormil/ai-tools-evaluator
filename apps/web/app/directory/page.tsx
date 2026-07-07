import Link from "next/link";
import { listItems, countItems, type ItemSort } from "@/lib/queries";
import { Filters } from "@/components/filters";
import { ItemRow } from "@/components/item-row";
import { useCountsFor } from "@/lib/item-social";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 24;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** The Directory: the searchable, filterable catalog (leaderboard = sort "top"). */
export default async function DirectoryPage({ searchParams }: { searchParams: SearchParams }) {
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

  const moreParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val && k !== "page") moreParams.set(k, val);
  }
  moreParams.set("page", String(page + 1));

  return (
    <div className="flex flex-col gap-6">
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

      <section className="flex flex-col gap-3">
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
              <Link href={`/directory?${moreParams.toString()}`} className="btn-ghost self-center">
                Show more ({total - items.length} left)
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
