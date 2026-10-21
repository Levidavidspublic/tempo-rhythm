import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test as unitTest } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { en, he, kb67t } from "../../apps/web/lib/i18n-groups/kb-67";

const root = join(import.meta.dir, "../..");
const web = join(root, "apps/web");
const fixtureChild = process.env.KB67_FIXTURE_CHILD === "1";
const resultMarker = "KB67_FIXTURE_RESULTS=";
const runToken = fixtureChild ? process.env.KB67_FIXTURE_TOKEN! : crypto.randomUUID();
type CaseResult = { pass: true } | { pass: false; error: string };
type FixtureResults = { token: string; cases: Record<string, CaseResult>; cleanupComplete: boolean };
type ChildRun = { code: number; out: string; err: string };
const caseResults: Record<string, CaseResult> = {};
const caseNames: string[] = [];
let cleanupComplete = false;
let temp = "";
setDefaultTimeout(60_000);
let browser: Browser | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let beforeJs: string | null = null;
let beforeCss = "";
// Build, server, Playwright and production imports belong to a clean process, outside suite mocks.
const { chromium, expect: pwExpect } = fixtureChild
  ? await import("@playwright/test")
  : {} as typeof import("@playwright/test");

async function releaseFixture(
  stopServer: () => unknown,
  closeBrowser: () => unknown,
  removeDirectory: () => unknown
): Promise<void> {
  // Start every release independently: a stuck/rejected browser close cannot block server/temp cleanup.
  const releases = await Promise.allSettled(
    [stopServer, closeBrowser, removeDirectory].map((release) => Promise.resolve().then(release))
  );
  const errors = releases.flatMap((release) => release.status === "rejected" ? [release.reason] : []);
  if (errors.length) throw new AggregateError(errors, "KB-67 fixture cleanup failed");
}

function resultsFrom(run: ChildRun, token: string): FixtureResults {
  const records = run.out.split("\n").filter((line) => line.startsWith(resultMarker));
  if (records.length !== 1) throw new Error(`KB-67 child returned ${records.length} result records`);
  const results = JSON.parse(records[0].slice(resultMarker.length)) as FixtureResults;
  if (results.token !== token) throw new Error("KB-67 child returned results from another invocation");
  return results;
}

