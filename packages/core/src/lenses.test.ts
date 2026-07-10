import { expect, test, describe } from "bun:test";
import {
  lensFor,
  LENS_SECTIONS,
  requiredBodySections,
  KIND_LENS,
  buildEvaluatorPrompt,
  evaluatorSystem,
} from "./index";
import type { ItemSource } from "./index";

describe("lensFor", () => {
  test("defaults by kind", () => {
    expect(lensFor({ kind: "github_repo" })).toBe("agent-tool");
    expect(lensFor({ kind: "arxiv_paper" })).toBe("research");
    expect(lensFor({ kind: "external_link" })).toBe("product");
  });

  test("an explicit lens overrides the kind default", () => {
    // A GitHub repo that is really a launched product.
    expect(lensFor({ kind: "github_repo", lens: "product" })).toBe("product");
  });

  test("unknown kinds fall back to product", () => {
    expect(lensFor({ kind: "producthunt" })).toBe("product");
  });

  test("KIND_LENS covers every ITEM_KIND", () => {
    for (const kind of Object.keys(KIND_LENS)) {
      expect(lensFor({ kind })).toBeDefined();
    }
  });
});

describe("sections", () => {
  test("agent-tool keeps the original fixed sections, in order", () => {
    expect(LENS_SECTIONS["agent-tool"].map((s) => s.key)).toEqual([
      "whatItIs",
      "vsVanilla",
      "surfaceArea",
      "devilsAdvocate",
      "whatWouldMakeItBetter",
      "steelman",
    ]);
    expect(LENS_SECTIONS["agent-tool"].find((s) => s.key === "vsVanilla")!.title).toBe(
      "How it differs from vanilla Claude",
    );
  });

  test("product lens swaps in vsAlternatives and drops the agent-only sections", () => {
    const keys = LENS_SECTIONS["product"].map((s) => s.key);
    expect(keys).toContain("vsAlternatives");
    expect(keys).not.toContain("vsVanilla");
    expect(keys).not.toContain("surfaceArea");
  });

  test("required sections are the ones flagged required in each lens", () => {
    expect(requiredBodySections("agent-tool")).toEqual([
      "whatItIs",
      "vsVanilla",
      "surfaceArea",
      "devilsAdvocate",
      "whatWouldMakeItBetter",
    ]);
    expect(requiredBodySections("product")).toContain("vsAlternatives");
    expect(requiredBodySections("research")).toContain("vsPriorWork");
  });
});

describe("prompt framing", () => {
  const base: ItemSource = {
    kind: "github_repo",
    externalId: "acme/tool",
    url: "https://github.com/acme/tool",
    title: "Tool",
  };

  test("agent-tool prompt is framed against a base agent; product against incumbents", () => {
    const agent = buildEvaluatorPrompt(base, "readme");
    expect(agent).toContain("base agent");
    expect(agent).toContain("vsVanilla");

    const product = buildEvaluatorPrompt({ ...base, lens: "product" }, "readme");
    expect(product).toContain("vsAlternatives");
    expect(product).not.toContain("vsVanilla");
    expect(product).toContain("incumbent");
  });

  test("evaluatorSystem swaps the frame per lens", () => {
    expect(evaluatorSystem("agent-tool")).toContain("base agent");
    expect(evaluatorSystem("research")).toContain("prior work");
  });
});
