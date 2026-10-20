import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB59_FIXTURE_CHILD === "1";
type Results = Record<string, { pass: boolean; detail?: string }>;
const names = [
  "stored false and true drive the real preference row",
  "loading either query waits without an actionable row",
  "one toggle sends exactly the existing preference patch",
  "FIFO earlier rejection cannot outlive later success",
  "FIFO ABA keeps latest intent while older equal value settles",
  "current success clears pending and announces once",
  "current rejection shows authoritative stored choice",
  "explicit toggle after error retries once and recovers",
  "earlier rejection cannot interrupt newer pending choice",
  "earlier success cannot announce or clear newer pending choice",
  "adversarial old rejection cannot undo newer success feedback",
  "adversarial old success cannot dismiss newer failure",
  "synchronous callback throw is recoverable",
  "unmounted request cannot announce into surviving SettingsScreen",
  "older mount cannot change replacement row",
  "parent removal commit fences a settling request",
  "StrictMode lifecycle still permits current success",
  "unavailable provider stays off and locked",
  "daily remaining count stays clamped without a new quota lock",
  "UTC midnight refresh preserves latest intent and cleans timer",
  "query boundary keeps the preferences page usable",
  "keyboard switching retains focus and phone targets",
  "caller and gallery render English Hebrew responsive theme matrix",
  "gallery shares production save and recover behavior",
  "fixture interactions avoid uncaught app errors and extra operations",
];

const backend = `
import {useSyncExternalStore} from 'react';
let preferences={theme:'light',locale:'en',weekStartsOn:1,timeZone:'UTC',emailReminders:true,inAppNotifications:true,coachWebSearch:false};
let status={available:true,enabled:false,usedToday:0,dailyLimit:5};
const profile={_id:'fictional-user'},coach={dial:4};
const listeners=new Set();const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const state={calls:[],held:[],settlements:[],days:[],readyPreferences:true,readyStatus:true,throwNext:false,queryError:false};const updates={};
const notify=()=>{for(const f of listeners)f()};
window.__kb59={state,stored:()=>preferences.coachWebSearch,
 configure(patch){if('stored' in patch)preferences={...preferences,coachWebSearch:patch.stored};
  for(const key of ['available','usedToday','dailyLimit'])if(key in patch)status={...status,[key]:patch[key]};
  for(const key of ['readyPreferences','readyStatus','queryError','throwNext'])if(key in patch)state[key]=patch[key];notify()},
 settle(index,ok){const task=state.held[index];if(!task||task.done)throw Error('No pending request '+index);task.done=true;state.settlements.push({index,ok});
  if(ok){preferences={...preferences,...task.args};status={...status,enabled:preferences.coachWebSearch};notify();task.resolve(null)}else task.reject(Error('FICTIONAL_UPDATE_FAILED'));}};
export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}}
export function useQuery(ref,args){
 if(ref==='coach.webSearchStatus'&&!state.days.includes(args.utcDay))state.days.push(args.utcDay);
 return useSyncExternalStore(subscribe,()=>{
  if(ref==='coach.webSearchStatus'&&state.queryError)throw Error('FICTIONAL_QUERY_ERROR');
  return ref==='preferences.get'?(state.readyPreferences?preferences:undefined):ref==='users.getProfile'?profile:
   ref==='coach.webSearchStatus'?(state.readyStatus?status:undefined):ref==='coach.getSettings'?coach:null})}
export function useMutation(ref){return updates[ref]??(updates[ref]=args=>{state.calls.push({ref,args});
 if(state.throwNext){state.throwNext=false;throw Error('FICTIONAL_SYNC_ERROR')}
 return new Promise((resolve,reject)=>state.held.push({args,resolve,reject,done:false}));})}
`;

