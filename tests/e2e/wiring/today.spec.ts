import { expect, test } from "@playwright/test";

// TEMPO-B05-03: /today is already on the dev-only core-task bypass, so the local
// webServer opens it signed out. The mounted strips render nothing until there
// is a session, so this asserts the route wrappers around them. Preview stays
// protected: skip there. Never assert on live plan or habit data.
test.describe("today wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("/today mounts habit check-in and day plan markers", async ({ page }) => {
    await page.goto("/today");
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole("main").getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByTestId("today-habit-checkin")).toBeAttached();
    await expect(page.getByTestId("today-day-plan-summary")).toBeAttached();
    await expect(page.getByTestId("today-day-plan-panel")).toBeAttached();
    await expect(page.getByTestId("today-carry-over")).toBeAttached();
  });
});
