import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { en, he, translateKb70 } from "../../apps/web/lib/i18n-groups/kb-70";

// Other component tests register process-global Convex mocks. Keep this component's real imports
// and browser bundle in a clean child process when the full suite loads them.
if (process.env.KB70_ISOLATED !== "1") {
  const names = [
    "pending feedback explains the disabled action in English",
    "idle feedback leaves no status message",
    "Hebrew pending copy uses the local group",
    "default gallery mounts real notice rows with one main and heading",
    "pending gallery disables Mark all read with a described explanation",
    "success gallery reuses the existing all-read announcement",
    "error gallery exposes the existing save error",
    "empty gallery has no notice row",
    "disabled gallery leaves notice text visible",
    "overflow gallery retains the long fictional title",
    "English and Hebrew have exact key parity",
    "mounted screen: deferred reads preserve chosen focus and Mark all read is single-flight",
    "hydrated gallery: controls, RTL, themes, targets, reduced motion and overflow",
  ];
  let output: string | undefined;
  for (const name of names) {
    test(`KB-70 isolated: ${name}`, () => {
      if (output === undefined) {
        const run = Bun.spawnSync([process.execPath, "test", import.meta.path], {
          cwd: process.cwd(),
          env: { ...process.env, KB70_ISOLATED: "1" },
          stdout: "pipe", stderr: "pipe",
        });
        output = `${run.stdout.toString()}${run.stderr.toString()}`;
        if (run.exitCode !== 0) throw new Error(`KB-70 clean test process failed:\n${output}`);
      }
      expect(output).toContain(name);
    }, 300_000);
  }
} else {
  const { Kb70Gallery, NotificationReadFeedback } = await import("../../apps/web/components/notifications/NotificationsScreen");
  const { LocaleProvider } = await import("../../apps/web/components/providers/LocaleProvider");
  const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);
  const gallery = (initialState: "default" | "pending" | "success" | "error" | "disabled" | "empty" | "overflow" = "default") =>
    render(createElement(LocaleProvider, { children: createElement(Kb70Gallery, { initialState }) }));

  describe("KB-70 notification actions", () => {
    test("pending feedback explains the disabled action in English", () => {
      const html = render(createElement(NotificationReadFeedback, { pending: true, lang: "en" }));
      expect(html).toContain('data-component="NotificationReadFeedback"');
      expect(html).toContain('id="kb70-mark-all-feedback"');
      expect(html).toContain("Marking notifications as read");
    });
    test("idle feedback leaves no status message", () => {
      expect(render(createElement(NotificationReadFeedback, { pending: false, lang: "en" }))).toBe("");
    });
    test("Hebrew pending copy uses the local group", () => {
      const html = render(createElement(NotificationReadFeedback, { pending: true, lang: "he" }));
      expect(html).toContain(translateKb70("he", "pending"));
      expect(html).not.toContain("Marking notifications");
    });
    test("default gallery mounts real notice rows with one main and heading", () => {
      const html = gallery();
      expect(html.match(/<main\b/g)).toHaveLength(1);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html).toContain("Maya shared an update");
      expect(html.match(/data-unread="true"/g)).toHaveLength(3);
      expect(html).toContain('id="i-bell"');
    });
    test("pending gallery disables Mark all read with a described explanation", () => {
      const html = gallery("pending");
      expect(html).toContain('aria-describedby="kb70-mark-all-feedback"');
      expect(html).toContain("Marking notifications as read");
      expect(html).toMatch(/disabled=""[^>]*>Mark all read/);
    });
    test("success gallery reuses the existing all-read announcement", () => {
      const html = gallery("success");
      expect(html).toContain("All caught up. Everything is marked as read.");
      expect(html).not.toContain('data-unread="true"');
    });
    test("error gallery exposes the existing save error", () => {
      const html = gallery("error");
      expect(html).toContain('role="alert"');
      expect(html).toContain("Maya shared an update");
    });
    test("empty gallery has no notice row", () => {
      const html = gallery("empty");
      expect(html).not.toContain('data-unread="true"');
      expect(html).toContain('class="tp-state"');
    });
    test("disabled gallery leaves notice text visible", () => {
      const html = gallery("disabled");
      expect(html).toContain("Dana has a reminder");
      expect(html).toMatch(/disabled=""[^>]*>Mark all read/);
    });
    test("overflow gallery retains the long fictional title", () => {
      const html = gallery("overflow");
      expect(html).toContain("very long fictional notification title");
      expect(html).toContain('dir="auto"');
    });
    test("English and Hebrew have exact key parity", () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
      for (const key of Object.keys(en) as Array<keyof typeof en>) {
        expect(translateKb70("en", key).length).toBeGreaterThan(0);
        expect(translateKb70("he", key).length).toBeGreaterThan(0);
      }
    });
  });

  let browser: Browser | undefined;
  let server: ReturnType<typeof Bun.serve> | undefined;
  let fixtureDirectory: string | undefined;

  describe.serial("KB-70 hydrated browser", () => {
    beforeAll(async () => {
      await mkdir(join(process.cwd(), "work"), { recursive: true });
      fixtureDirectory = await mkdtemp(join(process.cwd(), "work", "kb70-fixture-"));
      const directory = fixtureDirectory;
      await symlink(join(process.cwd(), "apps/web/node_modules"), join(directory, "node_modules"));
      const mockConvex = join(directory, "convex-mock.ts");
      const mockServer = join(directory, "server-mock.ts");
      const mockLink = join(directory, "link-mock.tsx");
      const entry = join(directory, "entry.tsx");
      await writeFile(mockServer, `export const anyApi = new Proxy({}, { get(_root, moduleName) { return new Proxy({}, { get(_module, functionName) { return { [Symbol.for("functionName")]: String(moduleName) + ":" + String(functionName) }; } }); } });\nexport function componentsGeneric() { return {}; }`);
      await writeFile(mockConvex, `const getName = (ref) => ref[Symbol.for("functionName")];
const state = window.__kb70 = {
  auth: { isAuthenticated: true, isLoading: false }, profile: { greetingName: "Maya" },
  notices: [
    { _id: "fictional-maya", title: "Maya shared an update", body: "A fictional message", kind: "system", createdAt: Date.now() },
    { _id: "fictional-dana", title: "Dana has a reminder", body: "A fictional reminder", kind: "reminder", createdAt: Date.now() - 1000 },
  ],
  readCalls: [], allCalls: 0, readResolve: null, allResolve: null, allReject: null, render: null,
};
export function useConvexAuth() { return state.auth; }
export function useQuery(ref) { const name = getName(ref); if (name === "users:getProfile") return state.profile; if (name === "notifications:list") return state.notices; throw new Error("Unexpected query " + name); }
export function useMutation(ref) { const name = getName(ref); return async (args) => {
  if (name === "notifications:markRead") { state.readCalls.push(args); return new Promise((resolve) => { state.readResolve = resolve; }); }
  if (name === "notifications:markAllRead") { state.allCalls++; return new Promise((resolve, reject) => { state.allResolve = resolve; state.allReject = reject; }); }
  throw new Error("Unexpected mutation " + name);
}; }
`);
      await writeFile(mockLink, `import React from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react"))};\nexport default function Link({ href, children, ...props }) { return React.createElement("a", { href, ...props }, children); }`);
      await writeFile(entry, `import React from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react"))};
import { createRoot } from ${JSON.stringify(join(process.cwd(), "apps/web/node_modules/react-dom/client"))};
import { LocaleProvider } from ${JSON.stringify(join(process.cwd(), "apps/web/components/providers/LocaleProvider"))};
import { TpIconSprite } from ${JSON.stringify(join(process.cwd(), "apps/web/components/tempo/TpIcon"))};
import { NotificationsScreen, Kb70Gallery } from ${JSON.stringify(join(process.cwd(), "apps/web/components/notifications/NotificationsScreen"))};
const root = createRoot(document.getElementById("root"));
const render = () => root.render(<LocaleProvider>{location.pathname === "/gallery" ? <Kb70Gallery /> : <><TpIconSprite /><main><NotificationsScreen /></main></>}</LocaleProvider>);
window.__kb70.render = render;
render();`);
      const bundle = await Bun.build({
        entrypoints: [entry], outdir: join(directory, "out"), target: "browser", alias: { "react-native": "react-native-web" },
        plugins: [{ name: "fixture-boundaries", setup(build) {
          build.onResolve({ filter: /^(convex\/(react|server)|next\/link)$/ }, (args) => ({
            path: args.path === "convex/react" ? mockConvex : args.path === "convex/server" ? mockServer : mockLink,
          }));
        } }],
      });
      if (!bundle.success) throw new Error(`KB-70 fixture bundle failed: ${bundle.logs.map(String).join("\n")}`);
      const js = bundle.outputs.find((file) => file.path.endsWith(".js"));
      const builtCss = bundle.outputs.find((file) => file.path.endsWith(".css"));
      if (!js || !builtCss) throw new Error("KB-70 fixture requires JS and CSS");
      const base = await Promise.all(["docs/design/v3/tokens.css", "docs/design/v3/tempo.css", "apps/web/app/v3/you.css"].map((path) => Bun.file(path).text()));
      const css = `${base.join("\n").replace(/@import url\([^;]+;/g, "")}\n${await builtCss.text()}`;
      server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === "/fixture.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
        if (path === "/fixture.css") return new Response(css, { headers: { "content-type": "text/css" } });
        return new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="margin:0;background:var(--tp-ground)"><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS:"0"}};</script><script type="module" src="/fixture.js"></script></body></html>', { headers: { "content-type": "text/html" } });
      } });
      const executable = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
      if (!executable) throw new Error("Chromium missing for KB-70 hydrated fixture");
      browser = await chromium.launch({ executablePath: executable, headless: true, args: ["--no-sandbox"] });
    }, 120_000);
    afterAll(async () => {
      await browser?.close(); server?.stop();
      if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
    });

    test("mounted screen: deferred reads preserve chosen focus and Mark all read is single-flight", async () => {
      if (!browser || !server) throw new Error("KB-70 fixture not started");
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
      try {
        await page.goto(server.url.href);
        await page.getByTestId("notifications-page").waitFor();
        expect(await page.locator("h1").count()).toBe(1);
        expect(await page.locator("main").count()).toBe(1);
        await page.getByRole("button", { name: /Maya shared an update/ }).click();
        await page.locator('a[href="/settings/preferences"]').focus();
        await page.evaluate(() => {
          const state = (window as unknown as { __kb70: { notices: Array<{ _id: string; readAt?: number }>; render: () => void; readResolve: (value: null) => void } }).__kb70;
          state.notices = state.notices.map((row) => row._id === "fictional-maya" ? { ...row, readAt: Date.now() } : row);
          state.render(); state.readResolve(null);
        });
        await page.locator('button[data-unread="true"]').waitFor();
        expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute("href"))).toBe("/settings/preferences");
        await page.getByRole("button", { name: /Dana has a reminder/ }).click();
        await page.evaluate(() => {
          const state = (window as unknown as { __kb70: { notices: Array<{ _id: string; readAt?: number }>; render: () => void; readResolve: (value: null) => void } }).__kb70;
          state.notices = state.notices.map((row) => row._id === "fictional-dana" ? { ...row, readAt: Date.now() } : row);
          state.render(); state.readResolve(null);
        });
        await page.locator('button[data-unread="true"]').waitFor({ state: "detached" });
        expect(await page.locator('.tp-list-row[tabindex="-1"]').last().evaluate((node) => document.activeElement === node)).toBe(true);
        await page.evaluate(() => {
          const state = (window as unknown as { __kb70: { notices: Array<{ readAt?: number }>; render: () => void } }).__kb70;
          state.notices = state.notices.map((row, index) => index === 0 ? { ...row, readAt: undefined } : row);
          state.render();
        });
        await page.locator('button[data-unread="true"]').waitFor();
        await page.evaluate(() => {
          const button = Array.from(document.querySelectorAll("button")).find((node) => node.textContent?.includes("Mark all read"));
          if (!button) throw new Error("Mark all read missing");
          button.click(); button.click();
        });
        expect(await page.evaluate(() => (window as unknown as { __kb70: { allCalls: number } }).__kb70.allCalls)).toBe(1);
        const allButton = page.getByRole("button", { name: "Mark all read" });
        expect(await allButton.isDisabled()).toBe(true);
        expect(await page.locator('[data-component="NotificationReadFeedback"]').textContent()).toContain("Marking notifications as read");
        await page.evaluate(() => (window as unknown as { __kb70: { allReject: (error: Error) => void } }).__kb70.allReject(new Error("network")));
        await page.getByRole("alert").waitFor();
        expect(await allButton.isEnabled()).toBe(true);
        await allButton.click();
        expect(await page.evaluate(() => (window as unknown as { __kb70: { allCalls: number } }).__kb70.allCalls)).toBe(2);
        await page.evaluate(() => {
          const state = (window as unknown as { __kb70: { notices: Array<{ readAt?: number }>; render: () => void; allResolve: (value: { updated: number }) => void } }).__kb70;
          state.notices = state.notices.map((row) => ({ ...row, readAt: Date.now() }));
          state.render(); state.allResolve({ updated: 1 });
        });
        await page.getByText("All caught up. Everything is marked as read.").waitFor();
        expect(await allButton.isDisabled()).toBe(true);
      } finally { await page.close(); }
    }, 120_000);

    test("hydrated gallery: controls, RTL, themes, targets, reduced motion and overflow", async () => {
      if (!browser || !server) throw new Error("KB-70 fixture not started");
      for (const width of [390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        try {
          await page.goto(new URL("/gallery", server.url.href).href);
          await page.locator('[data-component="Kb70Gallery"]').waitFor();
          expect(await page.locator("h1").count()).toBe(1);
          expect(await page.locator("main").count()).toBe(1);
          expect(await page.locator("#i-bell").count()).toBe(1);
          await page.getByRole("button", { name: "Pending", exact: true }).click();
          expect(await page.getByRole("button", { name: "Mark all read" }).isDisabled()).toBe(true);
          await page.getByRole("button", { name: "Error", exact: true }).click();
          expect(await page.getByRole("alert").count()).toBe(1);
          await page.getByRole("button", { name: "Disabled", exact: true }).click();
          expect(await page.getByRole("button", { name: "Mark all read" }).isDisabled()).toBe(true);
          await page.getByRole("button", { name: "Long title" }).click();
          expect(await page.locator(".nt-title").first().textContent()).toContain("very long fictional");
          await page.getByRole("button", { name: "Empty", exact: true }).click();
          expect(await page.locator('button[data-unread="true"]').count()).toBe(0);
          await page.getByRole("button", { name: "Default", exact: true }).click();
          await page.locator('button[data-unread="true"]').first().focus();
          expect(await page.evaluate(() => document.activeElement?.getAttribute("data-unread"))).toBe("true");
          await page.keyboard.press("Enter");
          expect(await page.locator('button[data-unread="true"]').count()).toBe(2);
          for (const lang of ["en", "he"] as const) {
            await page.getByRole("button", { name: lang === "en" ? "English" : "עברית" }).click();
            expect(await page.locator("main").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
            for (const theme of ["light", "dark"] as const) {
              await page.evaluate((next) => document.documentElement.dataset.theme = next, theme);
              expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
              expect(await page.locator(".kb70-gallery").evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration || "0"))).toBeLessThan(0.001);
              if (width === 390) {
                const targets = await page.locator("button").evaluateAll((nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
                expect(targets.every(({ width: w, height: h }) => w >= 44 && h >= 44)).toBe(true);
              }
              const capture = process.env.KB70_EVIDENCE_DIR;
              if (capture) {
                await mkdir(capture, { recursive: true });
                await page.screenshot({ path: join(capture, `gallery-${width}-${lang}-${theme}.png`), fullPage: true });
              }
            }
          }
        } finally { await page.close(); }
      }
    }, 120_000);
  });
}
