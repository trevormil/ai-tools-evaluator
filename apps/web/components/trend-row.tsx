import Link from "next/link";
import type { Item } from "@aix/db";
import { scoreBand } from "@aix/core";
import { scoreColorClass } from "@/lib/format";

/**
 * One line of a ranking (ticket 0027): rank, monogram/cover, title, verdict,
 * and the metric that actually ranks the list. Twitter-trends density instead
 * of a full directory card.
 */
export function TrendRow({
  rank,
  item,
  metric,
}: {
  rank: number;
  item: Item;
  /** The ranking metric to display; defaults to the overall score. */
  metric?: { value: string | number; label: string };
}) {
  const m = metric ?? { value: item.overallScore, label: "/100" };
  const band = scoreBand(item.overallScore);
  return (
    <Link
      href={`/item/${item.slug}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
    >
      <span className="data w-5 shrink-0 text-right text-xs font-bold text-faint">{rank}</span>
      {item.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverImageUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-md object-cover"
          style={{ background: "var(--surface-2)" }}
        />
      ) : (
        <span
          className="data flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-faint"
          style={{ background: "var(--surface-2)" }}
        >
          {item.title.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
        <span className="line-clamp-1 text-xs text-muted">
          {String(item.verdict).replace("-", " ")}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${scoreColorClass(band)}`} />
        <span className="data text-sm font-bold">{m.value}</span>
        <span className="data text-[10px] text-faint">{m.label}</span>
      </span>
    </Link>
  );
}
