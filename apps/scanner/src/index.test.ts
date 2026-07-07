import { describe, expect, test } from "bun:test";
import { Evaluation, computeOverall } from "@aix/core";
import { run, type RunDeps } from "./index";
import { nullLogger } from "./logger";
import type { InternalClient, Submission } from "./client";
import type { Discovered } from "./types";
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

type ClientCall = { op: string; arg?: unknown };

/** A fake internal client that records calls and drives cap/queue behavior. */
function fakeClient(opts: {
  remaining: number; // trending budget remaining
  queued: Submission[];
  duplicates?: Set<string>; // externalIds that should report duplicate on publish
  known?: Set<string>; // externalIds already graded (pre-eval dedup)
  submissionRemaining?: number; // submission budget remaining (default: plenty)
}): InternalClient & { calls: ClientCall[]; publishedOrder: string[] } {
  const calls: ClientCall[] = [];
  const publishedOrder: string[] = [];
  const dups = opts.duplicates ?? new Set<string>();
  const known = opts.known ?? new Set<string>();
  return {
    calls,
    publishedOrder,
    async getCap() {
      calls.push({ op: "getCap" });
      return {
        date: "2026-07-06",
        publishedToday: 0,
        remaining: opts.remaining,
        dailyCap: 10,
        submissions: { publishedToday: 0, remaining: opts.submissionRemaining ?? 999, cap: 50 },
      };
    },
    async filterKnown(candidates) {
      calls.push({ op: "filterKnown", arg: candidates.map((c) => c.externalId) });
      return new Set(candidates.map((c) => c.externalId).filter((id) => known.has(id)));
    },
    async listQueuedSubmissions(limit) {
      calls.push({ op: "listQueued", arg: limit });
      return opts.queued.slice(0, limit);
    },
    async publishItem(evaluation, submissionId) {
      const ext = evaluation.source.externalId;
      calls.push({ op: "publish", arg: { ext, submissionId } });
      if (dups.has(ext)) return { duplicate: true, item: { id: `existing-${ext}` } };
      publishedOrder.push(ext);
      return { duplicate: false, item: { id: `item-${ext}` } };
    },
    async patchSubmission(id, body) {
      calls.push({ op: "patch", arg: { id, ...body } });
    },
    async openScanRun() {
      calls.push({ op: "openRun" });
      return 1;
    },
    async closeScanRun(_id, body) {
      // Mirror the server contract (scan-runs/[id] validates z.enum(["success","error"]))
      // so a drifting status literal fails here the way it fails in production.
      if (body.status !== "success" && body.status !== "error") {
        throw new Error(
          `PATCH /api/internal/scan-runs/1 -> 400 invalid status ${String(body.status)}`,
        );
      }
      calls.push({ op: "closeRun", arg: body });
    },
  };
}

function baseDeps(overrides: Partial<RunDeps>): RunDeps {
  const writes: string[] = [];
  return {
    client: fakeClient({ remaining: 10, queued: [] }),
    discoverTrending: async () => [],
    resolveSubmission: async () => null,
    evaluate: async (d: Discovered) => evalFor(d.source.externalId),
    writeArtifact: async (e) => writes.push(e.slug),
    cap: 10,
    // Existing loop-mechanics tests assume trending can publish multiple; the
    // top-1 behavior is covered by its own tests below with trendingPicks: 1.
    trendingPicks: 10,
    dryRun: false,
    now: () => new Date("2026-07-07T00:00:00.000Z"),
    log: nullLogger,
    ...overrides,
  };
}

const trendingDiscovered = (
  ext: string,
  source: Partial<Discovered["source"]> = {},
): Discovered => ({
  source: makeGithubSource({ externalId: ext, url: `https://github.com/${ext}`, ...source }),
  readme: "readme",
});

