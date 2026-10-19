import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { en, he, translateKb44 } from "../../apps/web/lib/i18n-groups/kb-44";

// Other component tests register Bun's process-global Convex mocks. Keep this file's real
// gallery and component imports in one clean child process when the full suite loads them.
if (process.env.KB44_ISOLATED !== "1") {
  const names = [
    "first step has textual and semantic progress",
    "resume step explains refresh and offers review",
    "optional choices use calm plain copy",
    "loading state stays distinct from error state",
    "disabled actions have no active form input",
    "Hebrew summary isolates numbers and keeps RTL copy",
    "gallery renders both named views with one h1 and main",
    "English and Hebrew have exact key parity",
    "hydrated gallery: Back retains input, Next focuses heading, error retains input, pending, RTL and reduced motion",
    "hydrated OnboardingFlow: Back retains input, resume review locks during save, error keeps step",
  ];
  let output: string | undefined;
  for (const name of names) {
    test(`KB-44 isolated: ${name}`, () => {
      if (output === undefined) {
        const run = Bun.spawnSync([process.execPath, "test", import.meta.path], {
          cwd: process.cwd(),
          env: { ...process.env, KB44_ISOLATED: "1" },
          stdout: "pipe",
          stderr: "pipe",
        });
        output = `${run.stdout.toString()}${run.stderr.toString()}`;
        if (run.exitCode !== 0) throw new Error(`KB-44 clean test process failed:\n${output}`);
      }
      expect(output).toContain(name);
    }, 300_000);
  }
} else {
  const { Kb44Gallery, OnboardingResumeNotice, OnboardingStepSummary } = await import("../../apps/web/components/onboarding/OnboardingFlow");
  const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

  describe("KB-44 onboarding", () => {
    test("first step has textual and semantic progress", () => {
      const html = render(createElement(OnboardingStepSummary, { step: 1, total: 5, lang: "en" }));
      expect(html).toContain("Step \u20661\u2069 of \u20665\u2069");
      expect(html).toContain('value="1"');
      expect(html).toContain('max="5"');
    });

    test("resume step explains refresh and offers review", () => {
      const html = render(createElement(OnboardingResumeNotice, { step: 3, lang: "en", onReview() {} }));
      expect(html).toContain("Welcome back to step");
      expect(html).toContain("After a refresh");
      expect(html).toContain("Review earlier steps");
      expect(html.match(/<button\b/g)).toHaveLength(1);
    });

    test("optional choices use calm plain copy", () => {
      expect(translateKb44("en", "optional")).toContain("optional");
      expect(translateKb44("he", "optional")).toContain("אינו חובה");
    });

    test("loading state stays distinct from error state", () => {
      const html = render(createElement(Kb44Gallery));
      expect(html).toContain('data-component="OnboardingStepSummary"');
      expect(html).not.toContain('role="alert"');
      expect(translateKb44("en", "gallery.errorBody")).toContain("still here");
    });

    test("disabled actions have no active form input", () => {
      const html = render(createElement(Kb44Gallery));
      expect(html).toContain('type="text"');
      expect(html).toContain('type="button"');
      expect(translateKb44("en", "gallery.pending")).toBe("Saving…");
    });

    test("Hebrew summary isolates numbers and keeps RTL copy", () => {
      const html = render(createElement(OnboardingStepSummary, { step: 4, total: 5, lang: "he" }));
      expect(html).toContain("שלב");
      expect(html).toContain("\u20664\u2069");
      expect(html).toContain('dir="auto"');
    });

    test("gallery renders both named views with one h1 and main", () => {
      const gallery = render(createElement(Kb44Gallery));
      const notice = render(createElement(OnboardingResumeNotice, { step: 2, lang: "en", onReview() {} }));
      expect(gallery).toContain('data-component="OnboardingStepSummary"');
      expect(notice).toContain('data-component="OnboardingResumeNotice"');
      expect(gallery.match(/<h1\b/g)).toHaveLength(1);
      expect(gallery.match(/<main\b/g)).toHaveLength(1);
      expect(gallery).toContain('id="i-info"');
    });

    test("English and Hebrew have exact key parity", () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(translateKb44("en", key).length).toBeGreaterThan(0);
        expect(translateKb44("he", key).length).toBeGreaterThan(0);
      }
    });
  });

  let fixtureDirectory: string | undefined;
  afterAll(async () => { if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true }); });

  test("hydrated gallery: Back retains input, Next focuses heading, error retains input, pending, RTL and reduced motion", async () => {
    const scratch = join(process.cwd(), "work");
    await mkdir(scratch, { recursive: true });
    fixtureDirectory = await mkdtemp(join(scratch, "kb44-gallery-"));
    await symlink(join(process.cwd(), "apps/web/node_modules"), join(fixtureDirectory, "node_modules"));
    const entry = join(fixtureDirectory, "entry.tsx");
    await writeFile(entry, `import React from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react"))};\nimport { createRoot } from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react-dom/client"))};\nimport { Kb44Gallery } from ${JSON.stringify(join(process.cwd(), "apps/web/components/onboarding/OnboardingFlow"))};\ncreateRoot(document.getElementById("root")!).render(<Kb44Gallery />);\n`);
    const bundle = await Bun.build({ entrypoints: [entry], outdir: join(fixtureDirectory, "out"), target: "browser", alias: { "react-native": "react-native-web" } });
    if (!bundle.success) throw new Error(`Gallery bundle failed: ${bundle.logs.map(String).join("\n")}`);
    const js = bundle.outputs.find((file) => file.path.endsWith(".js"));
    const builtCss = bundle.outputs.find((file) => file.path.endsWith(".css"));
    if (!js || !builtCss) throw new Error("Gallery bundle must include JS and CSS");
    const v3 = await Promise.all(["docs/design/v3/tokens.css", "docs/design/v3/tempo.css", "apps/web/app/v3/settings.css"].map((path) => Bun.file(path).text()));
    const css = `${v3.join("\n").replace(/@import url\([^;]+;/g, "")}\n${await builtCss.text()}`;
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/gallery.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
      if (path === "/gallery.css") return new Response(css, { headers: { "content-type": "text/css" } });
      return new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/gallery.css"></head><body style="margin:0;background:var(--tp-ground)"><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}};</script><script type="module" src="/gallery.js"></script></body></html>', { headers: { "content-type": "text/html" } });
    } });
    const executable = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
    if (!executable) { server.stop(); throw new Error("Chromium missing: install Playwright browser or system Chromium for KB-44 gallery test"); }
    const browser = await chromium.launch({ executablePath: executable, headless: true, args: ["--no-sandbox"] });
    try {
      for (const width of [390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        await page.goto(server.url.href);
        await page.locator('[data-component="Kb44Gallery"]').waitFor();
        expect(await page.locator("h1").count()).toBe(1);
        expect(await page.locator("main").count()).toBe(1);
        expect(await page.locator("#i-info").count()).toBe(1);
        await page.locator('input[type="text"]').fill("Dana");
        await page.getByRole("button", { name: "Continue" }).click();
        expect(await page.locator("progress").getAttribute("value")).toBe("2");
        expect(await page.locator('input[type="text"]').inputValue()).toBe("Dana");
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
        await page.getByRole("button", { name: "Back", exact: true }).click();
        expect(await page.locator("progress").getAttribute("value")).toBe("1");
        expect(await page.locator('input[type="text"]').inputValue()).toBe("Dana");
        await page.getByRole("button", { name: "Resume" }).click();
        expect(await page.locator('[data-component="OnboardingResumeNotice"]').count()).toBe(1);
        await page.getByRole("button", { name: "Review earlier steps" }).click();
        expect(await page.locator("progress").getAttribute("value")).toBe("1");
        await page.getByRole("button", { name: "Error", exact: true }).click();
        await page.locator('input[type="text"]').fill("Yoni");
        expect(await page.getByRole("alert").count()).toBe(1);
        await page.getByRole("button", { name: "Try again" }).click();
        expect(await page.locator('input[type="text"]').inputValue()).toBe("Yoni");
        await page.getByRole("button", { name: "Pending", exact: true }).click();
        expect(await page.getByRole("button", { name: "Saving…" }).isDisabled()).toBe(true);
        await page.getByRole("button", { name: "Disabled" }).click();
        expect(await page.locator('input[type="text"]').isDisabled()).toBe(true);
        await page.getByRole("button", { name: "Long input" }).click();
        expect(await page.locator('input[type="text"]').inputValue()).toContain("very long fictional name");
        await page.getByRole("button", { name: "Empty" }).click();
        expect(await page.locator('input[type="text"]').inputValue()).toBe("");
        await page.getByRole("button", { name: "Loading" }).click();
        expect(await page.locator('[aria-busy="true"]').count()).toBe(1);
        await page.getByRole("button", { name: "Default" }).click();
        if (width === 390) {
          const targets = await page.locator("button, input").evaluateAll((nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
          expect(targets.every(({ width: w, height: h }) => w >= 44 && h >= 44)).toBe(true);
        }
        for (const lang of ["en", "he"] as const) {
          await page.getByRole("button", { name: lang === "en" ? "English" : "עברית" }).click();
          expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
          expect(await page.locator(".kb44-summary__text").evaluate((node) => getComputedStyle(node).direction)).toBe(lang === "he" ? "rtl" : "ltr");
          for (const theme of ["light", "dark"] as const) {
            await page.evaluate((next) => document.documentElement.dataset.theme = next, theme);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
            expect(await page.locator(".kb44-summary__progress").evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
            const capture = process.env.KB44_EVIDENCE_DIR;
            if (capture) {
              await mkdir(capture, { recursive: true });
              await page.screenshot({ path: join(capture, `after-${width}-${lang}-${theme}.png`), fullPage: true });
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

  test("hydrated OnboardingFlow: Back retains input, resume review locks during save, error keeps step", async () => {
    const scratch = join(process.cwd(), "work");
    await mkdir(scratch, { recursive: true });
    const directory = await mkdtemp(join(scratch, "kb44-flow-"));
    await symlink(join(process.cwd(), "apps/web/node_modules"), join(directory, "node_modules"));
    const mockConvex = join(directory, "convex-mock.ts");
    const mockRouter = join(directory, "router-mock.ts");
    const entry = join(directory, "entry.tsx");
    await writeFile(mockConvex, `import { getFunctionName } from "convex/server";
const state = window.__kb44 = { resolve: null, reject: null, mutationArgs: null, route: null };
export function useQuery(ref) {
  const name = getFunctionName(ref);
  if (name === "users:getProfile") return { greetingName: "Maya", onboardedAt: null };
  if (name === "coach:getSettings") return { dial: 5 };
  throw new Error("Unexpected query: " + name);
}
export function useMutation(ref) {
  const name = getFunctionName(ref);
  return async (args) => {
    if (name === "users:completeOnboarding") {
      state.mutationArgs = args;
      return new Promise((resolve, reject) => { state.resolve = resolve; state.reject = reject; });
    }
    if (name === "notes:create") return "mock-note-id";
    return { success: true };
  };
}
`);
    await writeFile(mockRouter, `const router = { push(path) { window.__kb44.route = path; }, replace(path) { window.__kb44.route = path; } };
export function useRouter() { return router; }
`);
    await writeFile(entry, `import React from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react"))};
import { createRoot } from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react-dom/client"))};
import { LocaleProvider } from ${JSON.stringify(join(process.cwd(), "apps/web/components/providers/LocaleProvider"))};
import { ThemeProvider } from ${JSON.stringify(join(process.cwd(), "apps/web/components/providers/ThemeProvider"))};
import { TpIconSprite } from ${JSON.stringify(join(process.cwd(), "apps/web/components/tempo/TpIcon"))};
import { OnboardingFlow } from ${JSON.stringify(join(process.cwd(), "apps/web/components/onboarding/OnboardingFlow"))};
createRoot(document.getElementById("root")!).render(<LocaleProvider><ThemeProvider><TpIconSprite /><OnboardingFlow /></ThemeProvider></LocaleProvider>);
`);
    const bundle = await Bun.build({
      entrypoints: [entry], outdir: join(directory, "out"), target: "browser",
      alias: { "react-native": "react-native-web", "convex/react": mockConvex, "next/navigation": mockRouter },
    });
    if (!bundle.success) throw new Error(`OnboardingFlow bundle failed: ${bundle.logs.map(String).join("\n")}`);
    const js = bundle.outputs.find((file) => file.path.endsWith(".js"));
    const builtCss = bundle.outputs.find((file) => file.path.endsWith(".css"));
    if (!js || !builtCss) throw new Error("OnboardingFlow bundle must include JS and CSS");
    const v3 = await Promise.all(["docs/design/v3/tokens.css", "docs/design/v3/tempo.css", "apps/web/app/v3/settings.css"].map((path) => Bun.file(path).text()));
    const css = `${v3.join("\n").replace(/@import url\([^;]+;/g, "")}\n${await builtCss.text()}`;
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === "/flow.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
      if (path === "/flow.css") return new Response(css, { headers: { "content-type": "text/css" } });
      return new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/flow.css"></head><body style="margin:0;background:var(--tp-ground)"><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}};</script><script type="module" src="/flow.js"></script></body></html>', { headers: { "content-type": "text/html" } });
    } });
    const executable = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
    if (!executable) { server.stop(); throw new Error("Chromium missing for KB-44 OnboardingFlow test"); }
    const browser = await chromium.launch({ executablePath: executable, headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
      await page.goto(server.url.href);
      await page.locator("#s1-title").waitFor();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.locator("#onboarding-name").fill("Dana");
      await page.getByRole("button", { name: "Continue" }).click();
      expect(await page.locator("#s3-title").count()).toBe(1);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("s3-title");
      await page.getByRole("button", { name: "Back" }).click();
      expect(await page.locator("#onboarding-name").inputValue()).toBe("Dana");
      await page.goto(`${server.url.href}?step=5`);
      await page.locator('[data-component="OnboardingResumeNotice"]').waitFor();
      const review = page.getByRole("button", { name: "Review earlier steps" });
      await page.getByRole("button", { name: "Finish" }).click();
      expect(await review.isDisabled()).toBe(true);
      await review.evaluate((node: HTMLButtonElement) => node.click());
      expect(await page.locator("#s5-title").count()).toBe(1);
      expect(await page.evaluate(() => (window as unknown as { __kb44: { mutationArgs: unknown } }).__kb44.mutationArgs)).toEqual({ fullName: "Maya" });
      await page.evaluate(() => (window as unknown as { __kb44: { reject: (error: Error) => void } }).__kb44.reject(new Error("network")));
      await page.getByRole("alert").waitFor();
      expect(await page.locator("#s5-title").count()).toBe(1);
      expect(await review.isEnabled()).toBe(true);
      await review.click();
      expect(await page.locator("#s1-title").count()).toBe(1);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("s1-title");
      await page.close();
    } finally {
      await browser.close();
      server.stop();
      await rm(directory, { recursive: true, force: true });
    }
  }, 240_000);
}
