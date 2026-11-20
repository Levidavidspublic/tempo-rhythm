import { expect, test } from "@playwright/test";

const taskTitle = "Pay the power bill";
const updatedTitle = "Pay the power bill online";

test.describe("core task views", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/today");
    await page.evaluate(() => {
      window.localStorage.removeItem("tempo:task-views-core:v1");
    });
  });

  test("today, inbox, project, priority, and energy views share one persisted task record", async ({
    page,
  }) => {
    const main = page.getByRole("main");

    await page.goto("/today");
    await expect(main.getByRole("heading", { name: "Today" })).toBeVisible();

    await page.getByLabel("Task title").fill(taskTitle);
    await page.getByLabel("Project").fill("Home reset");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Energy").selectOption("low");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.goto("/tasks");
    await expect(main.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(taskTitle)).toBeVisible();

    await page.getByRole("button", { name: `Edit ${taskTitle}` }).click();
    await page.getByLabel("Edit task title").fill(updatedTitle);
    await page.getByRole("button", { name: "Save task" }).click();
    await expect(page.getByText(updatedTitle)).toBeVisible();

    await page.goto("/projects");
    await expect(main.getByRole("heading", { name: "Home reset" })).toBeVisible();
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await page.getByRole("button", { name: `Mark ${updatedTitle} complete` }).click();
    await expect(page.getByText("Done")).toBeVisible();

    await page.goto("/tasks/priority");
    await expect(main.getByRole("heading", { name: "Priority", exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "High priority" })).toBeVisible();
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();

    await page.goto("/tasks/energy");
    await expect(main.getByRole("heading", { name: "Energy", exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Low energy" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Medium energy" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "High energy" })).toBeVisible();
    await expect(page.getByText(updatedTitle)).toBeHidden();
    await expect(main.getByText("Nothing here right now")).toHaveCount(3);
    await expect(main.getByText("Loading tasks...")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(updatedTitle)).toBeHidden();
    await expect(main.getByText("Nothing here right now")).toHaveCount(3);
    await expect(main.getByText("Loading tasks...")).toHaveCount(0);
  });
});
