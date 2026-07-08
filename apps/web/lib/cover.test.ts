import { describe, expect, test } from "bun:test";
import {
  coverImageCandidates,
  ownerAvatarUrl,
  githubSocialPreviewUrl,
  placeholderCoverUrl,
} from "./cover";

describe("coverImageCandidates", () => {
  test("github repo: stored cover → square avatar → social card → placeholder", () => {
    const c = coverImageCandidates({
      coverImageUrl: "https://broken.example/banner.gif",
      externalId: "pathwaycom/llm-app",
      kind: "github_repo",
      title: "llm-app",
    });
    expect(c[0]).toBe("https://broken.example/banner.gif");
    expect(c[1]).toBe(ownerAvatarUrl("pathwaycom/llm-app"));
    expect(c[2]).toBe(githubSocialPreviewUrl("pathwaycom/llm-app"));
    expect(c[c.length - 1]).toBe(placeholderCoverUrl("llm-app"));
  });

  test("avatar url uses the owner segment and is square-sized", () => {
    expect(ownerAvatarUrl("pathwaycom/llm-app")).toBe("https://github.com/pathwaycom.png?size=200");
  });

  test("non-repo (paper): no github fallbacks, ends at placeholder", () => {
    const c = coverImageCandidates({
      coverImageUrl: placeholderCoverUrl("Paper"),
      externalId: "2401.1",
      kind: "arxiv_paper",
      title: "Paper",
    });
    expect(c).not.toContain(ownerAvatarUrl("2401.1"));
    expect(c).not.toContain(githubSocialPreviewUrl("2401.1"));
  });

  test("never empty — even with no stored cover there is always a candidate", () => {
    const c = coverImageCandidates({
      coverImageUrl: null,
      externalId: "acme/tool",
      kind: "github_repo",
      title: "tool",
    });
    expect(c.length).toBeGreaterThan(0);
    // No broken/empty leading entry: the square avatar leads when there's no cover.
    expect(c[0]).toBe(ownerAvatarUrl("acme/tool"));
  });

  test("dedupes when the stored cover already equals a fallback", () => {
    const ph = placeholderCoverUrl("T");
    const c = coverImageCandidates({
      coverImageUrl: ph,
      externalId: "2401.1",
      kind: "arxiv_paper",
      title: "T",
    });
    expect(c).toEqual([ph]);
  });
});
