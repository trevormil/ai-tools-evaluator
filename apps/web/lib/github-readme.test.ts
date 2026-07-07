import { test, expect } from "bun:test";
import { prepareReadme, READMES_MAX_CHARS } from "./github-readme";

/**
 * Repo README display: the transform must survive real-world READMEs —
 * raw-HTML badges/heros, relative links — under an html:false renderer.
 */
const REPO = "acme/tool";

test("converts raw <img> tags to markdown images (badges/heros survive html:false)", () => {
  const md = `<p align="center"><img src="assets/hero.png" alt="Hero"></p>\n\nSome text.`;
  const out = prepareReadme(md, REPO);
  expect(out).toContain(
    "![Hero](https://raw.githubusercontent.com/acme/tool/HEAD/assets/hero.png)",
  );
  expect(out).not.toContain("<img");
  expect(out).toContain("Some text.");
});

test("strips other raw HTML tags instead of leaving escaped noise", () => {
  const md = `<div align="center"><h1>Tool</h1></div>\n\n<details><summary>More</summary>body</details>`;
  const out = prepareReadme(md, REPO);
  expect(out).not.toMatch(/<\/?(div|h1|details|summary)/);
  expect(out).toContain("Tool");
  expect(out).toContain("body");
});

test("rewrites relative markdown links and images to absolute GitHub URLs", () => {
  const md = `![shot](docs/shot.png) and [the guide](docs/guide.md) and [site](https://example.com)`;
  const out = prepareReadme(md, REPO);
  expect(out).toContain("![shot](https://raw.githubusercontent.com/acme/tool/HEAD/docs/shot.png)");
  expect(out).toContain("[the guide](https://github.com/acme/tool/blob/HEAD/docs/guide.md)");
  // Absolute URLs untouched.
  expect(out).toContain("[site](https://example.com)");
});

test("anchor-only and protocol-relative targets are left alone", () => {
  const md = `[jump](#install) ![x](//cdn.example.com/x.png)`;
  const out = prepareReadme(md, REPO);
  expect(out).toContain("[jump](#install)");
  expect(out).toContain("![x](//cdn.example.com/x.png)");
});

test("caps pathological README length", () => {
  const md = "x".repeat(READMES_MAX_CHARS + 5000);
  expect(prepareReadme(md, REPO).length).toBeLessThanOrEqual(READMES_MAX_CHARS + 1);
});
