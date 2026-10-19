import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { en, he, kb04t } from "../../apps/web/lib/i18n-groups/kb-04";
import { JournalDayHeading, JournalLoadMore, Kb04Gallery } from "../../apps/web/components/journal/JournalScreen";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";

const repo = process.cwd();
const web = join(repo, "apps/web");
const component = join(web, "components/journal/JournalScreen.tsx");
setDefaultTimeout(45_000);
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let origin: string;
let fixtureDir: string;

const stubs: Record<string, string> = {
  "convex/react": `import React from "${web}/node_modules/react";const rows=(before, scenario, released)=>{if(scenario==="loading" || (scenario==="delayed" && before!=="2026-10-19" && !released))return undefined;if(scenario==="empty")return [];if(before!=="2026-10-19"){if(scenario==="end")return [];return scenario==="multiple"||scenario==="delayed"?[{_id:"fictional-extra-1",date:"2026-10-08",title:"Maya's next day",tags:[]},{_id:"fictional-extra-2",date:"2026-10-07",title:"Dana's next day",tags:[]}]:[]};const count=scenario==="one"?1:10;return Array.from({length:count},(_,i)=>({_id:"fictional-"+i,date:"2026-10-"+String(18-i).padStart(2,"0"),title:i===0?"Maya's quiet morning":i===1?"Dana's walk":null,tags:i===0?["Reflection"]:[]}))};export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const useQuery=(ref,args)=>{const released=React.useSyncExternalStore(fn=>{window.addEventListener("kb04:query",fn);return()=>window.removeEventListener("kb04:query",fn)},()=>!!window.__loadedMore,()=>false);return args?.pageType==="daily"?rows(args.before,new URLSearchParams(location.search).get("scenario"),released):{name:"Maya"}};`,
  "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`,
  "@/components/providers/LocaleProvider": `import {translate} from "${web}/lib/i18n.ts";export function useLocale(){const lang=document.documentElement.lang==="he"?"he":"en";return {lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key)}}`,
  "@/convex/_generated/api": `export const api={users:{getProfile:{}},notes:{listPeriodPages:{}}};`,
  "@/lib/useLocalDayBounds": `export function useLocalDayBounds(){return {startMs:Date.parse("2026-10-19T00:00:00Z")}}`,
};

function browserExecutable(): string {
  const candidates = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
  return found;
}

async function makeFixture() {
  mkdirSync(join(repo, "work"), { recursive: true });
  fixtureDir = mkdtempSync(join(repo, "work", "kb-04-"));
  symlinkSync(join(web, "node_modules"), join(fixtureDir, "node_modules"), "dir");
  writeFileSync(join(fixtureDir, "entry.tsx"), `import React from "${web}/node_modules/react";import {createRoot} from "${web}/node_modules/react-dom/client";import {TpIconSprite} from "${web}/components/tempo/TpIcon";import {JournalScreen,Kb04Gallery} from "${component}";window.__loadedMore=false;window.__releaseMore=()=>{window.__loadedMore=true;window.dispatchEvent(new Event("kb04:query"))};const params=new URLSearchParams(location.search);const lang=document.documentElement.lang==="he"?"he":"en";createRoot(document.getElementById("root")!).render(<React.StrictMode><TpIconSprite/>{params.has("gallery")?<Kb04Gallery lang={lang}/>:<main><JournalScreen/></main>}</React.StrictMode>);`);
  const result = await Bun.build({
    entrypoints: [join(fixtureDir, "entry.tsx")], outdir: fixtureDir, target: "browser",
    plugins: [{ name: "kb04-fictional-data", setup(build) {
      build.onResolve({ filter: /^(convex\/react|next\/link|@\/components\/providers\/LocaleProvider|@\/convex\/_generated\/api|@\/lib\/useLocalDayBounds)$/ }, args => ({ path: args.path, namespace: "kb04" }));
      build.onLoad({ filter: /.*/, namespace: "kb04" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
    } }],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  for (const output of result.outputs) writeFileSync(join(fixtureDir, basename(output.path)), await output.arrayBuffer());
  const files = result.outputs.map(output => basename(output.path));
  const css = files.filter(file => file.endsWith(".css"));
  server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const dir = lang === "he" ? "rtl" : "ltr";
      const size = url.searchParams.get("size") === "l" ? "l" : "m";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      const html = `<!doctype html><html lang="${lang}" dir="${dir}" data-text-size="${size}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${css.map(file => `<link rel="stylesheet" href="/${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`;
      return new Response(html, { headers: { "content-type": "text/html" } });
    }
    const name = url.pathname.slice(1);
    const path = files.includes(name) ? join(fixtureDir, name) : resolve(web, "app", name);
    if (!path.startsWith(fixtureDir) && !path.startsWith(join(web, "app"))) return new Response("not found", { status: 404 });
    const file = Bun.file(path);
    return file.exists().then(exists => exists ? new Response(file, { headers: { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }) : new Response("not found", { status: 404 }));
  } });
  origin = `http://127.0.0.1:${server.port}`;
}

async function open(width = 390, params = ""): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", error => console.error("KB-04 fixture page error:", error.message));
  await page.goto(`${origin}/?${params}`, { waitUntil: "commit", timeout: 60_000 });
  try { await page.locator("h1").waitFor({ state: "attached", timeout: 15_000 }); }
  catch (error) { throw new Error(`KB-04 fixture did not hydrate: ${(await page.content()).slice(0, 1000)}; ${String(error)}`); }
  return page;
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function capture(page: Page, name: string) {
  const dir = process.env.KB04_EVIDENCE_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name), fullPage: true });
}

