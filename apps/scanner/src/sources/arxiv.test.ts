import { describe, expect, test } from "bun:test";
import { ItemSource } from "@aix/core";
import { parseArxivFeed, createArxivSource } from "./arxiv";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2401.12345v2</id>
    <updated>2024-01-20T10:00:00Z</updated>
    <published>2024-01-15T09:30:00Z</published>
    <title>A   Skeptical  Look
      at Agent Frameworks</title>
    <summary>  We argue that most agent frameworks add little over a capable base model.  </summary>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2402.00001v1</id>
    <published>2024-02-01T00:00:00Z</published>
    <title>Single Author Paper</title>
    <summary>An abstract.</summary>
    <author><name>Grace Hopper</name></author>
  </entry>
</feed>`;

describe("parseArxivFeed", () => {
  test("maps entries to valid ItemSource objects", () => {
    const items = parseArxivFeed(SAMPLE_FEED);
    expect(items).toHaveLength(2);
    for (const it of items) expect(() => ItemSource.parse(it)).not.toThrow();
  });

  test("strips version suffix from the arXiv id and normalizes fields", () => {
    const [first] = parseArxivFeed(SAMPLE_FEED);
    expect(first!.kind).toBe("arxiv_paper");
    expect(first!.externalId).toBe("2401.12345");
    expect(first!.url).toBe("http://arxiv.org/abs/2401.12345v2");
    // Whitespace collapsed in title + abstract.
    expect(first!.title).toBe("A Skeptical Look at Agent Frameworks");
    expect(first!.description).toBe(
      "We argue that most agent frameworks add little over a capable base model.",
    );
    expect(first!.publishedAt).toBe("2024-01-15T09:30:00.000Z");
    expect(first!.authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(first!.author).toBe("Ada Lovelace");
  });

  test("handles a single-author entry", () => {
    const items = parseArxivFeed(SAMPLE_FEED);
    expect(items[1]!.authors).toEqual(["Grace Hopper"]);
  });

  test("empty / entryless feed yields no items", () => {
    expect(parseArxivFeed(`<feed xmlns="http://www.w3.org/2005/Atom"></feed>`)).toEqual([]);
  });
});

describe("createArxivSource", () => {
  test("discoverTrending returns Discovered items with abstract as readme", async () => {
    const src = createArxivSource({
      fetchImpl: async () => new Response(SAMPLE_FEED),
    });
    const found = await src.discoverTrending!(10);
    expect(found).toHaveLength(2);
    expect(found[0]!.source.kind).toBe("arxiv_paper");
    expect(found[0]!.readme).toBe(found[0]!.source.description ?? "");
  });

  test("resolveUrl returns null for a non-arXiv url", async () => {
    const src = createArxivSource({ fetchImpl: async () => new Response(SAMPLE_FEED) });
    expect(await src.resolveUrl("https://github.com/acme/x")).toBeNull();
  });
});
