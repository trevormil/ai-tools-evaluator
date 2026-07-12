import { describe, expect, test } from "bun:test";
import { Evaluation, computeOverall } from "@aix/core";
import { run, type RunDeps } from "./index";
import { nullLogger } from "./logger";
import { rankCandidates } from "./rank";
import type { GitStore, QueuedFile } from "./store";
import type { Discovered, TrendingSource } from "./types";
import { makeDraft, makeGithubSource } from "./test-fixtures";

/** Build a valid Evaluation for a given externalId (used by the fake evaluate). */
function evalFor(externalId: string): Evaluation {
  const draft = makeDraft();
  return Evaluation.parse({
    schemaVersion: 1,
    slug: externalId.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    source: makeGithubSource({ externalId, url: `https://github.com/${externalId}` }),
    ...draft,
    overallScore: computeOverall(draft.scores),
    media: [],
    evaluatedBy: "ai",
    model: "test",
    evaluatedAt: "2026-07-06T00:00:00.000Z",
  });
}

type StoreCall = { op: string; arg?: unknown };

/**
 * A fake git-corpus store: an in-memory `known` dedup set, an array-backed queue,
 * and recorded `removeQueued` calls. `knownExternalIds` hands back a COPY so the
 * loop's local mutations don't leak back into the fake (matching the real store,
 * which re-reads the corpus from disk each call).
 */
function fakeStore(opts: {
  queued?: QueuedFile[];
  known?: Set<string>;
}): GitStore & { calls: StoreCall[]; removed: string[] } {
  const calls: StoreCall[] = [];
  const removed: string[] = [];
  const known = opts.known ?? new Set<string>();
  const queued = [...(opts.queued ?? [])];
  return {
    calls,
    removed,
    knownExternalIds() {
      calls.push({ op: "known" });
      return new Set(known);
    },
    listQueued(limit) {
      calls.push({ op: "listQueued", arg: limit });
      return queued.slice(0, limit);
    },
    removeQueued(file) {
      calls.push({ op: "removeQueued", arg: file });
      removed.push(file);
    },
    hasSlug(slug) {
      return known.has(slug);
    },
  };
}

/** A queued submission file (the shape `store.listQueued` returns). */
function q(url: string, submittedAt: string): QueuedFile {
  return { file: `${url.split("github.com/")[1] ?? url}.json`, url, source: "web", submittedAt };
}

/** A GitHub-style trending source (real star-velocity rank) for the loop tests. */
function ghSource(discover: () => Promise<Discovered[]>, budget = 10): TrendingSource {
  return { name: "github", budget, discover, rank: (c, now) => rankCandidates(c, now) };
}

/** A trending source that preserves the given order (for multi-source tests). */
function orderedSource(name: string, exts: string[], budget: number): TrendingSource {
  return {
    name,
    budget,
    discover: async () => exts.map((e) => trendingDiscovered(e)),
    rank: (c) => c,
  };
}

/** Deps builder that also exposes the published-order (via a writeArtifact spy). */
function makeDeps(overrides: Partial<RunDeps> = {}): { deps: RunDeps; writes: string[] } {
  const writes: string[] = [];
  const deps: RunDeps = {
    store: fakeStore({}),
    trendingSources: [ghSource(async () => [], 10)],
    resolveSubmission: async () => null,
    evaluate: async (d: Discovered) => evalFor(d.source.externalId),
    writeArtifact: async (e) => {
      writes.push(e.source.externalId);
    },
    cap: 10,
    trendingCap: 10,
    dryRun: false,
    now: () => new Date("2026-07-07T00:00:00.000Z"),
    log: nullLogger,
    ...overrides,
  };
  return { deps, writes };
}

const trendingDiscovered = (
  ext: string,
  source: Partial<Discovered["source"]> = {},
): Discovered => ({
  source: makeGithubSource({ externalId: ext, url: `https://github.com/${ext}`, ...source }),
  readme: "readme",
});

