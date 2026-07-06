import { test, expect } from "@playwright/test";

/** Profile polish (ticket 0029): deep-linkable tabs + Activity tab. */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
});

test("?tab=activity deep-links straight to the Activity tab", async ({ page }) => {
  // authed.spec already added a stack entry as e2euser → an activity exists.
  await page.goto("/u/e2euser?tab=activity");
  await expect(page.getByText(/added .* to their stack/i).first()).toBeVisible();
});

test("switching tabs updates the URL for sharing", async ({ page }) => {
  await page.goto("/u/e2euser");
  await page.getByRole("button", { name: "Articles" }).click();
  await expect(page).toHaveURL(/tab=articles/);
});

test("a visitor sees the DM affordance on stack entries", async ({ page, context, baseURL }) => {
  // Sign in as a different user and visit e2euser's stack.
  await context.clearCookies();
  await page.goto(`/api/auth/dev?u=visitor-${Date.now()}`);
  await page.goto("/u/e2euser?tab=stack");
  await expect(page.getByText("ask about this →").first()).toBeVisible();
  expect(baseURL).toBeTruthy();
});
