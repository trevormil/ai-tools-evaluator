import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Kick off GitHub OAuth: redirect the user to GitHub's authorize screen. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const clientId = getEnv().GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    // OAuth app not configured yet — degrade to a friendly redirect, not a 500.
    console.warn("[auth] GITHUB_OAUTH_CLIENT_ID unset — GitHub login unavailable");
    return NextResponse.redirect(new URL("/?error=login_unavailable", origin));
  }
  const state = crypto.randomUUID();

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
  authUrl.searchParams.set("scope", "read:user");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("aix_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
