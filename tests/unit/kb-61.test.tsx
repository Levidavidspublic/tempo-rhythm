import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { cleanupFixture, requireFixtureSuccess, runIsolatedFixture, type FixtureRun } from "../helpers/kitchen-fixture";
import { isolatedBrowserBuild } from "../helpers/kitchen-browser";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB61_FIXTURE_CHILD === "1";
type Results = Record<string, { pass: boolean; detail?: string }>;
const resultMarker = "KB61_FIXTURE_RESULTS=";
const beforeAllDeadline = 480_000;
const directoryRoot = join(repo, "work/kb61");
const token = process.env.KB61_FIXTURE_TOKEN ?? crypto.randomUUID();
const cleanup = { server: false, browser: false, directory: false, complete: false };
let serverUrl: string | undefined;
let descendantPid: number | undefined;
const phaseStart = performance.now();
function phase(name: string) {
  console.error(`[KB61 ${Math.round(performance.now() - phaseStart)}ms] ${name}`);
}
async function uniqueDirectory(): Promise<string> {
  await mkdir(directoryRoot, { recursive: true });
  return mkdtemp(join(directoryRoot, "fixture-"));
}
function checkedDirectory(path: string): string {
  const resolved = resolve(path);
  if (dirname(resolved) !== directoryRoot || !basename(resolved).startsWith("fixture-"))
    throw Error("KB61 refusing an unowned fixture directory");
  return resolved;
}
async function releaseAll(...releases: (() => unknown)[]): Promise<void> {
  const settled = await Promise.allSettled(releases.map((release) => Promise.resolve().then(release)));
  const errors = settled.flatMap((entry) => entry.status === "rejected" ? [entry.reason] : []);
  if (errors.length) throw new AggregateError(errors, "KB61 fixture cleanup failed");
}
async function releaseOwned(server: ReturnType<typeof Bun.serve> | undefined, browser: Pick<Browser, "close"> | undefined, directory: string) {
  await releaseAll(
    async () => { phase("server-stop:start"); await server?.stop(true); cleanup.server = true; phase("server-stop:done"); },
    async () => { phase("browser-close:start"); await browser?.close(); cleanup.browser = true; phase("browser-close:done"); },
    async () => { phase("directory-remove:start"); await rm(directory, { recursive: true, force: true }); cleanup.directory = true; phase("directory-remove:done"); }
  );
  cleanup.complete = true;
}
type RecordPayload = { token: string; results: Results; cleanup: typeof cleanup; serverUrl?: string; descendantPid?: number };
type ChildRun = FixtureRun & { directory: string };
function parseResults(run: ChildRun, expectedToken: string): RecordPayload {
  const lines = run.out.split("\n").filter((line) => line.startsWith(resultMarker));
  if (lines.length !== 1) throw Error(`KB61 child returned ${lines.length} result records: ${run.err.slice(-6000)}`);
  const payload = JSON.parse(lines[0].slice(resultMarker.length)) as RecordPayload;
  if (payload.token !== expectedToken) throw Error("KB61 child results belong to another invocation");
  return payload;
}
function requireSuccessfulExit(run: ChildRun, payload: RecordPayload) {
  if (run.cleanupErrors.length) throw new AggregateError(run.cleanupErrors, "KB61 fixture cleanup failed");
  if (run.timedOut) throw Error(`KB61 child exceeded its lifecycle budget: ${run.err.slice(-6000)}`);
  if (run.code !== 0) throw Error(`KB61 clean child exit ${run.code}: ${run.err.slice(-6000)}`);
  if (!payload.cleanup.complete) throw Error("KB61 child did not complete cleanup");
  requireFixtureSuccess(run);
}
async function runChild(probe?: string, deadline = beforeAllDeadline): Promise<{ run: ChildRun; payload?: RecordPayload; error?: unknown }> {
  const end = Date.now() + Math.min(deadline, probe && probe !== "hang" ? 30_000 : deadline);
  const directory = await uniqueDirectory();
  const runToken = crypto.randomUUID();
  let outcome: { run: ChildRun; payload?: RecordPayload; error?: unknown } | undefined;
  const errors: unknown[] = [];
  try {
    // Keep the original hook: reserve its last second for shared reap and parent directory cleanup.
    const lifecycle = await runIsolatedFixture({
      command: [process.execPath, import.meta.path], cwd: repo,
      env: { KB61_FIXTURE_CHILD: "1", KB61_FIXTURE_TOKEN: runToken, KB61_FIXTURE_DIRECTORY: directory, KB61_FIXTURE_PROBE: probe ?? "", KB61_FIXTURE_DEADLINE: String(end - 1_000) },
      timeoutMs: Math.max(1, end - Date.now() - 1_000), cleanupMs: 500,
    });
    const run = { ...lifecycle, directory };
    try { outcome = { run, payload: parseResults(run, runToken) }; }
    catch (error) { outcome = { run, error }; }
  } catch (error) { errors.push(error); }
  try { await cleanupFixture({ directory: () => rm(directory, { recursive: true, force: true }) }, 500); }
  catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError([...(outcome?.run.cleanupErrors ?? []), ...errors], "KB61 child and parent cleanup failed");
  if (!outcome) throw Error("KB61 child returned no lifecycle result");
  return outcome;
}