describe("run loop", () => {
  test("drains the queue BEFORE trending discovery, and removes each queue file", async () => {
    const store = fakeStore({
      queued: [
        q("https://github.com/q/one", "2026-07-01"),
        q("https://github.com/q/two", "2026-07-02"),
      ],
    });
    const resolveMap: Record<string, string> = {
      "https://github.com/q/one": "q/one",
      "https://github.com/q/two": "q/two",
    };

    const { deps, writes } = makeDeps({
      store,
      resolveSubmission: async (url) =>
        resolveMap[url] ? trendingDiscovered(resolveMap[url]!) : null,
      trendingSources: [
        ghSource(async () => [trendingDiscovered("trend/a"), trendingDiscovered("trend/b")]),
      ],
    });
    const result = await run(deps);

    // Queue items published first, in order, before any trending item.
    expect(writes).toEqual(["q/one", "q/two", "trend/a", "trend/b"]);
    expect(result.published).toBe(4);
    // Both queue files were removed after processing.
    expect(store.removed).toEqual(["q/one.json", "q/two.json"]);
    // Queue is listed before any trending discovery happens.
    const listIdx = store.calls.findIndex((c) => c.op === "listQueued");
    expect(listIdx).toBeGreaterThanOrEqual(0);
  });

  test("queue drains oldest-first regardless of the order the store returns", async () => {
    // The real store sorts by submittedAt; the loop must publish in that order.
    const store = fakeStore({
      queued: [
        q("https://github.com/q/old", "2026-07-01"),
        q("https://github.com/q/new", "2026-07-05"),
      ],
    });
    const { deps, writes } = makeDeps({
      store,
      resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
      trendingCap: 0,
    });
    await run(deps);
    expect(writes).toEqual(["q/old", "q/new"]);
  });

  test("trending is bounded by the master trending cap", async () => {
    const store = fakeStore({});
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 1, // only one trending slot this run
      trendingSources: [
        ghSource(async () => ["t/a", "t/b", "t/c"].map((e) => trendingDiscovered(e)), 10),
      ],
    });
    const result = await run(deps);
    expect(result.published).toBe(1);
    expect(writes).toEqual(["t/a"]);
  });

  test("runs multiple sources with per-source budgets, picking the single best across ALL", async () => {
    const store = fakeStore({});
    // ph/a is the highest score across BOTH sources → it must be THE pick.
    const scores: Record<string, number> = { "gh/a": 60, "gh/b": 55, "ph/a": 91, "ph/b": 70 };
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 10,
      trendingSources: [
        orderedSource("github", ["gh/a", "gh/b"], 2),
        orderedSource("producthunt", ["ph/a", "ph/b"], 2),
      ],
      evaluate: async (d) => ({
        ...evalFor(d.source.externalId),
        overallScore: scores[d.source.externalId]!,
      }),
    });
    const result = await run(deps);
    expect(result.published).toBe(4); // 2 from each source (the 5+5 mix, scaled down)
    expect(writes).toEqual(["gh/a", "gh/b", "ph/a", "ph/b"]);
    expect(result.pick?.source.externalId).toBe("ph/a"); // single best across both sources
  });

  test("the master trending cap bounds the total across sources", async () => {
    const store = fakeStore({});
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 3, // less than the 2+2 the sources would otherwise publish
      trendingSources: [
        orderedSource("github", ["gh/a", "gh/b"], 2),
        orderedSource("producthunt", ["ph/a", "ph/b"], 2),
      ],
    });
    const result = await run(deps);
    // github fills 2, producthunt gets the remaining 1 → 3 total.
    expect(result.published).toBe(3);
    expect(writes).toEqual(["gh/a", "gh/b", "ph/a"]);
  });

  test("the per-run cap bounds the queue drain", async () => {
    const store = fakeStore({
      queued: [1, 2, 3, 4, 5].map((n) => q(`https://github.com/q/${n}`, `2026-07-0${n}`)),
    });
    const { deps, writes } = makeDeps({
      store,
      cap: 2, // circuit breaker: max 2 per run
      trendingCap: 0,
      resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
    });
    const result = await run(deps);
    expect(result.published).toBe(2);
    expect(writes).toEqual(["q/1", "q/2"]);
    // listQueued was asked for at most `cap` items.
    expect(store.calls.find((c) => c.op === "listQueued")?.arg).toBe(2);
  });

  test("queue: a duplicate (already in the corpus) is skipped, removed, and not published", async () => {
    const store = fakeStore({
      known: new Set(["q/dup"]),
      queued: [
        q("https://github.com/q/dup", "2026-07-01"),
        q("https://github.com/q/new", "2026-07-02"),
      ],
    });
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 0,
      resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
    });
    const result = await run(deps);
    expect(writes).toEqual(["q/new"]); // dup never written
    expect(result.published).toBe(1);
    expect(result.skippedDuplicate).toBe(1);
    // Both queue files removed — the duplicate is drained too, not left to retry forever.
    expect(store.removed).toEqual(["q/dup.json", "q/new.json"]);
  });

  test("queue: an unresolvable submission is dropped (removed, not published)", async () => {
    const store = fakeStore({
      queued: [
        q("https://github.com/q/bad", "2026-07-01"),
        q("https://github.com/q/ok", "2026-07-02"),
      ],
    });
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 0,
      resolveSubmission: async (url) =>
        url.endsWith("/bad") ? null : trendingDiscovered(url.split("github.com/")[1]!),
    });
    const result = await run(deps);
    expect(writes).toEqual(["q/ok"]);
    expect(result.published).toBe(1);
    expect(store.removed).toEqual(["q/bad.json", "q/ok.json"]);
  });

  test("a single failed evaluation is skipped, not fatal — the rest still publish", async () => {
    const store = fakeStore({});
    const { deps, writes } = makeDeps({
      store,
      trendingSources: [
        ghSource(async () => ["t/good1", "t/bad", "t/good2"].map((e) => trendingDiscovered(e))),
      ],
      evaluate: async (d: Discovered) => {
        if (d.source.externalId === "t/bad") throw new Error("schema never repaired");
        return evalFor(d.source.externalId);
      },
    });
    const result = await run(deps);
    // The bad item is skipped; the two good ones publish and the run succeeds.
    expect(writes).toEqual(["t/good1", "t/good2"]);
    expect(result.published).toBe(2);
  });

  test("a failed queue evaluation is dropped from the queue and doesn't abort the drain", async () => {
    const store = fakeStore({
      queued: [
        q("https://github.com/q/boom", "2026-07-01"),
        q("https://github.com/q/ok", "2026-07-02"),
      ],
    });
    const { deps, writes } = makeDeps({
      store,
      trendingCap: 0,
      resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
      evaluate: async (d) => {
        if (d.source.externalId === "q/boom") throw new Error("eval blew up");
        return evalFor(d.source.externalId);
      },
    });
    const result = await run(deps);
    expect(writes).toEqual(["q/ok"]);
    expect(result.published).toBe(1);
    expect(store.removed).toEqual(["q/boom.json", "q/ok.json"]);
  });

  test("the highest-scored published item across queue + trending is returned as the pick", async () => {
    const store = fakeStore({ queued: [q("https://github.com/q/a", "2026-07-01")] });
    const scores: Record<string, number> = { "q/a": 50, "t/a": 82, "t/b": 71 };
    const { deps } = makeDeps({
      store,
      trendingCap: 10,
      resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
      trendingSources: [orderedSource("github", ["t/a", "t/b"], 2)],
      evaluate: async (d) => ({
        ...evalFor(d.source.externalId),
        overallScore: scores[d.source.externalId]!,
      }),
    });
    const result = await run(deps);
    // t/a (82) outscores both the queue item q/a (50) and t/b (71).
    expect(result.pick?.source.externalId).toBe("t/a");
    expect(result.published).toBe(3); // q/a + t/a + t/b
  });

  const NOW = new Date("2026-07-07T00:00:00.000Z");
  const veloRepo = (ext: string, stars: number, daysOld: number): Discovered =>
    trendingDiscovered(ext, {
      stars,
      createdAt: new Date(NOW.getTime() - daysOld * 86_400_000).toISOString(),
    });

  test("a budget of 1 publishes only the single highest-velocity pick", async () => {
    const store = fakeStore({});
    const { deps, writes } = makeDeps({
      store,
      trendingSources: [
        ghSource(
          async () => [
            veloRepo("t/slow", 1000, 1000),
            veloRepo("t/fast", 5000, 10),
            veloRepo("t/mid", 2000, 40),
          ],
          1,
        ),
      ],
    });
    const result = await run(deps);
    expect(writes).toEqual(["t/fast"]);
    expect(result.published).toBe(1);
  });

  test("pre-eval dedup: already-graded candidates are dropped before grading", async () => {
    const evaluated: string[] = [];
    const store = fakeStore({
      known: new Set(["t/fast"]), // the top pick is already in the catalog
    });
    const { deps, writes } = makeDeps({
      store,
      evaluate: async (d: Discovered) => {
        evaluated.push(d.source.externalId);
        return evalFor(d.source.externalId);
      },
      trendingSources: [
        ghSource(async () => [veloRepo("t/fast", 5000, 10), veloRepo("t/fresh", 3000, 30)], 1),
      ],
    });
    const result = await run(deps);
    // The known top pick is never graded; the next-best fresh one is chosen.
    expect(evaluated).toEqual(["t/fresh"]);
    expect(writes).toEqual(["t/fresh"]);
    expect(result.published).toBe(1);
  });

  test("dry-run evaluates but never publishes or touches the store", async () => {
    const store = fakeStore({ queued: [q("https://github.com/q/one", "2026-07-01")] });
    const { deps, writes } = makeDeps({
      store,
      dryRun: true,
      trendingSources: [
        ghSource(async () => [trendingDiscovered("t/a"), trendingDiscovered("t/b")]),
      ],
    });
    const result = await run(deps);
    expect(result.published).toBe(0);
    expect(writes).toHaveLength(0);
    expect(store.calls).toHaveLength(0); // no store interaction at all in dry-run
    expect(store.removed).toHaveLength(0);
  });
});
