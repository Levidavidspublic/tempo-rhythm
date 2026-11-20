import { expect, test } from "@playwright/test";

// TEMPO-B05-05: each route mounts its component (not ScaffoldScreen). Signed out under the dev E2E
// bypass, so assert only on the route wrapper and the component's own markers, never on live data.
test.describe("habits, brain dump and search wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  test("/habits mounts the habits screen", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByTestId("habits-route")).toBeAttached();
    await expect(page.getByText("Beta preview")).toHaveCount(0);
  });

  test("/habits/[id] mounts HabitDetail", async ({ page }) => {
    await page.goto("/habits/abc123");
    await expect(page.getByTestId("habit-detail-route")).toBeAttached();
    await expect(page.getByText("Beta preview")).toHaveCount(0);
  });

  test("/brain-dump mounts BrainDumpScreen", async ({ page }) => {
    await page.goto("/brain-dump");
    await expect(page.getByTestId("brain-dump-route")).toBeAttached();
    await expect(page.getByText("Beta preview")).toHaveCount(0);
  });

  test("/search mounts SearchScreen", async ({ page }) => {
    await page.goto("/search");
    await expect(
      page.getByRole("searchbox", { name: "Search notes, tasks, habits and goals" }),
    ).toBeVisible();
    await expect(page.getByText("Beta preview")).toHaveCount(0);
  });
});
