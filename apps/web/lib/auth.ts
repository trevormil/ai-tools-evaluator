import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, sessions, users, type User } from "@aix/db";

export const SESSION_COOKIE = "aix_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Create a session row for a user and return its opaque token. */
export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = nowSec() + SESSION_TTL_SECONDS;
  getDb().insert(sessions).values({ id: token, userId, expiresAt }).run();
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  getDb().delete(sessions).where(eq(sessions.id, token)).run();
}

/**
 * Resolve the signed-in user from the session cookie, or null. Reads the DB, so
 * it is server-only and forces dynamic rendering (cookies()).
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, nowSec())))
    .get();

  return row?.user ?? null;
}

/** Throw a 401-carrying error when no user is signed in (used in route handlers). */
export class Unauthorized extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "Unauthorized";
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Unauthorized();
  return user;
}

export { SESSION_TTL_SECONDS };
