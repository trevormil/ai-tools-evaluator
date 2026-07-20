import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bearerToken, destroySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function signOut(req: Request) {
  // Mobile clients sign out with their bearer token — JSON, no redirect.
  const bearer = bearerToken(req.headers.get("authorization"));
  if (bearer) {
    destroySession(bearer);
    return NextResponse.json({ ok: true });
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const GET = signOut;
export const POST = signOut;
