/**
 * Cover selection (ticket 0073, round 3). Ranking per Trevor: a real README
 * image beats the GitHub owner avatar, but ANY real image beats a monogram
 * tile — personal-account avatars are fine as covers (kepano's artwork
 * avatar > a "K"). Only true junk is dropped: placehold.co text tiles,
 * social-preview cards (rendered stat banners), and SVGs (native clients
 * can't render them).
 */

const PLACEHOLD_RE = /^https?:\/\/placehold\.co\//;
const AVATAR_RE = /^https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9-]+\.png/;

type MediaLike = {
  type: string;
  url: string;
  cachedUrl?: string | null;
  source?: string;
};

function displayable(url: string, source?: string): boolean {
  if (PLACEHOLD_RE.test(url)) return false;
  if (source === "repo-social-preview") return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  return true;
}

/**
 * Best displayable cover from an item's media: first non-avatar image
 * (README logos/screenshots), then the owner avatar, then null (client
 * renders a monogram tile).
 */
export function pickCover(media: MediaLike[]): string | null {
  let avatar: string | null = null;
  for (const asset of media) {
    if (asset.type !== "image") continue;
    const url = asset.cachedUrl ?? asset.url;
    if (!displayable(url, asset.source)) continue;
    if (asset.source === "repo-avatar" || AVATAR_RE.test(url)) {
      avatar = avatar ?? url;
      continue;
    }
    return url;
  }
  return avatar;
}
