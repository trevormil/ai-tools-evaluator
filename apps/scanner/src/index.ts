import type { Evaluation } from "@aix/core";
import { loadEnv, requireLiveSecrets, type ScannerEnv } from "./env";
import { createLogger, type Logger } from "./logger";
import { createGitHubSource, createArxivSource } from "./sources";
import { createAnthropicModel, evaluateItem } from "./evaluate";
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
  dryRun: boolean;
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
    const budget = Math.max(0, Math.min(capInfo.remaining, deps.cap));
    log.info(`cap: remaining=${capInfo.remaining} localCap=${deps.cap} budget=${budget}`);

    // 1) DRAIN THE QUEUE FIRST.
    if (budget > 0) {
      const subs = await client.listQueuedSubmissions(budget);
      log.info(`draining ${subs.length} queued submission(s)`);
      for (const sub of subs) {
        if (published >= budget) break;
        discovered++;
        await client.patchSubmission(sub.id, { status: "processing" });
        const d = await resolveSubmission(sub.url);
        if (!d) {
          await client.patchSubmission(sub.id, { status: "failed", reason: "could not resolve url" });
          continue;
        }
        const evaluation = await evaluate(d);
        const res = await client.publishItem(evaluation, String(sub.id));
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
        await deps.writeArtifact(evaluation);
        log.info(`published (queue) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`);
      }
    }

    // 2) TRENDING DISCOVERY fills the remainder.
    if (published < budget) {
      const need = budget - published;
      // Over-fetch: server-side dedup will drop some already-known repos.
      const trending = await discoverTrending(need * 2);
      log.info(`trending candidates: ${trending.length}, need ${need} more`);
      for (const d of trending) {
        if (published >= budget) break;
        discovered++;
        const evaluation = await evaluate(d);
        const res = await client.publishItem(evaluation);
        if (res.duplicate) {
          skippedDuplicate++;
          continue;
        }
        published++;
        await deps.writeArtifact(evaluation);
        log.info(`published (trending) ${evaluation.slug} [${evaluation.verdict} ${evaluation.overallScore}]`);
      }
    }

    await client.closeScanRun(runId, { status: "ok", discovered, published, skippedDuplicate });
    return { discovered, published, skippedDuplicate };
  } catch (err) {
    await client
      .closeScanRun(runId, { status: "error", discovered, published, skippedDuplicate, error: String(err) })
      .catch(() => {});
    throw err;
  }
}

async function runDry(deps: RunDeps): Promise<RunResult> {
  const { discoverTrending, evaluate, cap, log } = deps;
  log.info("DRY RUN — discovering + evaluating, nothing will be published");
  const candidates = await discoverTrending(cap);
  let evaluated = 0;
  for (const d of candidates.slice(0, cap)) {
    const evaluation = await evaluate(d);
    evaluated++;
    log.info(`[dry-run] ${evaluation.slug} — ${evaluation.verdict} (${evaluation.overallScore}) — ${evaluation.tagline}`);
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

/** Interleave two lists so both sources are represented near the top. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]!);
    if (i < b.length) out.push(b[i]!);
  }
  return out;
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
  const model = createAnthropicModel({ apiKey: env.ANTHROPIC_API_KEY!, model: env.AIX_MODEL });

  const evaluate = (d: Discovered) =>
    evaluateItem(d, { model, modelName: env.AIX_MODEL, deriveMedia: buildMedia });

  const discoverTrending = async (limit: number): Promise<Discovered[]> => {
    const [g, a] = await Promise.all([
      github.discoverTrending!(Math.ceil(limit * 0.7)),
      arxiv.discoverTrending!(Math.ceil(limit * 0.5)),
    ]);
    return interleave(g, a).slice(0, limit);
  };

  const resolveSubmission = async (url: string): Promise<Discovered | null> =>
    (await github.resolveUrl(url)) ?? (await arxiv.resolveUrl(url));

  const client = createInternalClient({ baseUrl: env.AIX_WEB_URL, token: env.AIX_INTERNAL_TOKEN ?? "" });

  const result = await run({
    client,
    discoverTrending,
    resolveSubmission,
    evaluate,
    writeArtifact: env.AIX_DRY_RUN ? async () => {} : (e: Evaluation) => writeArtifact(e),
    cap: env.AIX_DAILY_CAP,
    dryRun: env.AIX_DRY_RUN,
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
