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

/** Turns a Discovered candidate into a validated, publishable Evaluation. */
export type Evaluate = (d: Discovered) => Promise<Evaluation>;
