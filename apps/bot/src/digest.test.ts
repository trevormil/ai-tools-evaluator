import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDigest, runWeeklyDigest } from "./digest";
import { readLastPosted, readLastWeeklyPosted, writeLastWeeklyPosted } from "./state";
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

const statePath = join(
  tmpdir(),
  `aix-digest-${process.pid}-${Math.random().toString(36).slice(2)}.json`,
);
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
  it("posts only the highest-scored pick per run (default 1/day) and advances the watermark", async () => {
    const { client } = fakeClient([
      item({ slug: "mid", overallScore: 60 }),
      item({ slug: "top", overallScore: 90 }),
    ]);
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

    // Default cap is 1 — the single highest-scored item is the pick of the day.
    expect(posted.map((p) => p.slug)).toEqual(["top"]);
    expect(sent).toHaveLength(1);
    expect(await readLastPosted(statePath)).toBe(now.toISOString());
  });

  it("respects maxPerRun when more than one may post", async () => {
    const { client } = fakeClient([
      item({ slug: "a", overallScore: 60 }),
      item({ slug: "b", overallScore: 90 }),
    ]);
    let sends = 0;
    const posted = await runDigest({
      client,
      statePath,
      maxPerRun: 5,
      now: () => new Date("2026-07-06T00:00:00.000Z"),
      getChannel: async () => ({
        send: async () => {
          sends++;
          return null;
        },
      }),
    });
    expect(posted).toHaveLength(2);
    expect(sends).toBe(2);
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

  it("posts nothing but advances the watermark when there are no items", async () => {
    const { client } = fakeClient([]);
    let sends = 0;
    const now = new Date("2026-07-06T00:00:00.000Z");
    await runDigest({
      client,
      statePath,
      now: () => now,
      getChannel: async () => ({
        send: async () => {
          sends++;
          return null;
        },
      }),
    });
    // No channel post, but the watermark advances so a restart never re-posts
    // the whole lookback window.
    expect(sends).toBe(0);
    expect(await readLastPosted(statePath)).toBe(now.toISOString());
  });
});

describe("runWeeklyDigest", () => {
  it("posts a header + top-N items ranked by overallScore and sets the weekly watermark", async () => {
    const { client, sinceSeen } = fakeClient([
      item({ slug: "mid", overallScore: 60 }),
      item({ slug: "top", overallScore: 95 }),
      item({ slug: "low", overallScore: 20 }),
    ]);
    const sent: unknown[] = [];
    const now = new Date("2026-07-06T00:00:00.000Z");

    const posted = await runWeeklyDigest({
      client,
      statePath,
      now: () => now,
      topN: 2,
      getChannel: async () => ({
        send: async (p) => {
          sent.push(p);
          return null;
        },
      }),
    });

    // Featured items are the two highest scores, in descending order.
    expect(posted.map((p) => p.slug)).toEqual(["top", "mid"]);
    // A "Best of the week" header, then one message per featured item.
    expect(sent).toHaveLength(3);
    expect((sent[0] as { content: string }).content).toContain("Best of the week");
    // Looked back a full 7 days.
    const sinceMs = new Date(sinceSeen[0]!).getTime();
    expect(now.getTime() - sinceMs).toBe(7 * 24 * 60 * 60 * 1000);
    expect(await readLastWeeklyPosted(statePath)).toBe(now.toISOString());
  });

  it("skips (no post, no fetch) when a weekly post happened less than 7 days ago", async () => {
    await writeLastWeeklyPosted(statePath, "2026-07-04T00:00:00.000Z"); // 2 days before now
    const { client, sinceSeen } = fakeClient([item()]);
    let sends = 0;
    const posted = await runWeeklyDigest({
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
    expect(posted).toEqual([]);
    expect(sends).toBe(0);
    expect(sinceSeen).toHaveLength(0); // never even fetched
  });

  it("posts again once a full week has elapsed since the last weekly post", async () => {
    await writeLastWeeklyPosted(statePath, "2026-06-28T00:00:00.000Z"); // 8 days before now
    const { client } = fakeClient([item({ slug: "again" })]);
    const posted = await runWeeklyDigest({
      client,
      statePath,
      now: () => new Date("2026-07-06T00:00:00.000Z"),
      getChannel: async () => ({ send: async () => null }),
    });
    expect(posted.map((p) => p.slug)).toEqual(["again"]);
  });

  it("does not post or advance the watermark when there are no items", async () => {
    const { client } = fakeClient([]);
    let sends = 0;
    await runWeeklyDigest({
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
    expect(await readLastWeeklyPosted(statePath)).toBeNull();
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
