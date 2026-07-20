import { test, expect, beforeAll, afterEach } from "bun:test";
import { rmSync } from "node:fs";

/** iOS OAuth hand-off (ticket 0057): callback redirects to aix://auth#token=… */
const DB_PATH = `/tmp/aix-callback-test-${process.pid}.db`;

let GET: typeof import("./route").GET;
let resolveSessionUser: typeof import("@/lib/auth").resolveSessionUser;

const realFetch = globalThis.fetch;

function mockGithub(login = "cb-test-user", id = 990001) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("login/oauth/access_token")) {
      return Response.json({ access_token: "gh-token" });
    }
    if (url.includes("api.github.com/user")) {
      return Response.json({ id, login, name: "CB Test", avatar_url: "" });
    }
    throw new Error(`unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;
  process.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.test";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "secret";
  process.env.AIX_PUBLIC_URL = "https://aix.trevormil.com";

  const { runMigrations } = await import("@/lib/migrate");
  ({ resolveSessionUser } = await import("@/lib/auth"));
  ({ GET } = await import("./route"));
  runMigrations();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const callback = (params: string, cookie: string) =>
  new Request(`https://aix.trevormil.com/api/auth/callback?${params}`, {
    headers: { cookie },
  });

test("web flow: valid state sets the session cookie and redirects to the profile", async () => {
  mockGithub("cb-web-user");
  const res = await GET(callback("code=c1&state=st1", "aix_oauth_state=st1"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("https://aix.trevormil.com/u/cb-web-user");
  const setCookie = res.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("aix_session=");
});

test("state mismatch redirects to /?auth=error and opens no session", async () => {
  mockGithub();
  const res = await GET(callback("code=c1&state=WRONG", "aix_oauth_state=st1"));
  expect(res.headers.get("location")).toBe("https://aix.trevormil.com/?auth=error");
  expect(res.headers.get("set-cookie") ?? "").not.toContain("aix_session=");
});

test("ios flow: redirects to aix://auth#token=… with a live session and no session cookie", async () => {
  mockGithub("cb-ios-user", 990002);
  const res = await GET(callback("code=c2&state=st2", "aix_oauth_state=st2; aix_oauth_client=ios"));
  const loc = res.headers.get("location") ?? "";
  expect(loc.startsWith("aix://auth#token=")).toBe(true);
  const token = loc.slice("aix://auth#token=".length);
  expect(resolveSessionUser(token)?.username).toBe("cb-ios-user");
  expect(res.headers.get("set-cookie") ?? "").not.toContain("aix_session=");
});
