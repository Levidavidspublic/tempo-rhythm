import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";
import { parseTempoBlocks } from "../../packages/utils/src/index";
import { en, he, HABIT_GOAL_OUTLINES, habitGoalDraft, habitGoalText } from "../../apps/web/lib/i18n-groups/habit-goal-templates";

const root = process.cwd();
const web = join(root, "apps/web");
type Payload = { name: string; description?: string; body: string; periodType: string };
declare global {
  interface Window {
    __habitGoal: {
      calls: { name: string; args: Payload }[];
      pushes: string[];
      hold: boolean;
      reject: boolean;
      settle: (success: boolean) => void;
    };
  }
}

// These substitutes exist only in the browser bundle. No process-global mock.module calls.
const backend = `
import {getFunctionName} from "convex/server";
let held;
window.__habitGoal={calls:[],pushes:[],hold:false,reject:false,
 settle(success){if(!held)throw Error("No pending save");const current=held;held=null;
 success?current.resolve("fictional-template"):current.reject(Error("Fictional save rejection"));}};
export function useRouter(){return {push(path){window.__habitGoal.pushes.push(path)}}}
export function useQuery(ref,args){if(args==="skip")return undefined;return {
 templateId:"fictional-source",source:new URLSearchParams(location.search).get("mode")==="copy"?"starter":"user",
 name:"Existing outline",description:"Fictional source",periodType:"weekly",body:"## Existing section\\nKeep these words."};}
export function useMutation(ref){return async args=>{const state=window.__habitGoal;
 state.calls.push({name:getFunctionName(ref),args});
 if(state.hold)return await new Promise((resolve,reject)=>{held={resolve,reject}});
 if(state.reject)throw Error("Fictional save rejection");return "fictional-template";};}
`;
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {TemplateBuilderScreen} from "@/components/template-builder/TemplateBuilder";
import {LocaleProvider,useLocale} from "@/components/providers/LocaleProvider";
import {ThemeProvider} from "@/components/providers/ThemeProvider";
function Harness(){const {setLang,lang}=useLocale();const mode=new URLSearchParams(location.search).get("mode");
 const props=mode==="copy"?{fromId:"fictional-source"}:mode==="edit"?{editId:"fictional-source"}:
 mode==="sketch"?{outline:"Project outline\\nNext section"}:mode==="invalid-sketch"?{outline:"   "}:{};
 return <><div aria-label="Fictional test controls"><button type="button" onClick={()=>setLang(lang==="en"?"he":"en")}>Switch fixture language</button></div><TemplateBuilderScreen {...props}/></>;}
