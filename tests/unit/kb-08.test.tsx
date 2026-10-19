import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { en, he, translateKb08 } from "../../apps/web/lib/i18n-groups/kb-08";
import type { ProjectSummary } from "../../apps/web/lib/goals-projects";

// Bun module mocks are process-global. Other component tests replace the generated API, so
// execute this file's actual renders in one clean child process during the full suite.
if (process.env.KB08_ISOLATED !== "1") {
  const names = [
    "empty projects offer one deliberate start action",
    "one project renders a named summary with distinct safe destinations",
    "count labels distinguish 0/1, 1/1 and multiple tasks",
    "long user names retain auto direction and a wrapping class",
    "actions are peers, never nested interactive controls",
    "disabled navigation has no href or keyboard target",
    "Hebrew count has RTL copy and isolated LTR digits",
    "offline state stays a notice and does not create a project",
    "filtered state only exposes the supplied reset callback",
    "error and loading states render separately",
    "gallery renders the real exported row and owns one h1 and one main",
    "English and Hebrew dictionaries have exact key parity",
    "hydrated gallery: keyboard navigation, callbacks, RTL, states and responsive targets",
  ];
  let output: string | undefined;
  for (const name of names) {
    test(`KB-08 isolated: ${name}`, () => {
      if (output === undefined) {
        const run = Bun.spawnSync([process.execPath, "test", import.meta.path], {
          cwd: process.cwd(),
          env: { ...process.env, KB08_ISOLATED: "1" },
          stdout: "pipe",
          stderr: "pipe",
        });
        output = `${run.stdout.toString()}${run.stderr.toString()}`;
        if (run.exitCode !== 0) throw new Error(`KB-08 clean test process failed:\n${output}`);
      }
      expect(output).toContain(name);
    }, 300_000);
  }
} else {
const { Kb08Gallery, ProjectListState, ProjectSummaryRow } = await import("../../apps/web/components/projects/ProjectsScreen");
const project: ProjectSummary = { id: "maya-home", name: "Maya's home", done: 2, total: 6, status: "active", updatedAt: 1 };
const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("KB-08 projects list", () => {
  test("empty projects offer one deliberate start action", () => {
    const html = render(createElement(ProjectListState, { kind: "empty", lang: "en", onAction() {} }));
    expect(html).toContain("No projects yet.");
    expect(html.match(/<button\b/g)).toHaveLength(1);
  });

  test("one project renders a named summary with distinct safe destinations", () => {
    const html = render(createElement(ProjectSummaryRow, { project, lang: "en" }));
    expect(html).toContain("Maya&#x27;s home");
    expect(html).toContain('href="/projects/maya-home"');
    expect(html).toContain('href="/projects/maya-home/kanban"');
    expect(html).toContain('data-component="ProjectSummaryRow"');
  });

  test("count labels distinguish 0/1, 1/1 and multiple tasks", () => {
    const zero = render(createElement(ProjectSummaryRow, { project: { ...project, done: 0, total: 1 }, lang: "en" }));
    const one = render(createElement(ProjectSummaryRow, { project: { ...project, done: 1, total: 1 }, lang: "en" }));
    const many = render(createElement(ProjectSummaryRow, { project, lang: "en" }));
    expect(zero).toContain("0\u2069 of 1 task done");
    expect(one).toContain("1\u2069 of 1 task done");
    expect(many).toContain("2\u2069 of \u20666\u2069 tasks done");
  });

  test("long user names retain auto direction and a wrapping class", () => {
    const name = "Maya's home and garden project with an exceptionally long title";
    const html = render(createElement(ProjectSummaryRow, { project: { ...project, name }, lang: "en" }));
    expect(html).toContain('class="tp-h3 kb08-row__name"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain("exceptionally long title");
  });

  test("actions are peers, never nested interactive controls", () => {
    const html = render(createElement(ProjectSummaryRow, { project, lang: "en" }));
    expect(html.match(/<a\b/g)).toHaveLength(2);
    for (const anchor of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      expect(anchor[1]).not.toMatch(/<(?:a|button)\b/);
    }
    expect(html).not.toContain("<button");
  });

  test("disabled navigation has no href or keyboard target", () => {
    const html = render(createElement(ProjectSummaryRow, { project, lang: "en", disabled: true }));
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('href="/projects/');
    expect(html).toContain('aria-disabled="true"');
  });

  test("Hebrew count has RTL copy and isolated LTR digits", () => {
    const html = render(createElement(ProjectSummaryRow, { project, lang: "he" }));
    expect(html).toContain("משימות הושלמו");
    expect(html).toContain("\u20662\u2069");
    expect(html).toContain("\u20666\u2069");
  });

  test("offline state stays a notice and does not create a project", () => {
    const html = render(createElement(ProjectListState, { kind: "offline", lang: "en" }));
    expect(html).toContain('data-component="StateOffline"');
    expect(html).toContain("Reconnect to load updates");
    expect(html).not.toContain("<button");
  });

  test("filtered state only exposes the supplied reset callback", () => {
    const html = render(createElement(ProjectListState, { kind: "filtered", lang: "en", onAction() {} }));
    expect(html).toContain("Show all projects");
    expect(html.match(/<button\b/g)).toHaveLength(1);
  });

  test("error and loading states render separately", () => {
    expect(render(createElement(ProjectListState, { kind: "error", lang: "en", onAction() {} }))).toContain('role="alert"');
    expect(render(createElement(ProjectListState, { kind: "loading", lang: "en" }))).toContain('aria-busy="true"');
  });

  test("gallery renders the real exported row and owns one h1 and one main", () => {
    const html = render(createElement(Kb08Gallery));
    expect(html).toContain('data-component="ProjectSummaryRow"');
    expect(html).toContain('id="i-page"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html.match(/<main\b/g)).toHaveLength(1);
  });

  test("English and Hebrew dictionaries have exact key parity", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(translateKb08("en", key).length).toBeGreaterThan(0);
      expect(translateKb08("he", key).length).toBeGreaterThan(0);
    }
  });
});

let fixtureDirectory: string | undefined;
afterAll(async () => { if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true }); });

