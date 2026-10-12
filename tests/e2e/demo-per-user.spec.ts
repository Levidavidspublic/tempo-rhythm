import { expect, test } from "@playwright/test";

const storageStateA = process.env.TEMPO_E2E_STORAGE_STATE;
const storageStateB = process.env.TEMPO_E2E_STORAGE_STATE_B;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectRuntimeModel = process.env.EXPECT_RUNTIME_MODEL === "1";

const COACH_REPLIES: Record<string, string> = {
  pomodoro:
    "Try one 25-minute stretch with a single timer. After a 5-minute break, you get to choose: another stretch, or move on. Either answer is a win.",
  body_double:
    "Work alongside someone — in person or on a quiet video call — without talking about the task. Just having company nearby makes it easier to stay with it.",
  eat_the_frog:
    "Pick the task that feels heaviest today and start there, before anything else. Only the first small step counts right now — nothing more.",
  time_blocking:
    "Block a short window on your calendar for one task, and set a single reminder for the end of the window. No mid-plan changes — the window does the deciding for you.",
  two_minute:
    "If it truly takes under two minutes, do it now. If not, shrink it into a step so small it starts in one second.",
  general:
    "What's the smallest step you could take without any resistance? Start there — that's the whole assignment.",
};

function url(path: string): string {
  return new URL(path, baseURL).toString();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("demo: notes stay per user", () => {
  test.skip(!storageStateA || !storageStateB, "needs TEMPO_E2E_STORAGE_STATE and TEMPO_E2E_STORAGE_STATE_B");

  test("user A's note is invisible to user B", async ({ browser }) => {
    const runId = Date.now();
    const noteTitle = `Demo A ${runId}`;

    const contextA = await browser.newContext({ storageState: storageStateA });
    const pageA = await contextA.newPage();
    const consoleErrorsA: string[] = [];
    pageA.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrorsA.push(message.text());
      }
    });

    await pageA.goto(url("/notes"));
    await expect(pageA.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();

    await pageA.getByRole("button", { name: "New note" }).click();
    await expect(pageA).toHaveURL(/\/notes\/[^/]+$/);
    const noteId = new URL(pageA.url()).pathname.split("/").pop() as string;

    await pageA.getByLabel("Note title").fill(noteTitle);
    await pageA.getByLabel("Note body").fill("first");
    await expect(pageA.getByRole("status")).toHaveText("Saved");

    await pageA.getByLabel("Note body").fill("edited");
    await expect(pageA.getByRole("status")).toHaveText("Saved");

    await pageA.reload();
    await expect(pageA.getByLabel("Note body")).toHaveText("edited");

    expect(consoleErrorsA).toEqual([]);
    await contextA.close();

    const contextB = await browser.newContext({ storageState: storageStateB });
    const pageB = await contextB.newPage();
    const consoleErrorsB: string[] = [];
    pageB.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrorsB.push(message.text());
      }
    });

    await pageB.goto(url("/notes"));
    await expect(pageB.getByRole("main").getByRole("heading", { name: "Notes" })).toBeVisible();
    // Wait for the list to actually load before trusting a negative check.
    await expect(pageB.getByText("Loading your notes.")).toHaveCount(0);
    await expect(pageB.getByText(noteTitle)).toHaveCount(0);

    await pageB.goto(url(`/notes/${noteId}`));
    await expect(pageB.getByText("Loading note.")).toHaveCount(0);
    await expect(pageB.getByText(noteTitle)).toHaveCount(0);
    await expect(pageB.getByText("edited")).toHaveCount(0);

    expect(consoleErrorsB).toEqual([]);
    await contextB.close();
  });
});