createRoot(document.getElementById("root")).render(<ThemeProvider><LocaleProvider><Harness/></LocaleProvider></ThemeProvider>);
`;

let browser: Browser | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let ownedFixtureDirectory: string | undefined;
let page: Page | undefined;
let browserErrors: string[] = [];
let externalRequests: string[] = [];

async function prepareFixture() {
  const scratch = mkdtempSync(join(process.env.TEMPO1303_SCRATCH ?? tmpdir(), "tempo-habit-goal-"));
  ownedFixtureDirectory = scratch;
  const fixtureEntry = join(scratch, "entry.tsx");
  writeFileSync(fixtureEntry, entry);
  const bundled = await Bun.build({
    entrypoints: [fixtureEntry], target: "browser", outdir: scratch,
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [{ name: "habit-goal-external-boundaries", setup(build) {
      build.onResolve({ filter: /^(convex\/react|next\/navigation|next\/link)$/ }, ({ path }) => ({ path: path === "next/link" ? path : "backend", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "next/link" ? 'import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children)}' : backend,
        loader: "tsx", resolveDir: web,
      }));
      build.onResolve({ filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime|convex\/server)$/ }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
      build.onResolve({ filter: /^@\/convex\// }, ({ path }) => ({ path: Bun.resolveSync(join(root, "convex", path.slice("@/convex/".length)), web) }));
      build.onResolve({ filter: /^@tempo\/utils$/ }, () => ({ path: join(root, "packages/utils/src/index.ts") }));
      build.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(join(web, path.slice(2)), web) }));
    } }],
  });
  if (!bundled.success) throw new Error(bundled.logs.map(String).join("\n"));
  const js = await bundled.outputs.find((output) => output.path.endsWith(".js"))?.text();
  if (!js) throw new Error("Mounted builder fixture has no JavaScript output");
  const require = createRequire(join(web, "package.json"));
  const globals = join(web, "app/globals.css");
  const css = await require("postcss")([require("@tailwindcss/postcss")()]).process(await readFile(globals, "utf8"), { from: globals });
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/fixture.js") return new Response(js, { headers: { "content-type": "text/javascript" } });
    if (url.pathname === "/fixture.css") return new Response(css.css, { headers: { "content-type": "text/css" } });
    if (/^\/fonts\/(source-sans-3|assistant|frank-ruhl-libre|opendyslexic)\/[\w.-]+\.(woff2?|ttf)$/.test(url.pathname)) {
      return new Response(Bun.file(join(web, url.pathname.slice(1))));
    }
    if (url.pathname !== "/templates/builder") return new Response("Not found", { status: 404 });
    const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
    const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
    return new Response(`<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`, { headers: { "content-type": "text/html" } });
  } });
  const executablePath = ["/usr/bin/chromium", chromium.executablePath()].find(existsSync);
  if (!executablePath) throw new Error("Mounted template proof needs installed Chromium");
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
}

async function open(query = "", width = 390) {
  if (!browser || !server) throw new Error("Fixture not started");
  page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  browserErrors = [];
  externalRequests = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") { externalRequests.push(url.origin); return route.abort(); }
    return route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.port}/templates/builder?${query}`);
  await browserExpect(page.locator(".cm-content")).toBeVisible();
  return page;
}
const gallery = (p: Page) => p.locator('[data-component="HabitGoalTemplates"]');
const choose = (p: Page, outline: "habit" | "goal" = "habit", lang: "en" | "he" = "en") =>
  gallery(p).getByRole("button", { name: `${habitGoalText(lang, "choose")}: ${habitGoalDraft(lang, outline).name}`, exact: true });
const preview = (p: Page, outline: "habit" | "goal" = "habit", lang: "en" | "he" = "en") =>
  gallery(p).getByRole("button", { name: `${habitGoalText(lang, "preview")}: ${habitGoalDraft(lang, outline).name}`, exact: true });
const save = (p: Page) => p.locator("header .tp-btn--primary");
const editor = (p: Page) => p.locator(".cm-content");
async function replaceBody(p: Page, text: string) {
  await editor(p).click();
  await p.keyboard.press("ControlOrMeta+a");
  await p.keyboard.insertText(text);
}
async function state(p: Page) { return p.evaluate(() => ({ calls: window.__habitGoal.calls, pushes: window.__habitGoal.pushes })); }
async function expectNoWrites(p: Page) { expect(await state(p)).toEqual({ calls: [], pushes: [] }); }

async function cleanupFixture() {
  const cleanups = [
    { name: "browser close", run: () => browser?.close() },
    { name: "server stop", run: () => server?.stop(true) },
    { name: "owned fixture directory removal", run: () => ownedFixtureDirectory ? rm(ownedFixtureDirectory, { recursive: true, force: true }) : undefined },
  ];
  // Start every cleanup independently: a rejected close must never skip server/temp cleanup.
  const results = await Promise.allSettled(cleanups.map(({ run }) => Promise.resolve().then(run)));
  const errors = results.flatMap((result, index) => result.status === "rejected"
    ? [new Error(`${cleanups[index]?.name}: ${String(result.reason)}`, { cause: result.reason })] : []);
  if (errors.length) throw new AggregateError(errors, errors.map((error) => error.message).join("; "));
}

