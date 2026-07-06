import { listItems, type ItemSort } from "@/lib/queries";
import { Filters } from "@/components/filters";
import { ItemCard } from "@/components/item-card";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const minScoreRaw = one(sp.minScore);
  const sortRaw = one(sp.sort);
  const items = listItems({
    category: one(sp.category),
    integration: one(sp.integration),
    verdict: one(sp.verdict),
    audience: one(sp.audience),
    q: one(sp.q),
    minScore: minScoreRaw ? Number(minScoreRaw) : undefined,
    sort: (["hot", "new", "top"].includes(sortRaw ?? "") ? sortRaw : "hot") as ItemSort,
    limit: 60,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Directory</h1>
        <p className="text-sm text-neutral-500">Trending tools, distilled into a harsh verdict and a 10-metric scorecard.</p>
      </div>
      <Filters />
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          No items match. Try clearing filters, or the directory may still be empty.
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-500">{items.length} results</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
