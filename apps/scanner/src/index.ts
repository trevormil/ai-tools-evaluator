import type { Evaluation } from "@aix/core";
import { loadEnv, requireLiveSecrets, type ScannerEnv } from "./env";
import { createLogger, type Logger } from "./logger";
import { createGitHubSource, createArxivSource } from "./sources";
import { createAnthropicModel, createOpenRouterModel, evaluateItem } from "./evaluate";
import { rankCandidates } from "./rank";
import { buildMedia, coverImageUrl } from "./media";
import { createInternalClient, type InternalClient } from "./client";
import { writeArtifact } from "./artifact";
import type { Discovered } from "./types";

/**
 * The run loop. Everything the loop needs is injected so it is fully testable
 * with fakes (no network, no model, no filesystem).
 */
export type RunDeps = {
  client: InternalClient;
  discoverTrending: (limit: number) => Promise<Discovered[]>;
  resolveSubmission: (url: string) => Promise<Discovered | null>;
  evaluate: (d: Discovered) => Promise<Evaluation>;
  writeArtifact: (e: Evaluation) => Promise<unknown>;
  /** Local daily cap (AIX_DAILY_CAP); the real bound is min(this, server remaining). */
  cap: number;
  /** Trending items to publish per scan (the daily pick). Default 1. */
  trendingPicks: number;
  dryRun: boolean;
  now: () => Date;
  log: Logger;
};

export type RunResult = {
  discovered: number;
  published: number;
  skippedDuplicate: number;
};

/**
 * One scan pass (architecture.md §4):
 *   1. drain the suggestion queue FIRST (oldest queued submissions),
 *   2. trending discovery fills the remainder,
 *   3. dedup is server-side (`publish` idempotent → treat `duplicate` as skip),
 *   4. cap total published at min(server remaining, local cap),
 *   5. export each published item as a strict `.md` artifact.
 * Dry-run discovers + evaluates but never publishes or writes — it prints.
 */
export async function run(deps: RunDeps): Promise<RunResult> {
  if (deps.dryRun) return runDry(deps);

  const { client, discoverTrending, resolveSubmission, evaluate, log } = deps;
  const runId = await client.openScanRun("scanner");

  let discovered = 0;
  let published = 0;
  let skippedDuplicate = 0;

  try {
    const capInfo = await client.getCap();
    // Two INDEPENDENT budgets so trending never starves submissions (and vice
    // versa): the queue drains against the submission cap (bounded per-run by
    // deps.cap, the circuit breaker); the trending pick draws from DAILY_CAP.
    const subRemaining = capInfo.submissions?.remaining ?? capInfo.remaining;
    const queueBudget = Math.max(0, Math.min(deps.cap, subRemaining));
    const trendBudget = Math.max(0, Math.min(deps.trendingPicks, capInfo.remaining));
    log.info(
      `cap: trending=${capInfo.remaining} submissions=${subRemaining} queueBudget=${queueBudget} trendBudget=${trendBudget}`,
    );

    // 1) DRAIN THE QUEUE (bounded by the submission budget).
    let queuePublished = 0;
    if (queueBudget > 0) {
      const subs = await client.listQueuedSubmissions(queueBudget);
      log.info(`draining ${subs.length} queued submission(s)`);
      for (const sub of subs) {
        if (queuePublished >= queueBudget) break;
        discovered++;
        await client.patchSubmission(sub.id, { status: "processing" });
        const d = await resolveSubmission(sub.url);
        if (!d) {
          await client.patchSubmission(sub.id, {
            status: "failed",
            reason: "could not resolve url",
          });
          continue;
        }
        let evaluation: Evaluation;
        try {
          evaluation = await evaluate(d);
        } catch (err) {
          // A single failed evaluation must not abort the whole scan.
          log.warn(`eval failed for submission ${sub.id}, skipping: ${String(err)}`);
          await client.patchSubmission(sub.id, { status: "failed", reason: "evaluation failed" });
          continue;
        }
        const res = await client.publishItem(evaluation, String(sub.id), d.readme);
        if (res.duplicate) {
          skippedDuplicate++;
          const itemId = res.item?.["id"];
          await client.patchSubmission(sub.id, {
            status: "duplicate",
            itemId: itemId != null ? String(itemId) : undefined,
          });
          continue;
        }
        published++;
        queuePublished++;
        await deps.writeArtifact(evaluation);
        log.info(
          `published (queue) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`,
        );
      }
    }

    // 2) TRENDING PICK(S): fetch a pool of ~20, drop already-graded candidates,
    //    rank by trending (recent star velocity, heavily weighted), and grade
    //    only the top `trendingPicks` (default 1 — the daily Discord pick). If
    //    the top pick fails to grade/publish, we fall through to the next best.
    const want = trendBudget;
    if (want > 0) {
      const pool = await discoverTrending(20);
      const known = await client.filterKnown(
        pool.map((d) => ({ kind: d.source.kind, externalId: d.source.externalId })),
      );
      const fresh = pool.filter((d) => !known.has(d.source.externalId));
      const ranked = rankCandidates(fresh, deps.now());
      log.info(
        `trending: pool=${pool.length} fresh=${fresh.length} (dropped ${pool.length - fresh.length} known) picking top ${want}`,
      );
      let picked = 0;
      for (const d of ranked) {
        if (picked >= want) break;
        discovered++;
        let evaluation: Evaluation;
        try {
          evaluation = await evaluate(d);
        } catch (err) {
          // One malformed evaluation must not abort the scan — try the next best.
          log.warn(`eval failed for ${d.source.externalId}, skipping: ${String(err)}`);
          continue;
        }
        const res = await client.publishItem(evaluation, undefined, d.readme);
        if (res.duplicate) {
          skippedDuplicate++;
          continue;
        }
        published++;
        picked++;
        await deps.writeArtifact(evaluation);
        log.info(
          `published (pick) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`,
        );
      }
    }

    await client.closeScanRun(runId, {
      status: "success",
      discovered,
      published,
      skippedDuplicate,
    });
    return { discovered, published, skippedDuplicate };
  } catch (err) {
    await client
      .closeScanRun(runId, {
        status: "error",
        discovered,
        published,
        skippedDuplicate,
        error: String(err),
      })
      .catch(() => {});
    throw err;
  }
}

