import { readFile, writeFile } from "node:fs/promises";

/** Tiny local state so restarts don't re-post the same digest items. */
export type DigestState = { lastPostedAt: string };

/** Returns the last-posted ISO timestamp, or null if absent/unreadable. */
export async function readLastPosted(path: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<DigestState>;
    return typeof parsed.lastPostedAt === "string" ? parsed.lastPostedAt : null;
  } catch {
    return null;
  }
}

export async function writeLastPosted(path: string, iso: string): Promise<void> {
  const state: DigestState = { lastPostedAt: iso };
  await writeFile(path, JSON.stringify(state, null, 2));
}
