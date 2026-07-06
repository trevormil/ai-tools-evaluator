import { test, expect } from "bun:test";
import { renderMarkdown } from "./markdown";

test("renders ordinary markdown to HTML", () => {
  const html = renderMarkdown("# Hello\n\nSome **bold** text.");
  expect(html).toContain("<h1>Hello</h1>");
  expect(html).toContain("<strong>bold</strong>");
});

test("strips raw <script> tags — never emitted as executable HTML", () => {
  const html = renderMarkdown("hi <script>alert('xss')</script> there");
  // html:false escapes the raw tag; the literal string must not appear.
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("</script>");
  expect(html).toContain("&lt;script&gt;");
});

test("neutralizes <img onerror> payloads — escaped as inert text, no live node", () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)">');
  // No live <img> element and no live attribute boundary — the whole tag is
  // escaped, so onerror only survives as visible text, never as a DOM handler.
  expect(html).not.toContain("<img");
  expect(html).not.toContain('onerror="');
  expect(html).toContain("&lt;img");
});

test("does not emit javascript: links", () => {
  const html = renderMarkdown("[click](javascript:alert(1))");
  // markdown-it's link validator rejects the unsafe scheme, so no href fires it.
  expect(html.toLowerCase()).not.toContain('href="javascript:');
});

test("does not emit javascript: links written as raw HTML anchors", () => {
  const html = renderMarkdown('<a href="javascript:alert(1)">x</a>');
  // Escaped to text, so there is no clickable anchor carrying the scheme.
  expect(html).not.toContain("<a href=");
  expect(html.toLowerCase()).not.toContain('href="javascript:');
  expect(html).toContain("&lt;a");
});

test("safe external links still render as anchors", () => {
  const html = renderMarkdown("[docs](https://example.com)");
  expect(html).toContain('href="https://example.com"');
});
