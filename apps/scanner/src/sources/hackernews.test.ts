import { describe, expect, test } from "bun:test";
import { parseHnStory, createHackerNewsSource, type HnItem } from "./hackernews";

const story = (over: Partial<HnItem> = {}): HnItem => ({
  id: 1,
  type: "story",
  by: "pg",
  time: 1_800_000_000,
  title: "Show HN: Acme, AI triage",
  url: "https://acme.dev",
  score: 240,
  descendants: 30,
  ...over,
});

describe("parseHnStory routing", () => {
  test("a GitHub link becomes a github_repo (agent-tool), externalId owner/repo", () => {
    const d = parseHnStory(story({ url: "https://github.com/acme/tool" }))!;
    expect(d.source.kind).toBe("github_repo");
    expect(d.source.externalId).toBe("acme/tool"); // dedups with the GitHub source
    expect(d.source.url).toBe("https://github.com/acme/tool");
  });

  test("a non-GitHub link becomes an external_link (product lens)", () => {
    const d = parseHnStory(story())!;
    expect(d.source.kind).toBe("external_link");
    expect(d.source.url).toBe("https://acme.dev");
    expect(d.readme).toContain("240 points"); // HN signal carried into the readme
  });

  test("text-only posts (no url) are skipped", () => {
    expect(parseHnStory(story({ url: undefined, text: "Ask HN: ..." }))).toBeNull();
    expect(parseHnStory(story({ type: "comment" }))).toBeNull();
  });
});

test("createHackerNewsSource walks the list and routes each story", async () => {
  const items: Record<number, HnItem> = {
    10: story({ id: 10, url: "https://github.com/a/b" }),
    11: story({ id: 11, title: "Ask HN", url: undefined }), // skipped
    12: story({ id: 12, url: "https://foo.com" }),
  };
  const fetchImpl = (async (url: string) => {
    if (url.endsWith("/topstories.json")) return new Response(JSON.stringify([10, 11, 12]));
    const m = url.match(/item\/(\d+)\.json/);
    return new Response(JSON.stringify(m ? items[Number(m[1])] : null));
  }) as unknown as (url: string) => Promise<Response>;

  const src = createHackerNewsSource({ fetchImpl });
  const out = await src.discoverTrending!(10);
  expect(out.map((d) => d.source.externalId)).toEqual(["a/b", "https://foo.com"]);
});

test("resolveUrl handles an HN item permalink", async () => {
  const fetchImpl = (async (url: string) => {
    if (/item\/42\.json/.test(url)) return new Response(JSON.stringify(story({ id: 42 })));
    return new Response("null");
  }) as unknown as (url: string) => Promise<Response>;
  const src = createHackerNewsSource({ fetchImpl });
  const d = await src.resolveUrl("https://news.ycombinator.com/item?id=42");
  expect(d?.source.title).toContain("Acme");
  expect(await src.resolveUrl("https://example.com")).toBeNull();
});
