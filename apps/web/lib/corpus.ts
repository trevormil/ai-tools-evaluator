import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Item } from "@aix/db";
import type { Evaluation } from "@aix/core";

/**
 * The git-native corpus (ADR-0004): `content/items/*.md` is the SOURCE OF TRUTH.
 * Each artifact carries a canonical JSON block (the full @aix/core Evaluation);
 * we parse it into the same `Item` shape the UI already consumes, so the read
 * layer (queries / recap / leaderboard) needs no schema. No SQLite at runtime.
 */

/** repo-root `content/items` — Next runs with cwd = apps/web. Overridable for tests. */
export function contentItemsDir(): string {
  return process.env.AIX_CONTENT_DIR ?? join(process.cwd(), "..", "..", "content", "items");
}

/** Pull the canonical Evaluation JSON out of a `.md` artifact (last fenced json block). */
function parseArtifactJson(md: string): Evaluation {
  const m = md.match(/```json\n([\s\S]*?)\n```\s*$/);
  if (!m) throw new Error("no canonical json block");
  return JSON.parse(m[1]!) as Evaluation;
}

/** Map a parsed Evaluation to the denormalized `Item` the components render. */
export function evaluationToItem(e: Evaluation): Item {
  const at = Math.floor(Date.parse(e.evaluatedAt) / 1000);
  const cover = e.media?.find((m) => m.type === "image");
  return {
    id: e.slug,
    slug: e.slug,
    kind: e.source.kind,
    externalId: e.source.externalId,
    url: e.source.url,
    title: e.source.title,
    category: e.category,
    integration: e.integration,
    verdict: e.verdict,
    primaryAudience: e.audience?.primary ?? null,
    aiEngineerFit: e.audience?.aiEngineerFit ?? null,
    vibeCoderFit: e.audience?.vibeCoderFit ?? null,
    overallScore: e.overallScore,
    noiseScore: e.noiseScore,
    tagline: e.tagline,
    tagsJson: JSON.stringify(e.tags ?? []),
    evaluationJson: JSON.stringify(e),
    mediaJson: JSON.stringify(e.media ?? []),
    coverImageUrl: cover ? (cover.cachedUrl ?? cover.url) : null,
    readmeMd: null,
    evaluatedBy: e.evaluatedBy,
    model: e.model ?? null,
    published: true,
    scoreStatus: "scored",
    scoredAt: Number.isFinite(at) ? at : null,
    dailyPickAt: null,
    score: 0,
    upvotes: 0,
    commentCount: 0,
    createdAt: Number.isFinite(at) ? at : 0,
  };
}

let cache: Item[] | null = null;

/**
 * Every scored item, parsed from the `.md` corpus. Cached in production (a scan
 * writes new files + redeploys, restarting the process); re-read in dev so edits
 * show live. A malformed artifact is logged and skipped, never fatal.
 */
export function loadCorpus(): Item[] {
  if (cache && process.env.NODE_ENV === "production") return cache;

  const dir = contentItemsDir();
  const items: Item[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    // No corpus dir yet (fresh checkout / empty) — an empty directory is valid.
    cache = [];
    return cache;
  }

  for (const f of files) {
    try {
      const e = parseArtifactJson(readFileSync(join(dir, f), "utf8"));
      items.push(evaluationToItem(e));
    } catch (err) {
      console.warn(`[corpus] skipping ${f}: ${(err as Error).message}`);
    }
  }

  cache = items;
  return items;
}

/** Test seam — drop the memoized corpus so the next load re-reads. */
export function _resetCorpus(): void {
  cache = null;
}
