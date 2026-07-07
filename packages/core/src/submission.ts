/**
 * Submission gate — the single source of truth for what a human may drop into
 * the queue. Currently GitHub repos only (matching the discovery scope). Shared
 * by the web + internal submission endpoints and the Discord `/score` command so
 * the rule never drifts between them.
 */

/** GitHub top-level paths that are pages, not repos. */
const RESERVED_OWNERS = new Set([
  "orgs",
  "features",
  "settings",
  "marketplace",
  "sponsors",
  "topics",
  "trending",
  "about",
  "pricing",
  "team",
  "enterprise",
  "login",
  "join",
  "new",
  "explore",
  "notifications",
  "issues",
  "pulls",
  "apps",
  "collections",
  "events",
  "codespaces",
  "search",
  "stars",
  "watching",
  "dashboard",
]);

export type SubmissionCheck =
  | { ok: true; owner: string; repo: string; externalId: string }
  | { ok: false; reason: string };

/** Validate + normalize a submitted URL. Rejects non-GitHub and non-repo links. */
export function validateGithubRepoUrl(raw: string): SubmissionCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That's not a valid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: "Link must start with http(s)://." };
  }
  const host = u.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    return { ok: false, reason: "Only GitHub repos are accepted right now." };
  }
  const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "Point to a repo, e.g. https://github.com/owner/repo." };
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (RESERVED_OWNERS.has(owner.toLowerCase())) {
    return { ok: false, reason: "That's a GitHub page, not a repo." };
  }
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    return { ok: false, reason: "That doesn't look like a repo path." };
  }
  return { ok: true, owner, repo, externalId: `${owner}/${repo}` };
}
