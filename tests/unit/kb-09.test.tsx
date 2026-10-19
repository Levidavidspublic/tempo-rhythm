import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { en, he, kb09t } from "../../apps/web/lib/i18n-groups/kb-09";

const root = process.cwd();
setDefaultTimeout(60_000);
const web = join(root, "apps/web");
const temp = join(root, "work/kb09-fixture");
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let beforeBundleJs: string | null = null;
let beforeBundleCss = "";

const backend = `
import { useSyncExternalStore } from "react";
const listeners = new Set();
const projectId = "project-maya1";
const initial = { _id: "fictional-task-1", _creationTime: 1, createdAt: 1, updatedAt: 1, projectId, projectName: "Maya's project", title: "Plan with Dana", status: "todo" };
const state = { rows: [initial], calls: [], renameMode: "resolve", held: [], loading: false };
function emit() { state.rows = [...state.rows]; for (const fn of listeners) fn(); }
window.__kb09 = {
  state,
  setRows(rows) { state.rows = rows; emit(); },
  setLoading(value) { state.loading = value; emit(); },
  settleRename(ok) { const next = state.held.shift(); if (next) next(ok); },
  reset() { state.rows = [initial]; state.calls.length = 0; state.renameMode = "resolve"; state.held.length = 0; state.loading = false; emit(); },
};
export function useConvexAuth() { return { isAuthenticated: true, isLoading: false }; }
export function useQuery(ref, args) {
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state.rows);
  if (args === "skip") return undefined;
  if (ref === "tasks:list") return state.loading ? undefined : state.rows;
  return { _id: "fictional-user" };
}
export function useMutation(ref) {
  const fn = async (args) => {
    state.calls.push({ ref, args });
    if (ref === "tasks:renameProject") {
      if (state.renameMode === "reject") throw new Error("fictional network error");
      if (state.renameMode === "hold") {
        const ok = await new Promise((resolve) => state.held.push(resolve));
        if (!ok) throw new Error("fictional network error");
      }
      state.rows = state.rows.map((task) => ({ ...task, projectName: args.name, updatedAt: Date.now() })); emit();
    }
    if (ref === "tasks:create") {
      const taskId = "fictional-task-" + (state.rows.length + 1);
      state.rows = [...state.rows, { ...initial, _id: taskId, title: args.title, projectName: args.projectName, projectId: args.projectId, createdAt: Date.now(), updatedAt: Date.now() }]; emit();
      return taskId;
    }
    if (ref === "tasks:toggleCompletion") { state.rows = state.rows.map((task) => task._id === args.taskId ? { ...task, status: task.status === "done" ? "todo" : "done" } : task); emit(); }
    return null;
  };
  fn.withOptimisticUpdate = () => fn;
  return fn;
}
`;

const api = `export const api = { users: { getProfile: "users:getProfile" }, tasks: { list: "tasks:list", create: "tasks:create", remove: "tasks:remove", update: "tasks:update", renameProject: "tasks:renameProject", toggleCompletion: "tasks:toggleCompletion" } };`;

