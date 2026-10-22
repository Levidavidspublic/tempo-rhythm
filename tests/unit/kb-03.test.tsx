import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { Kb03Gallery, SearchFilterSummary, SearchStatus } from "../../apps/web/components/global-search/SearchScreen";
import { en, he } from "../../apps/web/lib/i18n-groups/kb-03";
import { isolatedBrowserBuild } from "../helpers/kitchen-browser";
import { fixtureCleanup, fixturePhase } from "../helpers/kitchen-fixture";

const root = join(import.meta.dir, "../..");
// Resolve from each declaring workspace, regardless of Bun's hoisting layout.
const webRequire = createRequire(join(root, "apps/web/package.json"));
const mobileRequire = createRequire(join(root, "apps/mobile/package.json"));
const { createElement } = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("KB-03 search states", () => {
  test("initial empty invites a search without a result count", () => {
    const html = render(createElement(SearchStatus, { lang: "en", state: "initial" }));
    expect(html).toContain("Type to search");
    expect(html).not.toContain("results");
  });

  test("zero total gives a no-match next step", () => {
    const html = render(createElement(SearchStatus, { lang: "en", state: "no-match", query: "zebra" }));
    expect(html).toContain("No matches");
    expect(html).toContain("Try another word");
  });

  test("zero filtered subset explains that other results remain", () => {
    const html = render(createElement(SearchStatus, { lang: "en", state: "filtered-empty", query: "moving", kindLabel: "Habits" }));
    expect(html).toContain("No Habits results");
    expect(html).toContain("Clear the filter");
  });

  test("query is isolated in Hebrew and English no-match copy", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render(createElement(SearchStatus, { lang, state: "no-match", query: "moving" }));
      expect(html).toContain('<bdi dir="auto">moving</bdi>');
    }
  });

  test("settled result count is one atomic status announcement", () => {
    const html = render(createElement(SearchStatus, { lang: "en", state: "results", count: 3 }));
    expect(html).toContain('<output');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('aria-label="3 results"');
    expect(html).toContain('<bdi dir="ltr">3</bdi>');
  });

  test("filter summary has an accessible clear control and isolated numbers", () => {
    const html = render(createElement(SearchFilterSummary, { lang: "he", kindLabel: "פתקים", count: 1, total: 3, onClear() {} }));
    expect(html).toContain("הצגת כל התוצאות");
    expect(html).toContain('<bdi dir="ltr">1</bdi>');
    expect(html).toContain('<bdi dir="ltr">3</bdi>');
  });

  test("gallery renders the actual exported status and filter host", () => {
    const html = render(createElement(Kb03Gallery, { initialLang: "en" }));
    expect(html).toContain('data-state="results"');
    expect(html).toContain('data-group="notes"');
    expect(html).toContain("Maya");
    expect((html.match(/<main\b/g) ?? []).length).toBe(1);
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });

  test("English and Hebrew have matching keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });
});

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let directory: string;
let cleanup: (() => Promise<void>) | undefined;

