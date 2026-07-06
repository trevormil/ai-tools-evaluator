import { test, expect } from "@playwright/test";

/** Public, unauthenticated browsing over the seeded dataset. */

test("directory lists seeded tools", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("link", { name: /ripgrep/i }).first()).toBeVisible();
  await expect(page.getByText(/zod/i).first()).toBeVisible();
});

test("directory filters to complexity-traps", async ({ page }) => {
  await page.goto("/directory?verdict=complexity-trap");
  // langchain + autogpt are the seeded complexity-traps; ripgrep (essential) must not show
  await expect(page.getByText(/langchain/i).first()).toBeVisible();
  await expect(page.getByText(/ripgrep/i)).toHaveCount(0);
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
  await page.getByRole("button", { name: /subscribe/i }).first().click();
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
