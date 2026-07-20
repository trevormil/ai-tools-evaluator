import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users, type User } from "@aix/db";
import { getEnv } from "@/lib/env";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

type GithubUser = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string;
  bio?: string | null;
};

/** Parse the request's Cookie header (kept off next/headers so bun tests can drive it). */
function requestCookies(req: Request): Map<string, string> {
  const jar = new Map<string, string>();
  for (const pair of (req.headers.get("cookie") ?? "").split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
  return jar;
}

/** OAuth callback: verify state, exchange the code, upsert the user, open a session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // Public origin (behind the ingress req.url is the internal host) — used for
  // the OAuth redirect_uri and all browser-facing redirects.
  const base = (getEnv().AIX_PUBLIC_URL ?? url.origin).replace(/\/+$/, "");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = requestCookies(req);
  const savedState = jar.get("aix_oauth_state");
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${base}/?auth=error`);
  }

  const { GITHUB_OAUTH_CLIENT_ID: clientId, GITHUB_OAUTH_CLIENT_SECRET: clientSecret } = getEnv();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/?error=login_unavailable`);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${base}/api/auth/callback`,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${base}/?auth=error`);
  }

  const ghRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "aix-web",
    },
  });
  if (!ghRes.ok) {
    return NextResponse.redirect(`${base}/?auth=error`);
  }
  const gh = (await ghRes.json()) as GithubUser;

  const user = upsertGithubUser(gh);
  const { token, expiresAt } = createSession(user.id);

  // Native hand-off: the token rides the custom-scheme fragment (never logged
  // by proxies) and no browser cookie is set.
  if (jar.get("aix_oauth_client") === "ios") {
    const res = NextResponse.redirect(`aix://auth#token=${token}`);
    res.cookies.delete("aix_oauth_state");
    res.cookies.delete("aix_oauth_client");
    return res;
  }

  const res = NextResponse.redirect(`${base}/u/${user.username}`);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
  res.cookies.delete("aix_oauth_state");
  return res;
}

function upsertGithubUser(gh: GithubUser): User {
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.githubId, gh.id)).get();
  if (existing) {
    db.update(users)
      .set({
        displayName: gh.name ?? existing.displayName,
        avatarUrl: gh.avatar_url ?? existing.avatarUrl,
        bio: gh.bio ?? existing.bio,
      })
      .where(eq(users.id, existing.id))
      .run();
    return db.select().from(users).where(eq(users.id, existing.id)).get()!;
  }

  // Pick a username: prefer the GitHub login; if it's already taken by a
  // different account, disambiguate with the GitHub numeric id.
  let username = gh.login;
  const clash = db.select({ id: users.id }).from(users).where(eq(users.username, username)).get();
  if (clash) username = `${gh.login}-${gh.id}`;

  db.insert(users)
    .values({
      githubId: gh.id,
      username,
      displayName: gh.name ?? gh.login,
      avatarUrl: gh.avatar_url,
      bio: gh.bio,
    })
    .run();
  return db.select().from(users).where(eq(users.githubId, gh.id)).get()!;
}
