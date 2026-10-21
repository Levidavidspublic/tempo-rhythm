import { expect, test } from "@playwright/test";

// TEMPO-B05-07: /settings/nags and /settings/memory mount their components and are linked in Settings nav.
test.describe("settings nags + memory wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("/settings/nags renders the nags screen and nav links exist", async ({ page }) => {
    await page.goto("/settings/nags");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByTestId("settings-nags")).toBeAttached();
    await expect(page.locator('a[href="/settings/nags"]').first()).toBeAttached();
    await expect(page.locator('a[href="/settings/memory"]').first()).toBeAttached();
  });

  test("/settings/memory renders the memory screen", async ({ page }) => {
    await page.goto("/settings/memory");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByTestId("settings-memory")).toBeAttached();
  });
});
