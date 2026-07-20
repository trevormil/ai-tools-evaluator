import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** GET /api/me (ticket 0059 support): the mobile session bootstrap. */
const DB_PATH = `/tmp/aix-me-test-${process.pid}.db`;

let GET: (req: Request) => Promise<Response>;
let token: string;

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("@/lib/migrate");
  const { getDb, users, notifications, messages } = await import("@aix/db");
  const { createSession } = await import("@/lib/auth");
  ({ GET } = await import("./route"));
  runMigrations();
  const db = getDb();

  const me = db
    .insert(users)
    .values({ id: "me-user", username: "me-user", displayName: "Me" })
    .returning()
    .get();
  const other = db
    .insert(users)
    .values({ id: "me-other", username: "me-other", displayName: "Other" })
    .returning()
    .get();
  token = createSession(me.id).token;

  db.insert(notifications).values({ userId: me.id, actorId: other.id, type: "follow" }).run();
  db.insert(messages).values({ fromUserId: other.id, toUserId: me.id, body: "hey" }).run();
});

test("bearer token resolves to the public user plus unread badge counts", async () => {
  const res = await GET(
    new Request("https://x/api/me", { headers: { authorization: `Bearer ${token}` } }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.user.username).toBe("me-user");
  expect(body.user.githubId).toBeUndefined();
  expect(body.unreadNotifications).toBe(1);
  expect(body.unreadMessages).toBe(1);
});

test("no auth → 401", async () => {
  const res = await GET(new Request("https://x/api/me"));
  expect(res.status).toBe(401);
});
