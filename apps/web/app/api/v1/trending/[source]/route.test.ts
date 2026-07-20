import { test, expect, beforeEach, afterEach } from "bun:test";
import { GET } from "./route";
import { clearTrendingCache } from "@/lib/trending";

/** Trending proxies (ticket 0067): query construction, caching, error modes. */

const realFetch = globalThis.fetch;
let fetchCalls: string[] = [];

function mockUpstream(json: unknown, status = 200) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  clearTrendingCache();
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.PRODUCTHUNT_API_TOKEN;
});

const request = (source: string, window?: string) =>
  GET(new Request(`https://x/api/v1/trending/${source}${window ? `?window=${window}` : ""}`), {
    params: Promise.resolve({ source }),
  });

test("github daily: search API queried for young repos by stars; response projected", async () => {
  mockUpstream({
    items: [
      {
        full_name: "acme/hot-repo",
        html_url: "https://github.com/acme/hot-repo",
        description: "d",
        stargazers_count: 420,
        language: "Rust",
        created_at: "2026-07-19T00:00:00Z",
        owner: { avatar_url: "https://avatars.githubusercontent.com/u/1" },
        forks_count: 12,
        open_issues_count: 3,
        topics: ["ai", "agents"],
        homepage: "",
        license: { spdx_id: "MIT" },
        pushed_at: "2026-07-20T01:00:00Z",
      },
    ],
  });
  const res = await request("github", "daily");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.repos[0]).toEqual({
    fullName: "acme/hot-repo",
    url: "https://github.com/acme/hot-repo",
    description: "d",
    stars: 420,
    language: "Rust",
    createdAt: "2026-07-19T00:00:00Z",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    forks: 12,
    openIssues: 3,
    topics: ["ai", "agents"],
    homepage: null, // empty string upstream → null
    license: "MIT",
    pushedAt: "2026-07-20T01:00:00Z",
  });
  expect(fetchCalls[0]).toContain("api.github.com/search/repositories");
  expect(decodeURIComponent(fetchCalls[0] ?? "")).toContain("created:>");
  expect(fetchCalls[0]).toContain("sort=stars");
});

test("github weekly uses the wider window and is cached per window", async () => {
  mockUpstream({ items: [] });
  await request("github", "weekly");
  await request("github", "weekly"); // memoized — no second upstream call
  expect(fetchCalls.length).toBe(1);
  await request("github", "daily"); // different window → its own fetch
  expect(fetchCalls.length).toBe(2);
});

test("producthunt without a token → 503 with a clear error, no upstream call", async () => {
  mockUpstream({});
  const res = await request("producthunt", "daily");
  expect(res.status).toBe(503);
  expect((await res.json()).error).toContain("PRODUCTHUNT_API_TOKEN");
  expect(fetchCalls.length).toBe(0);
});

test("producthunt with a token: GraphQL posts projected to products", async () => {
  process.env.PRODUCTHUNT_API_TOKEN = "ph-test";
  mockUpstream({
    data: {
      posts: {
        edges: [
          {
            node: {
              name: "CoolLaunch",
              tagline: "t",
              description: "Longer story about the launch.",
              url: "https://www.producthunt.com/posts/coollaunch",
              website: "https://coollaunch.io",
              votesCount: 321,
              commentsCount: 17,
              thumbnail: { url: "https://ph-files.imgix.net/thumb.png" },
              media: [
                { url: "https://ph-files.imgix.net/shot1.png", type: "image" },
                { url: "https://youtube.com/v", type: "video" },
              ],
              topics: { edges: [{ node: { name: "AI" } }] },
            },
          },
        ],
      },
    },
  });
  const res = await request("producthunt", "weekly");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.products[0]).toEqual({
    name: "CoolLaunch",
    tagline: "t",
    url: "https://www.producthunt.com/posts/coollaunch",
    votes: 321,
    topics: ["AI"],
    thumbnailUrl: "https://ph-files.imgix.net/thumb.png",
    description: "Longer story about the launch.",
    commentsCount: 17,
    website: "https://coollaunch.io",
    mediaUrls: ["https://ph-files.imgix.net/shot1.png"], // images only
  });
  expect(fetchCalls[0]).toContain("api.producthunt.com");
});

test("invalid window → 400; unknown source → 404; upstream failure → 502", async () => {
  expect((await request("github", "hourly")).status).toBe(400);
  expect((await request("dribbble", "daily")).status).toBe(404);

  mockUpstream({ message: "rate limited" }, 403);
  expect((await request("github", "daily")).status).toBe(502);
});
