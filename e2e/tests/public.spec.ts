import { test, expect } from "@playwright/test";

/** Public, unauthenticated browsing over the seeded dataset. */

test("home feed surfaces the seeded tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /ripgrep/i }).first()).toBeVisible();
  await expect(page.getByText(/zod/i).first()).toBeVisible();
});

test("directory filters to complexity-traps at /directory", async ({ page }) => {
  await page.goto("/directory?verdict=complexity-trap");
  await expect(page.getByText(/langchain/i).first()).toBeVisible();
  await expect(page.getByText(/ripgrep/i)).toHaveCount(0);
});

test("home leads with today's pick, then the feed", async ({ page }) => {
  // The recap-hero home was replaced by the Takes-centric feed (#19, #59-61):
  // pick of the day up top, community feed below.
  await page.goto("/");
  await expect(page.getByText("Today's pick")).toBeVisible();
  await expect(page.getByText("The feed")).toBeVisible();
});

test("recap page + dated permalink + archive render", async ({ page }) => {
  await page.goto("/recap");
  await expect(page.getByText("The nightly recap")).toBeVisible();
  await expect(page.getByText("The one that matters")).toBeVisible();
  await expect(page.getByText("Every verdict tonight")).toBeVisible();
  // The archive of dated permalinks (what the email links into).
  await page.getByRole("link", { name: /All recaps/i }).click();
  await expect(page).toHaveURL(/\/recap\/archive/);
  await expect(page.getByText("Every night, on the record.")).toBeVisible();
  // A dated permalink renders on its own.
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/recap/${today}`);
  await expect(page.getByText("Every verdict tonight")).toBeVisible();
});

test("nav is the two-surface split: Feed, Directory, Submit", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("header").first();
  await expect(nav.getByRole("link", { name: "Feed" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Directory" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Submit" })).toBeVisible();
  // Surfaces from retired eras stay retired.
  await expect(nav.getByRole("link", { name: "Recap" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Activity" })).toHaveCount(0);
});

// DELETED: "old /directory URLs redirect home with filters intact" — that
// redirect encoded the home-is-the-directory era, which #19 reversed:
// /directory is the canonical catalog again (covered by the filter test above).

test("item detail renders verdict, sections, scorecard, audience across tabs", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await expect(page.getByText(/ripgrep/i).first()).toBeVisible();
  await expect(page.getByText(/essential/i).first()).toBeVisible();
  // Evaluation tab (default): write-up + audience.
  await expect(page.getByText(/Devil's advocate/i)).toBeVisible();
  await expect(page.getByText(/Who it's for/i)).toBeVisible();
  // Scorecard lives in its own tab now.
  await page.getByRole("tab", { name: "Scorecard" }).click();
  await expect(page.getByText("Novelty", { exact: true })).toBeVisible();
  // Deep link works too.
  await page.goto("/item/ripgrep?tab=scorecard");
  await expect(page.getByText("Novelty", { exact: true })).toBeVisible();
});

test("item page shows the decision layer: install, adopt-if/skip-if, health, schematic", async ({
  page,
}) => {
  await page.goto("/item/ripgrep");
  // Make the call: the exact install one-liner + situational bullets.
  await expect(page.getByText("Make the call")).toBeVisible();
  await expect(page.locator("code", { hasText: "brew install ripgrep" })).toBeVisible();
  await expect(page.getByText("Adopt if")).toBeVisible();
  await expect(page.getByText("Skip if")).toBeVisible();
  await expect(page.getByText(/instead of/i).first()).toBeVisible();
  await expect(page.getByText(/grep \/ ack \/ ag/)).toBeVisible();
  // Health facts from source signals.
  await expect(page.getByText("Rust", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("MIT", { exact: true }).first()).toBeVisible();
  // The integration schematic names where it sits.
  await expect(page.getByText("Where it sits")).toBeVisible();
});

test("item page shows the repo's own README in its tab, expandable", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await page.getByRole("tab", { name: "README" }).click();
  await expect(page.getByText("In their own words")).toBeVisible();
  await expect(page.getByText(/Why should I use ripgrep/i)).toBeVisible();
  await page.getByRole("button", { name: /read the full readme/i }).click();
  await expect(page.getByRole("button", { name: /collapse readme/i })).toBeVisible();
});

test("leaderboard has a complexity-trap hall of shame", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText(/Hall of Shame/i)).toBeVisible();
  await expect(page.getByText(/langchain/i).first()).toBeVisible();
});

// DELETED: "newsletter subscribe accepts an email" — the newsletter UI was
// removed in the Takes-centric refactor (#19); only the DB table remains.

test("public API v1 + atom feed respond", async ({ request }) => {
  const api = await request.get("/api/v1/items?limit=5");
  expect(api.ok()).toBeTruthy();
  const body = await api.json();
  expect(Array.isArray(body.items)).toBeTruthy();
  expect(body.items.length).toBeGreaterThan(0);

  const feed = await request.get("/feed.xml");
  expect(feed.ok()).toBeTruthy();
  expect(feed.headers()["content-type"]).toMatch(/xml/);
  expect(await feed.text()).toContain("<feed");
});
