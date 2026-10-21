import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createElement, type ReactElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { chromium } from "@playwright/test";
import { en, he, kb05t } from "../../apps/web/lib/i18n-groups/kb-05";
import { GoalEmptyState, GoalNameForm, GoalProgressLabel, Kb05Gallery } from "../../apps/web/components/goals/GoalsScreen";

import { fixtureCleanup, fixturePhase } from "../helpers/kitchen-fixture";
import { isolatedBrowserBuild, waitForCommittedFocus } from "../helpers/kitchen-browser";

const repo = resolve(import.meta.dir, "../..");
const render = (element: ReactElement) => renderToStaticMarkup(element);

// Bundle in a fresh process so another suite's module mocks cannot affect Bun's resolver.
// Success requires the authoritative isolated child exit plus actual emitted JavaScript.
async function buildBrowserFixture(entry: string, directory: string, deadline: number, aliases: Record<string, string> = {}) {
  const outdir = join(directory, "bundle");
  const cleanupMs = Math.min(1000, Math.max(1, Math.floor((deadline - Date.now()) / 2)));
  fixturePhase("KB-05 build start");
  await isolatedBrowserBuild({
    cwd: repo, resolveFrom: join(repo, "apps/web"), entrypoints: [entry], outdir,
    timeoutMs: Math.max(1, deadline - Date.now() - cleanupMs), cleanupMs,
    aliases: {
      "@/convex/_generated/api": Bun.resolveSync("./convex/_generated/api", repo),
      "@/convex/lib/softDelete": Bun.resolveSync("./convex/lib/softDelete", repo),
      ...aliases,
    },
  });
  const outputs = (await readdir(outdir)).map((name) => ({
    path: join(outdir, name), arrayBuffer: () => Bun.file(join(outdir, name)).arrayBuffer(),
  }));
  fixturePhase("KB-05 build complete");
  return { success: outputs.some((output) => output.path.endsWith(".js")), outputs };
}

