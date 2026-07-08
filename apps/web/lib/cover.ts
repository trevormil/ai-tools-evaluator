/**
 * Cover-image fallback for item thumbnails. Thumbnails render in a fixed square
 * box (object-cover), so the stored cover — often a wide banner or 2:1 social
 * card — can crop badly or 404. `coverImageCandidates` yields an ordered list of
 * progressively safer, always-square sources; the <img> cascades through them on
 * load failure so every item shows something sensible cropped square.
 */

/** GitHub owner avatar — square by nature; the org logo for org-owned repos. */
export function ownerAvatarUrl(externalId: string): string {
  const owner = externalId.split("/")[0] ?? externalId;
  return `https://github.com/${owner}.png?size=200`;
}

/**
 * GitHub's social-preview card (2:1). The leading path segment is an opaque
 * cache-buster GitHub ignores, so any constant works.
 */
export function githubSocialPreviewUrl(externalId: string): string {
  return `https://opengraph.githubassets.com/1/${externalId}`;
}

/** A titled square placeholder — the guaranteed last resort. */
export function placeholderCoverUrl(title: string): string {
  return `https://placehold.co/400x400/0b1020/e2e8f0.png?text=${encodeURIComponent(title.slice(0, 40))}`;
}

export type CoverInput = {
  coverImageUrl?: string | null;
  /** "owner/repo" for GitHub, arXiv id for papers. */
  externalId: string;
  kind: string;
  title: string;
};

/**
 * Ordered cover candidates, best first: the stored cover, then (for repos) the
 * square owner avatar and the social card, then a placeholder. Deduped and never
 * empty, so an <img> walking this list always lands on something.
 */
export function coverImageCandidates(item: CoverInput): string[] {
  const out: string[] = [];
  if (item.coverImageUrl) out.push(item.coverImageUrl);
  if (item.kind === "github_repo") {
    out.push(ownerAvatarUrl(item.externalId));
    out.push(githubSocialPreviewUrl(item.externalId));
  }
  out.push(placeholderCoverUrl(item.title));
  return [...new Set(out)];
}
