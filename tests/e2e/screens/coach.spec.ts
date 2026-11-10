import { expect, test } from "@playwright/test";

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

test.describe("coach screen", () => {
  test.skip(!storageStatePath, "needs TEMPO_E2E_STORAGE_STATE");

  test.use({ storageState: storageStatePath });

  test("send a message and see a reply; thread survives reload", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    const prompt = `Help me pick one thing for this afternoon ${Date.now()}`;

    await page.goto(url("/coach"));
    await expect(page.getByRole("main").getByRole("heading", { name: "Coach" })).toBeVisible();

    const messageInput = page.getByLabel("Message");
    const assistantBubbles = page.locator('[data-role="assistant"]');

    // Wait for the conversation to finish loading before reading the bubble
    // count — otherwise auth/conversationId/messages may still be unresolved,
    // giving a false "0" that races the real count once loading finishes.
    await expect(messageInput).toBeEnabled();
    await expect(page.getByText("Loading your conversation.")).toHaveCount(0);

    const bubblesBefore = await assistantBubbles.count();

    // The reply can resolve in well under a second, so a post-click
    // `toBeDisabled()` check races isSending flipping back to false. Record
    // the disabled transition with an observer attached before the click
    // instead of polling for it afterwards.
    await page.evaluate(() => {
      (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending = false;
      const input = document.querySelector('textarea[aria-label="Message"]');
      if (input) {
        new MutationObserver(() => {
          if ((input as HTMLTextAreaElement).disabled) {
            (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending = true;
          }
        }).observe(input, { attributes: true, attributeFilter: ["disabled"] });
      }
    });

    await messageInput.fill(prompt);
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText(prompt)).toBeVisible();

    await expect(assistantBubbles).toHaveCount(bubblesBefore + 1, { timeout: 10_000 });
    expect(
      await page.evaluate(() => (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending),
    ).toBe(true);
    await expect(page.getByRole("status", { name: "Coach is typing" })).toHaveCount(0);
    await expect(messageInput).toBeEnabled();

    await page.reload();
    await expect(page.getByText(prompt)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
