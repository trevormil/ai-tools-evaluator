import { test, expect } from "@playwright/test";

/** Per-item one-pagers (ticket 0081): a spec sheet generated from the stored evaluation. */

test("an item's one-pager renders its evaluation as a spec sheet", async ({ page }) => {
  await page.goto("/item/ripgrep/onepager");

  // Hero: identity + verdict + overall readout.
  await expect(page.getByRole("heading", { name: /ripgrep/i })).toBeVisible();
  await expect(page.getByText("essential").first()).toBeVisible();
  await expect(page.getByText("/100 overall")).toBeVisible();

  // The full ten-metric scorecard with real scores.
  await expect(page.getByText("Novelty", { exact: true })).toBeVisible();
  await expect(page.getByText("Leanness", { exact: true })).toBeVisible();

  // Decision layer + the devil's advocate.
  await expect(page.getByText("Adopt if")).toBeVisible();
  await expect(page.getByText("Skip if")).toBeVisible();
  await expect(page.getByText("Devil's advocate")).toBeVisible();

  // Route back to the full evaluation.
  await expect(page.getByRole("link", { name: /full evaluation/i })).toBeVisible();
});

test("the deep dive renders: how-it-works prose, a real architecture diagram, internals (0083)", async ({
  page,
}) => {
  await page.goto("/item/ripgrep/onepager");

  await expect(page.getByText("How it works")).toBeVisible();
  await expect(page.getByText(/work-stealing queue/)).toBeVisible();

  // The diagram is generated from the evaluation's validated component graph.
  await expect(page.getByText("Architecture", { exact: true })).toBeVisible();
  const diagram = page.getByTestId("arch-diagram");
  await expect(diagram).toBeVisible();
  await expect(diagram.getByText("Ignore engine")).toBeVisible();
  await expect(diagram.getByText("Regex core")).toBeVisible();

  await expect(page.getByText("Under the hood")).toBeVisible();
  await expect(page.getByText("No-backtracking guarantee")).toBeVisible();
});

test("no deep dive means NO one-pager: no tab, no link, route 404s (0084)", async ({ page }) => {
  // zod is seeded without a deepDive — it has no generated one-pager yet, so
  // the surface is absent entirely (a rescore backfills it later).
  await page.goto("/item/zod");
  await expect(page.getByRole("tab", { name: "Scorecard" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "One-pager" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /one-pager/i })).toHaveCount(0);
  const res = await page.goto("/item/zod/onepager");
  expect(res?.status()).toBe(404);
});

test("the one-pager is a tab on the item page, deep-linkable via ?tab=onepager (0084)", async ({
  page,
}) => {
  await page.goto("/item/ripgrep");
  await page.getByRole("tab", { name: "One-pager" }).click();
  await expect(page).toHaveURL(/tab=onepager/);
  await expect(page.getByText("/100 overall")).toBeVisible();
  await expect(page.getByText("How it works")).toBeVisible();
  await expect(page.getByTestId("arch-diagram")).toBeVisible();
  // Deep link straight into the tab.
  await page.goto("/item/ripgrep?tab=onepager");
  await expect(page.getByText("Adopt if")).toBeVisible();
});

test("the item page readout still links to the standalone one-pager", async ({ page }) => {
  await page.goto("/item/ripgrep");
  await page.getByRole("link", { name: /one-pager/i }).click();
  await expect(page).toHaveURL(/\/item\/ripgrep\/onepager/);
  await expect(page.getByText("/100 overall")).toBeVisible();
});

test("a pending (unscored) item has no one-pager", async ({ page, context, baseURL }) => {
  // Seeded pending items don't exist by slug we control; create one via submit flow instead.
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
  const name = `onepager-pending-${Date.now()}`;
  await page.goto("/submit");
  await page.getByPlaceholder(/github.com/).fill(`https://github.com/e2e-org/${name}`);
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page).toHaveURL(new RegExp(`/item/${name}`));
  const res = await page.goto(`/item/${name}/onepager`);
  expect(res?.status()).toBe(404);
});