// The real builder/editor/read view render in Chromium; only Convex and navigation are substituted.
describe.serial("Habit/Goal personal template drafts", () => {
  beforeAll(prepareFixture, 120_000);
  afterEach(async () => {
    const errors = [...browserErrors];
    const requests = [...externalRequests];
    await page?.close();
    page = undefined;
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
  });
  afterAll(cleanupFixture);

  test("English and Hebrew dictionaries have complete nonempty matching keys", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const lang of ["en", "he"] as const) for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(habitGoalText(lang, key).trim().length).toBeGreaterThan(0);
    }
  });
  test("four distinct outlines are reusable ordinary Markdown with five sections and one checklist", () => {
    const bodies = [];
    for (const lang of ["en", "he"] as const) for (const outline of HABIT_GOAL_OUTLINES) {
      const draft = habitGoalDraft(lang, outline);
      expect(draft.periodType).toBe("none");
      expect(draft.body.match(/^## /gm)).toHaveLength(5);
      expect(draft.body.match(/^- \[ \] /gm)).toHaveLength(1);
      expect(parseTempoBlocks(draft.body).every((segment) => segment.kind === "markdown")).toBe(true);
      bodies.push(draft.body);
    }
    expect(new Set(bodies).size).toBe(4);
  });
  test("preview and close render real Markdown without writes or draft edits", async () => {
    const p = await open();
    await preview(p).click();
    await browserExpect(gallery(p).locator('[data-component="ReadView"]')).toContainText("What would make this habit useful?");
    await browserExpect(gallery(p).locator("h1")).toHaveCount(0);
    await gallery(p).getByRole("button", { name: en.cancel, exact: true }).click();
    await browserExpect(preview(p)).toBeFocused();
    await browserExpect(gallery(p).locator('[data-component="ReadView"]')).toHaveCount(0);
    await browserExpect(p.locator("#template-name")).toHaveValue("");
    await browserExpect(editor(p)).toHaveText("");
    await expectNoWrites(p);
  });
  for (const outline of HABIT_GOAL_OUTLINES) {
    test(`explicit ${outline} selection fills the actual editable editor and both fields without writes`, async () => {
      const p = await open();
      const draft = habitGoalDraft("en", outline);
      await choose(p, outline).click();
      await browserExpect(p.locator("#template-name")).toHaveValue(draft.name);
      await browserExpect(p.locator("#template-description")).toHaveValue(draft.description);
      await browserExpect(editor(p)).toContainText(draft.body.split("\n")[1] ?? "");
      await replaceBody(p, "My editable outline");
      await browserExpect(editor(p)).toHaveText("My editable outline");
      await expectNoWrites(p);
    });
  }
  for (const field of ["name", "description", "body"] as const) {
    test(`editing ${field} disables replacement and keeps its text`, async () => {
      const p = await open();
      if (field === "body") await replaceBody(p, "Keep this body");
      else await p.locator(`#template-${field}`).fill("Keep this field");
      await browserExpect(choose(p)).toBeDisabled();
      await preview(p).click();
      await browserExpect(choose(p, "goal")).toBeDisabled();
      if (field === "body") await browserExpect(editor(p)).toHaveText("Keep this body");
      else await browserExpect(p.locator(`#template-${field}`)).toHaveValue("Keep this field");
      await expectNoWrites(p);
    });
  }
  test("preview opened before typing cannot replace the now-owned draft", async () => {
    const p = await open();
    await preview(p).click();
    await p.locator("#template-name").fill("Written after preview");
    await browserExpect(choose(p)).toBeDisabled();
    await browserExpect(gallery(p).getByRole("status")).toHaveText(en.locked);
    await browserExpect(p.locator("#template-name")).toHaveValue("Written after preview");
    await expectNoWrites(p);
  });
  test("clearing a previously edited draft does not make it untouched again", async () => {
    const p = await open();
    await p.locator("#template-name").fill("Owned");
    await p.locator("#template-name").fill("");
    await browserExpect(choose(p)).toBeDisabled();
    await expectNoWrites(p);
  });
  test("selected outline cannot be replaced by a second outline", async () => {
    const p = await open();
    await choose(p).click();
    await browserExpect(choose(p, "goal")).toBeDisabled();
    await browserExpect(p.locator("#template-name")).toHaveValue(en["habit.name"]);
    await expectNoWrites(p);
  });
  test("pending Save keeps selection disabled and submits only once", async () => {
    const p = await open();
    await choose(p).click();
    await p.evaluate(() => { window.__habitGoal.hold = true; });
    await save(p).click();
    await browserExpect(save(p)).toBeDisabled();
    await preview(p, "goal").click();
    await browserExpect(choose(p, "goal")).toBeDisabled();
    await browserExpect(gallery(p).getByRole("status")).toHaveText(en.pending);
    expect((await state(p)).calls).toHaveLength(1);
    expect((await state(p)).pushes).toEqual([]);
    await p.evaluate(() => window.__habitGoal.settle(true));
    await browserExpect.poll(async () => (await state(p)).pushes).toEqual(["/templates"]);
  });
  for (const mode of ["copy", "edit", "sketch"] as const) {
    test(`${mode} initialization keeps its own draft and omits the blank-only selector`, async () => {
      const p = await open(`mode=${mode}`);
      await browserExpect(gallery(p)).toHaveCount(0);
      await browserExpect(p.locator("#template-name")).toHaveValue(mode === "sketch" ? "Project outline" : "Existing outline");
      await browserExpect(editor(p)).toContainText(mode === "sketch" ? "Next section" : "Keep these words.");
      await expectNoWrites(p);
    });
  }
  test("invalid incoming sketch also omits the blank-only selector", async () => {
    const p = await open("mode=invalid-sketch");
    await browserExpect(gallery(p)).toHaveCount(0);
    await expectNoWrites(p);
  });
  test("locale change localizes controls while preserving selected and typed draft text", async () => {
    const p = await open("lang=he");
    await choose(p, "goal", "he").click();
    await p.locator("#template-name").fill("מטרה אישית");
    await replaceBody(p, "## התקדמות\nצעד מותאם אישית");
    const content = await editor(p).innerText();
    await p.getByRole("button", { name: "Switch fixture language" }).click();
    await browserExpect(gallery(p).getByRole("heading", { name: en.title })).toBeVisible();
    await browserExpect(p.locator("html")).toHaveAttribute("dir", "ltr");
    await browserExpect(p.locator("#template-name")).toHaveValue("מטרה אישית");
    await browserExpect(p.locator("#template-description")).toHaveValue(he["goal.description"]);
    expect(await editor(p).innerText()).toBe(content);
    await expectNoWrites(p);
  });
  test("Save sends exactly the current edited name, description, body and none period", async () => {
    const p = await open();
    await choose(p, "goal").click();
    await p.locator("#template-name").fill("Personal goal");
    await p.locator("#template-description").fill("My flexible description");
    const body = "## My outcome\nA small next step.\n\n- [ ] My own step";
    await replaceBody(p, body);
    await save(p).click();
    await browserExpect.poll(() => state(p)).toEqual({ calls: [{ name: "templates:create", args: {
      name: "Personal goal", description: "My flexible description", body, periodType: "none",
    } }], pushes: ["/templates"] });
  });
  test("rejected Save retains all edited fields and the actual editor with no navigation", async () => {
    const p = await open();
    await choose(p).click();
    await p.locator("#template-name").fill("Keep this name");
    await p.locator("#template-description").fill("Keep this description");
    await replaceBody(p, "## Keep this body\nEditable after rejection");
    await p.evaluate(() => { window.__habitGoal.reject = true; });
    await save(p).click();
    await browserExpect(p.getByRole("alert")).toBeVisible();
    await browserExpect(p.locator("#template-name")).toHaveValue("Keep this name");
    await browserExpect(p.locator("#template-description")).toHaveValue("Keep this description");
    await browserExpect(editor(p)).toContainText("Editable after rejection");
    await browserExpect(save(p)).toBeEnabled();
    expect((await state(p)).pushes).toEqual([]);
    expect((await state(p)).calls).toHaveLength(1);
  });
  test("retry uses the retained draft through existing Save and navigates only after success", async () => {
    const p = await open("lang=he");
    await choose(p, "habit", "he").click();
    await p.evaluate(() => { window.__habitGoal.reject = true; });
    await save(p).click();
    await browserExpect(p.getByRole("alert")).toBeVisible();
    expect((await state(p)).pushes).toEqual([]);
    await p.evaluate(() => { window.__habitGoal.reject = false; });
    await save(p).click();
    const draft = habitGoalDraft("he", "habit");
    await browserExpect.poll(() => state(p)).toEqual({ calls: [
      { name: "templates:create", args: draft }, { name: "templates:create", args: draft },
    ], pushes: ["/templates"] });
  });
  test("keyboard preview, close and Choose retain visible focus and populate the real editor", async () => {
    const p = await open();
    await preview(p).focus();
    await p.keyboard.press("Enter");
    await browserExpect(preview(p)).toHaveAttribute("aria-expanded", "true");
    const cancel = gallery(p).getByRole("button", { name: en.cancel, exact: true });
    await cancel.focus();
    await p.keyboard.press("Space");
    await browserExpect(preview(p)).toBeFocused();
    const focus = await preview(p).evaluate((node) => ({ style: getComputedStyle(node).outlineStyle, width: getComputedStyle(node).outlineWidth }));
    expect(focus.style).not.toBe("none");
    expect(Number.parseFloat(focus.width)).toBeGreaterThan(0);
    await p.keyboard.press("Tab");
    await browserExpect(choose(p)).toBeFocused();
    await p.keyboard.press("Enter");
    await browserExpect(editor(p)).toContainText("What would make this habit useful?");
    await expectNoWrites(p);
  });
  test("phone and desktop gallery and editable draft fit en/he light/dark with one main and h1", async () => {
    const evidence = process.env.TEMPO1303_EVIDENCE;
    if (evidence) await mkdir(evidence, { recursive: true });
    for (const width of [390, 1280]) for (const lang of ["en", "he"] as const) for (const theme of ["light", "dark"]) {
      const p = await open(`lang=${lang}&theme=${theme}`, width);
      await browserExpect(p.locator("html")).toHaveAttribute("dir", lang === "he" ? "rtl" : "ltr");
      await preview(p, "habit", lang).click();
      for (const button of await gallery(p).getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      }
      await browserExpect(p.locator("main")).toHaveCount(1);
      await browserExpect(p.locator("h1")).toHaveCount(1);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await p.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      if (evidence) await p.screenshot({ path: join(evidence, `${width}-${lang}-${theme}-gallery.png`), fullPage: true });
      await choose(p, "habit", lang).click();
      await replaceBody(p, lang === "he" ? "## צעד אישי\nאפשר לערוך את המתווה." : "## Personal step\nThis outline is editable.");
      await browserExpect(choose(p, "goal", lang)).toBeDisabled();
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await browserExpect(p.locator("main")).toHaveCount(1);
      await browserExpect(p.locator("h1")).toHaveCount(1);
      if (evidence) await p.screenshot({ path: join(evidence, `${width}-${lang}-${theme}-selected.png`), fullPage: true });
      await expectNoWrites(p);
      expect(browserErrors).toEqual([]);
      expect(externalRequests).toEqual([]);
      await p.close();
      page = undefined;
    }
  }, 120_000);
});
