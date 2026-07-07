import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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

/** OAuth callback: verify state, exchange the code, upsert the user, open a session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const savedState = store.get("aix_oauth_state")?.value;
  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(`${url.origin}/?auth=error`);
  }

  const { GITHUB_OAUTH_CLIENT_ID: clientId, GITHUB_OAUTH_CLIENT_SECRET: clientSecret } = getEnv();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${url.origin}/?error=login_unavailable`);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${url.origin}/?auth=error`);
  }

  const ghRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "aix-web",
    },
  });
  if (!ghRes.ok) {
    return NextResponse.redirect(`${url.origin}/?auth=error`);
  }
  const gh = (await ghRes.json()) as GithubUser;

  const user = upsertGithubUser(gh);
  const { token, expiresAt } = createSession(user.id);

  const res = NextResponse.redirect(`${url.origin}/u/${user.username}`);
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
