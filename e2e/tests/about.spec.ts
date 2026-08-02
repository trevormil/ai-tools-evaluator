import { test, expect } from "@playwright/test";

/** The one-page explainer (ticket 0079): the bench's own spec sheet at /about. */

test("About is reachable from the home nav and renders the explainer sections", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("header").first().getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about/);

  // The sectioned infographic: problem → pipeline → scorecard/verdicts → is/is-not.
  await expect(page.getByText("The problem")).toBeVisible();
  await expect(page.getByText("How the bench works")).toBeVisible();
  await expect(page.getByText("The scorecard")).toBeVisible();
  await expect(page.getByText("What AIx is — and is not")).toBeVisible();

  // The pipeline is a real sequence of bench stations.
  await expect(page.getByText("Scan", { exact: true })).toBeVisible();
  await expect(page.getByText("Verdict, forced", { exact: true })).toBeVisible();

  // The verdict vocabulary is shown with the real stamps.
  await expect(page.getByText("complexity-trap").first()).toBeVisible();
});