// Only the query/mutation boundary is fictional. The caller and its sheet wiring are real.
const backend = `
const rows=[{_id:"habit-one",name:"Walk outside",cadence:"daily",createdAt:1,currentStreak:0,longestStreak:0}];
const state={calls:[],held:[],closes:0,throwNext:false};
window.__kb61={state,settle(ok){const task=state.held.shift();if(!task)throw Error("No pending save");
  if(ok)task.resolve("new-habit");else task.reject(Error("RAW_BACKEND_DETAIL"));}};
export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}}
export function useQuery(ref,args){if(args==="skip")return undefined;
 if(ref==="users.getProfile")return {_id:"fictional-user"};if(ref==="habits.list")return rows;return [];}
export function useMutation(ref){return args=>{state.calls.push({ref,args});
 if(state.throwNext){state.throwNext=false;throw Error("RAW_BACKEND_DETAIL")}
 if(ref==="habits.create")return new Promise((resolve,reject)=>state.held.push({resolve,reject}));
 return Promise.resolve({currentStreak:0});}}
`;
const api = `export const api={users:{getProfile:"users.getProfile"},habits:{list:"habits.list",create:"habits.create",remove:"habits.remove"},habitCheckIns:{listForDate:"habitCheckIns.listForDate",check:"habitCheckIns.check",undo:"habitCheckIns.undo"}};`;

