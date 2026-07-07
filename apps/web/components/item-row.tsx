import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import type { Item } from "@aix/db";
import { VerdictBadge } from "./verdict-badge";
import { SegMeter } from "./seg-meter";

/**
 * Directory row — the bench log line. Dense and scannable: logo, name +
 * verdict stamp, tagline, then the readout column (meter + score, uses,
 * comments). Pending submissions show their queue state instead of numbers.
 */
export function ItemRow({ item, uses = 0 }: { item: Item; uses?: number }) {
  const pending = item.scoreStatus === "pending";
  return (
    <Link href={`/item/${item.slug}`} className="card card-hover flex items-center gap-4 px-4 py-3">
      {item.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverImageUrl}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg object-cover"
          style={{ background: "var(--surface-2)" }}
        />
      ) : (
        <span
          className="data flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-faint"
          style={{ background: "var(--surface-2)" }}
        >
          {item.title.slice(0, 2).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-[15px] font-bold tracking-tight">
            {item.title}
          </span>
          {pending ? (
            <span className="chip !border-amber-500 font-semibold !text-amber-600 dark:!text-amber-400">
              Awaiting score…
            </span>
          ) : (
            <VerdictBadge verdict={item.verdict} />
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted">{item.tagline}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-faint">
          {!pending && (
            <span className="data">
              {CATEGORY_LABELS[item.category as Category] ?? item.category}
            </span>
          )}
          {uses > 0 && (
            <span className="data">
              {uses} {uses === 1 ? "engineer uses" : "engineers use"} this
            </span>
          )}
          {item.commentCount > 0 && <span className="data">{item.commentCount} comments</span>}
        </div>
      </div>

      <div className="hidden w-32 shrink-0 flex-col items-end gap-1.5 sm:flex">
        {pending ? (
          <span className="data text-xs text-faint">in the queue</span>
        ) : (
          <>
            <span className="data text-lg font-semibold leading-none">
              {item.overallScore}
              <span className="text-[10px] font-normal text-faint">/100</span>
            </span>
            <SegMeter score={item.overallScore} size="sm" className="w-full" />
          </>
        )}
      </div>
      {/* Mobile readout: just the number. */}
      {!pending && (
        <span className="data shrink-0 text-base font-semibold sm:hidden">{item.overallScore}</span>
      )}
    </Link>
  );
}
