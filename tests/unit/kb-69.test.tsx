import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { en, he, kb69t } from "../../apps/web/lib/i18n-groups/kb-69";

const root = process.cwd();
const web = join(root, "apps/web");
const temp = join(root, "work/kb69-fixture");
setDefaultTimeout(60_000);
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let beforeJs: string | null = null;
let beforeCss = "";

const backend = `
import { useSyncExternalStore } from "react";
const listeners = new Set();
const initial = { fullName: "Maya", email: "maya@example.com" };
const state = { profile: initial, calls: [], saveMode: "resolve", heldSave: [], outMode: "resolve", heldOut: [], outCalls: 0, redirects: [] };
function emit() { for (const fn of listeners) fn(); }
window.__kb69 = {
  state,
  setProfile(profile) { state.profile = profile; emit(); },
  settleSave(ok) { const next = state.heldSave.shift(); if (next) next(ok); },
  settleOut(ok) { const next = state.heldOut.shift(); if (next) next(ok); },
};
export function useQuery(ref, args) { useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state.profile); return state.profile; }
export function useMutation(ref) { return async args => {
  state.calls.push({ ref, args });
  if (state.saveMode === "reject") throw new Error("fictional save rejection");
  if (state.saveMode === "hold") { const ok = await new Promise(resolve => state.heldSave.push(resolve)); if (!ok) throw new Error("fictional save rejection"); }
  state.profile = { ...state.profile, fullName: args.fullName }; emit();
  return "fictional-user-id";
}; }
export function useAuthActions() { return { signOut: async () => {
  state.outCalls++;
  if (state.outMode === "reject") throw new Error("fictional sign-out rejection");
  if (state.outMode === "hold") { const ok = await new Promise(resolve => state.heldOut.push(resolve)); if (!ok) throw new Error("fictional sign-out rejection"); }
} }; }
export function useRouter() { return { replace(path) { state.redirects.push(path); } }; }
`;
const api = `export const api = { users: { getProfile: "users:getProfile", updateMyProfile: "users:updateMyProfile" } };`;
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { WaitingForApproval, Kb69Gallery } from "@/components/approval/WaitingForApproval";
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("app")).render(<LocaleProvider>{params.get("mode") === "gallery" ? <Kb69Gallery /> : <WaitingForApproval email="maya@example.com" revoked={params.get("revoked") === "1"} />}</LocaleProvider>);
`;
const legacyUtilities = `
.flex{display:flex}.min-h-screen{min-height:100vh}.items-center{align-items:center}.justify-center{justify-content:center}.bg-background{background:var(--tp-ground)}.p-6{padding:24px}.text-foreground{color:var(--tp-ink)}.w-full{width:100%}.max-w-md{max-width:448px}.space-y-4>*+*{margin-top:16px}.space-y-2>*+*{margin-top:8px}.space-y-1>*+*{margin-top:4px}.rounded-xl{border-radius:14px}.border{border:1px solid var(--tp-line)}.border-border{border-color:var(--tp-line)}.bg-card{background:var(--tp-paper)}.text-center{text-align:center}.text-start{text-align:start}.text-xl{font-size:24px}.text-sm{font-size:15px}.text-xs{font-size:13px}.font-semibold{font-weight:600}.font-medium{font-weight:500}.text-muted-foreground{color:var(--tp-ink-muted)}.list-decimal{list-style:decimal}.ps-5{padding-inline-start:20px}.border-t{border-top:1px solid var(--tp-line)}.pt-4{padding-top:16px}.flex-1{flex:1}.min-w-0{min-width:0}.gap-2{gap:8px}.block{display:block}.text-foreground{color:var(--tp-ink)}
`;

function html(mode: string, lang: string): string {
  const before = mode === "before";
  return `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--tp-ground);font-family:var(--tp-font-sans)}*{box-sizing:border-box}</style><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/${before ? "before" : "bundle"}.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"test"}}</script><script type="module" src="/${before ? "before" : "bundle"}.js"></script></body></html>`;
}
async function buildFixture() {
  await mkdir(temp, { recursive: true });
  await writeFile(join(temp, "backend.ts"), backend);
  await writeFile(join(temp, "api.ts"), api);
  await writeFile(join(temp, "entry.tsx"), entry);
  const buildEntry = (path: string) => Bun.build({ entrypoints: [path], target: "browser", outdir: temp,
    define: { "process.env.NODE_ENV": '"test"' }, plugins: [{ name: "kb69-fixture", setup(build) {
      build.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
      build.onResolve({ filter: /^(@convex-dev\/auth\/react|convex\/react|next\/navigation)$/ }, () => ({ path: join(temp, "backend.ts") }));
      build.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({ path: join(temp, "api.ts") }));
      build.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
    } }] });
  const result = await buildEntry(join(temp, "entry.tsx"));
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  const js = await result.outputs.find(file => file.path.endsWith(".js"))?.text();
  if (!js) throw new Error("KB-69 browser fixture did not bundle JS");
  const bundleCss = (await Promise.all(result.outputs.filter(file => file.path.endsWith(".css")).map(file => file.text()))).join("\n");
  const baseCss = (await Promise.all(["docs/design/v3/tokens.css", "apps/web/app/tempo.css"].map(file => readFile(join(root, file), "utf8")))).join("\n").replace(/@import url\([^;]+;\s*/g, "");
  // Local source snapshot is captured before editing; CI tests only the checked-in current source.
  const snapshot = join(root, "work/kb69-before-source.tsx");
  if (existsSync(snapshot)) {
    await writeFile(join(temp, "before-entry.tsx"), `import React from "react"; import { createRoot } from "react-dom/client"; import { LocaleProvider } from "@/components/providers/LocaleProvider"; import { WaitingForApproval } from ${JSON.stringify(snapshot)}; createRoot(document.getElementById("app")).render(<LocaleProvider><WaitingForApproval email="maya@example.com" revoked={new URLSearchParams(location.search).get("revoked") === "1"} /></LocaleProvider>);`);
    const before = await buildEntry(join(temp, "before-entry.tsx"));
    if (!before.success) throw new Error(before.logs.map(String).join("\n"));
    beforeJs = await before.outputs.find(file => file.path.endsWith(".js"))?.text() ?? null;
    beforeCss = legacyUtilities + (await Promise.all(before.outputs.filter(file => file.path.endsWith(".css")).map(file => file.text()))).join("\n");
  }
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/bundle.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
    if (path === "/bundle.css") return new Response(bundleCss, { headers: { "content-type": "text/css" } });
    if (path === "/before.js") return new Response(beforeJs ?? "", { headers: { "content-type": "text/javascript" } });
    if (path === "/before.css") return new Response(beforeCss, { headers: { "content-type": "text/css" } });
    if (path === "/base.css") return new Response(baseCss, { headers: { "content-type": "text/css" } });
    const url = new URL(request.url);
    return new Response(html(url.searchParams.get("mode") ?? "screen", url.searchParams.get("lang") === "he" ? "he" : "en"), { headers: { "content-type": "text/html" } });
  } });
  const browserPath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser"].find(existsSync);
  if (!browserPath) throw new Error("KB-69 fixture requires installed Playwright Chromium or system Chrome/Chromium");
  browser = await chromium.launch({ executablePath: browserPath, args: ["--no-sandbox"] });
}
async function pageFor(mode: "screen" | "gallery" | "before" = "screen", lang: "en" | "he" = "en", width = 390, revoked = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}&revoked=${revoked ? "1" : "0"}`);
  try { await page.locator("h1").waitFor({ state: "attached", timeout: 10000 }); }
  catch { throw new Error(`KB-69 did not hydrate: ${errors.join(" | ")} ${await page.locator("body").innerText()}`); }
  return page;
}
const state = (page: Page) => page.evaluate(() => (window as any).__kb69.state);
const settled = (page: Page, ok: boolean) => page.evaluate(value => (window as any).__kb69.settleSave(value), ok);

