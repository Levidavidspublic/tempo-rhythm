import { expect, test } from "@playwright/test";

// Signed-in part: needs TEMPO_E2E_STORAGE_STATE (+ PLAYWRIGHT_BASE_URL); skips otherwise.
// Local CI part: the webServer runs with the e2e calendar bypass (local event source).

test.describe("calendar add event", () => {
  test("signed in: adds an event, it survives reload, no false sign-in message", async ({
    page,
  }) => {
    test.skip(
      !process.env.TEMPO_E2E_STORAGE_STATE || !process.env.PLAYWRIGHT_BASE_URL,
      "needs TEMPO_E2E_STORAGE_STATE and PLAYWRIGHT_BASE_URL"
    );
    const title = `pw event ${Date.now()}`;
    await page.goto("/calendar");
    const addButton = page.getByRole("button", { name: "Add event" });
    await expect(addButton).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("textbox", { name: "Event title" }).fill(title);
    await addButton.click();
    await expect(page.getByTestId("day-events")).toContainText(title);
    await page.reload();
    await expect(page.getByTestId("day-events")).toContainText(title);
    await expect(page.getByText("Sign in again")).toHaveCount(0);
  });

  test("local mode: form renders and adds without a sign-in message", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add event|One moment/ })).toBeVisible();
    await page.getByRole("textbox", { name: "Event title" }).fill("pw local event");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.getByTestId("day-events")).toContainText("pw local event");
    await expect(page.getByText("Sign in again")).toHaveCount(0);
  });
});
