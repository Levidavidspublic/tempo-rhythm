import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { Kb10Gallery, MagicLinkStatus, SignInHelp } from "../../apps/web/components/auth/SignInForm";
import { en, he, kb10t } from "../../apps/web/lib/i18n-groups/kb-10";

const repo = process.cwd();
const web = join(repo, "apps/web");
const component = join(web, "components/auth/SignInForm.tsx");
setDefaultTimeout(45_000);
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let origin: string;
let fixtureDir: string;

const stubs: Record<string, string> = {
  "@convex-dev/auth/react": `export function useAuthActions(){return {signIn:(provider,args)=>{window.__authCalls.push({provider,args});const mode=new URLSearchParams(location.search).get("mode");if(mode==="error")return Promise.reject(new Error("send failed"));if(mode==="pending")return new Promise((resolve,reject)=>{window.__resolveAuth=resolve;window.__rejectAuth=reject});return Promise.resolve()}}}`,
  "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,...rest}){return React.createElement("a",{href:typeof href==="string"?href:href.pathname,...rest},children)}`,
  "@/components/providers/LocaleProvider": `import React from "${web}/node_modules/react";export function useLocale(){const lang=React.useSyncExternalStore(fn=>{window.addEventListener("kb10:lang",fn);return()=>window.removeEventListener("kb10:lang",fn)},()=>document.documentElement.lang==="he"?"he":"en",()=>"en");return {lang,dir:lang==="he"?"rtl":"ltr",setLang(next){document.documentElement.lang=next;document.documentElement.dir=next==="he"?"rtl":"ltr";window.dispatchEvent(new Event("kb10:lang"))}}}`,
};

function browserExecutable() {
  const candidates = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
  return found;
}

