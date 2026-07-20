import { test, expect, beforeEach, afterEach } from "bun:test";
import { GET } from "./route";
import { clearTrendingCache } from "@/lib/trending";

/** Trending repo README proxy (ticket 0070). */

const realFetch = globalThis.fetch;
let fetchCalls: string[] = [];

beforeEach(() => {
  clearTrendingCache();
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockUpstream(bodyText: string, status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return new Response(bodyText, { status });
  }) as typeof fetch;
}

const request = (repo: string) =>
  GET(new Request(`https://x/api/v1/trending/github/readme?repo=${encodeURIComponent(repo)}`));

test("returns raw README markdown, cached per repo", async () => {
  mockUpstream("# Hello\n\nDocs here.");
  const res = await request("acme/hot-repo");
  expect(res.status).toBe(200);
  expect((await res.json()).readmeMd).toBe("# Hello\n\nDocs here.");
  expect(fetchCalls[0]).toContain("api.github.com/repos/acme/hot-repo/readme");

  await request("acme/hot-repo"); // memoized
  expect(fetchCalls.length).toBe(1);
});

test("repo without a README → readmeMd null (not an error)", async () => {
  mockUpstream("Not Found", 404);
  const res = await request("acme/no-readme");
  expect(res.status).toBe(200);
  expect((await res.json()).readmeMd).toBeNull();
});

test("malformed repo → 400 without touching upstream; upstream error → 502", async () => {
  mockUpstream("nope");
  expect((await request("not a repo/../etc")).status).toBe(400);
  expect(fetchCalls.length).toBe(0);

  mockUpstream("rate limited", 403);
  expect((await request("acme/limited")).status).toBe(502);
});
