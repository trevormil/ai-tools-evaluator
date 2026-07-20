import { cookies, headers } from "next/headers";
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

/** Resolve a session token (cookie or bearer) to its user, or null. */
export function resolveSessionUser(token: string): User | null {
  const row = getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, nowSec())))
    .get();

  return row?.user ?? null;
}

/** Extract the token from an `Authorization: Bearer <token>` header value. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Resolve the signed-in user from the Authorization bearer header (mobile) or
 * the session cookie (web), or null. Reads the DB, so it is server-only and
 * forces dynamic rendering (headers()/cookies()).
 */
export async function getCurrentUser(): Promise<User | null> {
  const fromHeader = bearerToken((await headers()).get("authorization"));
  const token = fromHeader ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSessionUser(token);
}

/**
 * Resolve the viewer for a route handler that receives its Request: bearer
 * header first (mobile), then the browser cookie. The cookie path needs Next's
 * request scope, which bun route tests don't have — no scope means no cookie
 * viewer, so resolve to null rather than throw.
 */
export async function getRequestUser(req: Request): Promise<User | null> {
  const token = bearerToken(req.headers.get("authorization"));
  if (token) return resolveSessionUser(token);
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
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