async function makeFixture() {
  mkdirSync(join(repo, "work"), { recursive: true });
  fixtureDir = mkdtempSync(join(repo, "work", "kb-10-"));
  symlinkSync(join(web, "node_modules"), join(fixtureDir, "node_modules"), "dir");
  writeFileSync(join(fixtureDir, "entry.tsx"), `import React from "${web}/node_modules/react";import {createRoot} from "${web}/node_modules/react-dom/client";import {SignInForm,Kb10Gallery} from "${component}";window.__authCalls=[];window.__successCount=0;window.__switchCount=0;const params=new URLSearchParams(location.search);const flow=params.get("flow")==="sign-up"?"sign-up":"sign-in";const variant=params.get("variant")==="modal"?"modal":"page";createRoot(document.getElementById("root")!).render(<React.StrictMode>{params.has("gallery")?<Kb10Gallery lang={document.documentElement.lang==="he"?"he":"en"}/>:<main className="tp-auth"><SignInForm variant={variant} flow={flow} nextPath="/today" onSuccess={()=>window.__successCount++} onSwitch={()=>window.__switchCount++}/></main>}</React.StrictMode>);`);
  const result = await Bun.build({ entrypoints: [join(fixtureDir, "entry.tsx")], outdir: fixtureDir, target: "browser", plugins: [{
    name: "kb10-auth-fixture", setup(build) {
      build.onResolve({ filter: /^(@convex-dev\/auth\/react|next\/link|@\/components\/providers\/LocaleProvider)$/ }, args => ({ path: args.path, namespace: "kb10" }));
      build.onLoad({ filter: /.*/, namespace: "kb10" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
    },
  }] });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  for (const output of result.outputs) writeFileSync(join(fixtureDir, basename(output.path)), await output.arrayBuffer());
  const files = result.outputs.map(output => basename(output.path));
  const css = files.filter(file => file.endsWith(".css"));
  server = Bun.serve({ port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const dir = lang === "he" ? "rtl" : "ltr";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      return new Response(`<!doctype html><html lang="${lang}" dir="${dir}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/tempo.css">${css.map(file => `<link rel="stylesheet" href="/${file}">`).join("")}</head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
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
  page.on("pageerror", error => console.error("KB-10 fixture page error:", error.message));
  await page.goto(`${origin}/?${params}`, { waitUntil: "commit", timeout: 60_000 });
  await page.locator("main").waitFor();
  await page.locator(".kb10-card").waitFor();
  return page;
}
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function capture(page: Page, name: string) {
  const dir = process.env.KB10_EVIDENCE_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name), fullPage: true });
}

beforeAll(async () => {
  await makeFixture();
  browser = await chromium.launch({ executablePath: browserExecutable(), headless: true, args: ["--no-sandbox"] });
}, 120_000);
afterAll(async () => { await browser?.close(); server?.stop(); if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true }); });

describe.serial("KB-10 mounted sign-in and gallery", () => {
  test("initial form offers one email field and one primary send action", async () => {
    const page = await open();
    expect(await page.locator("main").count()).toBe(1);
    expect(await page.getByRole("heading", { level: 1, name: kb10t("en", "kb10.signIn") }).count()).toBe(1);
    expect(await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).count()).toBe(1);
    expect(await page.getByRole("button", { name: kb10t("en", "kb10.send") }).count()).toBe(1);
    await page.close();
  });
  test("invalid email stays local, has associated error and keeps input focus", async () => {
    const page = await open();
    const input = page.getByRole("textbox", { name: kb10t("en", "kb10.email") });
    await input.fill("invalid");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    expect(await input.getAttribute("aria-invalid")).toBe("true");
    expect(await input.getAttribute("aria-describedby")).toBe(await page.getByRole("alert").getAttribute("id"));
    expect(await page.evaluate(() => (window as unknown as { __authCalls: unknown[] }).__authCalls.length)).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("INPUT");
    await page.close();
  });
  test("pending disables duplicate send without changing resend arguments", async () => {
    const page = await open(390, "mode=pending");
    await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).fill("maya@example.com");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    const pending = page.getByRole("button", { name: kb10t("en", "kb10.sending") });
    expect(await pending.isDisabled()).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __authCalls: unknown[] }).__authCalls)).toEqual([{ provider: "resend", args: { email: "maya@example.com", redirectTo: "/today" } }]);
    await page.evaluate(() => (window as unknown as { __resolveAuth: () => void }).__resolveAuth());
    await page.getByRole("heading", { name: kb10t("en", "kb10.sent") }).waitFor();
    await page.close();
  });
  test("sent status focuses its heading and isolates the address", async () => {
    const page = await open();
    await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).fill("maya@example.com");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    await page.getByRole("heading", { name: kb10t("en", "kb10.sent") }).waitFor();
    await page.waitForFunction(() => document.activeElement?.tagName === "H1");
    expect(await page.locator("bdi[dir=ltr]").textContent()).toBe("maya@example.com");
    expect(await page.evaluate(() => (window as unknown as { __successCount: number }).__successCount)).toBe(1);
    await page.close();
  });
  test("send error retains the entered address and exposes a retry", async () => {
    const page = await open(390, "mode=error");
    const input = page.getByRole("textbox", { name: kb10t("en", "kb10.email") });
    await input.fill("maya@example.com");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    await page.getByRole("alert").waitFor();
    expect(await input.inputValue()).toBe("maya@example.com");
    expect(await input.getAttribute("aria-invalid")).toBe("true");
    expect(await page.getByRole("button", { name: kb10t("en", "kb10.send") }).isEnabled()).toBe(true);
    await page.close();
  });
  test("keyboard reset returns focus to the retained email", async () => {
    const page = await open();
    await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).fill("maya@example.com");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    const reset = page.getByRole("button", { name: kb10t("en", "kb10.reset") });
    await reset.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.tagName === "INPUT");
    expect(await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).inputValue()).toBe("maya@example.com");
    await page.close();
  });
  test("Hebrew switch uses RTL while email remains LTR", async () => {
    const page = await open();
    await page.getByRole("button", { name: kb10t("en", "kb10.hebrew") }).click();
    expect(await page.locator(".kb10-card").getAttribute("dir")).toBe("rtl");
    expect(await page.getByRole("textbox", { name: kb10t("he", "kb10.email") }).getAttribute("dir")).toBe("ltr");
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  });
  test("phone controls meet 44 px and long address cannot widen the page", async () => {
    const page = await open(390, "gallery=1");
    await page.getByRole("button", { name: kb10t("en", "kb10.overflowState") }).click();
    for (const button of await page.locator("button:visible").all()) expect(await button.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await noOverflow(page)).toBe(true);
    await page.close();
  });
  test("sign-up and modal preserve shared callbacks and approval copy", async () => {
    const page = await open(390, "flow=sign-up&variant=modal");
    expect(await page.getByRole("heading", { level: 3, name: kb10t("en", "kb10.signUp") }).count()).toBe(1);
    await page.getByRole("button", { name: kb10t("en", "kb10.signIn") }).click();
    expect(await page.evaluate(() => (window as unknown as { __switchCount: number }).__switchCount)).toBe(1);
    await page.getByRole("textbox", { name: kb10t("en", "kb10.email") }).fill("dana@example.com");
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    await page.getByText(kb10t("en", "kb10.approval")).waitFor();
    await page.close();
  });
  test("gallery controls change real states, send and reset", async () => {
    const page = await open(390, "gallery=1");
    const controls = page.locator(".kb10-gallery__states");
    for (const state of ["kb10.emptyState", "kb10.pendingState", "kb10.errorState", "kb10.disabledState", "kb10.overflowState", "kb10.sentState"] as const) {
      const control = controls.getByRole("button", { name: kb10t("en", state), exact: true });
      await control.click();
      expect(await control.getAttribute("aria-pressed")).toBe("true");
    }
    await page.getByRole("button", { name: kb10t("en", "kb10.reset") }).click();
    await page.getByRole("button", { name: kb10t("en", "kb10.send") }).click();
    expect(await page.locator(".kb10-gallery__count").textContent()).toContain("1 /");
    await page.close();
  });
  test("reduced motion and keyboard focus remain visible", async () => {
    const page = await open(390, "gallery=1");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Tab");
    const style = await page.evaluate(() => { const node = document.activeElement as HTMLElement; const css = getComputedStyle(node); return { tag: node.tagName, outline: css.outlineWidth, transition: css.transitionDuration }; });
    expect(style.tag).toBe("BUTTON");
    expect(Number.parseFloat(style.outline)).toBeGreaterThanOrEqual(2);
    // The shared reduced-motion policy allows at most 0.01ms (0.00001s).
    expect(style.transition.split(",").every(value => Number.parseFloat(value) <= 0.000011)).toBe(true);
    await page.close();
  });
  test("new exports render and English/Hebrew keys match", () => {
    const status = renderToStaticMarkup(createElement(MagicLinkStatus, { email: "maya@example.com", flow: "sign-in", lang: "en", variant: "page", onReset() {} }));
    const help = renderToStaticMarkup(createElement(SignInHelp, { flow: "sign-in", lang: "he", variant: "modal", otherHref: "/sign-up" }));
    const gallery = renderToStaticMarkup(createElement(Kb10Gallery, { lang: "en" }));
    expect(status).toContain("bdi");
    expect(help).toContain('lang="he"');
    expect(gallery).toContain("<main");
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });
  test("mounted and gallery screenshots cover 390/1280, en/he, light/dark", async () => {
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"] as const) {
      for (const mount of ["", "gallery=1&"] as const) {
        const page = await open(width, `${mount}lang=${lang}&theme=${theme}`);
        expect(await page.locator("main").count()).toBe(1);
        expect(await page.locator("h1").count()).toBe(1);
        expect(await noOverflow(page)).toBe(true);
        await capture(page, `${mount ? "gallery" : "after"}-${width}-${lang}-${theme}.png`);
        await page.close();
      }
    }
  }, 300_000);
});
