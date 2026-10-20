import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { devices, expect, test } from "@playwright/test";

// The signed-in source fixture uses real production components with fictional reactive transport.
// It proves client interactions/layout, not authentication, deployed Convex, or provider availability.
let fixture: ChildProcess;
let origin: string;
test.beforeAll(async () => {
  const dir = mkdtempSync(join(process.cwd(), "work/mobile-e2e-"));
  fixture = spawn("bun", ["tests/fixtures/mobile-today-server.ts", dir], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  origin = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => { fixture.kill(); reject(new Error(`Source fixture startup timed out: ${output}`)); }, 20_000);
    fixture.stdout?.on("data", chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    fixture.stderr?.on("data", chunk => { output += chunk; });
    fixture.on("exit", code => { clearTimeout(timer); reject(new Error(`Source fixture exited ${code}: ${output}`)); });
  });
});
test.afterAll(() => { fixture?.kill(); });

for (const [name, device] of [["iPhone 13", { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } }], ["Pixel 7", devices["Pixel 7"]]] as const) {
  test.describe(name, () => {
    test.use({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch });
    test("five compact tasks fit above persistent bars and quick add creates a task due today", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto(`${origin}/today`);
      const rows = page.locator('[data-component="MobileTodayTaskList"] > ul > li');
      await expect(rows).toHaveCount(7);
      const ask = page.locator('[data-component="MobileAskBar"]');
      const tabs = page.locator('[data-component="TabBar"]');
      await expect(ask).toBeInViewport();
      await expect(tabs).toBeInViewport();
      const askBox = await ask.boundingBox();
      for (let i = 0; i < 5; i++) {
        const row = await rows.nth(i).boundingBox();
        expect(row?.height).toBeLessThanOrEqual(56);
        expect((row?.y ?? 0) + (row?.height ?? 0)).toBeLessThanOrEqual(askBox?.y ?? 0);
        const check = await rows.nth(i).getByRole("button").boundingBox();
        expect(check?.width).toBeGreaterThanOrEqual(44);
        expect(check?.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await ask.getByRole("textbox").fill("Send Dana a note");
      await page.evaluate(() => { const form = document.querySelector('[data-component="MobileAskBar"]'); form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      await expect(rows).toHaveCount(8);
      expect(await page.evaluate(() => (window as unknown as { __quickAddCalls: number }).__quickAddCalls)).toBe(1);
      await expect(ask.getByRole("textbox")).toHaveValue("");
      const dueAt = await page.evaluate(() => (window as unknown as { __lastQuickAdd: { dueAt: number } }).__lastQuickAdd.dueAt);
      expect(new Date(dueAt).toDateString()).toBe(new Date().toDateString());
      await rows.first().getByRole("button").click();
      await expect(rows).toHaveCount(7);
      await expect(page.getByText("Done today (2)")).toBeVisible();
      await page.getByText("Done today (2)").click();
      await expect(page.locator('[data-component="MobileTodayTaskList"] details li')).toHaveCount(2);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(ask).toBeInViewport(); await expect(tabs).toBeInViewport();
      const more = tabs.getByRole("button", { name: "More", exact: true });
      await more.click();
      await expect(page.locator('[data-component="Sidebar"] [data-component="CommandTrigger"]')).toBeFocused();
      expect(await ask.evaluate(element => Boolean(element.closest("[inert]")))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(more).toBeFocused();
      expect(await ask.evaluate(element => Boolean(element.closest("[inert]")))).toBe(false);
      expect(errors).toEqual([]);
    });

    test("planning handoff preserves draft, surfaces public error data, accepts all lanes and keeps Undo across tabs", async ({ page }) => {
      await page.goto(`${origin}/today`);
      const ask = page.locator('[data-component="MobileAskBar"]');
      await ask.getByRole("textbox").fill("Reply to Dana and make room for a walk");
      await ask.getByRole("button", { name: "Plan", exact: true }).click();
      await expect(page).toHaveURL(/\/coach#mobile-plan$/);
      const panel = page.locator('[data-component="TodayBrainDumpPanel"]');
      await expect(panel.getByRole("textbox")).toHaveValue("Reply to Dana and make room for a walk");
      await expect(panel.getByText("Your draft is here, just as you left it.")).toBeVisible();
      await page.evaluate(() => { (window as unknown as { __planError: string }).__planError = "Planning is taking a break. Your draft is safe."; });
      await panel.getByRole("button", { name: "Sort it", exact: true }).click();
      await expect(panel.getByRole("alert")).toHaveText("Planning is taking a break. Your draft is safe.");
      await expect(panel.getByRole("textbox")).toHaveValue("Reply to Dana and make room for a walk");
      await page.evaluate(() => { delete (window as unknown as { __planError?: string }).__planError; });
      await panel.getByRole("button", { name: "Sort it", exact: true }).click();
      for (const label of ["Now", "Soon", "Later"]) await expect(panel.getByText(label, { exact: true }).first()).toBeVisible();
      const accepts = panel.getByRole("button", { name: "Accept", exact: true });
      await accepts.nth(0).click(); await accepts.nth(0).click(); await accepts.nth(0).click();
      await panel.getByRole("button", { name: /Add to Today/ }).click();
      const updates = await page.evaluate(() => (window as unknown as { __todayUpdates: { taskId: string; dueAt: number }[] }).__todayUpdates);
      expect(updates.map(update => update.taskId)).toEqual(["accepted0", "accepted1", "accepted2"]);
      await page.locator('[data-component="TabBar"]').getByRole("link", { name: "Today", exact: true }).click();
      await expect(page.locator('[data-component="UndoToast"]')).toBeVisible();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(page.locator('[data-component="UndoToast"]')).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { __removedTasks: string[] }).__removedTasks)).toEqual(["accepted0", "accepted1", "accepted2"]);
      await page.goto(`${origin}/brain-dump`);
      await page.locator("main textarea").fill("Keep this thought for Maya");
      await page.evaluate(() => { (window as unknown as { __planError: string }).__planError = "Your account is waiting for approval."; });
      await page.getByRole("button", { name: "Sort it", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText("Your account is waiting for approval.");
      await expect(page.locator("main textarea")).toHaveValue("Keep this thought for Maya");
    });
  });
}

test("real Next routes remain reachable through the new mobile tabs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/today");
  const tabs = page.locator('[data-component="TabBar"]');
  await tabs.getByRole("link", { name: "Inbox", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("main").getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await tabs.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await tabs.getByRole("link", { name: "Upcoming", exact: true }).click();
  await expect(page.getByTestId("plan-day")).toBeVisible();
  await tabs.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(page.getByRole("main").getByRole("heading", { name: "Coach", exact: true })).toBeVisible();
});


test("same Chat handoff preserves the saved draft until replacement and keeps input when storage refuses", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/brain-dump`);
  const ask = page.locator('[data-component="MobileAskBar"]');
  const panel = page.locator('[data-component="TodayBrainDumpPanel"]');
  await page.locator("main textarea").fill("An older visible draft still waiting for its typing pause");
  await ask.getByRole("textbox").fill("First thought for Maya");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.locator("main textarea")).toHaveValue("An older visible draft still waiting for its typing pause");
  await ask.getByRole("button", { name: "Replace saved draft" }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("First thought for Maya");
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("tempo:brain-dump:session") ?? "null").draft)).toBe("First thought for Maya");
  await ask.getByRole("textbox").fill("A different thought for Dana");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await ask.getByRole("button", { name: "Keep editing" }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("First thought for Maya");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await ask.getByRole("button", { name: "Replace saved draft" }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("A different thought for Dana");
  expect(await page.evaluate(() => (window as unknown as { __planCalls?: number }).__planCalls ?? 0)).toBe(0);
  await ask.getByRole("button", { name: "Talk with the coach" }).click();
  await expect(page.getByText("Voice is not available right now. You can type here.")).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("Storage blocked"); }; });
  await ask.getByRole("textbox").fill("Keep this thought here");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await ask.getByRole("button", { name: "Replace saved draft" }).click();
  await expect(ask.getByRole("textbox")).toHaveValue("Keep this thought here");
  await expect(ask.getByText("Could not keep this draft. Your text is still here.")).toBeVisible();
});

test("placement retry survives navigation without another acceptance and failed Undo retries only remaining IDs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/today`);
  const ask = page.locator('[data-component="MobileAskBar"]');
  const panel = page.locator('[data-component="TodayBrainDumpPanel"]');
  await ask.getByRole("textbox").fill("Give Maya room for today");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await panel.getByRole("button", { name: "Sort it", exact: true }).click();
  for (let i = 0; i < 3; i++) await panel.getByRole("button", { name: "Accept", exact: true }).first().click();
  await page.evaluate(() => { (window as unknown as { __failToday: string }).__failToday = "accepted1"; });
  await panel.getByRole("button", { name: /Add to Today/ }).click();
  await expect(page.getByRole("button", { name: "Retry Add to Today", exact: true })).toBeVisible();
  await page.locator('[data-component="TabBar"]').getByRole("link", { name: "Today", exact: true }).click();
  await page.locator('[data-component="TabBar"]').getByRole("link", { name: "Chat", exact: true }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("");
  await page.getByRole("button", { name: "Retry Add to Today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry Add to Today", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __acceptCalls: number }).__acceptCalls)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __todayUpdates: { taskId: string }[] }).__todayUpdates.map(row => row.taskId))).toEqual(["accepted0", "accepted1", "accepted2", "accepted1"]);
  await page.evaluate(() => { (window as unknown as { __failUndo: boolean }).__failUndo = true; });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-component="UndoToast"] [role="alert"]')).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-component="UndoToast"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __removedTasks: string[] }).__removedTasks)).toEqual(["accepted1", "accepted2", "accepted0"]);
});


