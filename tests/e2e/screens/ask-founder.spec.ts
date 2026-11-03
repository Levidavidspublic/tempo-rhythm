import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("ask-founder screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("send a message, see Sent, and find it after reload", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const text = `E2E message ${Date.now()}`;
    await page.goto(url("/ask-founder"));
    await page.getByLabel("Your message to Amit").fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Sent. Amit reads every message.")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("ask-founder-sent").getByText(text)).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("an empty message cannot be sent", async ({ page }) => {
    await page.goto(url("/ask-founder"));
    await page.getByLabel("Your message to Amit").fill("   ");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
