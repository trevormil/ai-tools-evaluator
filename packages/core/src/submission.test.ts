import { describe, expect, test } from "bun:test";
import { validateGithubRepoUrl } from "./submission";

describe("validateGithubRepoUrl", () => {
  test("accepts a normal repo url and normalizes it", () => {
    const r = validateGithubRepoUrl("https://github.com/BurntSushi/ripgrep");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.owner).toBe("BurntSushi");
      expect(r.repo).toBe("ripgrep");
      expect(r.externalId).toBe("BurntSushi/ripgrep");
    }
  });

  test("strips a trailing .git and extra path/query", () => {
    const r = validateGithubRepoUrl("http://www.github.com/acme/tool.git/tree/main?tab=readme");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.externalId).toBe("acme/tool");
  });

  test.each([
    ["https://arxiv.org/abs/2210.03629", "Only GitHub"],
    ["https://gitlab.com/foo/bar", "Only GitHub"],
    ["https://github.com/BurntSushi", "Point to a repo"],
    ["https://github.com/orgs/vercel", "not a repo"],
    ["https://github.com/features/copilot", "not a repo"],
    ["not a url", "not a valid URL"],
    ["ftp://github.com/a/b", "http"],
  ])("rejects %s", (url, reasonFragment) => {
    const r = validateGithubRepoUrl(url);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reasonFragment);
  });
});
