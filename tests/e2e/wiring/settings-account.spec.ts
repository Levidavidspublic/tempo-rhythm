import { expect, test } from "@playwright/test";

// TEMPO-B05-06: each account route mounts its component (not ScaffoldScreen). Signed out under the
// dev E2E bypass, so we assert on the route wrapper marker only, never on live data.
test.describe("settings + account wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  const routes = [
    ["/settings/profile", "settings-profile"],
    ["/settings/preferences", "settings-preferences"],
    ["/notifications", "notifications-page"],
    ["/billing", "billing-page"],
  ] as const;

  for (const [route, testId] of routes) {
    test(`${route} mounts its component`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByTestId(testId)).toBeVisible();
    });
  }
});
