import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB61_FIXTURE_CHILD === "1";
type Results = Record<string, { pass: boolean; detail?: string }>;

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

async function runFixture(): Promise<Results> {
  const { chromium, expect: expectBrowser } = await import("@playwright/test");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs"))
    .default;
  const web = join(repo, "apps/web");
  const temp = join(repo, "work/kb61/fixture");
  const original = process.env.KB61_ORIGINAL_PROOF === "1";
  await mkdir(temp, { recursive: true });
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
  const baseCss = (
    await postcss([tailwind({ base: repo })]).process(await readFile(cssPath, "utf8"), {
      from: cssPath,
    })
  ).css;
  const build = await Bun.build({
    entrypoints: [join(temp, "entry.tsx")],
    target: "browser",
    outdir: temp,
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "kb61-fixture",
        setup(b) {
          b.onResolve(
            { filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ },
            ({ path }) => ({ path: Bun.resolveSync(path, web) })
          );
          b.onResolve({ filter: /^convex\/react$/ }, () => ({ path: join(temp, "backend.ts") }));
          b.onResolve({ filter: /^next\/link$/ }, () => ({ path: join(temp, "link.tsx") }));
          b.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
            path: join(temp, "api.ts"),
          }));
          if (original)
            b.onResolve({ filter: /(?:^|\/)HabitSheet$/ }, () => ({
              path: join(repo, "work/kb61/before.tsx"),
            }));
          b.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
        },
      },
    ],
  });
  if (!build.success) throw Error(build.logs.map(String).join("\n"));
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
  const executable = ["/usr/bin/chromium", chromium.executablePath()].find(existsSync);
  if (!executable) throw Error("Installed Chromium required");
  const browser = await chromium.launch({ executablePath: executable, args: ["--no-sandbox"] });
  const results: Results = {};
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
    try {
      await fn();
      results[key] = { pass: true };
    } catch (error) {
      results[key] = { pass: false, detail: String(error) };
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
    await browser.close();
    server.stop(true);
  }
  return results;
}

if (child) {
  try {
    console.log(JSON.stringify(await runFixture()));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
} else {
  const { beforeAll, describe, expect, test } = await import("bun:test");
  let results: Results = {};
  beforeAll(async () => {
    // Fresh process avoids process-wide mock.module contamination from unrelated root tests.
    const processChild = Bun.spawn([process.execPath, import.meta.path], {
      cwd: repo,
      env: { ...process.env, KB61_FIXTURE_CHILD: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(processChild.stdout).text(),
      new Response(processChild.stderr).text(),
      processChild.exited,
    ]);
    if (code !== 0) throw Error(`KB61 clean child exit ${code}: ${err.slice(-6000)}`);
    results = JSON.parse(out.trim().split("\n").at(-1) ?? "{}");
  }, 480_000);
  describe("KB-61 HabitSheet request ownership", () => {
    for (const key of [
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
    ])
      test(key, () => expect(results[key]).toEqual({ pass: true }));
  });
}