function passedByRunner(run: ChildRun, name: string): boolean {
  const title = ` > ${name}`;
  return run.err.replace(/\u001b\[[0-9;]*m/g, "").split("\n").some((line) =>
    line.startsWith("(pass) ") && (line.endsWith(title) || line.includes(`${title} [`))
  );
}

function requireSuccessfulExit(run: ChildRun, results: FixtureResults, names: string[]): void {
  if (run.code !== 0) throw new Error(`KB-67 isolated fixture exited ${run.code}:\n${run.err.slice(-12000)}`);
  if (!results.cleanupComplete) throw new Error("KB-67 child exited without completing cleanup");
  expect(Object.keys(results.cases).sort()).toEqual([...names].sort());
  for (const name of names) {
    expect(results.cases[name]).toEqual({ pass: true });
    expect(passedByRunner(run, name)).toBe(true);
  }
}

// Original deadlines remain authoritative inside Bun's child runner. Awaiting it at module load
// adds no larger aggregate deadline and does not turn a failed hook into a successful fixture.
let childRun: ChildRun | undefined;
let childResults: FixtureResults | undefined;
let resultError: unknown;
if (!fixtureChild) {
  const child = Bun.spawn([process.execPath, "test", import.meta.path], {
    cwd: root,
    env: { ...process.env, KB67_FIXTURE_CHILD: "1", KB67_FIXTURE_TOKEN: runToken },
    stdout: "pipe", stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  childRun = { code, out, err };
  try { childResults = resultsFrom(childRun, runToken); } catch (error) { resultError = error; }
  console.info(`KB-67 isolated child exit ${code}; ${Object.keys(childResults?.cases ?? {}).length} named results; cleanup ${childResults?.cleanupComplete ?? false}`);
  console.info(`KB-67 child assertion summary:\n${err.trim().split("\n").slice(-5).join("\n")}`);
}

function test(name: string, run: () => unknown | Promise<unknown>, timeout?: number): void {
  caseNames.push(name);
  unitTest(name, async () => {
    if (!fixtureChild) {
      if (resultError) throw resultError;
      const result = childResults?.cases[name];
      if (result?.pass === false) throw new Error(`KB-67 child case failed: ${result.error}`);
      if (!childRun || !passedByRunner(childRun, name))
        throw new Error(`KB-67 child runner did not pass ${name}:\n${childRun?.err.slice(-12000) ?? "missing child"}`);
      expect(result).toEqual({ pass: true });
      return;
    }
    try {
      await run();
      caseResults[name] = { pass: true };
    } catch (error) {
      caseResults[name] = { pass: false, error: error instanceof Error ? error.stack ?? error.message : String(error) };
      throw error;
    }
  }, timeout);
}

const backend = `
import { useSyncExternalStore } from "react";
const listeners = new Set();
let version = 0;
const nagA = { _id: "nag-a", label: "Maya's morning", enabled: true, createdAt: 2, updatedAt: 2,
  phrases: [{ id: "own-a", text: "Take a small stretch break", source: "user", status: "accepted" }] };
const nagB = { _id: "nag-b", label: "Dana's water", enabled: true, createdAt: 1, updatedAt: 1,
  phrases: [{ id: "own-b", text: "Drink a glass of water", source: "user", status: "accepted" }] };
const state = { auth: { isAuthenticated: true, isLoading: false }, profile: { fullName: "Maya Levin", greetingName: "Maya" },
  nags: [nagA, nagB], calls: [], held: [], hold: [], reject: [], proposals: ["Try a gentle stretch", "Pause and breathe"], nextId: 1, queryError: false };
function emit() { version++; for (const fn of listeners) fn(); }
function useStore() { useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version); }
async function waitIfHeld(ref) {
  if (state.reject.includes(ref)) throw new Error("fictional " + ref + " failure");
  if (state.hold.includes(ref)) return await new Promise((resolve, reject) => state.held.push({ ref, resolve, reject }));
  return undefined;
}
window.__kb67 = {
  state,
  setView(view) { state.queryError = view === "error"; state.auth = view === "loading"
    ? { isAuthenticated: false, isLoading: true } : view === "signed-out"
      ? { isAuthenticated: false, isLoading: false } : { isAuthenticated: true, isLoading: false };
    state.nags = view === "empty" ? [] : [nagA, nagB]; emit(); },
  hold(ref) { state.hold.push(ref); },
  reject(ref) { state.reject.push(ref); },
  clearOwn(nagId) { state.nags = state.nags.map(n => n._id === nagId
    ? { ...n, enabled: false, phrases: n.phrases.filter(p => p.source !== "user") } : n); emit(); },
  settle(ref, ok, value) { const index = state.held.findIndex(item => item.ref === ref);
    if (index < 0) throw new Error("No held " + ref); const [item] = state.held.splice(index, 1);
    if (ok) item.resolve(value); else item.reject(new Error("fictional " + ref + " failure")); },
};
export function useConvexAuth() { useStore(); return state.auth; }
export function useQuery(ref, args) { useStore(); if (args === "skip") return undefined;
  if (state.queryError) throw new Error("fictional query error");
  return ref === "users:getProfile" ? state.profile : state.nags; }
export function useMutation(ref) { return async args => {
  state.calls.push({ ref, args }); await waitIfHeld(ref);
  if (ref === "nags:create") { const id = "created-" + state.nextId++; state.nags = [{ _id: id, label: args.label,
    enabled: false, phrases: [], createdAt: 3, updatedAt: 3 }, ...state.nags]; emit(); return id; }
  if (ref === "nags:addPhrase") { const phraseId = "phrase-" + state.nextId++;
    state.nags = state.nags.map(n => n._id === args.nagId ? { ...n, phrases: [...n.phrases,
      { id: phraseId, text: args.text, source: args.source, status: args.source === "user" ? "accepted" : "proposed" }] } : n);
    emit(); return { phraseId }; }
  if (ref === "nags:decidePhrase") { state.nags = state.nags.map(n => n._id === args.nagId ? { ...n,
    phrases: n.phrases.map(p => p.id === args.phraseId ? { ...p, status: args.decision === "accept" ? "accepted" : "rejected" } : p) } : n);
    emit(); return { success: true }; }
  if (ref === "nags:setEnabled") { state.nags = state.nags.map(n => n._id === args.nagId ? { ...n, enabled: args.enabled } : n);
    emit(); return { success: true }; }
  if (ref === "nags:remove") { state.nags = state.nags.filter(n => n._id !== args.nagId); emit(); return { success: true }; }
  throw new Error("Unexpected mutation " + ref);
}; }
export function useAction(ref) { return async args => { state.calls.push({ ref, args });
  const result = await waitIfHeld(ref); return { proposals: result?.proposals ?? state.proposals }; }; }
`;
const api = `export const api = { users: { getProfile: "users:getProfile" }, nags: {
  list: "nags:list", create: "nags:create", addPhrase: "nags:addPhrase", decidePhrase: "nags:decidePhrase",
  setEnabled: "nags:setEnabled", remove: "nags:remove", proposePhrases: "nags:proposePhrases" } };`;
const link = `import React from "react"; export default function Link({ href, children, ...rest }) {
  return React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...rest }, children); }`;
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, useLocale } from "@/components/providers/LocaleProvider";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { NagsScreen, Kb67Gallery } from "@/app/(tempo)/settings/nags/NagsScreen";
function Screen() { const { lang } = useLocale(); return <><TpIconSprite/><main id="main" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}><NagsScreen /></main></>; }
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("app")).render(<LocaleProvider>{params.get("mode") === "gallery" ? <Kb67Gallery /> : <Screen />}</LocaleProvider>);
`;

function html(mode: string, lang: string): string {
  const before = mode === "before";
  return `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--tp-ground);font-family:var(--tp-font-sans)}*{box-sizing:border-box}</style><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/${before ? "before" : "bundle"}.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"test"}}</script><script type="module" src="/${before ? "before" : "bundle"}.js"></script></body></html>`;
}
async function buildFixture() {
  await mkdir(join(root, "work"), { recursive: true });
  temp = await mkdtemp(join(root, "work/kb67-fixture-"));
  await Promise.all([
    writeFile(join(temp, "backend.ts"), backend),
    writeFile(join(temp, "api.ts"), api),
    writeFile(join(temp, "link.ts"), link),
    writeFile(join(temp, "entry.tsx"), entry),
  ]);
  const buildEntry = (path: string) =>
    Bun.build({
      entrypoints: [path],
      target: "browser",
      outdir: temp,
      define: { "process.env.NODE_ENV": '"test"' },
      plugins: [
        {
          name: "kb67-fixture",
          setup(build) {
            build.onResolve(
              {
                filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/,
              },
              ({ path }) => ({ path: Bun.resolveSync(path, web) })
            );
            build.onResolve({ filter: /^(convex\/react|next\/navigation)$/ }, () => ({
              path: join(temp, "backend.ts"),
            }));
            build.onResolve({ filter: /^next\/link$/ }, () => ({
              path: join(temp, "link.ts"),
            }));
            build.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
              path: join(temp, "api.ts"),
            }));
            build.onResolve({ filter: /^@\// }, ({ path }) => ({
              path: Bun.resolveSync(path, web),
            }));
          },
        },
      ],
    });
  const built = await buildEntry(join(temp, "entry.tsx"));
  if (!built.success) throw new Error(built.logs.map(String).join("\n"));
  const js = await built.outputs.find((file) => file.path.endsWith(".js"))?.text();
  if (!js) throw new Error("KB-67 fixture did not bundle JS");
  const bundleCss = (
    await Promise.all(
      built.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text())
    )
  ).join("\n");
  const baseCss = (
    await Promise.all(
      ["docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/v3/you.css"].map(
        (file) => readFile(join(root, file), "utf8")
      )
    )
  )
    .join("\n")
    .replace(/@import url\([^;]+;\s*/g, "");
  const snapshot = join(root, "work/kb67-before-source.tsx");
  if (existsSync(snapshot)) {
    await writeFile(
      join(temp, "before-entry.tsx"),
      `import React from "react"; import {createRoot} from "react-dom/client";
      import {LocaleProvider,useLocale} from "@/components/providers/LocaleProvider";
      import {TpIconSprite} from "@/components/tempo/TpIcon";
      import {NagsScreen} from ${JSON.stringify(snapshot)};
      function Screen(){const {lang}=useLocale();return <><TpIconSprite/><main id="main" lang={lang} dir={lang==="he"?"rtl":"ltr"}><NagsScreen/></main></>}
      createRoot(document.getElementById("app")).render(<LocaleProvider><Screen/></LocaleProvider>);`
    );
    const before = await buildEntry(join(temp, "before-entry.tsx"));
    if (!before.success) throw new Error(before.logs.map(String).join("\n"));
    beforeJs = (await before.outputs.find((file) => file.path.endsWith(".js"))?.text()) ?? null;
    beforeCss = (
      await Promise.all(
        before.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text())
      )
    ).join("\n");
  }
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/bundle.js")
        return new Response(js, {
          headers: { "content-type": "text/javascript" },
        });
      if (url.pathname === "/bundle.css")
        return new Response(bundleCss, {
          headers: { "content-type": "text/css" },
        });
      if (url.pathname === "/before.js")
        return new Response(beforeJs ?? "", {
          headers: { "content-type": "text/javascript" },
        });
      if (url.pathname === "/before.css")
        return new Response(beforeCss, {
          headers: { "content-type": "text/css" },
        });
      if (url.pathname === "/base.css")
        return new Response(baseCss, {
          headers: { "content-type": "text/css" },
        });
      return new Response(
        html(
          url.searchParams.get("mode") ?? "screen",
          url.searchParams.get("lang") === "he" ? "he" : "en"
        ),
        { headers: { "content-type": "text/html" } }
      );
    },
  });
  const browserPath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
  if (!browserPath)
    throw new Error("KB-67 fixture needs installed Playwright Chromium or system Chrome/Chromium");
  browser = await chromium.launch({
    executablePath: browserPath,
    args: ["--no-sandbox"],
  });
}
async function pageFor(
  mode: "screen" | "gallery" | "before" = "screen",
  lang: "en" | "he" = "en",
  width = 390
): Promise<Page> {
  if (!browser || !server) throw new Error("KB-67 fixture is not ready");
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}`);
  try {
    await page.locator("h1").waitFor({ state: "attached", timeout: 10000 });
  } catch {
    throw new Error(
      `KB-67 fixture did not hydrate: ${errors.join(" | ")} ${await page.locator("body").innerText()}`
    );
  }
  return page;
}
const state = (page: Page) =>
  page.evaluate(() => {
    const { calls, nags, held } = (window as any).__kb67.state;
    return { calls, nags, held: held.map((item: any) => item.ref) };
  });
