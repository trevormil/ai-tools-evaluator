import { eq } from "drizzle-orm";
import { getDb, profileLinks, type ProfileLink } from "@aix/db";
import { PROFILE_LINK_KINDS, type ProfileLinkKind } from "./profile-link-kinds";

/** All external links for a user, in the canonical kind order. */
export function getProfileLinks(userId: string): ProfileLink[] {
  const rows = getDb().select().from(profileLinks).where(eq(profileLinks.userId, userId)).all();
  const order = new Map(PROFILE_LINK_KINDS.map((k, i) => [k, i]));
  return rows.sort(
    (a, b) =>
      (order.get(a.kind as ProfileLinkKind) ?? 99) - (order.get(b.kind as ProfileLinkKind) ?? 99),
  );
}

/**
 * Replace a user's links with the given set (one URL per kind; empty/omitted
 * kinds are removed). Full-replace keeps the editor dead simple.
 */
export function setProfileLinks(
  userId: string,
  links: { kind: ProfileLinkKind; url: string }[],
): ProfileLink[] {
  const db = getDb();
  db.delete(profileLinks).where(eq(profileLinks.userId, userId)).run();
  for (const { kind, url } of links) {
    const trimmed = url.trim();
    if (trimmed) db.insert(profileLinks).values({ userId, kind, url: trimmed }).run();
  }
  return getProfileLinks(userId);
}
