import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Logged-in feature sweep. Skips unless both env vars are set, so CI
 * (no preview URL, no storage state) stays green.
 *
 *   PLAYWRIGHT_BASE_URL=<url> TEMPO_E2E_STORAGE_STATE=/tmp/tempo-state.json \
 *     bunx playwright test tests/e2e/feature-sweep.spec.ts --reporter=list
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const storageStatePath = process.env.TEMPO_E2E_STORAGE_STATE;
const enabled = Boolean(baseURL && storageStatePath);
const runId = `s${Date.now().toString(36)}`;
const outDir = path.join("test-results", "feature-sweep");

type Status = "works" | "broken" | "not-wired";

type Result = {
  feature: string;
  pr: string;
  route: string;
  status: Status;
  error: string;
  screenshot: string;
};

type Watch = { consoleErrors: string[]; httpErrors: string[] };

const results: Result[] = [];

test.describe.configure({ mode: "serial" });

if (enabled && storageStatePath) {
  // This sandbox has system Chrome, not Playwright's downloaded browser.
  // CI leaves `enabled` false, so it keeps the default Chromium project.
  test.use({
    storageState: storageStatePath,
    channel: "chrome",
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
  });
}

function redact(text: string): string {
  return text
    .replace(/code=[^&\s"'<>]+/gi, "code=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .slice(0, 400);
}

function notes(watch: Watch): string {
  const lines = [
    ...watch.consoleErrors.slice(0, 4).map((line) => `console: ${line}`),
    ...watch.httpErrors.slice(0, 6).map((line) => `http: ${line}`),
  ];
  return lines.join(" | ");
}

function attach(page: Page): Watch {
  const watch: Watch = { consoleErrors: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") watch.consoleErrors.push(redact(message.text()));
  });
  page.on("pageerror", (error) => {
    watch.consoleErrors.push(redact(error.message));
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    try {
      const url = new URL(response.url());
      if (url.pathname === "/favicon.ico") return;
      const host = url.host;
      const app =
        host.includes("convex") ||
        host.endsWith("tempoflow.dev") ||
        host.includes("vercel.app") ||
        (baseURL ? host === new URL(baseURL).host : false);
      if (!app) return;
      watch.httpErrors.push(`${response.status()} ${host}${url.pathname}`);
    } catch {
      watch.httpErrors.push(String(response.status()));
    }
  });
  return watch;
}

async function shot(page: Page, slug: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return file;
}

async function record(
  page: Page,
  row: Omit<Result, "screenshot" | "error"> & { error?: string },
  watch: Watch,
): Promise<void> {
  const screenshot = await shot(page, slugify(row.feature));
  const extra = notes(watch);
  const error = [row.error ?? "", extra].filter(Boolean).join(" | ").slice(0, 700);
  results.push({ ...row, error, screenshot });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
}

function slugify(feature: string): string {
  return feature
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function isScaffold(page: Page): Promise<boolean> {
  const beta = await page.getByText("Beta preview", { exact: true }).count();
  const button = await page.getByRole("button", { name: "Continue in beta" }).count();
  return beta > 0 && button > 0;
}

async function isNotFound(page: Page, status: number | null): Promise<boolean> {
  if (status === 404) return true;
  const missing = await page.getByText("This page could not be found").count();
  return missing > 0;
}

async function signedOut(page: Page): Promise<boolean> {
  if (new URL(page.url()).pathname === "/sign-in") return true;
  return (await page.locator("#sign-in-email").count()) > 0;
}

async function open(page: Page, route: string): Promise<number | null> {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const out = await signedOut(page);
    const shell = (await page.getByRole("link", { name: "Today" }).count()) > 0;
    if (shell && !out) return response?.status() ?? null;
    if (!out && (await page.locator("main h1, main").count()) > 0 && !shell) {
      return response?.status() ?? null;
    }
    await page.waitForTimeout(400);
  }
  return response?.status() ?? null;
}

type Gate = "ready" | "scaffold" | "missing" | "signed-out" | "not-found";

async function gate(page: Page, route: string, marker: Locator): Promise<Gate> {
  const status = await open(page, route);
  if (await signedOut(page)) return "signed-out";
  if (await isNotFound(page, status)) return "not-found";
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await signedOut(page)) return "signed-out";
    if (await isScaffold(page)) return "scaffold";
    if ((await marker.count()) > 0) return "ready";
    await page.waitForTimeout(400);
  }
  if (await isScaffold(page)) return "scaffold";
  if ((await marker.count()) > 0) return "ready";
  return "missing";
}

