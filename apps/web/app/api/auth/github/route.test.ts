import { test, expect, afterEach } from "bun:test";
import { GET } from "./route";

const req = () => new Request("https://aix.trevormil.com/api/auth/github");

afterEach(() => {
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.AIX_PUBLIC_URL;
});

test("degrades to a friendly redirect (no 500) when OAuth is not configured", async () => {
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  const res = await GET(req());
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toContain("/?error=login_unavailable");
});

test("empty client id is treated as unconfigured", async () => {
  process.env.GITHUB_OAUTH_CLIENT_ID = "";
  const res = await GET(req());
  expect(res.headers.get("location")).toContain("login_unavailable");
});

test("redirects to GitHub's authorize screen when configured", async () => {
  process.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.testclient";
  const res = await GET(req());
  const loc = res.headers.get("location") ?? "";
  expect(loc).toContain("github.com/login/oauth/authorize");
  expect(loc).toContain("client_id=Iv1.testclient");
  expect(loc).toContain("redirect_uri=https%3A%2F%2Faix.trevormil.com%2Fapi%2Fauth%2Fcallback");
});

test("uses AIX_PUBLIC_URL as origin even when the request hits the internal host", async () => {
  process.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.x";
  process.env.AIX_PUBLIC_URL = "https://aix.trevormil.com";
  // Behind the ingress the app sees an internal localhost request:
  const res = await GET(new Request("http://localhost:3000/api/auth/github"));
  const loc = res.headers.get("location") ?? "";
  expect(loc).toContain("redirect_uri=https%3A%2F%2Faix.trevormil.com%2Fapi%2Fauth%2Fcallback");
});
