import type { ItemSource, Evaluation } from "@aix/core";

/**
 * A candidate pulled from a source, before evaluation: the strict `ItemSource`
 * signal plus the free text (README / abstract) the evaluator reads. This is
 * the single unit that flows source → evaluate → publish.
 */
export type Discovered = {
  source: ItemSource;
  /** README (GitHub) or abstract (arXiv). Serves as the evaluator's "readme". */
  readme: string;
};

/** A source that can surface trending items and resolve a single submitted URL. */
export type DiscoverySource = {
  readonly name: string;
  /** Best-effort trending discovery, bounded by `limit` and an internal budget. */
  discoverTrending?(limit: number): Promise<Discovered[]>;
  /** Resolve a submitted link into a Discovered item, or null if not ours. */
  resolveUrl(url: string): Promise<Discovered | null>;
};

/**
 * A trending source plugged into the daily scan with its own budget and ranking.
 * The scan runs each in order (GitHub, ProductHunt, …), publishes up to `budget`
 * from each, and features the single highest-scored across all of them.
 */
export type TrendingSource = {
  readonly name: string;
  /** How many items to grade+publish from this source per scan. */
  budget: number;
  /** Fetch a candidate pool (bounded by `limit`). */
  discover: (limit: number) => Promise<Discovered[]>;
  /** Order the pool best-first by this source's own signal. */
  rank: (candidates: Discovered[], now: Date) => Discovered[];
};

/** Turns a Discovered candidate into a validated, publishable Evaluation. */
export type Evaluate = (d: Discovered) => Promise<Evaluation>;