const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { Kb09Gallery, ProjectDetailScreen } from "@/components/projects/ProjectDetailScreen";
const params = new URLSearchParams(location.search);
const lang = params.get("lang") === "he" ? "he" : "en";
const mode = params.get("mode") || "gallery";
const root = createRoot(document.getElementById("app"));
root.render(<LocaleProvider><TpIconSprite />{mode === "screen" ? <main><ProjectDetailScreen projectSlug="project-maya1" /></main> : <Kb09Gallery lang={lang} />}</LocaleProvider>);
`;

function html(mode: string, lang: string): string {
  const before = mode === "before";
  return `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--tp-ground);font-family:var(--tp-font-sans)}*{box-sizing:border-box}main{min-width:0;padding:16px}</style><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/${before ? "before" : "bundle"}.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"test",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}}</script><script type="module" src="/${before ? "before" : "bundle"}.js"></script></body></html>`;
}

async function buildFixture() {
  await mkdir(temp, { recursive: true });
  await writeFile(join(temp, "backend.ts"), backend);
  await writeFile(join(temp, "api.ts"), api);
  await writeFile(join(temp, "entry.tsx"), entry);
  const buildEntry = (entrypoint: string) => Bun.build({
    entrypoints: [entrypoint], target: "browser", outdir: temp,
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS": '"0"' },
    plugins: [{ name: "kb09-fixture", setup(build) {
      build.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
      build.onResolve({ filter: /^next\/link$/ }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
      build.onResolve({ filter: /^convex\/react$/ }, () => ({ path: join(temp, "backend.ts") }));
      build.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({ path: join(temp, "api.ts") }));
      build.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
    } }],
  });
  const result = await buildEntry(join(temp, "entry.tsx"));
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  const js = result.outputs.find((file) => file.path.endsWith(".js"));
  const css = result.outputs.filter((file) => file.path.endsWith(".css"));
  if (!js) throw new Error("No gallery browser bundle");
  const base = ["docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/v3/goals.css"];
  const baseCss = (await Promise.all(base.map((file) => readFile(join(root, file), "utf8")))).join("\n").replace(/@import url\([^;]+;\s*/g, "");
  const bundleCss = (await Promise.all(css.map((file) => file.text()))).join("\n");
  const bundleJs = await js.text();
  // The baseline source was captured before editing. It is local evidence only; CI tests the
  // checked-in current component and does not depend on this ignored workspace snapshot.
  const beforeSource = join(root, "work/kb09-before-source.tsx");
  if (existsSync(beforeSource)) {
    const beforeEntry = `import React from "react"; import { createRoot } from "react-dom/client"; import { LocaleProvider } from "@/components/providers/LocaleProvider"; import { TpIconSprite } from "@/components/tempo/TpIcon"; import { ProjectDetailScreen } from ${JSON.stringify(beforeSource)}; createRoot(document.getElementById("app")).render(<LocaleProvider><TpIconSprite /><main><ProjectDetailScreen projectSlug="project-maya1" /></main></LocaleProvider>);`;
    await writeFile(join(temp, "before-entry.tsx"), beforeEntry);
    const beforeResult = await buildEntry(join(temp, "before-entry.tsx"));
    if (!beforeResult.success) throw new Error(beforeResult.logs.map(String).join("\n"));
    beforeBundleJs = await beforeResult.outputs.find((file) => file.path.endsWith(".js"))?.text() ?? null;
    beforeBundleCss = (await Promise.all(beforeResult.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text()))).join("\n");
  }
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/bundle.js") return new Response(bundleJs, { headers: { "content-type": "text/javascript" } });
    if (path === "/bundle.css") return new Response(bundleCss, { headers: { "content-type": "text/css" } });
    if (path === "/before.js") return new Response(beforeBundleJs ?? "", { headers: { "content-type": "text/javascript" } });
    if (path === "/before.css") return new Response(beforeBundleCss, { headers: { "content-type": "text/css" } });
    if (path === "/base.css") return new Response(baseCss, { headers: { "content-type": "text/css" } });
    const url = new URL(request.url);
    return new Response(html(url.searchParams.get("mode") ?? "gallery", url.searchParams.get("lang") === "he" ? "he" : "en"), { headers: { "content-type": "text/html" } });
  } });
  const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"].find(existsSync);
  if (!browserPath) throw new Error("KB-09 browser fixture needs an installed Playwright Chromium or system Chrome/Chromium");
  browser = await chromium.launch({ executablePath: browserPath, args: ["--no-sandbox"] });
}

async function pageFor(mode: "screen" | "gallery" | "before" = "screen", lang: "en" | "he" = "en", width = 390): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}`);
  try { await page.locator("h1").waitFor({ state: "attached", timeout: 10000 }); }
  catch { throw new Error(`Gallery did not hydrate: ${errors.join(" | ")} ${await page.locator("body").innerText()}`); }
  return page;
}

