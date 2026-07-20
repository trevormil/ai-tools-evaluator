import { test, expect, beforeEach, afterEach } from "bun:test";
import { GET as sourceGET } from "./[source]/route";
import { GET as cardGET } from "./huggingface/readme/route";
import { clearTrendingCache } from "@/lib/trending";

/** HN + Hugging Face trending sources (ticket 0071). */

const realFetch = globalThis.fetch;
let fetchCalls: string[] = [];

function mockUpstream(json: unknown, status = 200, asText = false) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return new Response(asText ? String(json) : JSON.stringify(json), { status });
  }) as typeof fetch;
}

beforeEach(() => {
  clearTrendingCache();
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const source = (name: string, window = "daily") =>
  sourceGET(new Request(`https://x/api/v1/trending/${name}?window=${window}`), {
    params: Promise.resolve({ source: name }),
  });

const hit = (title: string, points: number, url: string | null = null, id = "1") => ({
  title,
  url,
  objectID: id,
  points,
  num_comments: 3,
  author: "pg",
  created_at: "2026-07-19T00:00:00Z",
});

test("hackernews: Show HN via Algolia, AI-filtered, GitHub links detected", async () => {
  mockUpstream({
    hits: [
      hit("Show HN: My LLM agent framework", 120, "https://github.com/acme/agents.git", "101"),
      hit("Show HN: A knitting pattern generator", 300, "https://knits.example", "102"),
      hit("Show HN: Claude skills marketplace", 80, "https://skills.example", "103"),
      // enough AI hits that the knitting story gets filtered out
      ...Array.from({ length: 9 }, (_, i) => hit(`Show HN: AI tool ${i}`, 10 + i, null, `2${i}`)),
    ],
  });
  const res = await source("hackernews", "weekly");
  expect(res.status).toBe(200);
  const body = await res.json();
  const titles = body.stories.map((s: { title: string }) => s.title);
  expect(titles).toContain("My LLM agent framework"); // "Show HN:" prefix stripped
  expect(titles).not.toContain("A knitting pattern generator"); // AI filter
  const agentStory = body.stories.find((s: { title: string }) =>
    s.title.includes("agent framework"),
  );
  expect(agentStory.githubRepo).toBe("acme/agents"); // .git suffix stripped
  expect(agentStory.hnUrl).toBe("https://news.ycombinator.com/item?id=101");
  expect(fetchCalls[0]).toContain("hn.algolia.com");
  expect(fetchCalls[0]).toContain("show_hn");
});

test("hackernews: quiet AI day tops up with unfiltered leaders instead of an empty list", async () => {
  mockUpstream({
    hits: [
      hit("Show HN: An LLM thing", 50, null, "1"),
      hit("Show HN: A woodworking jig", 400, null, "2"),
      hit("Show HN: A birdwatching log", 200, null, "3"),
    ],
  });
  const body = await (await source("hackernews")).json();
  expect(body.stories.length).toBe(3); // AI hits (<10) topped up with the rest
  expect(body.stories[0].title).toBe("An LLM thing"); // AI hits stay first
});

test("huggingface: trending models via the public hub API; window ignored (cached once)", async () => {
  mockUpstream([
    {
      id: "acme/mega-model",
      likes: 512,
      downloads: 90000,
      pipeline_tag: "text-generation",
      tags: ["transformers", "license:apache-2.0", "en"],
      createdAt: "2026-07-15T00:00:00Z",
    },
  ]);
  const res = await source("huggingface", "daily");
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.models[0]).toEqual({
    id: "acme/mega-model",
    url: "https://huggingface.co/acme/mega-model",
    likes: 512,
    downloads: 90000,
    pipelineTag: "text-generation",
    tags: ["transformers", "en"], // namespaced tags (license:) dropped
    createdAt: "2026-07-15T00:00:00Z",
  });
  expect(fetchCalls[0]).toContain("huggingface.co/api/models");
  expect(fetchCalls[0]).toContain("trendingScore");

  await source("huggingface", "weekly"); // different window, same cache entry
  expect(fetchCalls.length).toBe(1);
});

test("huggingface model card: frontmatter stripped, rendered to HTML; malformed → 400", async () => {
  mockUpstream("---\nlicense: mit\ntags: [x]\n---\n# Mega Model\n\nIt is large.", 200, true);
  const res = await cardGET(
    new Request("https://x/api/v1/trending/huggingface/readme?model=acme/mega-model"),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.readmeHtml).toContain("<h1>Mega Model</h1>");
  expect(body.readmeHtml).not.toContain("license: mit");

  const bad = await cardGET(new Request("https://x/api/v1/trending/huggingface/readme?model=nope"));
  expect(bad.status).toBe(400);
});

import { GET as hnItemGET } from "./hackernews/item/route";

test("hn item: story + top-level comments, HTML stripped to text", async () => {
  mockUpstream({
    id: 101,
    title: "Show HN: My agent",
    text: "<p>It does &quot;things&quot; &amp; stuff</p>",
    points: 120,
    author: "pg",
    created_at: "2026-07-19T00:00:00Z",
    children: [
      {
        author: "alice",
        text: "Really <i>neat</i>.<p>How does it handle &gt;1M tokens?</p>",
        created_at: "2026-07-19T01:00:00Z",
        children: [{}, {}],
      },
      { author: "spam", text: null, children: [] }, // dead/empty comments dropped
    ],
  });
  const res = await hnItemGET(new Request("https://x/api/v1/trending/hackernews/item?id=101"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.text).toBe('It does "things" & stuff');
  expect(body.comments.length).toBe(1);
  expect(body.comments[0].text).toBe("Really neat.\n\nHow does it handle >1M tokens?");
  expect(body.comments[0].replies).toBe(2);
  expect(fetchCalls[0]).toContain("hn.algolia.com/api/v1/items/101");

  // Malformed id → 400, no upstream call.
  const before = fetchCalls.length;
  expect(
    (await hnItemGET(new Request("https://x/api/v1/trending/hackernews/item?id=abc"))).status,
  ).toBe(400);
  expect(fetchCalls.length).toBe(before);
});
