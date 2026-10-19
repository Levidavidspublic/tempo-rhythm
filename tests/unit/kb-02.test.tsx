import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import * as bun from "bun";
import { en, he, tKb02 } from "../../apps/web/lib/i18n-groups/kb-02";
import { translate } from "../../apps/web/lib/i18n";

const repo = process.cwd();
const web = join(repo, "apps/web");
const source = process.env.KB02_BEFORE_SOURCE ?? join(web, "components/brain-dump/BrainDumpScreen.tsx");
const beforeMode = Boolean(process.env.KB02_BEFORE_SOURCE);
const plan = { summary: "A quieter week for Maya.", priorities: [
  { title: "Ask Dana about Friday", reason: "There is time to decide.", urgency: "now" },
  { title: "Make space for Yoni's visit", reason: "A small first step.", urgency: "soon" },
] };
declare global {
  interface Window {
    __kbCalls: { kind: string; args: unknown }[];
    __kbResolve: (value: typeof plan) => void;
    __kbResolveUndo: (value: null) => void;
  }
}
// Bun.build's plugin resolver can leak into later Bun.build tests in the shared test process.
// Run this browser fixture in a clean child while retaining named cases in the main report.
if (process.env.KB02_ISOLATED !== "1" && !beforeMode) {
  const names = [
    "empty capture gives a gentle prompt before sorting",
    "multiline Hebrew capture keeps direction and wraps",
    "pending sort leaves the draft visible and then shows a proposal",
    "proposal is a preview until a person accepts and adds",
    "saved page retains keyboard reachable Open and Undo while removal waits",
    "recovery notice dismisses and returns focus to the draft",
    "390 px long text does not widen the viewport",
    "offline copy explains the draft and the connection",
    "gallery states, controls, focus, and disabled action work",
    "English and Hebrew new keys match",
    "mounted screen and gallery fit phone and desktop in both languages and themes",
  ];
  let output: string | undefined;
  for (const name of names) {
    test(`KB-02 isolated: ${name}`, () => {
      if (output === undefined) {
        const run = bun.spawnSync([process.execPath, "test", import.meta.path], {
          cwd: repo,
          env: { ...process.env, KB02_ISOLATED: "1" },
          stdout: "pipe",
          stderr: "pipe",
        });
        output = `${run.stdout.toString()}${run.stderr.toString()}`;
        if (run.exitCode !== 0) throw new Error(`KB-02 clean test process failed:\n${output}`);
      }
      expect(output).toContain(name);
    }, 300_000);
  }
} else {
let browser: Browser;
let server: ReturnType<typeof bun.serve>;
let origin: string;
let temp: string;

const stubs: Record<string, string> = {
  "convex/react": `export const useConvex=()=>({query:async ref=>ref?.__kb==="crisis"?{isCrisis:false}:null});export const useAction=()=>async args=>{window.__kbCalls.push({kind:"prioritize",args});if(new URLSearchParams(location.search).has("pending"))return await new Promise(resolve=>{window.__kbResolve=resolve});return ${JSON.stringify(plan)}};export const useMutation=ref=>async args=>{window.__kbCalls.push({kind:ref?.__kb,args});if(ref?.__kb==="notes.remove"&&new URLSearchParams(location.search).has("pendingUndo"))return await new Promise(resolve=>{window.__kbResolveUndo=resolve});if(ref?.__kb==="notes.create")return "fictional-note";if(ref?.__kb==="acceptPlan")return {created:1,taskIds:["fictional-task"]};return null};`,
  "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`,
  "@/components/providers/LocaleProvider": `import{translate}from"${web}/lib/i18n.ts";export function useLocale(){const lang=document.documentElement.lang==="he"?"he":"en";return{lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key)}}`,
  "@/convex/_generated/api": `export const api={brain_dump:{prioritize:{__kb:"prioritize"},acceptPlan:{__kb:"acceptPlan"}},tasks:{update:{__kb:"tasks.update"}},notes:{create:{__kb:"notes.create"},remove:{__kb:"notes.remove"}},crisis:{check:{__kb:"crisis"},resourcesCard:{__kb:"resources"}}};`,
};

function executable(): string {
  const candidates = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
  return found;
}

async function makeFixture() {
  temp = mkdtempSync(join(tmpdir(), "tempo-kb02-work-"));
  symlinkSync(join(web, "node_modules"), join(temp, "node_modules"), "dir");
  writeFileSync(join(temp, "entry.tsx"), `import React from "${web}/node_modules/react";import{createRoot}from"${web}/node_modules/react-dom/client";import{TpIconSprite}from"${web}/components/tempo/TpIcon.tsx";import{BrainDumpScreen${beforeMode ? "" : ",Kb02Gallery"}}from"${source}";window.__kbCalls=[];const gallery=new URLSearchParams(location.search).has("gallery");createRoot(document.getElementById("root")!).render(<><TpIconSprite/>${beforeMode ? "<main><BrainDumpScreen/></main>" : "{gallery?<Kb02Gallery/>:<main><BrainDumpScreen/></main>}"}</>);`);
  const result = await bun.build({
    entrypoints: [join(temp, "entry.tsx")], outdir: temp, target: "browser",
    define: { "process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS": '"0"' },
    plugins: [{ name: "kb02-fictional-data", setup(build) {
      build.onResolve({ filter: /^(convex\/react|next\/link|@\/components\/providers\/LocaleProvider|@\/convex\/_generated\/api)$/ }, args => ({ path: args.path, namespace: "kb02" }));
      build.onLoad({ filter: /.*/, namespace: "kb02" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
      if (beforeMode) build.onResolve({ filter: /^@\// }, args => {
        const base = join(web, args.path.slice(2));
        const path = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(existsSync);
        return path ? { path } : undefined;
      });
      build.onResolve({ filter: /^\.\/brainDumpState$/ }, args => args.importer === source ? { path: join(web, "components/brain-dump/brainDumpState.ts") } : undefined);
      build.onResolve({ filter: /^react-native$/ }, () => ({ path: join(web, "node_modules/react-native-web/dist/index.js") }));
    } }],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  const outputs = result.outputs.map(output => basename(output.path));
  const css = outputs.filter(file => file.endsWith(".css"));
  server = bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const dir = lang === "he" ? "rtl" : "ltr";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      return new Response(`<!doctype html><html lang="${lang}" dir="${dir}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${css.map(file => `<link rel="stylesheet" href="/${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
    }
    const path = url.pathname === "/globals.css" ? join(web, "app/globals.css") : outputs.includes(url.pathname.slice(1)) ? join(temp, url.pathname) : join(web, "app", url.pathname);
    const file = bun.file(path);
    return file.exists().then(exists => exists ? new Response(file, { headers: { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }) : new Response("not found", { status: 404 }));
  } });
  origin = `http://127.0.0.1:${server.port}`;
}

async function open(width = 390, params = "", kept?: object): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.stack ?? String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (kept) await page.addInitScript(value => sessionStorage.setItem("tempo:brain-dump:session", JSON.stringify({ v: 1, savedAt: Date.now(), ...value })), kept);
  await page.goto(`${origin}/?${params}`, { waitUntil: "domcontentloaded" });
  try { await page.locator("main").waitFor(); }
  catch (error) { throw new Error(`Mounted screen did not appear. Browser errors: ${errors.join(" | ") || "none"}`, { cause: error }); }
  await page.locator("h1").waitFor();
  return page;
}

async function noOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}
async function capture(page: Page, name: string) {
  const dir = process.env.KB02_EVIDENCE_DIR;
  if (dir) { mkdirSync(dir, { recursive: true }); await page.screenshot({ path: join(dir, name), fullPage: true }); }
}
const kept = { draft: "Maya wants room to rest, and time with Dana and Yoni.", plan, accepted: [], rejected: [], savedPageId: null };

describe.serial("KB-02 mounted brain dump and gallery", () => {
  beforeAll(async () => { await makeFixture(); browser = await chromium.launch({ executablePath: executable(), headless: true, args: ["--no-sandbox"] }); }, 90_000);
  afterAll(async () => { await browser?.close(); server?.stop(true); }, 30_000);

  test("empty capture gives a gentle prompt before sorting", async () => {
    const page = await open();
    expect(await page.getByText(tKb02("en", "kb02.empty")).count()).toBe(1);
    await page.getByRole("button", { name: "Sort it" }).click();
    expect(await page.getByRole("alert").count()).toBe(1);
    expect(await page.evaluate(() => window.__kbCalls.length)).toBe(0);
    await page.close();
  }, 90_000);

  test("multiline Hebrew capture keeps direction and wraps", async () => {
    const page = await open(390, "lang=he");
    const textarea = page.locator("textarea");
    await textarea.fill("מאיה רוצה שבוע רגוע יותר\nזמן לפגוש את דנה ואת יוני");
    expect(await textarea.getAttribute("dir")).toBe("auto");
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  }, 90_000);

  test("pending sort leaves the draft visible and then shows a proposal", async () => {
    const page = await open(390, "pending=1", kept);
    await page.locator("textarea").fill("Maya needs a calmer Friday.");
    await page.getByRole("button", { name: "Sort it" }).click();
    await page.getByText(tKb02("en", "kb02.sorting")).waitFor();
    expect(await page.locator("textarea").inputValue()).toBe("Maya needs a calmer Friday.");
    expect(await page.locator("textarea").isDisabled()).toBe(true);
    expect(await page.getByRole("button", { name: tKb02("en", "kb02.dismiss") }).isDisabled()).toBe(true);
    await page.waitForFunction(() => typeof window.__kbResolve === "function");
    await page.evaluate(value => window.__kbResolve(value), plan);
    await page.getByRole("heading", { name: "Your order" }).waitFor();
    expect(await page.getByText(tKb02("en", "kb02.ready")).count()).toBe(1);
    await page.getByRole("button", { name: tKb02("en", "kb02.dismiss") }).click();
    expect(await page.locator("textarea").evaluate(node => node === document.activeElement)).toBe(true);
    await page.close();
  }, 90_000);

  test("proposal is a preview until a person accepts and adds", async () => {
    const page = await open();
    await page.locator("textarea").fill("Maya needs a calmer Friday.");
    await page.getByRole("button", { name: "Sort it" }).click();
    await page.getByRole("heading", { name: "Your order" }).waitFor();
    expect(await page.evaluate(() => window.__kbCalls.some(call => call.kind === "acceptPlan"))).toBe(false);
    await page.getByRole("button", { name: tKb02("en", "kb02.edit") }).first().click();
    await page.getByRole("textbox", { name: tKb02("en", "kb02.editLabel") }).fill("Ask Dana about Saturday");
    await page.getByRole("button", { name: tKb02("en", "kb02.saveEdit") }).click();
    await page.waitForFunction(label => document.activeElement?.textContent?.includes(label), tKb02("en", "kb02.edit"));
    await page.getByRole("button", { name: "Accept" }).first().click();
    expect(await page.evaluate(() => window.__kbCalls.some(call => call.kind === "acceptPlan"))).toBe(false);
    await page.getByRole("button", { name: /Add accepted/ }).click();
    await page.waitForFunction(() => window.__kbCalls.some(call => call.kind === "acceptPlan"));
    expect(await page.evaluate(() => window.__kbCalls.find(call => call.kind === "acceptPlan")?.args)).toEqual({ items: [{ title: "Ask Dana about Saturday", urgency: "now" }] });
    await page.close();
  }, 90_000);

  test("saved page retains keyboard reachable Open and Undo while removal waits", async () => {
    const page = await open(390, "pendingUndo=1", kept);
    await page.getByRole("button", { name: "Save as a page" }).click();
    const link = page.getByRole("link", { name: /Open the page/ });
    await link.waitFor();
    expect(await link.getAttribute("href")).toBe("/notes/fictional-note");
    const undo = page.getByRole("button", { name: "Undo" });
    await undo.focus();
    expect(await undo.evaluate(node => node === document.activeElement)).toBe(true);
    await undo.click();
    expect(await undo.count()).toBe(1);
    expect(await undo.isDisabled()).toBe(true);
    await page.evaluate(() => window.__kbResolveUndo(null));
    await page.close();
  }, 90_000);

  test("recovery notice dismisses and returns focus to the draft", async () => {
    const page = await open(390, "", kept);
    await page.getByText(tKb02("en", "kb02.recovered")).waitFor();
    await page.getByRole("button", { name: tKb02("en", "kb02.dismiss") }).click();
    expect(await page.getByText(tKb02("en", "kb02.recovered")).count()).toBe(0);
    expect(await page.locator("textarea").evaluate(node => node === document.activeElement)).toBe(true);
    await page.close();
  }, 90_000);

  test("390 px long text does not widen the viewport", async () => {
    const page = await open(390, "gallery=1");
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryOverflow") }).click();
    expect(await noOverflow(page)).toBe(true);
    expect((await page.locator("textarea").inputValue()).length).toBeGreaterThan(400);
    await page.close();
  }, 90_000);

  test("offline copy explains the draft and the connection", async () => {
    const page = await open(390, "gallery=1");
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryOffline") }).click();
    expect(await page.getByText(tKb02("en", "kb02.offline")).count()).toBe(1);
    await page.close();
  }, 90_000);

  test("gallery states, controls, focus, and disabled action work", async () => {
    const page = await open(390, "gallery=1");
    for (const key of ["kb02.galleryEmpty", "kb02.galleryLoading", "kb02.galleryError", "kb02.galleryDisabled", "kb02.galleryDefault"] as const) {
      await page.getByRole("button", { name: tKb02("en", key) }).click();
    }
    await page.getByRole("button", { name: tKb02("en", "kb02.dismiss") }).click();
    expect(await page.locator("textarea").evaluate(node => node === document.activeElement)).toBe(true);
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryTry") }).click();
    expect(await page.getByText(/Sort requested 1/).count()).toBe(1);
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryDisabled") }).click();
    expect(await page.getByRole("button", { name: tKb02("en", "kb02.galleryTry") }).isDisabled()).toBe(true);
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryRestored") }).click();
    expect(await page.getByRole("button", { name: tKb02("en", "kb02.dismiss") }).isDisabled()).toBe(true);
    const minHeight = await page.locator(".kb02-gallery__controls .tp-btn").evaluateAll(nodes => Math.min(...nodes.map(node => node.getBoundingClientRect().height)));
    expect(minHeight).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: tKb02("en", "kb02.galleryDefault") }).focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.matches(":focus-visible"))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe("none");
    await page.close();
  }, 90_000);

  test("English and Hebrew new keys match", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    expect(Object.values(he).every(Boolean)).toBe(true);
  });

  test("mounted screen and gallery fit phone and desktop in both languages and themes", async () => {
    for (const theme of ["light", "dark"] as const) for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) {
      const params = `lang=${lang}&theme=${theme}`;
      const page = await open(width, params, kept);
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await noOverflow(page)).toBe(true);
      await page.getByRole("button", { name: translate(lang, "bd.savePage") }).click();
      await page.locator(".bd-saved a").waitFor();
      await capture(page, `screen-${width}-${lang}-${theme}.png`);
      await page.close();
      if (beforeMode) continue;
      const gallery = await open(width, `${params}&gallery=1`);
      expect(await gallery.locator("main").count()).toBe(1);
      expect(await gallery.locator("h1").count()).toBe(1);
      expect(await gallery.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
      expect(await noOverflow(gallery)).toBe(true);
      expect(await gallery.locator(".kb02-capture-status").evaluate(node => getComputedStyle(node).transitionDuration)).toBe("0s");
      await capture(gallery, `gallery-${width}-${lang}-${theme}.png`);
      await gallery.close();
    }
  }, 180_000);
});
}
