import { test, expect } from "@playwright/test";

/** Authenticated flows using the seeded e2e session cookie. */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
});

test("add a tool to My Stack and see it on the profile", async ({ page }) => {
  await page.goto("/u/e2euser");
  // Open the My Stack tab (profiles are tabbed).
  await page.getByRole("tab", { name: /my stack/i }).click();

  const unique = `Neovim-${Date.now()}`;
  await page.getByPlaceholder(/tool name/i).fill(unique);
  await page.getByRole("button", { name: /add to stack/i }).click();

  await expect(page.getByText(unique)).toBeVisible();
});

test("no generic post composer anywhere — takes are the primitive (ticket 0036)", async ({
  page,
}) => {
  await page.goto("/activity");
  await expect(page.getByPlaceholder(/what's happening/i)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByPlaceholder(/what's happening/i)).toHaveCount(0);
});

test("notifications page is reachable when signed in", async ({ page }) => {
  const res = await page.goto("/notifications");
  expect(res?.status()).toBeLessThan(400);
});