test.describe("demo: chat stays per user", () => {
  test.skip(!storageStateA || !storageStateB, "needs TEMPO_E2E_STORAGE_STATE and TEMPO_E2E_STORAGE_STATE_B");

  test("user A's conversation is invisible to user B", async ({ browser }) => {
    const prompt = `Help me pick one thing for this afternoon ${Date.now()}`;

    const contextA = await browser.newContext({ storageState: storageStateA });
    const pageA = await contextA.newPage();
    const consoleErrorsA: string[] = [];
    pageA.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrorsA.push(message.text());
      }
    });

    await pageA.goto(url("/coach"));
    await expect(pageA.getByRole("main").getByRole("heading", { name: "Coach" })).toBeVisible();

    const messageInput = pageA.getByLabel("Message");
    const assistantBubbles = pageA.locator('[data-role="assistant"]');

    // Wait for the conversation to finish loading before reading the bubble
    // count — otherwise auth/conversationId/messages may still be unresolved,
    // giving a false "0" that races the real count once loading finishes.
    await expect(messageInput).toBeEnabled();
    await expect(pageA.getByText("Loading your conversation.")).toHaveCount(0);

    const bubblesBefore = await assistantBubbles.count();

    // The reply can resolve in well under a second, so a post-click
    // `toBeDisabled()` check races isSending flipping back to false. Record
    // the disabled transition with an observer attached before the click
    // instead of polling for it afterwards.
    await pageA.evaluate(() => {
      (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending = false;
      const input = document.querySelector('input[aria-label="Message"]');
      if (input) {
        new MutationObserver(() => {
          if ((input as HTMLInputElement).disabled) {
            (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending = true;
          }
        }).observe(input, { attributes: true, attributeFilter: ["disabled"] });
      }
    });

    await messageInput.fill(prompt);
    const sendStart = Date.now();
    await pageA.getByRole("button", { name: "Send" }).click();

    await expect(pageA.getByText(prompt)).toBeVisible();

    // Exactly one new assistant bubble, not "some bubble somewhere matches",
    // so this survives a conversation thread with earlier replies in it.
    await expect(assistantBubbles).toHaveCount(bubblesBefore + 1, { timeout: 10_000 });
    expect(Date.now() - sendStart).toBeLessThan(10_000);
    expect(
      await pageA.evaluate(() => (window as unknown as { __tempoSawSending: boolean }).__tempoSawSending),
    ).toBe(true);
    await expect(pageA.getByRole("status", { name: "Coach is typing" })).toHaveCount(0);
    await expect(messageInput).toBeEnabled();

    const newReply = assistantBubbles.nth(bubblesBefore);
    const templateReplies = Object.values(COACH_REPLIES);
    if (expectRuntimeModel) {
      for (const reply of templateReplies) {
        await expect(newReply).not.toHaveText(reply);
      }
    } else {
      const replyPattern = new RegExp(templateReplies.map(escapeRegExp).join("|"));
      await expect(newReply).toHaveText(replyPattern);
    }

    await pageA.reload();
    await expect(pageA.getByText(prompt)).toBeVisible();

    await pageA.goto(url("/history"));
    await expect(pageA.getByText(prompt)).toBeVisible();

    expect(consoleErrorsA).toEqual([]);
    await contextA.close();

    const contextB = await browser.newContext({ storageState: storageStateB });
    const pageB = await contextB.newPage();
    const consoleErrorsB: string[] = [];
    pageB.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrorsB.push(message.text());
      }
    });

    await pageB.goto(url("/history"));
    // Wait for the loaded state (either empty or populated) before trusting a
    // negative check — the skeleton has no text of its own to assert against.
    await expect(
      pageB.getByRole("heading", {
        name: /No past conversations yet|Pick up a conversation where you left it/,
      }),
    ).toBeVisible();
    await expect(pageB.getByText(prompt)).toHaveCount(0);

    await pageB.goto(url("/coach"));
    await expect(pageB.getByText("Loading your conversation.")).toHaveCount(0);
    await expect(pageB.getByText(prompt)).toHaveCount(0);

    expect(consoleErrorsB).toEqual([]);
    await contextB.close();
  });
});
