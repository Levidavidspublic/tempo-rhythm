import { expect, test, type Page } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const url = (path: string) => new URL(path, baseURL).toString();

function localDateValue(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("task editing", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");
  test.use({ storageState: storageStatePath });

  test("edit priority, energy and steps", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const title = `Edit task ${Date.now()}`;

    await page.goto(url("/tasks"));
    await page.getByLabel("Task title").fill(title);
    await page.getByLabel("Checklist steps").fill("First step");
    await page.getByRole("button", { name: "Add task" }).click();

    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: `Edit ${title}` }).click();
    await expect(row.getByRole("checkbox")).toHaveCount(0);
    await row.getByLabel("Edit priority").selectOption("high");
    await row.getByLabel("Edit energy").selectOption("low");
    await row.getByLabel("New checklist step").fill("Second step");
    await row.getByRole("button", { name: "Add step" }).click();
    await row.getByRole("button", { name: "Remove step First step" }).click();
    await row.getByRole("button", { name: "Save task" }).click();

    await page.goto(url("/tasks/priority"));
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "High priority" }).locator("..").getByText(title)
    ).toBeVisible();
    await page.goto(url("/tasks/energy"));
    await expect(page.getByRole("heading", { name: "Low energy" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await page.goto(url("/tasks/checklists"));
    await expect(page.getByRole("listitem").filter({ hasText: title }).getByText("0/1 steps")).toBeVisible();
    await page.screenshot({ path: "test-results/T-PLAN-08/after-edit.png", fullPage: true });
    expect(consoleErrors).toEqual([]);
  });

  test("due date", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const title = `Due task ${Date.now()}`;

    await page.goto(url("/tasks"));
    await page.getByLabel("Task title").fill(title);
    await page.getByLabel("Due date").fill(localDateValue(1));
    await page.getByRole("button", { name: "Add task" }).click();
    await page.goto(url("/today"));
    await expect(page.getByText(title)).toHaveCount(0);

    await page.goto(url("/tasks"));
    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: `Edit ${title}` }).click();
    await row.getByLabel("Edit due date").fill(localDateValue(0));
    await row.getByRole("button", { name: "Save task" }).click();
    await page.goto(url("/today"));
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
    await page.screenshot({ path: "test-results/T-PLAN-08/after-due-date.png", fullPage: true });
    expect(consoleErrors).toEqual([]);
  });

  test("delete", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const title = `Delete task ${Date.now()}`;

    await page.goto(url("/tasks"));
    await page.getByLabel("Task title").fill(title);
    await page.getByRole("button", { name: "Add task" }).click();
    const row = page.getByRole("listitem").filter({ hasText: title });
    await row.getByRole("button", { name: `Delete ${title}` }).click();
    await row.getByRole("button", { name: `Confirm delete ${title}` }).click();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: "test-results/T-PLAN-08/after-delete-mobile.png", fullPage: true });
    expect(consoleErrors).toEqual([]);
  });
});
