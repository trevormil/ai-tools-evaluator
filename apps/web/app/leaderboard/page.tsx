import { TrendRow } from "@/components/trend-row";
import { topRated, hallOfShame } from "@/lib/leaderboard";
import type { Item } from "@aix/db";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rated = topRated(10);
  const shame = hallOfShame(10);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <div>
        <p className="eyebrow">Leaderboard</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Credit where it&apos;s due.
        </h1>
        <p className="mt-1 text-sm text-muted">
          The best, and the ones that got exactly what they deserved.
        </p>
      </div>

      <Section
        title="Top rated"
        blurb="Highest weighted score across the 10-metric card — the tools actually worth adopting."
        items={rated}
        metric={(item) => ({ value: item.overallScore, label: "/100" })}
      />
      <Section
        title="Complexity Trap Hall of Shame"
        blurb="Verdict: complexity-trap or redundant. Ranked by noise score, worst first."
        items={shame}
        metric={(item) => ({ value: item.noiseScore, label: "noise" })}
      />
    </div>
  );
}

function Section({
  title,
  blurb,
  items,
  metric,
}: {
  title: string;
  blurb: string;
  items: Item[];
  metric: (item: Item) => { value: string | number; label: string };
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{blurb}</p>
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          Nothing here yet. Run the seed or wait for the scanner.
        </div>
      ) : (
        <div className="card flex flex-col p-2">
          {items.map((item, i) => (
            <TrendRow key={item.id} rank={i + 1} item={item} metric={metric(item)} />
          ))}
        </div>
      )}
    </section>
  );
}
