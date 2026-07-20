import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@aix/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Dev-only mock sign-in for local smoke testing — a stand-in for the GitHub
 * OAuth round-trip. Hard-gated behind AIX_DEV_LOGIN=1: when unset (every real
 * deployment), this route is a 404.
 *
 *   GET /api/auth/dev            → sign in as "dev" and redirect to /
 *   GET /api/auth/dev?u=alice    → sign in as "alice" (created on first use)
 */
export async function GET(req: Request) {
  if (getEnv().AIX_DEV_LOGIN !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const username = (url.searchParams.get("u") ?? "dev").toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  const user =
    existing ??
    db
      .insert(users)
      .values({
        id: `dev-${username}`,
        username,
        displayName: `${username} (dev)`,
        bio: "Local dev account",
      })
      .returning()
      .get();

  const { token, expiresAt } = createSession(user.id);

  // Simulator sign-in: hand the token back as JSON instead of a cookie redirect.
  if (url.searchParams.get("client") === "ios") {
    return NextResponse.json({ token, user: { id: user.id, username: user.username } });
  }

  const res = NextResponse.redirect(new URL("/", url.origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
  return res;
}
