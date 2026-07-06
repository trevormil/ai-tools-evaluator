import { describe, expect, it } from "bun:test";
import { createInternalClient, type FetchLike } from "./client";

type Call = { url: string; init?: RequestInit };

function mockFetch(response: unknown, status = 200): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as FetchLike;
  return { fetch, calls };
}

describe("enqueueSubmission", () => {
  it("POSTs to /api/internal/submissions with bearer auth and a discord-source body", async () => {
    const { fetch, calls } = mockFetch({ submission: { id: "s1" } }, 201);
    const client = createInternalClient({ baseUrl: "https://aix.test/", token: "tok123", fetch });

    const result = await client.enqueueSubmission({
      url: "https://github.com/foo/bar",
      note: "neat",
      discordUserId: "u42",
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://aix.test/api/internal/submissions");
    expect(call.init?.method).toBe("POST");
    const headers = call.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok123");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(call.init?.body as string)).toEqual({
      url: "https://github.com/foo/bar",
      note: "neat",
      source: "discord",
      discordUserId: "u42",
    });
    expect(result.duplicate).toBe(false);
  });

  it("reports duplicate:true from a 200 duplicate response", async () => {
    const { fetch } = mockFetch({ duplicate: true }, 200);
    const client = createInternalClient({ baseUrl: "https://aix.test", token: "t", fetch });
    const result = await client.enqueueSubmission({ url: "https://x.dev" });
    expect(result.duplicate).toBe(true);
  });

  it("throws on non-ok status", async () => {
    const { fetch } = mockFetch({}, 401);
    const client = createInternalClient({ baseUrl: "https://aix.test", token: "t", fetch });
    await expect(client.enqueueSubmission({ url: "https://x.dev" })).rejects.toThrow("401");
  });
});

describe("fetchDigest", () => {
  it("GETs /api/internal/digest with an encoded since param and parses items", async () => {
    const items = [
      {
        slug: "foo-bar",
        title: "Foo Bar",
        url: "https://github.com/foo/bar",
        verdict: "worthwhile",
        overallScore: 72,
        tagline: "a terse hook",
        category: "cli-tool",
        coverImageUrl: null,
      },
    ];
    const { fetch, calls } = mockFetch({ items });
    const client = createInternalClient({ baseUrl: "https://aix.test", token: "tok", fetch });

    const out = await client.fetchDigest(new Date("2026-07-01T00:00:00.000Z"));

    const call = calls[0]!;
    expect(call.url).toBe(
      "https://aix.test/api/internal/digest?since=2026-07-01T00%3A00%3A00.000Z",
    );
    expect(call.init?.method).toBe("GET");
    expect((call.init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
    expect(out).toEqual(items);
  });

  it("accepts an ISO string since as-is", async () => {
    const { fetch, calls } = mockFetch({ items: [] });
    const client = createInternalClient({ baseUrl: "https://aix.test", token: "t", fetch });
    await client.fetchDigest("2026-01-02T03:04:05.000Z");
    expect(calls[0]!.url).toContain("since=2026-01-02T03%3A04%3A05.000Z");
  });
});
