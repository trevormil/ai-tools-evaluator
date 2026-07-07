import Link from "next/link";
import { shuffledTools, parseEvaluation } from "@/lib/queries";
import { listItemTakes } from "@/lib/takes";
import { useCountsFor } from "@/lib/item-social";
import { DiscoveryCard } from "@/components/discovery-card";

export const dynamic = "force-dynamic";

const DECK_SIZE = 20;

/**
 * The shuffle deck (ticket 0038): a snap-scrolling reel of random tools —
 * scroll, learn one, scroll again. Reload deals a new order.
 */
export default async function RandomPage() {
  const deck = shuffledTools(DECK_SIZE);
  const uses = useCountsFor(deck.map((i) => i.id));

  if (deck.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center text-sm text-muted">
          Nothing to shuffle yet — the directory is empty.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Shuffle</p>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tight">Deal me a tool.</h1>
        </div>
        <a href="/random" className="btn-ghost shrink-0">
          Shuffle again
        </a>
      </div>

      <div
        className="snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl"
        style={{ height: "calc(100dvh - 13.5rem)" }}
      >
        {deck.map((item, i) => (
          <DiscoveryCard
            key={item.id}
            item={item}
            evaluation={parseEvaluation(item)}
            topTake={listItemTakes(item.id, undefined, 1)[0] ?? null}
            uses={uses[item.id] ?? 0}
            index={i}
            total={deck.length}
          />
        ))}
        {/* End card: the deck is finite by design — reshuffle or go browse. */}
        <section className="flex h-full snap-start flex-col p-1">
          <div className="card flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="eyebrow">End of the deck</p>
            <h2 className="font-display text-xl font-bold tracking-tight">
              That&apos;s {deck.length} tools.
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="/random" className="btn-primary">
                Shuffle again
              </a>
              <Link href="/" className="btn-ghost">
                Browse the directory
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
