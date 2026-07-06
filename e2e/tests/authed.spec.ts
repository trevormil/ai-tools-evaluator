import { test, expect } from "@playwright/test";

/** Authenticated flows using the seeded e2e session cookie. */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: "aix_session", value: "e2e-token", url: baseURL! },
  ]);
});

test("add a tool to My Stack and see it on the profile", async ({ page }) => {
  await page.goto("/u/e2euser");
  // Open the My Stack tab (profiles are tabbed).
  await page.getByRole("button", { name: /my stack/i }).first().click().catch(() => {});
  await page.getByText(/my stack/i).first().click().catch(() => {});

  const unique = `Neovim-${Date.now()}`;
  await page.getByPlaceholder(/tool name/i).fill(unique);
  await page.getByRole("button", { name: /add to stack/i }).click();

  await expect(page.getByText(unique)).toBeVisible();
});

test("compose a post and see it in the feed", async ({ page }) => {
  await page.goto("/");
  const unique = `e2e post ${Date.now()}`;
  const box = page.getByRole("textbox").first();
  await box.fill(unique);
  await page.getByRole("button", { name: /post/i }).first().click();
  await expect(page.getByText(unique)).toBeVisible();
});

test("notifications page is reachable when signed in", async ({ page }) => {
  const res = await page.goto("/notifications");
  expect(res?.status()).toBeLessThan(400);
});
