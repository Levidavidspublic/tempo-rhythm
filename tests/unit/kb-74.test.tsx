import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { en, he, kb74t } from "../../apps/web/lib/i18n-groups/kb-74";

const repo = process.cwd();
const web = join(repo, "apps/web");
const component = join(web, "components/tempo/TempoShell.tsx");
const childMode = process.env.KB74_FIXTURE_CHILD === "1";

async function serveFixture() {
  const dir = process.env.KB74_FIXTURE_DIR;
  if (!dir) throw new Error("KB74_FIXTURE_DIR is required for the isolated bundle child");
  symlinkSync(join(web, "node_modules"), join(dir, "node_modules"), "dir");
  writeFileSync(join(dir, "entry.tsx"), `import React from "${web}/node_modules/react";import {createRoot} from "${web}/node_modules/react-dom/client";import {TempoShell,Kb74Gallery} from "${component}";const gallery=new URLSearchParams(location.search).has("gallery");createRoot(document.getElementById("root")!).render(<React.StrictMode>{gallery?<Kb74Gallery/>:<TempoShell><section className="tp-paper"><h1>Today for Maya</h1><button type="button" id="page-action">Page action</button></section></TempoShell>}</React.StrictMode>);`);
  const stubs: Record<string, string> = {
    "convex/react": `export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const useQuery=(ref,args)=>{const key=String(ref);if(args==="skip")return undefined;if(key.includes("getProfile"))return {greetingName:"Maya",email:"maya@example.test"};if(key.includes("listForRail")||key.includes("searchTitles")||key.includes("conversations.list")||key.includes("messages.list"))return [];if(key.includes("voice.availability"))return {available:false};return undefined};export const useMutation=()=>async()=>null;export const useAction=()=>async()=>null;export const useConvex=()=>({query:async()=>({isCrisis:false})});`,
    "@convex-dev/auth/react": `export const useAuthActions=()=>({signOut:async()=>{}});`,
    "next/navigation": `import React from "${web}/node_modules/react";export const usePathname=()=>React.useSyncExternalStore(fn=>{window.addEventListener("kb74:path",fn);return()=>window.removeEventListener("kb74:path",fn)},()=>window.__kb74Path||"/today",()=>"/today");export const useRouter=()=>({push:path=>{window.__kb74Path=path;window.dispatchEvent(new Event("kb74:path"))},replace:path=>{window.__kb74Path=path;window.dispatchEvent(new Event("kb74:path"))}});`,
    "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,onClick,...rest}){const path=typeof href==="string"?href:href.pathname;return React.createElement("a",{href:path,onClick:event=>{event.preventDefault();onClick?.(event);window.__kb74Path=path;window.dispatchEvent(new Event("kb74:path"))},...rest},children)}`,
    "@/components/providers/LocaleProvider": `import React from "${web}/node_modules/react";import {translate} from "${web}/lib/i18n.ts";export function useLocale(){const lang=React.useSyncExternalStore(fn=>{window.addEventListener("kb74:locale",fn);return()=>window.removeEventListener("kb74:locale",fn)},()=>document.documentElement.lang==="he"?"he":"en",()=>"en");return {lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key),setLang(next){document.documentElement.lang=next;document.documentElement.dir=next==="he"?"rtl":"ltr";window.dispatchEvent(new Event("kb74:locale"))}}};`,
    "@/components/providers/ThemeProvider": `import React from "${web}/node_modules/react";export function useTheme(){const resolvedTheme=React.useSyncExternalStore(fn=>{window.addEventListener("kb74:theme",fn);return()=>window.removeEventListener("kb74:theme",fn)},()=>document.documentElement.dataset.theme||"light",()=>"light");return {resolvedTheme,setTheme(next){document.documentElement.dataset.theme=next;window.dispatchEvent(new Event("kb74:theme"))},dyslexia:false,setDyslexia(){}}};`,
    "@/components/providers/useAccountLanguage": `export function useAccountLanguage(){}`,
    "@/convex/_generated/api": `const node=(path="api")=>new Proxy({},{get(_,key){if(key===Symbol.toPrimitive)return()=>path;if(key==="toString")return()=>path;return node(path+"."+String(key))}});export const api=node();`,
  };
  const result = await Bun.build({
    entrypoints: [join(dir, "entry.tsx")], outdir: dir, target: "browser",
    plugins: [{ name: "kb74-fictional-data", setup(build) {
      build.onResolve({ filter: /^(@\/|convex\/react$|@convex-dev\/auth\/react$|next\/(navigation|link)$)/ }, args => {
        if (args.path in stubs) return { path: args.path, namespace: "kb74" };
        if (args.path.startsWith("@/")) {
          const base = resolve(web, args.path.slice(2));
          // A plugin-returned absolute path bypasses Bun's usual extension lookup.
          const path = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
            join(base, "index.ts"), join(base, "index.tsx")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
          if (!path) throw new Error(`KB-74 fixture import not found: ${args.path}`);
          return { path };
        }
      });
      build.onLoad({ filter: /.*/, namespace: "kb74" }, args => ({ contents: stubs[args.path], loader: "tsx", resolveDir: web }));
    } }],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  for (const output of result.outputs) writeFileSync(join(dir, basename(output.path)), await output.arrayBuffer());
  const files = result.outputs.map(output => basename(output.path));
  const css = files.filter(file => file.endsWith(".css"));
  // Compile the same Tailwind @theme tokens that Next emits; raw globals.css leaves the
  // focus-ring colour undefined in a standalone browser and gives a false focus failure.
  const postcss = (await import(join(web, "node_modules/postcss/lib/postcss.mjs"))).default;
  const tailwind = (await import(join(web, "node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
  const globalSource = join(web, "app/globals.css");
  const globalCss = (await postcss([tailwind({ base: repo })]).process(readFileSync(globalSource, "utf8"), { from: globalSource })).css;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      return new Response(`<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${css.map(file => `<link rel="stylesheet" href="/${file}">`).join("")}</head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_VERCEL_ENV:"production"}};</script><script type="module" src="/entry.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
    }
    if (url.pathname === "/globals.css") return new Response(globalCss, { headers: { "content-type": "text/css" } });
    const name = url.pathname.slice(1);
    const path = files.includes(name) ? join(dir, name) : resolve(web, "app", name);
    if (!path.startsWith(dir) && !path.startsWith(join(web, "app"))) return new Response("not found", { status: 404 });
    const file = Bun.file(path);
    return file.exists().then(exists => exists ? new Response(file, { headers: { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "application/octet-stream" } }) : new Response("not found", { status: 404 }));
  } });
  writeFileSync(join(dir, "port"), String(server.port));
}

if (childMode) await serveFixture();

function browserExecutable(): string {
  const candidates = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`No Playwright Chromium or system Chrome found; checked ${candidates.join(", ")}`);
  return found;
}

if (!childMode) {
  setDefaultTimeout(60_000);
  let browser: Browser;
  let child: ReturnType<typeof Bun.spawn>;
  let fixtureDir: string;
  let origin: string;
  const pageErrors: string[] = [];

  async function open(width = 390, params = ""): Promise<Page> {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    page.on("pageerror", error => { pageErrors.push(error.message); console.error("KB-74 fixture page error:", error.message); });
    await page.goto(`${origin}/?${params}`, { waitUntil: "load", timeout: 60_000 });
    await page.locator("h1").waitFor({ timeout: 30_000 });
    return page;
  }

  async function openDrawer(page: Page, trigger: "topbar" | "tabbar" = "topbar") {
    const selector = trigger === "topbar" ? '[data-component="Topbar"] .tp-topbar__menu' : '[data-component="TabBar"] button';
    await page.locator(selector).click();
    await page.waitForFunction(() => document.querySelector('[data-component="TempoShell"]')?.getAttribute("data-rail") === "open");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-component") === "CommandTrigger");
  }

  async function capture(page: Page, name: string) {
    const dir = process.env.KB74_EVIDENCE_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, name), fullPage: true, animations: "disabled" });
  }

  async function waitForSettledRail(page: Page) {
    // Focus commits before the CSS slide ends. Read its actual final transform
    // and animation state before comparing exact modal/desktop rectangles.
    await page.waitForFunction(() => {
      const rail = document.querySelector('[data-component="Sidebar"]');
      return rail && getComputedStyle(rail).transform === "none" &&
        rail.getAnimations().every(animation => animation.playState === "finished" || animation.playState === "idle");
    });
  }

  beforeAll(async () => {
    mkdirSync(join(repo, "work"), { recursive: true });
    fixtureDir = mkdtempSync(join(repo, "work", "kb-74-"));
    child = Bun.spawn([process.execPath, resolve(repo, "tests/unit/kb-74.test.tsx")], {
      cwd: repo, env: { ...process.env, KB74_FIXTURE_CHILD: "1", KB74_FIXTURE_DIR: fixtureDir },
      stdout: "ignore", stderr: "inherit",
    });
    const portFile = join(fixtureDir, "port");
    let exited = false;
    void child.exited.then(() => { exited = true; });
    for (let n = 0; n < 1200 && !existsSync(portFile) && !exited; n++) await Bun.sleep(100);
    if (!existsSync(portFile)) throw new Error(`KB-74 isolated browser bundle did not start; child exited=${exited}`);
    origin = `http://127.0.0.1:${readFileSync(portFile, "utf8")}`;
    browser = await chromium.launch({ executablePath: browserExecutable(), headless: true, args: ["--no-sandbox"] });
  }, 150_000);
  afterAll(async () => {
    await browser?.close();
    child?.kill();
    await child?.exited;
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
    expect(pageErrors).toEqual([]);
  });

  describe.serial("KB-74 real shell drawer focus", () => {
    test("local copy has English/Hebrew key parity", () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
      expect(kb74t("he", "kb74.closeNavigation")).toBe(he["kb74.closeNavigation"]);
    });

    test("English and Hebrew drawers expose a named modal containing the real navigation", async () => {
      for (const lang of ["en", "he"] as const) {
        const page = await open(390, `lang=${lang}`);
        try {
          expect(await page.getByRole("dialog").count()).toBe(0);
          await openDrawer(page);
          const drawer = page.getByRole("dialog", { name: lang === "he" ? "ניווט" : "Navigation", exact: true });
          expect(await drawer.count()).toBe(1);
          expect(await drawer.getAttribute("aria-modal")).toBe("true");
          expect(await drawer.getByRole("navigation").count()).toBe(1);
          expect(await drawer.locator('[data-component="Sidebar"]').count()).toBe(1);
          expect(await drawer.evaluate(el => el.contains(document.activeElement))).toBe(true);
          await waitForSettledRail(page);
          expect(await drawer.boundingBox()).toEqual(await drawer.locator('[data-component="Sidebar"]').boundingBox());
          await page.keyboard.press("Escape");
          expect(await page.getByRole("dialog").count()).toBe(0);
          expect(await page.locator('[aria-modal="true"]').count()).toBe(0);
        } finally {
          await page.close();
        }
      }
    });

    test("desktop navigation has no modal semantics after a mobile drawer resize", async () => {
      for (const lang of ["en", "he"]) {
        const page = await open(1280, `lang=${lang}`);
        try {
          expect(await page.getByRole("dialog").count()).toBe(0);
          expect(await page.locator('[aria-modal="true"]').count()).toBe(0);
          expect(await page.getByRole("navigation").filter({ has: page.locator('[data-component="CommandTrigger"]') }).count()).toBe(1);
          await page.setViewportSize({ width: 390, height: 900 });
          await openDrawer(page);
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.waitForFunction(() => document.querySelector('[data-component="TempoShell"]')?.getAttribute("data-rail") === "closed");
          expect(await page.getByRole("dialog").count()).toBe(0);
          expect(await page.locator('[aria-modal="true"]').count()).toBe(0);
          expect(await page.getByRole("navigation").filter({ has: page.locator('[data-component="CommandTrigger"]') }).count()).toBe(1);
          await waitForSettledRail(page);
          const rail = await page.locator('[data-component="Sidebar"]').boundingBox();
          expect(rail?.x).toBe(lang === "he" ? 1280 - (rail?.width ?? 0) : 0);
          expect(rail?.height).toBe(900);
          await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>("main");
            if (main) main.style.minHeight = "1800px";
            window.scrollTo(0, 300);
          });
          await page.waitForFunction(() => window.scrollY > 0);
          expect((await page.locator('[data-component="Sidebar"]').boundingBox())?.y).toBe(0);
        } finally {
          await page.close();
        }
      }
    });

    test("fixture hydrates the real three navigation children with v3 CSS", async () => {
      const page = await open();
      expect(await page.evaluate(() => {
        const shell = document.querySelector('[data-component="TempoShell"]');
        const sidebar = shell?.querySelector<HTMLElement>('[data-component="Sidebar"]');
        return {
          topbar: shell?.querySelectorAll('[data-component="Topbar"]').length,
          sidebar: shell?.querySelectorAll('[data-component="Sidebar"]').length,
          tabbar: shell?.querySelectorAll('[data-component="TabBar"]').length,
          railPosition: sidebar && getComputedStyle(sidebar).position,
          touch: getComputedStyle(document.documentElement).getPropertyValue("--tp-touch").trim(),
        };
      })).toEqual({ topbar: 1, sidebar: 1, tabbar: 1, railPosition: "fixed", touch: "44px" });
      await page.close();
    });

    test("topbar opener moves focus into the real Sidebar", async () => {
      const page = await open(); await openDrawer(page);
      expect(await page.locator('[data-component="Sidebar"] [data-component="CommandTrigger"]:focus').count()).toBe(1);
      await page.close();
    });
    test("tabbar opener moves focus into the real Sidebar", async () => {
      const page = await open(); await openDrawer(page, "tabbar");
      expect(await page.locator('[data-component="Sidebar"] [data-component="CommandTrigger"]:focus').count()).toBe(1);
      await page.close();
    });
    test("keyboard opening shows visible focus inside the real drawer", async () => {
      for (const lang of ["en", "he"]) {
        const page = await open(390, `lang=${lang}`);
        await page.locator('[data-component="Topbar"] .tp-topbar__menu').focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => document.activeElement?.getAttribute("data-component") === "CommandTrigger");
        const focusAppearance = await page.locator('[data-component="CommandTrigger"]').evaluate(el => {
          const style = getComputedStyle(el);
          return { outline: style.outline, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow, border: style.border,
            focusVisible: el.matches(":focus-visible"), focused: document.activeElement === el };
        });
        console.log("KB-74 keyboard drawer focus appearance:", lang, focusAppearance);
        await capture(page, `after-open-keyboard-390-${lang}-light.png`);
        expect(focusAppearance.focused && focusAppearance.focusVisible).toBe(true);
        expect(focusAppearance.outline).toContain("solid");
        expect(parseFloat(focusAppearance.outlineWidth)).toBeGreaterThanOrEqual(2);
        await page.keyboard.press("Escape");
        await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').waitFor();
        await capture(page, `after-restored-390-${lang}-light.png`);
        await page.close();
      }
    });
    test("programmatic topbar click remembers its real trigger while another button had focus", async () => {
      const page = await open();
      await page.evaluate(() => {
        document.getElementById("page-action")?.focus();
        document.querySelector<HTMLButtonElement>('[data-component="Topbar"] .tp-topbar__menu')?.click();
      });
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-component") === "CommandTrigger");
      await page.keyboard.press("Escape");
      expect(await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').count()).toBe(1);
      await page.close();
    });
    test("programmatic tabbar click returns to tabbar rather than the previously focused control", async () => {
      const page = await open();
      await page.evaluate(() => {
        document.getElementById("page-action")?.focus();
        document.querySelector<HTMLButtonElement>('[data-component="TabBar"] button')?.click();
      });
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-component") === "CommandTrigger");
      await page.keyboard.press("Escape");
      expect(await page.locator('[data-component="TabBar"] button:focus').count()).toBe(1);
      await page.close();
    });
    test("forward Tab wraps from the last drawer control to its first", async () => {
      const page = await open(); await openDrawer(page);
      await page.locator('[data-component="Sidebar"] button').last().focus();
      await page.keyboard.press("Tab");
      expect(await page.locator('[data-component="CommandTrigger"]:focus').count()).toBe(1);
      await page.close();
    });
    test("reverse Tab wraps from the first drawer control to its last", async () => {
      const page = await open(); await openDrawer(page);
      await page.keyboard.press("Shift+Tab");
      expect(await page.locator('[data-component="Sidebar"] button').last().evaluate(el => el === document.activeElement)).toBe(true);
      await page.close();
    });
    test("background main, topbar and tabbar are inert while the drawer is modal", async () => {
      const page = await open(); await openDrawer(page);
      expect(await page.locator("main").evaluate(el => (el as HTMLElement).inert)).toBe(true);
      expect(await page.locator('[data-component="Topbar"]').evaluate(el => (el as HTMLElement).inert)).toBe(true);
      expect(await page.locator('[data-component="TabBar"]').evaluate(el => (el as HTMLElement).inert)).toBe(true);
      expect(await page.locator('[data-component="Sidebar"]').evaluate(el => (el as HTMLElement).inert)).toBe(false);
      await page.close();
    });
    test("Escape closes the drawer and restores its visible topbar opener", async () => {
      const page = await open(); await openDrawer(page); await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector('[data-component="TempoShell"]')?.getAttribute("data-rail") === "closed");
      expect(await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').count()).toBe(1);
      await page.close();
    });
    test("scrim click closes and restores a valid opener", async () => {
      const page = await open(); await openDrawer(page);
      await page.locator(".tp-scrim").click({ position: { x: 380, y: 450 } });
      await page.waitForFunction(() => document.querySelector('[data-component="TempoShell"]')?.getAttribute("data-rail") === "closed");
      expect(await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').count()).toBe(1);
      await page.close();
    });
    test("dismissal does not steal focus the reader moved outside the shell", async () => {
      const page = await open(); await openDrawer(page);
      await page.evaluate(() => { const button = document.createElement("button"); button.id = "external-focus"; document.body.append(button); button.focus(); });
      await page.keyboard.press("Escape");
      expect(await page.locator("#external-focus:focus").count()).toBe(1);
      await page.close();
    });
    test("following a Sidebar link closes drawer and focuses the existing main", async () => {
      const page = await open(); await openDrawer(page);
      await page.locator('[data-component="Sidebar"] a[href="/tasks"]').first().click();
      await page.waitForFunction(() => Reflect.get(window, "__kb74Path") === "/tasks");
      expect(await page.locator("main:focus").count()).toBe(1);
      await page.close();
    });
    test("same-route Sidebar link closes drawer and focuses main", async () => {
      const page = await open(); await openDrawer(page);
      await page.locator('[data-component="Sidebar"] a[href="/today"]').first().click();
      expect(await page.locator('[data-component="TempoShell"][data-rail="closed"]').count()).toBe(1);
      expect(await page.locator("main:focus").count()).toBe(1);
      await page.close();
    });
    test("real command palette supersedes the drawer without returning to an inert rail", async () => {
      const page = await open(); await openDrawer(page);
      await page.locator('[data-component="Sidebar"] [data-component="CommandTrigger"]').click();
      await page.getByRole("dialog").filter({ has: page.getByRole("combobox") }).waitFor();
      expect(await page.locator('[role="combobox"]:focus').count()).toBe(1);
      expect(await page.locator('[data-component="TempoShell"][data-rail="closed"]').count()).toBe(1);
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      expect(await page.locator('[data-component="Sidebar"] :focus').count()).toBe(0);
      await page.close();
    });
    test("Ctrl K supersedes the open drawer and Escape closes only the palette", async () => {
      const page = await open(); await openDrawer(page);
      await page.keyboard.press("Control+k");
      await page.getByRole("dialog").filter({ has: page.getByRole("combobox") }).waitFor();
      expect(await page.locator('[data-component="TempoShell"][data-rail="closed"]').count()).toBe(1);
      expect(await page.locator('[role="combobox"]:focus').count()).toBe(1);
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
      expect(await page.locator('[data-component="TempoShell"][data-rail="closed"]').count()).toBe(1);
      await page.close();
    });
    test("real coach sheet supersedes the drawer and returns to its coach button", async () => {
      const page = await open(); await openDrawer(page);
      await page.keyboard.press("Control+j");
      await page.locator('[data-component="CoachPanel"][role="dialog"]').waitFor();
      expect(await page.locator('[data-component="TempoShell"][data-rail="closed"]').count()).toBe(1);
      expect(await page.locator('[data-component="CoachPanel"]').evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await page.locator('[data-component="CoachPanel"]').waitFor({ state: "detached" });
      expect(await page.locator('[data-component="CoachButton"]:focus').count()).toBe(1);
      await page.close();
    });
    test("resizing to desktop releases inert and drawer Tab containment", async () => {
      const page = await open(); await openDrawer(page); await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForFunction(() => document.querySelector('[data-component="TempoShell"]')?.getAttribute("data-rail") === "closed");
      expect(await page.locator("main").evaluate(el => (el as HTMLElement).inert)).toBe(false);
      expect(await page.locator('[data-component="Sidebar"]').evaluate(el => (el as HTMLElement).inert)).toBe(false);
      expect(await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').count()).toBe(0);
      await page.close();
    });
    test("desktop static rail stays accessible without modal trapping", async () => {
      const page = await open(1280);
      expect(await page.locator('[data-component="Sidebar"]').evaluate(el => (el as HTMLElement).inert)).toBe(false);
      await page.locator('[data-component="CommandTrigger"]').focus(); await page.keyboard.press("Tab");
      expect(await page.locator('[data-component="Sidebar"] a:focus').count()).toBe(1);
      expect(await page.locator("main").evaluate(el => (el as HTMLElement).inert)).toBe(false);
      await page.close();
    });
    test("StrictMode reopen still focuses the drawer after dismissal", async () => {
      const page = await open(); await openDrawer(page); await page.keyboard.press("Escape"); await openDrawer(page);
      expect(await page.locator('[data-component="CommandTrigger"]:focus').count()).toBe(1);
      await page.close();
    });
    test("Hebrew RTL drawer opens on the leading edge and restores focus", async () => {
      const page = await open(390, "lang=he"); await openDrawer(page);
      expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
      expect(await page.locator('.tp-scrim').getAttribute("aria-label")).toBe(he["kb74.closeNavigation"]);
      await page.keyboard.press("Escape");
      expect(await page.locator('[data-component="Topbar"] .tp-topbar__menu:focus').count()).toBe(1);
      await page.close();
    });
    test("gallery language and theme controls update the real shell", async () => {
      const page = await open(390, "gallery&lang=en&theme=light");
      await page.getByRole("button", { name: en["kb74.switchLanguage"] }).click();
      expect(await page.locator("html").getAttribute("lang")).toBe("he");
      await page.getByRole("button", { name: he["kb74.switchTheme"] }).click();
      expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
      await openDrawer(page);
      await page.keyboard.press("Escape");
      await page.close();
    });
    test("mounted shell and gallery fit both languages, themes and widths", async () => {
      for (const width of [390, 1280]) for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
        const suffix = `${width}-${lang}-${theme}`;
        for (const gallery of [false, true]) {
          const page = await open(width, `${gallery ? "gallery&" : ""}lang=${lang}&theme=${theme}`);
          expect(await page.locator("main").count()).toBe(1);
          expect(await page.locator("h1").count()).toBe(1);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (width === 390) {
            const menu = page.locator('[data-component="Topbar"] .tp-topbar__menu');
            expect(await menu.evaluate(el => el.getBoundingClientRect().height >= 44)).toBe(true);
            expect(await page.locator('[data-component="TabBar"] button').evaluate(el => el.getBoundingClientRect().height >= 44)).toBe(true);
            await openDrawer(page);
            expect(await page.locator('[data-component="Sidebar"] [data-component="CommandTrigger"]').evaluate(el => el.getBoundingClientRect().height >= 44)).toBe(true);
            expect(await page.locator('[data-component="Sidebar"] a[href="/today"]').evaluate(el => el.getBoundingClientRect().height >= 44)).toBe(true);
          }
          await capture(page, `${gallery ? "gallery" : "after"}-${suffix}.png`);
          await page.close();
        }
      }
    });
    test("reduced motion uses the existing near-zero CSS policy", async () => {
      const page = await open(); await page.emulateMedia({ reducedMotion: "reduce" }); await openDrawer(page);
      const seconds = await page.locator('[data-component="Sidebar"]').evaluate(el => {
        const value = getComputedStyle(el).transitionDuration.split(",")[0].trim();
        return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
      });
      expect(seconds).toBeLessThanOrEqual(0.0000101);
      await page.close();
    });
  });
}
