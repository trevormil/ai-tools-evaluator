import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The submission queue (ADR-0004): the Cloudflare Worker writes one JSON file
 * per pasted URL into `content/queue/`, the scanner drains + evaluates them,
 * then deletes the file and writes `content/items/<slug>.md`. Until then the URL
 * shows in a lightweight "in the queue" strip — no DB, no instant pending item.
 */

export type QueuedSubmission = {
  url: string;
  note?: string;
  source: "web" | "discord";
  submittedAt: string; // ISO
};

/** A queued URL, enriched with a display title + logo derived from the URL alone. */
export type QueuedView = QueuedSubmission & { title: string; coverImageUrl: string | null };

/** repo-root `content/queue` — Next runs with cwd = apps/web. Overridable for tests. */
export function contentQueueDir(): string {
  return process.env.AIX_QUEUE_DIR ?? join(process.cwd(), "..", "..", "content", "queue");
}

type DerivedSource = { title: string; coverImageUrl: string | null };

/** Classify a URL for display (title + logo) without any network call. */
export function deriveSource(url: string): DerivedSource {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { title: url, coverImageUrl: null };
  }

  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    const [owner, repo] = u.pathname.replace(/^\/+/, "").split("/");
    if (owner && repo) {
      const cleanRepo = repo.replace(/\.git$/, "");
      const externalId = `${owner}/${cleanRepo}`;
      // The repo's own social-preview card (matches the cover the scanner sets),
      // not the owner's avatar.
      const hash = createHash("sha256").update(externalId).digest("hex").slice(0, 32);
      return {
        title: cleanRepo,
        coverImageUrl: `https://opengraph.githubassets.com/${hash}/${externalId}`,
      };
    }
  }

  if (u.hostname.endsWith("arxiv.org")) {
    const m = u.pathname.match(/\/(?:abs|pdf)\/([\w.-]+?)(?:\.pdf)?$/);
    if (m) return { title: `arXiv:${m[1]}`, coverImageUrl: null };
  }

  return { title: u.hostname.replace(/^www\./, ""), coverImageUrl: null };
}

/** Every queued submission, newest first, enriched for display. */
export function listQueued(): QueuedView[] {
  const dir = contentQueueDir();
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // no queue dir yet
  }

  const rows: QueuedView[] = [];
  for (const f of files) {
    try {
      const s = JSON.parse(readFileSync(join(dir, f), "utf8")) as QueuedSubmission;
      if (!s.url) continue;
      rows.push({ ...s, ...deriveSource(s.url) });
    } catch (err) {
      console.warn(`[queue] skipping ${f}: ${(err as Error).message}`);
    }
  }
  return rows.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}
