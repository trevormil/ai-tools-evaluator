import type { Verdict } from "@aix/core";

const STYLES: Record<Verdict, string> = {
  essential: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  worthwhile: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  niche: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  marginal: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  redundant: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "complexity-trap": "bg-rose-200 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200",
};

export function VerdictBadge({ verdict }: { verdict: Verdict | string }) {
  const cls = STYLES[verdict as Verdict] ?? "bg-neutral-200 text-neutral-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls}`}>
      {String(verdict).replace("-", " ")}
    </span>
  );
}
