import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("notes save race", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("title typed then body typed within 500ms both persist", async ({ page }) => {
    const runId = Date.now();
    const noteTitle = `Save race ${runId}`;
    const noteBody = `body ${runId}`;

    await page.goto(url("/notes"));
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    await page.getByLabel("New note title").fill("E2E test page");

    await page.getByRole("button", { name: "New note" }).click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);

    await page.getByLabel("Note title").fill(noteTitle);
    await page.getByLabel("Note body").fill(noteBody);
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue(noteTitle);
    await expect(page.getByLabel("Note body")).toHaveText(noteBody);

    await page.getByRole("link", { name: "← Back to notes" }).click();
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();
    const noteRow = page.getByRole("listitem").filter({ hasText: noteTitle });
    await expect(noteRow).toBeVisible();

    await noteRow.getByRole("button", { name: `Delete ${noteTitle}` }).click();
    await noteRow.getByRole("button", { name: `Confirm delete ${noteTitle}` }).click();
    await expect(page.getByText(noteTitle)).toHaveCount(0);
  });
});
