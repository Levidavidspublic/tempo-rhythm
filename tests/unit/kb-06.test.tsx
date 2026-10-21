import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { en, he, tKb06 } from "../../apps/web/lib/i18n-groups/kb-06";

const repo = process.cwd();
const web = join(repo, "apps/web");
const component = join(web, "components/goals/GoalDetailScreen.tsx");
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let origin: string;
let temp: string;

const stubs: Record<string, string> = {
  "convex/react": `export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const useQuery=ref=>{if(ref?.__kb==="profile")return {_id:"fictional-user"};const state=new URLSearchParams(location.search).get("scenario");if(state==="loading")return undefined;if(state==="missing")return [];return [{_id:"fictional-goal",title:state==="long"?"A calm home with a thoughtful place for every book and every visit from Dana and Yoni, without rushing into a decision":"A calmer home for Maya",description:state==="long"?"A smaller place close to work where evenings feel calm, guests can stay, books have room, and the choice has time to feel right.":"A smaller place near work, with room for Dana and Yoni to visit.",progressPercent:new URLSearchParams(location.search).has("progress")?Number(new URLSearchParams(location.search).get("progress")):35,status:state==="completed"?"completed":"active",createdAt:1,updatedAt:1}]};export const useMutation=()=>async patch=>{window.__kbCalls.push(patch);return null};`,
  "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`,
  "@/components/providers/LocaleProvider": `export function useLocale(){const he=document.documentElement.lang==="he";const en={"gd.back":"Goals","gd.titleLabel":"Goal title","gd.status":"Status","gd.why.h":"Why this matters","gl.status.active":"Active","gl.status.resting":"Resting","gl.status.done":"Done","gl.draftwhy":"Why this matters","gx.saveError":"Couldn't save"};const tr={"gd.back":"יעדים","gd.titleLabel":"שם היעד","gd.status":"מצב","gd.why.h":"למה זה חשוב","gl.status.active":"פעיל","gl.status.resting":"במנוחה","gl.status.done":"הושלם","gl.draftwhy":"למה זה חשוב","gx.saveError":"לא נשמר"};return{lang:he?"he":"en",dir:he?"rtl":"ltr",t:k=>(he?tr:en)[k]??k}}`,
  "@/convex/_generated/api": `export const api={users:{getProfile:{__kb:"profile"}},goals:{list:{__kb:"goals"},update:{}}};`,
  "./shared": `export{StatusBadge,ScreenBoundary,SignedOutState}from"${web}/components/goals/shared.tsx";export const useOnline=()=>new URLSearchParams(location.search).get("scenario")!=="offline";export const useSignedIn=()=>"ready";`,
};

