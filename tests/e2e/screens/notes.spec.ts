import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("notes screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("create, open, edit, pin and delete a note; survives reload", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    const noteTitle = `Grocery list ${Date.now()}`;
    const noteBody = "Oats, bananas, coffee.";
    const updatedTitle = `${noteTitle} (updated)`;

    await page.goto(url("/notes"));
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    await page.getByRole("button", { name: "New note" }).click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);

    await page.getByLabel("Note title").fill(noteTitle);
    await page.getByLabel("Note body").fill(noteBody);
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.getByLabel("Note title").fill(updatedTitle);
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.getByRole("button", { name: "Pin" }).click();
    await expect(page.getByRole("button", { name: "Unpin" })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue(updatedTitle);
    await expect(page.getByLabel("Note body")).toHaveText(noteBody);
    await expect(page.getByRole("button", { name: "Unpin" })).toBeVisible();

    await page.getByRole("link", { name: "← Back to notes" }).click();
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();
    const noteRow = page.getByRole("listitem").filter({ hasText: updatedTitle });
    await expect(noteRow.getByText("Pinned")).toBeVisible();

    await page.reload();
    const noteRowAfterReload = page.getByRole("listitem").filter({ hasText: updatedTitle });
    await expect(noteRowAfterReload.getByText("Pinned")).toBeVisible();

    await noteRowAfterReload.getByRole("button", { name: `Delete ${updatedTitle}` }).click();
    await noteRowAfterReload.getByRole("button", { name: `Confirm delete ${updatedTitle}` }).click();
    await expect(page.getByText(updatedTitle)).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(updatedTitle)).toHaveCount(0);

    expect(consoleErrors).toEqual([]);
  });
});
