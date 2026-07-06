import { test, expect } from "@playwright/test";

/** Public, unauthenticated browsing over the seeded dataset. */

test("home IS the directory: seeded tools list at /", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /ripgrep/i }).first()).toBeVisible();
  await expect(page.getByText(/zod/i).first()).toBeVisible();
});

test("directory filters to complexity-traps at /", async ({ page }) => {
  await page.goto("/?verdict=complexity-trap");
  // langchain + autogpt are the seeded complexity-traps; ripgrep (essential)
  // must not be in the GRID (the pulse rail may legitimately mention it).
  const grid = page.locator("section").first();
  await expect(grid.getByText(/langchain/i).first()).toBeVisible();
  await expect(grid.getByText(/ripgrep/i)).toHaveCount(0);
});

test("old /directory URLs redirect home with filters intact", async ({ page }) => {
  await page.goto("/directory?verdict=complexity-trap");
  await expect(page).toHaveURL(/\/\?verdict=complexity-trap/);
  await expect(page.getByText(/langchain/i).first()).toBeVisible();
});

test("item detail renders verdict, sections, scorecard, audience", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await expect(page.getByText(/ripgrep/i).first()).toBeVisible();
  await expect(page.getByText(/essential/i).first()).toBeVisible();
  await expect(page.getByText(/Devil's advocate/i)).toBeVisible();
  await expect(page.getByText(/Who it's for/i)).toBeVisible();
  await expect(page.getByText("Novelty", { exact: true })).toBeVisible(); // a scorecard metric label
});

test("leaderboard has a complexity-trap hall of shame", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText(/Hall of Shame/i)).toBeVisible();
  await expect(page.getByText(/langchain/i).first()).toBeVisible();
});

test("newsletter subscribe accepts an email", async ({ page }) => {
  await page.goto("/");
  const email = page.getByPlaceholder(/@/).first();
  await email.fill("e2e-subscriber@example.com");
  await page
    .getByRole("button", { name: /subscribe/i })
    .first()
    .click();
  await expect(page.getByText(/confirm|inbox/i)).toBeVisible();
});

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
