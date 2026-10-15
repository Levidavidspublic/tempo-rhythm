import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("notes pin", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("Pin becomes Unpin, sorts first and survives reload", async ({ page }) => {
    const title = `pw note ${Date.now()}`;

    await page.goto(url("/notes"));
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    await page.getByRole("button", { name: "New note" }).click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    await page.getByLabel("Note title").fill(title);
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.getByRole("link", { name: "← Back to notes" }).click();

    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: `Pin ${title}` }).click();
    await expect(row.getByRole("button", { name: `Unpin ${title}` })).toBeVisible();
    await expect(row.getByText("Pinned", { exact: true })).toBeVisible();
    await expect(page.getByRole("listitem").first()).toContainText(title);

    await page.reload();
    await expect(row.getByRole("button", { name: `Unpin ${title}` })).toBeVisible();
    await expect(page.getByRole("listitem").first()).toContainText(title);

    await row.getByRole("button", { name: `Unpin ${title}` }).click();
    await expect(row.getByRole("button", { name: `Pin ${title}` })).toBeVisible();
    await row.getByRole("button", { name: `Delete ${title}` }).click();
    await row.getByRole("button", { name: `Confirm delete ${title}` }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
