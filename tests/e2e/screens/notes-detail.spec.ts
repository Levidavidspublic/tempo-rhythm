import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("notes detail", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("bad note link is calm", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(url("/notes/not-a-note-id"));
    await expect(
      page.getByText(/This note could not be found\.|We couldn't open this note\./),
    ).toBeVisible();
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to notes" })).toHaveAttribute(
      "href",
      "/notes",
    );

    const allowedErrors = consoleErrors.filter(
      (text) => !text.includes("ArgumentValidationError"),
    );
    expect(allowedErrors).toEqual([]);
  });

  test("open a note from the list", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    const noteTitle = `Detail ${Date.now()}`;

    await page.goto(url("/notes"));
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    await page.getByRole("button", { name: "New note" }).click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    await page.getByLabel("Note title").fill(noteTitle);
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.getByRole("link", { name: "← Back to notes" }).click();
    await expect(page.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    const noteRow = page.getByRole("listitem").filter({ hasText: noteTitle });
    await noteRow.getByRole("link").click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    await expect(page.getByLabel("Note title")).toHaveValue(noteTitle);

    await page.reload();
    await expect(page.getByLabel("Note title")).toHaveValue(noteTitle);

    expect(consoleErrors).toEqual([]);
  });
});
