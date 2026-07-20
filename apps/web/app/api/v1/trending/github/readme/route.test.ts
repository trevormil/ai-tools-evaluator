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

let lastAccept: string | null = null;

function mockUpstream(bodyText: string, status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push(String(input));
    lastAccept = (init?.headers as Record<string, string> | undefined)?.accept ?? null;
    return new Response(bodyText, { status });
  }) as typeof fetch;
}

const request = (repo: string) =>
  GET(new Request(`https://x/api/v1/trending/github/readme?repo=${encodeURIComponent(repo)}`));

test("returns GitHub-rendered README HTML, cached per repo", async () => {
  mockUpstream("<h1>Hello</h1>\n<p>Docs here.</p>");
  const res = await request("acme/hot-repo");
  expect(res.status).toBe(200);
  expect((await res.json()).readmeHtml).toBe("<h1>Hello</h1>\n<p>Docs here.</p>");
  expect(fetchCalls[0]).toContain("api.github.com/repos/acme/hot-repo/readme");
  // The html media type = GitHub's own GFM rendering + sanitizer.
  expect(lastAccept).toBe("application/vnd.github.html+json");

  await request("acme/hot-repo"); // memoized
  expect(fetchCalls.length).toBe(1);
});

test("repo without a README → readmeHtml null (not an error)", async () => {
  mockUpstream("Not Found", 404);
  const res = await request("acme/no-readme");
  expect(res.status).toBe(200);
  expect((await res.json()).readmeHtml).toBeNull();
});

test("malformed repo → 400 without touching upstream; upstream error → 502", async () => {
  mockUpstream("nope");
  expect((await request("not a repo/../etc")).status).toBe(400);
  expect(fetchCalls.length).toBe(0);

  mockUpstream("rate limited", 403);
  expect((await request("acme/limited")).status).toBe(502);
});
