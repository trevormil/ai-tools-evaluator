import { test, expect } from "@playwright/test";

/** Item-page social surface + ranked density (tickets 0026/0027). */

test("item page lists posts about the item", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await expect(page.getByText("Posts about this")).toBeVisible();
  // The seed attaches a post to ripgrep.
  await expect(page.getByText(/underrated take/i).first()).toBeVisible();
});

test("item page offers an item repost affordance", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await expect(page.getByRole("button", { name: /reposts/ }).first()).toBeVisible();
});

test("signed-in user posts about the item from its page", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
  await page.goto("/item/zod");
  const unique = `zod take ${Date.now()}`;
  await expect(page.getByText(/posting about/i)).toBeVisible();
  await page.getByPlaceholder(/what's happening/i).fill(unique);
  await page.getByRole("button", { name: /^post$/i }).click();
  await expect(page.getByText(unique)).toBeVisible();
});

test("leaderboard is numbered rows ranked by the section metric", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText("Hall of Shame")).toBeVisible();
  // Ranked rows, not directory cards: rank numbers + per-section metric labels.
  await expect(page.getByText("/100").first()).toBeVisible();
  await expect(page.getByText("comments").first()).toBeVisible();
  await expect(page.getByText("noise").first()).toBeVisible();
  // AutoGPT (noise 82) outranks LangChain (74) in the hall of shame.
  const shame = page.locator("section", { hasText: "Hall of Shame" });
  const rows = shame.getByRole("link");
  await expect(rows.first()).toContainText(/autogpt/i);
});