describe("run loop", () => {
  test("drains the queue BEFORE trending discovery", async () => {
    const client = fakeClient({
      remaining: 10,
      queued: [
        { id: "s1", url: "https://github.com/q/one", status: "queued" },
        { id: "s2", url: "https://github.com/q/two", status: "queued" },
      ],
    });
    const resolveMap: Record<string, string> = {
      "https://github.com/q/one": "q/one",
      "https://github.com/q/two": "q/two",
    };

    const result = await run(
      baseDeps({
        client,
        resolveSubmission: async (url) =>
          resolveMap[url] ? trendingDiscovered(resolveMap[url]!) : null,
        discoverTrending: async () => [
          trendingDiscovered("trend/a"),
          trendingDiscovered("trend/b"),
        ],
      }),
    );

    // Queue items published first, in order, before any trending item.
    expect(client.publishedOrder).toEqual(["q/one", "q/two", "trend/a", "trend/b"]);
    expect(result.published).toBe(4);
    // discoverTrending must be asked only AFTER the queue is listed.
    const listIdx = client.calls.findIndex((c) => c.op === "listQueued");
    const firstTrendPublish = client.calls.findIndex(
      (c) => c.op === "publish" && (c.arg as { ext: string }).ext.startsWith("trend/"),
    );
    const firstQueuePublish = client.calls.findIndex(
      (c) => c.op === "publish" && (c.arg as { ext: string }).ext.startsWith("q/"),
    );
    expect(listIdx).toBeGreaterThanOrEqual(0);
    expect(firstQueuePublish).toBeLessThan(firstTrendPublish);
  });

  test("the trending pick respects the trending cap (server remaining)", async () => {
    const client = fakeClient({ remaining: 1, queued: [] }); // only 1 trending slot left
    const result = await run(
      baseDeps({
        client,
        trendingPicks: 10,
        discoverTrending: async () => ["t/a", "t/b", "t/c"].map((e) => trendingDiscovered(e)),
      }),
    );
    expect(result.published).toBe(1);
    expect(client.publishedOrder).toEqual(["t/a"]);
  });

  test("the queue drains against the submission budget even when trending is exhausted", async () => {
    // The TerMinal case: trending cap is 0, but human submissions still process.
    const client = fakeClient({
      remaining: 0, // trending exhausted
      submissionRemaining: 3, // 3 submissions left today
      queued: [
        { id: "s1", url: "https://github.com/q/one", status: "queued" },
        { id: "s2", url: "https://github.com/q/two", status: "queued" },
        { id: "s3", url: "https://github.com/q/three", status: "queued" },
        { id: "s4", url: "https://github.com/q/four", status: "queued" },
      ],
    });
    const result = await run(
      baseDeps({
        client,
        cap: 10,
        trendingPicks: 0,
        resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
      }),
    );
    // 3 processed (submission budget), not blocked by the 0 trending cap.
    expect(result.published).toBe(3);
    expect(client.publishedOrder).toEqual(["q/one", "q/two", "q/three"]);
  });

  test("the per-run circuit breaker (deps.cap) bounds the queue below the daily submission budget", async () => {
    const client = fakeClient({
      remaining: 0,
      submissionRemaining: 50,
      queued: [1, 2, 3, 4, 5].map((n) => ({
        id: `s${n}`,
        url: `https://github.com/q/${n}`,
        status: "queued",
      })),
    });
    const result = await run(
      baseDeps({
        client,
        cap: 2, // circuit breaker: max 2 per run
        trendingPicks: 0,
        resolveSubmission: async (url) => trendingDiscovered(url.split("github.com/")[1]!),
      }),
    );
    expect(result.published).toBe(2);
  });

  test("treats server-side duplicates as skips, not publishes", async () => {
    const client = fakeClient({
      remaining: 10,
      queued: [],
      duplicates: new Set(["t/dup"]),
    });
    const result = await run(
      baseDeps({
        client,
        discoverTrending: async () => [trendingDiscovered("t/dup"), trendingDiscovered("t/new")],
      }),
    );
    expect(client.publishedOrder).toEqual(["t/new"]);
    expect(result.skippedDuplicate).toBe(1);
    expect(result.published).toBe(1);
  });

  test("closes a successful run with the server-accepted 'success' status", async () => {
    const client = fakeClient({ remaining: 10, queued: [] });
    await run(
      baseDeps({
        client,
        discoverTrending: async () => [trendingDiscovered("t/a")],
      }),
    );
    const close = client.calls.find((c) => c.op === "closeRun")!.arg as { status: string };
    expect(close.status).toBe("success");
  });

  test("closes the scan-run with error and rethrows on failure", async () => {
    const client = fakeClient({ remaining: 10, queued: [] });
    const boom = baseDeps({
      client,
      discoverTrending: async () => {
        throw new Error("discovery blew up");
      },
    });
    await expect(run(boom)).rejects.toThrow("discovery blew up");
    const close = client.calls.find((c) => c.op === "closeRun")!.arg as { status: string };
    expect(close.status).toBe("error");
  });

  test("a single failed evaluation is skipped, not fatal — the rest still publish", async () => {
    const client = fakeClient({ remaining: 10, queued: [] });
    const result = await run(
      baseDeps({
        client,
        discoverTrending: async () =>
          ["t/good1", "t/bad", "t/good2"].map((e) => trendingDiscovered(e)),
        evaluate: async (d: Discovered) => {
          if (d.source.externalId === "t/bad") throw new Error("schema never repaired");
          return evalFor(d.source.externalId);
        },
      }),
    );
    // The bad item is skipped; the two good ones publish and the run succeeds.
    expect(client.publishedOrder).toEqual(["t/good1", "t/good2"]);
    expect(result.published).toBe(2);
    const close = client.calls.find((c) => c.op === "closeRun")!.arg as { status: string };
    expect(close.status).toBe("success");
  });

  const NOW = new Date("2026-07-07T00:00:00.000Z");
  const veloRepo = (ext: string, stars: number, daysOld: number): Discovered =>
    trendingDiscovered(ext, {
      stars,
      createdAt: new Date(NOW.getTime() - daysOld * 86_400_000).toISOString(),
    });

  test("trendingPicks=1 publishes only the single highest-velocity pick", async () => {
    const client = fakeClient({ remaining: 10, queued: [] });
    const result = await run(
      baseDeps({
        client,
        trendingPicks: 1,
        // fast = 500 stars/day, mid = 50/day, slow = 1/day
        discoverTrending: async () => [
          veloRepo("t/slow", 1000, 1000),
          veloRepo("t/fast", 5000, 10),
          veloRepo("t/mid", 2000, 40),
        ],
      }),
    );
    expect(client.publishedOrder).toEqual(["t/fast"]);
    expect(result.published).toBe(1);
  });

  test("pre-eval dedup: already-graded candidates are dropped before grading", async () => {
    const evaluated: string[] = [];
    const client = fakeClient({
      remaining: 10,
      queued: [],
      known: new Set(["t/fast"]), // the top pick is already in the catalog
    });
    const result = await run(
      baseDeps({
        client,
        trendingPicks: 1,
        evaluate: async (d: Discovered) => {
          evaluated.push(d.source.externalId);
          return evalFor(d.source.externalId);
        },
        discoverTrending: async () => [veloRepo("t/fast", 5000, 10), veloRepo("t/fresh", 3000, 30)],
      }),
    );
    // The known top pick is never graded; the next-best fresh one is chosen.
    expect(evaluated).toEqual(["t/fresh"]);
    expect(client.publishedOrder).toEqual(["t/fresh"]);
    expect(result.published).toBe(1);
  });

  test("dry-run evaluates but never publishes or opens a scan-run", async () => {
    const client = fakeClient({ remaining: 10, queued: [] });
    const result = await run(
      baseDeps({
        client,
        dryRun: true,
        discoverTrending: async () => [trendingDiscovered("t/a"), trendingDiscovered("t/b")],
      }),
    );
    expect(result.published).toBe(0);
    expect(client.calls).toHaveLength(0); // no client interaction at all in dry-run
  });
});
