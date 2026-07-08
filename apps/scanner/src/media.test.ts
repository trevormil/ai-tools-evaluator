import { describe, expect, test } from "bun:test";
import { MediaAsset } from "@aix/core";
import {
  buildMedia,
  extractReadmeImages,
  githubSocialPreviewUrl,
  ownerAvatarUrl,
  coverImageUrl,
} from "./media";
import { slugify } from "./slug";
import { makeGithubSource } from "./test-fixtures";

describe("media", () => {
  test("github social-preview url is deterministic and well-formed", () => {
    const a = githubSocialPreviewUrl("acme/tool");
    const b = githubSocialPreviewUrl("acme/tool");
    expect(a).toBe(b);
    expect(a).toContain("opengraph.githubassets.com");
    expect(a.endsWith("/acme/tool")).toBe(true);
  });

  test("extractReadmeImages pulls markdown and html image urls, drops non-images", () => {
    const readme = `
      ![demo](https://example.com/demo.gif)
      ![logo](https://example.com/logo.png "title")
      <img src="https://example.com/screen.jpeg" />
      [not an image](https://example.com/page)
    `;
    const urls = extractReadmeImages(readme);
    expect(urls).toContain("https://example.com/demo.gif");
    expect(urls).toContain("https://example.com/logo.png");
    expect(urls).toContain("https://example.com/screen.jpeg");
    expect(urls.every((u) => !u.includes("/page"))).toBe(true);
  });

  test("extractReadmeImages rewrites github blob/raw page urls to raw.githubusercontent", () => {
    // A `github.com/.../blob/...` url serves an HTML page, not the image bytes —
    // used as an <img src> it renders broken. Must be rewritten to raw host.
    const readme = `
      ![demo](https://github.com/pathwaycom/llm-app/blob/main/templates/x/demo.gif)
      <img src="https://github.com/acme/tool/raw/HEAD/assets/banner.png">
    `;
    const urls = extractReadmeImages(readme);
    expect(urls).toEqual([
      "https://raw.githubusercontent.com/pathwaycom/llm-app/main/templates/x/demo.gif",
      "https://raw.githubusercontent.com/acme/tool/HEAD/assets/banner.png",
    ]);
  });

  test("extractReadmeImages resolves relative paths and drops badges", () => {
    const readme = `
      ![logo](docs/logo.png)
      ![build](https://img.shields.io/github/actions/workflow/status/a/b/ci.svg)
      <img src="./assets/banner.svg">
    `;
    const urls = extractReadmeImages(readme, "acme/tool");
    expect(urls).toEqual([
      "https://raw.githubusercontent.com/acme/tool/HEAD/docs/logo.png",
      "https://raw.githubusercontent.com/acme/tool/HEAD/assets/banner.svg",
    ]);
  });

  test("buildMedia defaults the cover to the square owner avatar; readme images + card follow", () => {
    // No evaluator pick → the square avatar leads (a wide README banner would
    // crop badly), with the README images kept in the gallery and the card last.
    const media = buildMedia(
      makeGithubSource(),
      "![a](https://e.com/a.png) ![b](https://e.com/b.png)",
    );
    expect(media[0]!.source).toBe("repo-avatar");
    expect(media[0]!.url).toBe(ownerAvatarUrl("acme/some-tool"));
    expect(media.some((m) => m.source === "repo-readme" && m.url === "https://e.com/a.png")).toBe(
      true,
    );
    expect(media.some((m) => m.source === "repo-social-preview")).toBe(true);
    expect(media.length).toBeLessThanOrEqual(6);
    for (const m of media) expect(() => MediaAsset.parse(m)).not.toThrow();
    expect(coverImageUrl(media)).toBe(media[0]!.url);
  });

  test("buildMedia uses the evaluator's square pick as the cover when it matches a README image", () => {
    const media = buildMedia(
      makeGithubSource(),
      "![a](https://e.com/a.png) ![b](https://e.com/b.png)",
      "https://e.com/b.png",
    );
    expect(media[0]!.source).toBe("repo-readme");
    expect(media[0]!.url).toBe("https://e.com/b.png");
    expect(coverImageUrl(media)).toBe("https://e.com/b.png");
  });

  test("buildMedia ignores a hallucinated cover pick not in the README (falls back to avatar)", () => {
    const media = buildMedia(
      makeGithubSource(),
      "![a](https://e.com/a.png)",
      "https://evil.example/not-in-readme.png",
    );
    expect(media[0]!.source).toBe("repo-avatar");
    expect(media[0]!.url).toBe(ownerAvatarUrl("acme/some-tool"));
  });

  test("buildMedia matches a blob-url pick against the rawified README image", () => {
    const readme = "![demo](https://github.com/acme/some-tool/blob/main/logo.png)";
    const media = buildMedia(
      makeGithubSource(),
      readme,
      "https://github.com/acme/some-tool/blob/main/logo.png",
    );
    expect(media[0]!.source).toBe("repo-readme");
    expect(media[0]!.url).toBe("https://raw.githubusercontent.com/acme/some-tool/main/logo.png");
  });

  test("buildMedia with no README image: square avatar cover, social card second", () => {
    const media = buildMedia(makeGithubSource(), "# Tool\n\nNo images here, just prose.");
    expect(media).toHaveLength(2);
    expect(media[0]!.source).toBe("repo-avatar");
    expect(media[1]!.source).toBe("repo-social-preview");
  });

  test("buildMedia for a paper: a single placeholder cover", () => {
    const media = buildMedia(
      {
        kind: "arxiv_paper",
        externalId: "2401.1",
        url: "http://arxiv.org/abs/2401.1",
        title: "Paper",
      },
      "abstract",
    );
    expect(media).toHaveLength(1);
    expect(media[0]!.source).toBe("ai-generated");
    expect(() => MediaAsset.parse(media[0])).not.toThrow();
  });
});

describe("slugify", () => {
  test("owner/repo -> kebab", () => {
    expect(slugify("acme/Some_Tool")).toBe("acme-some-tool");
  });
  test("arxiv id -> kebab", () => {
    expect(slugify("2401.12345")).toBe("2401-12345");
  });
});
