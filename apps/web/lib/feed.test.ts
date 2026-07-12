import { test, expect } from "bun:test";
import type { Item } from "@aix/db";
import { renderAtomFeed } from "./feed";
import { xmlEscape } from "./public-api";

function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "itm_1",
    slug: "some-tool",
    kind: "github_repo",
    externalId: "acme/tool",
    url: "https://github.com/acme/tool",
    title: "Tool",
    category: "mcp-server",
    integration: "mcp",
    verdict: "worthwhile",
    primaryAudience: "ai-engineer",
    aiEngineerFit: 80,
    vibeCoderFit: 40,
    overallScore: 72,
    noiseScore: 20,
    tagline: "A terse hook.",
    tagsJson: "[]",
    evaluationJson: "{}",
    mediaJson: "[]",
    coverImageUrl: null,
    evaluatedBy: "ai",
    model: null,
    published: true,
    score: 0,
    upvotes: 0,
    commentCount: 0,
    createdAt: 1_700_000_000,
    ...overrides,
  } as Item;
}

test("xmlEscape escapes all five XML metacharacters", () => {
  expect(xmlEscape(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
});

test("renderAtomFeed escapes hostile title/tagline so no raw markup leaks", () => {
  const xml = renderAtomFeed(
    [
      fakeItem({
        title: `Evil <script>alert("x")</script> & "co"`,
        tagline: "5 < 6 & 7 > 2",
      }),
    ],
    "/feed.xml",
  );

  expect(xml).not.toContain("<script>");
  expect(xml).toContain("&lt;script&gt;");
  expect(xml).toContain("&amp;");

  // Every raw ampersand must be the start of a valid XML entity.
  const badAmp = xml.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/);
  expect(badAmp).toBeNull();
});

test("renderAtomFeed emits a self link and one entry per item", () => {
  const xml = renderAtomFeed([fakeItem(), fakeItem({ slug: "b", id: "itm_2" })], "/feed.xml");
  expect(xml).toContain(`<link href="https://aix.trevormil.com/feed.xml" rel="self" />`);
  expect(xml.match(/<entry>/g)?.length).toBe(2);
  expect(xml).toContain("verdict: worthwhile, 72/100");
});
