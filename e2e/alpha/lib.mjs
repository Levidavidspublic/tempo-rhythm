// Shared helpers for the weekend alpha loop scripts (docs/sprint/RUN-LOG.md).
// Each loop script runs one pass against preview and exits:
//   0 PASS, 1 FAIL, 2 BLOCKED_VERIFICATION (no usable signed-in, approved session).
// Session: ALPHA_STORAGE_STATE (a Playwright storage-state file for a synthetic test account),
// otherwise a "Continue as guest" control on /sign-in. Real accounts are never used.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

export const EXIT = { PASS: 0, FAIL: 1, BLOCKED_VERIFICATION: 2 };
export const BASE_URL = (process.env.ALPHA_BASE_URL || "https://preview.tempoflow.dev").replace(/\/$/, "");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = process.env.ALPHA_OUT || path.join(HERE, "out");

/** A one-off marker that never collides with an earlier run's data. */
export function marker(prefix) {
  return `${prefix} ${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

class LoopStop extends Error {
  constructor(code, reason) {
    super(reason);
    this.code = code;
  }
}

export const blocked = (reason) => new LoopStop(EXIT.BLOCKED_VERIFICATION, reason);
export const fail = (reason) => new LoopStop(EXIT.FAIL, reason);

async function launch() {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  return chromium.launch({ executablePath: process.env.ALPHA_CHROMIUM || undefined, proxy });
}

async function newContext(browser, storageState) {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return browser.newContext({
    storageState,
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  });
}

/** Stops with BLOCKED_VERIFICATION when the page is the sign-in form or the approval wait. */
export async function assertSignedIn(page) {
  const waiting = page.getByTestId("approval-waiting");
  const signInForm = page.getByRole("button", { name: /send magic link/i });
  const app = page.locator("main, [data-component]").first();
  await app.waitFor({ timeout: 30_000 });
  // The approval gate shows a busy placeholder until the account's status is known.
  await page.getByTestId("approval-loading").waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
  if (await waiting.isVisible()) throw blocked("the account is waiting for approval (docs/ops/APPROVAL-GATE.md)");
  if (new URL(page.url()).pathname.startsWith("/sign-in") || (await signInForm.isVisible())) {
    throw blocked("the session was not accepted: preview shows the sign-in form");
  }
}

/**
 * A browser context with a signed-in session. Order: ALPHA_STORAGE_STATE, then a guest control
 * on /sign-in. Neither -> BLOCKED_VERIFICATION, since preview's only other sign-in is a magic link.
 */
async function signedInContext(browser, shot) {
  const statePath = process.env.ALPHA_STORAGE_STATE;
  if (statePath) {
    if (!existsSync(statePath)) throw blocked(`ALPHA_STORAGE_STATE does not exist: ${statePath}`);
    return newContext(browser, statePath);
  }
  const context = await newContext(browser, undefined);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /send magic link/i }).waitFor({ timeout: 30_000 });
  const guest = page.getByRole("button", { name: /guest/i }).or(page.getByRole("link", { name: /guest/i }));
  await shot(page, "sign-in");
  if ((await guest.count()) === 0) {
    throw blocked(`no guest or test sign-in on ${BASE_URL}/sign-in (magic link only), and ALPHA_STORAGE_STATE is not set`);
  }
  await guest.first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 60_000 });
  await page.close();
  return context;
}

/** Fails unless `locator` becomes visible within `ms`. */
export async function expectVisible(locator, what, ms = 30_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: ms });
  } catch {
    throw fail(`not visible after ${Math.round(ms / 1000)} s: ${what}`);
  }
}

/** The "Saved" status of the page editor (PageEditorView). */
export async function waitForPageSaved(page) {
  await expectVisible(page.getByText("Saved", { exact: true }), "the page's Saved status", 30_000);
}

/** Sends one message from the coach composer on the current page. */
export async function sendCoachMessage(page, text) {
  const box = page.getByRole("textbox", { name: "Message" });
  await expectVisible(box, "the coach message box");
  await page.waitForFunction(() => {
    const el = document.querySelector("textarea.tp-composer__input");
    return el instanceof HTMLTextAreaElement && !el.disabled;
  }, undefined, { timeout: 30_000 });
  await box.fill(text);
  await box.press("Enter");
}

/**
 * Crisis check, run once per loop run: a crisis-style message shows the fixed crisis card and the
 * browser sends no `coach:reply` action (the only client path to the model).
 */
export async function crisisCheck(page, shot) {
  const sentFrames = [];
  const onSocket = (ws) => ws.on("framesent", (frame) => sentFrames.push(String(frame.payload)));
  page.on("websocket", onSocket);
  await page.goto(`${BASE_URL}/coach`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const before = sentFrames.length;
  await sendCoachMessage(page, "I don't want to be here anymore. I want to end my life.");
  await expectVisible(page.getByTestId("coach-crisis-resources"), "the fixed crisis card", 20_000);
  await shot(page, "crisis-card");
  // Give a wrongly scheduled reply time to start, then check the frames sent after the message.
  await page.waitForTimeout(5_000);
  const replyCalls = sentFrames.slice(before).filter((f) => f.includes("coach:reply"));
  page.off("websocket", onSocket);
  if (replyCalls.length > 0) throw fail(`the crisis message sent ${replyCalls.length} coach:reply call(s)`);
  if (await page.locator('[data-component="CoachTyping"]').isVisible()) {
    throw fail("the coach shows a typing state after a crisis message");
  }
}

/**
 * Runs one loop pass: `steps(page, shot)` does the loop; the crisis check runs after it.
 * Prints one result line and exits with the EXIT code.
 */
export async function runLoop(id, title, steps, { crisis = true } = {}) {
  const runDir = path.join(OUT_ROOT, id, new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(runDir, { recursive: true });
  let n = 0;
  const shots = [];
  const shot = async (page, name) => {
    n += 1;
    const file = path.join(runDir, `${String(n).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    shots.push(path.relative(OUT_ROOT, file));
  };
  const browser = await launch();
  let code = EXIT.PASS;
  let reason = "";
  try {
    const context = await signedInContext(browser, async (page, name) => shot(page, name));
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await steps(page, shot);
    if (crisis) await crisisCheck(page, shot);
  } catch (error) {
    code = error instanceof LoopStop ? error.code : EXIT.FAIL;
    reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
  } finally {
    await browser.close();
  }
  const result = Object.entries(EXIT).find(([, v]) => v === code)?.[0] ?? "FAIL";
  const record = { loop: id, title, result, reason, base: BASE_URL, at: new Date().toISOString(), screenshots: shots };
  writeFileSync(path.join(runDir, "result.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${id} ${result}${reason ? `: ${reason}` : ""} (screenshots: ${path.relative(process.cwd(), runDir)})`);
  process.exit(code);
}
