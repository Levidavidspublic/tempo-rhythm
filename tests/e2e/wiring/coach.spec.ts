import { expect, test } from "@playwright/test";

// TEMPO-B05-04: local Playwright webServer opens /coach signed out (placeholder Convex URL).
// Assert route markers and the chat selectors. Never assert on live coach data.
test.describe("coach wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("/coach renders dial/panic and proposal markers next to Coach chat", async ({ page }) => {
    await page.goto("/coach");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole("main").getByRole("heading", { name: "Coach" })).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();

    const controls = page.getByTestId("coach-controls");
    const proposal = page.getByTestId("coach-proposal");
    await expect(controls).toBeAttached();
    await expect(controls).toHaveAttribute("data-coach-marker", "dial-panic");
    await expect(proposal).toBeAttached();
    await expect(proposal).toHaveAttribute("data-coach-marker", "proposal");

    await page.screenshot({ path: "test-results/coach-wiring.png", fullPage: true });
  });
});
