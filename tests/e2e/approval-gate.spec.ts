import { expect, test } from "@playwright/test";

// Preview-only (TEMPO-GATE-02): needs a signed-in, APPROVED test user's storage state.
const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL;

function url(path: string): string {
  return new URL(path, baseURL ?? "http://localhost:3000").toString();
}

test.describe("approval gate (approved user)", () => {
  test.skip(!storageStatePath || !baseURL, "needs PLAYWRIGHT_BASE_URL and TEMPO_E2E_STORAGE_STATE");
  test.use({ storageState: storageStatePath });

  test("an approved user reaches the app, not the waiting screen", async ({ page }) => {
    await page.goto(url("/today"));
    await expect(page).toHaveURL(/\/today/);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("approval-waiting")).toHaveCount(0);
  });

  test("/admin/approvals shows the admin list or 'Admins only'", async ({ page }) => {
    await page.goto(url("/admin/approvals"));
    await expect(
      page.getByTestId("admin-approvals").or(page.getByRole("heading", { name: "Admins only" })),
    ).toBeVisible();
  });
});
