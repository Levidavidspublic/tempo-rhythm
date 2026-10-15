import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("command screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");
  test.use({ storageState: storageStatePath });

  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(url("/command"));
    await expect(page.getByRole("heading", { name: "Command" })).toBeVisible();
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("filters by title and opens the first match with Enter", async ({ page }) => {
    const filter = page.getByRole("combobox", { name: "Filter screens" });
    await filter.fill("not");

    const options = page.getByRole("option");
    await expect(options.first()).toContainText("Notes");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    await filter.press("Enter");
    await expect(page).toHaveURL(url("/notes"));
  });

  test("moves the selection with arrow keys and opens it", async ({ page }) => {
    const filter = page.getByRole("combobox", { name: "Filter screens" });
    await filter.fill("t");

    const options = page.getByRole("option");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await filter.press("ArrowDown");
    await expect(options.nth(1)).toContainText("Tasks");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");

    await filter.press("Enter");
    await expect(page).toHaveURL(url("/tasks"));
  });

  test("opens a matching screen when clicked", async ({ page }) => {
    await page.getByRole("combobox", { name: "Filter screens" }).fill("calendar");
    await page.getByRole("option", { name: /Calendar/ }).click();
    await expect(page).toHaveURL(url("/calendar"));
  });
});