test("late acceptance consumes only its own draft and receipts survive until Undo or an account change", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/today`);
  const ask = page.locator('[data-component="MobileAskBar"]');
  const panel = page.locator('[data-component="TodayBrainDumpPanel"]');
  const tabs = page.locator('[data-component="TabBar"]');
  const prepare = async (text: string) => {
    await ask.getByRole("textbox").fill(text);
    await ask.getByRole("button", { name: "Plan", exact: true }).click();
    await panel.getByRole("button", { name: "Sort it", exact: true }).click();
    await panel.getByRole("button", { name: "Accept", exact: true }).first().click();
    await page.evaluate(() => { (window as unknown as { __holdAccept: boolean }).__holdAccept = true; });
    await panel.getByRole("button", { name: /Add to Today/ }).click();
    await page.waitForFunction(() => typeof (window as unknown as { __releaseAccept?: () => void }).__releaseAccept === "function");
  };
  await prepare("First accepted thought for Maya");
  await tabs.getByRole("link", { name: "Today", exact: true }).click();
  await page.evaluate(() => { (window as unknown as { __releaseAccept: () => void }).__releaseAccept(); });
  await expect(page.locator('[data-component="UndoToast"]')).toHaveCount(1);
  await tabs.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("");
  await page.evaluate(() => { delete (window as unknown as { __releaseAccept?: () => void }).__releaseAccept; });
  await prepare("Second accepted thought for Dana");
  await tabs.getByRole("link", { name: "Today", exact: true }).click();
  await ask.getByRole("textbox").fill("A newer unsubmitted thought for Yoni");
  await ask.getByRole("button", { name: "Plan", exact: true }).click();
  await ask.getByRole("button", { name: "Replace saved draft" }).click();
  await expect(panel.getByRole("textbox")).toHaveValue("A newer unsubmitted thought for Yoni");
  await page.evaluate(() => { (window as unknown as { __releaseAccept: () => void }).__releaseAccept(); });
  await expect(page.locator('[data-component="UndoToast"]')).toHaveCount(2);
  await expect(panel.getByRole("textbox")).toHaveValue("A newer unsubmitted thought for Yoni");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("tempo:brain-dump:session") ?? "null").draft)).toBe("A newer unsubmitted thought for Yoni");
  await page.evaluate(() => { const fixture = window as unknown as { __accountId: string; __fixtureChange: () => void }; fixture.__accountId = "dana"; fixture.__fixtureChange(); });
  await expect(page.locator('[data-component="UndoToast"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __removedTasks?: string[] }).__removedTasks ?? [])).toEqual([]);
});
