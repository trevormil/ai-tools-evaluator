import { test, expect } from "bun:test";
import { verdictTitle, shareBlurb, shareSummary, type ShareItem } from "./share";

const item: ShareItem = {
  title: "PageIndex",
  tagline: "Tree-based reasoning retrieval.",
  verdict: "complexity-trap",
  overallScore: 70,
  noiseScore: 25,
  category: "rag-retrieval",
};

test("verdictTitle title-cases hyphenated verdicts", () => {
  expect(verdictTitle("complexity-trap")).toBe("Complexity Trap");
  expect(verdictTitle("worthwhile")).toBe("Worthwhile");
});

test("shareBlurb carries verdict, both scores, category and tagline", () => {
  const blurb = shareBlurb(item);
  expect(blurb).toContain("Verdict: Complexity Trap");
  expect(blurb).toContain("70/100 overall");
  expect(blurb).toContain("Noise 25/100");
  expect(blurb).toContain("Tree-based reasoning retrieval.");
});

test("shareSummary ends with the permalink so chats still unfurl the card", () => {
  const url = "https://aix.trevormil.com/item/pageindex";
  const summary = shareSummary(item, url);
  expect(summary).toContain("**PageIndex**");
  expect(summary).toContain("Overall 70/100 · Noise 25/100");
  expect(summary.trimEnd().endsWith(url)).toBe(true);
});
