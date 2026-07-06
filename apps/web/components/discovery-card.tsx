import Link from "next/link";
import { CATEGORY_LABELS, type Category, type Evaluation } from "@aix/core";
import type { Item } from "@aix/db";
import { VerdictBadge } from "./verdict-badge";
import { SegMeter } from "./seg-meter";

/**
 * One frame of the shuffle deck (ticket 0038): a full-height digest of a
 * single tool — enough to learn it in one look, with the full evaluation a
 * tap away. Cards snap-scroll vertically like a discovery reel.
 */
export function DiscoveryCard({
  item,
  evaluation,
  topTake,
  uses,
  index,
  total,
}: {
  item: Item;
  evaluation: Evaluation | null;
  topTake: { username: string; take: string } | null;
  uses: number;
  index: number;
  total: number;
}) {
  return (
    <section className="flex h-full snap-start flex-col p-1" aria-label={item.title}>
      <div className="card flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="eyebrow">
            Shuffle · {index + 1} / {total}
          </p>
          {index === 0 && total > 1 && (
            <span className="data text-[11px] text-faint" aria-hidden>
              scroll ↓
            </span>
          )}
        </div>

        <div className="flex items-start gap-4">
          {item.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverImageUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
              style={{ background: "var(--surface-2)" }}
            />
          ) : (
            <span
              className="data flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-semibold text-faint"
              style={{ background: "var(--surface-2)" }}
            >
              {item.title.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-black tracking-tight sm:text-2xl">
                {item.title}
              </h2>
              <VerdictBadge verdict={item.verdict} />
            </div>
            <p className="mt-1 text-sm text-muted">{item.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="data text-3xl font-semibold leading-none">
            {item.overallScore}
            <span className="text-xs font-normal text-faint">/100</span>
          </span>
          <SegMeter score={item.overallScore} className="max-w-56 flex-1" />
          <span className="chip ml-auto hidden sm:inline-flex">
            {CATEGORY_LABELS[item.category as Category] ?? item.category}
          </span>
        </div>

        {evaluation && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <p className="eyebrow mb-1.5">What it is</p>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted sm:line-clamp-5">
              {evaluation.body.whatItIs}
            </p>
            <p className="eyebrow mb-1.5 mt-4">Devil&apos;s advocate</p>
            <p className="line-clamp-3 text-sm leading-relaxed text-muted sm:line-clamp-4">
              {evaluation.body.devilsAdvocate}
            </p>
          </div>
        )}

        {topTake && (
          <blockquote
            className="rounded-lg border p-3 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <p className="line-clamp-2 italic text-muted">“{topTake.take}”</p>
            <footer className="data mt-1 text-[11px] text-faint">@{topTake.username}</footer>
          </blockquote>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3">
          <Link href={`/item/${item.slug}`} className="btn-primary">
            Open the full evaluation
          </Link>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn-ghost">
            Source ↗
          </a>
          <span className="data ml-auto text-[11px] text-faint">
            {uses > 0 ? `${uses} using it · ` : ""}
            {item.commentCount} comments
          </span>
        </div>
      </div>
    </section>
  );
}
