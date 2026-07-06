import { eq } from "drizzle-orm";
import { getDb, users } from "@aix/db";

/** Update the current user's editable profile fields. */
export function updateProfile(userId: string, fields: { displayName?: string | null; bio?: string | null }): void {
  const patch: Record<string, string | null> = {};
  if (fields.displayName !== undefined) patch.displayName = fields.displayName?.slice(0, 80) || null;
  if (fields.bio !== undefined) patch.bio = fields.bio?.slice(0, 500) || null;
  if (Object.keys(patch).length === 0) return;
  getDb().update(users).set(patch).where(eq(users.id, userId)).run();
}

/** Point a user's avatar at an uploaded image URL. */
export function setAvatar(userId: string, url: string): void {
  getDb().update(users).set({ avatarUrl: url }).where(eq(users.id, userId)).run();
}
