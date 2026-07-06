import { ItemCard } from "@/components/item-card";
import { topRated, mostDiscussed, hallOfShame } from "@/lib/leaderboard";
import type { Item } from "@aix/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rated = topRated(9);
  const discussed = mostDiscussed(9);
  const shame = hallOfShame(9);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="eyebrow">Leaderboard</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Credit where it&apos;s due.</h1>
        <p className="mt-1 text-sm text-muted">
          The best, the most argued-over, and the ones that got what they deserved.
        </p>
      </div>

      <Section
        title="Top rated"
        blurb="Highest weighted score across the 10-metric card — the tools actually worth adopting."
        items={rated}
      />
      <Section
        title="Most discussed"
        blurb="Where the arguments are happening. Ranked by comment count."
        items={discussed}
      />
      <Section
        title="Complexity Trap Hall of Shame"
        blurb="Verdict: complexity-trap or redundant. Ranked by noise score, worst first."
        items={shame}
      />
    </div>
  );
}

function Section({ title, blurb, items }: { title: string; blurb: string; items: Item[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{blurb}</p>
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nothing here yet. Run the seed or wait for the scanner.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
