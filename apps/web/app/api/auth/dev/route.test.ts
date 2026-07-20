import { test, expect, beforeAll, afterEach } from "bun:test";
import { rmSync } from "node:fs";

/** Dev login JSON mode (ticket 0057): simulator sign-in without OAuth. */
const DB_PATH = `/tmp/aix-devlogin-test-${process.pid}.db`;

let GET: typeof import("./route").GET;
let resolveSessionUser: typeof import("@/lib/auth").resolveSessionUser;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  ({ resolveSessionUser } = await import("@/lib/auth"));
  ({ GET } = await import("./route"));
  runMigrations();
});

afterEach(() => {
  delete process.env.AIX_DEV_LOGIN;
});

test("404s when AIX_DEV_LOGIN is unset, even with client=ios", async () => {
  const res = await GET(new Request("http://localhost:3000/api/auth/dev?client=ios"));
  expect(res.status).toBe(404);
});

test("client=ios returns JSON {token, user} resolving to a live session", async () => {
  process.env.AIX_DEV_LOGIN = "1";
  const res = await GET(new Request("http://localhost:3000/api/auth/dev?u=sim-tester&client=ios"));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { token: string; user: { username: string } };
  expect(body.user.username).toBe("sim-tester");
  expect(resolveSessionUser(body.token)?.username).toBe("sim-tester");
});

test("web flow still redirects with a session cookie", async () => {
  process.env.AIX_DEV_LOGIN = "1";
  const res = await GET(new Request("http://localhost:3000/api/auth/dev?u=sim-web"));
  expect(res.status).toBe(307);
  expect(res.headers.get("set-cookie") ?? "").toContain("aix_session=");
});
