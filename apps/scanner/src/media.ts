import crypto from "node:crypto";
import type { ItemSource, MediaAsset } from "@aix/core";

/**
 * Every item gets at least one image. GitHub repos get their social-preview card
 * plus any images/gifs found in the README; papers (which have no imagery) get a
 * generated placeholder cover. By convention `media[0]` IS the cover — see
 * `coverImageUrl`.
 */

const MAX_URL = 500; // MediaAsset.url is capped at 500 in the schema.

/**
 * GitHub's social-preview endpoint. The leading path segment is an opaque
 * cache-buster GitHub ignores; we derive a stable hex from the repo id so the
 * URL is deterministic per repo.
 */
export function githubSocialPreviewUrl(externalId: string): string {
  const hash = crypto.createHash("sha256").update(externalId).digest("hex").slice(0, 32);
  return `https://opengraph.githubassets.com/${hash}/${externalId}`;
}

/**
 * GitHub owner avatar — square by nature, and the org logo for org-owned repos.
 * The square-safe default cover when the README has no clean square logo.
 */
export function ownerAvatarUrl(externalId: string): string {
  const owner = externalId.split("/")[0] ?? externalId;
  return `https://github.com/${owner}.png?size=200`;
}

/** A deterministic placeholder cover for items with no real imagery (papers). */
export function placeholderCoverUrl(title: string): string {
  const text = encodeURIComponent(title.slice(0, 60));
  return `https://placehold.co/1200x630/0b1020/e2e8f0.png?text=${text}`;
}

// Image srcs in markdown `![](url "title")` and inline `<img src>` — relative OR absolute.
const MD_IMG =
  /!\[[^\]]*\]\(\s*(<)?([^)\s>"']+?\.(?:png|jpe?g|gif|webp|svg))(?:>)?(?:\s+[^)]*)?\)/gi;
const HTML_IMG = /<img[^>]+src=["']([^"']+?\.(?:png|jpe?g|gif|webp|svg))["']/gi;

// Shields / CI / coverage badges — noise, never a logo.
const BADGE_RE =
  /shields\.io|badgen\.net|img\.shields|badge\.fury|coveralls|codecov|circleci\.com\/.+\.svg|travis-ci|\/workflows\/.+badge|\/badge\.svg|[?&](?:style|label|logo)=|david-dm|snyk\.io|deepsource|bettercodehub/i;

/**
 * A `github.com/{owner}/{repo}/blob|raw/{ref}/{path}` url serves an HTML file
 * viewer, not the image bytes — as an <img src> it renders broken. Rewrite it to
 * the raw.githubusercontent.com host that serves the actual image.
 */
function rawifyGithubBlob(url: string): string {
  const m = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|raw)\/(.+)$/i.exec(url);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}` : url;
}

/** Absolute-ize a README image src; a relative path → raw.githubusercontent for the repo. */
function resolveImageUrl(raw: string, externalId?: string): string | null {
  if (/^https?:\/\//i.test(raw)) return rawifyGithubBlob(raw);
  if (raw.startsWith("//")) return rawifyGithubBlob(`https:${raw}`);
  if (raw.startsWith("data:") || !externalId) return null;
  const path = raw.replace(/^\.?\/+/, "");
  return path ? `https://raw.githubusercontent.com/${externalId}/HEAD/${path}` : null;
}

/**
 * README image urls in document order (top first). Relative paths resolve to
 * raw.githubusercontent; shields/CI badges are dropped (never a logo).
 */
export function extractReadmeImages(readme: string, externalId?: string, max = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const re of [MD_IMG, HTML_IMG]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(readme)) !== null) {
      const raw = (re === MD_IMG ? m[2] : m[1])!;
      if (BADGE_RE.test(raw)) continue;
      const url = resolveImageUrl(raw, externalId);
      if (!url || url.length > MAX_URL || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/**
 * Derive the media set for an item. `media[0]` is the cover, chosen to look good
 * cropped to a square thumbnail. For a repo the cover cascades: the LLM's
 * validated square pick from the README → the (always-square) owner avatar →
 * GitHub's social-preview card. `preferredCover` is the evaluator's pick; it is
 * only trusted when it matches an image we actually extracted from the README,
 * guarding against a hallucinated URL.
 */
export function buildMedia(
  source: ItemSource,
  readme: string,
  preferredCover?: string,
): MediaAsset[] {
  const media: MediaAsset[] = [];

  if (source.kind === "github_repo") {
    const readmeImgs = extractReadmeImages(readme, source.externalId);
    const socialPreview: MediaAsset = {
      type: "image",
      url: githubSocialPreviewUrl(source.externalId),
      source: "repo-social-preview",
      alt: `${source.title} social preview`,
    };

    const pick = preferredCover ? rawifyGithubBlob(preferredCover) : undefined;
    const cover: MediaAsset =
      pick && readmeImgs.includes(pick)
        ? { type: "image", url: pick, source: "repo-readme", alt: `${source.title} logo` }
        : {
            type: "image",
            url: ownerAvatarUrl(source.externalId),
            source: "repo-avatar",
            alt: `${source.title} icon`,
          };
    media.push(cover);

    // Gallery: the remaining README images (top first), then the social card.
    for (const url of readmeImgs) {
      if (url === cover.url) continue;
      media.push({
        type: "image",
        url,
        source: "repo-readme",
        alt: `${source.title} README image`,
      });
    }
    media.push(socialPreview);
  } else {
    // arXiv papers and other kinds have no imagery of their own.
    media.push({
      type: "image",
      url: placeholderCoverUrl(source.title),
      source: "ai-generated",
      alt: `${source.title} cover`,
    });
  }

  return media.slice(0, 6);
}

/** The cover convention: the cached copy of media[0] if mirrored, else its url. */
export function coverImageUrl(media: MediaAsset[]): string | undefined {
  const first = media[0];
  return first ? (first.cachedUrl ?? first.url) : undefined;
}
