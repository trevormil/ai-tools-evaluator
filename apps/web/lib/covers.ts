import { getEnv } from "./env";

/**
 * Cover quality control (ticket 0073). The scanner's cover cascade falls back
 * to the GitHub owner avatar — a proper logo for Organization accounts, but a
 * personal selfie for User accounts, which reads as noise in a tool
 * directory. placehold.co text placeholders are junk at thumbnail size too.
 * A null cover is better: clients render a clean monogram tile instead.
 */

const AVATAR_RE = /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\.png/;
const PLACEHOLD_RE = /^https?:\/\/placehold\.co\//;

const ownerTypeCache = new Map<string, "User" | "Organization">();

/** Test hook. */
export function clearOwnerTypeCache(): void {
  ownerTypeCache.clear();
}

/** GitHub account type, cached per owner for the pod's lifetime. */
export async function githubOwnerType(owner: string): Promise<"User" | "Organization" | null> {
  const key = owner.toLowerCase();
  const hit = ownerTypeCache.get(key);
  if (hit) return hit;

  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "aix-web",
  };
  const token = getEnv().GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/users/${owner}`, { headers });
  if (!res.ok) return null; // unknown — leave the cover alone
  const body = (await res.json()) as { type?: string };
  const type = body.type === "Organization" ? "Organization" : "User";
  ownerTypeCache.set(key, type);
  return type;
}

/**
 * Null out covers that are personal-account avatars or text placeholders;
 * keep real logos (org avatars, README picks) untouched. Unknown owner type
 * (API failure) keeps the cover — better a maybe-face than flickering data.
 */
export async function sanitizeCoverUrl(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  if (PLACEHOLD_RE.test(coverUrl)) return null;
  const avatarOwner = coverUrl.match(AVATAR_RE)?.[1];
  if (!avatarOwner) return coverUrl;
  const type = await githubOwnerType(avatarOwner);
  return type === "User" ? null : coverUrl;
}

type MediaLike = {
  type: string;
  url: string;
  cachedUrl?: string | null;
  source?: string;
};

/**
 * Choose the best displayable cover from an item's media: the first image
 * that survives sanitation, skipping social-preview cards (they feature the
 * owner's face prominently) and SVGs (native clients can't render them).
 * Null when nothing qualifies — clients show a monogram tile.
 */
export async function pickCover(media: MediaLike[]): Promise<string | null> {
  for (const asset of media) {
    if (asset.type !== "image") continue;
    if (asset.source === "repo-social-preview") continue;
    const url = asset.cachedUrl ?? asset.url;
    if (/\.svg(\?|$)/i.test(url)) continue;
    const sanitized = await sanitizeCoverUrl(url);
    if (sanitized) return sanitized;
  }
  return null;
}
