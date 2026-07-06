import { test, expect } from "bun:test";
import { renderRecapEmail, type RecapEmail } from "./newsletter";

const recap: RecapEmail = {
  date: "2026-07-06",
  dateLabel: "Monday, July 6, 2026",
  summary: "1 essential · 1 complexity trap",
  items: [
    {
      slug: "aces",
      title: "Aces",
      verdict: "essential",
      overallScore: 91,
      tagline: "the one to beat",
      category: "cli-tool",
      coverImageUrl: null,
      install: "brew install aces",
    },
    {
      slug: "trapzilla",
      title: "Trapzilla",
      verdict: "complexity-trap",
      overallScore: 38,
      tagline: "ten abstractions over one API call",
      category: "agent-framework",
      coverImageUrl: null,
    },
  ],
  lead: {
    slug: "aces",
    title: "Aces",
    verdict: "essential",
    overallScore: 91,
    tagline: "the one to beat",
    category: "cli-tool",
    coverImageUrl: null,
    hook: "The base agent already does most of this.",
  },
  trap: {
    slug: "trapzilla",
    title: "Trapzilla",
    verdict: "complexity-trap",
    overallScore: 38,
    tagline: "ten abstractions over one API call",
    category: "agent-framework",
    coverImageUrl: null,
    hook: "This is complexity for complexity's sake.",
  },
  topAdopted: [{ slug: "aces", title: "Aces", uses: 12 }],
};

test("subject carries the date label and verdict summary, not a link count", () => {
  const { subject } = renderRecapEmail(recap, "tok");
  expect(subject).toContain("Monday, July 6, 2026");
  expect(subject).toContain("1 essential · 1 complexity trap");
});

test("body leads with the pick, names the trap, shows install + adoption", () => {
  const { html } = renderRecapEmail(recap, "tok");
  expect(html).toContain("The one that matters");
  expect(html).toContain("Complexity trap of the night");
  expect(html).toContain("Devil's advocate: The base agent already does most of this.");
  expect(html).toContain("brew install aces");
  expect(html).toContain("What engineers are running");
  expect(html).toContain("12 engineers");
});

test("every email is unsubscribable and links to the web recap", () => {
  const { html } = renderRecapEmail(recap, "tok-123");
  expect(html).toContain("/newsletter/unsubscribe?token=tok-123");
  expect(html).toContain("/recap/2026-07-06");
});

test("no XSS: title/tagline are html-escaped", () => {
  const evil = {
    ...recap,
    items: [{ ...recap.items[0]!, title: "<script>x</script>" }],
    lead: null,
  };
  const { html } = renderRecapEmail(evil, "tok");
  expect(html).not.toContain("<script>x</script>");
  expect(html).toContain("&lt;script&gt;");
});