async function runFixture(results: Results): Promise<Results> {
  const temp = process.env.KB61_FIXTURE_DIRECTORY
    ? checkedDirectory(process.env.KB61_FIXTURE_DIRECTORY)
    : await uniqueDirectory();
  let fixtureServer: ReturnType<typeof Bun.serve> | undefined;
  let fixtureBrowser: Browser | undefined;
  try {
  phase("dependencies:start");
  const { chromium, expect: expectBrowser } = await import("@playwright/test");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs"))
    .default;
  const web = join(repo, "apps/web");
  const original = process.env.KB61_ORIGINAL_PROOF === "1";
  phase("dependencies:done");
  await Promise.all([
    writeFile(join(temp, "backend.ts"), backend),
    writeFile(join(temp, "api.ts"), api),
    writeFile(
      join(temp, "link.tsx"),
      `import React from "react";export default function Link(props){return <a {...props}/>}`
    ),
    writeFile(
      join(temp, "entry.tsx"),
      `
import React,{StrictMode,useLayoutEffect,useState} from "react";import {createRoot} from "react-dom/client";
import {LocaleProvider} from "@/components/providers/LocaleProvider";
import {TpIconSprite} from "@/components/tempo/TpIcon";
import {HabitsScreen} from "@/components/habits/HabitsScreen";
import {HabitSheet${original ? "" : ",Kb61Gallery"}} from "@/components/habits/HabitSheet";
const params=new URLSearchParams(location.search);
function Harness(){const [open,setOpen]=useState(false);const [removed,setRemoved]=useState(false);
 window.__kb61.removeInCommit=()=>{setOpen(false);setRemoved(true)};
 useLayoutEffect(()=>{if(removed)window.__kb61.settle(true)},[removed]);
 return <main className="tp-page"><h1>Habit sheet</h1>
 <button id="open-sheet" className="tp-btn tp-btn--secondary" onClick={()=>setOpen(true)}>Open habit</button>
 {open?<HabitSheet id="fixture-habit" title="New habit" initial={{name:"",cadence:"daily"}}
 onSubmit={draft=>{const state=window.__kb61.state;state.calls.push({args:draft});
 if(state.throwNext){state.throwNext=false;throw Error("RAW_BACKEND_DETAIL")}
 return new Promise((resolve,reject)=>state.held.push({resolve,reject}));}}
 onClose={()=>{window.__kb61.state.closes++;setOpen(false)}}/>:null}</main>}
const view=params.get("mode")==="screen"?<main><HabitsScreen/></main>:
 ${original ? "<Harness/>" : 'params.get("mode")==="gallery"?<Kb61Gallery/>:<Harness/>'};
createRoot(document.getElementById("app")).render(<StrictMode><LocaleProvider><TpIconSprite/>{view}</LocaleProvider></StrictMode>);
`
    ),
  ]);
  const cssPath = join(web, "app/globals.css");
  phase("css:start");
  const baseCss = (
    await postcss([tailwind({ base: repo })]).process(await readFile(cssPath, "utf8"), {
      from: cssPath,
    })
  ).css;
  phase("css:done");
  phase("bundle:start");
  const bundleDirectory = join(temp, "bundle");
  const remaining = Number(process.env.KB61_FIXTURE_DEADLINE ?? Date.now() + beforeAllDeadline) - Date.now();
  await isolatedBrowserBuild({
    cwd: repo, resolveFrom: web, entrypoints: [join(temp, "entry.tsx")], outdir: bundleDirectory,
    define: { "process.env.NODE_ENV": '\"development\"' },
    timeoutMs: Math.max(1, remaining - 500), cleanupMs: 500,
    aliases: {
      "convex/react": join(temp, "backend.ts"), "next/link": join(temp, "link.tsx"),
      "@/convex/_generated/api": join(temp, "api.ts"),
      "@/convex/lib/habitStreak": join(repo, "convex/lib/habitStreak.ts"),
      ...(original ? { "@/components/habits/HabitSheet": join(repo, "work/kb61/before.tsx"), "./HabitSheet": join(repo, "work/kb61/before.tsx") } : {}),
    },
  });
  const build = { outputs: (await readdir(bundleDirectory)).map((name) => ({
    path: join(bundleDirectory, name), text: () => Bun.file(join(bundleDirectory, name)).text(),
  })) };
  phase("bundle:done");
  const js = (await build.outputs.find((file) => file.path.endsWith(".js"))?.text()) ?? "";
  const css =
    baseCss +
    "\n" +
    (
      await Promise.all(
        build.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text())
      )
    ).join("\n");
  if (process.env.KB61_BUNDLE_ONLY === "1") return { bundle: { pass: Boolean(js && css) } };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/app.js")
        return new Response(js, { headers: { "content-type": "text/javascript" } });
      if (url.pathname === "/app.css")
        return new Response(css, { headers: { "content-type": "text/css" } });
      const he = url.searchParams.get("lang") === "he";
      return new Response(
        `<!doctype html><html lang="${he ? "he" : "en"}" dir="${he ? "rtl" : "ltr"}"><head>
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>Habit save fixture</title><link rel="stylesheet" href="/app.css"></head>
      <body><div id="app"></div><script>window.process={env:{NODE_ENV:"development"}}</script><script type="module" src="/app.js"></script></body></html>`,
        { headers: { "content-type": "text/html" } }
      );
    },
  });
  fixtureServer = server;
  serverUrl = server.url.href;
  phase(`server:ready ${serverUrl}`);
  const candidates = ["/usr/bin/chromium", chromium.executablePath(), "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/opt/google/chrome/chrome"];
  phase(`browser:candidates ${JSON.stringify(candidates.map((path) => ({ path, installed: existsSync(path) })))}`);
  const executable = candidates.find(existsSync);
  if (!executable) throw Error("Installed Chromium required");
  phase(`browser-launch:start ${executable}`);
  const browser = await chromium.launch({ executablePath: executable, args: ["--no-sandbox"] });
  fixtureBrowser = browser;
  phase("browser-launch:done");
  const errors: string[] = [];
  const open = async (mode = "sheet", lang = "en", width = 390, theme = "light") => {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}`);
    await page.locator("h1").waitFor({ timeout: 15_000 });
    await page.waitForFunction((language) => document.documentElement.lang === language, lang);
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.waitForFunction(
      (value) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--tp-ground")
          .trim()
          .toLowerCase() === (value === "dark" ? "#161412" : "#f3eee4"),
      theme
    );
    return page;
  };
  const sheet = (page: any) => page.getByRole("dialog");
  const name = (page: any) => sheet(page).locator('input[type="text"]');
  const submit = (page: any) => sheet(page).locator('button[type="submit"]');
  const show = async (page: any, mode = "sheet") => {
    await (mode === "screen"
      ? page.getByRole("button", { name: /New habit|הרגל חדש/ }).first()
      : page.locator("#open-sheet")
    ).click();
    await expectBrowser(sheet(page)).toBeVisible();
  };
  const settle = (page: any, ok = true) =>
    page.evaluate((success) => (window as any).__kb61.settle(success), ok);
  const state = (page: any) => page.evaluate(() => (window as any).__kb61.state);
  const check = async (key: string, fn: () => Promise<void>) => {
    if (process.env.KB61_CASE && key !== process.env.KB61_CASE) return;
    phase(`case:start ${key}`);
    try {
      await fn();
      results[key] = { pass: true };
      phase(`case:pass ${key}`);
    } catch (error) {
      results[key] = { pass: false, detail: String(error) };
      phase(`case:fail ${key}: ${String(error)}`);
    }
  };
  const race = async (page: any, ok: boolean) => {
    await show(page, "screen");
    await name(page).fill("Original draft");
    await submit(page).click();
    await sheet(page).locator(".tp-sheet__close").click();
    await show(page, "screen");
    await name(page).fill("New draft stays here");
    await name(page).focus();
    await settle(page, ok);
    // The old callback's microtask and React's update must both have finished before observing.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    return {
      open: await sheet(page).count(),
      draft: (await name(page).count()) ? await name(page).inputValue() : null,
      focused: (await name(page).count())
        ? await name(page).evaluate((node: any) => node === document.activeElement)
        : false,
    };
  };
  try {
    if (original) {
      for (const success of [true, false]) {
        const page = await open("screen");
        const observation = await race(page, success);
        results[success ? "original resolves closes B" : "original rejection leaves B"] = {
          pass: success ? observation.open === 0 : observation.open === 1,
          detail: JSON.stringify(observation),
        };
        await page.close();
      }
    } else {
      await check("trimmed name and weekly cadence reach callback exactly", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("  Read quietly  ");
        await sheet(page).locator("select").selectOption("weekly");
        await submit(page).click();
        expectBrowser((await state(page)).calls).toEqual([
          { args: { name: "Read quietly", cadence: "weekly" } },
        ]);
        await page.close();
      });
      await check("name length and empty validation are preserved", async () => {
        const page = await open();
        await show(page);
        await expectBrowser(name(page)).toHaveAttribute("maxlength", "80");
        await name(page).fill("   ");
        await submit(page).click();
        await expectBrowser(name(page)).toHaveAttribute("aria-invalid", "true");
        await expectBrowser(name(page)).toBeFocused();
        expectBrowser((await state(page)).calls).toHaveLength(0);
        await page.close();
      });
      await check("synchronous repeated submit starts one request", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await sheet(page)
          .locator("form")
          .evaluate((form: any) => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          });
        expectBrowser((await state(page)).calls).toHaveLength(1);
        await page.close();
      });
      await check("current success closes exactly once", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await submit(page).click();
        await settle(page);
        await expectBrowser(sheet(page)).toHaveCount(0);
        expectBrowser((await state(page)).closes).toBe(1);
        await page.close();
      });
      await check("current rejection keeps draft and allows explicit retry", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Keep this draft");
        await submit(page).click();
        await settle(page, false);
        await expectBrowser(sheet(page).getByRole("alert")).toContainText("Try saving again");
        await expectBrowser(name(page)).toHaveValue("Keep this draft");
        await expectBrowser(name(page)).toBeEditable();
        await submit(page).click();
        expectBrowser((await state(page)).calls).toHaveLength(2);
        await settle(page);
        await expectBrowser(sheet(page)).toHaveCount(0);
        await page.close();
      });
      await check("synchronous callback throw becomes recoverable error", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await page.evaluate(() => {
          (window as any).__kb61.state.throwNext = true;
        });
        await submit(page).click();
        await expectBrowser(sheet(page).getByRole("alert")).toBeVisible();
        await expectBrowser(submit(page)).toBeEnabled();
        expectBrowser(await sheet(page).innerText()).not.toContain("RAW_BACKEND_DETAIL");
        await page.close();
      });
      for (const ok of [true, false])
        await check(
          ok
            ? "real caller old success cannot close newer draft"
            : "real caller old rejection cannot change newer draft",
          async () => {
            const page = await open("screen");
            expectBrowser(await race(page, ok)).toEqual({
              open: 1,
              draft: "New draft stays here",
              focused: true,
            });
            expectBrowser(await sheet(page).getByRole("alert").count()).toBe(0);
            await page.close();
          }
        );
      for (const mechanism of ["close", "cancel", "escape", "scrim"])
        await check(`${mechanism} remains available during save`, async () => {
          const page = await open();
          await show(page);
          await name(page).fill("Walk");
          await submit(page).click();
          if (mechanism === "escape") await name(page).press("Escape");
          else if (mechanism === "scrim")
            await page.locator(".tp-sheet-scrim").click({ position: { x: 5, y: 5 } });
          else
            await sheet(page)
              .locator(
                mechanism === "close" ? ".tp-sheet__close" : ".tp-sheet__foot button:last-child"
              )
              .click();
          await expectBrowser(sheet(page)).toHaveCount(0);
          await settle(page);
          expectBrowser((await state(page)).closes).toBe(1);
          await page.close();
        });
      await check("close fences settlement before React unmount", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await submit(page).click();
        await sheet(page)
          .locator(".tp-sheet__close")
          .evaluate((node: any) => {
            node.click();
            (window as any).__kb61.settle(true);
          });
        await expectBrowser(sheet(page)).toHaveCount(0);
        expectBrowser((await state(page)).closes).toBe(1);
        await page.close();
      });
      await check("parent removal fences settlement during commit", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await submit(page).click();
        // Resolve from the parent's layout effect in the removal commit, before passive cleanup.
        await page.evaluate(() => (window as any).__kb61.removeInCommit());
        await expectBrowser(sheet(page)).toHaveCount(0);
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        expectBrowser((await state(page)).closes).toBe(0);
        await page.close();
      });
      await check("pending name stays focusable and snapshot cannot change", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await submit(page).click();
        await expectBrowser(name(page)).toHaveAttribute("readonly", "");
        await expectBrowser(sheet(page).locator("select")).toBeDisabled();
        await name(page).focus();
        await name(page).press("End");
        await name(page).press("x");
        await expectBrowser(name(page)).toHaveValue("Walk");
        await expectBrowser(name(page)).toBeFocused();
        await page.close();
      });
      await check("pending explanation tells closing does not cancel save", async () => {
        const page = await open();
        await show(page);
        await name(page).fill("Walk");
        await submit(page).click();
        await expectBrowser(sheet(page).getByRole("status")).toContainText(
          "Closing this sheet does not cancel the save"
        );
        await expectBrowser(submit(page)).toHaveAttribute("aria-busy", "true");
        await page.close();
      });
      await check("StrictMode preserves initial focus trap opener and body scroll", async () => {
        const page = await open();
        await page.evaluate(() => {
          document.body.style.overflow = "scroll";
        });
        await show(page);
        await expectBrowser(name(page)).toBeFocused();
        expectBrowser(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        const close = sheet(page).locator(".tp-sheet__close");
        const cancel = sheet(page).locator(".tp-sheet__foot button:last-child");
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        await expectBrowser(cancel).toBeFocused();
        await page.keyboard.press("Tab");
        await expectBrowser(close).toBeFocused();
        await close.click();
        await expectBrowser(page.locator("#open-sheet")).toBeFocused();
        expectBrowser(await page.evaluate(() => document.body.style.overflow)).toBe("scroll");
        await page.close();
      });
      await check(
        "gallery uses real interactive sheet with deferred success and error",
        async () => {
          const page = await open("gallery");
          await page.getByRole("button", { name: "Show save error", exact: true }).click();
          await page.getByRole("button", { name: "Open habit sheet", exact: true }).click();
          await name(page).fill("Walk");
          await submit(page).click();
          await expectBrowser(sheet(page).getByRole("alert")).toBeVisible();
          await sheet(page).locator(".tp-sheet__close").click();
          await page.getByRole("button", { name: "Save succeeds", exact: true }).click();
          await page.getByRole("button", { name: "Open habit sheet", exact: true }).click();
          await name(page).fill("Walk");
          await submit(page).click();
          await expectBrowser(sheet(page)).toHaveCount(0);
          await page.close();
        }
      );
      await check("English Hebrew responsive theme matrix keeps usable sheet", async () => {
        for (const mode of ["screen", "gallery"])
          for (const width of [390, 1280])
            for (const lang of ["en", "he"])
              for (const theme of ["light", "dark"]) {
                const page = await open(mode, lang, width, theme);
                if (mode === "screen") await show(page, "screen");
                else await page.locator("[data-kb61-open]").click();
                await name(page).fill("Walk outside");
                await submit(page).click();
                expectBrowser(await page.locator("main").count()).toBe(1);
                expectBrowser(await page.locator("h1").count()).toBe(1);
                await expectBrowser(page.locator("html")).toHaveAttribute(
                  "dir",
                  lang === "he" ? "rtl" : "ltr"
                );
                const measurements = await sheet(page)
                  .locator("button,input,select")
                  .evaluateAll((nodes) =>
                    nodes
                      .filter((node) => !(node as HTMLButtonElement).disabled)
                      .map((node) => ({
                        height: node.getBoundingClientRect().height,
                        width: node.getBoundingClientRect().width,
                      }))
                  );
                if (measurements.some((item) => item.height < 44 || item.width < 44))
                  throw Error(JSON.stringify(measurements));
                if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
                  throw Error("horizontal overflow");
                if (lang === "he")
                  expectBrowser(await sheet(page).getByRole("status").innerText()).toMatch(/[א-ת]/);
                if (process.env.KB61_CAPTURE_DIR) {
                  await mkdir(process.env.KB61_CAPTURE_DIR, { recursive: true });
                  await page.screenshot({
                    path: join(
                      process.env.KB61_CAPTURE_DIR,
                      `${mode}-${width}-${lang}-${theme}.png`
                    ),
                    fullPage: true,
                  });
                }
                await page.close();
              }
      });
      await check("focus ring and reduced motion are rendered", async () => {
        const page = await open();
        await show(page);
        await page.keyboard.press("Tab");
        const active = page.locator(":focus");
        const style = await active.evaluate((node) => ({
          outline: getComputedStyle(node).outlineStyle,
          shadow: getComputedStyle(node).boxShadow,
          transition: getComputedStyle(node).transitionDuration,
          animation: getComputedStyle(node).animationDuration,
        }));
        if (style.outline === "none" && style.shadow === "none") throw Error("no visible focus");
        if (
          [style.transition, style.animation].some((value) =>
            value.split(",").some((part) => parseFloat(part) > 0.001)
          )
        )
          throw Error(JSON.stringify(style));
        await page.close();
      });
      await check("all browser interactions avoid uncaught errors", async () => {
        expectBrowser(errors).toEqual([]);
      });
    }
    if (original && process.env.KB61_CAPTURE_DIR) {
      await mkdir(process.env.KB61_CAPTURE_DIR, { recursive: true });
      for (const mode of ["screen", "sheet"])
        for (const width of [390, 1280])
          for (const lang of ["en", "he"])
            for (const theme of ["light", "dark"]) {
              const page = await open(mode, lang, width, theme);
              await show(page, mode);
              await name(page).fill("Walk outside");
              await submit(page).click();
              await page.screenshot({
                path: join(
                  process.env.KB61_CAPTURE_DIR,
                  `original-${mode}-${width}-${lang}-${theme}.png`
                ),
                fullPage: true,
              });
              await page.close();
            }
    }
  } finally {
    phase("cases:done");
  }
  return results;
  } finally {
    await releaseOwned(fixtureServer, fixtureBrowser, temp);
  }
}

async function runProbe(mode: string, results: Results): Promise<void> {
  const directory = checkedDirectory(process.env.KB61_FIXTURE_DIRECTORY!);
  let server: ReturnType<typeof Bun.serve> | undefined;
  try {
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("KB61 cleanup probe") });
    serverUrl = server.url.href;
    if (await (await fetch(serverUrl)).text() !== "KB61 cleanup probe") throw Error("Probe server did not respond");
    results.probe = { pass: true };
    phase(`probe:${mode}:server-ready ${serverUrl}`);
    if (mode === "hang") {
      const descendant = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { detached: true, stdout: "ignore", stderr: "ignore" });
      descendantPid = descendant.pid;
      console.log(resultMarker + JSON.stringify({ token, results, cleanup, serverUrl, descendantPid }));
      await new Promise<void>(() => {});
    }
    if (mode === "setup-failure") throw Error("KB61 controlled launch failure");
    if (mode !== "close-rejection") throw Error("KB61 unknown lifecycle probe");
  } finally {
    await releaseOwned(server, mode === "close-rejection"
      ? { close: () => Promise.reject(Error("KB61 controlled browser close rejection")) }
      : undefined, directory);
  }
}

if (child) {
  const results: Results = {};
  try {
    phase(`child:start pid=${process.pid}`);
    if (process.env.KB61_FIXTURE_PROBE) await runProbe(process.env.KB61_FIXTURE_PROBE, results);
    else await runFixture(results);
    if (Object.values(results).some((result) => !result.pass)) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
  console.log(resultMarker + JSON.stringify({ token, results, cleanup, serverUrl, descendantPid }));
} else {
  const { beforeAll, describe, expect, test } = await import("bun:test");
  let results: Results = {};
  let outcome: Awaited<ReturnType<typeof runChild>>;
  beforeAll(async () => {
    // Original 480s hook contains the fresh child, cancellation/reap and parent-owned cleanup.
    outcome = await runChild();
    results = outcome.payload?.results ?? {};
  }, 480_000);
  const expectedCases = [
      "trimmed name and weekly cadence reach callback exactly",
      "name length and empty validation are preserved",
      "synchronous repeated submit starts one request",
      "current success closes exactly once",
      "current rejection keeps draft and allows explicit retry",
      "synchronous callback throw becomes recoverable error",
      "real caller old success cannot close newer draft",
      "real caller old rejection cannot change newer draft",
      ...["close", "cancel", "escape", "scrim"].map(
        (mechanism) => `${mechanism} remains available during save`
      ),
      "close fences settlement before React unmount",
      "parent removal fences settlement during commit",
      "pending name stays focusable and snapshot cannot change",
      "pending explanation tells closing does not cancel save",
      "StrictMode preserves initial focus trap opener and body scroll",
      "gallery uses real interactive sheet with deferred success and error",
      "English Hebrew responsive theme matrix keeps usable sheet",
      "focus ring and reduced motion are rendered",
      "all browser interactions avoid uncaught errors",
    ];
  describe("KB-61 HabitSheet request ownership", () => {
    for (const key of expectedCases)
      test(key, () => expect(results[key]).toEqual({ pass: true }));
  });

  describe.serial("KB-61 fixture lifecycle", () => {
    test("descendant and process-group cleanup failures both survive in AggregateError", async () => {
      const proof = await runIsolatedFixture({
        command: [process.execPath, "-e", `
          import { runIsolatedFixture, requireFixtureSuccess } from ${JSON.stringify(join(repo, "tests/helpers/kitchen-fixture.ts"))};
          const nativeKill = process.kill.bind(process);
          const descendantError = Error("controlled descendant cleanup failure");
          const groupError = Error("controlled process-group termination failure");
          let descendantAttempted = false, groupAttempted = false;
          process.kill = (pid, signal) => {
            if (pid > 0 && signal === "SIGTERM" && !descendantAttempted) { descendantAttempted = true; throw descendantError; }
            if (pid < 0 && signal === "SIGKILL" && !groupAttempted) { groupAttempted = true; throw groupError; }
            return nativeKill(pid, signal);
          };
          let run;
          try {
            run = await runIsolatedFixture({ command:[process.execPath,"-e","setInterval(()=>{},1000)"], cwd:${JSON.stringify(repo)}, timeoutMs:300, cleanupMs:600 });
          } finally { process.kill = nativeKill; }
          let failure;
          try { requireFixtureSuccess(run); } catch (error) { failure = error; }
          if (!(failure instanceof AggregateError) || !failure.errors.includes(descendantError) || !failure.errors.includes(groupError)) throw Error("One cleanup error replaced the other");
          if (!descendantAttempted || !groupAttempted) throw Error("Both cleanup paths must run");
          console.log("KB61_BOTH_CLEANUP_ERRORS=" + JSON.stringify([descendantError.message,groupError.message]));
        `],
        cwd: repo, timeoutMs: 3_500, cleanupMs: 500,
      });
      requireFixtureSuccess(proof);
      expect(proof.out).toContain("controlled descendant cleanup failure");
      expect(proof.out).toContain("controlled process-group termination failure");
      const record = proof.out.split("\n").find((line) => line.startsWith("KB61_BOTH_CLEANUP_ERRORS="));
      if (!record) throw Error("The cleanup fault proof returned no errors");
      const errors = (JSON.parse(record.slice("KB61_BOTH_CLEANUP_ERRORS=".length)) as string[]).map((message) => Error(message));
      let rejected: unknown;
      try { requireSuccessfulExit({ ...outcome.run, code: null, timedOut: true, cleanupErrors: errors }, outcome.payload!); }
      catch (error) { rejected = error; }
      if (!(rejected instanceof AggregateError)) throw Error("The KB61 acceptance gate hid cleanup errors behind exit status");
      expect(rejected.errors[0]).toBe(errors[0]);
      expect(rejected.errors[1]).toBe(errors[1]);
    });

    test("clean child completes every original case and cleanup with authoritative exit", () => {
      if (outcome.error) throw outcome.error;
      if (!outcome.payload) throw Error("KB61 child did not return results");
      requireSuccessfulExit(outcome.run, outcome.payload);
      expect(Object.keys(outcome.payload.results).sort()).toEqual([...expectedCases].sort());
      expect(existsSync(outcome.run.directory)).toBe(false);
    });

    test("pending browser release cannot block server or directory release", async () => {
      const released: string[] = [];
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => { finish = resolve; });
      const release = releaseAll(() => { released.push("server"); }, () => pending, () => { released.push("directory"); });
      try { await Promise.resolve(); expect(released).toEqual(["server", "directory"]); }
      finally { finish(); await release; }
    });

    test("launch failure stops its real server and removes its unique directory", async () => {
      const failed = await runChild("setup-failure");
      if (failed.error) throw failed.error;
      const payload = failed.payload!;
      expect(payload.results.probe).toEqual({ pass: true });
      expect(failed.run.code).not.toBe(0);
      expect(failed.run.timedOut).toBe(false);
      expect(payload.cleanup).toEqual({ server: true, browser: true, directory: true, complete: true });
      await expect(fetch(payload.serverUrl!)).rejects.toThrow();
      expect(existsSync(failed.run.directory)).toBe(false);
      expect(() => requireSuccessfulExit(failed.run, payload)).toThrow("clean child exit");
      expect(() => parseResults(failed.run, "different invocation")).toThrow("another invocation");
    }, 30_000);

    test("browser close rejection releases server and directory and cannot report success", async () => {
      const failed = await runChild("close-rejection");
      if (failed.error) throw failed.error;
      const payload = failed.payload!;
      expect(payload.results.probe).toEqual({ pass: true });
      expect(failed.run.code).not.toBe(0);
      expect(failed.run.timedOut).toBe(false);
      expect(payload.cleanup).toEqual({ server: true, browser: false, directory: true, complete: false });
      await expect(fetch(payload.serverUrl!)).rejects.toThrow();
      expect(existsSync(failed.run.directory)).toBe(false);
      expect(() => requireSuccessfulExit(failed.run, payload)).toThrow("clean child exit");
      expect(() => requireSuccessfulExit({ ...failed.run, code: 0 }, payload)).toThrow("did not complete cleanup");
    }, 30_000);

    test("deadline cancellation kills and reaps its child tree and removes parent-owned output", async () => {
      const cancelled = await runChild("hang", 5_000);
      if (cancelled.error) throw cancelled.error;
      const payload = cancelled.payload!;
      expect(payload.results.probe).toEqual({ pass: true });
      expect(cancelled.run.timedOut).toBe(true);
      expect(cancelled.run.code).not.toBe(0);
      expect(() => requireSuccessfulExit(cancelled.run, payload)).toThrow("exceeded its lifecycle budget");
      expect(() => process.kill(cancelled.run.pid, 0)).toThrow();
      if (!payload.descendantPid) throw Error("KB61 hang probe did not launch its detached descendant");
      try {
        const stat = await readFile(`/proc/${payload.descendantPid}/stat`, "utf8");
        expect(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0]).toBe("Z");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await expect(fetch(payload.serverUrl!)).rejects.toThrow();
      expect(existsSync(cancelled.run.directory)).toBe(false);
    }, 30_000);
  });
}
