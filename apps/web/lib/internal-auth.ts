import { getEnv } from "./env";

/**
 * Guard for `/api/internal/*`. Requires `Authorization: Bearer $AIX_INTERNAL_TOKEN`.
 * Returns true when the request is authorized. If the token isn't configured the
 * internal API is effectively closed (every request 401s).
 */
export function isInternalAuthorized(req: Request): boolean {
  const expected = getEnv().AIX_INTERNAL_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token === expected;
}
