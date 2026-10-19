import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import postcss from "../../apps/web/node_modules/postcss";
import tailwind from "../../apps/web/node_modules/@tailwindcss/postcss";
import { en, he, tKb73 } from "../../apps/web/lib/i18n-groups/kb-73";

declare global { interface Window { __kb73Calls: string[] } }

const root = process.cwd();
const web = join(root, "apps/web");
const names = [
  "English light shows Moon, names dark action, and sets explicit dark",
  "English dark shows Sun, names light action, and sets explicit light",
  "Hebrew light names the dark action with Moon",
  "Hebrew dark names the light action with Sun",
  "system preference resolved light chooses explicit dark",
  "system preference resolved dark chooses explicit light",
  "keyboard Tab, Enter and Space show focus and each activate once",
  "gallery language switch updates the name without changing theme",
  "gallery preference controls use the theme provider",
  "phone target measures at least 44 by 44 pixels",
  "mounted landing fits phone and desktop across languages and themes",
  "English and Hebrew copy keys match",
];

// Bun module mocks and build resolvers are process-global; isolate the entire browser fixture.
if (process.env.KB73_ISOLATED !== "1") {
  let output: string | undefined;
  for (const name of names) {
    test(`KB-73 isolated: ${name}`, () => {
      if (output === undefined) {
        const run = Bun.spawnSync([process.execPath, "test", import.meta.path], {
          cwd: root,
          env: { ...process.env, KB73_ISOLATED: "1" },
          stdout: "pipe",
          stderr: "pipe",
        });
        output = `${run.stdout.toString()}${run.stderr.toString()}`;
        if (run.exitCode !== 0) throw new Error(`KB-73 clean test process failed:\n${output}`);
      }
      expect(output).toContain(name);
    }, 300_000);
  }
} else {
  let browser: Browser;
  let server: ReturnType<typeof Bun.serve>;

  const stubs: Record<string, string> = {
    "@/components/providers/ThemeProvider": `import React,{createContext,useContext,useEffect,useState}from"${web}/node_modules/react";const C=createContext(null);export function ThemeProvider({children}){const q=new URLSearchParams(location.search);const system=q.get("appearance")==="dark"?"dark":"light";const initial=q.get("preference")==="system"?"system":q.get("theme")==="dark"?"dark":"light";const[theme,setPreference]=useState(initial);const resolvedTheme=theme==="system"?system:theme;useEffect(()=>{document.documentElement.dataset.theme=resolvedTheme},[resolvedTheme]);function setTheme(next){window.__kb73Calls.push(next);setPreference(next)}return React.createElement(C.Provider,{value:{theme,resolvedTheme,setTheme}},children)}export function useTheme(){return useContext(C)}`,
    "@/components/providers/LocaleProvider": `import React,{createContext,useContext,useEffect,useState}from"${web}/node_modules/react";import{translate}from"${web}/lib/i18n.ts";const C=createContext(null);export function LocaleProvider({children}){const[lang,setLang]=useState(new URLSearchParams(location.search).get("lang")==="he"?"he":"en");const dir=lang==="he"?"rtl":"ltr";useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=dir},[lang,dir]);return React.createElement(C.Provider,{value:{lang,dir,setLang,t:key=>translate(lang,key)}},children)}export function useLocale(){return useContext(C)}`,
    "next/link": `import React from"${web}/node_modules/react";export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`,
  };

  async function makeFixture() {
    const scratch = mkdtempSync(join(tmpdir(), "tempo-kb73-"));
    symlinkSync(join(web, "node_modules"), join(scratch, "node_modules"), "dir");
    const entry = join(scratch, "entry.tsx");
    writeFileSync(entry, `import React from"${web}/node_modules/react";import{createRoot}from"${web}/node_modules/react-dom/client";import{ThemeProvider}from"@/components/providers/ThemeProvider";import{LocaleProvider}from"@/components/providers/LocaleProvider";import{LandingPage}from"${web}/components/marketing-pages/LandingPage.tsx";import{Kb73Gallery}from"${web}/components/marketing/ThemeToggle.tsx";window.__kb73Calls=[];const gallery=new URLSearchParams(location.search).has("gallery");createRoot(document.getElementById("root")!).render(<ThemeProvider><LocaleProvider>{gallery?<Kb73Gallery/>:<LandingPage/>}</LocaleProvider></ThemeProvider>);`);
    const built = await Bun.build({
      entrypoints: [entry], outdir: scratch, target: "browser",
      plugins: [{ name: "kb73-context-boundaries", setup(build) {
        build.onResolve({ filter: /^(next\/link|@\/components\/providers\/(ThemeProvider|LocaleProvider))$/ }, args => ({ path: args.path, namespace: "kb73" }));
        build.onLoad({ filter: /.*/, namespace: "kb73" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
        build.onResolve({ filter: /^@\// }, args => {
          const base = join(web, args.path.slice(2));
          const path = [base, `${base}.ts`, `${base}.tsx`, `${base}.css`, `${base}/index.ts`, `${base}/index.tsx`].find(existsSync);
          return path ? { path } : undefined;
        });
      } }],
    });
    if (!built.success) throw new Error(built.logs.map(String).join("\n"));
    const outputs = new Map(built.outputs.map(item => [basename(item.path), item]));
    const js = [...outputs.keys()].find(name => name.endsWith(".js"));
    const cssFiles = [...outputs.keys()].filter(name => name.endsWith(".css"));
    if (!js || cssFiles.length === 0) throw new Error("KB-73 browser bundle must contain JavaScript and scoped CSS");
    const globalsPath = join(web, "app/globals.css");
    const compiled = await postcss([tailwind()]).process(await Bun.file(globalsPath).text(), { from: globalsPath });
    const styles = `${compiled.css}\n${(await Promise.all(cssFiles.map(name => outputs.get(name)!.text()))).join("\n")}`;
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/styles.css") return new Response(styles, { headers: { "content-type": "text/css" } });
      const output = outputs.get(url.pathname.slice(1));
      if (output) return new Response(output, { headers: { "content-type": output.path.endsWith(".js") ? "text/javascript" : "text/css" } });
      if (url.pathname !== "/") return new Response("not found", { status: 404 });
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const theme = url.searchParams.get("theme") === "dark" || url.searchParams.get("appearance") === "dark" ? "dark" : "light";
      return new Response(`<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/${js}"></script></body></html>`, { headers: { "content-type": "text/html" } });
    } });
  }

  function executable(): string {
    const candidates = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
    const found = candidates.find(existsSync);
    if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
    return found;
  }
  async function open(width = 390, query = ""): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.port}/?${query}`, { waitUntil: "domcontentloaded" });
    try { await page.locator(".kb73-theme-toggle").waitFor(); }
    catch (error) { throw new Error(`KB-73 mounted button missing: ${errors.join(" | ")}`, { cause: error }); }
    if (errors.length) throw new Error(`KB-73 browser errors: ${errors.join(" | ")}`);
    return page;
  }
  async function calls(page: Page): Promise<string[]> { return page.evaluate(() => window.__kb73Calls); }
  async function icon(page: Page): Promise<"Sun" | "Moon"> {
    const shape = await page.locator(".kb73-theme-toggle svg").evaluate(svg => ({
      circle: svg.querySelectorAll("circle").length,
      path: svg.querySelector("path")?.getAttribute("d"),
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
    }));
    expect(shape.width).toBe("16");
    expect(shape.height).toBe("16");
    if (shape.circle === 1 && shape.path?.startsWith("M12 2v2")) return "Sun";
    if (shape.circle === 0 && shape.path === "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z") return "Moon";
    throw new Error(`Unexpected theme icon SVG: ${JSON.stringify(shape)}`);
  }
  async function capture(page: Page, width: number, lang: string, theme: string) {
    const dir = process.env.KB73_EVIDENCE_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `after-${width}-${lang}-${theme}.png`) });
  }

  describe.serial("KB-73 actual landing host", () => {
    beforeAll(async () => { await makeFixture(); browser = await chromium.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] }); }, 120_000);
    afterAll(async () => { await browser?.close(); server?.stop(true); }, 30_000);

    for (const [lang, theme, label, next, expectedIcon] of [
      ["en", "light", "Switch to dark mode", "dark", "Moon"],
      ["en", "dark", "Switch to light mode", "light", "Sun"],
      ["he", "light", "מעבר למצב כהה", "dark", "Moon"],
      ["he", "dark", "מעבר למצב בהיר", "light", "Sun"],
    ] as const) {
      test(`${lang === "en" ? "English" : "Hebrew"} ${theme} ${lang === "en" ? `shows ${expectedIcon}, names ${next} action, and sets explicit ${next}` : `names the ${next} action with ${expectedIcon}`}`, async () => {
        const page = await open(390, `lang=${lang}&theme=${theme}`);
        const button = page.locator(".kb73-theme-toggle");
        expect(await page.getByRole("button", { name: label }).count()).toBe(1);
        expect(await icon(page)).toBe(expectedIcon);
        await button.click();
        expect(await calls(page)).toEqual([next]);
        expect(await button.getAttribute("aria-label")).toBe(tKb73(lang, next === "dark" ? "switchLight" : "switchDark"));
        await page.close();
      }, 90_000);
    }
    for (const [appearance, next] of [["light", "dark"], ["dark", "light"]] as const) {
      test(`system preference resolved ${appearance} chooses explicit ${next}`, async () => {
        const page = await open(390, `preference=system&appearance=${appearance}`);
        expect(await page.locator(".kb73-theme-toggle").getAttribute("aria-label")).toBe(tKb73("en", next === "dark" ? "switchDark" : "switchLight"));
        await page.locator(".kb73-theme-toggle").click();
        expect(await calls(page)).toEqual([next]);
        await page.close();
      }, 90_000);
    }
    test("keyboard Tab, Enter and Space show focus and each activate once", async () => {
      const page = await open();
      const button = page.locator(".kb73-theme-toggle");
      for (let index = 0; index < 12 && !(await button.evaluate(node => node === document.activeElement)); index++) await page.keyboard.press("Tab");
      expect(await button.evaluate(node => node === document.activeElement && node.matches(":focus-visible"))).toBe(true);
      await page.waitForFunction(() => {
        const node = document.querySelector(".kb73-theme-toggle");
        if (!node) return false;
        const style = getComputedStyle(node);
        return node.matches(":focus-visible") && (style.outlineStyle !== "none" || style.boxShadow !== "none");
      });
      const focus = await button.evaluate(node => ({ outline: getComputedStyle(node).outlineStyle, shadow: getComputedStyle(node).boxShadow }));
      expect(focus.outline !== "none" || focus.shadow !== "none").toBe(true);
      await page.keyboard.press("Enter");
      expect(await calls(page)).toEqual(["dark"]);
      await page.keyboard.press("Space");
      expect(await calls(page)).toEqual(["dark", "light"]);
      await page.close();
    }, 90_000);
    test("gallery language switch updates the name without changing theme", async () => {
      const page = await open(390, "gallery=1");
      expect(await page.locator(".kb73-theme-toggle").getAttribute("aria-label")).toBe(en.switchDark);
      await page.getByRole("button", { name: "עברית" }).click();
      expect(await page.locator(".kb73-theme-toggle").getAttribute("aria-label")).toBe(he.switchDark);
      expect(await page.locator("main").getAttribute("dir")).toBe("rtl");
      expect(await calls(page)).toEqual([]);
      await page.close();
    }, 90_000);
    test("gallery preference controls use the theme provider", async () => {
      const page = await open(390, "gallery=1&appearance=dark&preference=system");
      expect(await page.locator(".kb73-theme-toggle").getAttribute("aria-label")).toBe(en.switchLight);
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await page.getByRole("button", { name: "System", exact: true }).click();
      expect(await calls(page)).toEqual(["light", "system"]);
      expect(await page.locator(".kb73-theme-toggle").getAttribute("aria-label")).toBe(en.switchLight);
      await page.close();
    }, 90_000);
    test("phone target measures at least 44 by 44 pixels", async () => {
      const page = await open();
      const box = await page.locator(".kb73-theme-toggle").boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await page.close();
    }, 90_000);
    test("mounted landing fits phone and desktop across languages and themes", async () => {
      for (const width of [390, 1280]) for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
        const page = await open(width, `lang=${lang}&theme=${theme}`);
        expect(await page.locator("main").count()).toBe(1);
        expect(await page.locator("h1").count()).toBe(1);
        expect(await page.locator("html").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const motion = await page.locator(".kb73-theme-toggle").evaluate(node => getComputedStyle(node).transitionDuration.split(",").map(value => parseFloat(value)).filter(Number.isFinite));
        expect(motion.every(duration => duration <= 0.01)).toBe(true);
        await capture(page, width, lang, theme);
        await page.close();
      }
    }, 120_000);
    test("English and Hebrew copy keys match", () => {
      expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(tKb73("en", key).length).toBeGreaterThan(0);
        expect(tKb73("he", key).length).toBeGreaterThan(0);
      }
    });
  });
}
