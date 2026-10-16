import { expect, test } from "@playwright/test";

// Kitchen study run: the local Playwright webServer opens the study area and Settings > Reminders
// signed out under the dev-only E2E bypass (apps/web/lib/e2eWiringRoutes.ts). Assert only what each
// screen renders without a session. Preview runs stay protected: skip there.
test.describe("study wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  const signedOut: [string, string][] = [
    ["/study", "Study"],
    ["/study/review", "Review"],
    ["/study/new?from=x&kind=flashcards", "New flashcards"],
    ["/study/listen?from=x", "Listen"],
  ];
  for (const [route, heading] of signedOut) {
    test(`${route} renders its screen and asks to sign in for data`, async ({ page }) => {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/sign-in/);
      const main = page.locator("main");
      await expect(main.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(main.locator('[data-component="StateSignedOut"]')).toBeVisible();
      await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    });
  }

  test("/study/plan shows the plan form and its preview", async ({ page }) => {
    await page.goto("/study/plan");
    await expect(page).not.toHaveURL(/\/sign-in/);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1, name: "Plan back from a deadline" })).toBeVisible();
    await expect(main.locator('[data-component="Form"]')).toBeVisible();
    await expect(main.locator('[data-component="PlanPreview"]')).toBeAttached();
  });

  test("/study/record starts with consent and no microphone", async ({ page }) => {
    await page.goto("/study/record");
    await expect(page).not.toHaveURL(/\/sign-in/);
    const record = page.locator('[data-component="RecordSession"]');
    await expect(record).toBeVisible();
    await expect(record.getByRole("heading", { name: "Before you start" })).toBeVisible();
  });

  test("/settings/reminders renders the reminders screen", async ({ page }) => {
    await page.goto("/settings/reminders");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.locator("main").getByRole("heading", { level: 1, name: "Reminders" })).toBeVisible();
  });
});
