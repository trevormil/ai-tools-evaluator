import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Evaluation } from "@aix/core";

/**
 * The local git-corpus store (ADR-0004) — replaces the old HTTP `InternalClient`.
 * The scanner now reads/writes the repo's `content/` files directly: dedup reads
 * the `content/items/*.md` artifacts, the queue drains `content/queue/*.json`,
 * and publishing writes a new `.md` (via the injected `writeArtifact`). No server,
 * no SQLite — a one-shot process against the working tree, committed by CI.
 */

/** repo-root `content/items` — this file lives at apps/scanner/src/. */
export function defaultItemsDir(): string {
  return resolve(import.meta.dir, "../../../content/items");
}

/** repo-root `content/queue`. */
export function defaultQueueDir(): string {
  return resolve(import.meta.dir, "../../../content/queue");
}

/** One queued submission, enriched with the absolute path of its source file. */
export type QueuedFile = {
  /** Absolute path of the backing `.json` (passed back to `removeQueued`). */
  file: string;
  url: string;
  note?: string;
  source: string;
  submittedAt: string;
};

export type GitStore = {
  /** Every already-graded item's `source.externalId` (for dedup). Tolerant of bad files. */
  knownExternalIds(): Set<string>;
  /** Oldest-first queued submissions, capped to `limit`, each tagged with its file. */
  listQueued(limit: number): QueuedFile[];
  /** Delete a processed queue file (published, duplicate, unresolvable, or failed). */
  removeQueued(file: string): void;
  /** Whether an item artifact already exists for this slug. */
  hasSlug(slug: string): boolean;
};

/** Match the canonical JSON block `toMarkdown` appends at the end of every artifact. */
const JSON_BLOCK = /```json\n([\s\S]*?)\n```\s*$/;

export function createGitStore(
  itemsDir: string = defaultItemsDir(),
  queueDir: string = defaultQueueDir(),
): GitStore {
  return {
    knownExternalIds() {
      const ids = new Set<string>();
      let files: string[];
      try {
        files = readdirSync(itemsDir).filter((f) => f.endsWith(".md"));
      } catch {
        return ids; // no corpus dir yet — an empty catalog is valid.
      }
      for (const f of files) {
        try {
          const md = readFileSync(resolve(itemsDir, f), "utf8");
          const m = md.match(JSON_BLOCK);
          if (!m) continue;
          const e = JSON.parse(m[1]!) as Evaluation;
          if (e.source?.externalId) ids.add(e.source.externalId);
        } catch {
          // A malformed artifact must not poison dedup — skip it.
        }
      }
      return ids;
    },

    listQueued(limit) {
      let files: string[];
      try {
        files = readdirSync(queueDir).filter((f) => f.endsWith(".json"));
      } catch {
        return []; // no queue dir yet.
      }
      const rows: QueuedFile[] = [];
      for (const f of files) {
        const path = resolve(queueDir, f);
        try {
          const s = JSON.parse(readFileSync(path, "utf8")) as {
            url?: string;
            note?: string;
            source?: string;
            submittedAt?: string;
          };
          if (!s.url) continue;
          rows.push({
            file: path,
            url: s.url,
            note: s.note,
            source: s.source ?? "web",
            submittedAt: s.submittedAt ?? "",
          });
        } catch {
          // Skip a malformed queue file rather than aborting the drain.
        }
      }
      rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)); // oldest-first
      return rows.slice(0, limit);
    },

    removeQueued(file) {
      rmSync(file, { force: true });
    },

    hasSlug(slug) {
      return existsSync(resolve(itemsDir, `${slug}.md`));
    },
  };
}
