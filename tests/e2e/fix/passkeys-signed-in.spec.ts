import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("passkeys settings", () => {
  test.describe("signed in", () => {
    test.skip(
      !storageStatePath || !process.env.PLAYWRIGHT_BASE_URL,
      "needs TEMPO_E2E_STORAGE_STATE on PLAYWRIGHT_BASE_URL",
    );
    test.use({ storageState: storageStatePath });

    test("opens instead of the sign-in wall", async ({ page }) => {
      await page.goto(new URL("/settings/passkeys", baseURL).toString());
      await expect(page.getByRole("heading", { name: /^Passkeys/ })).toBeVisible();
      await page.waitForTimeout(6000);
      await expect(page.getByRole("button", { name: "Send magic link" })).toHaveCount(0);
    });
  });

  test("signed out goes to /sign-in", async ({ page }) => {
    test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "local CI webServer only");
    await page.goto(new URL("/settings/passkeys", baseURL).toString());
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