describe.serial("KB-09 project detail", () => {
  beforeAll(buildFixture, 120_000);
  afterAll(async () => { await browser?.close(); server?.stop(true); });

  test("en/he dictionary keys match", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    expect(kb09t("he", "task.completeNamed", { title: "דנה" })).toContain("דנה");
  });

  test("first task pending keeps the draft name beside the add field", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb09.setRows([]));
    const input = page.getByRole("textbox", { name: /project name/i });
    await input.fill("Maya's new plan"); await input.press("Enter");
    await pwExpect(page.getByText(en.firstTask)).toBeVisible();
    await pwExpect(page.getByRole("textbox", { name: /task/i })).toBeFocused();
    await page.close();
  });

  test("rename pending appears at the field", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb09.state.renameMode = "hold");
    const input = page.getByRole("textbox", { name: /project name/i });
    await input.fill("Maya and Dana"); await input.press("Enter");
    await pwExpect(page.getByText(en["rename.pending"])).toBeVisible();
    await page.close();
  });

  test("rename error keeps the typed text and has field association", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb09.state.renameMode = "reject");
    const input = page.getByRole("textbox", { name: /project name/i });
    await input.fill("Keep this name"); await input.press("Enter");
    await pwExpect(page.getByText(en["rename.error"])).toBeVisible();
    await pwExpect(input).toHaveValue("Keep this name");
    await pwExpect(input).toHaveAttribute("aria-invalid", "true");
    await page.close();
  });

  test("stale rename result does not overwrite a newer draft", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb09.state.renameMode = "hold");
    const input = page.getByRole("textbox", { name: /project name/i });
    await input.fill("Old draft"); await input.press("Enter");
    await input.fill("New draft");
    await page.evaluate(() => (window as any).__kb09.settleRename(true));
    await pwExpect(input).toHaveValue("New draft");
    await pwExpect(page.getByText(en["rename.saved"])).toHaveCount(0);
    await page.close();
  });

  test("task toggle updates checked state and action text", async () => {
    const page = await pageFor();
    const toggle = page.getByRole("checkbox", { name: /Plan with Dana/ });
    await toggle.click();
    await pwExpect(toggle).toHaveAttribute("aria-checked", "true");
    await pwExpect(page.getByText(en["task.reopen"])).toBeVisible();
    await page.close();
  });

  test("long title wraps with no phone overflow", async () => {
    const page = await pageFor("gallery");
    await page.getByRole("button", { name: en["gallery.overflow"] }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.close();
  });

  test("focus returns to add after cancel", async () => {
    const page = await pageFor("gallery");
    await page.getByRole("button", { name: en["gallery.add"] }).click();
    await pwExpect(page.getByRole("textbox", { name: en["gallery.taskLabel"] })).toBeFocused();
    await page.getByRole("button", { name: en["gallery.cancel"] }).click();
    await pwExpect(page.getByRole("button", { name: en["gallery.add"] })).toBeFocused();
    await page.close();
  });

  test("mounted project returns focus to add after cancel", async () => {
    const page = await pageFor();
    await page.getByRole("button", { name: /add a task/i }).click();
    await pwExpect(page.getByRole("textbox", { name: /new task/i })).toBeFocused();
    await page.getByRole("button", { name: en["gallery.cancel"] }).click();
    await pwExpect(page.getByRole("button", { name: /add a task/i })).toBeFocused();
    await page.close();
  });

  test("Hebrew gallery is RTL and keeps one main and h1", async () => {
    const page = await pageFor("gallery", "he");
    await pwExpect(page.locator("main")).toHaveCount(1);
    await pwExpect(page.locator("h1")).toHaveCount(1);
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    await page.getByRole("checkbox", { name: /דנה/ }).click();
    await pwExpect(page.getByRole("checkbox", { name: /דנה/ })).toHaveAttribute("aria-checked", "true");
    await page.close();
  });

  test("phone task action is at least 44px in both axes", async () => {
    const page = await pageFor();
    const size = await page.getByRole("checkbox", { name: /Plan with Dana/ }).boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(44);
    expect(size?.height).toBeGreaterThanOrEqual(44);
    await page.close();
  });

  test("gallery states and controls work at desktop width", async () => {
    const page = await pageFor("gallery", "en", 1280);
    for (const [view, text] of [["empty", en["gallery.emptyText"]], ["loading", en["gallery.loadingText"]], ["error", en["gallery.errorText"]]] as const) {
      await page.getByRole("button", { name: en[`gallery.${view}`] }).click();
      await pwExpect(page.getByText(text)).toBeVisible();
    }
    await page.getByRole("button", { name: en["gallery.retry"] }).click();
    await pwExpect(page.getByRole("checkbox", { name: /Plan with Dana/ })).toBeVisible();
    await page.getByRole("button", { name: en["gallery.disabled"] }).click();
    await pwExpect(page.getByRole("checkbox", { name: /Plan with Dana/ })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.close();
  });

  test("browser evidence covers widths, locales, and themes", async () => {
    const shots = join(root, "work/kb09-captures");
    await mkdir(shots, { recursive: true });
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"] as const) {
      for (const mode of beforeBundleJs ? ["before", "screen"] as const : ["screen"] as const) {
        const page = await pageFor(mode, lang, width);
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        await pwExpect(page.locator("main")).toHaveCount(1);
        await pwExpect(page.locator("h1")).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: join(shots, `${mode}-${width}-${lang}-${theme}.png`), fullPage: true });
        await page.close();
      }
    }
  }, 300_000);
});