async function galleryPage(width = 390, probe = false, lang: "en" | "he" = "en"): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.port}/${probe ? `?probe=1&q=moving&lang=${lang}` : ""}`, { waitUntil: "domcontentloaded" });
  try {
    await pwExpect(page.locator("main")).toHaveCount(1, { timeout: 20_000 });
  } catch {
    throw new Error(`KB-03 fixture did not hydrate: ${errors.join(" | ")}`);
  }
  await pwExpect(page.locator("h1")).toHaveCount(1);
  return page;
}

describe("KB-03 hydrated search gallery", () => {
  beforeAll(async () => {
    const setupDeadline = Date.now() + 120_000;
    cleanup = fixtureCleanup({
      browser: () => browser?.close(),
      server: () => server?.stop(true),
      directory: () => directory ? rm(directory, { recursive: true, force: true }) : undefined,
    }, 5_000);
    fixturePhase("KB-03 fixture files");
    await mkdir(join(root, "work"), { recursive: true });
    directory = await mkdtemp(join(root, "work/kb03-gallery-"));
    const reactPath = webRequire.resolve("react");
    const reactClientPath = webRequire.resolve("react-dom/client");
    const source = join(root, "apps/web/components/global-search/SearchScreen.tsx");
    const localeLib = join(root, "apps/web/lib/i18n.ts");
    const mockQuery = join(directory, "mock-query.tsx");
    const mockLocale = join(directory, "mock-locale.ts");
    const mockNext = join(directory, "mock-next.ts");
    const mockLink = join(directory, "mock-link.tsx");
    const mockApi = join(directory, "mock-api.ts");
    await writeFile(mockQuery, `import React from ${JSON.stringify(reactPath)};\nconst base={notes:[{_id:"n1",title:"Maya's moving note",snippet:"Ask Yoni about the van"}],tasks:[{_id:"t1",title:"Book van with Yoni",status:"todo"}],habits:[],goals:[{_id:"g1",title:"Dana's new flat"}]};\nwindow.__kb03Responses={moving:base};\nexport function useQuery(_ref,args){const [version,setVersion]=React.useState(0);React.useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener("kb03-query",refresh);return()=>window.removeEventListener("kb03-query",refresh)},[]);void version;return args==="skip"?undefined:window.__kb03Responses[args.query]}`);
    await writeFile(mockLocale, `import {translate} from ${JSON.stringify(localeLib)};\nexport function useLocale(){const lang=document.documentElement.lang==="he"?"he":"en";return {lang,dir:lang==="he"?"rtl":"ltr",t:(key)=>translate(lang,key)}}`);
    await writeFile(mockNext, `export const useRouter=()=>({replace:(href)=>history.replaceState(null,"",href)});export const usePathname=()=>"/search";export const useSearchParams=()=>new URLSearchParams(location.search);`);
    await writeFile(mockLink, `import React from ${JSON.stringify(reactPath)};export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`);
    await writeFile(mockApi, `export const api={search:{all:"search.all"}};`);
    const entry = join(directory, "entry.tsx");
    await writeFile(entry, `import React from ${JSON.stringify(reactPath)};import{createRoot}from ${JSON.stringify(reactClientPath)};import{TpIconSprite}from ${JSON.stringify(join(root,"apps/web/components/tempo/TpIcon.tsx"))};import{Kb03Gallery,SearchHeader,SearchScreenBody}from ${JSON.stringify(source)};const probe=new URLSearchParams(location.search).has("probe");createRoot(document.getElementById("root")).render(React.createElement(React.Fragment,null,React.createElement(TpIconSprite),probe?React.createElement("main",{className:"tp-page"},React.createElement(SearchHeader),React.createElement(SearchScreenBody)):React.createElement(Kb03Gallery)));`);
    const mocks: Record<string, string> = {
      "convex/react": mockQuery,
      "next/navigation": mockNext,
      "next/link": mockLink,
      "@/convex/_generated/api": mockApi,
      "@/components/providers/LocaleProvider": mockLocale,
    };
    const outdir = join(directory, "bundle");
    await isolatedBrowserBuild({
      cwd: root, entrypoints: [entry], outdir, resolveFrom: join(root, "apps/web"),
      aliases: { ...mocks, "react-native": mobileRequire.resolve("react-native-web") },
      // The shared child's execution and cleanup fit the unchanged setup deadline.
      timeoutMs: Math.max(1, setupDeadline - Date.now() - 5_000), cleanupMs: 5_000,
    });
    const outputs = await readdir(outdir);
    const scriptPath = outputs.find((file) => file.endsWith(".js"));
    const script = scriptPath ? await readFile(join(outdir, scriptPath), "utf8") : undefined;
    if (!script) throw new Error("KB-03 bundle had no JavaScript output");
    const css = await Promise.all([
      "docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/globals.css", "apps/web/app/v3/kb-03.css",
    ].map((file) => readFile(join(root, file), "utf8")));
    const generatedCss = await Promise.all(outputs.filter((file) => file.endsWith(".css")).map((file) => readFile(join(outdir, file), "utf8")));
    const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join("\n")}\n${generatedCss.join("\n")}</style></head><body style="margin:0;background:var(--tp-ground);color:var(--tp-ink)"><div id="root" style="max-width:760px;margin:auto;padding:16px"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="/bundle.js"></script></body></html>`;
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const isScript = new URL(request.url).pathname === "/bundle.js";
      const page = new URL(request.url).searchParams.get("lang") === "he" ? html.replace('<html lang="en" dir="ltr">', '<html lang="he" dir="rtl">') : html;
      return new Response(isScript ? script : page, { headers: { "Content-Type": isScript ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" } });
    } });
    fixturePhase("KB-03 server ready; browser launch");
    const bundledBrowser = chromium.executablePath();
    const systemBrowser = ["/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
    if (!existsSync(bundledBrowser) && !systemBrowser) throw new Error("No Playwright Chromium or system Chromium is installed for KB-03 gallery");
    browser = await chromium.launch({ ...(existsSync(bundledBrowser) ? {} : { executablePath: systemBrowser }), args: ["--no-sandbox"] });
    fixturePhase("KB-03 browser ready");
  }, 120_000);

  beforeEach(() => fixturePhase("KB-03 browser case start"));

  afterAll(async () => {
    fixturePhase("KB-03 cleanup start");
    await cleanup?.();
    fixturePhase("KB-03 cleanup complete");
  });

  test("loading keeps the last settled production results until the new query settles", async () => {
    const page = await galleryPage(390, true);
    try {
      await pwExpect(page.getByText("Maya's moving note")).toBeVisible();
      await page.getByRole("searchbox").fill("new");
      await pwExpect(page).toHaveURL(/q=new/, { timeout: 10_000 });
      await pwExpect(page.getByText("Maya's moving note")).toBeVisible();
      await pwExpect(page.getByRole("status")).toContainText("Showing the last results");
      await page.evaluate(() => { (window as any).__kb03Responses.new = { notes: [], tasks: [], habits: [], goals: [] }; window.dispatchEvent(new Event("kb03-query")); });
      await pwExpect(page.getByRole("status")).toContainText("No matches");
      await pwExpect(page.getByText("Maya's moving note")).toHaveCount(0);
    } finally { await page.close(); }
  }, 120_000);

  test("LTR arrow keys wrap through the mounted filter radio group", async () => {
    const page = await galleryPage();
    try {
      const all = page.locator('[role="radio"][data-kind="all"]');
      await all.focus();
      await page.keyboard.press("ArrowLeft");
      await pwExpect(page.locator('[role="radio"][data-kind="goals"]')).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("ArrowRight");
      await pwExpect(all).toHaveAttribute("aria-checked", "true");
    } finally { await page.close(); }
  }, 120_000);

  test("RTL arrow keys reverse and wrap; clearing returns focus to the query", async () => {
    const page = await galleryPage();
    try {
      await page.getByRole("button", { name: "עברית" }).click();
      await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
      const all = page.locator('[role="radio"][data-kind="all"]');
      await all.focus();
      await page.keyboard.press("ArrowRight");
      await pwExpect(page.locator('[role="radio"][data-kind="goals"]')).toHaveAttribute("aria-checked", "true");
      await page.getByRole("button", { name: "הצגת כל התוצאות" }).click();
      await pwExpect(all).toHaveAttribute("aria-checked", "true");
      await pwExpect(page.getByRole("searchbox")).toBeFocused();
    } finally { await page.close(); }
  }, 120_000);

  test("mounted Hebrew search wraps arrows and returns query focus after clearing", async () => {
    const page = await galleryPage(390, true, "he");
    try {
      const all = page.locator('[role="radio"][data-kind="all"]');
      const goals = page.locator('[role="radio"][data-kind="goals"]');
      await all.focus();
      await page.keyboard.press("ArrowRight");
      await pwExpect(goals).toHaveAttribute("aria-checked", "true");
      await pwExpect(goals).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await pwExpect(all).toHaveAttribute("aria-checked", "true");
      await pwExpect(all).toBeFocused();
      await page.locator('[role="radio"][data-kind="notes"]').click();
      await page.locator(".sr-filter-summary__clear").click();
      await pwExpect(page.getByRole("searchbox")).toBeFocused();
      await page.keyboard.press("Enter");
      await pwExpect(page.locator("[data-search-result]").first()).toBeFocused();
    } finally { await page.close(); }
  }, 120_000);

  test("Enter from the query moves focus to the first result", async () => {
    const page = await galleryPage();
    try {
      await page.getByRole("searchbox").focus();
      await page.keyboard.press("Enter");
      await pwExpect(page.locator("[data-search-result]").first()).toBeFocused();
    } finally { await page.close(); }
  }, 120_000);

  test("all gallery states and responsive colour variants remain operable", async () => {
    for (const width of [390, 1280]) {
      const page = await galleryPage(width);
      try {
        await page.screenshot({ path: join(root, "work", `kb03-gallery-${width}-en-light.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
        await page.screenshot({ path: join(root, "work", `kb03-gallery-${width}-en-dark.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
        await page.locator('[data-scenario="initial"]').click();
        await pwExpect(page.getByRole("status")).toContainText("Type to search");
        await page.locator('[data-scenario="empty"]').click();
        await pwExpect(page.getByRole("status")).toContainText("No matches");
        await page.locator('[data-scenario="loading"]').click();
        await pwExpect(page.getByText("Maya's moving note")).toBeVisible();
        await page.locator('[data-scenario="error"]').click();
        await page.getByRole("button", { name: "Try again" }).click();
        await pwExpect(page.getByRole("searchbox")).toBeFocused();
        await page.locator('[data-scenario="disabled"]').click();
        await pwExpect(page.getByRole("searchbox")).toBeDisabled();
        await page.locator('[data-scenario="overflow"]').click();
        await pwExpect(page.locator('[data-search-result]')).toHaveCount(10);
        await page.locator('[role="radio"][data-kind="habits"]').click();
        await pwExpect(page.getByRole("status")).toContainText("No Habits results");
        await page.getByRole("button", { name: "Show all results" }).click();
        await pwExpect(page.getByRole("searchbox")).toBeFocused();
        await page.locator('[data-scenario="default"]').click();
        await page.getByRole("button", { name: "עברית" }).click();
        await page.screenshot({ path: join(root, "work", `kb03-gallery-${width}-he-light.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
        await page.screenshot({ path: join(root, "work", `kb03-gallery-${width}-he-dark.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
        await page.evaluate(() => document.documentElement.setAttribute("data-text-size", "l"));
        await pwExpect(page.locator("body")).toHaveCSS("font-size", "20px");
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth <= innerWidth,
          targets: [...document.querySelectorAll(".sr-gallery button")].filter((element) => !(element as HTMLButtonElement).disabled).every((element) => element.getBoundingClientRect().height >= 44),
          motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          largeText: parseFloat(getComputedStyle(document.body).fontSize) >= 20,
          mains: document.querySelectorAll("main").length,
          headings: document.querySelectorAll("h1").length,
        }));
        expect(metrics).toEqual({ overflow: true, targets: true, motion: true, largeText: true, mains: 1, headings: 1 });
      } finally { await page.close(); }
    }
  }, 240_000);

  test("mounted search captures the filtered summary in both languages and themes", async () => {
    for (const width of [390, 1280]) {
      for (const lang of ["en", "he"] as const) {
        const page = await galleryPage(width, true, lang);
        try {
          await page.locator('[role="radio"][data-kind="notes"]').click();
          await pwExpect(page.locator(".sr-filter-summary")).toBeVisible();
          await page.screenshot({ path: join(root, "work", `kb03-mounted-${width}-${lang}-light.png`), fullPage: true });
          await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
          await page.screenshot({ path: join(root, "work", `kb03-mounted-${width}-${lang}-dark.png`), fullPage: true });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        } finally { await page.close(); }
      }
    }
  }, 240_000);
});