test("hydrated gallery: keyboard navigation, callbacks, RTL, states and responsive targets", async () => {
  const scratch = join(process.cwd(), "work");
  await mkdir(scratch, { recursive: true });
  fixtureDirectory = await mkdtemp(join(scratch, "kb08-gallery-"));
  await symlink(join(process.cwd(), "apps/web/node_modules"), join(fixtureDirectory, "node_modules"));
  const entry = join(fixtureDirectory, "entry.tsx");
  await writeFile(entry, `import React from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react"))};\nimport { createRoot } from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react-dom/client"))};\nimport { Kb08Gallery } from ${JSON.stringify(join(process.cwd(), "apps/web/components/projects/ProjectsScreen"))};\ncreateRoot(document.getElementById("root")!).render(<Kb08Gallery />);\n`);
  const result = await Bun.build({ entrypoints: [entry], outdir: join(fixtureDirectory, "out"), target: "browser" });
  if (!result.success) throw new Error(`Gallery bundle failed: ${result.logs.map(String).join("\n")}`);
  const bundleJs = result.outputs.find((output) => output.path.endsWith(".js"));
  const bundleCss = result.outputs.find((output) => output.path.endsWith(".css"));
  if (!bundleJs || !bundleCss) throw new Error("Gallery bundle must include JS and CSS");
  const styles = await Promise.all([
    "docs/design/v3/tokens.css",
    "docs/design/v3/tempo.css",
    "apps/web/app/v3/goals.css",
  ].map((path) => Bun.file(path).text()));
  const css = `${styles.join("\n").replace(/@import url\([^;]+;/g, "")}\n${await bundleCss.text()}`;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) {
    const pathname = new URL(req.url).pathname;
    if (pathname === "/gallery.js") return new Response(bundleJs, { headers: { "content-type": "text/javascript" } });
    if (pathname === "/gallery.css") return new Response(css, { headers: { "content-type": "text/css" } });
    return new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/gallery.css"></head><body style="margin:0;background:var(--tp-ground)"><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}};</script><script type="module" src="/gallery.js"></script></body></html>', { headers: { "content-type": "text/html" } });
  } });
  const executable = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
  if (!executable) { server.stop(); throw new Error("Chromium missing: install Playwright browser or system Chromium for KB-08 gallery test"); }
  const browser = await chromium.launch({ executablePath: executable, headless: true, args: ["--no-sandbox"] });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await page.goto(server.url.href);
      await page.locator('[data-component="ProjectSummaryRow"]').first().waitFor();
      expect(await page.locator("#i-page").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("article a a, article button a, article a button").count()).toBe(0);
      await page.locator("article a").first().focus();
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain("Open project");
      expect(await page.locator("article a").first().evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toContain("Open board");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      expect(await page.locator("output").last().textContent()).toContain("maya-home: project");
      await page.locator("article a").nth(1).click();
      expect(await page.locator("output").last().textContent()).toContain("maya-home: board");
      for (const state of ["Empty", "Loading", "Error", "Disabled", "Long name", "Offline", "Projects"]) {
        await page.getByRole("button", { name: state, exact: true }).click();
        if (state === "Disabled") expect(await page.locator("article a").count()).toBe(0);
        if (state === "Long name") expect(await page.locator(".kb08-row__name").first().textContent()).toContain("very long");
      }
      if (width === 390) {
        const targetSizes = await page.locator("button, article a").evaluateAll((nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
        expect(targetSizes.every(({ width: w, height: h }) => w >= 44 && h >= 44)).toBe(true);
      }
      for (const lang of ["en", "he"] as const) {
        await page.getByRole("button", { name: lang === "en" ? "English" : "עברית" }).click();
        expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
        expect(await page.locator(".kb08-row__count").first().evaluate((node) => getComputedStyle(node).direction)).toBe(lang === "he" ? "rtl" : "ltr");
        for (const theme of ["light", "dark"] as const) {
          await page.evaluate((next) => document.documentElement.dataset.theme = next, theme);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
          const captureDir = process.env.KB08_EVIDENCE_DIR;
          if (captureDir) {
            await mkdir(captureDir, { recursive: true });
            await page.screenshot({ path: join(captureDir, `after-${width}-${lang}-${theme}.png`), fullPage: true });
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.stop();
  }
}, 240_000);
}
