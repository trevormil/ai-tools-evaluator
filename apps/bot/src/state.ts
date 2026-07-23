import { readFile, rename, writeFile } from "node:fs/promises";

/** Tiny local state so restarts don't re-post the daily digest. */
export type DigestState = {
  /** Watermark for the rolling daily digest. */
  lastPostedAt?: string;
  /** UTC calendar day (YYYY-MM-DD) a daily pick was last posted — the once/day guard. */
  lastPickDate?: string;
  /** Watermark for auto-posting scored Discord submissions. */
  lastSubmissionPostedAt?: string;
};

/**
 * Serialize all access to a given state file. writeState is a read-merge-write,
 * and the daily-pick + submission schedulers tick at the same instants — two
 * concurrent writes could merge from a stale snapshot and silently drop the
 * other writer's key (this erased the once-per-day guard and double-posted the
 * daily pick on 2026-07-23). One in-process chain per path is enough: prod
 * runs a single bot process (Recreate deployment).
 */
const chains = new Map<string, Promise<void>>();
function serialize<T>(path: string, task: () => Promise<T>): Promise<T> {
  const prev = chains.get(path) ?? Promise.resolve();
  const run = prev.then(task);
  chains.set(
    path,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function readStateUnlocked(path: string): Promise<DigestState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<DigestState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Read the whole state object; empty object if absent/unreadable. */
async function readState(path: string): Promise<DigestState> {
  return serialize(path, () => readStateUnlocked(path));
}

/** Merge a patch into the state file so independent watermarks don't clobber. */
async function writeState(path: string, patch: Partial<DigestState>): Promise<void> {
  await serialize(path, async () => {
    const next: DigestState = { ...(await readStateUnlocked(path)), ...patch };
    // Write-temp-then-rename so a concurrent reader can never observe a torn
    // half-written file (readState swallows parse errors as {}, which would
    // make every watermark look absent and re-trigger the daily pick).
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2));
    await rename(tmp, path);
  });
}

/** Returns the last daily-posted ISO timestamp, or null if absent/unreadable. */
export async function readLastPosted(path: string): Promise<string | null> {
  return (await readState(path)).lastPostedAt ?? null;
}

export async function writeLastPosted(path: string, iso: string): Promise<void> {
  await writeState(path, { lastPostedAt: iso });
}

/** UTC day (YYYY-MM-DD) a daily pick last posted, or null — the once/day guard. */
export async function readLastPickDate(path: string): Promise<string | null> {
  return (await readState(path)).lastPickDate ?? null;
}

export async function writeLastPickDate(path: string, day: string): Promise<void> {
  await writeState(path, { lastPickDate: day });
}

/** Watermark for the "scored Discord submission" auto-poster. */
export async function readLastSubmissionPosted(path: string): Promise<string | null> {
  return (await readState(path)).lastSubmissionPostedAt ?? null;
}

export async function writeLastSubmissionPosted(path: string, iso: string): Promise<void> {
  await writeState(path, { lastSubmissionPostedAt: iso });
}