async function makeFixture() {
  const fixtureParent = join(repo, "work");
  mkdirSync(fixtureParent, { recursive: true });
  temp = mkdtempSync(join(fixtureParent, "kb06-"));
  symlinkSync(join(web, "node_modules"), join(temp, "node_modules"), "dir");
  writeFileSync(join(temp, "entry.tsx"), `import React from "${web}/node_modules/react";import{createRoot}from"${web}/node_modules/react-dom/client";import{TpIconSprite}from"${web}/components/tempo/TpIcon.tsx";import{GoalDetailScreen,GoalProgressSummary,Kb06Gallery}from"${component}";window.__kbCalls=[];const params=new URLSearchParams(location.search);const gallery=params.has("gallery");createRoot(document.getElementById("root")!).render(<><TpIconSprite/>{gallery?<Kb06Gallery/>:params.has("summary")?<main><h1>Progress fixture</h1><GoalProgressSummary progress={Number(params.get("progress"))} lang={document.documentElement.lang==="he"?"he":"en"}/></main>:<main><GoalDetailScreen goalId="fictional-goal"/></main>}</>);`);
  const result = await Bun.build({
    entrypoints: [join(temp, "entry.tsx")], outdir: temp, target: "browser", define: { "process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS": '"0"' },
    plugins: [{ name: "kb06-fictional-data", setup(build) {
      build.onResolve({ filter: /^(convex\/react|next\/link|@\/components\/providers\/LocaleProvider|@\/convex\/_generated\/api|\.\/shared)$/ }, args => ({ path: args.path, namespace: "kb06" }));
      build.onLoad({ filter: /.*/, namespace: "kb06" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
    } }],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  const files = result.outputs.map(output => basename(output.path));
  const css = files.filter(file => file.endsWith(".css"));
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const dir = lang === "he" ? "rtl" : "ltr";
      const textSize = url.searchParams.get("size") === "l" ? "l" : "m";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      return new Response(`<!doctype html><html lang="${lang}" dir="${dir}" data-text-size="${textSize}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${css.map(file => `<link rel="stylesheet" href="/${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
    }
    const path = url.pathname === "/globals.css" ? join(web, "app/globals.css") : files.includes(url.pathname.slice(1)) ? join(temp, url.pathname) : join(web, "app", url.pathname);
    const file = Bun.file(path);
    return file.exists().then(exists => exists ? new Response(file, { headers: { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }) : new Response("not found", { status: 404 }));
  } });
  origin = `http://127.0.0.1:${server.port}`;
}

function browserExecutable(): string {
  const candidates = ["/usr/bin/chromium", chromium.executablePath(), "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
  return found;
}

async function open(width = 390, params = ""): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${origin}/?${params}`, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor();
  await page.locator("h1").waitFor();
  return page;
}

async function capture(page: Page, name: string) {
  const dir = process.env.KB06_EVIDENCE_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name), fullPage: true });
}

beforeAll(async () => {
  await makeFixture();
  browser = await chromium.launch({ executablePath: browserExecutable(), headless: true, args: ["--no-sandbox"] });
}, 60_000);
afterAll(async () => { await browser?.close(); server?.stop(); if (temp) rmSync(temp, { recursive: true, force: true }); });

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

describe.serial("KB-06 mounted goal detail and gallery", () => {
  test("missing goal shows unavailable and never invents a goal", async () => {
    const page = await open(390, "scenario=missing");
    expect(await page.getByText(tKb06("en", "kb06.unavailable")).count()).toBe(1);
    expect(await page.getByText("A calmer home for Maya").count()).toBe(0);
    expect(await page.locator("main").count()).toBe(1);
    expect(await page.locator("h1").count()).toBe(1);
    await page.close();
  }, 60_000);
  test("loading has a distinct live status", async () => {
    const page = await open(390, "scenario=loading");
    expect(await page.getByRole("heading", { name: tKb06("en", "kb06.loading") }).count()).toBe(1);
    expect(await page.getByRole("status").getAttribute("aria-busy")).toBe("true");
    await page.close();
  }, 60_000);
  test("offline explains that a save may need another try", async () => {
    const page = await open(390, "scenario=offline");
    expect(await page.getByRole("status").filter({ hasText: tKb06("en", "kb06.offline") }).count()).toBe(1);
    await page.close();
  }, 60_000);
  test("long goal text wraps without horizontal overflow", async () => {
    const page = await open(390, "scenario=long");
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  }, 60_000);
  test("keyboard title save keeps the existing update payload", async () => {
    const page = await open();
    const title = page.getByRole("textbox", { name: "Goal title" });
    await title.focus();
    await title.fill("A thoughtful home for Maya");
    await title.press("Enter");
    await page.waitForFunction(() => window.__kbCalls.length === 1);
    expect(await page.evaluate(() => window.__kbCalls[0])).toEqual({ goalId: "fictional-goal", title: "A thoughtful home for Maya" });
    await page.close();
  }, 60_000);
  test("why blur keeps the existing description payload", async () => {
    const page = await open();
    const why = page.locator("textarea.gd-why__input");
    await why.fill("A place to rest.");
    await why.blur();
    await page.waitForFunction(() => window.__kbCalls.length === 1);
    expect(await page.evaluate(() => window.__kbCalls[0])).toEqual({ goalId: "fictional-goal", description: "A place to rest." });
    await page.close();
  }, 60_000);
  test("clearing why preserves the null description update payload", async () => {
    const page = await open();
    const why = page.locator("textarea.gd-why__input");
    await why.fill("");
    await why.blur();
    await page.waitForFunction(() => window.__kbCalls.length === 1);
    expect(await page.evaluate(() => window.__kbCalls)).toEqual([{ goalId: "fictional-goal", description: null }]);
    await page.close();
  }, 60_000);
  test("status selection keeps the existing status payload", async () => {
    const page = await open();
    await page.locator("#gd-status").selectOption("done");
    await page.waitForFunction(() => window.__kbCalls.length === 1);
    expect(await page.evaluate(() => window.__kbCalls[0])).toEqual({ goalId: "fictional-goal", status: "completed" });
    await page.close();
  }, 60_000);
  test("Hebrew layout is RTL and user text keeps auto direction", async () => {
    const page = await open(390, "lang=he");
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    expect(await page.locator("textarea").getAttribute("dir")).toBe("auto");
    expect(await page.getByRole("heading", { name: tKb06("he", "kb06.milestones") }).count()).toBe(1);
    expect(await noOverflow(page)).toBe(true);
    await capture(page, "after-390-he.png");
    await page.close();
  }, 60_000);
  test("large text remains readable at phone width", async () => {
    const page = await open(390, "size=l");
    expect(await noOverflow(page)).toBe(true);
    const minTarget = await page.locator("#gd-status").evaluate(node => node.getBoundingClientRect().height);
    expect(minTarget).toBeGreaterThanOrEqual(44);
    expect(await page.locator(".gx-title-input").evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.close();
  }, 60_000);
  test("real progress is labelled and empty milestones are honest", async () => {
    const page = await open();
    expect(await page.getByRole("progressbar", { name: "Progress" }).getAttribute("aria-valuenow")).toBe("35");
    expect(await page.getByText(tKb06("en", "kb06.empty")).count()).toBe(1);
    await capture(page, "after-390-en.png");
    await page.close();
  }, 60_000);
  test("stored completed status preserves partial progress without writing", async () => {
    const page = await open(390, "scenario=completed&progress=35");
    expect(await page.locator("#gd-status").inputValue()).toBe("done");
    expect(await page.locator('[data-component="ProjectStatus"]').innerText()).toBe("Done");
    expect(await page.getByRole("progressbar", { name: "Progress" }).getAttribute("aria-valuenow")).toBe("35");
    expect(await page.evaluate(() => window.__kbCalls)).toEqual([]);
    await page.close();
  }, 60_000);
  test("fractional stored progress remains exact without rounding or writing", async () => {
    for (const progress of [0.4, 35.75, 99.5]) {
      const page = await open(390, `progress=${progress}`);
      expect(await page.getByRole("progressbar", { name: "Progress" }).getAttribute("aria-valuenow")).toBe(String(progress));
      expect(await page.locator(".kb06-goal__progress-value").innerText()).toBe(`${progress}%`);
      expect(await page.locator(".kb06-goal__progress-fill").evaluate(node => (node as HTMLElement).style.inlineSize)).toBe(`${progress}%`);
      expect(await page.evaluate(() => window.__kbCalls)).toEqual([]);
      await page.close();
    }
  }, 60_000);
  test("mounted progress safely displays non-finite and out-of-range values without writing", async () => {
    for (const [stored, displayed] of [["NaN", "0"], ["Infinity", "0"], ["-Infinity", "0"], ["-12", "0"], ["140", "100"]]) {
      const page = await open(390, `progress=${stored}`);
      expect(await page.getByRole("progressbar", { name: "Progress" }).getAttribute("aria-valuenow")).toBe(displayed);
      expect(await page.locator(".kb06-goal__progress-value").innerText()).toBe(`${displayed}%`);
      expect(await page.evaluate(() => window.__kbCalls)).toEqual([]);
      expect(await noOverflow(page)).toBe(true);
      await page.close();
    }
  }, 60_000);
  test("named progress export renders the supplied percentage independently", async () => {
    const page = await open(390, "summary=1&progress=42&lang=he");
    expect(await page.getByRole("progressbar", { name: tKb06("he", "kb06.progress") }).getAttribute("aria-valuenow")).toBe("42");
    expect(await page.locator(".kb06-goal__progress-value").innerText()).toBe("42%");
    await page.close();
  }, 60_000);
  test("gallery states, language, retry, disabled action and focus work", async () => {
    const page = await open(390, "gallery=1");
    expect(await page.locator("main").count()).toBe(1);
    expect(await page.locator("h1").count()).toBe(1);
    await capture(page, "gallery-default-390-en.png");
    for (const key of ["kb06.galleryEmpty", "kb06.galleryLoading", "kb06.galleryError", "kb06.galleryDisabled", "kb06.galleryOverflow"] as const) {
      await page.getByRole("button", { name: tKb06("en", key) }).click();
      await capture(page, `gallery-${key.slice("kb06.gallery".length).toLowerCase()}-390-en.png`);
    }
    await page.getByRole("button", { name: tKb06("en", "kb06.galleryError") }).click();
    const retry = page.getByRole("button", { name: tKb06("en", "kb06.retry") });
    await retry.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await retry.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe("none");
    await page.keyboard.press("Enter");
    expect(await page.getByText("Retries: 1").count()).toBe(1);
    await page.getByRole("button", { name: tKb06("en", "kb06.galleryDisabled") }).click();
    expect(await retry.isDisabled()).toBe(true);
    await page.getByRole("button", { name: tKb06("en", "kb06.galleryHe") }).click();
    expect(await page.locator("main").getAttribute("dir")).toBe("rtl");
    expect(await noOverflow(page)).toBe(true);
    expect(await page.locator(".kb06-gallery__controls button").evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44))).toBe(true);
    await capture(page, "gallery-disabled-390-he.png");
    await page.close();
  }, 60_000);
  test("English and Hebrew keys match", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  }, 60_000);
  test("desktop English and Hebrew remain within viewport", async () => {
    for (const lang of ["en", "he"]) {
      const page = await open(1280, `lang=${lang}`);
      expect(await noOverflow(page)).toBe(true);
      await capture(page, `after-1280-${lang}.png`);
      await page.close();
    }
  }, 60_000);
  test("dark mode and reduced motion preserve readable gallery controls", async () => {
    for (const width of [390, 1280]) for (const lang of ["en", "he"]) {
      const mounted = await open(width, `theme=dark&lang=${lang}`);
      expect(await noOverflow(mounted)).toBe(true);
      await capture(mounted, `after-${width}-${lang}-dark.png`);
      await mounted.close();
      const page = await open(width, `gallery=1&theme=dark&lang=${lang}`);
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await noOverflow(page)).toBe(true);
      expect(await page.locator(".kb06-gallery__controls button").first().evaluate(node => getComputedStyle(node).color)).not.toBe("rgba(0, 0, 0, 0)");
      await capture(page, `gallery-dark-${width}-${lang}.png`);
      await page.close();
    }
  }, 60_000);
});

declare global { interface Window { __kbCalls: Array<Record<string, unknown>> } }
