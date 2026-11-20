// Shared helpers for the weekend alpha loop scripts (docs/sprint/RUN-LOG.md).
// Each loop script runs one pass against preview and exits:
//   0 PASS, 1 FAIL, 2 BLOCKED_VERIFICATION (no usable signed-in, approved session).
// Session: ALPHA_STORAGE_STATE (a Playwright storage-state file for a synthetic test account),
// otherwise a "Continue as guest" control on /sign-in. Real accounts are never used.
import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// NETWORK: the run failed and a request never got an answer from the server (the sandbox's
// connection dropped), so the run says nothing about the app. run.mjs repeats such an attempt.
export const EXIT = { PASS: 0, FAIL: 1, BLOCKED_VERIFICATION: 2, NETWORK: 3 };
export const BASE_URL = (process.env.ALPHA_BASE_URL || "https://preview.tempoflow.dev").replace(/\/$/, "");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = process.env.ALPHA_OUT || path.join(HERE, "out");

/** A one-off marker that never collides with an earlier run's data. */
export function marker(prefix) {
  return `${prefix} ${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

class LoopStop extends Error {
  constructor(code, reason, { control = false } = {}) {
    super(reason);
    this.code = code;
    this.control = control;
  }
}

export const blocked = (reason) => new LoopStop(EXIT.BLOCKED_VERIFICATION, reason);
export const fail = (reason) => new LoopStop(EXIT.FAIL, reason);
/** A failed safety or outcome check (crisis, Undo): always FAIL, even when requests were dropped. */
export const controlFail = (reason) => new LoopStop(EXIT.FAIL, reason, { control: true });

export async function launch() {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  return chromium.launch({ executablePath: process.env.ALPHA_CHROMIUM || undefined, proxy });
}

export async function newContext(browser, storageState, options = {}) {
  const context = await browser.newContext({ storageState, viewport: { width: 1280, height: 900 }, ...options });
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) {
    // The preview-protection header goes to the preview's own origin only, never to Convex,
    // fonts or any other host the page calls.
    const origin = new URL(BASE_URL).origin;
    await context.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin) return route.continue();
      return route.continue({ headers: { ...request.headers(), "x-vercel-protection-bypass": bypass } });
    });
  }
  return context;
}

/**
 * Writes the context's session back to ALPHA_STORAGE_STATE (mode 0600). Convex Auth rotates the
 * refresh token whenever a page loads, so the next run must start from the newest one: replaying
 * an older token signs the session out. Written to a temp file and renamed, never half-written.
 */
export async function saveState(context) {
  const statePath = process.env.ALPHA_STORAGE_STATE;
  if (!statePath) return;
  const state = await context.storageState();
  const temp = `${statePath}.tmp-${process.pid}`;
  writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, statePath);
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
async function signedInContext(browser, shot, network) {
  const statePath = process.env.ALPHA_STORAGE_STATE;
  if (statePath) {
    if (!existsSync(statePath)) throw blocked(`ALPHA_STORAGE_STATE does not exist: ${statePath}`);
    const context = await newContext(browser, statePath);
    watchNetwork(context, network);
    return context;
  }
  const context = await newContext(browser, undefined);
  // Watched from the start, so a drop during the guest sign-in counts too.
  watchNetwork(context, network);
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

// Connection-level errors: the request never reached the server, or its answer never came back
// whole (cut off after the headers: a short body, a broken chunked stream, an HTTP/2 or QUIC error).
const DROPPED =
  /^net::ERR_(TIMED_OUT|CONNECTION_\w+|TUNNEL_CONNECTION_FAILED|PROXY_\w+|SSL_\w+|EMPTY_RESPONSE|SOCKET_\w+|NETWORK_\w+|NAME_NOT_RESOLVED|ADDRESS_UNREACHABLE|CONTENT_LENGTH_MISMATCH|INCOMPLETE_CHUNKED_ENCODING|HTTP2_\w+|QUIC_PROTOCOL_ERROR)$/;

/** The hosts a loop depends on: the app and its Convex deployment. Other hosts' drops don't count. */
function ownHost(url) {
  try {
    const { host } = new URL(url);
    return host === new URL(BASE_URL).host || host.endsWith(".convex.cloud") || host.endsWith(".convex.site");
  } catch {
    return false;
  }
}

/**
 * Records requests the network dropped, as "<what> <path>": a connection-level failure on the
 * app's or Convex's host, or a 5xx for the app that no Vercel server sent (no `x-vercel-id`: the
 * sandbox proxy's own "upstream request failed"). A 5xx from Vercel itself is the app's and is not
 * recorded, and neither is a drop on any other host, so it can't turn a real failure into NETWORK.
 * `context` can also be a single page (the sweep watches each render on its own).
 */
export function watchNetwork(context, into) {
  const where = (url) => url.replace(/\?.*$/, "").replace(BASE_URL, "");
  context.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "";
    if (DROPPED.test(error) && ownHost(request.url())) into.push(`${error} ${where(request.url())}`);
  });
  context.on("response", (response) => {
    if (response.status() >= 500 && response.url().startsWith(BASE_URL) && !response.headers()["x-vercel-id"]) {
      into.push(`HTTP ${response.status()} from the proxy, not Vercel: ${where(response.url())}`);
    }
  });
}

/** Fails unless `locator` becomes visible within `ms`. */
export async function expectVisible(locator, what, ms = 30_000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout: ms });
  } catch {
    throw fail(`not visible after ${Math.round(ms / 1000)} s: ${what}`);
  }
}

/**
 * Completes this script family's own open tasks ("Alpha …" markers) on Today. Today's list shows
 * only 3 open tasks, so leftovers from earlier passes would hide a new one. Other tasks are left alone.
 */
export async function completeAlphaTasks(page) {
  const list = page.locator('[aria-labelledby="today-task-list-heading"]');
  for (let i = 0; i < 30; i += 1) {
    const open = list.getByRole("button", { name: /^Mark Alpha L\d .* complete$/ });
    if ((await open.count()) === 0) return;
    const name = await open.first().getAttribute("aria-label");
    await open.first().click();
    await list.getByRole("button", { name, exact: true }).waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  }
  throw fail("more than 30 open Alpha tasks on Today");
}

/**
 * Completes every open task on the task list (/tasks, which shows all of them) whose "Mark …
 * complete" button matches `name`, then fails setup if any is left: a run that starts on an earlier
 * run's leftovers doesn't test the same thing.
 */
export async function completeOpenTasks(page, name, what) {
  await page.goto(`${BASE_URL}/tasks`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  await expectVisible(page.getByRole("heading", { name: "Inbox" }), "the task list", 45_000);
  // The heading comes before the tasks: wait for the first row (the shared account always has some).
  await page.getByRole("button", { name: /^Mark .* (complete|not done)$/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
  const open = page.getByRole("button", { name });
  for (let i = 0; i < 60 && (await open.count()) > 0; i += 1) {
    const label = await open.first().getAttribute("aria-label");
    await open.first().click();
    await page.getByRole("button", { name: label, exact: true }).first().waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  }
  const left = await open.count();
  if (left > 0) throw fail(`${left} ${what} still open after cleanup`);
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
  if (replyCalls.length > 0) throw controlFail(`the crisis message sent ${replyCalls.length} coach:reply call(s)`);
  if (await page.locator('[data-component="CoachTyping"]').isVisible()) {
    throw controlFail("the coach shows a typing state after a crisis message");
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
  let control = false;
  let context = null;
  let page = null;
  const network = [];
  try {
    context = await signedInContext(browser, async (p, name) => shot(p, name), network);
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    // A cold preview function or a slow network can take longer than an element wait to load a page.
    page.setDefaultNavigationTimeout(60_000);
    await steps(page, shot);
    if (crisis) await crisisCheck(page, shot);
  } catch (error) {
    code = error instanceof LoopStop ? error.code : EXIT.FAIL;
    control = error instanceof LoopStop && error.control;
    reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    // What the screen showed when the run stopped.
    if (page) await shot(page, "stopped").catch(() => {});
  } finally {
    // This browser already rotated the refresh token: a state that isn't saved signs the next run
    // out, so a failed save fails a run that would otherwise pass.
    if (context && process.env.ALPHA_STORAGE_STATE) {
      try {
        await saveState(context);
      } catch (error) {
        if (code === EXIT.PASS) {
          code = EXIT.FAIL;
          reason = `could not save the session state: ${String(error?.message ?? error).split("\n")[0]}`;
        }
      }
    }
    await browser.close();
  }
  // A failure that comes with dropped requests can't be told apart from the drop: NETWORK, not FAIL.
  // A failed crisis or Undo check stays FAIL: it is never repeated away.
  if (code === EXIT.FAIL && !control && network.length > 0) {
    code = EXIT.NETWORK;
    reason = `${reason} [sandbox network: ${network[0]}${network.length > 1 ? ` and ${network.length - 1} more` : ""}]`;
  }
  const result = Object.entries(EXIT).find(([, v]) => v === code)?.[0] ?? "FAIL";
  const record = {
    loop: id,
    title,
    result,
    reason,
    base: BASE_URL,
    at: new Date().toISOString(),
    screenshots: shots,
    network: network.slice(0, 20),
  };
  writeFileSync(path.join(runDir, "result.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${id} ${result}${reason ? `: ${reason}` : ""} (screenshots: ${path.relative(process.cwd(), runDir)})`);
  process.exit(code);
}
