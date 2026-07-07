import { describe, expect, it } from "bun:test";
import { buildItemEmbed } from "./embeds";
import type { DigestItem } from "./client";

const sample: DigestItem = {
  slug: "cool-mcp",
  title: "Cool MCP Server",
  url: "https://github.com/acme/cool-mcp",
  verdict: "complexity-trap",
  overallScore: 41,
  tagline: "Wraps three API calls in a server you now have to run.",
  category: "mcp-server",
  coverImageUrl: "https://cdn.aix.test/cool-mcp.png",
};

describe("buildItemEmbed", () => {
  it("maps the item fields onto the embed", () => {
    const { data } = buildItemEmbed(sample);
    expect(data.title).toBe("Cool MCP Server");
    expect(data.url).toBe("https://github.com/acme/cool-mcp");
    expect(data.description).toBe(sample.tagline);
    expect(data.image?.url).toBe("https://cdn.aix.test/cool-mcp.png");

    const fields = Object.fromEntries((data.fields ?? []).map((f) => [f.name, f.value]));
    expect(fields.Verdict).toBe("Complexity Trap");
    expect(fields.Overall).toBe("41/100");
    expect(fields.Category).toBe("MCP Server"); // CATEGORY_LABELS lookup
  });

  it("links to the AIx item page and surfaces install + decision layer + audience", () => {
    const rich: DigestItem = {
      ...sample,
      slug: "cool-mcp",
      install: "npx cool-mcp init",
      adoptIf: ["you need multi-repo search", "you live in the terminal"],
      skipIf: ["you already run a similar server"],
      aiEngineerFit: 88,
      noiseScore: 30,
    };
    const { data } = buildItemEmbed(rich, { siteBaseUrl: "https://aix.trevormil.com" });
    // Title links to the AIx evaluation, not the raw repo.
    expect(data.url).toBe("https://aix.trevormil.com/item/cool-mcp");
    expect(data.description).toContain("npx cool-mcp init");

    const fields = Object.fromEntries((data.fields ?? []).map((f) => [f.name, f.value]));
    expect(fields["✅ Adopt if"]).toContain("you need multi-repo search");
    expect(fields["⛔ Skip if"]).toContain("you already run a similar server");
    expect(fields["AI-eng fit"]).toBe("88/100");
    expect(fields.Noise).toBe("30/100");
    // Both the AIx site link and the repo link are present.
    expect(fields.Links).toContain("https://aix.trevormil.com/item/cool-mcp");
    expect(fields.Links).toContain("https://github.com/acme/cool-mcp");
  });

  it("omits the image when there's no cover, and falls back to raw category", () => {
    const { data } = buildItemEmbed({ ...sample, coverImageUrl: null, category: "unknown-cat" });
    expect(data.image).toBeUndefined();
    const fields = Object.fromEntries((data.fields ?? []).map((f) => [f.name, f.value]));
    expect(fields.Category).toBe("unknown-cat");
  });
});
