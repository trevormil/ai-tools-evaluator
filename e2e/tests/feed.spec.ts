import { test, expect } from "@playwright/test";

/** The unified feed (tickets 0024/0025/0032) — lives at / since the
 *  Takes-centric refactor (#19) retired the /activity route. Authed session. */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "aix_session", value: "e2e-token", url: baseURL! }]);
});

test("the feed shows fresh evaluations as first-class cards with actions", async ({
  page,
}) => {
  await page.goto("/");
  const itemCard = page
    .locator("div.card", { has: page.getByText("Fresh evaluation").first() })
    .first();
  await expect(itemCard).toBeVisible();
  // The card carries the action row: comments, reply, reposts.
  await expect(itemCard.getByText(/comments/)).toBeVisible();
  await expect(itemCard.getByRole("button", { name: "Reply" })).toBeVisible();
  await expect(itemCard.getByText(/reposts/)).toBeVisible();
});

test("feed tabs switch between Everything and Following (no silent fallback)", async ({
  page,
  context,
  baseURL,
}) => {
  // A brand-new user (dev login) — follows nobody, has posted nothing.
  await context.clearCookies();
  await page.goto(`/api/auth/dev?u=lonely-${Date.now()}`);
  await page.goto("/?feed=following");
  // Empty circle → explicit empty state, NOT the global stream.
  await expect(page.getByText(/nobody you follow/i)).toBeVisible();
  await page.getByRole("link", { name: "Everything" }).click();
  await expect(page.getByText("Fresh evaluation").first()).toBeVisible();
  expect(baseURL).toBeTruthy();
});

test("reply to a legacy post inline from the timeline", async ({ page }) => {
  await page.goto("/");
  // Specifically a POST card (has a Reply button) — take activities also carry @aixdemo.
  const postCard = page
    .locator("div.card", { hasText: "@aixdemo" })
    .filter({ has: page.getByRole("button", { name: "Reply" }) })
    .first();
  await postCard.getByRole("button", { name: "Reply" }).click();
  const unique = `inline reply ${Date.now()}`;
  await postCard.getByPlaceholder(/write a reply/i).fill(unique);
  await postCard.getByRole("button", { name: "Reply" }).last().click();
  await expect(postCard.getByText("replied ✓")).toBeVisible();
  // The reply landed in the real thread.
  await postCard.getByText(/\d+ comments/).click();
  await expect(page.getByText(unique)).toBeVisible();
});

test("discussions surface in the feed with their content (ticket 0038)", async ({ page }) => {
  // Comment on a tool from its Discussion tab…
  await page.goto("/item/dspy?tab=discussion");
  const unique = `metric-driven prompting is underrated ${Date.now()}`;
  await page.getByPlaceholder(/add a comment/i).fill(unique);
  await page.getByRole("button", { name: /^comment$/i }).click();
  await expect(page.getByText(unique)).toBeVisible();
  // …and the feed carries the discussion content, not a dead label.
  await page.goto("/");
  await expect(page.getByText(/joined the discussion on DSPy/i).first()).toBeVisible();
  await expect(page.getByText(unique).first()).toBeVisible();
});

// DELETED: "random mode is a scrollable shuffle deck (ticket 0038)" — the
// /random route was removed with the Takes-centric refactor (#19); the
// shuffle-deck product decision was reversed, so the test goes with it.

test("quote-repost from the timeline and see the quote in the feed", async ({ page }) => {
  await page.goto("/");
  const postCard = page
    .locator("div.card", { hasText: "@aixdemo" })
    .filter({ has: page.getByRole("button", { name: "Reply" }) })
    .first();
  await postCard.getByRole("button", { name: /reposts/ }).click();
  await postCard.getByRole("button", { name: /quote/i }).click();
  const unique = `hot take ${Date.now()}`;
  await postCard.getByPlaceholder(/add your take/i).fill(unique);
  await postCard.getByRole("button", { name: "Quote", exact: true }).click();
  await expect(postCard.getByText(/1 reposted/)).toBeVisible();
  // The quote is content in the timeline (rich activity entry).
  await page.goto("/");
  await expect(page.getByText(unique)).toBeVisible();
});
