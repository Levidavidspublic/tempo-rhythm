import { expect, test } from "@playwright/test";

// TEMPO-B05-02: the local Playwright webServer (TEMPO-B05-01) opens /plan signed out.
// Assert only what DayTimeline renders here. Never assert on live blocks.
// Preview runs stay protected: skip there.
test.describe("plan wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("/plan shows the day timeline and not the scaffold placeholder", async ({ page }) => {
    await page.goto("/plan");

    const plan = page.getByTestId("plan-day");
    await expect(plan).toBeVisible();
    await expect(plan.getByRole("region", { name: "Day timeline" })).toBeVisible();
    await expect(plan.getByRole("heading", { name: "Day timeline" })).toBeVisible();
    await expect(plan.getByText("Sign in to see this day's blocks and events.")).toBeVisible();

    // The shell topbar still titles this route "Planning". ScaffoldScreen is the
    // placeholder copy below, which this route must not render.
    const main = page.locator("main");
    await expect(main.getByText("Week / month planning grid.")).toHaveCount(0);
    await expect(main.getByText("Beta preview")).toHaveCount(0);
    await expect(main.getByText("Primary action")).toHaveCount(0);
    await expect(main.getByText("Continue in beta")).toHaveCount(0);
  });
});
