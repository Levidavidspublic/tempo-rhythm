import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("goals screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("create, open, edit, mark a milestone and delete a goal; survives reload", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const title = `E2E goal ${Date.now()}`;
    const updated = `${title} (updated)`;

    await page.goto(url("/goals"));
    await page.getByRole("button", { name: "New goal" }).first().click();
    await page.getByLabel("Goal name").fill(title);
    await page.getByLabel("Goal name").press("Enter");
    await page.getByRole("link", { name: new RegExp(title) }).first().click();
    await expect(page).toHaveURL(/\/goals\/[^/]+$/);

    await page.getByLabel("Goal", { exact: true }).fill(updated);
    await page.getByLabel("Goal", { exact: true }).blur();
    await page.getByLabel("Target date").fill("2030-01-15");
    await page.getByRole("button", { name: "Mark milestone" }).click();
    await expect(page.getByText("25%")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Goal", { exact: true })).toHaveValue(updated);
    await expect(page.getByLabel("Target date")).toHaveValue("2030-01-15");
    await expect(page.getByText("25%")).toBeVisible();

    await page.getByRole("button", { name: "Delete goal" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await page.reload();
    await expect(page.getByText(updated)).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });
});