describe("KB-05 goals list", () => {
  test("empty list has a calm next step", () => {
    const html = render(createElement(GoalEmptyState, { lang: "en", onCreate() {} }));
    expect(html).toContain("A place for what matters");
    expect(html).toContain("Write a first goal");
    expect(html).toContain("data-component=\"GoalEmptyState\"");
  });

  test("zero progress has words and a zero-valued meter", () => {
    const html = render(createElement(GoalProgressLabel, { percent: 0, status: "active", lang: "en" }));
    expect(html).toContain("Ready when you are");
    expect(html).toContain("0%");
    expect(html).toContain('value="0"');
  });

  test("partial progress is numbered and named", () => {
    const html = render(createElement(GoalProgressLabel, { percent: 45, status: "active", lang: "en" }));
    expect(html).toContain("Moving along");
    expect(html).toContain("45%");
    expect(html).toContain('value="45"');
  });

  test("complete goal has an explicit completion word", () => {
    const html = render(createElement(GoalProgressLabel, { percent: 100, status: "done", lang: "en" }));
    expect(html).toContain("Complete");
    expect(html).toContain("100%");
  });

  test("completed status does not invent full progress", () => {
    const html = render(createElement(GoalProgressLabel, { percent: 30, status: "done", lang: "en" }));
    expect(html).toContain("Marked done");
    expect(html).toContain("30%");
  });

  test("resting goal has a word even at partial progress", () => {
    const html = render(createElement(GoalProgressLabel, { percent: 25, status: "resting", lang: "en" }));
    expect(html).toContain("Resting for now");
    expect(html).toContain("25%");
  });

  test("out-of-range values are bounded for a truthful meter", () => {
    const high = render(createElement(GoalProgressLabel, { percent: 800, status: "active", lang: "en" }));
    const low = render(createElement(GoalProgressLabel, { percent: -20, status: "active", lang: "en" }));
    expect(high).toContain('value="100"');
    expect(low).toContain('value="0"');
  });

  test("disabled empty action remains visible but unavailable", () => {
    const html = render(createElement(GoalEmptyState, { lang: "en", onCreate() {}, disabled: true }));
    expect(html).toContain("disabled");
    expect(html).toContain("Write a first goal");
  });

  test("Hebrew long text has direction and a bounded card layout", () => {
    const html = render(createElement(Kb05Gallery, { lang: "he" }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("תצוגת מטרות");
    expect(html).toContain("שם ארוך");
  });

  test("production name form has a labelled field", () => {
    const html = render(createElement(GoalNameForm, { lang: "he", busy: false, onSubmit() {}, onCancel() {} }));
    expect(html).toContain('for="gl-name"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain("שם המטרה");
  });

  test("English and Hebrew keys stay paired", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(kb05t("en", key).trim().length).toBeGreaterThan(0);
      expect(kb05t("he", key).trim().length).toBeGreaterThan(0);
    }
  });
});

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let directory: string | undefined;

const cleanup = fixtureCleanup({
  browser: () => browser?.close(),
  server: () => server?.stop(true),
  directory: () => directory ? rm(directory, { recursive: true, force: true }) : undefined,
}, 30_000);
afterAll(async () => {
  fixturePhase("KB-05 gallery cleanup start");
  await cleanup();
  fixturePhase("KB-05 gallery cleanup complete");
}, 30_000);

test("hydrated gallery exercises the real name form, focus return, RTL, and 44 px actions", async () => {
  const deadline = Date.now() + 240_000;
  fixturePhase("KB-05 gallery case start");
  directory = await mkdtemp(join(tmpdir(), "tempo-kb05-"));
  const entry = join(directory, "entry.tsx");
  const modulePath = join(repo, "apps/web/components/goals/GoalsScreen.tsx");
  await writeFile(entry, `import React from "${join(repo, "apps/web/node_modules/react")}";\nimport { createRoot } from "${join(repo, "apps/web/node_modules/react-dom/client")}";\nimport { TpIconSprite } from "${join(repo, "apps/web/components/tempo/TpIcon.tsx")}";\nimport { Kb05Gallery } from ${JSON.stringify(modulePath)};\nconst params = new URLSearchParams(location.search); createRoot(document.getElementById("root")!).render(React.createElement(React.Fragment, null, React.createElement(TpIconSprite), React.createElement(Kb05Gallery, { lang: params.get("lang") === "he" ? "he" : "en" })));`);
  const result = await buildBrowserFixture(entry, directory, deadline);
  expect(result.success).toBe(true);
  const assets = new Map<string, Uint8Array>();
  for (const output of result.outputs) assets.set(`/${output.path.split("/").at(-1)}`, new Uint8Array(await output.arrayBuffer()));
  for (const [url, file] of [
    ["/tokens.css", "docs/design/v3/tokens.css"],
    ["/tempo.css", "docs/design/v3/tempo.css"],
    ["/goals.css", "apps/web/app/v3/goals.css"],
  ]) assets.set(url, new Uint8Array(await readFile(join(repo, file))));
  const styleLinks = [...assets.keys()].filter((name) => name.endsWith(".css") && !["/tokens.css", "/tempo.css", "/goals.css"].includes(name)).map((name) => `<link rel="stylesheet" href="${name}">`).join("");
  const script = [...assets.keys()].find((name) => name.endsWith(".js"));
  expect(script).toBeDefined();
  fixturePhase("KB-05 gallery server start");
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/tempo.css"><link rel="stylesheet" href="/goals.css">${styleLinks}</head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="${script}"></script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    const asset = assets.get(path);
    return asset ? new Response(asset, { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } }) : new Response("missing", { status: 404 });
  } });
  const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
  if (!browserPath) throw new Error("KB-05 browser fixture needs Playwright Chromium or an installed chromium/google-chrome binary");
  fixturePhase("KB-05 gallery browser launch");
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--no-sandbox"] });
  for (const lang of ["en", "he"] as const) {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.port}/?lang=${lang}`);
      try { await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 8000 }); }
      catch { throw new Error(`KB-05 gallery did not hydrate: ${browserErrors.join(" | ") || (await page.content()).slice(0, 700)}`); }
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const captureRoot = process.env.KB05_CAPTURE_DIR;
      if (captureRoot) await page.screenshot({ path: join(captureRoot, `after-${lang}-${width}-default-light.png`), fullPage: true });
      try { await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.empty") }).click({ timeout: 5000 }); }
      catch { throw new Error(`KB-05 empty state control missing (${lang}, ${width}): ${JSON.stringify(await page.locator("button").allTextContents())}`); }
      expect(await page.locator('[data-component="GoalEmptyState"]').count()).toBe(1);
      if (captureRoot) {
        await page.screenshot({ path: join(captureRoot, `after-${lang}-${width}-empty-light.png`), fullPage: true });
        await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await page.screenshot({ path: join(captureRoot, `after-${lang}-${width}-empty-dark.png`), fullPage: true });
        await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      }
      await page.locator("#kb05-empty-action").click();
      const input = page.locator("#gl-name");
      await input.waitFor();
      await waitForCommittedFocus(input, 30_000);
      expect(await input.evaluate((node) => node === document.activeElement)).toBe(true);
      await page.locator("form button[type=submit]").click();
      expect(await input.getAttribute("aria-invalid")).toBe("true");
      expect(await input.getAttribute("aria-describedby")).toBe("gl-name-hint");
      await input.press("Escape");
      expect(await input.count()).toBe(0);
      await page.waitForFunction(() => document.activeElement?.id === "kb05-empty-action");
      expect(await page.locator("#kb05-empty-action").evaluate((node) => node === document.activeElement)).toBe(true);
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.create") }).click();
      await page.locator("#gl-name").fill(lang === "he" ? "לקרוא יותר ספרים" : "Read more books");
      await page.locator("form button[type=submit]").click();
      expect(await page.getByText(kb05t(lang, "kb05.gallery.saved")).count()).toBe(1);
      await page.waitForFunction((label) => document.activeElement?.textContent?.trim() === label, kb05t(lang, "kb05.gallery.create"));
      expect(await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.create") }).evaluate((node) => node === document.activeElement)).toBe(true);
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.overflow") }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.loading") }).click();
      expect(await page.getByText(kb05t(lang, "kb05.gallery.loadingText")).count()).toBe(1);
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.error") }).click();
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.retry") }).click();
      expect(await page.locator('[data-component="GoalProgressLabel"]').count()).toBe(2);
      await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.disabled") }).click();
      expect(await page.getByRole("button", { name: kb05t(lang, "kb05.gallery.create") }).isDisabled()).toBe(true);
      const lightPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tp-paper"));
      await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      const darkPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tp-paper"));
      expect(darkPaper).not.toBe(lightPaper);
      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      for (const button of await page.locator(".kb05-gallery button").all()) {
        const box = await button.boundingBox();
        if (box && await button.isVisible()) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.close();
    }
  }
}, 240_000);

type CreateFixtureWindow = Window & {
  __kb05Create: { calls: { title: string }[]; finishCreate(): void };
};

test("production GoalsScreen focuses the newly created goal after the query includes it", async () => {
  const deadline = Date.now() + 30_000;
  fixturePhase("KB-05 production case start");
  const fixtureRoot = join(repo, "work");
  await mkdir(fixtureRoot, { recursive: true });
  const fixtureDirectory = await mkdtemp(join(fixtureRoot, "tempo-kb05-create-"));
  let fixtureServer: ReturnType<typeof Bun.serve> | undefined;
  let fixtureBrowser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const cleanupProduction = fixtureCleanup({
    browser: () => fixtureBrowser?.close(),
    server: () => fixtureServer?.stop(true),
    directory: () => rm(fixtureDirectory, { recursive: true, force: true }),
  }, 30_000);
  try {
    const webRoot = join(repo, "apps/web");
    const reactPaths = {
      react: Bun.resolveSync("react", webRoot),
      "react/jsx-runtime": Bun.resolveSync("react/jsx-runtime", webRoot),
      "react/jsx-dev-runtime": Bun.resolveSync("react/jsx-dev-runtime", webRoot),
    };
    const reactClientPath = Bun.resolveSync("react-dom/client", webRoot);
    const shim = join(fixtureDirectory, "convex-react.ts");
    // Stub only the backend boundary. GoalsScreen, its shared controls, locale provider,
    // mutation handler, rendered GoalCard, and focus effect remain the production code.
    await writeFile(shim, `
      import { getFunctionName } from "${join(repo, "node_modules/convex/server")}";
      const fixture = window.__kb05Create = {
        goals: [{ _id: "goals_existing", _creationTime: 1, title: "Read with Maya", status: "completed", progressPercent: 100 }],
        calls: [], resolveCreate: null,
        finishCreate() {
          const title = this.calls[0].title;
          this.goals = [{ _id: "goals_new", _creationTime: 2, title, status: "active", progressPercent: 0 }, ...this.goals];
          this.resolveCreate("goals_new");
        },
      };
      export const useConvexAuth = () => ({ isAuthenticated: true, isLoading: false });
      export function useQuery(reference, args) {
        if (args === "skip") return undefined;
        const name = getFunctionName(reference);
        if (name === "users:getProfile") return { _id: "users_fictional", greetingName: "Maya" };
        if (name === "goals:list") return fixture.goals;
        throw new Error("Unexpected query: " + name);
      }
      export function useMutation(reference) {
        const name = getFunctionName(reference);
        if (name === "goals:create") return (args) => {
          fixture.calls.push(args);
          return new Promise((resolve) => { fixture.resolveCreate = resolve; });
        };
        if (name === "goals:remove") return async () => ({ success: true });
        throw new Error("Unexpected mutation: " + name);
      }
    `);
    const entry = join(fixtureDirectory, "entry.tsx");
    await writeFile(entry, `
      import React from "${reactPaths.react}";
      import { createRoot } from "${reactClientPath}";
      import { GoalsScreen } from "${join(repo, "apps/web/components/goals/GoalsScreen.tsx")}";
      import { LocaleProvider } from "${join(repo, "apps/web/components/providers/LocaleProvider.tsx")}";
      createRoot(document.getElementById("root")).render(<LocaleProvider><GoalsScreen /></LocaleProvider>);
    `);
    const result = await buildBrowserFixture(entry, fixtureDirectory, deadline, {
      "convex/react": shim,
      ...reactPaths,
    });
    expect(result.success).toBe(true);
    const assets = new Map<string, Uint8Array>();
    for (const output of result.outputs) assets.set(`/${output.path.split("/").at(-1)}`, new Uint8Array(await output.arrayBuffer()));
    const script = [...assets.keys()].find((name) => name.endsWith(".js"));
    expect(script).toBeDefined();
    fixturePhase("KB-05 production server start");
    fixtureServer = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/") return new Response(`<!doctype html><html><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="${script}"></script></body></html>`, { headers: { "content-type": "text/html" } });
      const asset = assets.get(path);
      return asset ? new Response(asset, { headers: { "content-type": "text/javascript" } }) : new Response("missing", { status: 404 });
    } });
    const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
    if (!browserPath) throw new Error("KB-05 production fixture needs Playwright Chromium or an installed chromium/google-chrome binary");
    fixturePhase("KB-05 production browser launch");
    fixtureBrowser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--no-sandbox"] });
    for (const lang of ["en", "he"] as const) {
      const page = await fixtureBrowser.newPage();
      await page.goto(`http://127.0.0.1:${fixtureServer.port}/?lang=${lang}&status=done`);
      await page.waitForFunction((language) => document.documentElement.lang === language, lang);
      const copy = lang === "he" ? "לקרוא יותר ספרים" : "Read more books";
      await page.locator("#gl-new").click();
      const input = page.locator("#gl-name");
      await input.fill(`  ${copy}  `);
      await input.press("Enter");
      await page.waitForFunction(() => (window as CreateFixtureWindow).__kb05Create.calls.length === 1);
      expect(await page.locator("form button[type=submit]").isDisabled()).toBe(true);
      expect(await page.locator("#goal-goals_new-link").count()).toBe(0);
      expect(await page.evaluate(() => (window as CreateFixtureWindow).__kb05Create.calls)).toEqual([{ title: copy }]);
      // The query result must contain the new row before the mutation resolves.
      await page.evaluate(() => (window as CreateFixtureWindow).__kb05Create.finishCreate());
      await page.waitForFunction(() => document.activeElement?.id === "goal-goals_new-link");
      const createdLink = page.locator("#goal-goals_new-link");
      expect(await createdLink.textContent()).toBe(copy);
      expect(await createdLink.getAttribute("href")).toBe("/goals/goals_new");
      expect(await createdLink.evaluate((node) => node === document.activeElement)).toBe(true);
      expect(await input.count()).toBe(0);
      expect(new URL(page.url()).searchParams.has("status")).toBe(false);
      expect(await page.evaluate(() => (window as CreateFixtureWindow).__kb05Create.calls.length)).toBe(1);
      await page.close();
    }
  } finally {
    fixturePhase("KB-05 production cleanup start");
    await cleanupProduction();
    fixturePhase("KB-05 production cleanup complete");
  }
}, 30_000);
