import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ReactElement } from "../../apps/web/node_modules/react";

// Keep global module mocks and native build/server state in a clean child. The child
// runs every original case, including the single browser build, with its original deadlines.
if (process.env.KB45_ISOLATED !== "1") {
  const names = [
    "default guidance explains the actual magic-link approval flow",
    "waiting copy explains review without claiming this account is pending",
    "approved copy describes a later path without claiming approval",
    "empty example uses words rather than an empty card",
    "loading example exposes busy semantics",
    "error example gives a retry action",
    "disabled example keeps its action visible and unavailable",
    "Hebrew privacy links preserve legal routes and safe new-tab attributes",
    "English and Hebrew keys stay paired",
    "all new public views are exported",
    "hydrated gallery and mounted modal preserve validation, retry, Hebrew links, contrast, and 44 px controls",
    "Hebrew page and modal respect fallback and child-owned auth language boundaries",
  ];
  let result: { exitCode: number; output: string } | undefined;
  const verify = (name: string) => {
    if (!result) {
      const child = Bun.spawnSync([process.execPath, "test", import.meta.path], {
        cwd: process.cwd(),
        env: { ...process.env, KB45_ISOLATED: "1" },
        stdout: "pipe",
        stderr: "pipe",
      });
      result = { exitCode: child.exitCode, output: `${child.stdout.toString()}${child.stderr.toString()}` };
    }
    // A printed case name never substitutes for the actual child result.
    if (result.exitCode !== 0) throw new Error(`KB-45 clean test process failed:\n${result.output}`);
    if (!/^\s*12 pass$/m.test(result.output) || !/^\s*0 fail$/m.test(result.output)
      || !/^Ran 12 tests across 1 file\./m.test(result.output)) {
      throw new Error(`KB-45 child must complete all twelve cases:\n${result.output}`);
    }
    expect(result.output).toContain(name);
  };
  describe("KB-45 sign-up guidance", () => {
    for (const name of names.slice(0, 10)) test(name, () => verify(name), 300_000);
  });
  test(names[10], () => verify(names[10]), 240_000);
  test(names[11], () => verify(names[11]), 60_000);
} else {
  const { createElement } = await import("../../apps/web/node_modules/react");
  const { renderToStaticMarkup } = await import("../../apps/web/node_modules/react-dom/server");
  const { chromium } = await import("@playwright/test");
  const { default: postcss } = await import("../../apps/web/node_modules/postcss");
  const { default: tailwindcss } = await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.js");
  const { en, he, kb45t } = await import("../../apps/web/lib/i18n-groups/kb-45");
  const { Kb45Gallery, SignUpPrivacyLine, SignUpStatus } = await import("../../apps/web/components/auth/SignUpForm");

  const repo = resolve(import.meta.dir, "../..");
  const render = (element: ReactElement) => renderToStaticMarkup(element);

  describe("KB-45 sign-up guidance", () => {
    test("default guidance explains the actual magic-link approval flow", () => {
      const html = render(createElement(SignUpStatus, { lang: "en" }));
      expect(html).toContain("We email a sign-in link");
      expect(html).toContain("approval after opening it");
      expect(html).toContain('data-component="SignUpStatus"');
    });
    test("waiting copy explains review without claiming this account is pending", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "waitingCopy" }));
      expect(html).toContain("Amit reviews new accounts by hand");
      expect(html).not.toContain("Your account is pending");
    });
    test("approved copy describes a later path without claiming approval", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "approvedCopy" }));
      expect(html).toContain("Once approved");
      expect(html).not.toContain("You are approved");
    });
    test("empty example uses words rather than an empty card", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "empty" }));
      expect(html).toContain("No status to show");
    });
    test("loading example exposes busy semantics", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "loading" }));
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Loading this example");
    });
    test("error example gives a retry action", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "error", onRetry() {} }));
      expect(html).toContain("Try again");
      expect(html).toContain('type="button"');
    });
    test("disabled example keeps its action visible and unavailable", () => {
      const html = render(createElement(SignUpStatus, { lang: "en", phase: "disabled" }));
      expect(html).toContain("disabled");
      expect(html).toContain("unavailable");
    });
    test("Hebrew privacy links preserve legal routes and safe new-tab attributes", () => {
      const html = render(createElement(SignUpPrivacyLine, { lang: "he" }));
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html.match(/rel="noopener noreferrer"/g)?.length).toBe(2);
      expect(html).toContain("מדיניות הפרטיות");
    });
    test("English and Hebrew keys stay paired", () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(kb45t("en", key).trim().length).toBeGreaterThan(0);
        expect(kb45t("he", key).trim().length).toBeGreaterThan(0);
      }
    });
    test("all new public views are exported", () => {
      expect(typeof SignUpStatus).toBe("function");
      expect(typeof SignUpPrivacyLine).toBe("function");
      expect(typeof Kb45Gallery).toBe("function");
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

  test("hydrated gallery and mounted modal preserve validation, retry, Hebrew links, contrast, and 44 px controls", async () => {
    const work = join(repo, "work");
    await mkdir(work, { recursive: true });
    directory = await mkdtemp(join(work, "tempo-kb45-"));
    const entry = join(directory, "entry.tsx");
    const authStub = join(directory, "auth-stub.ts");
    const linkStub = join(directory, "link-stub.ts");
    const reactPath = join(repo, "apps/web/node_modules/react");
    await writeFile(authStub, `export function useAuthActions() { return { signIn: async (_provider: string, args: { email: string }) => { (window as any).__kb45Emails.push(args.email); const mode = (window as any).__kb45Mode; if (mode === "pending") await new Promise(() => {}); if (mode === "error") throw new Error("send failed"); } }; }`);
    await writeFile(linkStub, `import React from ${JSON.stringify(reactPath)}; export default function Link({href,children,...rest}: any) { return React.createElement("a", {href: typeof href === "string" ? href : href.pathname, ...rest}, children); }`);
    await writeFile(entry, `import React from ${JSON.stringify(reactPath)}; import {createRoot} from ${JSON.stringify(join(repo, "apps/web/node_modules/react-dom/client"))}; import {LocaleProvider} from ${JSON.stringify(join(repo, "apps/web/components/providers/LocaleProvider.tsx"))}; import {Kb45Gallery,SignUpForm} from ${JSON.stringify(join(repo, "apps/web/components/auth/SignUpForm.tsx"))}; import SignUpModal from ${JSON.stringify(join(repo, "apps/web/components/SignUpModal.tsx"))}; function ProductionMount(){return React.createElement("main",{className:"tp-auth",id:"main",lang:"en",dir:"ltr"},React.createElement(SignUpForm,{variant:"page",nextPath:"/today"}));} const mount=new URLSearchParams(location.search).get("mount");const view=mount==="modal"?React.createElement(SignUpModal,{open:true,onOpenChange(){}}):mount==="production"?React.createElement(ProductionMount):React.createElement(Kb45Gallery);createRoot(document.getElementById("root")!).render(React.createElement(LocaleProvider,null,view));`);
    const bundle = await Bun.build({
      entrypoints: [entry], target: "browser", outdir: directory, minify: false,
      plugins: [{ name: "kb45-fixture-stubs", setup(build) {
        build.onResolve({ filter: /^@convex-dev\/auth\/react$/ }, () => ({ path: authStub }));
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: linkStub }));
      } }],
    });
    if (!bundle.success) throw new Error(`KB-45 fixture failed to build: ${bundle.logs.map(String).join(" | ")}`);
    const assets = new Map<string, Uint8Array>();
    for (const output of bundle.outputs) assets.set(`/${output.path.split("/").at(-1)}`, new Uint8Array(await output.arrayBuffer()));
    // Compile only the existing modal's utility classes, without app routes or a Next build.
    const modalUtilities = await postcss([tailwindcss()]).process(
      '@import "tailwindcss" source(none); @source "./components/SignUpModal.tsx"; @source "./components/auth/SignInForm.tsx"; @source "./components/ui/dialog.tsx";',
      { from: join(repo, "apps/web/kb45-fixture.css") },
    );
    assets.set("/modal-utilities.css", new TextEncoder().encode(modalUtilities.css));
    for (const [url, file] of [
      ["/tokens.css", "docs/design/v3/tokens.css"],
      ["/tempo.css", "docs/design/v3/tempo.css"],
      ["/kb45.css", "apps/web/app/v3/kb-45.css"],
    ]) assets.set(url, new Uint8Array(await readFile(join(repo, file))));
    const bundleStyles = [...assets.keys()].filter((name) => name.endsWith(".css") && !["/tokens.css", "/tempo.css", "/kb45.css"].includes(name)).map((name) => `<link rel="stylesheet" href="${name}">`).join("");
    const script = [...assets.keys()].find((name) => name.endsWith(".js"));
    expect(script).toBeDefined();
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/") return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/tempo.css"><link rel="stylesheet" href="/kb45.css">${bundleStyles}</head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.__kb45Mode="ok";window.__kb45Emails=[];</script><script src="${script}"></script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
      const asset = assets.get(path);
      return asset ? new Response(asset, { headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" } }) : new Response("missing", { status: 404 });
    } });
    const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
    if (!browserPath) throw new Error("KB-45 browser fixture needs Playwright Chromium or an installed chromium/google-chrome binary");
    browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ["--no-sandbox"] });
    const modalContrasts: number[] = [];
    for (const lang of ["en", "he"] as const) for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.port}/?lang=${lang}`);
      try { await page.locator(`main[lang="${lang}"]`).waitFor({ timeout: 10_000 }); }
      catch { throw new Error(`KB-45 gallery did not hydrate: ${errors.join(" | ") || (await page.content()).slice(0, 700)}`); }
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
      expect(await page.locator('[data-component="SignUpStatus"]').count()).toBe(1);
      expect(await page.locator('[data-component="SignUpPrivacyLine"]').count()).toBe(1);
      expect(await page.locator(".kb45-gallery__status").getAttribute("aria-atomic")).toBe("true");
      expect(await page.locator(".kb45-gallery__status").getAttribute("aria-live")).toBe("polite");
      expect(await page.locator('.kb45-privacy a[href="/terms"]').count()).toBe(1);
      expect(await page.locator('.kb45-privacy a[href="/privacy"]').count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const capture = process.env.KB45_CAPTURE_DIR;
      if (capture) {
        const production = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        await production.goto(`http://127.0.0.1:${server.port}/?lang=${lang}&mount=production`);
        await production.locator(`.kb45-signup[lang="${lang}"]`).waitFor();
        await production.screenshot({ path: join(capture, `after-${lang}-${width}-default-light.png`), fullPage: true });
        await production.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
        await production.screenshot({ path: join(capture, `after-${lang}-${width}-default-dark.png`), fullPage: true });
        await production.close();
      }
      if (capture) await page.screenshot({ path: join(capture, `gallery-${lang}-${width}-default-light.png`), fullPage: true });
      const email = page.locator('#sign-up-email');
      expect(await email.inputValue()).toBe("");
      await page.locator('form button[type="submit"]').click();
      expect(await email.evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
      await email.fill("maya@example.com");
      await page.evaluate(() => { (window as any).__kb45Mode = "pending"; });
      await page.locator('form button[type="submit"]').click();
      expect(await page.locator('form button[type="submit"]').isDisabled()).toBe(true);
      expect(await email.inputValue()).toBe("maya@example.com");
      await page.reload();
      await page.locator(`main[lang="${lang}"]`).waitFor();
      await page.locator('#sign-up-email').fill("dana@example.com");
      await page.evaluate(() => { (window as any).__kb45Mode = "error"; });
      await page.locator('form button[type="submit"]').click();
      await page.getByRole("alert").waitFor();
      expect(await page.locator('#sign-up-email').inputValue()).toBe("dana@example.com");
      await page.evaluate(() => { (window as any).__kb45Mode = "ok"; });
      await page.locator('form button[type="submit"]').click();
      await page.locator(".tp-auth-card strong").filter({ hasText: "dana@example.com" }).waitFor();
      expect(await page.locator('form button[type="submit"]').count()).toBe(0);
      expect(await page.evaluate(() => (window as any).__kb45Emails)).toEqual(["dana@example.com", "dana@example.com"]);
      for (const [phase, key] of [
        ["empty", "signup.gallery.emptyText"], ["loading", "signup.gallery.loadingText"],
        ["error", "signup.gallery.errorText"], ["disabled", "signup.gallery.disabledText"],
        ["overflow", "signup.gallery.longText"], ["waitingCopy", "signup.waitingBody"],
        ["approvedCopy", "signup.approvedBody"],
      ] as const) {
        await page.getByRole("button", { name: kb45t(lang, `signup.gallery.${phase === "waitingCopy" ? "waiting" : phase === "approvedCopy" ? "approved" : phase === "overflow" ? "overflow" : phase}` as keyof typeof en) }).click();
        expect(await page.locator(`.kb45-gallery__status [data-phase="${phase}"]`).count()).toBe(1);
        expect(await page.locator('.kb45-gallery__status').getByText(kb45t(lang, key)).count()).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (capture && phase === "error") await page.screenshot({ path: join(capture, `gallery-${lang}-${width}-error-light.png`), fullPage: true });
      }
      await page.getByRole("button", { name: kb45t(lang, "signup.gallery.error") }).click();
      await page.getByRole("button", { name: kb45t(lang, "signup.gallery.retry") }).first().click();
      expect(await page.locator('.kb45-gallery__status [data-phase="error"]').count()).toBe(0);
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-pressed") === "false");
      await page.getByRole("button", { name: kb45t(lang, "signup.gallery.error") }).click();
      const loadingChoice = page.getByRole("button", { name: kb45t(lang, "signup.gallery.loading"), exact: true });
      await loadingChoice.evaluate((choice) => {
        const retry = document.querySelector<HTMLButtonElement>(".kb45-gallery__retry")!;
        retry.addEventListener("click", () => { (choice as HTMLButtonElement).focus(); }, { once: true });
        retry.click();
      });
      await page.waitForFunction(() => !document.querySelector('.kb45-gallery__status [data-phase="error"]'));
      expect(await loadingChoice.evaluate((node) => document.activeElement === node)).toBe(true);
      const lightPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tp-paper"));
      await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      const darkPaper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tp-paper"));
      expect(darkPaper).not.toBe(lightPaper);
      if (capture) await page.screenshot({ path: join(capture, `gallery-${lang}-${width}-default-dark.png`), fullPage: true });

      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      for (const control of await page.locator('.kb45-gallery__controls button, .kb45-signup button, .kb45-privacy a').all()) {
        if (!await control.isVisible()) continue;
        const box = await control.boundingBox();
        if (box) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(errors).toEqual([]);
      await page.close();
      const modal = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      await modal.goto(`http://127.0.0.1:${server.port}/?lang=${lang}&mount=modal`);
      await modal.locator(`.kb45-signup[data-variant="modal"][lang="${lang}"]`).waitFor();
      for (const theme of ["light", "dark"]) {
        await modal.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        if (capture) await modal.screenshot({ path: join(capture, `modal-${lang}-${width}-${theme}.png`), fullPage: true });
        const ratios = await modal.locator(".kb45-privacy").evaluate((privacy) => {
          const luminance = (color: string) => {
            const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          // The caller's fixed gray-800 is the brightest point behind the old transparent line.
          const background = getComputedStyle(privacy).backgroundColor;
          const backdrop = background === "rgba(0, 0, 0, 0)" ? "rgb(31, 41, 55)" : background;
          return [privacy, ...privacy.querySelectorAll("a")].map((node) => {
            const values = [luminance(getComputedStyle(node).color), luminance(backdrop)].sort((a, b) => a - b);
            return (values[1] + 0.05) / (values[0] + 0.05);
          });
        });
        modalContrasts.push(...ratios);
        expect(await modal.locator(".kb45-privacy a").count()).toBe(2);
        for (const link of await modal.locator(".kb45-privacy a").all()) {
          await link.focus();
          expect(await link.evaluate((node) => document.activeElement === node)).toBe(true);
          expect(await link.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
          expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        }
        expect(await modal.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await modal.close();
    }
    for (const ratio of modalContrasts) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }, 240_000);

  test("Hebrew page and modal respect fallback and child-owned auth language boundaries", async () => {
    if (!browser || !server) throw new Error("KB-45 mounted language regression needs the completed browser fixture");
    for (const mount of ["production", "modal"]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
      try {
        await page.goto(`http://127.0.0.1:${server.port}/?lang=he&mount=${mount}`);
        const signup = page.locator('.kb45-signup[lang="he"][dir="rtl"]');
        await signup.waitFor();
        const english = signup.locator(':scope > [lang="en"][dir="ltr"]');
        expect(await english.count()).toBe(1);
        // KB-10's localized child owns its language; the fallback must let that
        // nearer boundary override English without freezing future copy to English.
        const ownedCard = english.locator('[data-component="AuthCard"][lang]');
        const ownsHebrew = await ownedCard.count() === 1;
        const authLanguage = ownsHebrew ? { lang: "he", direction: "rtl" } : { lang: "en", direction: "ltr" };
        const languageOf = (node: Element) => ({
          lang: node.closest("[lang]")?.getAttribute("lang"),
          direction: getComputedStyle(node).direction,
        });
        if (ownsHebrew) expect(await ownedCard.evaluate(languageOf)).toEqual(authLanguage);
        expect(await english.locator('label[for="sign-up-email"]').evaluate(languageOf)).toEqual(authLanguage);
        expect(await english.locator('label[for="sign-up-email"]').textContent()).toMatch(ownsHebrew ? /[\u0590-\u05ff]/ : /^Email$/);
        expect(await english.locator('button[type="submit"]').textContent()).toMatch(ownsHebrew ? /[\u0590-\u05ff]/ : /^Send magic link$/);
        const privacy = signup.locator('[data-component="SignUpPrivacyLine"]');
        expect(await privacy.evaluate(languageOf)).toEqual({ lang: "he", direction: "rtl" });
        expect(await privacy.locator('a[href="/privacy"]').textContent()).toBe(kb45t("he", "signup.privacy"));
        const guidance = signup.locator('[data-component="SignUpStatus"]');
        expect(await guidance.count()).toBe(mount === "production" ? 1 : 0);
        if (mount === "production") {
          expect(await guidance.evaluate(languageOf)).toEqual({ lang: "he", direction: "rtl" });
          expect(await guidance.locator("p").textContent()).toBe(kb45t("he", "signup.nextBody"));
        }
        await english.locator("#sign-up-email").fill("maya@example.com");
        await page.evaluate(() => { (window as any).__kb45Mode = "error"; });
        await english.locator('button[type="submit"]').click();
        const error = english.getByRole("alert");
        await error.waitFor();
        expect(await error.evaluate(languageOf)).toEqual(authLanguage);
        expect(await error.textContent()).toMatch(ownsHebrew ? /[\u0590-\u05ff]/ : /couldn't send/);
        await page.evaluate(() => { (window as any).__kb45Mode = "ok"; });
        await english.locator('button[type="submit"]').click();
        const sent = english.locator("strong").filter({ hasText: "maya@example.com" });
        await sent.waitFor();
        expect(await sent.evaluate(languageOf)).toEqual(authLanguage);
        const sentView = ownsHebrew ? english.locator('[data-component="MagicLinkStatus"]') : english;
        expect(await sentView.textContent()).toMatch(ownsHebrew ? /[\u0590-\u05ff]/ : /We sent a sign-in link/);
        await sentView.getByRole("button", { name: ownsHebrew ? "שימוש בכתובת דוא״ל אחרת" : "Use a different email" }).click();
        expect(await english.locator("#sign-up-email").evaluate(languageOf)).toEqual({ lang: authLanguage.lang, direction: "ltr" });
        expect(await privacy.evaluate(languageOf)).toEqual({ lang: "he", direction: "rtl" });
        expect(await page.evaluate(() => (window as any).__kb45Emails)).toEqual(["maya@example.com", "maya@example.com"]);
      } finally {
        await page.close();
      }
    }
  }, 60_000);
}
