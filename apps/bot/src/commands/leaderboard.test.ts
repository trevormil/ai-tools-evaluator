import { describe, expect, it } from "bun:test";
import { fetchLeaderboard } from "./leaderboard";
import { buildLeaderboardEmbed } from "../embeds";
import type { DigestItem, InternalClient } from "../client";

const item = (over: Partial<DigestItem> = {}): DigestItem => ({
  slug: "foo",
  title: "Foo",
  url: "https://x.dev/foo",
  verdict: "worthwhile",
  overallScore: 55,
  tagline: "does one thing",
  category: "library",
  coverImageUrl: null,
  ...over,
});

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

describe("fetchLeaderboard", () => {
  it("ranks by overallScore descending and caps at the limit", async () => {
    const { client } = fakeClient([
      item({ slug: "b", overallScore: 70 }),
      item({ slug: "a", overallScore: 99 }),
      item({ slug: "c", overallScore: 40 }),
      item({ slug: "d", overallScore: 55 }),
    ]);
    const top = await fetchLeaderboard(client, { limit: 2 });
    expect(top.map((t) => t.slug)).toEqual(["a", "b"]);
  });

  it("queries the digest over the configured lookback window", async () => {
    const { client, sinceSeen } = fakeClient([item()]);
    const now = Date.parse("2026-07-06T00:00:00.000Z");
    await fetchLeaderboard(client, { now });
    const sinceMs = new Date(sinceSeen[0]!).getTime();
    expect(now - sinceMs).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("defaults to the top 10", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item({ slug: `s${i}`, overallScore: i }),
    );
    const { client } = fakeClient(many);
    const top = await fetchLeaderboard(client);
    expect(top).toHaveLength(10);
    expect(top[0]!.overallScore).toBe(24); // highest first
  });
});

describe("buildLeaderboardEmbed", () => {
  it("renders one ranked, linked line per item", () => {
    const { data } = buildLeaderboardEmbed([
      item({ title: "Alpha", url: "https://a.dev", overallScore: 91, verdict: "essential" }),
      item({ title: "Beta", url: "https://b.dev", overallScore: 80, verdict: "niche" }),
    ]);
    const desc = data.description ?? "";
    expect(desc).toContain("**1.** [Alpha](https://a.dev) — 91/100 · Essential");
    expect(desc).toContain("**2.** [Beta](https://b.dev) — 80/100 · Niche");
  });

  it("shows a friendly message when there are no items", () => {
    const { data } = buildLeaderboardEmbed([]);
    expect(data.description).toBe("No recent evaluations yet.");
  });
});
