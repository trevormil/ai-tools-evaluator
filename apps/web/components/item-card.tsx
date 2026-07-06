import Link from "next/link";
import { CATEGORY_LABELS, scoreBand, type Category } from "@aix/core";
import type { Item } from "@aix/db";
import { VerdictBadge } from "./verdict-badge";
import { scoreColorClass } from "@/lib/format";

/**
 * Directory card: cover, verdict, score, category + integration chips, tagline.
 * Pending items (ticket 0035) show "Awaiting score…" and hide placeholder
 * numbers.
 */
export function ItemCard({ item }: { item: Item }) {
  const tags: string[] = safeParse(item.tagsJson);
  const band = scoreBand(item.overallScore);
  const pending = item.scoreStatus === "pending";
  return (
    <Link
      href={`/item/${item.slug}`}
      className="card card-hover group flex flex-col overflow-hidden"
    >
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{ background: "var(--surface-2)" }}
      >
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${
              pending ? "object-contain p-6" : "object-cover"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-5xl font-bold text-faint">
            {item.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        {!pending && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            {/* Score readout — colored by band, reads like a benchmark stamp. */}
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 backdrop-blur-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${scoreColorClass(band)}`} />
              <span className="data text-sm font-bold text-white">{item.overallScore}</span>
              <span className="data text-[10px] text-white/60">/100</span>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          {pending ? (
            <span className="chip !border-amber-500 font-bold !text-amber-600 dark:!text-amber-400">
              Awaiting score…
            </span>
          ) : (
            <>
              <VerdictBadge verdict={item.verdict} />
              <span className="data text-[11px] text-faint">noise {item.noiseScore}</span>
            </>
          )}
        </div>
        <h3 className="line-clamp-1 font-bold tracking-tight">{item.title}</h3>
        <p className="line-clamp-2 flex-1 text-sm text-muted">{item.tagline}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          {!pending && (
            <>
              <span className="chip">
                {CATEGORY_LABELS[item.category as Category] ?? item.category}
              </span>
              <span className="chip">{item.integration}</span>
            </>
          )}
          {tags.slice(0, 2).map((t) => (
            <span key={t} className="chip">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
