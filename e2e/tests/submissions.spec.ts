import { test, expect } from "@playwright/test";

/** Instant submissions (ticket 0035) + duplicate transparency (0028). */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
});

test("a fresh URL creates a live 'Awaiting score…' item and lands you on it", async ({ page }) => {
  await page.goto("/submit");
  const name = `insta-${Date.now()}`;
  await page.getByPlaceholder(/github.com/).fill(`https://github.com/e2e-org/${name}`);
  await page.getByRole("button", { name: /submit/i }).click();

  // Redirected straight to the new tool page, socially live.
  await expect(page).toHaveURL(new RegExp(`/item/${name}`));
  await expect(page.getByText("Awaiting score…").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /i use this/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /add your take/i })).toBeVisible();
  // Instant logo: GitHub owner avatar.
  await expect(page.locator(`img[src="https://github.com/e2e-org.png"]`).first()).toBeVisible();

  // Comments work immediately.
  const comment = `first! ${Date.now()}`;
  await page.getByPlaceholder(/add a comment/i).fill(comment);
  await page.getByRole("button", { name: /^comment$/i }).click();
  await expect(page.getByText(comment)).toBeVisible();

  // And it is browsable in the directory (sort by new).
  await page.goto("/?sort=new");
  await expect(page.getByText(name).first()).toBeVisible();
});

test("submitting an already-catalogued URL is flagged with the reason", async ({ page }) => {
  await page.goto("/submit");
  await page.getByPlaceholder(/github.com/).fill("https://github.com/BurntSushi/ripgrep");
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/already catalogued/i).first()).toBeVisible();
  await expect(page.getByText("duplicate").first()).toBeVisible();
});
