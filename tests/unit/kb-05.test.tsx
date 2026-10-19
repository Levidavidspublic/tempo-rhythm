import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createElement, type ReactElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { chromium } from "@playwright/test";
import { en, he, kb05t } from "../../apps/web/lib/i18n-groups/kb-05";
import { GoalEmptyState, GoalNameForm, GoalProgressLabel, Kb05Gallery } from "../../apps/web/components/goals/GoalsScreen";

const repo = resolve(import.meta.dir, "../..");
const render = (element: ReactElement) => renderToStaticMarkup(element);

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

afterAll(async () => {
  await browser?.close();
  server?.stop(true);
  if (directory) await rm(directory, { recursive: true, force: true });
}, 30_000);

test("hydrated gallery exercises the real name form, focus return, RTL, and 44 px actions", async () => {
  directory = await mkdtemp(join(tmpdir(), "tempo-kb05-"));
  const entry = join(directory, "entry.tsx");
  const modulePath = join(repo, "apps/web/components/goals/GoalsScreen.tsx");
  await writeFile(entry, `import React from "${join(repo, "apps/web/node_modules/react")}";\nimport { createRoot } from "${join(repo, "apps/web/node_modules/react-dom/client")}";\nimport { TpIconSprite } from "${join(repo, "apps/web/components/tempo/TpIcon.tsx")}";\nimport { Kb05Gallery } from ${JSON.stringify(modulePath)};\nconst params = new URLSearchParams(location.search); createRoot(document.getElementById("root")!).render(React.createElement(React.Fragment, null, React.createElement(TpIconSprite), React.createElement(Kb05Gallery, { lang: params.get("lang") === "he" ? "he" : "en" })));`);
  const result = await Bun.build({ entrypoints: [entry], target: "browser", outdir: directory, minify: false });
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
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/tempo.css"><link rel="stylesheet" href="/goals.css">${styleLinks}</head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="${script}"></script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    const asset = assets.get(path);
    return asset ? new Response(asset, { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } }) : new Response("missing", { status: 404 });
  } });
  const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
  if (!browserPath) throw new Error("KB-05 browser fixture needs Playwright Chromium or an installed chromium/google-chrome binary");
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
