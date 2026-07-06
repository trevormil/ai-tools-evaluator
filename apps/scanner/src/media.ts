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

/** A deterministic placeholder cover for items with no real imagery (papers). */
export function placeholderCoverUrl(title: string): string {
  const text = encodeURIComponent(title.slice(0, 60));
  return `https://placehold.co/1200x630/0b1020/e2e8f0.png?text=${text}`;
}

const MD_IMG = /!\[[^\]]*\]\((https?:\/\/[^)\s]+?\.(?:png|jpe?g|gif|webp|svg))(?:\s+[^)]*)?\)/gi;
const HTML_IMG = /<img[^>]+src=["'](https?:\/\/[^"']+?\.(?:png|jpe?g|gif|webp|svg))["']/gi;

/** Pull absolute image/gif URLs out of README markdown + inline <img> tags. */
export function extractReadmeImages(readme: string, max = 4): string[] {
  const found = new Set<string>();
  for (const re of [MD_IMG, HTML_IMG]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(readme)) !== null) {
      const url = m[1]!;
      if (url.length <= MAX_URL) found.add(url);
      if (found.size >= max) break;
    }
    if (found.size >= max) break;
  }
  return [...found].slice(0, max);
}

/** Derive the media set for an item. `media[0]` is always the cover. */
export function buildMedia(source: ItemSource, readme: string): MediaAsset[] {
  const media: MediaAsset[] = [];

  if (source.kind === "github_repo") {
    media.push({
      type: "image",
      url: githubSocialPreviewUrl(source.externalId),
      source: "repo-social-preview",
      alt: `${source.title} social preview`,
    });
    for (const url of extractReadmeImages(readme)) {
      media.push({
        type: "image",
        url,
        source: "repo-readme",
        alt: `${source.title} README image`,
      });
    }
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
