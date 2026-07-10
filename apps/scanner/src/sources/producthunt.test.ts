import { describe, expect, test } from "bun:test";
import { parsePostsResponse, rankByUpvotes, createProductHuntSource } from "./producthunt";

const node = (over: Record<string, unknown> = {}) => ({
  node: {
    id: "1",
    name: "Acme",
    tagline: "AI triage for your inbox",
    description: "A longer description of what Acme does for teams.",
    url: "https://www.producthunt.com/posts/acme",
    website: "https://acme.dev",
    votesCount: 120,
    createdAt: "2026-07-09T12:00:00Z",
    slug: "acme",
    topics: { edges: [{ node: { name: "Productivity" } }] },
    ...over,
  },
});

describe("parsePostsResponse", () => {
  test("maps a PH post to a product-kind Discovered", () => {
    const [d] = parsePostsResponse({ data: { posts: { edges: [node()] } } });
    expect(d!.source.kind).toBe("producthunt");
    expect(d!.source.externalId).toBe("acme"); // slug
    expect(d!.source.url).toBe("https://acme.dev"); // prefers the product's own site
    expect(d!.source.title).toBe("Acme");
    expect(d!.source.upvotes).toBe(120);
    expect(d!.readme).toContain("AI triage"); // tagline in the evaluator text
    expect(d!.readme).toContain("Productivity"); // topics included
  });

  test("falls back to the PH url when there's no website", () => {
    const [d] = parsePostsResponse({
      data: { posts: { edges: [node({ website: null })] } },
    });
    expect(d!.source.url).toBe("https://www.producthunt.com/posts/acme");
  });

  test("skips malformed nodes (no slug/name/url) rather than throwing", () => {
    const out = parsePostsResponse({
      data: {
        posts: {
          edges: [node(), { node: { name: "No slug" } }, node({ slug: "b", name: "B" })],
        },
      },
    });
    expect(out.map((d) => d.source.externalId)).toEqual(["acme", "b"]);
  });
});

test("rankByUpvotes orders most-voted first", () => {
  const items = parsePostsResponse({
    data: {
      posts: {
        edges: [
          node({ slug: "low", votesCount: 5 }),
          node({ slug: "high", votesCount: 900 }),
          node({ slug: "mid", votesCount: 100 }),
        ],
      },
    },
  });
  expect(rankByUpvotes(items).map((d) => d.source.externalId)).toEqual(["high", "mid", "low"]);
});

test("createProductHuntSource sends a bearer token and returns ranked discoveries", async () => {
  let sentAuth = "";
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    sentAuth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
    return new Response(
      JSON.stringify({
        data: {
          posts: {
            edges: [node({ slug: "a", votesCount: 10 }), node({ slug: "b", votesCount: 99 })],
          },
        },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const src = createProductHuntSource({ token: "secret-token", fetchImpl });
  const out = await src.discoverTrending!(10);
  expect(sentAuth).toBe("Bearer secret-token");
  expect(out.map((d) => d.source.externalId)).toEqual(["b", "a"]); // ranked by votes
});

test("discovery returns [] on a non-OK response (never throws into the scan)", async () => {
  const fetchImpl = (async () =>
    new Response("nope", { status: 500 })) as unknown as typeof fetch;
  const src = createProductHuntSource({ token: "t", fetchImpl });
  expect(await src.discoverTrending!(5)).toEqual([]);
});
