/** Client-safe profile-link metadata (no DB imports). */
export const PROFILE_LINK_KINDS = [
  "github",
  "x",
  "linkedin",
  "substack",
  "youtube",
  "mastodon",
  "bluesky",
  "telegram",
  "website",
] as const;
export type ProfileLinkKind = (typeof PROFILE_LINK_KINDS)[number];

export const PROFILE_LINK_META: Record<ProfileLinkKind, { label: string; placeholder: string }> = {
  github: { label: "GitHub", placeholder: "https://github.com/you" },
  x: { label: "X", placeholder: "https://x.com/you" },
  linkedin: { label: "LinkedIn", placeholder: "https://linkedin.com/in/you" },
  substack: { label: "Substack", placeholder: "https://you.substack.com" },
  youtube: { label: "YouTube", placeholder: "https://youtube.com/@you" },
  mastodon: { label: "Mastodon", placeholder: "https://mastodon.social/@you" },
  bluesky: { label: "Bluesky", placeholder: "https://bsky.app/profile/you" },
  telegram: { label: "Telegram", placeholder: "https://t.me/you" },
  website: { label: "Website", placeholder: "https://your.site" },
};

export function isProfileLinkKind(v: string): v is ProfileLinkKind {
  return (PROFILE_LINK_KINDS as readonly string[]).includes(v);
}
