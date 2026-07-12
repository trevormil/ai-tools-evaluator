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
import { createGitStore, type GitStore } from "./store";
import { writeArtifact } from "./artifact";
import { postDigest } from "./discord";
import type { Discovered, TrendingSource } from "./types";

/**
 * The run loop. Everything the loop needs is injected so it is fully testable
 * with fakes (no network, no model, no filesystem).
 */
export type RunDeps = {
  /** Local git-corpus store (dedup reads, queue drain, artifact existence). */
  store: GitStore;
  /** Trending sources (GitHub, ProductHunt, …), each with its own budget + rank. */
  trendingSources: TrendingSource[];
  resolveSubmission: (url: string) => Promise<Discovered | null>;
  evaluate: (d: Discovered) => Promise<Evaluation>;
  writeArtifact: (e: Evaluation) => Promise<unknown>;
  /** Per-run cap on queued submissions drained (Actions runs daily → per-run ≈ daily). */
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
  /** Highest-scored item published this run (queue + trending), for the Discord digest. */
  pick?: Evaluation;
};

/**
 * One scan pass (architecture.md §4, git-native / ADR-0004):
 *   1. drain the suggestion queue FIRST (oldest queued submissions), capped at `cap`,
 *   2. trending discovery fills the remainder, capped at `trendingCap`,
 *   3. dedup is local — an item whose `source.externalId` is already in the corpus
 *      (or was published earlier this run) is skipped,
 *   4. each published item is written as a strict `.md` artifact,
 *   5. the highest-scored published item is returned as `pick` (the digest).
 * Dry-run discovers + evaluates but never publishes or writes — it prints.
 */
export async function run(deps: RunDeps): Promise<RunResult> {
  if (deps.dryRun) return runDry(deps);

  const { store, resolveSubmission, evaluate, log } = deps;

  let discovered = 0;
  let published = 0;
  let skippedDuplicate = 0;
  let pick: Evaluation | undefined;

  // Dedup set: every externalId already in the corpus. Each new publish is added
  // so intra-run duplicates (a queued item that also trends, or a repeat across
  // two trending sources) are caught within the same pass.
  const known = store.knownExternalIds();

  const consider = (e: Evaluation): void => {
    if (!pick || e.overallScore > pick.overallScore) pick = e;
  };

  // 1) DRAIN THE QUEUE (bounded by the per-run circuit breaker `deps.cap`).
  const subs = store.listQueued(deps.cap);
  log.info(`draining ${subs.length} queued submission(s)`);
  for (const sub of subs) {
    discovered++;
    const d = await resolveSubmission(sub.url);
    if (!d) {
      log.warn(`could not resolve ${sub.url} — dropping from queue`);
      store.removeQueued(sub.file);
      continue;
    }
    let evaluation: Evaluation;
    try {
      evaluation = await evaluate(d);
    } catch (err) {
      // A single failed evaluation must not abort the whole scan.
      log.warn(`eval failed for ${sub.url}, dropping: ${String(err)}`);
      store.removeQueued(sub.file);
      continue;
    }
    if (known.has(evaluation.source.externalId)) {
      skippedDuplicate++;
      store.removeQueued(sub.file);
      log.info(`skip duplicate (queue) ${evaluation.source.externalId}`);
      continue;
    }
    await deps.writeArtifact(evaluation);
    known.add(evaluation.source.externalId);
    store.removeQueued(sub.file);
    published++;
    consider(evaluation);
    log.info(
      `published (queue) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`,
    );
  }

  // 2) TRENDING (multi-source): each source (GitHub, ProductHunt, …) grades up to
  //    its own budget, bounded in total by `trendingCap`. Dedup is the local
  //    `known` set (already-graded + published-this-run). All graded items publish;
  //    the digest below features only the single highest-scored across the run.
  const totalCap = Math.max(0, deps.trendingCap);
  if (totalCap > 0) {
    const graded: Evaluation[] = [];
    let capLeft = totalCap;
    for (const src of deps.trendingSources) {
      if (capLeft <= 0) break;
      const want = Math.min(src.budget, capLeft);
      if (want <= 0) continue;
      const pool = await src.discover(20);
      const fresh = pool.filter((d) => !known.has(d.source.externalId));
      const ranked = src.rank(fresh, deps.now());
      log.info(
        `trending[${src.name}]: pool=${pool.length} fresh=${fresh.length} (dropped ${pool.length - fresh.length} known) grading top ${want}`,
      );
      // Grade up to `want` from this source. A malformed eval is skipped, not fatal.
      let gradedFromSrc = 0;
      for (const d of ranked) {
        if (gradedFromSrc >= want) break;
        // A duplicate can slip in between discover and grade (a repeat in the
        // pool, or an id another source already claimed this run).
        if (known.has(d.source.externalId)) continue;
        discovered++;
        let evaluation: Evaluation;
        try {
          evaluation = await evaluate(d);
        } catch (err) {
          log.warn(`eval failed for ${d.source.externalId}, skipping: ${String(err)}`);
          continue;
        }
        gradedFromSrc++;
        known.add(evaluation.source.externalId);
        graded.push(evaluation);
      }
      capLeft -= gradedFromSrc;
    }

    for (const evaluation of graded) {
      await deps.writeArtifact(evaluation);
      published++;
      consider(evaluation);
      log.info(
        `published (trending) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`,
      );
    }
  }

  log.info(`pick: ${pick ? `${pick.slug} [${pick.overallScore}]` : "none"}`);
  return { discovered, published, skippedDuplicate, pick };
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

  const store = createGitStore();

  const result = await run({
    store,
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

  log.info(`done: ${JSON.stringify({ ...result, pick: result.pick?.slug })}`);

  // Exactly one Discord digest per run — only when a webhook is configured and
  // the run actually published something. Dev/local runs without the secret post
  // nothing; a webhook failure is swallowed inside postDigest.
  if (!env.AIX_DRY_RUN && env.DISCORD_WEBHOOK_URL && result.pick) {
    await postDigest(env.DISCORD_WEBHOOK_URL, result.pick);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
