import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Kick off GitHub OAuth: redirect the user to GitHub's authorize screen. */
export async function GET(req: Request) {
  const env = getEnv();
  // Behind the ingress, req.url's origin is the internal host — use the public
  // URL so the OAuth redirect_uri matches the registered callback exactly.
  const base = (env.AIX_PUBLIC_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    // OAuth app not configured yet — degrade to a friendly redirect, not a 500.
    console.warn("[auth] GITHUB_OAUTH_CLIENT_ID unset — GitHub login unavailable");
    return NextResponse.redirect(`${base}/?error=login_unavailable`);
  }
  const state = crypto.randomUUID();

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `${base}/api/auth/callback`);
  authUrl.searchParams.set("scope", "read:user");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("aix_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  // Native clients (ASWebAuthenticationSession) mark the round-trip so the
  // callback hands the session back via aix:// instead of a browser cookie.
  if (new URL(req.url).searchParams.get("client") === "ios") {
    res.cookies.set("aix_oauth_client", "ios", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  return res;
}
