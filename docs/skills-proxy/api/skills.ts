import { getVercelOidcToken } from "@vercel/oidc";

/**
 * skills.sh proxy — deployed on Vercel so it can mint the Vercel OIDC token that
 * skills.sh requires, then forward to its authenticated API. The AIx scanner
 * (on DOKS, which can't mint OIDC) calls THIS endpoint with a shared secret.
 *
 * Two modes:
 *   GET /api/skills?view=trending&per_page=8   → the trending leaderboard
 *   GET /api/skills?detail=<owner>/<repo>/<slug> → one skill's files (SKILL.md…)
 */
export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.SKILLS_PROXY_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const u = new URL(req.url);
  const detail = u.searchParams.get("detail");
  const target = detail
    ? `https://skills.sh/api/v1/skills/${detail.replace(/^\/+/, "")}`
    : `https://skills.sh/api/v1/skills?view=${encodeURIComponent(
        u.searchParams.get("view") ?? "trending",
      )}&per_page=${encodeURIComponent(u.searchParams.get("per_page") ?? "20")}`;

  try {
    const token = await getVercelOidcToken();
    const res = await fetch(target, { headers: { Authorization: `Bearer ${token}` } });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return json({ error: "proxy_failed", message: String(err) }, 502);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