const calls = async (page: Page, ref: string) =>
  (await state(page)).calls.filter((call: any) => call.ref === ref);
const hold = (page: Page, ref: string) =>
  page.evaluate((value) => (window as any).__kb67.hold(value), ref);
const settle = (page: Page, ref: string, ok: boolean, value?: unknown) =>
  page.evaluate(
    (args: [string, boolean, unknown]) => (window as any).__kb67.settle(args[0], args[1], args[2]),
    [ref, ok, value] as [string, boolean, unknown]
  );
const phrase = (page: Page) => page.locator("#ng-add-text");
const select = (page: Page) => page.locator("#ng-add-nag");

// Every browser case mounts the real screen or real gallery views with fictional query/action boundaries.
describe.serial("KB-67 selected-nag phrase editing", () => {
  beforeAll(async () => { if (fixtureChild) await buildFixture(); }, 120_000);
  afterAll(async () => {
    if (!fixtureChild) return;
    await releaseFixture(
      () => server?.stop(true),
      () => browser?.close(),
      () => temp ? rm(temp, { recursive: true, force: true }) : undefined
    );
    cleanupComplete = true;
  });

  test("English and Hebrew keys match and named views mount", async () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    expect(kb67t("he", "phrase.saved", { label: "מאיה" })).toContain("מאיה");
    const page = await pageFor("gallery");
    expect(await page.locator('[data-component="Kb67Gallery"]').count()).toBe(1);
    expect(await page.locator('[data-component="SelectedNagPhraseForm"]').count()).toBe(1);
    await page.getByRole("button", { name: en["gallery.pending"] }).click();
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(1);
    await pwExpect(
      page.locator('[data-component="NagSuggestionNotice"] bdi[dir="auto"]')
    ).toHaveText("Maya's morning");
    await page.getByRole("button", { name: en["gallery.success"] }).click();
    await pwExpect(page.locator('[data-kind="saved"] bdi[dir="auto"]')).toHaveText(
      "Maya's morning"
    );
    await page.close();
  });

  test("mounted ready screen keeps one h1 and one main", async () => {
    const page = await pageFor();
    expect(await page.locator("h1").count()).toBe(1);
    expect(await page.locator("main").count()).toBe(1);
    await pwExpect(page.getByTestId("settings-nags")).toBeVisible();
    await pwExpect(page.locator('[data-component="SelectedNagPhraseForm"]')).toBeVisible();
    await page.close();
  });

  test("loading, signed-out and empty states keep their existing mounts", async () => {
    for (const view of ["loading", "signed-out", "empty"]) {
      const page = await pageFor();
      await page.evaluate((value) => (window as any).__kb67.setView(value), view);
      await pwExpect(
        page.locator(
          view === "loading"
            ? '[data-component="StateLoading"]'
            : view === "signed-out"
              ? '[data-component="StateSignedOut"]'
              : '[data-component="StateEmpty"]'
        )
      ).toBeVisible();
      expect(await page.locator("h1").count()).toBe(1);
      await page.close();
    }
  });

  test("query error retains existing retry state", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb67.setView("error"));
    await pwExpect(page.locator('[data-component="StateError"]')).toBeVisible();
    await pwExpect(page.getByRole("button", { name: /retry/i })).toBeVisible();
    await page.close();
  });

  test("A and B keep separate drafts across A to B to A selection", async () => {
    const page = await pageFor();
    await phrase(page).fill("Maya's words");
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).toHaveValue("");
    await phrase(page).fill("Dana's words");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("Maya's words");
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).toHaveValue("Dana's words");
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    await page.close();
  });

  test("validation stays with the nag and labels the matching field", async () => {
    const page = await pageFor();
    await phrase(page).fill(" ");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await pwExpect(phrase(page)).toHaveAttribute("aria-invalid", "true");
    expect(await phrase(page).getAttribute("aria-describedby")).toContain("ng-add-error");
    await pwExpect(phrase(page)).toBeFocused();
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).not.toHaveAttribute("aria-invalid", "true");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveAttribute("aria-invalid", "true");
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    await page.close();
  });

  test("held A add succeeds without clearing B's newer draft", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await pwExpect(page.getByText(en["phrase.saving"])).toBeVisible();
    await select(page).selectOption("nag-b");
    await phrase(page).fill("Dana phrase");
    await settle(page, "nags:addPhrase", true);
    await pwExpect(phrase(page)).toHaveValue("Dana phrase");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("");
    await pwExpect(page.locator("#ng-add-feedback")).toHaveText(
      kb67t("en", "phrase.saved", { label: "Maya's morning" })
    );
    expect(await calls(page, "nags:addPhrase")).toEqual([
      {
        ref: "nags:addPhrase",
        args: { nagId: "nag-a", text: "Maya phrase", source: "user" },
      },
    ]);
    await page.close();
  });

  test("held A add rejection leaves B text and focus alone", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await select(page).selectOption("nag-b");
    await phrase(page).fill("Dana phrase");
    await settle(page, "nags:addPhrase", false);
    await pwExpect(phrase(page)).toHaveValue("Dana phrase");
    await pwExpect(phrase(page)).toBeFocused();
    expect(await page.getByText(en["phrase.error"]).count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("Maya phrase");
    await pwExpect(page.getByText(en["phrase.error"])).toBeVisible();
    await page.close();
  });

  test("newer same-A words survive earlier successful save", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Earlier words");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await phrase(page).fill("Newer words");
    await pwExpect(page.getByText(en["phrase.savingEarlier"])).toBeVisible();
    await settle(page, "nags:addPhrase", true);
    await pwExpect(phrase(page)).toHaveValue("Newer words");
    await pwExpect(page.locator("#ng-add-feedback")).toHaveCount(0);
    await page.close();
  });

  test("newer same-A words survive earlier rejected save with an attributed earlier-error notice", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Earlier words");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await phrase(page).fill("Newer words");
    await settle(page, "nags:addPhrase", false);
    await pwExpect(phrase(page)).toHaveValue("Newer words");
    expect(await page.getByText(en["phrase.error"]).count()).toBe(0);
    await pwExpect(
      page.getByText(kb67t("en", "phrase.earlierError", { label: "Maya's morning" }))
    ).toBeVisible();
    await pwExpect(phrase(page)).not.toHaveAttribute("aria-invalid", "true");
    await pwExpect(phrase(page)).toBeFocused();
    await page.close();
  });

  test("a failed add does not steal focus after moving to another control on the same nag", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await page.locator("#nag-new-label").focus();
    await pwExpect(page.locator("#nag-new-label")).toBeFocused();
    await settle(page, "nags:addPhrase", false);
    await pwExpect(page.getByText(en["phrase.error"])).toBeVisible();
    await pwExpect(page.locator("#nag-new-label")).toBeFocused();
    await page.close();
  });

  test("a current add failure focuses the matching phrase when focus intent stays", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await settle(page, "nags:addPhrase", false);
    await pwExpect(page.getByText(en["phrase.error"])).toBeVisible();
    await pwExpect(phrase(page)).toBeFocused();
    await page.close();
  });

  test("adding an own phrase clears only that nag's need-own suggestion note", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb67.clearOwn("nag-a"));
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(
      page.getByText("Add a phrase of your own first so suggestions can come from your words.")
    ).toBeVisible();
    await select(page).selectOption("nag-b");
    await page.evaluate(() => (window as any).__kb67.clearOwn("nag-b"));
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(
      page.getByText("Add a phrase of your own first so suggestions can come from your words.")
    ).toBeVisible();
    await select(page).selectOption("nag-a");
    await phrase(page).fill("My words for Maya");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await pwExpect(page.locator('[data-component="NagSuggestionNotice"]')).toHaveCount(0);
    await pwExpect(page.getByRole("switch", { name: /Maya's morning on/i })).toBeEnabled();
    await pwExpect(page.locator('[aria-live="polite"]')).toHaveText(
      kb67t("en", "phrase.canEnable", { label: "Maya's morning" })
    );
    await select(page).selectOption("nag-b");
    await pwExpect(
      page.getByText("Add a phrase of your own first so suggestions can come from your words.")
    ).toBeVisible();
    expect(await calls(page, "nags:proposePhrases")).toHaveLength(0);
    await page.close();
  });

  test("A's first phrase announcement remains attributed to A after selecting B", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb67.clearOwn("nag-a"));
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("My first A phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await select(page).selectOption("nag-b");
    await settle(page, "nags:addPhrase", true);
    await pwExpect(page.locator('[aria-live="polite"]')).toHaveText(
      kb67t("en", "phrase.canEnable", { label: "Maya's morning" })
    );
    await pwExpect(phrase(page)).toHaveValue("");
    await page.close();
  });

  test("held A suggestions settle on A after B is selected", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.locator('[data-component="NagSuggestionNotice"]')).toBeVisible();
    await select(page).selectOption("nag-b");
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await settle(page, "nags:proposePhrases", true, {
      proposals: ["Maya's calm suggestion"],
    });
    await pwExpect(
      page.locator('[aria-labelledby="ng-nag-a-title"]').getByText("Maya's calm suggestion")
    ).toBeVisible();
    expect(
      await page
        .locator('[aria-labelledby="ng-nag-b-title"]')
        .getByText("Maya's calm suggestion")
        .count()
    ).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(page.getByText("Maya's calm suggestion")).toBeVisible();
    expect(await calls(page, "nags:proposePhrases")).toEqual([
      { ref: "nags:proposePhrases", args: { nagId: "nag-a" } },
    ]);
    await page.close();
  });

  test("held A empty suggestion result never appears under B", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await select(page).selectOption("nag-b");
    await settle(page, "nags:proposePhrases", true, { proposals: [] });
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(page.locator('[data-component="NagSuggestionNotice"]')).toBeVisible();
    await page.close();
  });

  test("held A suggestion rejection never accuses B", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await select(page).selectOption("nag-b");
    await settle(page, "nags:proposePhrases", false);
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(
      page.locator('[data-component="NagSuggestionNotice"][role="alert"]')
    ).toBeVisible();
    await page.close();
  });

  test("rapid double Add phrase makes one mutation call", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Only one addition");
    await page.evaluate(() => {
      const form = document.querySelector("#ng-add-text")!.closest("form")!;
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });
    await pwExpect(page.getByRole("button", { name: "Add phrase" })).toBeDisabled();
    expect(await calls(page, "nags:addPhrase")).toHaveLength(1);
    await settle(page, "nags:addPhrase", true);
    await page.close();
  });

  test("rapid double Suggest makes one read-only action call", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) =>
        node.textContent?.includes("Suggest from my words")
      )! as HTMLButtonElement;
      button.click();
      button.click();
    });
    await pwExpect(page.getByRole("button", { name: /suggesting/i })).toBeDisabled();
    expect(await calls(page, "nags:proposePhrases")).toHaveLength(1);
    await settle(page, "nags:proposePhrases", true);
    await page.close();
  });

  test("derived phrase remains unwritten until explicit Accept, then uses two existing calls", async () => {
    const page = await pageFor();
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.getByText("Try a gentle stretch")).toBeVisible();
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    expect(await calls(page, "nags:decidePhrase")).toHaveLength(0);
    await page
      .locator('.tp-list-row[data-status="suggested"]')
      .filter({ hasText: "Try a gentle stretch" })
      .getByRole("button", { name: "Accept" })
      .click();
    await pwExpect(
      page
        .locator('.tp-list-row[data-status="accepted"]')
        .filter({ hasText: "Try a gentle stretch" })
    ).toBeVisible();
    expect(await calls(page, "nags:addPhrase")).toEqual([
      {
        ref: "nags:addPhrase",
        args: {
          nagId: "nag-a",
          text: "Try a gentle stretch",
          source: "derived",
        },
      },
    ]);
    expect(await calls(page, "nags:decidePhrase")).toEqual([
      {
        ref: "nags:decidePhrase",
        args: { nagId: "nag-a", phraseId: "phrase-1", decision: "accept" },
      },
    ]);
    await page.close();
  });

  test("Reject removes a local suggestion without a write", async () => {
    const page = await pageFor();
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.getByText("Try a gentle stretch")).toBeVisible();
    await page
      .locator('.tp-list-row[data-status="suggested"]')
      .filter({ hasText: "Try a gentle stretch" })
      .getByRole("button", { name: "Reject" })
      .click();
    expect(await page.getByText("Try a gentle stretch").count()).toBe(0);
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    expect(await calls(page, "nags:decidePhrase")).toHaveLength(0);
    await page.close();
  });

  test("existing phrase removal still offers five-minute Undo", async () => {
    const page = await pageFor();
    await page.locator(".ng-nag").first().getByRole("button", { name: "Remove" }).click();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toBeVisible();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toContainText(/[45]:[0-5]\d/);
    await page
      .locator('[data-component="UndoToast"]')
      .getByRole("button", { name: "Undo" })
      .click();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toHaveCount(0);
    const decisions = await calls(page, "nags:decidePhrase");
    expect(decisions.map((call: any) => call.args.decision)).toEqual(["reject", "accept"]);
    await page.close();
  });

  test("Hebrew form and email-free labels are RTL without horizontal overflow", async () => {
    const page = await pageFor("screen", "he");
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    await pwExpect(page.locator('[data-component="SelectedNagPhraseForm"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.close();
  });

  test("phone targets and keyboard focus remain visible with reduced motion", async () => {
    const page = await pageFor();
    for (const node of await page
      .locator(".kb67-composer :is(button, select, textarea):visible")
      .all()) {
      const box = await node.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Tab");
    const style = await page.evaluate(() => {
      const css = getComputedStyle(document.activeElement as Element);
      return {
        outline: Number.parseFloat(css.outlineWidth),
        transition: css.transitionDuration,
      };
    });
    expect(style.outline).toBeGreaterThanOrEqual(2);
    expect(style.transition.split(",").every((value) => Number.parseFloat(value) <= 0.000011)).toBe(
      true
    );
    await page.close();
  });

  test("gallery changes real form and notice views with A/B selection", async () => {
    const page = await pageFor("gallery");
    await phrase(page).fill("Maya gallery words");
    await select(page).selectOption("gallery-dana");
    await pwExpect(phrase(page)).toHaveValue("");
    await page.getByRole("button", { name: en["gallery.error"] }).click();
    await pwExpect(
      page.locator('[data-component="NagSuggestionNotice"][role="alert"]')
    ).toBeVisible();
    await page.getByRole("button", { name: en["gallery.disabled"] }).click();
    await pwExpect(page.getByRole("button", { name: "Add phrase" })).toBeDisabled();
    await select(page).selectOption("gallery-maya");
    await pwExpect(phrase(page)).toHaveValue("Maya gallery words");
    await page.getByRole("button", { name: "עברית" }).click();
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    expect(await page.locator("h1").count()).toBe(1);
    await page.close();
  });

  test("long fictional nag text fits phone and desktop", async () => {
    for (const width of [390, 1280]) {
      const page = await pageFor("gallery", "en", width);
      await page.getByRole("button", { name: en["gallery.overflow"] }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.close();
    }
  });

  test("source-derived before and mounted after evidence covers widths, locales and themes", async () => {
    const shots = join(temp, "captures");
    await mkdir(shots, { recursive: true });
    for (const width of [390, 1280])
      for (const lang of ["en", "he"] as const)
        for (const theme of ["light", "dark"] as const) {
          for (const mode of beforeJs
            ? (["before", "screen", "gallery"] as const)
            : (["screen", "gallery"] as const)) {
            const page = await pageFor(mode, lang, width);
            await page.evaluate((value) => {
              document.documentElement.dataset.theme = value;
            }, theme);
            expect(await page.locator("h1").count()).toBe(1);
            expect(await page.locator("main").count()).toBe(1);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
            ).toBe(true);
            await page.screenshot({
              path: join(shots, `${mode}-${width}-${lang}-${theme}.png`),
              fullPage: true,
            });
            await page.close();
          }
        }
  }, 300_000);
});

describe.serial("KB-67 fixture lifecycle", () => {
  if (!fixtureChild) {
    unitTest("isolated fixture exits successfully after every named case and cleanup", () => {
      if (resultError) throw resultError;
      if (!childRun || !childResults) throw new Error("KB-67 child did not return results");
      requireSuccessfulExit(childRun, childResults, caseNames);
    });
  }

  test("pending browser close cannot delay server or directory release", async () => {
    let finishBrowser!: () => void;
    const pendingBrowser = new Promise<void>((resolve) => { finishBrowser = resolve; });
    const released: string[] = [];
    const cleanup = releaseFixture(
      () => { released.push("server"); },
      () => pendingBrowser,
      () => { released.push("directory"); }
    );
    try {
      await Promise.resolve();
      expect(released).toEqual(["server", "directory"]);
    } finally {
      finishBrowser();
      await cleanup;
    }
  });

  test("browser close rejection still stops the real server and removes its unique directory", async () => {
    await mkdir(join(root, "work"), { recursive: true });
    const directory = await mkdtemp(join(root, "work/kb67-cleanup-regression-"));
    const fixtureServer = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("KB-67 cleanup probe") });
    const serverUrl = fixtureServer.url.href;
    try {
      expect(await (await fetch(serverUrl)).text()).toBe("KB-67 cleanup probe");
      await expect(releaseFixture(
        () => fixtureServer.stop(true),
        () => Promise.reject(new Error("controlled browser close rejection")),
        () => rm(directory, { recursive: true, force: true })
      )).rejects.toThrow("KB-67 fixture cleanup failed");
      await expect(fetch(serverUrl)).rejects.toThrow();
      expect(existsSync(directory)).toBe(false);
    } finally {
      await fixtureServer.stop(true);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("successful case records cannot hide a real child exit failure", async () => {
    const token = crypto.randomUUID();
    const results: FixtureResults = { token, cases: { completed: { pass: true } }, cleanupComplete: true };
    const child = Bun.spawn([process.execPath, "-e", `console.log(${JSON.stringify(resultMarker + JSON.stringify(results))}); process.exit(1);`], {
      cwd: root, stdout: "pipe", stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    const run = { code, out, err };
    expect(code).toBe(1);
    expect(() => requireSuccessfulExit(run, resultsFrom(run, token), ["completed"])).toThrow("exited 1");
    expect(() => resultsFrom(run, "different invocation")).toThrow("another invocation");
    const successfulRun = { ...run, code: 0, err: "(pass) KB-67 controlled runner > completed [1.00ms]" };
    expect(() => requireSuccessfulExit(successfulRun, results, ["completed"])).not.toThrow();
    expect(() => requireSuccessfulExit({ ...successfulRun, err: "(fail) KB-67 controlled runner > completed [60000.00ms]" }, results, ["completed"]))
      .toThrow();
    expect(() => requireSuccessfulExit({ ...run, code: 0 }, { ...results, cleanupComplete: false }, ["completed"]))
      .toThrow("without completing cleanup");
    expect(() => requireSuccessfulExit({ ...run, code: 0 }, { ...results, cases: { completed: { pass: false, error: "controlled assertion failure" } } }, ["completed"]))
      .toThrow();
  });
});

afterAll(() => {
  // Report actual case outcomes even on cleanup rejection; parent also requires exit 0.
  if (fixtureChild) console.info(resultMarker + JSON.stringify({ token: runToken, cases: caseResults, cleanupComplete }));
});
