import { readFile, writeFile } from "node:fs/promises";

/** Tiny local state so restarts don't re-post the daily digest. */
export type DigestState = {
  /** Watermark for the rolling daily digest. */
  lastPostedAt?: string;
  /** Watermark for auto-posting scored Discord submissions. */
  lastSubmissionPostedAt?: string;
};

/** Read the whole state object; empty object if absent/unreadable. */
async function readState(path: string): Promise<DigestState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<DigestState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Merge a patch into the state file so independent watermarks don't clobber. */
async function writeState(path: string, patch: Partial<DigestState>): Promise<void> {
  const next: DigestState = { ...(await readState(path)), ...patch };
  await writeFile(path, JSON.stringify(next, null, 2));
}

/** Returns the last daily-posted ISO timestamp, or null if absent/unreadable. */
export async function readLastPosted(path: string): Promise<string | null> {
  return (await readState(path)).lastPostedAt ?? null;
}

export async function writeLastPosted(path: string, iso: string): Promise<void> {
  await writeState(path, { lastPostedAt: iso });
}

/** Watermark for the "scored Discord submission" auto-poster. */
export async function readLastSubmissionPosted(path: string): Promise<string | null> {
  return (await readState(path)).lastSubmissionPostedAt ?? null;
}

export async function writeLastSubmissionPosted(path: string, iso: string): Promise<void> {
  await writeState(path, { lastSubmissionPostedAt: iso });
}