async function runFixture(): Promise<Results> {
  const { chromium, expect } = await import("@playwright/test");
  const { themeInitScript } = await import("../../apps/web/lib/theme-script");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs"))
    .default;
  const web = join(repo, "apps/web");
  const temp = join(repo, "work/kb59/fixture");
  const original = process.env.KB59_ORIGINAL_PROOF === "1";
  await mkdir(temp, { recursive: true });
  await mkdir(join(repo, "work/kb59/captures"), { recursive: true });
  await Promise.all([
    writeFile(join(temp, "backend.ts"), backend),
    writeFile(
      join(temp, "api.ts"),
      `export const api={users:{getProfile:'users.getProfile'},preferences:{get:'preferences.get',update:'preferences.update'},coach:{getSettings:'coach.getSettings',setDial:'coach.setDial',webSearchStatus:'coach.webSearchStatus'}}`
    ),
    writeFile(
      join(temp, "auth.ts"),
      `export const useAuthActions=()=>({signOut:()=>Promise.resolve()});`
    ),
    writeFile(
      join(temp, "navigation.ts"),
      `const router={push(){},replace(){}};export const useRouter=()=>router;`
    ),
    writeFile(
      join(temp, "link.tsx"),
      `import React from 'react';export default function Link(props){return <a {...props}/>}`
    ),
    writeFile(
      join(temp, "entry.tsx"),
      `
import React,{StrictMode,useLayoutEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import Page from '@/app/(tempo)/settings/preferences/page';
import {LocaleProvider} from '@/components/providers/LocaleProvider';import {ThemeProvider} from '@/components/providers/ThemeProvider';import {TpIconSprite} from '@/components/tempo/TpIcon';
${original ? "" : "import {Kb59Gallery} from '@/components/coach/CoachWebSearchSetting';"}
function Caller(){const [removed,setRemoved]=useState(false);
 window.__kb59.removeInCommit=()=>{window.__kb59.configure({readyStatus:false});setRemoved(true)};
 useLayoutEffect(()=>{if(removed)window.__kb59.settle(0,true)},[removed]);
 return <main id='main'><Page/></main>}
const gallery=new URLSearchParams(location.search).get('mode')==='gallery';
const root=createRoot(document.getElementById('app'));window.__kb59.unmountRoot=()=>root.unmount();root.render(<StrictMode><LocaleProvider><ThemeProvider><TpIconSprite/>${original ? "<Caller/>" : "{gallery?<Kb59Gallery/>:<Caller/>}"}</ThemeProvider></LocaleProvider></StrictMode>);
`
    ),
  ]);
  const cssPath = join(web, "app/globals.css");
  const base = (
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
        name: "kb59-clean-fixture",
        setup(b) {
          b.onResolve(
            { filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ },
            ({ path }) => ({ path: Bun.resolveSync(path, web) })
          );
          b.onResolve({ filter: /^convex\/react$/ }, () => ({ path: join(temp, "backend.ts") }));
          b.onResolve({ filter: /^@convex-dev\/auth\/react$/ }, () => ({
            path: join(temp, "auth.ts"),
          }));
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: join(temp, "navigation.ts"),
          }));
          b.onResolve({ filter: /^next\/link$/ }, () => ({ path: join(temp, "link.tsx") }));
          b.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
            path: join(temp, "api.ts"),
          }));
          if (original)
            b.onResolve({ filter: /^@\/components\/coach\/CoachWebSearchSetting$/ }, () => ({
              path: join(repo, "work/kb59/before.tsx"),
            }));
          b.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
        },
      },
    ],
  });
  if (!build.success) throw Error(build.logs.map(String).join("\n"));
  const js = (await build.outputs.find((x) => x.path.endsWith(".js"))?.text()) ?? "";
  // RootLayout's next/font local variables, using the same bundled font files.
  const layoutFonts = `@font-face{font-family:"KB59 Newsreader";src:url("/fonts/newsreader/Newsreader-latin.woff2") format("woff2");font-weight:400 700;font-style:normal;font-display:swap;}
    @font-face{font-family:"KB59 Mono";src:url("/fonts/ibm-plex-mono/IBMPlexMono-latin-400.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap;}
    @font-face{font-family:"KB59 Mono";src:url("/fonts/ibm-plex-mono/IBMPlexMono-latin-500.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap;}
    @font-face{font-family:"KB59 Mono";src:url("/fonts/ibm-plex-mono/IBMPlexMono-latin-600.woff2") format("woff2");font-weight:600;font-style:normal;font-display:swap;}
    :root{--font-newsreader:"KB59 Newsreader";--font-ibm-mono:"KB59 Mono";}`;
  const css =
    layoutFonts +
    "\n" +
    base +
    "\n" +
    (
      await Promise.all(build.outputs.filter((x) => x.path.endsWith(".css")).map((x) => x.text()))
    ).join("\n");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/app.js")
        return new Response(js, { headers: { "content-type": "text/javascript; charset=utf-8" } });
      if (url.pathname === "/app.css")
        return new Response(css, { headers: { "content-type": "text/css" } });
      if (/^\/fonts\/[a-z0-9-]+\/[A-Za-z0-9.-]+\.woff2$/.test(url.pathname)) {
        const font = Bun.file(join(web, url.pathname));
        return (await font.exists())
          ? new Response(font, { headers: { "content-type": "font/woff2" } })
          : new Response("", { status: 404 });
      }
      return new Response(
        `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preferences fixture</title><script>${themeInitScript()}</script><link rel="stylesheet" href="/app.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"development"}}</script><script type="module" src="/app.js"></script></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } }
      );
    },
  });
  const executable = ["/usr/bin/chromium", chromium.executablePath()].find(existsSync);
  if (!executable) throw Error("Installed Chromium required");
  const browser = await chromium.launch({ executablePath: executable, args: ["--no-sandbox"] });
  const results: Results = {};
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const visualMetrics: unknown[] = [];
  const open = async (
    options: {
      gallery?: boolean;
      lang?: string;
      width?: number;
      theme?: string;
      midnight?: boolean;
    } = {}
  ) => {
    const page = await browser.newPage({
      viewport: { width: options.width ?? 390, height: 844 },
      reducedMotion: "reduce",
    });
    if (options.midnight) await page.clock.install({ time: new Date("2026-10-20T23:59:00.000Z") });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("FICTIONAL_QUERY_ERROR"))
        consoleErrors.push(m.text());
      if (m.type() === "warning") consoleWarnings.push(m.text());
    });
    await page.goto(
      `http://127.0.0.1:${server.port}/?lang=${options.lang ?? "en"}&theme=${options.theme ?? "light"}&mode=${options.gallery ? "gallery" : "caller"}`
    );
    await expect(page.locator("#pref-coach-web-search")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", options.lang ?? "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", options.theme ?? "light");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe(options.theme === "dark" ? "rgb(22, 20, 18)" : "rgb(243, 238, 228)");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    expect(
      await page.evaluate(
        (lang: string) =>
          document.fonts.check('500 42px "KB59 Newsreader"') &&
          document.fonts.check('400 17px "Source Sans 3"') &&
          (lang !== "he" || document.fonts.check('500 42px "Frank Ruhl Libre"', "העדפות")),
        options.lang ?? "en"
      )
    ).toBe(true);
    return page;
  };
  const toggle = (p: any) => p.locator("#pref-coach-web-search");
  const status = (p: any) => p.locator(".tp-pagehead output");
  const alert = (p: any) => p.locator("#web-search [role=alert]");
  const feedback = (p: any) => p.locator("#web-search-feedback");
  const state = (p: any) =>
    p.evaluate(() => ({
      calls: (window as any).__kb59.state.calls,
      held: (window as any).__kb59.state.held.length,
      days: (window as any).__kb59.state.days,
      stored: (window as any).__kb59.stored(),
    }));
  const configure = (p: any, patch: any) =>
    p.evaluate((x: any) => (window as any).__kb59.configure(x), patch);
  const settle = (p: any, index: number, ok: boolean) =>
    p.evaluate(({ index, ok }: any) => (window as any).__kb59.settle(index, ok), { index, ok });
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results[name] = { pass: true };
    } catch (e) {
      results[name] = { pass: false, detail: String(e) };
    } finally {
      for (const context of browser.contexts()) await context.close();
    }
  };
  try {
    if (original) {
      for (const aba of [false, true])
        await check(aba ? "original FIFO ABA loses C" : "original FIFO stale error", async () => {
          const p = await open();
          await toggle(p).click();
          await toggle(p).click();
          if (aba) {
            await toggle(p).click();
            await settle(p, 0, true);
            await settle(p, 1, true);
            await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
          } else {
            await settle(p, 0, false);
            await settle(p, 1, true);
            await expect(alert(p)).toBeVisible();
            await expect(status(p)).toHaveText("Saved.");
          }
        });
      await check("original caller captures", async () => {
        for (const lang of ["en", "he"])
          for (const width of [390, 1280])
            for (const theme of ["light", "dark"]) {
              const p = await open({ lang, width, theme });
              await toggle(p).click();
              await toggle(p).click();
              await settle(p, 0, false);
              await settle(p, 1, true);
              await expect(alert(p)).toBeVisible();
              await expect(status(p)).not.toHaveText("");
              await p.screenshot({
                path: join(
                  repo,
                  `work/kb59/captures/original-caller-${width}-${lang}-${theme}.png`
                ),
                fullPage: true,
              });
              await p.close();
            }
      });
    } else {
      await check(names[0], async () => {
        const p = await open();
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await configure(p, { stored: true });
        await expect(toggle(p)).toHaveAttribute("aria-checked", "true");
        expect((await state(p)).calls).toEqual([]);
      });
      await check(names[1], async () => {
        const p = await open();
        for (const key of ["readyPreferences", "readyStatus"]) {
          await configure(p, { [key]: false });
          await expect(toggle(p)).toHaveCount(0);
          await configure(p, { [key]: true });
          await expect(toggle(p)).toBeVisible();
        }
      });
      await check(names[2], async () => {
        const p = await open();
        await toggle(p).click();
        expect((await state(p)).calls).toEqual([
          { ref: "preferences.update", args: { coachWebSearch: true } },
        ]);
        await expect(toggle(p)).toHaveAttribute("aria-checked", "true");
        await expect(feedback(p)).toContainText("Saving");
      });
      await check(names[3], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 0, false);
        await settle(p, 1, true);
        await expect(alert(p)).toHaveCount(0);
        await expect(status(p)).toHaveText("Saved.");
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
      });
      await check(names[4], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 0, true);
        await settle(p, 1, true);
        await expect(toggle(p)).toHaveAttribute("aria-checked", "true");
        await expect(feedback(p)).toContainText("Saving");
        await expect(status(p)).toHaveText("");
        expect((await state(p)).stored).toBe(false);
        await settle(p, 2, true);
        await expect(status(p)).toHaveText("Saved.");
      });
      await check(names[5], async () => {
        const p = await open();
        await p.evaluate(() => {
          (window as any).__statusChanges = [];
          new MutationObserver(() =>
            (window as any).__statusChanges.push(
              document.querySelector(".tp-pagehead output")?.textContent
            )
          ).observe(document.querySelector(".tp-pagehead output")!, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        });
        await toggle(p).click();
        await settle(p, 0, true);
        await expect(feedback(p)).toHaveCount(0);
        await expect(status(p)).toHaveText("Saved.");
        expect(
          await p.evaluate(
            () => (window as any).__statusChanges.filter((x: string) => x === "Saved.").length
          )
        ).toBe(1);
      });
      await check(names[6], async () => {
        const p = await open();
        await toggle(p).click();
        await configure(p, { stored: false });
        await settle(p, 0, false);
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await expect(alert(p)).toContainText("stored choice");
        await expect(status(p)).toHaveText("");
      });
      await check(names[7], async () => {
        const p = await open();
        await toggle(p).click();
        await settle(p, 0, false);
        await expect(alert(p)).toBeVisible();
        await toggle(p).click();
        await expect(alert(p)).toHaveCount(0);
        expect((await state(p)).calls).toHaveLength(2);
        await settle(p, 1, true);
        await expect(status(p)).toHaveText("Saved.");
        await expect(alert(p)).toHaveCount(0);
      });
      await check(names[8], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 0, false);
        await expect(alert(p)).toHaveCount(0);
        await expect(feedback(p)).toContainText("Saving");
        await expect(status(p)).toHaveText("");
      });
      await check(names[9], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 0, true);
        await expect(feedback(p)).toContainText("Saving");
        await expect(status(p)).toHaveText("");
      });
      await check(names[10], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 1, true);
        await expect(status(p)).toHaveText("Saved.");
        await settle(p, 0, false);
        await expect(alert(p)).toHaveCount(0);
        await expect(status(p)).toHaveText("Saved.");
      });
      await check(names[11], async () => {
        const p = await open();
        await toggle(p).click();
        await toggle(p).click();
        await settle(p, 1, false);
        await expect(alert(p)).toBeVisible();
        await settle(p, 0, true);
        await expect(alert(p)).toBeVisible();
        await expect(status(p)).toHaveText("");
      });
      await check(names[12], async () => {
        const p = await open();
        await configure(p, { throwNext: true });
        await toggle(p).click();
        await expect(alert(p)).toBeVisible();
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await toggle(p).click();
        await settle(p, 0, true);
        await expect(status(p)).toHaveText("Saved.");
      });
      await check(names[13], async () => {
        const p = await open();
        await toggle(p).click();
        await configure(p, { readyStatus: false });
        await expect(toggle(p)).toHaveCount(0);
        await settle(p, 0, true);
        await expect(status(p)).toHaveText("");
        await expect(p.locator("h1")).toHaveCount(1);
      });
      await check(names[14], async () => {
        const p = await open();
        await toggle(p).click();
        await configure(p, { readyStatus: false });
        await expect(toggle(p)).toHaveCount(0);
        await configure(p, { readyStatus: true });
        await toggle(p).click();
        await settle(p, 0, false);
        await expect(alert(p)).toHaveCount(0);
        await expect(feedback(p)).toContainText("Saving");
        await settle(p, 1, true);
        await expect(status(p)).toHaveText("Saved.");
      });
      await check(names[15], async () => {
        const p = await open();
        await toggle(p).click();
        await p.evaluate(() => (window as any).__kb59.removeInCommit());
        await expect(toggle(p)).toHaveCount(0);
        await expect(status(p)).toHaveText("");
      });
      await check(names[16], async () => {
        const p = await open();
        await toggle(p).focus();
        await p.keyboard.press("Space");
        await settle(p, 0, true);
        await expect(status(p)).toHaveText("Saved.");
        await expect(toggle(p)).toBeFocused();
      });
      await check(names[17], async () => {
        const p = await open();
        await configure(p, { available: false, stored: true });
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await expect(toggle(p)).toHaveAttribute("aria-disabled", "true");
        await toggle(p).click({ force: true });
        await toggle(p).focus();
        await p.keyboard.press("Enter");
        expect((await state(p)).calls).toHaveLength(0);
        await expect(p.locator("#web-search-c")).toContainText("Not set up");
      });
      await check(names[18], async () => {
        const p = await open();
        await configure(p, { usedToday: 99, dailyLimit: 5 });
        await expect(p.locator("#web-search-c")).toContainText("0");
        await expect(toggle(p)).not.toHaveAttribute("aria-disabled", "true");
        await toggle(p).click();
        expect((await state(p)).calls).toHaveLength(1);
        await configure(p, { usedToday: -8 });
        await expect(p.locator("#web-search-c")).toContainText("5");
      });
      await check(names[19], async () => {
        const p = await open({ midnight: true });
        await toggle(p).click();
        expect((await state(p)).days).toEqual(["2026-10-20"]);
        await p.evaluate(() => {
          const fixture = (window as any).__kb59;
          fixture.dayTimers = [];
          fixture.clearedTimers = [];
          const start = window.setTimeout.bind(window);
          const stop = window.clearTimeout.bind(window);
          window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
            const id = start(callback, delay, ...args);
            if ((delay ?? 0) > 60_000) fixture.dayTimers.push(id);
            return id;
          }) as typeof window.setTimeout;
          window.clearTimeout = (id?: number) => {
            fixture.clearedTimers.push(id);
            stop(id);
          };
        });
        await p.clock.fastForward(61_000);
        expect((await state(p)).days).toEqual(["2026-10-20", "2026-10-21"]);
        await expect(toggle(p)).toHaveAttribute("aria-checked", "true");
        await expect(feedback(p)).toContainText("Saving");
        await expect
          .poll(() => p.evaluate(() => (window as any).__kb59.dayTimers.length))
          .toBeGreaterThan(0);
        await p.evaluate(() => (window as any).__kb59.unmountRoot());
        expect(
          await p.evaluate(() => {
            const fixture = (window as any).__kb59;
            return fixture.dayTimers.every((id: number) => fixture.clearedTimers.includes(id));
          })
        ).toBe(true);
        await p.clock.fastForward(86_400_000);
        expect((await state(p)).days).toEqual(["2026-10-20", "2026-10-21"]);
      });
      await check(names[20], async () => {
        const p = await open();
        await configure(p, { queryError: true });
        await expect(toggle(p)).toHaveCount(0);
        await expect(p.locator("h1")).toHaveCount(1);
        await expect(p.locator("[data-component=Dial]")).toBeVisible();
      });
      await check(names[21], async () => {
        const p = await open();
        await toggle(p).focus();
        await p.keyboard.press("Space");
        await expect(toggle(p)).toHaveAttribute("aria-checked", "true");
        await p.keyboard.press("Enter");
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await expect(toggle(p)).toBeFocused();
        const box = await toggle(p).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        const outline = await toggle(p).evaluate(
          (n: HTMLElement) => getComputedStyle(n).outlineStyle
        );
        expect(outline).not.toBe("none");
      });
      await check(names[22], async () => {
        for (const gallery of [false, true])
          for (const lang of ["en", "he"])
            for (const width of [390, 1280])
              for (const theme of ["light", "dark"]) {
                const p = await open({ gallery, lang, width, theme });
                await expect(p.locator("main")).toHaveCount(1);
                await expect(p.locator("h1")).toHaveCount(1);
                await expect(p.locator("html")).toHaveAttribute(
                  "dir",
                  lang === "he" ? "rtl" : "ltr"
                );
                await toggle(p).focus();
                await p.keyboard.press("Space");
                await expect(feedback(p)).toBeVisible();
                await expect(feedback(p)).toHaveText(
                  lang === "he"
                    ? "הבחירה נשמרת… אפשר לשנות אותה שוב."
                    : "Saving this choice… You can change it again."
                );
                const box = await toggle(p).boundingBox();
                expect(box?.height).toBeGreaterThanOrEqual(44);
                expect(box?.width).toBeGreaterThanOrEqual(44);
                const contrast = await feedback(p).evaluate((node: HTMLElement) => {
                  const parse = (value: string) =>
                    value.startsWith("#")
                      ? [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16))
                      : (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
                  const light = (rgb: number[]) =>
                    rgb
                      .map((x) => {
                        const v = x / 255;
                        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                      })
                      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
                  const fg = light(parse(getComputedStyle(node).color));
                  const root = getComputedStyle(document.documentElement);
                  return Math.min(
                    ...["--tp-ground", "--tp-paper"].map((token) => {
                      const bg = light(parse(root.getPropertyValue(token).trim()));
                      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
                    })
                  );
                });
                expect(contrast).toBeGreaterThanOrEqual(4.5);
                visualMetrics.push({ gallery, lang, width, theme, contrast, target: box });
                expect(
                  await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
                ).toBe(true);
                await expect(toggle(p)).toBeFocused();
                expect(
                  await p.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
                ).toBe(true);
                if (!gallery) {
                  await toggle(p).click();
                  await settle(p, 0, false);
                  await settle(p, 1, true);
                  await expect(status(p)).not.toHaveText("");
                  await expect(alert(p)).toHaveCount(0);
                }
                await p.screenshot({
                  path: join(
                    repo,
                    `work/kb59/captures/current-${gallery ? "gallery" : "caller"}-${width}-${lang}-${theme}.png`
                  ),
                  fullPage: true,
                });
                await p.close();
              }
      });
      await check(names[23], async () => {
        const p = await open({ gallery: true });
        await p.locator("#kb59-outcome").selectOption("error");
        await toggle(p).click();
        await expect(alert(p)).toBeVisible({ timeout: 6000 });
        await expect(toggle(p)).toHaveAttribute("aria-checked", "false");
        await p.locator("#kb59-outcome").selectOption("success");
        await toggle(p).click();
        await expect(status(p)).toHaveText("Saved.", { timeout: 6000 });
        await expect(alert(p)).toHaveCount(0);
        expect((await state(p)).calls).toHaveLength(0);
      });
      await check(names[24], async () => {
        expect(errors).toEqual([]);
        expect(consoleErrors).toEqual([]);
        expect(consoleWarnings).toEqual([]);
      });
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  await writeFile(
    join(repo, "work/kb59/visual-metrics.json"),
    JSON.stringify(visualMetrics, null, 2)
  );
  return results;
}

if (child) {
  console.log(JSON.stringify(await runFixture()));
} else {
  const { beforeAll, describe, expect, test } = await import("bun:test");
  let results: Results = {};
  beforeAll(async () => {
    const proc = Bun.spawn({
      cmd: [process.execPath, import.meta.path],
      cwd: repo,
      env: { ...process.env, KB59_FIXTURE_CHILD: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) throw Error(`KB59 clean child exit ${code}: ${err.slice(-6000)}`);
    results = JSON.parse(out.trim().split("\n").at(-1) ?? "{}");
  }, 600_000);
  describe("KB-59 web search preference request ownership", () => {
    for (const name of names) test(name, () => expect(results[name]).toEqual({ pass: true }));
  });
}
