import { test, expect } from "@playwright/test";

/** Item-page social: takes + I-use-this (tickets 0026/0033/0036) + leaderboard (0027). */

test("item page has a Takes tab and an I-use-this affordance", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await expect(page.getByRole("tab", { name: /takes/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /i use this/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /reposts/ }).first()).toBeVisible();
});

test("signed-in user adds a take and it leads their profile + the activity feed", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
  await page.goto("/item/zod?tab=takes");
  const unique = `parse-don't-validate is the way ${Date.now()}`;
  await page.getByRole("button", { name: /add your take/i }).click();
  await page.getByPlaceholder(/how do you use it/i).fill(unique);
  await page.getByRole("button", { name: /post take/i }).click();
  // Renders in the item's Takes section…
  await expect(page.getByText(unique)).toBeVisible();
  // …on the profile's Takes tab…
  await page.goto("/u/e2euser?tab=takes");
  await expect(page.getByText(unique)).toBeVisible();
  // …and in the activity feed, labeled as a take.
  await page.goto("/activity");
  await expect(page.getByText(/shared a take on zod/i).first()).toBeVisible();
});

test("I-use-this toggles and bumps the count", async ({ page, context, baseURL }) => {
  await context.clearCookies();
  await page.goto(`/api/auth/dev?u=user-${Date.now()}`);
  await page.goto("/item/ripgrep");
  const btn = page.getByRole("button", { name: /i use this/i });
  const before = Number((await btn.textContent())?.match(/\d+/)?.[0] ?? "0");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
  await expect(btn).toContainText(String(before + 1));
  // Off again.
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "false");
  expect(baseURL).toBeTruthy();
});

test("leaderboard is numbered rows ranked by the section metric", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText("Hall of Shame")).toBeVisible();
  await expect(page.getByText("/100").first()).toBeVisible();
  await expect(page.getByText("comments").first()).toBeVisible();
  await expect(page.getByText("noise").first()).toBeVisible();
  const shame = page.locator("section", { hasText: "Hall of Shame" });
  await expect(shame.getByRole("link").first()).toContainText(/autogpt/i);
});
