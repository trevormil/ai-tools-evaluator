import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLastPosted, writeLastPosted } from "./state";

const path = join(tmpdir(), `aix-bot-state-${process.pid}-${Math.random().toString(36).slice(2)}.json`);

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
});
