import { test, expect } from "@playwright/test";

/**
 * The App Store requires a reachable privacy policy URL, and it must match what
 * the iOS app actually does: anonymous GETs, on-device favorites, a local-only
 * notification, no tracking, no in-app account.
 */

test("privacy page is reachable from the footer of any page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: /privacy/i })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  // The page leads with the claim, not the word "Privacy" — that's the eyebrow.
  await expect(page.getByRole("heading", { name: /we do not collect your data/i })).toBeVisible();
  await expect(page).toHaveTitle(/privacy/i);
});

test("privacy page states the disclosures Apple's review checks for", async ({ page }) => {
  await page.goto("/privacy");

  // The core claim, matching PrivacyInfo.xcprivacy's "no data collected".
  await expect(page.getByText(/we do not collect/i).first()).toBeVisible();

  // Each surface the iOS app touches is accounted for by name.
  await expect(page.getByText(/favorites/i).first()).toBeVisible();
  await expect(page.getByText(/on your device/i).first()).toBeVisible();
  await expect(page.getByText(/notification/i).first()).toBeVisible();
  await expect(page.getByText(/tracking/i).first()).toBeVisible();

  // A contact route is mandatory for the listing.
  await expect(page.getByRole("link", { name: /@/ }).first()).toBeVisible();

  // Dated, so "last updated" is verifiable rather than vague.
  await expect(page.getByText(/last updated/i)).toBeVisible();
});

test("privacy page is server-rendered for crawlers and App Review", async ({ request }) => {
  const res = await request.get("/privacy");
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toMatch(/do not collect/i);
});
