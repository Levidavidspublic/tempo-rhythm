import { expect, test } from "@playwright/test";

// TEMPO-B05-01: under the local Playwright webServer (dev, both E2E bypass flags), wiring routes open
// signed out so each wiring spec can see its component. Preview runs stay protected: skip there.
test.describe("wiring E2E harness", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("signed-out /plan is not sent to /sign-in under the dev E2E bypass", async ({ page }) => {
    await page.goto("/plan");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("a route outside the wiring list still redirects", async ({ page }) => {
    await page.goto("/goals");
    await expect(page).toHaveURL(/\/sign-in\?/);
  });
});
