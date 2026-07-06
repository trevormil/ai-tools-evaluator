import { test, expect } from "@playwright/test";

/** Submission transparency (ticket 0028): outcomes carry visible reasons. */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
});

test("submitting an already-catalogued URL is flagged with the reason", async ({ page }) => {
  await page.goto("/submit");
  // ripgrep is seeded — its source URL is already in the directory.
  await page.getByPlaceholder(/github.com/).fill("https://github.com/BurntSushi/ripgrep");
  await page.getByRole("button", { name: /submit/i }).click();
  // Inline feedback names the existing evaluation…
  await expect(page.getByText(/already catalogued/i).first()).toBeVisible();
  // …and the outcome persists as a visible row with status + reason.
  await expect(page.getByText("duplicate").first()).toBeVisible();
});

test("a fresh URL queues normally", async ({ page }) => {
  await page.goto("/submit");
  const url = `https://github.com/e2e/fresh-${Date.now()}`;
  await page.getByPlaceholder(/github.com/).fill(url);
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/queued!/i)).toBeVisible();
  await expect(page.getByText(url)).toBeVisible();
});
