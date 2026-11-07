import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { en, he, kb09t } from "../../apps/web/lib/i18n-groups/kb-09";

const root = process.cwd();

// Keep module defaults, Bun.build and Bun.serve out of other suites' process state.
if (process.env.KB09_ISOLATED !== "1") {
  type ChildCase = { name: string; status: "passed" | "failed" | "skipped"; details: string };
  type ChildResult = { code: number; output: string; cases: ChildCase[]; reportError?: string };
  const names = [...(await readFile(import.meta.path, "utf8")).matchAll(/\btest\("([^"\n]+)"/g)].map((match) => match[1]);
  const decode = (value: string) => value.replace(/&(quot|apos|lt|gt|amp);/g, (_, key: string) =>
    ({ quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" })[key] ?? key);
  const parseCases = (xml: string): ChildCase[] => [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map((match) => {
    const name = decode(match[1].match(/\bname="([^"]*)"/)?.[1] ?? "");
    const details = match[2] ?? "";
    const status = /<(?:failure|error)\b/.test(details) ? "failed" : /<skipped\b/.test(details) ? "skipped" : "passed";
    return { name, status, details };
  });
  const parserName = "isolated KB-09 preserves passed failed and skipped child report statuses";
  test(parserName, () => {
    const xml = '<testsuite><testcase name="before" /><testcase name="failed"><failure>real failure</failure></testcase><testcase name="after" /><testcase name="skipped"><skipped /></testcase></testsuite>';
    expect(parseCases(xml).map(({ name, status }) => ({ name, status }))).toEqual([
      { name: "before", status: "passed" }, { name: "failed", status: "failed" },
      { name: "after", status: "passed" }, { name: "skipped", status: "skipped" },
    ]);
  });
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let reportDir: string | undefined;
  let result: Promise<ChildResult> | undefined;
  const run = () => result ??= (async () => {
    const work = join(root, "work");
    await mkdir(work, { recursive: true });
    reportDir = await mkdtemp(join(work, "kb09-run-"));
    const reportPath = join(reportDir, "results.xml");
    try {
      child = Bun.spawn([process.execPath, "test", import.meta.path, "--reporter=junit", `--reporter-outfile=${reportPath}`], {
        cwd: root, env: { ...process.env, KB09_ISOLATED: "1" }, stdout: "pipe", stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ]);
      const output = stdout + stderr;
      process.stderr.write(output);
      let xml = "";
      let reportError: string | undefined;
      try { xml = await readFile(reportPath, "utf8"); }
      catch (error) { reportError = String(error); }
      const cases = parseCases(xml);
      return { code, output, cases, reportError };
    } finally {
      if (reportDir) await rm(reportDir, { recursive: true, force: true });
    }
  })();
  for (const name of names) {
    test(name, async () => {
      const completed = await run();
      const matches = completed.cases.filter((item) => item.name === name || item.name.endsWith(` > ${name}`));
      if (matches.length !== 1) throw new Error(`KB-09 child did not report exactly one result for ${name}; exit ${completed.code}; ${completed.reportError ?? ""}\n${completed.output}`);
      if (matches[0].status !== "passed") throw new Error(`KB-09 child case ${name}: ${matches[0].status}\n${matches[0].details}\n${completed.output}`);
      expect(matches[0].status).toBe("passed");
    }, 300_000);
  }
  const gateName = "isolated KB-09 child exits successfully and reports every case";
  test(gateName, async () => {
    const completed = await run();
    expect(completed.code).toBe(0);
    expect(completed.cases).toHaveLength(names.length);
    expect(completed.reportError).toBeUndefined();
  }, 300_000);
  afterAll(async () => {
    if (child?.exitCode === null) { child.kill(); await child.exited; }
    if (reportDir) await rm(reportDir, { recursive: true, force: true });
  });
} else {
setDefaultTimeout(60_000);
const web = join(root, "apps/web");
let temp: string;
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
import { flushSync } from "react-dom";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { Kb09Gallery, ProjectDetailScreen } from "@/components/projects/ProjectDetailScreen";
const params = new URLSearchParams(location.search);
const lang = params.get("lang") === "he" ? "he" : "en";
const mode = params.get("mode") || "gallery";
const root = createRoot(document.getElementById("app"));
window.__kb09.flush = () => flushSync(() => {});
root.render(<LocaleProvider><TpIconSprite />{mode === "screen" ? <main><ProjectDetailScreen projectSlug="project-maya1" /></main> : <Kb09Gallery lang={lang} />}</LocaleProvider>);
`;

function html(mode: string, lang: string): string {
  const before = mode === "before";
  return `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--tp-ground);font-family:var(--tp-font-sans)}*{box-sizing:border-box}main{min-width:0;padding:16px}</style><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/${before ? "before" : "bundle"}.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"test",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}}</script><script type="module" src="/${before ? "before" : "bundle"}.js"></script></body></html>`;
}

async function buildFixture() {
  await mkdir(join(root, "work"), { recursive: true });
  temp = await mkdtemp(join(root, "work/kb09-fixture-"));
  await writeFile(join(temp, "backend.ts"), backend);
  await writeFile(join(temp, "api.ts"), api);
  await writeFile(join(temp, "entry.tsx"), entry);
  const buildEntry = (entrypoint: string) => Bun.build({
    entrypoints: [entrypoint], target: "browser", outdir: temp,
    define: { "process.env.NODE_ENV": '"test"', "process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS": '"0"' },
    plugins: [{ name: "kb09-fixture", setup(build) {
      build.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
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
  afterAll(async () => {
    try { server?.stop(true); }
    finally {
      try { await browser?.close(); }
      finally { if (temp) await rm(temp, { recursive: true, force: true }); }
    }
  });

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
    await page.waitForFunction(() => (window as any).__kb09.state.rows[0]?.projectName === "Old draft");
    await page.evaluate(() => (window as any).__kb09.flush());
    await pwExpect(input).toHaveValue("New draft");
    await pwExpect(page.getByText(en["rename.saved"])).toHaveCount(0);
    await page.close();
  });

  test("acknowledged padded rename accepts later stored names and task creation", async () => {
    for (const lang of ["en", "he"] as const) {
      const page = await pageFor("screen", lang);
      try {
        const input = page.locator(".gx-title-input");
        await page.evaluate(() => (window as any).__kb09.state.renameMode = "hold");
        await input.fill("  Maya and Dana  "); await input.press("Enter");
        expect(await page.evaluate(() => (window as any).__kb09.state.calls.filter((call: any) => call.ref === "tasks:renameProject")))
          .toEqual([{ ref: "tasks:renameProject", args: { projectId: "project-maya1", name: "Maya and Dana" } }]);
        await page.evaluate(() => (window as any).__kb09.settleRename(true));
        await page.waitForFunction(() => (window as any).__kb09.state.rows[0]?.projectName === "Maya and Dana");
        await page.evaluate(() => (window as any).__kb09.flush());
        await pwExpect(input).toHaveValue("Maya and Dana");
        await page.evaluate(() => {
          const fixture = (window as any).__kb09;
          fixture.setRows(fixture.state.rows.map((row: any) => ({ ...row, projectName: "Yoni's updated project", updatedAt: Date.now() + 1 })));
        });
        await pwExpect(input).toHaveValue("Yoni's updated project");
        await page.locator(".tp-section > button").click();
        await page.locator("#pd-add").fill("Read with Dana");
        await page.locator("#pd-add").press("Enter");
        await page.waitForFunction(() => (window as any).__kb09.state.calls.some((call: any) => call.ref === "tasks:create"));
        expect(await page.evaluate(() => (window as any).__kb09.state.calls.find((call: any) => call.ref === "tasks:create")?.args))
          .toEqual({ title: "Read with Dana", projectId: "project-maya1", projectName: "Yoni's updated project" });
      } finally { await page.close(); }
    }
  });

  test("padded rename settlement preserves a genuinely newer raw draft", async () => {
    const page = await pageFor();
    try {
      const input = page.locator(".gx-title-input");
      await page.evaluate(() => (window as any).__kb09.state.renameMode = "hold");
      await input.fill("  Old draft  "); await input.press("Enter");
      await input.fill("  New unsaved draft  "); await input.press("Enter");
      await pwExpect(input).not.toBeFocused();
      expect(await page.evaluate(() => (window as any).__kb09.state.held.length)).toBe(2);
      await page.evaluate(() => (window as any).__kb09.settleRename(true));
      await page.waitForFunction(() => (window as any).__kb09.state.rows[0]?.projectName === "Old draft");
      await page.evaluate(() => (window as any).__kb09.flush());
      await pwExpect(input).toHaveValue("  New unsaved draft  ");
      await pwExpect(page.getByText(en["rename.saved"])).toHaveCount(0);
    } finally { await page.close(); }
  });

  test("task accessible names preserve dollar sequences literally in both languages", async () => {
    const title = "Budget $$100 $& $` $'";
    const labels = {
      en: [`Mark done: ${title}`, `Reopen ${title}`],
      he: [`סימון כהושלמה: ${title}`, `פתיחה מחדש של ${title}`],
    };
    for (const lang of ["en", "he"] as const) for (const mode of ["screen", "gallery"] as const) {
      const page = await pageFor(mode, lang);
      try {
        await pwExpect(page.locator("html")).toHaveAttribute("lang", lang);
        if (mode === "screen") {
          await page.evaluate((value) => {
            const fixture = (window as any).__kb09;
            fixture.setRows(fixture.state.rows.map((row: any) => ({ ...row, title: value })));
          }, title);
        } else {
          await page.getByRole("button", { name: kb09t(lang, "gallery.add"), exact: true }).click();
          await page.getByLabel(kb09t(lang, "gallery.taskLabel"), { exact: true }).fill(title);
          await page.getByRole("button", { name: kb09t(lang, "gallery.add"), exact: true }).click();
        }
        await pwExpect(page.getByText(title, { exact: true })).toBeVisible();
        const toggle = mode === "gallery" ? page.getByRole("checkbox").last() : page.getByRole("checkbox").first();
        await pwExpect(toggle).toHaveAccessibleName(labels[lang][0]);
        await toggle.click();
        await pwExpect(toggle).toHaveAttribute("aria-checked", "true");
        await pwExpect(toggle).toHaveAccessibleName(labels[lang][1]);
      } finally { await page.close(); }
    }
  });

  test("task accessible names contain their visible localized action and title", async () => {
    for (const lang of ["en", "he"] as const) for (const mode of ["screen", "gallery"] as const) {
      const page = await pageFor(mode, lang);
      try {
        await pwExpect(page.locator("html")).toHaveAttribute("lang", lang);
        const toggle = page.getByRole("checkbox").first();
        const title = mode === "gallery" ? kb09t(lang, "gallery.initialTask") : "Plan with Dana";
        for (const done of [false, true]) {
          const action = kb09t(lang, done ? "task.reopen" : "task.complete");
          await pwExpect(toggle.locator(".kb09-task-actions__text")).toHaveText(action);
          const name = await toggle.getAttribute("aria-label");
          expect(name).toContain(action);
          expect(name).toContain(title);
          await pwExpect(toggle).toHaveAccessibleName(name!);
          await pwExpect(toggle).toHaveAttribute("aria-checked", String(done));
          if (!done) await toggle.click();
        }
      } finally { await page.close(); }
    }
  });

  test("rename status stays mounted through idle saving saved and separate error", async () => {
    for (const lang of ["en", "he"] as const) {
      const page = await pageFor("screen", lang);
      try {
        await pwExpect(page.locator("html")).toHaveAttribute("lang", lang);
        const input = page.locator(".gx-title-input");
        const status = page.locator('output[data-component="ProjectDetailNotice"]').first();
        await pwExpect(status).toHaveCount(1);
        await pwExpect(status).toHaveRole("status");
        await pwExpect(status).toHaveText("");
        await page.evaluate(() => { (window as any).__kb09.statusNode = document.querySelector('output[data-component="ProjectDetailNotice"]'); });
        expect(await status.evaluate((node: HTMLElement) => !node.hidden && node.getAttribute("aria-hidden") !== "true" && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden")).toBe(true);
        await page.evaluate(() => (window as any).__kb09.state.renameMode = "hold");
        await input.fill("Maya and Dana"); await input.press("Enter");
        await pwExpect(status).toHaveText(kb09t(lang, "rename.pending"));
        await page.evaluate(() => (window as any).__kb09.settleRename(true));
        await pwExpect(status).toHaveText(kb09t(lang, "rename.saved"));
        await input.fill("Keep this name");
        await pwExpect(status).toHaveText("");
        await page.evaluate(() => (window as any).__kb09.state.renameMode = "reject");
        await input.press("Enter");
        const alert = page.getByRole("alert").filter({ hasText: kb09t(lang, "rename.error") });
        await pwExpect(alert).toHaveCount(1);
        await pwExpect(input).toHaveValue("Keep this name");
        await pwExpect(input).toHaveAttribute("aria-describedby", (await alert.getAttribute("id"))!);
        await pwExpect(status).toHaveText("");
        expect(await page.evaluate(() => document.querySelector('output[data-component="ProjectDetailNotice"]') === (window as any).__kb09.statusNode)).toBe(true);
        const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
        expect(new Set(ids).size).toBe(ids.length);
      } finally { await page.close(); }
    }
  });

  test("task toggle updates checked state and action text", async () => {
    const page = await pageFor();
    const toggle = page.getByRole("checkbox", { name: /Plan with Dana/ });
    await toggle.click();
    await pwExpect(toggle).toHaveAttribute("aria-checked", "true");
    await pwExpect(page.getByText(en["task.reopen"])).toBeVisible();
    await page.close();
  });

  test("gallery tasks complete and reopen independently, including newly added rows", async () => {
    const page = await pageFor("gallery");
    const first = page.getByRole("checkbox", { name: /Plan with Dana/ });
    const addTask = async (title: string) => {
      await page.getByRole("button", { name: en["gallery.add"] }).click();
      await page.getByRole("textbox", { name: en["gallery.taskLabel"] }).fill(title);
      await page.getByRole("button", { name: en["gallery.add"] }).click();
    };
    await addTask("Read with Yoni");
    const second = page.getByRole("checkbox", { name: /Read with Yoni/ });
    await first.click();
    await pwExpect(first).toHaveAttribute("aria-checked", "true");
    await pwExpect(second).toHaveAttribute("aria-checked", "false");
    await second.click();
    await pwExpect(first).toHaveAttribute("aria-checked", "true");
    await pwExpect(second).toHaveAttribute("aria-checked", "true");
    await addTask("Walk with Maya");
    await pwExpect(page.getByRole("checkbox", { name: /Walk with Maya/ })).toHaveAttribute("aria-checked", "false");
    await first.click();
    await pwExpect(first).toHaveAttribute("aria-checked", "false");
    await pwExpect(second).toHaveAttribute("aria-checked", "true");
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

  test("gallery overflow never feeds its display suffix into editable title state", async () => {
    for (const lang of ["en", "he"] as const) {
      const page = await pageFor("gallery", lang);
      try {
        const input = page.getByLabel(kb09t(lang, "gallery.projectLabel"), { exact: true });
        const overflow = page.getByRole("button", { name: kb09t(lang, "gallery.overflow"), exact: true });
        const normal = page.getByRole("button", { name: kb09t(lang, "gallery.default"), exact: true });
        let title = lang === "he" ? "הפרויקט של דנה" : "Dana's project";
        await input.fill(title);
        for (const typed of ["A", "B"]) {
          await overflow.click();
          await pwExpect(input).toHaveValue(title);
          await input.focus();
          await input.press("End");
          await input.pressSequentially(typed);
          title += typed;
          await pwExpect(input).toHaveValue(title);
          await pwExpect(page.getByText(`${title} — ${kb09t(lang, "gallery.longText").repeat(12)}`, { exact: true })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await normal.click();
          await pwExpect(input).toHaveValue(title);
        }
        await overflow.click();
        await pwExpect(input).toHaveValue(title);
      } finally { await page.close(); }
    }
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
    const shots = join(temp, "captures");
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

}
