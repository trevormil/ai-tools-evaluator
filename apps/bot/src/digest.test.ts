import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDigest } from "./digest";
import { readLastPosted } from "./state";
import type { DigestItem, InternalClient } from "./client";
import { matchItem } from "./commands/eval";

const item = (over: Partial<DigestItem> = {}): DigestItem => ({
  slug: "foo",
  title: "Foo",
  url: "https://x.dev/foo",
  verdict: "niche",
  overallScore: 55,
  tagline: "does one thing",
  category: "library",
  coverImageUrl: null,
  ...over,
});

const statePath = join(tmpdir(), `aix-digest-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
afterEach(async () => rm(statePath, { force: true }));

function fakeClient(items: DigestItem[]): { client: InternalClient; sinceSeen: string[] } {
  const sinceSeen: string[] = [];
  const client: InternalClient = {
    async enqueueSubmission() {
      throw new Error("not used");
    },
    async fetchDigest(since) {
      sinceSeen.push(typeof since === "string" ? since : since.toISOString());
      return items;
    },
  };
  return { client, sinceSeen };
}

describe("runDigest", () => {
  it("posts an embed per item and advances the watermark", async () => {
    const { client } = fakeClient([item({ slug: "a" }), item({ slug: "b" })]);
    const sent: unknown[] = [];
    const now = new Date("2026-07-06T00:00:00.000Z");

    const posted = await runDigest({
      client,
      statePath,
      now: () => now,
      getChannel: async () => ({
        send: async (p) => {
          sent.push(p);
          return null;
        },
      }),
    });

    expect(posted).toHaveLength(2);
    expect(sent).toHaveLength(2);
    expect(await readLastPosted(statePath)).toBe(now.toISOString());
  });

  it("uses the stored watermark as `since` on the next run", async () => {
    const first = fakeClient([item()]);
    const t1 = new Date("2026-07-05T00:00:00.000Z");
    await runDigest({
      client: first.client,
      statePath,
      now: () => t1,
      getChannel: async () => ({ send: async () => null }),
    });

    const second = fakeClient([]);
    await runDigest({
      client: second.client,
      statePath,
      now: () => new Date("2026-07-06T00:00:00.000Z"),
      getChannel: async () => ({ send: async () => null }),
    });
    expect(second.sinceSeen[0]).toBe(t1.toISOString());
  });

  it("does not touch the channel or state when there are no items", async () => {
    const { client } = fakeClient([]);
    let sends = 0;
    await runDigest({
      client,
      statePath,
      now: () => new Date("2026-07-06T00:00:00.000Z"),
      getChannel: async () => ({
        send: async () => {
          sends++;
          return null;
        },
      }),
    });
    expect(sends).toBe(0);
    expect(await readLastPosted(statePath)).toBeNull();
  });
});

describe("matchItem", () => {
  const items = [
    item({ slug: "cool-mcp", title: "Cool MCP", tagline: "an mcp thing" }),
    item({ slug: "fast-rag", title: "Fast RAG", tagline: "retrieval done fast" }),
  ];

  it("prefers an exact slug match", () => {
    expect(matchItem(items, "fast-rag")?.slug).toBe("fast-rag");
  });

  it("falls back to substring on title/tagline", () => {
    expect(matchItem(items, "retrieval")?.slug).toBe("fast-rag");
    expect(matchItem(items, "cool")?.slug).toBe("cool-mcp");
  });

  it("returns null when nothing matches", () => {
    expect(matchItem(items, "zzz")).toBeNull();
  });
});
