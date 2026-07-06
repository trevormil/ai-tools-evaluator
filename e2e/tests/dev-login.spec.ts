import { test, expect } from "@playwright/test";

/**
 * Dev-only mock sign-in (/api/auth/dev), gated behind AIX_DEV_LOGIN=1 which the
 * e2e server sets. Fresh browser context — no seeded session cookie.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("mock sign-in creates a user and a working session", async ({ page }) => {
  await page.goto("/api/auth/dev?u=smoketest");
  // Redirected home, signed in: the nav shows the avatar-less @username chip.
  await expect(page.getByRole("link", { name: "@smoketest" })).toBeVisible();
  // The session is real: an authed page renders.
  const res = await page.goto("/notifications");
  expect(res?.status()).toBeLessThan(400);
});

test("rejects a malformed username", async ({ page }) => {
  const res = await page.goto("/api/auth/dev?u=Bad%20Name!");
  expect(res?.status()).toBe(400);
});
