import type { Evaluation } from "@aix/core";
import { loadEnv, requireLiveSecrets, type ScannerEnv } from "./env";
import { createLogger, type Logger } from "./logger";
import {
  createGitHubSource,
  createArxivSource,
  createProductHuntSource,
  rankByUpvotes,
} from "./sources";
import { createAnthropicModel, createOpenRouterModel, evaluateItem } from "./evaluate";
import { rankCandidates } from "./rank";
import { buildMedia, coverImageUrl } from "./media";
import { createInternalClient, type InternalClient } from "./client";
import { writeArtifact } from "./artifact";
import type { Discovered, TrendingSource } from "./types";

/**
 * The run loop. Everything the loop needs is injected so it is fully testable
 * with fakes (no network, no model, no filesystem).
 */
export type RunDeps = {
  client: InternalClient;
  /** Trending sources (GitHub, ProductHunt, …), each with its own budget + rank. */
  trendingSources: TrendingSource[];
  resolveSubmission: (url: string) => Promise<Discovered | null>;
  evaluate: (d: Discovered) => Promise<Evaluation>;
  writeArtifact: (e: Evaluation) => Promise<unknown>;
  /** Local daily cap (AIX_DAILY_CAP); the real bound is min(this, server remaining). */
  cap: number;
  /** Master cap on total trending published per scan (AIX_TRENDING_PICKS; 0 = off). */
  trendingCap: number;
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

  const { client, resolveSubmission, evaluate, log } = deps;
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
    // Total trending is bounded by the master cap (0 = queue-only) AND the
    // server's remaining daily budget; per-source budgets divide it up below.
    const totalCap = Math.max(0, Math.min(deps.trendingCap, capInfo.remaining));
    log.info(
      `cap: trending=${capInfo.remaining} submissions=${subRemaining} queueBudget=${queueBudget} totalCap=${totalCap}`,
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

    // 2) TRENDING (multi-source): each source (GitHub, ProductHunt, …) grades up
    //    to its own budget, bounded in total by `totalCap`. All graded items
    //    publish; only the single highest-scored across ALL sources is stamped
    //    the featured daily pick (the rest are runners-up), so the directory
    //    grows ~10/day while Discord still posts exactly one (the digest picks
    //    the top score in its window, guarded once per UTC day).
    if (totalCap > 0) {
      const graded: { d: Discovered; evaluation: Evaluation }[] = [];
      let capLeft = totalCap;
      for (const src of deps.trendingSources) {
        if (capLeft <= 0) break;
        const want = Math.min(src.budget, capLeft);
        if (want <= 0) continue;
        const pool = await src.discover(20);
        const known = await client.filterKnown(
          pool.map((d) => ({ kind: d.source.kind, externalId: d.source.externalId })),
        );
        const fresh = pool.filter((d) => !known.has(d.source.externalId));
        const ranked = src.rank(fresh, deps.now());
        log.info(
          `trending[${src.name}]: pool=${pool.length} fresh=${fresh.length} (dropped ${pool.length - fresh.length} known) grading top ${want}`,
        );
        // Grade up to `want` from this source. A malformed eval is skipped, not fatal.
        let gradedFromSrc = 0;
        for (const d of ranked) {
          if (gradedFromSrc >= want) break;
          discovered++;
          try {
            graded.push({ d, evaluation: await evaluate(d) });
            gradedFromSrc++;
          } catch (err) {
            log.warn(`eval failed for ${d.source.externalId}, skipping: ${String(err)}`);
          }
        }
        capLeft -= gradedFromSrc;
      }

      // Exactly ONE featured daily pick — the highest-scored across ALL sources
      // (agreeing with the digest/home, which choose by score). The rest publish
      // as runners-up so the directory grows without extra Discord posts.
      const pickSlug = graded.reduce<{ slug: string; score: number } | null>((best, g) => {
        if (!best || g.evaluation.overallScore > best.score) {
          return { slug: g.evaluation.slug, score: g.evaluation.overallScore };
        }
        return best;
      }, null)?.slug;

      for (const { d, evaluation } of graded) {
        const isPick = evaluation.slug === pickSlug;
        const res = await client.publishItem(evaluation, undefined, d.readme, {
          dailyPick: isPick,
        });
        if (res.duplicate) {
          skippedDuplicate++;
          continue;
        }
        published++;
        await deps.writeArtifact(evaluation);
        log.info(
          `published (${isPick ? "pick" : "runner-up"}) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`,
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
  const { trendingSources, evaluate, log } = deps;
  log.info("DRY RUN — discovering + ranking + evaluating, nothing will be published");
  // Mirror the real path per source: rank the pool, preview the top `budget`.
  let discovered = 0;
  let evaluated = 0;
  for (const src of trendingSources) {
    const ranked = src.rank(await src.discover(20), deps.now());
    for (const d of ranked.slice(0, src.budget)) {
      discovered++;
      const evaluation = await evaluate(d);
      evaluated++;
      log.info(
        `[dry-run:${src.name}] ${evaluation.slug} — ${evaluation.verdict} (${evaluation.overallScore}) — ${evaluation.tagline}`,
      );
      console.log(
        JSON.stringify(
          {
            source: src.name,
            slug: evaluation.slug,
            kind: evaluation.source.kind,
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
  }
  log.info(`dry-run evaluated ${evaluated} item(s)`);
  return { discovered, published: 0, skippedDuplicate: 0 };
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

  // Trending sources for the daily mix: GitHub always; ProductHunt only when a
  // token is configured (else PH is silently skipped — GitHub-only, no failure).
  const trendingSources: TrendingSource[] = [
    {
      name: "github",
      budget: env.AIX_TRENDING_PICKS_GITHUB,
      discover: (limit) => github.discoverTrending!(limit),
      rank: (cands, now) => rankCandidates(cands, now),
    },
  ];
  if (env.PRODUCTHUNT_API_TOKEN) {
    const ph = createProductHuntSource({ token: env.PRODUCTHUNT_API_TOKEN, log });
    trendingSources.push({
      name: "producthunt",
      budget: env.AIX_TRENDING_PICKS_PRODUCTHUNT,
      discover: (limit) => ph.discoverTrending!(limit),
      rank: (cands) => rankByUpvotes(cands),
    });
    log.info(`producthunt enabled (budget ${env.AIX_TRENDING_PICKS_PRODUCTHUNT})`);
  } else {
    log.info("producthunt disabled (no PRODUCTHUNT_API_TOKEN) — github only");
  }
  // NOTE: the skills.sh source (sources/skills.ts, agent-tool lens) is a dormant
  // scaffold — wired in a future PR once a skills.sh access path (a Vercel OIDC
  // proxy) is in place. Today the mix is GitHub + ProductHunt.

  // arXiv is kept solely to resolve an explicit human-submitted paper URL.
  const resolveSubmission = async (url: string): Promise<Discovered | null> =>
    (await github.resolveUrl(url)) ?? (await arxiv.resolveUrl(url));

  const client = createInternalClient({
    baseUrl: env.AIX_WEB_URL,
    token: env.AIX_INTERNAL_TOKEN ?? "",
  });

  const result = await run({
    client,
    trendingSources,
    resolveSubmission,
    evaluate,
    writeArtifact: env.AIX_DRY_RUN ? async () => {} : (e: Evaluation) => writeArtifact(e),
    cap: env.AIX_DAILY_CAP,
    trendingCap: env.AIX_TRENDING_PICKS,
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
