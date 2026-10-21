import { afterAll, describe, expect, test as unitTest } from "bun:test";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { en, he } from "../../apps/web/lib/i18n-groups/kb-07";
import type { WeekPoint } from "../../apps/web/lib/goals-projects";

const root = join(import.meta.dir, "../..");
const webWorkspace = join(root, "apps/web");
const fixtureChild = process.env.KB07_FIXTURE_CHILD === "1";
const resultMarker = "KB07_FIXTURE_RESULTS=";
const caseResults: Record<string, { pass: boolean }> = {};
// Production imports and renderers load only in the clean child, outside global suite mocks.
const { GoalProgressTable, Kb07Gallery, ProgressRangeCaption } = fixtureChild
  ? await import("../../apps/web/components/goals/GoalsProgressScreen")
  : {} as typeof import("../../apps/web/components/goals/GoalsProgressScreen");
// Resolve from the declaring workspace, whether Bun hoists or isolates dependencies.
const { createElement } = fixtureChild ? await import(Bun.resolveSync("react", webWorkspace)) : {};
const { renderToStaticMarkup } = fixtureChild ? await import(Bun.resolveSync("react-dom/server", webWorkspace)) : {};
const point = (count: number, index = 0): WeekPoint => ({
  startMs: new Date(2026, 8, 28 + 7 * index).getTime(), week: 40 + index, count,
});
const render = (component: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(component);

// Await the fresh child before registering parent result assertions. Original case timeouts
// remain authoritative in that child; no larger aggregate timeout replaces them.
if (!fixtureChild) {
  const child = Bun.spawn([process.execPath, "test", import.meta.path], {
    cwd: root, env: { ...process.env, KB07_FIXTURE_CHILD: "1" }, stdout: "pipe", stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  if (code !== 0) throw new Error(`KB-07 isolated fixture exited ${code}:\n${err.slice(-10000)}\n${out.slice(-2000)}`);
  const record = out.split("\n").find(line => line.startsWith(resultMarker));
  if (!record) throw new Error("KB-07 isolated fixture exited without its assertion results");
  Object.assign(caseResults, JSON.parse(record.slice(resultMarker.length)));
  console.info(`KB-07 isolated fixture exit 0: ${Object.keys(caseResults).length} completed cases`);
  console.info(`KB-07 child assertion summary:\n${err.trim().split("\n").slice(-5).join("\n")}`);
}

function test(name: string, run: () => unknown | Promise<unknown>, timeout: number) {
  unitTest(name, async () => {
    if (fixtureChild) {
      await run();
      caseResults[name] = { pass: true };
    } else expect(caseResults[name]).toEqual({ pass: true });
  }, timeout);
}

afterAll(() => {
  if (fixtureChild) console.info(resultMarker + JSON.stringify(caseResults));
});

describe("KB-07 progress values", () => {
  test("zero week keeps a visible zero in the table", () => {
    const html = render(createElement(GoalProgressTable, { points: [point(0)], lang: "en" }));
    expect(html).toContain('data-kb07-count="0"');
    expect(html).toContain("Small steps done");
  }, 30_000);

  test("one point has one semantic data row", () => {
    const html = render(createElement(GoalProgressTable, { points: [point(3)], lang: "en" }));
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
    expect(html).toContain('data-kb07-count="3"');
  }, 30_000);

  test("seven points retain all seven weekly values", () => {
    const points = [0, 1, 3, 0, 5, 2, 1].map(point);
    const html = render(createElement(GoalProgressTable, { points, lang: "en" }));
    expect((html.match(/data-kb07-count=/g) ?? []).length).toBe(7);
  }, 30_000);

  test("table equals chart values for the same fictional data", () => {
    const html = render(createElement(Kb07Gallery, { initialLang: "en" }));
    const svg = html.match(/<svg[^>]*>(.*?)<\/svg>/s)?.[1] ?? "";
    const table = html.match(/<table[^>]*>(.*?)<\/table>/s)?.[1] ?? "";
    const chartCounts = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((match) => Number(match[1]));
    const tableCounts = [...table.matchAll(/data-kb07-count="(\d+)"/g)].map((match) => Number(match[1]));
    expect(chartCounts).toEqual(tableCounts);
    expect(html.match(/<svg[^>]*>/)?.[0]).toContain('aria-hidden="true"');
  }, 30_000);

  test("Hebrew range includes dates and keeps direction in its parent", () => {
    const html = render(createElement(Kb07Gallery, { initialLang: "he" }));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("הצגת נתונים לפי שבוע");
    expect(html).toContain("2026");
    expect(render(createElement(ProgressRangeCaption, { points: [point(1)], lang: "he" }))).toContain("–");
    expect(render(createElement(GoalProgressTable, { points: [point(1)], lang: "he" }))).toMatch(/2026-09-\d{2}/);
  }, 30_000);

  test("empty point collection remains readable", () => {
    expect(render(createElement(GoalProgressTable, { points: [], lang: "en" }))).toContain("There are no weeks to show yet.");
  }, 30_000);

  test("disclosure uses the native keyboard operable summary", () => {
    const html = render(createElement(GoalProgressTable, { points: [point(1)], lang: "en" }));
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  }, 30_000);

  test("English and Hebrew keys have parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  }, 30_000);
});

// Hydrated browser fixture, not an authenticated route. Bun bundles the real exported gallery.
// react-native is aliased only in this fixture, never in product/config files.
describe("KB-07 hydrated gallery", () => {
  test("local Monday weeks, disclosure keyboard, callbacks, RTL, reduced motion, large text and narrow width", async () => {
    const { chromium, expect: pwExpect } = await import("@playwright/test");
    const { mkdir, mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, "work"), { recursive: true });
    const directory = await mkdtemp(join(root, "work/kb07-gallery-"));
    let server: ReturnType<typeof Bun.serve> | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const entry = join(directory, "entry.tsx");
      await writeFile(entry, `import React from ${JSON.stringify(Bun.resolveSync("react", webWorkspace))};\nimport {createRoot} from ${JSON.stringify(Bun.resolveSync("react-dom/client", webWorkspace))};\nimport {Kb07Gallery} from ${JSON.stringify(join(root, "apps/web/components/goals/GoalsProgressScreen.tsx"))};\ncreateRoot(document.getElementById("root")!).render(React.createElement(Kb07Gallery));`);
      const bundle = await Bun.build({
        entrypoints: [entry], target: "browser", minify: false,
        alias: { "react-native": Bun.resolveSync("react-native-web", join(root, "apps/mobile")) },
      });
      expect(bundle.success).toBe(true);
      const script = await bundle.outputs.find((output) => output.path.endsWith(".js"))?.text();
      expect(script).toBeTruthy();
      const css = await Promise.all([
        "docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/v3/goals.css", "apps/web/app/v3/kb-07.css",
      ].map((file) => readFile(join(root, file), "utf8")));
      const generatedCss = await Promise.all(bundle.outputs.filter((output) => output.path.endsWith(".css")).map((output) => output.text()));
      const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join("\n")}\n${generatedCss.join("\n")}</style></head><body style="margin:0;background:var(--tp-ground)"><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="/bundle.js"></script></body></html>`;
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
        return new Response(new URL(request.url).pathname === "/bundle.js" ? script : html, {
          headers: { "Content-Type": new URL(request.url).pathname === "/bundle.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" },
        });
      } });
      const systemBrowser = ["/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
      browser = await chromium.launch({ ...(systemBrowser ? { executablePath: systemBrowser } : {}), args: ["--no-sandbox"] });
      for (const width of [390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce", timezoneId: "America/Los_Angeles" });
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") pageErrors.push(message.text()); });
        await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
        await page.goto(`http://127.0.0.1:${server.port}`, { waitUntil: "domcontentloaded" });
        try {
          await pwExpect(page.locator("main")).toHaveCount(1, { timeout: 20_000 });
        } catch {
          throw new Error(`Gallery did not hydrate: ${pageErrors.join(" | ")}`);
        }
        await pwExpect(page.locator("h1")).toHaveCount(1);
        // UTC-midnight fixtures incorrectly turn these Monday weeks into Sundays here.
        expect(await page.locator("time").evaluateAll((elements) => elements.map((element) => element.getAttribute("datetime"))))
          .toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"]);
        await pwExpect(page.locator(".kb07-range")).toHaveText("Aug 31, 2026 – Sep 27, 2026");
        expect(await page.locator("svg text").allTextContents()).toEqual(["0", "2", "1", "4", "Wk 36", "Wk 37", "Wk 38", "Wk 39"]);
        await page.screenshot({ path: join(root, "work", `gallery-${width}-en-light.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
        await page.screenshot({ path: join(root, "work", `gallery-${width}-en-dark.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
        await page.getByText("Show weekly values").focus();
        await page.keyboard.press("Enter");
        await pwExpect(page.locator("details")).toHaveAttribute("open", "");
        await page.screenshot({ path: join(root, "work", `gallery-${width}-en-open.png`), fullPage: true });
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SUMMARY");
        await page.keyboard.press("Enter");
        await pwExpect(page.locator("details")).not.toHaveAttribute("open", "");
        await page.getByRole("button", { name: "No steps yet" }).click();
        expect(await page.locator("[data-kb07-count]").allTextContents()).toEqual(["0", "0", "0", "0"]);
        await page.getByRole("button", { name: "Loading" }).click();
        await pwExpect(page.getByText("Loading your progress…")).toBeVisible();
        await page.getByRole("button", { name: "Unavailable" }).click();
        await pwExpect(page.getByRole("button", { name: "Show weekly values" })).toBeDisabled();
        await page.getByRole("button", { name: "More weeks" }).click();
        expect(await page.locator("[data-kb07-count]").count()).toBe(8);
        await page.getByRole("button", { name: "No steps yet" }).click();
        await page.getByRole("button", { name: "8 weeks" }).click();
        expect(await page.locator("[data-kb07-count]").count()).toBe(8);
        await page.getByRole("button", { name: "4 weeks" }).click();
        expect(await page.locator("[data-kb07-count]").count()).toBe(4);
        await page.getByRole("button", { name: "Progress", exact: true }).click();
        await page.getByRole("button", { name: /Language/ }).click();
        await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
        await page.screenshot({ path: join(root, "work", `gallery-${width}-he-light.png`), fullPage: true });
        await page.locator("summary").click();
        await page.screenshot({ path: join(root, "work", `gallery-${width}-he-open.png`), fullPage: true });
        await page.locator("summary").click();
        await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
        await page.screenshot({ path: join(root, "work", `gallery-${width}-he-dark.png`), fullPage: true });
        await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
        await page.getByRole("button", { name: "שגיאה" }).click();
        await page.getByRole("button", { name: "לנסות שוב" }).focus();
        await page.keyboard.press("Enter");
        await pwExpect(page.locator(".kb07-progress")).toHaveCount(1);
        expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed"))).toBe("true");
        await page.evaluate(() => document.documentElement.setAttribute("data-text-size", "l"));
        const checks = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth <= innerWidth,
          targets: [...document.querySelectorAll(".kb07-gallery button, .kb07-disclosure__trigger")].filter((element) => !(element as HTMLButtonElement).disabled).every((element) => element.getBoundingClientRect().height >= 44),
          motion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          largeText: parseFloat(getComputedStyle(document.querySelector(".kb07-disclosure__trigger")!).fontSize) >= 20,
        }));
        expect(checks).toEqual({ overflow: true, targets: true, motion: true, largeText: true });
        await page.close();
      }
    } finally {
      try { await browser?.close(); }
      finally {
        try { server?.stop(); }
        finally { await rm(directory, { recursive: true, force: true }); }
      }
    }
  }, 240_000);
});
