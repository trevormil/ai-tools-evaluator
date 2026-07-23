import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDigest, runSubmissionDigest, makeDigestChannelResolver } from "./digest";
import { readLastPosted, readLastPickDate, readLastSubmissionPosted } from "./state";
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
    const now = new Date("2026-07-06T13:05:00.000Z");

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

  it("posts the plainspoken summary as message text above the embed", async () => {
    const { client } = fakeClient([
      item({
        slug: "top",
        overallScore: 90,
        summary: "A CLI that wraps ripgrep with a nicer TUI.",
      }),
    ]);
    let payload: { content?: string; embeds?: unknown[] } | undefined;
    await runDigest({
      client,
      statePath,
      now: () => new Date("2026-07-06T13:05:00.000Z"),
      getChannel: async () => ({
        send: async (p) => {
          payload = p as typeof payload;
          return null;
        },
      }),
    });
    expect(payload?.content).toContain("A CLI that wraps ripgrep");
    expect(payload?.embeds).toHaveLength(1);
  });

  it("omits message content when there is no summary", async () => {
    const { client } = fakeClient([item({ slug: "top", overallScore: 90 })]);
    let payload: { content?: string } | undefined;
    await runDigest({
      client,
      statePath,
      now: () => new Date("2026-07-06T13:05:00.000Z"),
      getChannel: async () => ({
        send: async (p) => {
          payload = p as typeof payload;
          return null;
        },
      }),
    });
    expect(payload?.content).toBeUndefined();
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
      now: () => new Date("2026-07-06T13:05:00.000Z"),
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
    const t1 = new Date("2026-07-05T13:05:00.000Z");
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
      now: () => new Date("2026-07-06T13:05:00.000Z"),
      getChannel: async () => ({ send: async () => null }),
    });
    expect(second.sinceSeen[0]).toBe(t1.toISOString());
  });

  it("posts nothing but advances the watermark when there are no items", async () => {
    const { client } = fakeClient([]);
    let sends = 0;
    const now = new Date("2026-07-06T13:05:00.000Z");
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

describe("runDigest once-per-day guard", () => {
  const sink = (sent: unknown[]) => async () => ({
    send: async (p: unknown) => {
      sent.push(p);
      return null;
    },
  });

  it("posts at most once per UTC day even when later ticks bring higher-scored items", async () => {
    const sent: unknown[] = [];
    const getChannel = sink(sent);
    await runDigest({
      client: fakeClient([item({ slug: "am", overallScore: 80 })]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-08T13:05:00.000Z"),
    });
    // Same UTC day, a higher item appears — must NOT post a second pick.
    const posted = await runDigest({
      client: fakeClient([item({ slug: "pm", overallScore: 95 })]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-08T18:00:00.000Z"),
    });
    expect(posted).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it("posts again on the next UTC day", async () => {
    const sent: unknown[] = [];
    const getChannel = sink(sent);
    await runDigest({
      client: fakeClient([item({ slug: "day1", overallScore: 80 })]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-08T13:05:00.000Z"),
    });
    const posted = await runDigest({
      client: fakeClient([item({ slug: "day2", overallScore: 70 })]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-09T13:05:00.000Z"),
    });
    expect(posted.map((p) => p.slug)).toEqual(["day2"]);
    expect(sent).toHaveLength(2);
  });

  it("claims the UTC day before posting, so a crash after delivery never double-posts", async () => {
    // Model an OOMKill the instant Discord accepts the message: the send lands
    // (sends === 1) but the run aborts before it can return. If the day were
    // claimed only *after* the post (the old order), the restart below would
    // re-deliver the same pick — the exact duplicate we're closing.
    let sends = 0;
    const crashingChannel = async () => ({
      send: async () => {
        sends++;
        throw new Error("pod OOMKilled after send");
      },
    });
    const day = () => new Date("2026-07-08T13:05:00.000Z");
    await expect(
      runDigest({
        client: fakeClient([item({ slug: "pick", overallScore: 84 })]).client,
        statePath,
        getChannel: crashingChannel,
        now: day,
      }),
    ).rejects.toThrow(/OOMKilled/);
    expect(sends).toBe(1);
    // The guard must already be persisted despite the abnormal exit.
    expect(await readLastPickDate(statePath)).toBe("2026-07-08");

    // Restart on the same UTC day with a healthy channel: must NOT re-post.
    const sent: unknown[] = [];
    const posted = await runDigest({
      client: fakeClient([item({ slug: "pick", overallScore: 84 })]).client,
      statePath,
      getChannel: sink(sent),
      now: day,
    });
    expect(posted).toEqual([]);
    expect(sent).toHaveLength(0);
    expect(sends).toBe(1); // exactly one delivery, ever
  });

  it("does not consume the day when the channel is unreachable", async () => {
    // A transient channel-fetch failure must not burn the daily pick: the guard
    // is claimed only after the channel resolves, so a later poll can retry.
    const unreachable = async (): Promise<never> => {
      throw new Error("Missing Access");
    };
    await expect(
      runDigest({
        client: fakeClient([item({ slug: "pick", overallScore: 84 })]).client,
        statePath,
        getChannel: unreachable,
        now: () => new Date("2026-07-08T13:05:00.000Z"),
      }),
    ).rejects.toThrow(/Missing Access/);
    expect(await readLastPickDate(statePath)).toBeNull();

    // Retry once the channel is reachable — the pick still posts.
    const sent: unknown[] = [];
    const posted = await runDigest({
      client: fakeClient([item({ slug: "pick", overallScore: 84 })]).client,
      statePath,
      getChannel: sink(sent),
      now: () => new Date("2026-07-08T13:10:00.000Z"),
    });
    expect(posted.map((p) => p.slug)).toEqual(["pick"]);
    expect(sent).toHaveLength(1);
  });

  it("a concurrent empty submission poll never erases the day-claim (2026-07-23 double-post)", async () => {
    // Reproduces the 2026-07-23 incident: both schedulers tick at the same
    // instant. The daily pick posts and claims the day while the submission
    // poller's empty run writes its own watermark to the same file. If those
    // writes interleave, the day-claim is lost and the NEXT tick re-posts a
    // second pick. Repeated across days to leave a lost-update race nowhere
    // to hide.
    const DAYS = 20;
    let picksSent = 0;
    const pickChannel = async () => ({
      send: async () => {
        picksSent++;
        return null;
      },
    });
    for (let d = 1; d <= DAYS; d++) {
      const day = String(d).padStart(2, "0");
      const tick1 = () => new Date(`2026-08-${day}T13:02:00.000Z`);
      await Promise.all([
        runDigest({
          client: fakeClient([item({ slug: `pick-${d}`, overallScore: 80 })]).client,
          statePath,
          getChannel: pickChannel,
          now: tick1,
        }),
        runSubmissionDigest({
          client: fakeClient([]).client,
          statePath,
          getChannel: pickChannel,
          now: tick1,
        }),
      ]);
      // The next 5-min tick brings a richer pool — it must NOT post again.
      const again = await runDigest({
        client: fakeClient([item({ slug: `later-${d}`, overallScore: 95 })]).client,
        statePath,
        getChannel: pickChannel,
        now: () => new Date(`2026-08-${day}T13:12:00.000Z`),
      });
      expect(again).toEqual([]);
    }
    expect(picksSent).toBe(DAYS); // exactly one pick per day, ever
  });

  it("an empty earlier tick does not consume the day — the real pick still posts later", async () => {
    const sent: unknown[] = [];
    const getChannel = sink(sent);
    // Early poll before the daily scan has produced anything.
    await runDigest({
      client: fakeClient([]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-08T12:00:00.000Z"),
    });
    // Later same-day poll once the scan item exists — the pick must still post.
    const posted = await runDigest({
      client: fakeClient([item({ slug: "pick", overallScore: 84 })]).client,
      statePath,
      getChannel,
      now: () => new Date("2026-07-08T13:05:00.000Z"),
    });
    expect(posted.map((p) => p.slug)).toEqual(["pick"]);
    expect(sent).toHaveLength(1);
  });
});

describe("runDigest post-time gate", () => {
  it("posts nothing before the target UTC hour and leaves state untouched", async () => {
    const sent: unknown[] = [];
    const { client, sinceSeen } = fakeClient([
      item({ slug: "x", verdict: "essential", overallScore: 90 }),
    ]);
    const posted = await runDigest({
      client,
      statePath,
      // 04:00 UTC ≈ midnight ET — well before the 13:00 gate.
      now: () => new Date("2026-07-08T04:00:00.000Z"),
      getChannel: async () => ({
        send: async (p) => {
          sent.push(p);
          return null;
        },
      }),
    });
    expect(posted).toEqual([]);
    expect(sent).toHaveLength(0);
    // Gated before fetch/state — so the real morning post is never pre-empted.
    expect(sinceSeen).toHaveLength(0);
    expect(await readLastPickDate(statePath)).toBeNull();
  });

  it("honors a custom postAfterUtcHour", async () => {
    const { client } = fakeClient([item({ slug: "x", verdict: "essential", overallScore: 90 })]);
    const posted = await runDigest({
      client,
      statePath,
      postAfterUtcHour: 15,
      now: () => new Date("2026-07-08T14:00:00.000Z"), // past 13, before 15
      getChannel: async () => ({ send: async () => null }),
    });
    expect(posted).toEqual([]);
  });
});

describe("runDigest featured pick", () => {
  const morning = () => new Date("2026-07-08T13:05:00.000Z");

  it("features the broad-appeal pickScore, not the top overallScore, and never a niche verdict", async () => {
    const { client } = fakeClient([
      // Clever-but-niche: HIGHEST overallScore, but niche verdict + low pickScore.
      item({ slug: "niche-star", verdict: "niche", overallScore: 95, pickScore: 40 }),
      // Broadly useful: lower overallScore, worthwhile, high pickScore.
      item({ slug: "broad", verdict: "worthwhile", overallScore: 78, pickScore: 82 }),
    ]);
    const posted = await runDigest({
      client,
      statePath,
      now: morning,
      getChannel: async () => ({ send: async () => null }),
    });
    expect(posted.map((p) => p.slug)).toEqual(["broad"]);
  });

  it("falls back to all items on a thin day with no essential/worthwhile verdict", async () => {
    const { client } = fakeClient([
      item({ slug: "a", verdict: "niche", overallScore: 60, pickScore: 55 }),
      item({ slug: "b", verdict: "marginal", overallScore: 50, pickScore: 70 }),
    ]);
    const posted = await runDigest({
      client,
      statePath,
      now: morning,
      getChannel: async () => ({ send: async () => null }),
    });
    expect(posted.map((p) => p.slug)).toEqual(["b"]); // highest pickScore of the fallback
  });
});

describe("runSubmissionDigest", () => {
  it("auto-posts each scored Discord submission and advances the submission watermark", async () => {
    const { client, sinceSeen } = fakeClient([item({ slug: "dropped", overallScore: 70 })]);
    const sent: Array<{ content?: string; embeds?: unknown[] }> = [];
    const now = new Date("2026-07-06T13:05:00.000Z");
    const posted = await runSubmissionDigest({
      client,
      statePath,
      now: () => now,
      getChannel: async () => ({
        send: async (p) => {
          sent.push(p as (typeof sent)[number]);
          return null;
        },
      }),
    });
    expect(posted.map((p) => p.slug)).toEqual(["dropped"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.content).toContain("Scored");
    expect(sinceSeen).toHaveLength(1);
    expect(await readLastSubmissionPosted(statePath)).toBe(now.toISOString());
  });

  it("posts nothing but advances the watermark when there are no new scored submissions", async () => {
    const { client } = fakeClient([]);
    let sends = 0;
    const now = new Date("2026-07-06T13:05:00.000Z");
    await runSubmissionDigest({
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
    expect(sends).toBe(0);
    expect(await readLastSubmissionPosted(statePath)).toBe(now.toISOString());
  });
});

describe("makeDigestChannelResolver", () => {
  const chan = (id: string) => ({ id, send: async () => null });
  const idOf = async (r: Promise<{ send: (p: unknown) => Promise<unknown> }>) =>
    (await r) as unknown as { id: string };

  it("returns the primary channel when it is reachable", async () => {
    const resolve = makeDigestChannelResolver(async (id) => chan(id), "new", "old");
    expect((await idOf(resolve())).id).toBe("new");
  });

  it("falls back to the old channel while the primary is unreachable", async () => {
    const resolve = makeDigestChannelResolver(
      async (id) => {
        if (id === "new") throw new Error("Missing Access");
        return chan(id);
      },
      "new",
      "old",
    );
    // Cutover is automatic: once "new" stops throwing, the resolver returns it.
    expect((await idOf(resolve())).id).toBe("old");
  });

  it("throws when the primary is unreachable and there is no fallback", async () => {
    const resolve = makeDigestChannelResolver(async () => {
      throw new Error("Missing Access");
    }, "new");
    await expect(resolve()).rejects.toThrow(/Missing Access/);
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