async function runDry(deps: RunDeps): Promise<RunResult> {
  const { discoverTrending, evaluate, cap, log } = deps;
  log.info("DRY RUN — discovering + ranking + evaluating, nothing will be published");
  // Mirror the real path: rank the pool by trending, preview the top `cap`.
  const candidates = rankCandidates(await discoverTrending(20), deps.now());
  let evaluated = 0;
  for (const d of candidates.slice(0, cap)) {
    const evaluation = await evaluate(d);
    evaluated++;
    log.info(
      `[dry-run] ${evaluation.slug} — ${evaluation.verdict} (${evaluation.overallScore}) — ${evaluation.tagline}`,
    );
    console.log(
      JSON.stringify(
        {
          slug: evaluation.slug,
          category: evaluation.category,
          integration: evaluation.integration,
          verdict: evaluation.verdict,
          overallScore: evaluation.overallScore,
          noiseScore: evaluation.noiseScore,
          coverImageUrl: coverImageUrl(evaluation.media),
        },
        null,
        2,
      ),
    );
  }
  log.info(`dry-run evaluated ${evaluated} item(s)`);
  return { discovered: candidates.length, published: 0, skippedDuplicate: 0 };
}

/** Wire the real dependencies from env and run one pass. */
async function main(): Promise<void> {
  const env: ScannerEnv = loadEnv();
  requireLiveSecrets(env);
  const log = createLogger(env.AIX_DRY_RUN ? "debug" : "info");

  const github = createGitHubSource({
    token: env.GITHUB_TOKEN!,
    log,
    quality: { minStars: env.AIX_MIN_STARS, minStarVelocity: env.AIX_MIN_STAR_VELOCITY },
  });
  const arxiv = createArxivSource({ log });
  // Prefer OpenRouter (cheap) when its key is present; else fall back to Anthropic.
  const model = env.OPENROUTER_API_KEY
    ? createOpenRouterModel({ apiKey: env.OPENROUTER_API_KEY, model: env.AIX_MODEL })
    : createAnthropicModel({ apiKey: env.ANTHROPIC_API_KEY!, model: env.AIX_MODEL });
  log.info(`model: ${env.AIX_MODEL} via ${env.OPENROUTER_API_KEY ? "openrouter" : "anthropic"}`);

  const evaluate = (d: Discovered) =>
    evaluateItem(d, { model, modelName: env.AIX_MODEL, deriveMedia: buildMedia });

  // Candidates are GitHub repos only (papers excluded for now). arXiv is kept
  // solely to resolve an explicit human-submitted paper URL.
  const discoverTrending = async (limit: number): Promise<Discovered[]> =>
    github.discoverTrending!(limit);

  const resolveSubmission = async (url: string): Promise<Discovered | null> =>
    (await github.resolveUrl(url)) ?? (await arxiv.resolveUrl(url));

  const client = createInternalClient({
    baseUrl: env.AIX_WEB_URL,
    token: env.AIX_INTERNAL_TOKEN ?? "",
  });

  const result = await run({
    client,
    discoverTrending,
    resolveSubmission,
    evaluate,
    writeArtifact: env.AIX_DRY_RUN ? async () => {} : (e: Evaluation) => writeArtifact(e),
    cap: env.AIX_DAILY_CAP,
    trendingPicks: env.AIX_TRENDING_PICKS,
    dryRun: env.AIX_DRY_RUN,
    now: () => new Date(),
    log,
  });

  log.info(`done: ${JSON.stringify(result)}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
