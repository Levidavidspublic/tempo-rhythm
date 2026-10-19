import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { en, he, kb67t } from "../../apps/web/lib/i18n-groups/kb-67";

const root = process.cwd();
const web = join(root, "apps/web");
const temp = join(root, "work/kb67-fixture");
setDefaultTimeout(60_000);
let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let beforeJs: string | null = null;
let beforeCss = "";

const backend = `
import { useSyncExternalStore } from "react";
const listeners = new Set();
let version = 0;
const nagA = { _id: "nag-a", label: "Maya's morning", enabled: true, createdAt: 2, updatedAt: 2,
  phrases: [{ id: "own-a", text: "Take a small stretch break", source: "user", status: "accepted" }] };
const nagB = { _id: "nag-b", label: "Dana's water", enabled: true, createdAt: 1, updatedAt: 1,
  phrases: [{ id: "own-b", text: "Drink a glass of water", source: "user", status: "accepted" }] };
const state = { auth: { isAuthenticated: true, isLoading: false }, profile: { fullName: "Maya Levin", greetingName: "Maya" },
  nags: [nagA, nagB], calls: [], held: [], hold: [], reject: [], proposals: ["Try a gentle stretch", "Pause and breathe"], nextId: 1, queryError: false };
function emit() { version++; for (const fn of listeners) fn(); }
function useStore() { useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version); }
async function waitIfHeld(ref) {
  if (state.reject.includes(ref)) throw new Error("fictional " + ref + " failure");
  if (state.hold.includes(ref)) return await new Promise((resolve, reject) => state.held.push({ ref, resolve, reject }));
  return undefined;
}
window.__kb67 = {
  state,
  setView(view) { state.queryError = view === "error"; state.auth = view === "loading"
    ? { isAuthenticated: false, isLoading: true } : view === "signed-out"
      ? { isAuthenticated: false, isLoading: false } : { isAuthenticated: true, isLoading: false };
    state.nags = view === "empty" ? [] : [nagA, nagB]; emit(); },
  hold(ref) { state.hold.push(ref); },
  reject(ref) { state.reject.push(ref); },
  settle(ref, ok, value) { const index = state.held.findIndex(item => item.ref === ref);
    if (index < 0) throw new Error("No held " + ref); const [item] = state.held.splice(index, 1);
    if (ok) item.resolve(value); else item.reject(new Error("fictional " + ref + " failure")); },
};
export function useConvexAuth() { useStore(); return state.auth; }
export function useQuery(ref, args) { useStore(); if (args === "skip") return undefined;
  if (state.queryError) throw new Error("fictional query error");
  return ref === "users:getProfile" ? state.profile : state.nags; }
export function useMutation(ref) { return async args => {
  state.calls.push({ ref, args }); await waitIfHeld(ref);
  if (ref === "nags:create") { const id = "created-" + state.nextId++; state.nags = [{ _id: id, label: args.label,
    enabled: false, phrases: [], createdAt: 3, updatedAt: 3 }, ...state.nags]; emit(); return id; }
  if (ref === "nags:addPhrase") { const phraseId = "phrase-" + state.nextId++;
    state.nags = state.nags.map(n => n._id === args.nagId ? { ...n, phrases: [...n.phrases,
      { id: phraseId, text: args.text, source: args.source, status: args.source === "user" ? "accepted" : "proposed" }] } : n);
    emit(); return { phraseId }; }
  if (ref === "nags:decidePhrase") { state.nags = state.nags.map(n => n._id === args.nagId ? { ...n,
    phrases: n.phrases.map(p => p.id === args.phraseId ? { ...p, status: args.decision === "accept" ? "accepted" : "rejected" } : p) } : n);
    emit(); return { success: true }; }
  if (ref === "nags:setEnabled") { state.nags = state.nags.map(n => n._id === args.nagId ? { ...n, enabled: args.enabled } : n);
    emit(); return { success: true }; }
  if (ref === "nags:remove") { state.nags = state.nags.filter(n => n._id !== args.nagId); emit(); return { success: true }; }
  throw new Error("Unexpected mutation " + ref);
}; }
export function useAction(ref) { return async args => { state.calls.push({ ref, args });
  const result = await waitIfHeld(ref); return { proposals: result?.proposals ?? state.proposals }; }; }
`;
const api = `export const api = { users: { getProfile: "users:getProfile" }, nags: {
  list: "nags:list", create: "nags:create", addPhrase: "nags:addPhrase", decidePhrase: "nags:decidePhrase",
  setEnabled: "nags:setEnabled", remove: "nags:remove", proposePhrases: "nags:proposePhrases" } };`;