beforeAll(async () => {
  await makeFixture();
  browser = await chromium.launch({ executablePath: browserExecutable(), headless: true, args: ["--no-sandbox"] });
}, 120_000);
afterAll(async () => { await browser?.close(); server?.stop(); if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true }); });

describe.serial("KB-04 mounted journal and gallery", () => {
  test("no entries has one calm empty state", async () => {
    const page = await open(390, "scenario=empty");
    await page.getByText(kb04t("en", "kb04.empty")).waitFor();
    expect(await page.getByRole("heading", { level: 2 }).count()).toBe(1);
    expect(await page.locator("main").count()).toBe(1);
    await page.close();
  });
  test("one day has a semantic heading and a quiet end", async () => {
    const page = await open(390, "scenario=one");
    await page.getByRole("heading", { level: 2, name: "Maya's quiet morning" }).waitFor();
    expect(await page.getByText(kb04t("en", "kb04.end")).count()).toBe(1);
    expect(await page.locator("time[dir=ltr]").count()).toBe(1);
    await page.close();
  });
  test("multiple chunks load by keyboard and focus the first new day", async () => {
    const page = await open(390, "scenario=multiple");
    const more = page.getByRole("button", { name: kb04t("en", "kb04.more") });
    await more.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Maya's next day" }).waitFor();
    expect(await page.locator(".kb04-day").count()).toBe(12);
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Maya's next day");
    await page.close();
  });
  test("StrictMode replay keeps focus on a delayed chunk when it arrives", async () => {
    const page = await open(390, "scenario=delayed");
    const more = page.getByRole("button", { name: kb04t("en", "kb04.more") });
    await more.focus();
    await page.keyboard.press("Enter");
    expect(await page.getByRole("button", { name: kb04t("en", "kb04.loading") }).count()).toBe(1);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
    await page.evaluate(() => (window as unknown as { __releaseMore: () => void }).__releaseMore());
    await page.getByRole("heading", { name: "Maya's next day" }).waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "Maya's next day");
    await page.close();
  });
  test("moving focus away during loading is respected", async () => {
    const page = await open(390, "scenario=delayed");
    await page.getByRole("button", { name: kb04t("en", "kb04.more") }).click();
    const firstDay = page.getByRole("link", { name: /Maya's quiet morning/ });
    await firstDay.focus();
    await page.evaluate(() => (window as unknown as { __releaseMore: () => void }).__releaseMore());
    await page.getByRole("heading", { name: "Maya's next day" }).waitFor();
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => document.activeElement?.textContent?.includes("Maya's quiet morning"))).toBe(true);
    await page.close();
  });
  test("end after a full chunk retains focus on the end message", async () => {
    const page = await open(390, "scenario=end");
    await page.getByRole("button", { name: kb04t("en", "kb04.more") }).click();
    await page.getByText(kb04t("en", "kb04.end")).waitFor();
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe(kb04t("en", "kb04.end"));
    await page.close();
  });
  test("loading stays distinct from the end message", async () => {
    const page = await open(390, "scenario=loading");
    expect(await page.getByRole("status").getByText(kb04t("en", "kb04.loading")).count()).toBe(1);
    expect(await page.getByText(kb04t("en", "kb04.end")).count()).toBe(0);
    await page.close();
  });
  test("Hebrew dates use LTR isolates in an RTL page", async () => {
    const page = await open(390, "scenario=one&lang=he");
    await page.locator(".kb04-day time").waitFor();
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    expect(await page.locator(".kb04-day time").getAttribute("dir")).toBe("ltr");
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  });
  test("large text remains readable with 44 px phone controls", async () => {
    const page = await open(390, "scenario=multiple&size=l");
    const more = page.getByRole("button", { name: kb04t("en", "kb04.more") });
    await more.waitFor();
    expect(await more.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  });
  test("overflow titles and tags wrap without horizontal scrolling", async () => {
    const page = await open(390, "gallery=1");
    await page.getByRole("button", { name: kb04t("en", "kb04.overflowState") }).click();
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  });
  test("gallery empty, loading, error, retry and disabled are interactive", async () => {
    const page = await open(390, "gallery=1");
    expect(await page.locator("main").count()).toBe(1);
    expect(await page.locator("h1").count()).toBe(1);
    for (const [key, visible] of [["kb04.emptyState","kb04.empty"],["kb04.loadingState","kb04.loading"],["kb04.errorState","kb04.error"]] as const) {
      await page.getByRole("button", { name: kb04t("en", key) }).click();
      expect(await page.getByText(kb04t("en", visible)).count()).toBe(1);
    }
    await page.getByRole("button", { name: kb04t("en", "kb04.retry") }).click();
    await page.getByRole("button", { name: kb04t("en", "kb04.disabledState") }).click();
    expect(await page.getByRole("button", { name: kb04t("en", "kb04.more") }).isDisabled()).toBe(true);
    await page.close();
  });
  test("gallery Load more calls back and returns focus to the added heading", async () => {
    const page = await open(390, "gallery=1");
    const more = page.getByRole("button", { name: kb04t("en", "kb04.more") });
    await more.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "One more day" }).waitFor();
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("One more day");
    await page.close();
  });
  test("keyboard focus is visible and reduced motion removes transitions", async () => {
    const page = await open(390, "gallery=1");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const node = document.activeElement as HTMLElement;
      const style = getComputedStyle(node);
      return { tag: node.tagName, width: style.outlineWidth, motion: style.transitionDuration };
    });
    expect(focused.tag).toBe("BUTTON");
    expect(Number.parseFloat(focused.width)).toBeGreaterThanOrEqual(2);
    // The shared policy uses 0.01ms; CSSOM may serialize time in either unit.
    const seconds = (value: string) => Number.parseFloat(value) * (value.trim().endsWith("ms") ? 0.001 : 1);
    expect(focused.motion.split(",").every(value => seconds(value) <= 0.000011)).toBe(true);
    await page.close();
  });
  test("new exports render and English/Hebrew keys match", () => {
    const heading = renderToStaticMarkup(createElement(JournalDayHeading, { date: "2026-10-19", lang: "he" }));
    const button = renderToStaticMarkup(createElement(JournalLoadMore, { lang: "en", onLoad() {} }));
    const gallery = renderToStaticMarkup(createElement(Kb04Gallery, { lang: "en" }));
    expect(heading).toContain('dir="ltr"');
    expect(button).toContain(kb04t("en", "kb04.more"));
    expect(gallery).toContain("<main");
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });
  test("mounted screenshots cover 390/1280, en/he and light/dark", async () => {
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"] as const) {
      const page = await open(width, `scenario=multiple&lang=${lang}&theme=${theme}`);
      await page.locator(".kb04-day").first().waitFor();
      await page.locator(".kb04-day").nth(9).waitFor();
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await noOverflow(page)).toBe(true);
      await capture(page, `after-${width}-${lang}-${theme}.png`);
      await page.close();
    }
  }, 300_000);
  test("hydrated gallery works at phone and desktop widths in both locales and themes", async () => {
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"] as const) {
      const page = await open(width, `gallery=1&lang=${lang}&theme=${theme}`);
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
      await capture(page, `gallery-${width}-${lang}-${theme}.png`);
      if (width === 390) expect(await page.getByRole("button", { name: kb04t(lang, "kb04.more") }).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      expect(await noOverflow(page)).toBe(true);
      await page.close();
    }
  }, 300_000);
});
