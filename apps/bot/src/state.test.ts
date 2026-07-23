import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readLastPickDate,
  readLastPosted,
  readLastSubmissionPosted,
  writeLastPickDate,
  writeLastPosted,
  writeLastSubmissionPosted,
} from "./state";

const path = join(
  tmpdir(),
  `aix-bot-state-${process.pid}-${Math.random().toString(36).slice(2)}.json`,
);

afterEach(async () => {
  await rm(path, { force: true });
});

describe("digest state", () => {
  it("returns null when the file is missing", async () => {
    expect(await readLastPosted(path)).toBeNull();
  });

  it("round-trips the last-posted timestamp", async () => {
    const iso = "2026-07-06T12:00:00.000Z";
    await writeLastPosted(path, iso);
    expect(await readLastPosted(path)).toBe(iso);
  });

  it("returns null on malformed json", async () => {
    await Bun.write(path, "not json");
    expect(await readLastPosted(path)).toBeNull();
  });

  it("concurrent writes to independent keys never lose an update", async () => {
    // The daily-pick and submission schedulers tick at the same instants and
    // write different keys of the same file. Unserialized read-merge-write let
    // one writer merge from a stale snapshot and clobber the other's key —
    // which erased the once-per-day guard and double-posted on 2026-07-23.
    await Promise.all([
      writeLastPosted(path, "2026-07-23T13:02:32.000Z"),
      writeLastPickDate(path, "2026-07-23"),
      writeLastSubmissionPosted(path, "2026-07-23T13:02:33.000Z"),
    ]);
    expect(await readLastPosted(path)).toBe("2026-07-23T13:02:32.000Z");
    expect(await readLastPickDate(path)).toBe("2026-07-23");
    expect(await readLastSubmissionPosted(path)).toBe("2026-07-23T13:02:33.000Z");
  });

  it("preserves keys it does not know about (e.g. legacy lastWeeklyPostedAt)", async () => {
    // Prod state still carries fields written by older builds; the merge (and
    // the atomic-write path) must round-trip them untouched.
    await Bun.write(path, JSON.stringify({ lastWeeklyPostedAt: "2026-07-07T15:37:08.555Z" }));
    await writeLastPickDate(path, "2026-07-23");
    const raw = JSON.parse(await Bun.file(path).text()) as Record<string, string>;
    expect(raw.lastWeeklyPostedAt).toBe("2026-07-07T15:37:08.555Z");
    expect(raw.lastPickDate).toBe("2026-07-23");
  });
});