const link = `import React from "react"; export default function Link({ href, children, ...rest }) {
  return React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...rest }, children); }`;
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider, useLocale } from "@/components/providers/LocaleProvider";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { NagsScreen, Kb67Gallery } from "@/app/(tempo)/settings/nags/NagsScreen";
function Screen() { const { lang } = useLocale(); return <><TpIconSprite/><main id="main" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}><NagsScreen /></main></>; }
const params = new URLSearchParams(location.search);
createRoot(document.getElementById("app")).render(<LocaleProvider>{params.get("mode") === "gallery" ? <Kb67Gallery /> : <Screen />}</LocaleProvider>);
`;

function html(mode: string, lang: string): string {
  const before = mode === "before";
  return `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:var(--tp-ground);font-family:var(--tp-font-sans)}*{box-sizing:border-box}</style><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/${before ? "before" : "bundle"}.css"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"test"}}</script><script type="module" src="/${before ? "before" : "bundle"}.js"></script></body></html>`;
}
async function buildFixture() {
  await mkdir(temp, { recursive: true });
  await Promise.all([
    writeFile(join(temp, "backend.ts"), backend),
    writeFile(join(temp, "api.ts"), api),
    writeFile(join(temp, "link.ts"), link),
    writeFile(join(temp, "entry.tsx"), entry),
  ]);
  const buildEntry = (path: string) =>
    Bun.build({
      entrypoints: [path],
      target: "browser",
      outdir: temp,
      define: { "process.env.NODE_ENV": '"test"' },
      plugins: [
        {
          name: "kb67-fixture",
          setup(build) {
            build.onResolve(
              { filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ },
              ({ path }) => ({ path: Bun.resolveSync(path, web) })
            );
            build.onResolve({ filter: /^(convex\/react|next\/navigation)$/ }, () => ({
              path: join(temp, "backend.ts"),
            }));
            build.onResolve({ filter: /^next\/link$/ }, () => ({ path: join(temp, "link.ts") }));
            build.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
              path: join(temp, "api.ts"),
            }));
            build.onResolve({ filter: /^@\// }, ({ path }) => ({
              path: Bun.resolveSync(path, web),
            }));
          },
        },
      ],
    });
  const built = await buildEntry(join(temp, "entry.tsx"));
  if (!built.success) throw new Error(built.logs.map(String).join("\n"));
  const js = await built.outputs.find((file) => file.path.endsWith(".js"))?.text();
  if (!js) throw new Error("KB-67 fixture did not bundle JS");
  const bundleCss = (
    await Promise.all(
      built.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text())
    )
  ).join("\n");
  const baseCss = (
    await Promise.all(
      ["docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/v3/you.css"].map(
        (file) => readFile(join(root, file), "utf8")
      )
    )
  )
    .join("\n")
    .replace(/@import url\([^;]+;\s*/g, "");
  const snapshot = join(root, "work/kb67-before-source.tsx");
  if (existsSync(snapshot)) {
    await writeFile(
      join(temp, "before-entry.tsx"),
      `import React from "react"; import {createRoot} from "react-dom/client";
      import {LocaleProvider,useLocale} from "@/components/providers/LocaleProvider";
      import {TpIconSprite} from "@/components/tempo/TpIcon";
      import {NagsScreen} from ${JSON.stringify(snapshot)};
      function Screen(){const {lang}=useLocale();return <><TpIconSprite/><main id="main" lang={lang} dir={lang==="he"?"rtl":"ltr"}><NagsScreen/></main></>}
      createRoot(document.getElementById("app")).render(<LocaleProvider><Screen/></LocaleProvider>);`
    );
    const before = await buildEntry(join(temp, "before-entry.tsx"));
    if (!before.success) throw new Error(before.logs.map(String).join("\n"));
    beforeJs = (await before.outputs.find((file) => file.path.endsWith(".js"))?.text()) ?? null;
    beforeCss = (
      await Promise.all(
        before.outputs.filter((file) => file.path.endsWith(".css")).map((file) => file.text())
      )
    ).join("\n");
  }
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/bundle.js")
        return new Response(js, { headers: { "content-type": "text/javascript" } });
      if (url.pathname === "/bundle.css")
        return new Response(bundleCss, { headers: { "content-type": "text/css" } });
      if (url.pathname === "/before.js")
        return new Response(beforeJs ?? "", { headers: { "content-type": "text/javascript" } });
      if (url.pathname === "/before.css")
        return new Response(beforeCss, { headers: { "content-type": "text/css" } });
      if (url.pathname === "/base.css")
        return new Response(baseCss, { headers: { "content-type": "text/css" } });
      return new Response(
        html(
          url.searchParams.get("mode") ?? "screen",
          url.searchParams.get("lang") === "he" ? "he" : "en"
        ),
        { headers: { "content-type": "text/html" } }
      );
    },
  });
  const browserPath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
  if (!browserPath)
    throw new Error("KB-67 fixture needs installed Playwright Chromium or system Chrome/Chromium");
  browser = await chromium.launch({ executablePath: browserPath, args: ["--no-sandbox"] });
}
async function pageFor(
  mode: "screen" | "gallery" | "before" = "screen",
  lang: "en" | "he" = "en",
  width = 390
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}`);
  try {
    await page.locator("h1").waitFor({ state: "attached", timeout: 10000 });
  } catch {
    throw new Error(
      `KB-67 fixture did not hydrate: ${errors.join(" | ")} ${await page.locator("body").innerText()}`
    );
  }
  return page;
}
const state = (page: Page) =>
  page.evaluate(() => {
    const { calls, nags, held } = (window as any).__kb67.state;
    return { calls, nags, held: held.map((item: any) => item.ref) };
  });
const calls = async (page: Page, ref: string) =>
  (await state(page)).calls.filter((call: any) => call.ref === ref);
const hold = (page: Page, ref: string) =>
  page.evaluate((value) => (window as any).__kb67.hold(value), ref);
const settle = (page: Page, ref: string, ok: boolean, value?: unknown) =>
  page.evaluate(
    (args: [string, boolean, unknown]) => (window as any).__kb67.settle(args[0], args[1], args[2]),
    [ref, ok, value] as [string, boolean, unknown]
  );
const phrase = (page: Page) => page.locator("#ng-add-text");
const select = (page: Page) => page.locator("#ng-add-nag");

// Every browser case mounts the real screen or real gallery views with fictional query/action boundaries.
describe.serial("KB-67 selected-nag phrase editing", () => {
  beforeAll(buildFixture, 120_000);
  afterAll(async () => {
    await browser?.close();
    server?.stop(true);
  });

  test("English and Hebrew keys match and named views mount", async () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    expect(kb67t("he", "phrase.saved", { label: "מאיה" })).toContain("מאיה");
    const page = await pageFor("gallery");
    expect(await page.locator('[data-component="Kb67Gallery"]').count()).toBe(1);
    expect(await page.locator('[data-component="SelectedNagPhraseForm"]').count()).toBe(1);
    await page.getByRole("button", { name: en["gallery.pending"] }).click();
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(1);
    await page.close();
  });

  test("mounted ready screen keeps one h1 and one main", async () => {
    const page = await pageFor();
    expect(await page.locator("h1").count()).toBe(1);
    expect(await page.locator("main").count()).toBe(1);
    await pwExpect(page.getByTestId("settings-nags")).toBeVisible();
    await pwExpect(page.locator('[data-component="SelectedNagPhraseForm"]')).toBeVisible();
    await page.close();
  });

  test("loading, signed-out and empty states keep their existing mounts", async () => {
    for (const view of ["loading", "signed-out", "empty"]) {
      const page = await pageFor();
      await page.evaluate((value) => (window as any).__kb67.setView(value), view);
      await pwExpect(
        page.locator(
          view === "loading"
            ? '[data-component="StateLoading"]'
            : view === "signed-out"
              ? '[data-component="StateSignedOut"]'
              : '[data-component="StateEmpty"]'
        )
      ).toBeVisible();
      expect(await page.locator("h1").count()).toBe(1);
      await page.close();
    }
  });

  test("query error retains existing retry state", async () => {
    const page = await pageFor();
    await page.evaluate(() => (window as any).__kb67.setView("error"));
    await pwExpect(page.locator('[data-component="StateError"]')).toBeVisible();
    await pwExpect(page.getByRole("button", { name: /retry/i })).toBeVisible();
    await page.close();
  });

  test("A and B keep separate drafts across A to B to A selection", async () => {
    const page = await pageFor();
    await phrase(page).fill("Maya's words");
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).toHaveValue("");
    await phrase(page).fill("Dana's words");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("Maya's words");
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).toHaveValue("Dana's words");
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    await page.close();
  });

  test("validation stays with the nag and labels the matching field", async () => {
    const page = await pageFor();
    await phrase(page).fill(" ");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await pwExpect(phrase(page)).toHaveAttribute("aria-invalid", "true");
    expect(await phrase(page).getAttribute("aria-describedby")).toContain("ng-add-error");
    await pwExpect(phrase(page)).toBeFocused();
    await select(page).selectOption("nag-b");
    await pwExpect(phrase(page)).not.toHaveAttribute("aria-invalid", "true");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveAttribute("aria-invalid", "true");
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    await page.close();
  });

  test("held A add succeeds without clearing B's newer draft", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await pwExpect(page.getByText(en["phrase.saving"])).toBeVisible();
    await select(page).selectOption("nag-b");
    await phrase(page).fill("Dana phrase");
    await settle(page, "nags:addPhrase", true);
    await pwExpect(phrase(page)).toHaveValue("Dana phrase");
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("");
    await pwExpect(
      page.getByText(kb67t("en", "phrase.saved", { label: "Maya's morning" }))
    ).toBeVisible();
    expect(await calls(page, "nags:addPhrase")).toEqual([
      { ref: "nags:addPhrase", args: { nagId: "nag-a", text: "Maya phrase", source: "user" } },
    ]);
    await page.close();
  });

  test("held A add rejection leaves B text and focus alone", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Maya phrase");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await select(page).selectOption("nag-b");
    await phrase(page).fill("Dana phrase");
    await settle(page, "nags:addPhrase", false);
    await pwExpect(phrase(page)).toHaveValue("Dana phrase");
    await pwExpect(phrase(page)).toBeFocused();
    expect(await page.getByText(en["phrase.error"]).count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(phrase(page)).toHaveValue("Maya phrase");
    await pwExpect(page.getByText(en["phrase.error"])).toBeVisible();
    await page.close();
  });

  test("newer same-A words survive earlier successful save", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Earlier words");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await phrase(page).fill("Newer words");
    await pwExpect(page.getByText(en["phrase.savingEarlier"])).toBeVisible();
    await settle(page, "nags:addPhrase", true);
    await pwExpect(phrase(page)).toHaveValue("Newer words");
    expect(
      await page.getByText(kb67t("en", "phrase.saved", { label: "Maya's morning" })).count()
    ).toBe(0);
    await page.close();
  });

  test("newer same-A words survive earlier rejected save without stale error", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Earlier words");
    await page.getByRole("button", { name: "Add phrase" }).click();
    await phrase(page).fill("Newer words");
    await settle(page, "nags:addPhrase", false);
    await pwExpect(phrase(page)).toHaveValue("Newer words");
    expect(await page.getByText(en["phrase.error"]).count()).toBe(0);
    await pwExpect(phrase(page)).toBeFocused();
    await page.close();
  });

  test("held A suggestions settle on A after B is selected", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.locator('[data-component="NagSuggestionNotice"]')).toBeVisible();
    await select(page).selectOption("nag-b");
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await settle(page, "nags:proposePhrases", true, { proposals: ["Maya's calm suggestion"] });
    expect(await page.getByText("Maya's calm suggestion").count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(page.getByText("Maya's calm suggestion")).toBeVisible();
    expect(await calls(page, "nags:proposePhrases")).toEqual([
      { ref: "nags:proposePhrases", args: { nagId: "nag-a" } },
    ]);
    await page.close();
  });

  test("held A empty suggestion result never appears under B", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await select(page).selectOption("nag-b");
    await settle(page, "nags:proposePhrases", true, { proposals: [] });
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(page.locator('[data-component="NagSuggestionNotice"]')).toBeVisible();
    await page.close();
  });

  test("held A suggestion rejection never accuses B", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await select(page).selectOption("nag-b");
    await settle(page, "nags:proposePhrases", false);
    expect(await page.locator('[data-component="NagSuggestionNotice"]').count()).toBe(0);
    await select(page).selectOption("nag-a");
    await pwExpect(
      page.locator('[data-component="NagSuggestionNotice"][role="alert"]')
    ).toBeVisible();
    await page.close();
  });

  test("rapid double Add phrase makes one mutation call", async () => {
    const page = await pageFor();
    await hold(page, "nags:addPhrase");
    await phrase(page).fill("Only one addition");
    await page.evaluate(() => {
      const form = document.querySelector("#ng-add-text")!.closest("form")!;
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });
    await pwExpect(page.getByRole("button", { name: "Add phrase" })).toBeDisabled();
    expect(await calls(page, "nags:addPhrase")).toHaveLength(1);
    await settle(page, "nags:addPhrase", true);
    await page.close();
  });

  test("rapid double Suggest makes one read-only action call", async () => {
    const page = await pageFor();
    await hold(page, "nags:proposePhrases");
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll("button")).find((node) =>
        node.textContent?.includes("Suggest from my words")
      )! as HTMLButtonElement;
      button.click();
      button.click();
    });
    await pwExpect(page.getByRole("button", { name: /suggesting/i })).toBeDisabled();
    expect(await calls(page, "nags:proposePhrases")).toHaveLength(1);
    await settle(page, "nags:proposePhrases", true);
    await page.close();
  });

  test("derived phrase remains unwritten until explicit Accept, then uses two existing calls", async () => {
    const page = await pageFor();
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.getByText("Try a gentle stretch")).toBeVisible();
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    expect(await calls(page, "nags:decidePhrase")).toHaveLength(0);
    await page
      .locator('.tp-list-row[data-status="suggested"]')
      .filter({ hasText: "Try a gentle stretch" })
      .getByRole("button", { name: "Accept" })
      .click();
    await pwExpect(
      page
        .locator('.tp-list-row[data-status="accepted"]')
        .filter({ hasText: "Try a gentle stretch" })
    ).toBeVisible();
    expect(await calls(page, "nags:addPhrase")).toEqual([
      {
        ref: "nags:addPhrase",
        args: { nagId: "nag-a", text: "Try a gentle stretch", source: "derived" },
      },
    ]);
    expect(await calls(page, "nags:decidePhrase")).toEqual([
      {
        ref: "nags:decidePhrase",
        args: { nagId: "nag-a", phraseId: "phrase-1", decision: "accept" },
      },
    ]);
    await page.close();
  });

  test("Reject removes a local suggestion without a write", async () => {
    const page = await pageFor();
    await page.getByRole("button", { name: "Suggest from my words" }).click();
    await pwExpect(page.getByText("Try a gentle stretch")).toBeVisible();
    await page
      .locator('.tp-list-row[data-status="suggested"]')
      .filter({ hasText: "Try a gentle stretch" })
      .getByRole("button", { name: "Reject" })
      .click();
    expect(await page.getByText("Try a gentle stretch").count()).toBe(0);
    expect(await calls(page, "nags:addPhrase")).toHaveLength(0);
    expect(await calls(page, "nags:decidePhrase")).toHaveLength(0);
    await page.close();
  });

  test("existing phrase removal still offers five-minute Undo", async () => {
    const page = await pageFor();
    await page.locator(".ng-nag").first().getByRole("button", { name: "Remove" }).click();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toBeVisible();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toContainText(/[45]:[0-5]\d/);
    await page
      .locator('[data-component="UndoToast"]')
      .getByRole("button", { name: "Undo" })
      .click();
    await pwExpect(page.locator('[data-component="UndoToast"]')).toHaveCount(0);
    const decisions = await calls(page, "nags:decidePhrase");
    expect(decisions.map((call: any) => call.args.decision)).toEqual(["reject", "accept"]);
    await page.close();
  });

  test("Hebrew form and email-free labels are RTL without horizontal overflow", async () => {
    const page = await pageFor("screen", "he");
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    await pwExpect(page.locator('[data-component="SelectedNagPhraseForm"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.close();
  });

  test("phone targets and keyboard focus remain visible with reduced motion", async () => {
    const page = await pageFor();
    for (const node of await page
      .locator(".kb67-composer :is(button, select, textarea):visible")
      .all()) {
      const box = await node.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Tab");
    const style = await page.evaluate(() => {
      const css = getComputedStyle(document.activeElement as Element);
      return { outline: Number.parseFloat(css.outlineWidth), transition: css.transitionDuration };
    });
    expect(style.outline).toBeGreaterThanOrEqual(2);
    expect(style.transition.split(",").every((value) => Number.parseFloat(value) <= 0.000011)).toBe(
      true
    );
    await page.close();
  });

  test("gallery changes real form and notice views with A/B selection", async () => {
    const page = await pageFor("gallery");
    await phrase(page).fill("Maya gallery words");
    await select(page).selectOption("gallery-dana");
    await pwExpect(phrase(page)).toHaveValue("");
    await page.getByRole("button", { name: en["gallery.error"] }).click();
    await pwExpect(
      page.locator('[data-component="NagSuggestionNotice"][role="alert"]')
    ).toBeVisible();
    await page.getByRole("button", { name: en["gallery.disabled"] }).click();
    await pwExpect(page.getByRole("button", { name: "Add phrase" })).toBeDisabled();
    await select(page).selectOption("gallery-maya");
    await pwExpect(phrase(page)).toHaveValue("Maya gallery words");
    await page.getByRole("button", { name: "עברית" }).click();
    await pwExpect(page.locator("main")).toHaveAttribute("dir", "rtl");
    expect(await page.locator("h1").count()).toBe(1);
    await page.close();
  });

  test("long fictional nag text fits phone and desktop", async () => {
    for (const width of [390, 1280]) {
      const page = await pageFor("gallery", "en", width);
      await page.getByRole("button", { name: en["gallery.overflow"] }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.close();
    }
  });

  test("source-derived before and mounted after evidence covers widths, locales and themes", async () => {
    const shots = join(root, "work/kb67-captures");
    await mkdir(shots, { recursive: true });
    for (const width of [390, 1280])
      for (const lang of ["en", "he"] as const)
        for (const theme of ["light", "dark"] as const) {
          for (const mode of beforeJs
            ? (["before", "screen", "gallery"] as const)
            : (["screen", "gallery"] as const)) {
            const page = await pageFor(mode, lang, width);
            await page.evaluate((value) => {
              document.documentElement.dataset.theme = value;
            }, theme);
            expect(await page.locator("h1").count()).toBe(1);
            expect(await page.locator("main").count()).toBe(1);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
            ).toBe(true);
            await page.screenshot({
              path: join(shots, `${mode}-${width}-${lang}-${theme}.png`),
              fullPage: true,
            });
            await page.close();
          }
        }
  }, 300_000);
});
