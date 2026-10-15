import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("activity screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");
  test.use({ storageState: storageStatePath });

  test("shows newly created items newest first and links to them", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const stamp = Date.now();
    const taskTitle = `Activity task ${stamp}`;
    const noteTitle = `Activity note ${stamp}`;

    await page.goto(url("/tasks"));
    await page.getByLabel("Task title").fill(taskTitle);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.goto(url("/notes"));
    await page.getByRole("button", { name: "New note" }).click();
    await page.getByLabel("Note title").fill(noteTitle);
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.goto(url("/activity"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "What did you actually do?" })).toBeVisible();
    const rows = page.getByRole("listitem");
    await expect(rows.nth(0)).toContainText(noteTitle);
    await expect(page.getByText(taskTitle)).toBeVisible();

    await rows.nth(0).getByRole("link").click();
    await expect(page).toHaveURL(/\/notes\/[^/]+$/);
    await expect(page.getByLabel("Note title")).toHaveValue(noteTitle);
    expect(consoleErrors).toEqual([]);
  });

  test("renders the feed or its empty state without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(url("/activity"));
    await expect(page.getByRole("heading", { name: "What did you actually do?" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Recent activity" }).or(page.getByText("Your activity will collect here")),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