// The actual mounted component uses fictional query/mutation/auth stubs; no live account is touched.
describe.serial("KB-69 approval waiting", () => {
  beforeAll(buildFixture, 120_000);
  afterAll(async () => { await browser?.close(); server?.stop(true); });

  test("en/he dictionary keys match and interpolation keeps the limit", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    expect(kb69t("he", "name.tooLong", { max: "60" })).toContain("60");
  });
  test("waiting and revoked keep one h1 and one main", async () => {
    for (const revoked of [false, true]) {
      const page = await pageFor("screen", "en", 390, revoked);
      expect(await page.locator("main").count()).toBe(1);
      expect(await page.locator("h1").count()).toBe(1);
      await pwExpect(page.getByRole("heading", { level: 1, name: kb69t("en", revoked ? "revoked.title" : "waiting.title") })).toBeVisible();
      expect(await page.getByTestId("approval-name").count()).toBe(revoked ? 0 : 1);
      await page.close();
    }
  });
  test("name prefill uses profile and blank profile stays optional", async () => {
    const page = await pageFor();
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await pwExpect(input).toHaveValue("Maya");
    await page.evaluate(() => (window as any).__kb69.setProfile({ fullName: "User", email: "maya@example.com" }));
    await pwExpect(input).toHaveValue("");
    await page.close();
  });
  test("validation keeps invalid name and associates the error", async () => {
    const page = await pageFor();
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill(" "); await page.getByRole("button", { name: "Save" }).click();
    await pwExpect(page.getByText(en["name.empty"])).toBeVisible();
    await pwExpect(input).toHaveAttribute("aria-invalid", "true");
    expect(await input.getAttribute("aria-describedby")).toContain("waiting-name-feedback");
    await pwExpect(input).toBeFocused();
    expect((await state(page)).calls).toHaveLength(0);
    await page.close();
  });
  test("pending save disables duplicate submit but leaves name editable", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.saveMode = "hold");
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill("Dana"); await page.getByRole("button", { name: "Save" }).click();
    await pwExpect(page.getByRole("button", { name: en["name.saving"] })).toBeDisabled();
    await pwExpect(page.locator("[data-component=WaitingNameFeedback]").getByText(en["name.saving"])).toBeVisible();
    await input.fill("Dana next");
    await pwExpect(input).toHaveValue("Dana next");
    await pwExpect(page.getByText(en["name.savingEarlier"])).toBeVisible();
    expect((await state(page)).calls).toHaveLength(1);
    await settled(page, true); await pwExpect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.close();
  });
  test("stale success never overwrites newer edit or says Saved", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.saveMode = "hold");
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill("Older"); await page.getByRole("button", { name: "Save" }).click();
    await input.fill("Newer"); await settled(page, true);
    await pwExpect(input).toHaveValue("Newer");
    await pwExpect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(await page.getByText(en["name.saved"]).count()).toBe(0);
    await page.close();
  });
  test("stale error does not accuse newer draft", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.saveMode = "hold");
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill("Older"); await page.getByRole("button", { name: "Save" }).click();
    await input.fill("Newer"); await settled(page, false);
    await pwExpect(input).toHaveValue("Newer");
    await pwExpect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(await page.getByText(en["name.error"]).count()).toBe(0);
    await page.close();
  });
  test("current success reports Saved and uses existing mutation arguments", async () => {
    const page = await pageFor();
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill("Dana  "); await page.getByRole("button", { name: "Save" }).click();
    await pwExpect(page.getByText(en["name.saved"])).toBeVisible();
    await pwExpect(input).toHaveValue("Dana");
    expect((await state(page)).calls).toEqual([{ ref: "users:updateMyProfile", args: { fullName: "Dana" } }]);
    await page.close();
  });
  test("current save failure retains text, labels error and focuses input", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.saveMode = "reject");
    const input = page.getByRole("textbox", { name: /what should tempo call you/i });
    await input.fill("Dana"); await page.getByRole("button", { name: "Save" }).click();
    await pwExpect(page.getByText(en["name.error"])).toBeVisible();
    await pwExpect(input).toHaveValue("Dana");
    await pwExpect(input).toHaveAttribute("aria-invalid", "true");
    await pwExpect(input).toBeFocused();
    await page.close();
  });
  test("sign-out rejection stays on screen with reachable retry", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.outMode = "reject");
    await page.getByRole("button", { name: en.signOut }).click();
    await pwExpect(page.getByText(en.signOutError)).toBeVisible();
    await pwExpect(page.getByRole("button", { name: en.signOut })).toBeFocused();
    expect((await state(page)).redirects).toHaveLength(0);
    await page.evaluate(() => (window as any).__kb69.state.outMode = "resolve");
    await page.getByRole("button", { name: en.signOut }).click();
    await pwExpect(page.getByText(en.signOutError)).toHaveCount(0);
    expect((await state(page)).redirects).toEqual(["/sign-in"]);
    await page.close();
  });
  test("pending sign-out blocks duplicate calls", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb69.state.outMode = "hold");
    await page.getByRole("button", { name: en.signOut }).click();
    await pwExpect(page.getByRole("button", { name: en.signingOut })).toBeDisabled();
    expect((await state(page)).outCalls).toBe(1);
    await page.evaluate(() => (window as any).__kb69.settleOut(true));
    await pwExpect(page.getByRole("button", { name: en.signOut })).toBeEnabled();
    await page.close();
  });
  test("Hebrew waiting and revoked are RTL with isolated LTR email", async () => {
    for (const revoked of [false, true]) {
      const page = await pageFor("screen", "he", 390, revoked);
      await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
      await pwExpect(page.locator("bdi[dir=ltr]")).toHaveText("maya@example.com");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.close();
    }
  });
  test("phone controls are 44 px and keyboard focus remains visible", async () => {
    const page = await pageFor();
    for (const node of await page.locator("button:visible, input:visible").all()) {
      const box = await node.boundingBox(); expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Tab");
    const width = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.activeElement as Element).outlineWidth));
    expect(width).toBeGreaterThanOrEqual(2);
    await page.close();
  });
  test("gallery switches real status views and retries a fictional sign-out error", async () => {
    const page = await pageFor("gallery");
    await page.getByRole("button", { name: en["gallery.revoked"] }).click();
    await pwExpect(page.getByRole("heading", { name: en["revoked.title"] })).toBeVisible();
    await page.getByRole("button", { name: en["gallery.pending"] }).click();
    await pwExpect(page.locator("[data-component=WaitingNameFeedback]").getByText(en["name.saving"])).toBeVisible();
    await page.getByRole("button", { name: en["gallery.signOutError"] }).click();
    await page.getByRole("button", { name: en["gallery.retry"] }).click();
    await pwExpect(page.getByText(en["gallery.retryDone"])).toBeVisible();
    await page.getByRole("button", { name: "עברית" }).click();
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    expect(await page.locator("h1").count()).toBe(1);
    await page.close();
  });
  test("long fictional email and text never widen phone or desktop", async () => {
    for (const width of [390, 1280]) {
      const page = await pageFor("gallery", "en", width);
      await page.getByRole("button", { name: en["gallery.overflow"] }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.close();
    }
  });
  test("browser evidence covers source-derived before/current, widths, locales and themes", async () => {
    const shots = join(root, "work/kb69-captures");
    await mkdir(shots, { recursive: true });
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"] as const) {
      for (const mode of beforeJs ? ["before", "screen"] as const : ["screen"] as const) {
        const page = await pageFor(mode, lang, width);
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        expect(await page.locator("main").count()).toBe(1);
        expect(await page.locator("h1").count()).toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: join(shots, `${mode}-${width}-${lang}-${theme}.png`), fullPage: true });
        await page.close();
      }
    }
  }, 300_000);
});