function gateStatus(kind: Gate): { status: Status; error: string } | null {
  if (kind === "ready") return null;
  if (kind === "scaffold") return { status: "not-wired", error: "ScaffoldScreen (Beta preview)" };
  if (kind === "not-found") return { status: "not-wired", error: "route 404" };
  if (kind === "signed-out") return { status: "broken", error: "redirected to /sign-in" };
  return { status: "not-wired", error: "component heading/controls absent" };
}

async function alertText(page: Page): Promise<string> {
  const alert = page.getByRole("alert").first();
  if ((await alert.count()) === 0) return "";
  return redact((await alert.innerText().catch(() => "")).trim());
}

const CRISIS_PHRASE = "I want to die";
const CRISIS_TITLE = "You are not alone, and help is available";

test.describe("logged-in feature sweep", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(() => {
    test.skip(!enabled, "needs PLAYWRIGHT_BASE_URL and TEMPO_E2E_STORAGE_STATE");
  });

  test.afterAll(async () => {
    if (results.length === 0) return;
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  });

  test("DayPlanPanel", async ({ page }) => {
    const watch = attach(page);
    const feature = "DayPlanPanel (intention, top tasks, energy)";
    const route = "/today";
    try {
      const kind = await gate(page, route, page.getByLabel("Plan for today"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#599", route, ...blocked }, watch);
        return;
      }
      const intention = `One calm thing ${runId}`;
      const input = page.locator("#day-plan-intention");
      const edit = page.getByRole("button", { name: "Edit plan" });
      if ((await edit.count()) > 0) await edit.click();
      await input.fill(intention);
      await input.blur();
      const commit = page.getByRole("button", { name: "This is my day" });
      if ((await commit.count()) > 0) await commit.click();
      else await page.getByRole("button", { name: "Done editing" }).click();
      const failure = await alertText(page);
      if (failure) {
        await record(page, { feature, pr: "#599", route, status: "broken", error: failure }, watch);
        return;
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#day-plan-intention")).toHaveValue(intention, { timeout: 10_000 });
      await record(page, { feature, pr: "#599", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(
        page,
        { feature, pr: "#599", route, status: "broken", error: redact(String(error)) },
        watch,
      );
    }
  });

  test("CarryOverStrip", async ({ page }) => {
    const watch = attach(page);
    const feature = "CarryOverStrip";
    const route = "/today";
    try {
      const status = await open(page, route);
      if (await signedOut(page)) {
        await record(page, { feature, pr: "#598", route, status: "broken", error: "redirected to /sign-in" }, watch);
        return;
      }
      if (await isScaffold(page)) {
        await record(page, { feature, pr: "#598", route, status: "not-wired", error: "ScaffoldScreen (Beta preview)" }, watch);
        return;
      }
      if (await isNotFound(page, status)) {
        await record(page, { feature, pr: "#598", route, status: "not-wired", error: "route 404" }, watch);
        return;
      }
      const heading = page.getByRole("heading", { name: "Still open from earlier days" });
      const seen = await heading.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
      if (!seen) {
        await record(page, {
          feature,
          pr: "#598",
          route,
          status: "not-wired",
          error:
            "heading absent. CarryOverStrip returns null when there are no older open tasks, so an empty list is indistinguishable from not mounted",
        }, watch);
        return;
      }
      await record(page, { feature, pr: "#598", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#598", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("HabitCheckInStrip", async ({ page }) => {
    const watch = attach(page);
    const feature = "HabitCheckInStrip";
    const route = "/today";
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "Habits today" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#633", route, ...blocked }, watch);
        return;
      }
      const name = `Water ${runId}`;
      if ((await page.getByText("No habits yet").count()) > 0) {
        await page.goto("/habits", { waitUntil: "domcontentloaded" });
        const library = page.locator("#habits-library-name");
        const legacy = page.locator("#habit-name");
        if ((await library.count()) > 0) {
          await library.fill(name);
          await page.getByRole("button", { name: "Add habit" }).click();
        } else if ((await legacy.count()) > 0) {
          await legacy.fill(name);
          await page.getByRole("button", { name: "Add habit" }).click();
        } else {
          await record(page, { feature, pr: "#633", route, status: "broken", error: "strip is empty and no habit form to create one" }, watch);
          return;
        }
        await page.getByText(name).waitFor({ timeout: 10_000 });
        await page.goto("/today", { waitUntil: "domcontentloaded" });
        await page.getByRole("heading", { name: "Habits today" }).waitFor({ timeout: 10_000 });
      }
      const check = page.getByRole("button", { name: /Check .+ for today/ }).first();
      if ((await check.count()) === 0) {
        const undoFirst = page.getByRole("button", { name: /Undo today's check/ }).first();
        if ((await undoFirst.count()) === 0) {
          await record(page, { feature, pr: "#633", route, status: "broken", error: "no habit check control" }, watch);
          return;
        }
      } else {
        await check.click();
      }
      const checked = page.getByRole("button", { name: /Undo today's check/ }).first();
      await expect(checked).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
      const label = await checked.getAttribute("aria-label");
      await page.reload({ waitUntil: "domcontentloaded" });
      const after = page.getByRole("button", { name: label ?? /Undo today's check/ }).first();
      await expect(after).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
      await after.click();
      await expect(after).toHaveAttribute("aria-pressed", "false", { timeout: 10_000 });
      await record(page, { feature, pr: "#633", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#633", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("DayPlanSummary", async ({ page }) => {
    const watch = attach(page);
    const feature = "DayPlanSummary (one-tap done)";
    const route = "/today";
    try {
      const kind = await gate(page, route, page.locator("#day-plan-summary-heading"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#643", route, ...blocked }, watch);
        return;
      }
      const done = page.getByRole("button", { name: /Mark .+ done$/ }).first();
      if ((await done.count()) === 0) {
        await record(page, {
          feature,
          pr: "#643",
          route,
          status: "broken",
          error: "summary heading is present but there is no done control to update",
        }, watch);
        return;
      }
      const label = (await done.getAttribute("aria-label")) ?? "";
      await done.click();
      const failure = await alertText(page);
      if (failure) {
        await record(page, { feature, pr: "#643", route, status: "broken", error: failure }, watch);
        return;
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      const title = label.replace(/^Mark /, "").replace(/ done$/, "");
      await expect(page.getByRole("button", { name: `Mark ${title} as not done` })).toBeVisible({
        timeout: 10_000,
      });
      await record(page, { feature, pr: "#643", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#643", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("DayTimeline", async ({ page }) => {
    const watch = attach(page);
    const feature = "DayTimeline";
    const route = "/plan";
    try {
      const kind = await gate(page, route, page.getByTestId("day-timeline"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#603", route, ...blocked }, watch);
        return;
      }
      await expect(page.getByRole("heading", { name: "Day timeline" })).toBeVisible();
      await record(page, { feature, pr: "#603", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#603", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("TimeBlockDialog", async ({ page }) => {
    const watch = attach(page);
    const feature = "TimeBlockDialog";
    const route = "/plan";
    const title = `Block ${runId}`;
    const edited = `Block edited ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("button", { name: /Add a block at/ }).first());
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#625", route, ...blocked }, watch);
        return;
      }
      await page.getByRole("button", { name: /Add a block at/ }).first().click();
      await page.locator("#time-block-title").fill(title);
      await page.getByRole("button", { name: "Add block" }).click();
      const added = page.getByRole("button", { name: new RegExp(title) });
      await expect(added).toBeVisible({ timeout: 10_000 });
      await added.click();
      await page.locator("#time-block-title").fill(edited);
      await page.getByRole("button", { name: "Save changes" }).click();
      const updated = page.getByRole("button", { name: new RegExp(edited) });
      await expect(updated).toBeVisible({ timeout: 10_000 });
      await updated.click();
      await page.getByRole("button", { name: "Delete block" }).click();
      await page.getByRole("button", { name: "Yes, delete" }).click();
      await expect(page.getByRole("button", { name: new RegExp(edited) })).toHaveCount(0, { timeout: 10_000 });
      await record(page, { feature, pr: "#625", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#625", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("HabitsLibrary", async ({ page }) => {
    const watch = attach(page);
    const feature = "HabitsLibrary";
    const route = "/habits";
    const name = `Stretch ${runId}`;
    try {
      const kind = await gate(page, route, page.locator("#habits-library-name"));
      const blocked = gateStatus(kind);
      if (blocked) {
        const legacy = await page.locator("#habit-name").count();
        await record(page, {
          feature,
          pr: "#635",
          route,
          status: blocked.status,
          error: legacy > 0 ? `${blocked.error}; HabitsScreen is mounted instead` : blocked.error,
        }, watch);
        return;
      }
      await page.locator("#habits-library-name").fill(name);
      await page.getByRole("button", { name: "Add habit" }).click();
      const row = page.getByText(name);
      await expect(row).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: `Check ${name} for today` }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: `Undo today's check for ${name}` })).toBeVisible({
        timeout: 10_000,
      });
      await record(page, { feature, pr: "#635", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#635", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("HabitDetail", async ({ page }) => {
    const watch = attach(page);
    const feature = "HabitDetail 6-week grid";
    const route = "/habits/missing-sweep-id";
    try {
      await open(page, "/habits");
      const link = page.locator('a[href^="/habits/"]').first();
      const href = (await link.count()) > 0 ? await link.getAttribute("href") : null;
      const target = href && href !== "/habits" ? href : route;
      const kind = await gate(page, target, page.getByTestId("habit-six-week-grid"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#638", route: target, ...blocked }, watch);
        return;
      }
      const cell = page.getByTestId("habit-six-week-grid").getByRole("button").first();
      const before = await cell.getAttribute("aria-pressed");
      await cell.click();
      await page.reload({ waitUntil: "domcontentloaded" });
      const after = await page.getByTestId("habit-six-week-grid").getByRole("button").first().getAttribute("aria-pressed");
      if (before === after) {
        await record(page, { feature, pr: "#638", route: target, status: "broken", error: "cell aria-pressed did not change after reload" }, watch);
        return;
      }
      await record(page, { feature, pr: "#638", route: target, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#638", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Brain dump sort and accept", async ({ page }) => {
    test.setTimeout(120_000);
    const watch = attach(page);
    const feature = "Brain dump sort and accept";
    const route = "/brain-dump";
    try {
      const kind = await gate(page, route, page.getByRole("button", { name: "Sort it" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#632", route, ...blocked }, watch);
        return;
      }
      const lines = [
        `Reply to Sam ${runId}`,
        `Fill the kettle ${runId}`,
        `Walk the block ${runId}`,
        `File the receipt ${runId}`,
      ];
      await page.getByPlaceholder("Everything on your mind, messy is fine.").fill(lines.join("\n"));
      await page.getByRole("button", { name: "Sort it" }).click();
      const preview = page.getByRole("heading", { name: "Your order" });
      const appeared = await preview.waitFor({ timeout: 45_000 }).then(() => true).catch(() => false);
      if (!appeared) {
        const failure = (await alertText(page)) || "Sort it did not show a preview";
        await record(page, { feature, pr: "#632", route, status: "broken", error: failure }, watch);
        return;
      }
      const accepts = page.getByRole("button", { name: "Accept", exact: true });
      const count = await accepts.count();
      if (count < 2) {
        await record(page, { feature, pr: "#632", route, status: "broken", error: `preview showed ${count} Accept buttons` }, watch);
        return;
      }
      await accepts.nth(0).click();
      await accepts.nth(1).click();
      await page.getByRole("button", { name: /Add accepted/ }).click();
      await expect(page.getByText("2 added to your tasks")).toBeVisible({ timeout: 15_000 });
      await record(page, { feature, pr: "#632", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#632", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Brain dump crisis card", async ({ page }) => {
    const watch = attach(page);
    const feature = "Brain dump crisis card";
    const route = "/brain-dump";
    try {
      const kind = await gate(page, route, page.getByRole("button", { name: "Sort it" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#632", route, ...blocked }, watch);
        return;
      }
      await page.getByPlaceholder("Everything on your mind, messy is fine.").fill(CRISIS_PHRASE);
      await page.getByRole("button", { name: "Sort it" }).click();
      const card = page.getByText(CRISIS_TITLE);
      const fallback = page.getByText("Help is available");
      const seen = await card.or(fallback).first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      if (!seen) {
        const failure = (await alertText(page)) || "crisis phrase did not show the fixed card";
        await record(page, { feature, pr: "#632", route, status: "broken", error: failure }, watch);
        return;
      }
      await record(page, { feature, pr: "#632", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#632", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Coach dial and panic", async ({ page }) => {
    const watch = attach(page);
    const feature = "Coach dial and panic";
    const route = "/coach";
    try {
      const kind = await gate(page, route, page.locator("#coach-push-dial"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#637", route, ...blocked }, watch);
        return;
      }
      const dial = page.locator("#coach-push-dial");
      await dial.fill("4");
      await dial.dispatchEvent("pointerup");
      await dial.blur();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#coach-push-dial")).toHaveValue("4", { timeout: 10_000 });
      await page.getByRole("button", { name: "Panic" }).click();
      await expect(page.getByText(/10-second|10 second|one small action/i).first()).toBeVisible({
        timeout: 10_000,
      });
      const clear = page.getByRole("button", { name: /okay now/ });
      if ((await clear.count()) > 0) await clear.click();
      await record(page, { feature, pr: "#637", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#637", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Coach daily proposal", async ({ page }) => {
    test.setTimeout(90_000);
    const watch = attach(page);
    const feature = "Coach daily proposal";
    const route = "/coach";
    try {
      const kind = await gate(page, route, page.getByRole("button", { name: /Plan my day|Not today/ }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#644", route, ...blocked }, watch);
        return;
      }
      const plan = page.getByRole("button", { name: "Plan my day" });
      if ((await plan.count()) > 0) await plan.click();
      const choice = page.getByRole("button", { name: "Not today" });
      const accept = page.getByRole("button", { name: "Accept", exact: true });
      const ready = await choice.or(accept).first().waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
      if (!ready) {
        const failure = (await alertText(page)) || "Plan my day did not show accept or Not today";
        await record(page, { feature, pr: "#644", route, status: "broken", error: failure }, watch);
        return;
      }
      if ((await choice.count()) > 0) await choice.click();
      else await accept.click();
      await record(page, { feature, pr: "#644", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#644", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Coach crisis card", async ({ page }) => {
    const watch = attach(page);
    const feature = "Coach crisis card";
    const route = "/coach";
    try {
      const kind = await gate(page, route, page.getByLabel("Message"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#647", route, ...blocked }, watch);
        return;
      }
      const crisisInput = page.getByLabel("Message");
      const crisisReady = await crisisInput.isEnabled().catch(() => false);
      if (!crisisReady) {
        await expect(crisisInput).toBeEnabled({ timeout: 8_000 }).catch(() => undefined);
      }
      if (!(await crisisInput.isEnabled().catch(() => false))) {
        await record(page, {
          feature,
          pr: "#647",
          route,
          status: "broken",
          error: "message input stayed disabled",
        }, watch);
        return;
      }
      await crisisInput.fill(CRISIS_PHRASE);
      await page.getByRole("button", { name: "Send" }).click();
      const card = page.getByText(CRISIS_TITLE);
      const fallback = page.getByText("Help is available");
      const seen = await card.or(fallback).first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      if (!seen) {
        await record(page, {
          feature,
          pr: "#647",
          route,
          status: "not-wired",
          error: "crisis phrase was sent in chat and the fixed resources card did not appear",
        }, watch);
        return;
      }
      await record(page, { feature, pr: "#647", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#647", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Coach chat send and reload", async ({ page }) => {
    test.setTimeout(90_000);
    const watch = attach(page);
    const feature = "Coach chat send and reload";
    const route = "/coach";
    const prompt = `One small step ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "Coach" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "old", route, ...blocked }, watch);
        return;
      }
      const input = page.getByLabel("Message");
      const inputReady = await expect(input).toBeEnabled({ timeout: 8_000 }).then(() => true).catch(() => false);
      if (!inputReady) {
        await record(page, { feature, pr: "old", route, status: "broken", error: "message input stayed disabled" }, watch);
        return;
      }
      const before = await page.locator('[data-role="assistant"]').count();
      await input.fill(prompt);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByText(prompt)).toBeVisible({ timeout: 10_000 });
      const reply = await page
        .locator('[data-role="assistant"]')
        .nth(before)
        .waitFor({ timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      if (!reply) {
        const failure = (await alertText(page)) || "no assistant reply";
        await record(page, { feature, pr: "old", route, status: "broken", error: failure }, watch);
        return;
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(prompt)).toBeVisible({ timeout: 10_000 });
      await record(page, { feature, pr: "old", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "old", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Nag list", async ({ page }) => {
    const watch = attach(page);
    const feature = "Nag list";
    const route = "/settings/nags";
    const label = `Stretch nag ${runId}`;
    try {
      const kind = await gate(page, route, page.locator("#nag-new-label"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#652", route, ...blocked }, watch);
        return;
      }
      await page.locator("#nag-new-label").fill(label);
      await page.getByRole("button", { name: "Add nag" }).click();
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
      const toggle = page.getByRole("switch", { name: `${label} on` });
      await expect(toggle).toBeDisabled();
      await expect(page.getByText("Add a phrase in your own words to switch this on.")).toBeVisible();
      await record(page, { feature, pr: "#652", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#652", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Nag phrases", async ({ page }) => {
    test.setTimeout(90_000);
    const watch = attach(page);
    const feature = "Nag phrases and suggestions";
    const route = "/settings/nags";
    const phrase = `in my own words ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "Nags" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#654", route, ...blocked }, watch);
        return;
      }
      const edit = page.getByRole("button", { name: "Edit phrases" }).first();
      if ((await edit.count()) > 0) await edit.click();
      const field = page.getByPlaceholder("In your own words");
      if ((await field.count()) === 0) {
        await record(page, { feature, pr: "#654", route, status: "not-wired", error: "phrase editor controls absent" }, watch);
        return;
      }
      await field.fill(phrase);
      await page.getByRole("button", { name: "Add phrase" }).click();
      await expect(page.getByText(phrase)).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Suggest from my words" }).click();
      await page.waitForTimeout(8_000);
      const failure = await alertText(page);
      await record(page, {
        feature,
        pr: "#654",
        route,
        status: failure ? "broken" : "works",
        error: failure,
      }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#654", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Memory settings", async ({ page }) => {
    const watch = attach(page);
    const feature = "Memory settings";
    const route = "/settings/memory";
    const memory = `Prefers short lists ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "What Tempo remembers" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#653", route, ...blocked }, watch);
        return;
      }
      const toggle = page.getByRole("switch").first();
      if ((await toggle.count()) > 0) {
        const before = await toggle.getAttribute("aria-checked");
        await toggle.click();
        await page.reload({ waitUntil: "domcontentloaded" });
        const after = await page.getByRole("switch").first().getAttribute("aria-checked");
        if (before === after) {
          await record(page, { feature, pr: "#653", route, status: "broken", error: "switch did not persist" }, watch);
          return;
        }
        await record(page, { feature, pr: "#653", route, status: "works", error: "" }, watch);
        return;
      }
      await page.locator("#memory-new").fill(memory);
      await page.getByRole("button", { name: "Remember this" }).click();
      await expect(page.getByText(memory)).toBeVisible({ timeout: 10_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(memory)).toBeVisible({ timeout: 10_000 });
      await record(page, {
        feature,
        pr: "#653",
        route,
        status: "works",
        error: "no toggle on the page; a saved memory survived reload",
      }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#653", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("TemplatesLibrary", async ({ page }) => {
    const watch = attach(page);
    const feature = "TemplatesLibrary";
    const route = "/templates";
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "Templates" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#602", route, ...blocked }, watch);
        return;
      }
      const use = page.getByRole("link", { name: /^Use / }).first();
      await expect(use).toBeVisible({ timeout: 10_000 });
      await record(page, { feature, pr: "#602", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#602", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("TemplateRun", async ({ page }) => {
    const watch = attach(page);
    const feature = "TemplateRun";
    const route = "/templates/run/starter:daily-page";
    try {
      const kind = await gate(page, route, page.getByRole("region", { name: "Preview" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#604", route, ...blocked }, watch);
        return;
      }
      const reason = page.locator("p").filter({ hasText: /.+/ }).first();
      if ((await reason.count()) === 0) {
        await record(page, { feature, pr: "#604", route, status: "broken", error: "preview present but no proposal reason text" }, watch);
        return;
      }
      await record(page, { feature, pr: "#604", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#604", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Template builder and editor", async ({ page }) => {
    const watch = attach(page);
    const feature = "Template builder and editor";
    const route = "/templates/builder?from=starter:daily-page";
    try {
      const kind = await gate(page, route, page.locator("#template-name"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#628", route, ...blocked }, watch);
        return;
      }
      const name = page.locator("#template-name");
      const prefilled = await name.inputValue();
      await name.fill("");
      const save = page.getByRole("button", { name: "Save" });
      await expect(save).toBeDisabled();
      if (!prefilled.trim()) {
        await record(page, { feature, pr: "#628", route, status: "broken", error: "Save disabled on empty name, but the name was not prefilled" }, watch);
        return;
      }
      await record(page, { feature, pr: "#628", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#628", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Onboarding name step", async ({ page }) => {
    const watch = attach(page);
    const feature = "Onboarding name step";
    const route = "/onboarding";
    try {
      const status = await open(page, route);
      if (await signedOut(page)) {
        await record(page, { feature, pr: "#631", route, status: "broken", error: "sign-in wall still showing" }, watch);
        return;
      }
      if (new URL(page.url()).pathname === "/today") {
        await record(page, {
          feature,
          pr: "#631",
          route,
          status: "broken",
          error: "redirected to /today before the name step",
        }, watch);
        return;
      }
      if (await isScaffold(page) || (await isNotFound(page, status))) {
        await record(page, { feature, pr: "#631", route, status: "not-wired", error: await isScaffold(page) ? "ScaffoldScreen (Beta preview)" : "route 404" }, watch);
        return;
      }
      const name = page.locator("#onboarding-name");
      if ((await name.count()) === 0) {
        await record(page, { feature, pr: "#631", route, status: "not-wired", error: "name field absent" }, watch);
        return;
      }
      await name.fill(`Ada ${runId}`);
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Finish" }).click();
      await page.waitForURL((url) => url.pathname === "/today", { timeout: 15_000 });
      await record(page, { feature, pr: "#631", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#631", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Profile name and delete guard", async ({ page }) => {
    const watch = attach(page);
    const feature = "Profile name and delete guard";
    const route = "/settings/profile";
    const fullName = `Ada ${runId}`;
    try {
      const kind = await gate(page, route, page.locator("#profile-name"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#636", route, ...blocked }, watch);
        return;
      }
      await page.locator("#profile-name").fill(fullName);
      await page.getByRole("button", { name: "Save" }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#profile-name")).toHaveValue(fullName, { timeout: 10_000 });
      const destroy = page.getByRole("button", { name: "Delete account" });
      if ((await destroy.count()) === 0) {
        await record(page, { feature, pr: "#636", route, status: "broken", error: "name persisted but Delete account is absent" }, watch);
        return;
      }
      await expect(destroy).toBeDisabled();
      await page.locator("#delete-account-confirm").fill("DELETE");
      await expect(destroy).toBeEnabled();
      await page.goto("/today", { waitUntil: "domcontentloaded" });
      const body = await page.locator("body").innerText();
      if (/\bUser\b/.test(body) && !body.includes(fullName)) {
        await record(page, { feature, pr: "#636", route, status: "broken", error: 'greeting rendered "User"' }, watch);
        return;
      }
      await record(page, { feature, pr: "#636", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#636", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Preferences and notifications", async ({ page }) => {
    const watch = attach(page);
    const feature = "Preferences and notifications";
    const route = "/settings/preferences";
    try {
      const kind = await gate(page, route, page.locator("#pref-email-reminders"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#640", route, ...blocked }, watch);
        return;
      }
      const box = page.locator("#pref-email-reminders");
      const before = await box.isChecked();
      await box.setChecked(!before);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#pref-email-reminders")).toBeChecked({ checked: !before, timeout: 10_000 });
      await box.setChecked(before);
      const notesKind = await gate(page, "/notifications", page.getByRole("button", { name: "Mark all read" }));
      const notesBlocked = gateStatus(notesKind);
      if (notesBlocked) {
        await record(page, { feature, pr: "#640", route: "/notifications", ...notesBlocked }, watch);
        return;
      }
      const mark = page.getByRole("button", { name: "Mark all read" });
      if (await mark.isEnabled()) await mark.click();
      await record(page, { feature, pr: "#640", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#640", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Billing plan card", async ({ page }) => {
    const watch = attach(page);
    const feature = "Billing plan card";
    const route = "/billing";
    try {
      const kind = await gate(page, route, page.getByRole("region", { name: "Current plan" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#648", route, ...blocked }, watch);
        return;
      }
      const checkout = page.getByRole("button", { name: /checkout|upgrade|pay/i });
      const link = page.getByRole("link", { name: /checkout|upgrade|pay/i });
      if ((await checkout.count()) > 0 || (await link.count()) > 0) {
        await record(page, { feature, pr: "#648", route, status: "broken", error: "checkout or upgrade control is visible" }, watch);
        return;
      }
      await record(page, { feature, pr: "#648", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#648", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Search grouped results", async ({ page }) => {
    const watch = attach(page);
    const feature = "Search grouped results";
    const term = `zz${runId}nomatch`;
    const route = `/search?q=${term}`;
    try {
      const kind = await gate(page, route, page.getByLabel("Search notes, tasks, habits and goals"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#649", route, ...blocked }, watch);
        return;
      }
      const none = page.getByText(/No matches/);
      const group = page.getByRole("heading").nth(1);
      const seen = await none.or(group).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      if (!seen) {
        await record(page, { feature, pr: "#649", route, status: "broken", error: "neither grouped sections nor No matches appeared" }, watch);
        return;
      }
      await record(page, { feature, pr: "#649", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#649", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Calendar events", async ({ page }) => {
    const watch = attach(page);
    const feature = "Calendar events";
    const route = "/calendar";
    const title = `Call ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("button", { name: "Add event" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#663", route, ...blocked }, watch);
        return;
      }
      await page.getByPlaceholder("Planning call").fill(title);
      await page.getByRole("button", { name: "Add event" }).click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Week" }).click();
      await expect(page.getByText(title).first()).toBeVisible();
      await page.getByRole("button", { name: "Month" }).click();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await record(page, { feature, pr: "#663", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#663", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Focus blocks", async ({ page }) => {
    const watch = attach(page);
    const feature = "Focus blocks";
    const route = "/tracking";
    const label = `Inbox ${runId}`;
    try {
      const kind = await gate(page, route, page.locator("#session-intention"));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#662", route, ...blocked }, watch);
        return;
      }
      await page.locator("#session-intention").fill(label);
      await page.locator("#session-minutes").fill("10");
      await page.getByRole("button", { name: "Log this block" }).click();
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Remove" }).first().click();
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
      await record(page, { feature, pr: "#662", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#662", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Insights", async ({ page }) => {
    const watch = attach(page);
    const feature = "Insights";
    const route = "/insights";
    try {
      const status = await open(page, route);
      if (await isScaffold(page)) {
        await record(page, { feature, pr: "#664", route, status: "not-wired", error: "ScaffoldScreen (Beta preview)" }, watch);
        return;
      }
      if (await isNotFound(page, status)) {
        await record(page, { feature, pr: "#664", route, status: "not-wired", error: "route 404" }, watch);
        return;
      }
      const retry = page.getByRole("button", { name: "Retry" });
      const settled = page.getByText(/\d|Nothing tracked|not enough|No insights yet/i);
      const seen = await settled.or(retry).first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      const pulses = await page.locator(".animate-pulse").count();
      if (!seen || pulses > 2) {
        await record(page, {
          feature,
          pr: "#664",
          route,
          status: "broken",
          error: "still on a skeleton after 10s",
        }, watch);
        return;
      }
      await record(page, { feature, pr: "#664", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#664", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });

  test("Notes list", async ({ page }) => {
    const watch = attach(page);
    const feature = "Notes list";
    const route = "/notes";
    const title = `Note ${runId}`;
    try {
      const kind = await gate(page, route, page.getByRole("heading", { name: "Notes" }));
      const blocked = gateStatus(kind);
      if (blocked) {
        await record(page, { feature, pr: "#670", route, ...blocked }, watch);
        return;
      }
      await page.getByPlaceholder("Untitled note").fill(title);
      await page.getByRole("button", { name: "New note" }).click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: `Pin ${title}` }).click();
      await expect(page.getByRole("button", { name: `Unpin ${title}` })).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await page.getByRole("button", { name: `Confirm delete ${title}` }).click();
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
      await record(page, { feature, pr: "#670", route, status: "works", error: "" }, watch);
    } catch (error) {
      await record(page, { feature, pr: "#670", route, status: "broken", error: redact(String(error)) }, watch);
    }
  });
});

const SMOKE_ROUTES = [
  "/tasks",
  "/tasks/energy",
  "/tasks/checklists",
  "/tasks/priority",
  "/journal",
  "/routines",
  "/routines/missing-sweep-id",
  "/goals",
  "/goals/progress",
  "/goals/missing-sweep-id",
  "/projects",
  "/projects/missing-sweep-id",
  "/projects/missing-sweep-id/kanban",
  "/activity",
  "/history",
  "/command",
  "/ask-founder",
  "/empty-states",
  "/daily-note",
  "/settings/integrations",
  "/settings/passkeys",
  "/templates/sketch",
  "/billing/trial-end",
  "/dashboard",
  "/about",
  "/changelog",
  "/contact",
  "/privacy",
  "/terms",
];

test.describe("other routes smoke", () => {
  test.describe.configure({ timeout: 45_000 });

  test.beforeEach(() => {
    test.skip(!enabled, "needs PLAYWRIGHT_BASE_URL and TEMPO_E2E_STORAGE_STATE");
  });

  for (const route of SMOKE_ROUTES) {
    test(`smoke ${route}`, async ({ page }) => {
      const watch = attach(page);
      const feature = `smoke ${route}`;
      try {
        const status = await open(page, route);
        if (await signedOut(page)) {
          await record(page, { feature, pr: "smoke", route, status: "broken", error: "sign-in wall still showing" }, watch);
          return;
        }
        if (await isNotFound(page, status)) {
          await record(page, { feature, pr: "smoke", route, status: "not-wired", error: "route 404" }, watch);
          return;
        }
        if (await isScaffold(page)) {
          await record(page, { feature, pr: "smoke", route, status: "not-wired", error: "ScaffoldScreen (Beta preview)" }, watch);
          return;
        }
        const problem = notes(watch);
        await record(page, {
          feature,
          pr: "smoke",
          route,
          status: problem ? "broken" : "works",
          error: problem,
        }, watch);
      } catch (error) {
        await record(page, { feature, pr: "smoke", route, status: "broken", error: redact(String(error)) }, watch);
      }
    });
  }
});
