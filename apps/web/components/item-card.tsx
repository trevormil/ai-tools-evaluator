import Link from "next/link";
import { CATEGORY_LABELS, type Category } from "@aix/core";
import type { Item } from "@aix/db";
import { VerdictBadge } from "./verdict-badge";

/** Directory card: cover, verdict, score, category + integration chips, tagline. */
export function ItemCard({ item }: { item: Item }) {
  const tags: string[] = safeParse(item.tagsJson);
  return (
    <Link
      href={`/item/${item.slug}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-neutral-300 dark:text-neutral-600">
            {item.title.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white">
          {item.overallScore}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <VerdictBadge verdict={item.verdict} />
          <span className="text-xs text-neutral-400">noise {item.noiseScore}</span>
        </div>
        <h3 className="line-clamp-1 font-semibold">{item.title}</h3>
        <p className="line-clamp-2 flex-1 text-sm text-neutral-600 dark:text-neutral-400">{item.tagline}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="chip">{CATEGORY_LABELS[item.category as Category] ?? item.category}</span>
          <span className="chip">{item.integration}</span>
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
