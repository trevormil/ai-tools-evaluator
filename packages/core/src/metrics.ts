/**
 * The scorecard. Every item is rated on these ten metrics, each 0–100 with a
 * short rationale, and reduced to one weighted `overallScore`. Weights sum to 1.
 *
 * Convention: HIGHER IS ALWAYS BETTER. Metrics that are naturally costs
 * (complexity, adoption effort) are phrased as their inverse ("leanness",
 * "ease") so the whole card reads the same direction — green good, red bad.
 */
export const METRICS = [
  { key: "novelty", label: "Novelty", weight: 0.14, desc: "How genuinely new is the capability vs. a repackaging of existing ideas?" },
  { key: "utility", label: "Utility", weight: 0.16, desc: "How useful in real day-to-day work, not in a demo?" },
  { key: "deltaVsBaseline", label: "Δ vs. Baseline", weight: 0.16, desc: "How much better than a capable vanilla agent doing it unaided?" },
  { key: "easeOfAdoption", label: "Ease of Adoption", weight: 0.10, desc: "How cheap to set up and integrate (higher = easier)?" },
  { key: "maturity", label: "Maturity", weight: 0.08, desc: "Stability, docs, tests, release cadence." },
  { key: "leanness", label: "Leanness", weight: 0.10, desc: "How few moving parts it adds (higher = less complexity introduced)." },
  { key: "traction", label: "Traction", weight: 0.07, desc: "Real adoption momentum — stars velocity, usage, citations." },
  { key: "composability", label: "Composability", weight: 0.07, desc: "Plays well alongside your existing tools and workflow." },
  { key: "longevity", label: "Longevity", weight: 0.07, desc: "Will it still matter in 6–12 months, or will the base model absorb it?" },
  { key: "clarity", label: "Clarity", weight: 0.05, desc: "Quality of docs / README / paper — can you actually understand it?" },
] as const;

export type MetricKey = (typeof METRICS)[number]["key"];

export const METRIC_KEYS = METRICS.map((m) => m.key) as MetricKey[];

/** Weighted mean of the ten metric scores, rounded to an int 0–100. */
export function computeOverall(scores: Record<MetricKey, { score: number }>): number {
  const total = METRICS.reduce((acc, m) => acc + scores[m.key].score * m.weight, 0);
  return Math.round(total);
}

/** Map a numeric score to a coarse band for UI coloring / verdict sanity checks. */
export function scoreBand(n: number): "strong" | "solid" | "mixed" | "weak" {
  if (n >= 80) return "strong";
  if (n >= 60) return "solid";
  if (n >= 40) return "mixed";
  return "weak";
}
