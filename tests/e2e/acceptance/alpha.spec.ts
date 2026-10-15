import { expect, type Locator, type Page, test } from "@playwright/test";

// Preview acceptance run (.github/workflows/preview-acceptance.yml): a fresh synthetic mail.tm
// account, signed in with scripts/e2e/magic-link-login.mjs and approved on TEST ceaseless-dog-617,
// checks the core alpha screens on the deployed preview. One test per check, so a failure names
// the screen. Skips locally and in CI unless both the storage state and a preview URL are given.
// Sends exactly ONE coach message per run: coach replies may spend provider credit.

const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const previewBaseURL = process.env.PLAYWRIGHT_BASE_URL;

const COACH_PROMPT = "Give me one tip for starting my morning.";
const COACH_REPLY_TIMEOUT_MS = 90_000;
// Signed-in screens wait for the Convex WebSocket and the account's first queries.
const SCREEN_READY_TIMEOUT_MS = 30_000;

// Users must never see raw JSON, Convex ids or json-render block ids.
const RAW_JSON = /[{[]\s*"[A-Za-z_]+"\s*:/;
const CONVEX_ID = /\b[a-z0-9]{32}\b/;
const BLOCK_ID = /\bblk_[A-Za-z0-9_-]*/;

function uniqueStamp(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/** Visible page text has no raw JSON, Convex ids or blk_ ids (reports only the matched snippet). */
async function expectNoInternalsOnScreen(page: Page, where: string): Promise<void> {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.match(RAW_JSON)?.[0] ?? null, `${where}: raw JSON is visible`).toBeNull();
  expect(text.match(CONVEX_ID)?.[0] ?? null, `${where}: a Convex id is visible`).toBeNull();
  expect(text.match(BLOCK_ID)?.[0] ?? null, `${where}: a blk_ id is visible`).toBeNull();
}

/**
 * Open a signed-in screen and wait for `ready`. Fails fast, with a reason, when the session was
 * not accepted (sign-in form) or the account is not approved (waiting screen).
 */
async function openSignedIn(page: Page, path: string, ready: Locator): Promise<void> {
  await page.goto(path);
  const signInForm = page.getByRole("button", { name: "Send magic link" });
  const notApproved = page.getByRole("heading", {
    name: /^(Waiting for approval|Your access is paused)$/,
  });
  await expect(ready.or(signInForm).or(notApproved).first()).toBeVisible({
    timeout: SCREEN_READY_TIMEOUT_MS,
  });
  await expect(signInForm, `${path}: the stored session was not accepted`).toHaveCount(0);
  await expect(
    notApproved,
    `${path}: the account is not approved (dispatch with approve=true)`
  ).toHaveCount(0);
  await expect(ready).toBeVisible();
}

function mainHeading(page: Page, name: string | RegExp): Locator {
  return page
    .getByRole("main")
    .getByRole("heading", { level: 1, name, exact: typeof name === "string" });
}

test.describe("preview acceptance (synthetic approved account)", () => {
  test.skip(
    !storageStatePath || !previewBaseURL,
    "needs TEMPO_E2E_STORAGE_STATE and PLAYWRIGHT_BASE_URL"
  );
  test.use({ storageState: storageStatePath });
  test.describe.configure({ timeout: 120_000 });

  test("today: main content loads for the signed-in account", async ({ page }) => {
    await openSignedIn(page, "/today", mainHeading(page, /^Hi,/));
    await expect(page.getByRole("region", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in required" })).toHaveCount(0);
    await expectNoInternalsOnScreen(page, "/today");
  });

  test("notes: a new note keeps its title, body and pin across reloads", async ({ page }) => {
    const stamp = uniqueStamp();
    const title = `Acceptance note ${stamp}`;
    const body = `Written by the preview acceptance run ${stamp}.`;

    await openSignedIn(page, "/notes", mainHeading(page, "Notes"));
    await expect(page.getByText("Loading your notes.")).toHaveCount(0);
    await page.getByLabel("New note title", { exact: true }).fill(title);
    await page.getByRole("button", { name: "New note", exact: true }).click();
    await expect(page).toHaveURL(/\/notes\/[^/?#]+$/);

    const titleField = page.getByLabel("Note title", { exact: true });
    const bodyField = page.getByLabel("Note body", { exact: true });
    await expect(titleField).toHaveValue(title, { timeout: SCREEN_READY_TIMEOUT_MS });
    await bodyField.fill(body);
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();

    await page.reload();
    await expect(titleField).toHaveValue(title, { timeout: SCREEN_READY_TIMEOUT_MS });
    await expect(bodyField).toHaveValue(body);

    await page.getByRole("button", { name: "Pin", exact: true }).click();
    const unpin = page.getByRole("button", { name: "Unpin", exact: true });
    await expect(unpin).toBeVisible();

    await page.reload();
    await expect(unpin).toBeVisible({ timeout: SCREEN_READY_TIMEOUT_MS });
    await expect(titleField).toHaveValue(title);
    await expectNoInternalsOnScreen(page, "note editor");

    await page.getByRole("link", { name: "← Back to notes" }).click();
    const row = page.getByRole("listitem").filter({ hasText: title });
    await expect(row.getByText(body)).toBeVisible({ timeout: SCREEN_READY_TIMEOUT_MS });
    await expect(row.getByText("Pinned", { exact: true })).toBeVisible();

    await page.reload();
    await expect(row.getByText("Pinned", { exact: true })).toBeVisible({
      timeout: SCREEN_READY_TIMEOUT_MS,
    });
    await expect(row.getByRole("button", { name: `Unpin ${title}`, exact: true })).toBeVisible();
    await expectNoInternalsOnScreen(page, "/notes");
  });

  test("tasks: a ticked task stays ticked after reload and is listed once", async ({ page }) => {
    const title = `Acceptance task ${uniqueStamp()}`;

    await openSignedIn(page, "/tasks", mainHeading(page, "Inbox"));
    const titleInput = page.getByLabel("Task title", { exact: true });
    await expect(titleInput).toBeEnabled({ timeout: SCREEN_READY_TIMEOUT_MS });
    await titleInput.fill(title);
    await page.getByRole("button", { name: "Add task", exact: true }).click();

    const tick = page.getByRole("button", { name: `Mark ${title} complete`, exact: true });
    const ticked = page.getByRole("button", { name: `Mark ${title} not done`, exact: true });
    await expect(tick).toBeVisible();
    await tick.click();
    await expect(ticked).toBeVisible();

    await page.reload();
    await expect(ticked).toBeVisible({ timeout: SCREEN_READY_TIMEOUT_MS });
    await expect(tick).toHaveCount(0);
    const rows = page.getByRole("listitem").filter({ hasText: title });
    await expect(rows).toHaveCount(1);
    await expect(page.getByText(title, { exact: true })).toHaveCount(1);
    await expect(rows.getByText("Done", { exact: true })).toBeVisible();
    await expectNoInternalsOnScreen(page, "/tasks");
  });

  test("coach: one message gets a new, non-empty assistant reply", async ({ page }) => {
    test.setTimeout(COACH_REPLY_TIMEOUT_MS + 60_000);

    await openSignedIn(page, "/coach", mainHeading(page, "Coach"));
    const input = page.getByLabel("Message", { exact: true });
    await expect(input).toBeEnabled({ timeout: SCREEN_READY_TIMEOUT_MS });
    await expect(page.getByText("Loading your conversation.")).toHaveCount(0);

    const assistant = page.locator('[data-role="assistant"]');
    const typing = page.getByRole("status", { name: "Coach is typing" });
    const errorBanner = page.getByRole("main").getByRole("alert");
    const before = await assistant.count();

    await input.fill(COACH_PROMPT);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(COACH_PROMPT, { exact: true }).last()).toBeVisible();

    let reply = "";
    await expect
      .poll(
        async () => {
          if ((await errorBanner.count()) > 0) return "error banner";
          if ((await assistant.count()) <= before) return "waiting";
          if ((await typing.count()) > 0) return "waiting";
          reply = (await assistant.nth(before).innerText()).trim();
          return reply ? "replied" : "waiting";
        },
        {
          message: "a new coach reply or an error banner",
          timeout: COACH_REPLY_TIMEOUT_MS,
          intervals: [500, 1_000, 2_000],
        }
      )
      .not.toBe("waiting");

    test.info().annotations.push({
      type: "coach-reply",
      description: reply ? reply.replace(/\s+/g, " ").slice(0, 80) : "(no reply: error banner)",
    });
    await expect(errorBanner, "coach send failed: an error banner is visible").toHaveCount(0);
    expect(reply.length, "coach reply is empty").toBeGreaterThan(0);
    expect(reply, "coach reply is an error message").not.toMatch(
      /ACCOUNT_PENDING_APPROVAL|Server Error|Uncaught|\[CONVEX|^error\b|something went wrong|didn.t send/i
    );
    await expectNoInternalsOnScreen(page, "/coach");
  });

  test("settings/memory: the memory screen loads", async ({ page }) => {
    await openSignedIn(
      page,
      "/settings/memory",
      page.getByRole("searchbox", { name: "Search memories", exact: true })
    );
    const region = page.getByRole("region", { name: "What Tempo remembers", exact: true });
    await expect(region).toBeVisible();
    await expect(region).not.toHaveAttribute("aria-busy", "true");
    await expectNoInternalsOnScreen(page, "/settings/memory");
  });
});
