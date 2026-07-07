import { test, expect, beforeAll } from "bun:test";
import { rmSync } from "node:fs";

/** Instant submissions (ticket 0035): URL → visible pending item, upgraded in place. */
const DB_PATH = `/tmp/aix-pending-test-${process.pid}.db`;

let deriveSource: typeof import("./pending-items").deriveSource;
let createPendingItem: typeof import("./pending-items").createPendingItem;
let db: ReturnType<typeof import("@aix/db").getDb>;
let schema: typeof import("@aix/db");

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_PATH + suffix, { force: true });
  process.env.AIX_DB_PATH = DB_PATH;

  const { runMigrations } = await import("./migrate");
  schema = await import("@aix/db");
  ({ deriveSource, createPendingItem } = await import("./pending-items"));
  runMigrations();
  db = schema.getDb();
  db.insert(schema.users).values({ id: "pend_u", username: "pending-user" }).run();
});

test("deriveSource classifies github / arxiv / external urls", () => {
  const gh = deriveSource("https://github.com/BurntSushi/ripgrep");
  expect(gh.kind).toBe("github_repo");
  expect(gh.externalId).toBe("BurntSushi/ripgrep");
  expect(gh.title).toBe("ripgrep");
  // The repo's social-preview card, not the owner's avatar.
  expect(gh.coverImageUrl).toMatch(
    /^https:\/\/opengraph\.githubassets\.com\/[a-f0-9]{32}\/BurntSushi\/ripgrep$/,
  );

  const ax = deriveSource("https://arxiv.org/abs/2210.03629");
  expect(ax.kind).toBe("arxiv_paper");
  expect(ax.externalId).toBe("2210.03629");

  const ext = deriveSource("https://zed.dev/some/page");
  expect(ext.kind).toBe("external_link");
  expect(ext.title).toBe("zed.dev");
});

test("createPendingItem inserts a visible 'pending' item with an instant logo", () => {
  const { item, existed } = createPendingItem("https://github.com/acme/supertool", "pend_u");
  expect(existed).toBe(false);
  expect(item.scoreStatus).toBe("pending");
  expect(item.published).toBe(true);
  expect(item.slug).toBe("supertool");
  expect(item.coverImageUrl).toContain("opengraph.githubassets.com/");
  expect(item.coverImageUrl).toContain("acme/supertool");
  expect(item.postedById).toBe("pend_u");
});

test("createPendingItem dedups against an existing item (pending or scored)", () => {
  const again = createPendingItem("https://github.com/acme/supertool", "pend_u");
  expect(again.existed).toBe(true);
  expect(again.item.slug).toBe("supertool");
});

test("slug collisions get a suffix instead of failing", () => {
  const other = createPendingItem("https://github.com/other-org/supertool", "pend_u");
  expect(other.existed).toBe(false);
  expect(other.item.slug).not.toBe("supertool");
  expect(other.item.slug.startsWith("supertool")).toBe(true);
});
