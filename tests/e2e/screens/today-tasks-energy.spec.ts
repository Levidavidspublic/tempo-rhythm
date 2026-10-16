import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("today tasks and energy", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");
  test.use({ storageState: storageStatePath });

  test("all of today's tasks are listed", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const titles = Array.from({ length: 4 }, (_, index) => `Today task ${Date.now()}-${index + 1}`);

    await page.goto(url("/today"));
    const quickAdd = page.getByLabel("Add something small for today");
    const taskList = page.getByRole("region", { name: "Today" });

    for (const title of titles) {
      await quickAdd.fill(title);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(taskList.getByText(title, { exact: true })).toBeVisible();
    }

    for (const title of titles) {
      await expect(taskList.getByText(title, { exact: true })).toBeVisible();
    }

    await taskList.getByRole("button", { name: `Mark ${titles[0]} complete` }).click();
    await expect(taskList.getByText("Done today (1)")).toBeVisible();
    await page.reload();

    for (const title of titles.slice(1)) {
      await expect(taskList.getByText(title, { exact: true })).toBeVisible();
    }
    await expect(taskList.getByText("Done today (1)")).toBeVisible();
    await page.screenshot({ path: "test-results/T-PLAN-07/after-tasks.png", fullPage: true });

    expect(consoleErrors).toEqual([]);
  });

  test("energy pick is kept for the day", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(url("/today"));
    const recommendations = page.getByRole("region", { name: "Match your energy" });
    const lowEnergy = recommendations.getByRole("button", { name: "Low", exact: true });

    await lowEnergy.click();
    await expect(lowEnergy).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(lowEnergy).toHaveAttribute("aria-pressed", "true");
    await expect(
      recommendations.getByText(/fit for low energy|fits that energy|today's plan/i).first(),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/T-PLAN-07/after-energy.png", fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: "test-results/T-PLAN-07/after-energy-mobile.png", fullPage: true });

    expect(consoleErrors).toEqual([]);
  });
});
