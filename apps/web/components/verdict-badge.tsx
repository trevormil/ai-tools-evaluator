import type { Verdict } from "@aix/core";

const STYLES: Record<Verdict, string> = {
  essential: "verdict-essential",
  worthwhile: "verdict-worthwhile",
  niche: "verdict-niche",
  marginal: "verdict-marginal",
  redundant: "verdict-redundant",
  "complexity-trap": "verdict-trap",
};

export function VerdictBadge({ verdict }: { verdict: Verdict | string }) {
  const cls = STYLES[verdict as Verdict] ?? "verdict-niche";
  return <span className={`verdict ${cls}`}>{String(verdict).replace("-", " ")}</span>;
}
