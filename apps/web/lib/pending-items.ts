import { createHash } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { getDb, items, type Item } from "@aix/db";

/**
 * Instant submissions (ticket 0035): a submitted URL becomes a VISIBLE
 * directory item immediately, in scoreStatus="pending" — social from second
 * one, scored by the evaluation queue later (the scanner upgrades the same
 * row in place, so comments/takes/votes survive).
 */

export type DerivedSource = {
  kind: "github_repo" | "arxiv_paper" | "external_link";
  externalId: string;
  title: string;
  coverImageUrl: string | null;
};

/** Classify a URL the way the scanner would, without any network call. */
export function deriveSource(url: string): DerivedSource {
  const u = new URL(url);

  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    const [owner, repo] = u.pathname.replace(/^\/+/, "").split("/");
    if (owner && repo) {
      const cleanRepo = repo.replace(/\.git$/, "");
      const externalId = `${owner}/${cleanRepo}`;
      // The repo's own social-preview card — NOT the owner's avatar (which for a
      // personal repo is just a profile pic). Matches the cover the scanner sets
      // on scoring (see scanner media.ts githubSocialPreviewUrl), so the cover
      // doesn't change when the pending item is upgraded.
      const hash = createHash("sha256").update(externalId).digest("hex").slice(0, 32);
      return {
        kind: "github_repo",
        externalId,
        title: cleanRepo,
        coverImageUrl: `https://opengraph.githubassets.com/${hash}/${externalId}`,
      };
    }
  }

  if (u.hostname.endsWith("arxiv.org")) {
    const m = u.pathname.match(/\/(?:abs|pdf)\/([\w.-]+?)(?:\.pdf)?$/);
    if (m) {
      return {
        kind: "arxiv_paper",
        externalId: m[1]!,
        title: `arXiv:${m[1]}`,
        coverImageUrl: null,
      };
    }
  }

  return {
    kind: "external_link",
    externalId: `${u.hostname}${u.pathname}`.replace(/\/+$/, ""),
    title: u.hostname.replace(/^www\./, ""),
    coverImageUrl: null,
  };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tool"
  );
}

/**
 * Create the pending item for a submitted URL, or return the existing item
 * (pending OR scored) covering the same source.
 */
export function createPendingItem(
  url: string,
  submittedById: string | null,
): { item: Item; existed: boolean } {
  const db = getDb();
  const src = deriveSource(url);

  const existing = db
    .select()
    .from(items)
    .where(
      or(eq(items.url, url), and(eq(items.kind, src.kind), eq(items.externalId, src.externalId))),
    )
    .get();
  if (existing) return { item: existing, existed: true };

  let slug = slugify(src.title);
  if (db.select({ id: items.id }).from(items).where(eq(items.slug, slug)).get()) {
    slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  const item = db
    .insert(items)
    .values({
      slug,
      kind: src.kind,
      externalId: src.externalId,
      url,
      title: src.title,
      // Placeholder taxonomy/score values — the UI never shows them while
      // scoreStatus="pending"; the scanner overwrites them on evaluation.
      category: "other",
      integration: "standalone-app",
      verdict: "niche",
      overallScore: 0,
      noiseScore: 0,
      tagline: "Community submission — evaluated within ~5 min.",
      evaluationJson: "{}",
      coverImageUrl: src.coverImageUrl,
      evaluatedBy: "pending",
      postedById: submittedById,
      published: true,
      scoreStatus: "pending",
    })
    .returning()
    .get();

  return { item, existed: false };
}
