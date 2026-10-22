import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { serve } from "bun";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { chromium, expect as browserExpect, type Browser, type Page } from "@playwright/test";

const root = resolve(import.meta.dir, "../..");
const web = join(root, "apps/web");
const exec = promisify(execFile);
const baseline = process.env.PAGE_RECOVERY_BASELINE;
const evidence = join(root, "docs/polish/evidence/feature-page-recovery");
let directory: string;
let server: ReturnType<typeof serve>;
let browser: Browser;
let page: Page | undefined;
let errors: string[] = [];

type Kind = "update" | "togglePin" | "remove" | "restore";
type Fixture = {
  modes: Record<Kind, "resolve" | "reject" | "defer">;
  calls: { kind: Kind; args: Record<string, unknown> }[];
  pending: { kind: Kind }[];
  settle(kind: Kind, success: boolean): void;
  body(value?: string): string;
  show(id: string | null): void;
  flush(): Promise<void>;
  flushResult: string;
  signal(): void;
  notes: Record<string, { title: string; body: string; pinned: boolean }>;
};
declare global {
  interface Window { pageRecovery: Fixture; }
}

beforeAll(async () => {
  directory = await mkdtemp(join(web, ".page-recovery-fixture-"));
  await mkdir(evidence, { recursive: true });
  const entry = join(directory, "entry.tsx");
  await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {EditorView} from "@codemirror/view";
import {NotePage} from "../components/notes/NotesScreen";
import {CoachPageProvider,useFlushCoachPage} from "../components/coach/CoachPage";
const params=new URLSearchParams(location.search),lang=params.get("lang")==="he"?"he":"en",type=params.get("type")||"plain";
document.documentElement.lang=lang;document.documentElement.dir=lang==="he"?"rtl":"ltr";document.documentElement.dataset.theme=params.get("theme")||"light";
const meta="\u0060\u0060\u0060json tempo\\n"+JSON.stringify({id:"blk_00000000000000000000000000",v:1,type:"page-meta",data:{pageType:type,tags:[],...(type==="daily"||type==="weekly"?{date:"2026-10-19"}:{})}})+"\\n\u0060\u0060\u0060\\n\\n";
const note=(id,title,body)=>({_id:id,_creationTime:1,userId:"fixture-user",title,body,pinned:false,periodType:type==="daily"||type==="weekly"?type:"none",pageType:type,...(type==="weekly"?{date:"2026-10-19"}:{}),createdAt:1,updatedAt:1});
const d=window.pageRecovery={revision:0,profile:{_id:"fixture-user"},notes:{a:note("a",lang==="he"?"דף לדוגמה":"Example page",meta+"A calm starting point."),b:note("b","Another page",meta+"A different draft.")},modes:{update:"resolve",togglePin:"resolve",remove:"resolve",restore:"resolve"},calls:[],pending:[],flushResult:"idle"};
d.signal=()=>{d.revision++;window.dispatchEvent(new Event("fixture-change"))};
d.body=(value)=>{const view=EditorView.findFromDOM(document.querySelector(".cm-editor"));if(value!==undefined)view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}});return view.state.doc.toString()};
d.perform=(kind,args)=>{d.calls.push({kind,args:{...args}});const apply=()=>{const previous=d.notes[args.noteId];if(kind==="update")d.notes[args.noteId]={...previous,...args};if(kind==="togglePin")d.notes[args.noteId]={...previous,pinned:!previous.pinned};if(kind==="remove")d.notes[args.noteId]={...previous,deletedAt:Date.now()};if(kind==="restore")d.notes[args.noteId]={...previous,deletedAt:undefined};d.signal();return kind==="remove"?{success:true,undoUntilMs:Date.now()+300000}:kind==="restore"?{success:true}:kind==="togglePin"?{pinned:d.notes[args.noteId].pinned}:args.noteId};if(d.modes[kind]==="reject")return Promise.reject(new Error("FICTIONAL_PAGE_FAILURE"));if(d.modes[kind]==="defer")return new Promise((resolve,reject)=>d.pending.push({kind,resolve:()=>resolve(apply()),reject:()=>reject(new Error("FICTIONAL_PAGE_FAILURE"))}));return Promise.resolve(apply())};
d.settle=(kind,success)=>{const index=d.pending.findIndex(p=>p.kind===kind);if(index<0)throw new Error("No pending "+kind);const item=d.pending.splice(index,1)[0];success?item.resolve():item.reject()};
function Probe(){const flush=useFlushCoachPage();d.flush=flush;return <button type="button" id="flush" onClick={()=>{d.flushResult="pending";void flush().then(()=>{d.flushResult="resolved"},()=>{d.flushResult="rejected"})}}>Flush fixture page</button>}
function App(){const[id,setId]=React.useState("a");d.show=setId;return <CoachPageProvider><main><Probe/>{id!==null&&<NotePage noteId={id}/>}</main></CoachPageProvider>}
createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
`);
  const stubs = {
    "convex/react": `import React from "react";const mutations=new Map();export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export function useQuery(ref,args){const d=window.pageRecovery;React.useSyncExternalStore(fn=>{window.addEventListener("fixture-change",fn);return()=>window.removeEventListener("fixture-change",fn)},()=>d.revision,()=>0);if(args==="skip")return undefined;const key=String(ref);if(key.endsWith("users.getProfile"))return d.profile;if(key.endsWith("notes.getSafe")){const note=d.notes[args.noteId];return note?.deletedAt?null:note??null}if(key.endsWith("notes.list"))return Object.values(d.notes).filter(n=>!n.deletedAt);return []}export function useMutation(ref){const kind=String(ref).split(".").at(-1);if(!mutations.has(kind))mutations.set(kind,args=>window.pageRecovery.perform(kind,args));return mutations.get(kind)}export const useConvex=()=>({query:async()=>[]});export const useAction=()=>async()=>{throw new Error("No provider action permitted")};`,
    "next/navigation": `export const useRouter=()=>({push(){},replace(){},refresh(){}});export const usePathname=()=>"/notes/a";export const useSearchParams=()=>new URLSearchParams();`,
    "next/link": `import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
    "@/components/providers/LocaleProvider": `import {translate} from "${web}/lib/i18n.ts";export function useLocale(){const lang=document.documentElement.lang==="he"?"he":"en";return {lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key),setLang(){}}}`,
    "@/convex/_generated/api": `const node=(path="api")=>new Proxy({},{get(_,key){if(key===Symbol.toPrimitive)return()=>path;if(key==="toString")return()=>path;return node(path+"."+String(key))}});export const api=node();`,
  };
  const builder = join(directory, "build.ts");
  await writeFile(builder, `
import {readFileSync,existsSync,statSync,writeFileSync} from "node:fs";import {join,resolve,basename} from "node:path";
const stubs=${JSON.stringify(stubs)},web=${JSON.stringify(web)},root=${JSON.stringify(root)},dir=${JSON.stringify(directory)},baseline=${JSON.stringify(baseline ?? null)};
const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:dir,target:"browser",plugins:[{name:"fictional-page-boundaries",setup(build){
build.onResolve({filter:/^(@\\/|convex\\/react$|next\\/(navigation|link)$)/},args=>{if(args.path in stubs)return {path:args.path,namespace:"fixture"};if(args.path.startsWith("@/")){const base=resolve(web,args.path.slice(2));const found=[base,base+".ts",base+".tsx",base+".js",join(base,"index.ts"),join(base,"index.tsx")].find(p=>existsSync(p)&&statSync(p).isFile());if(!found)throw new Error("Unresolved scoped fixture import "+args.path);return {path:found}}});
build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:stubs[args.path],loader:"tsx",resolveDir:web}));
if(baseline)build.onLoad({filter:/components\\/notes\\/NotesScreen\\.tsx$/},args=>({contents:readFileSync(baseline,"utf8"),loader:"tsx",resolveDir:join(web,"components/notes")}));
}}]});if(!result.success)throw new Error(result.logs.map(String).join("\\n"));for(const output of result.outputs)writeFileSync(join(dir,basename(output.path)),new Uint8Array(await output.arrayBuffer()));
const postcss=(await import(join(web,"node_modules/postcss/lib/postcss.mjs"))).default,tailwind=(await import(join(web,"node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
const path=join(web,"app/globals.css");const css=(await postcss([tailwind({base:root})]).process(readFileSync(path,"utf8"),{from:path})).css;writeFileSync(join(dir,"globals.css"),css);
`);
  // A fresh process cannot inherit another test file's process-wide Bun mocks.
  await exec(process.execPath, ["--no-env-file", builder], {
    cwd: web, timeout: 90_000, killSignal: "SIGKILL", maxBuffer: 2 * 1024 * 1024,
    env: { PATH: process.env.PATH, NODE_ENV: "test" },
  });
  const assets = new Map<string, Buffer>();
  for (const name of ["entry.js", "entry.css", "globals.css"]) {
    if (existsSync(join(directory, name))) assets.set(`/${name}`, await readFile(join(directory, name)));
  }
  server = serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url);
    const asset = assets.get(url.pathname);
    if (asset) return new Response(new Uint8Array(asset).buffer, { headers: { "Content-Type": url.pathname.endsWith(".css") ? "text/css" : "text/javascript" } });
    if (url.pathname.startsWith("/fonts/")) {
      const path = resolve(web, url.pathname.slice(1));
      if (path.startsWith(`${web}/fonts/`) && existsSync(path)) return new Response(await readFile(path), { headers: { "Content-Type": path.endsWith("woff2") ? "font/woff2" : "font/woff" } });
      return new Response("Font not found", { status: 404 });
    }
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${assets.has("/entry.css") ? '<link rel="stylesheet" href="/entry.css">' : ""}<style>html{--font-newsreader:Newsreader;--font-ibm-mono:'IBM Plex Mono'}body{margin:0;background:var(--tp-ground);color:var(--tp-ink)}main{margin:var(--tp-space-4);max-width:var(--tp-measure)}#flush{min-height:var(--tp-touch)}@font-face{font-family:Newsreader;src:url('/fonts/newsreader/Newsreader-latin.woff2')}@font-face{font-family:'IBM Plex Mono';src:url('/fonts/ibm-plex-mono/IBMPlexMono-latin-400.woff2')}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script type="module" src="/entry.js"></script></body></html>`, { headers: { "Content-Type": "text/html" } });
  } });
  const executablePath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
  if (!executablePath) throw new Error("A real Chromium is required for page recovery tests");
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"], timeout: 30_000 });
}, 120_000);

afterEach(async () => {
  try {
    if (!baseline) expect(errors).toEqual([]);
  } finally {
    await page?.close();
    page = undefined;
  }
});
afterAll(async () => {
  const results = await Promise.allSettled([browser?.close(), server?.stop(true), directory ? rm(directory, { recursive: true, force: true }) : undefined]);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "Page recovery cleanup failed");
}, 15_000);

async function open(options: { lang?: string; width?: number; theme?: string; type?: string } = {}) {
  errors = [];
  page = await browser.newPage({ viewport: { width: options.width ?? 390, height: 844 }, reducedMotion: "reduce" });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const params = new URLSearchParams({ lang: options.lang ?? "en", theme: options.theme ?? "light", type: options.type ?? "plain" });
  await page.goto(`${server.url}?${params}`);
  await browserExpect(page.locator(".cm-content")).toBeVisible();
  await browserExpect(page.getByRole("textbox", { name: options.lang === "he" ? "כותרת הפתק" : "Note title" })).not.toHaveValue("");
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function mode(p: Page, kind: Kind, value: "resolve" | "reject" | "defer") {
  await p.evaluate(({ kind, value }) => { window.pageRecovery.modes[kind] = value; }, { kind, value });
}
async function calls(p: Page, kind: Kind, count: number) {
  await browserExpect.poll(() => p.evaluate((kind) => window.pageRecovery.calls.filter((call) => call.kind === kind).length, kind)).toBe(count);
}
async function edit(p: Page, value: string) { await p.evaluate((value) => window.pageRecovery.body(value), value); }
const notice = (p: Page, kind: "save" | "pin" | "delete") => p.locator(`[data-component="PageActionError"][data-operation="${kind}"]`);
async function confirmDelete(p: Page) {
  await p.getByRole("button", { name: "Page options" }).click();
  await p.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await p.getByRole("button", { name: "Confirm delete", exact: true }).click();
}

describe.serial("page action recovery", () => {
  if (baseline) {
    test("original autosave remains Saving after rejection and retains its draft", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      const draft = `${await p.evaluate(() => window.pageRecovery.body())}\n\nAn unsaved fictional draft.`;
      await edit(p, draft);
      await calls(p, "update", 1);
      await browserExpect(p.locator('[data-state="saving"]')).toHaveText("Saving…");
      await browserExpect(notice(p, "save")).toHaveCount(0);
      expect(await p.evaluate(() => window.pageRecovery.body())).toBe(draft);
      expect(errors).toEqual([]);
    }, 30_000);
    test("original pin rejection reaches the unhandled page-error boundary", async () => {
      const p = await open();
      await mode(p, "togglePin", "reject");
      await p.getByRole("button", { name: "Pin", exact: true }).click();
      await browserExpect.poll(() => errors).toEqual(["FICTIONAL_PAGE_FAILURE"]);
      await browserExpect(notice(p, "pin")).toHaveCount(0);
    }, 30_000);
  } else {
    test("failed autosave retains both edited fields and offers explicit recovery", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      await p.getByRole("textbox", { name: "Note title" }).fill("Changed title");
      await edit(p, "An unsaved fictional draft.");
      await browserExpect(notice(p, "save")).toBeVisible();
      await browserExpect(p.locator('[data-state="saving"]')).toHaveCount(0);
      await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Changed title");
      expect(await p.evaluate(() => window.pageRecovery.body())).toBe("An unsaved fictional draft.");
      expect(await p.locator("body").innerText()).not.toContain("FICTIONAL_PAGE_FAILURE");
    }, 30_000);
    test("explicit retry saves the current draft once and clears its own error", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      await edit(p, "Kept for retry.");
      await browserExpect(notice(p, "save")).toBeVisible();
      await mode(p, "update", "defer");
      await notice(p, "save").getByRole("button").evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await calls(p, "update", 2);
      await browserExpect(notice(p, "save").getByRole("button")).toBeDisabled();
      await p.evaluate(() => window.pageRecovery.settle("update", true));
      await browserExpect(notice(p, "save")).toHaveCount(0);
      await browserExpect(p.locator('[data-state="saved"]')).toHaveText("Saved");
      expect(await p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Kept for retry.");
    }, 30_000);
    test("older success cannot mark a newer draft saved and writes stay ordered", async () => {
      const p = await open();
      await p.clock.install();
      await mode(p, "update", "defer");
      await edit(p, "First draft."); await p.clock.runFor(500); await calls(p, "update", 1);
      await edit(p, "Second draft.");
      await p.clock.runFor(500); await calls(p, "update", 1);
      await p.evaluate(() => window.pageRecovery.settle("update", true));
      await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
      expect(await p.evaluate(() => window.pageRecovery.body())).toBe("Second draft.");
      await calls(p, "update", 2);
      await p.evaluate(() => window.pageRecovery.settle("update", true));
      await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
      expect(await p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Second draft.");
    }, 30_000);
    for (const field of ["title", "body"] as const) {
      test(`deferred ${field} A to B to A keeps the final edit dirty until its own save`, async () => {
        const p = await open();
        await p.clock.install();
        await mode(p, "update", "defer");
        const first = "First draft A.";
        const middle = "Middle draft B.";
        const change = async (value: string) => {
          if (field === "title") await p.getByRole("textbox", { name: "Note title" }).fill(value);
          else await edit(p, value);
        };
        const current = () => field === "title"
          ? p.getByRole("textbox", { name: "Note title" }).inputValue()
          : p.evaluate(() => window.pageRecovery.body());
        await change(first); await p.clock.runFor(500); await calls(p, "update", 1);
        await change(middle); await p.clock.runFor(500); await calls(p, "update", 1);
        // Leave the final A inside its debounce when the first A settles.
        await change(first);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await calls(p, "update", 2);
        expect(await current()).toBe(first);
        await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
        await p.clock.runFor(500); await calls(p, "update", 2);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await calls(p, "update", 3);
        expect(await p.evaluate((field) => window.pageRecovery.notes.a[field], field)).toBe(middle);
        expect(await current()).toBe(first);
        await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
        expect(await p.evaluate(() => window.pageRecovery.calls.map((call) => call.args))).toEqual([
          { noteId: "a", [field]: first },
          { noteId: "a", [field]: middle },
          { noteId: "a", [field]: first },
        ]);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await browserExpect.poll(() => p.evaluate((field) => window.pageRecovery.notes.a[field], field)).toBe(first);
        await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
        await p.clock.runFor(500); await calls(p, "update", 3);
      }, 30_000);
    }
    test("old-note failure cannot alter another note's current state", async () => {
      const p = await open();
      await mode(p, "update", "defer");
      await edit(p, "First note draft."); await calls(p, "update", 1);
      await p.evaluate(() => window.pageRecovery.show("b"));
      await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Another page");
      await p.evaluate(() => window.pageRecovery.settle("update", false));
      await browserExpect(notice(p, "save")).toHaveCount(0);
      expect(await p.evaluate(() => window.pageRecovery.body())).toContain("A different draft.");
      await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
    }, 30_000);
    for (const destination of ["b", null]) for (const firstSucceeds of [true, false]) {
      test(`queued outgoing draft survives ${destination === null ? "unmount" : "navigation"} after earlier save ${firstSucceeds ? "resolves" : "rejects"}`, async () => {
        const p = await open();
        await p.clock.install();
        await mode(p, "update", "defer");
        const untouched = await p.evaluate(() => window.pageRecovery.notes.b.body);
        await edit(p, "Earlier outgoing draft."); await p.clock.runFor(500); await calls(p, "update", 1);
        await edit(p, "Latest outgoing draft."); await p.clock.runFor(500); await calls(p, "update", 1);
        await p.evaluate((id) => window.pageRecovery.show(id), destination);
        if (destination === null) await browserExpect(p.locator(".cm-content")).toHaveCount(0);
        else await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Another page");
        await p.evaluate((success) => window.pageRecovery.settle("update", success), firstSucceeds);
        await calls(p, "update", 2);
        expect(await p.evaluate(() => window.pageRecovery.calls[1].args)).toEqual({ noteId: "a", body: "Latest outgoing draft." });
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await browserExpect.poll(() => p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Latest outgoing draft.");
        expect(await p.evaluate(() => window.pageRecovery.notes.b.body)).toBe(untouched);
        await browserExpect(notice(p, "save")).toHaveCount(0);
        if (destination !== null) {
          expect(await p.evaluate(() => window.pageRecovery.body())).toBe(untouched);
          await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
        }
      }, 30_000);
    }
    for (const destination of ["b", null]) {
      test(`pending debounce cleanup stays ordered on ${destination === null ? "unmount" : "navigation"}`, async () => {
        const p = await open();
        await p.clock.install();
        await mode(p, "update", "defer");
        await edit(p, "Earlier draft."); await p.clock.runFor(500); await calls(p, "update", 1);
        await edit(p, "Draft still inside its debounce.");
        await p.evaluate((id) => window.pageRecovery.show(id), destination);
        if (destination === null) await browserExpect(p.locator(".cm-content")).toHaveCount(0);
        else await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Another page");
        await calls(p, "update", 1);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await calls(p, "update", 2);
        expect(await p.evaluate(() => window.pageRecovery.calls[1].args)).toEqual({ noteId: "a", body: "Draft still inside its debounce." });
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await browserExpect.poll(() => p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Draft still inside its debounce.");
        await p.clock.runFor(500); await calls(p, "update", 2);
        await browserExpect(notice(p, "save")).toHaveCount(0);
      }, 30_000);
    }
    for (const firstSucceeds of [true, false]) {
      test(`reopened same-note writes follow outgoing writes after earlier save ${firstSucceeds ? "resolves" : "rejects"}`, async () => {
        const p = await open();
        await p.clock.install(); await mode(p, "update", "defer");
        await edit(p, "Outgoing first."); await p.clock.runFor(500); await calls(p, "update", 1);
        await edit(p, "Outgoing latest."); await p.clock.runFor(500); await calls(p, "update", 1);
        await p.evaluate(() => window.pageRecovery.show(null));
        await browserExpect(p.locator(".cm-content")).toHaveCount(0);
        await p.evaluate(() => window.pageRecovery.show("a"));
        await browserExpect(p.locator(".cm-content")).toBeVisible();
        await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Example page");
        await edit(p, "Reopened draft."); await p.clock.runFor(500); await calls(p, "update", 1);
        await p.evaluate((success) => window.pageRecovery.settle("update", success), firstSucceeds);
        await calls(p, "update", 2);
        expect(await p.evaluate(() => window.pageRecovery.calls[1].args.body)).toBe("Outgoing latest.");
        // A settled older request must not remove the queue entry for the newer owner.
        await edit(p, "Newest reopened draft."); await p.clock.runFor(500); await calls(p, "update", 2);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await calls(p, "update", 3);
        expect(await p.evaluate(() => window.pageRecovery.calls[2].args.body)).toBe("Reopened draft.");
        expect(await p.evaluate(() => window.pageRecovery.body())).toBe("Newest reopened draft.");
        await browserExpect(p.locator('[data-state="saved"]')).toHaveCount(0);
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await calls(p, "update", 4);
        expect(await p.evaluate(() => window.pageRecovery.calls[3].args.body)).toBe("Newest reopened draft.");
        await p.evaluate(() => window.pageRecovery.settle("update", true));
        await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
        expect(await p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Newest reopened draft.");
        await browserExpect(notice(p, "save")).toHaveCount(0);
      }, 30_000);
    }
    test("a pending outgoing note never blocks a distinct note's save", async () => {
      const p = await open();
      await p.clock.install(); await mode(p, "update", "defer");
      await edit(p, "Pending note A."); await p.clock.runFor(500); await calls(p, "update", 1);
      await p.evaluate(() => window.pageRecovery.show("b"));
      await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Another page");
      await edit(p, "Independent note B."); await p.clock.runFor(500); await calls(p, "update", 2);
      expect(await p.evaluate(() => window.pageRecovery.calls[1].args)).toEqual({ noteId: "b", body: "Independent note B." });
      await p.evaluate(() => { window.pageRecovery.settle("update", false); window.pageRecovery.settle("update", true); });
      await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
      expect(await p.evaluate(() => window.pageRecovery.notes.b.body)).toBe("Independent note B.");
      await browserExpect(notice(p, "save")).toHaveCount(0);
    }, 30_000);
    test("a clean reopened page's coach flush rejects its outgoing save failure", async () => {
      const p = await open();
      await p.clock.install(); await mode(p, "update", "defer");
      await edit(p, "Outgoing unsaved context."); await p.clock.runFor(500); await calls(p, "update", 1);
      await p.evaluate(() => window.pageRecovery.show(null));
      await browserExpect(p.locator(".cm-content")).toHaveCount(0);
      await p.evaluate(() => window.pageRecovery.show("a"));
      await browserExpect(p.locator(".cm-content")).toBeVisible();
      await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Example page");
      await p.locator("#flush").click();
      expect(await p.evaluate(() => window.pageRecovery.flushResult)).toBe("pending");
      await p.evaluate(() => window.pageRecovery.settle("update", false));
      await browserExpect.poll(() => p.evaluate(() => window.pageRecovery.flushResult)).toBe("rejected");
      await calls(p, "update", 1); await calls(p, "remove", 0);
    }, 30_000);
    test("a clean reopened page's confirmed deletion waits for its outgoing save", async () => {
      const p = await open();
      await p.clock.install(); await mode(p, "update", "defer");
      await edit(p, "Outgoing content before delete."); await p.clock.runFor(500); await calls(p, "update", 1);
      await p.evaluate(() => window.pageRecovery.show(null));
      await browserExpect(p.locator(".cm-content")).toHaveCount(0);
      await p.evaluate(() => window.pageRecovery.show("a"));
      await browserExpect(p.locator(".cm-content")).toBeVisible();
      await browserExpect(p.getByRole("textbox", { name: "Note title" })).toHaveValue("Example page");
      await confirmDelete(p); await calls(p, "remove", 0);
      await p.evaluate(() => window.pageRecovery.settle("update", true));
      await calls(p, "remove", 1);
      await browserExpect(p.locator(".kb64-toast")).toBeVisible();
      expect(await p.evaluate(() => window.pageRecovery.calls.map(call => call.kind))).toEqual(["update", "remove"]);
    }, 30_000);
    test("pin failure is caught and repeated pending clicks submit once", async () => {
      const p = await open();
      await mode(p, "togglePin", "defer");
      await p.getByRole("button", { name: "Pin", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await calls(p, "togglePin", 1);
      await p.evaluate(() => window.pageRecovery.settle("togglePin", false));
      await browserExpect(notice(p, "pin")).toBeVisible();
      await mode(p, "togglePin", "resolve");
      await notice(p, "pin").getByRole("button").click();
      await browserExpect(p.getByRole("button", { name: "Unpin", exact: true })).toBeVisible();
      await browserExpect(notice(p, "pin")).toHaveCount(0);
      await calls(p, "togglePin", 2);
    }, 30_000);
    test("failed dirty flush prevents deletion even after the old timer cleared", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      await edit(p, "Keep this draft.");
      await browserExpect(notice(p, "save")).toBeVisible();
      await confirmDelete(p);
      await browserExpect(notice(p, "delete")).toBeVisible();
      await calls(p, "update", 2); await calls(p, "remove", 0);
      expect(await p.evaluate(() => window.pageRecovery.body())).toBe("Keep this draft.");
      await browserExpect(p.getByRole("button", { name: "Confirm delete", exact: true })).toBeVisible();
    }, 30_000);
    test("failed removal preserves URL, editor and confirmation without an Undo receipt", async () => {
      const p = await open(); const before = p.url();
      await mode(p, "remove", "defer"); await confirmDelete(p);
      await p.getByRole("button", { name: "Confirm delete", exact: true }).click();
      await calls(p, "remove", 1);
      await p.evaluate(() => window.pageRecovery.settle("remove", false));
      await browserExpect(notice(p, "delete")).toBeVisible();
      expect(p.url()).toBe(before);
      await browserExpect(p.locator(".cm-content")).toBeVisible();
      await browserExpect(p.locator(".kb64-toast")).toHaveCount(0);
    }, 30_000);
    test("successful explicit deletion retry starts the unchanged Undo and restores", async () => {
      const p = await open();
      await mode(p, "remove", "reject"); await confirmDelete(p);
      await browserExpect(notice(p, "delete")).toBeVisible();
      await mode(p, "remove", "resolve"); await notice(p, "delete").getByRole("button").click();
      await browserExpect(p.locator(".kb64-toast")).toBeVisible();
      expect(new URL(p.url()).pathname).toBe("/notes");
      await p.locator(".kb64-toast").getByRole("button").click();
      await browserExpect(p.locator(".cm-content")).toBeVisible();
      expect(new URL(p.url()).pathname).toBe("/notes/a");
      await calls(p, "restore", 1);
    }, 30_000);
    test("cancelling confirmation during its dirty flush prevents a later remove", async () => {
      const p = await open();
      await mode(p, "update", "defer"); await edit(p, "Still editing.");
      await confirmDelete(p); await calls(p, "update", 1);
      await p.getByRole("button", { name: "Cancel", exact: true }).click();
      await p.evaluate(() => window.pageRecovery.settle("update", true));
      await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
      await calls(p, "remove", 0);
      await browserExpect(notice(p, "delete")).toHaveCount(0);
    }, 30_000);
    test("the real coach flush rejects failed persistence without any action request", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      const result = await p.evaluate(async () => {
        window.pageRecovery.body("Context not yet saved.");
        try { await window.pageRecovery.flush(); return "resolved"; } catch { return "rejected"; }
      });
      expect(result).toBe("rejected");
      await browserExpect(notice(p, "save")).toBeVisible();
      await calls(p, "update", 1);
      expect(await p.evaluate(() => window.pageRecovery.calls.map((call) => call.kind))).toEqual(["update"]);
    }, 30_000);
    test("coach flush joins an in-flight failure without silently retrying it", async () => {
      const p = await open();
      await mode(p, "update", "defer"); await edit(p, "An in-flight context.");
      await calls(p, "update", 1);
      await p.locator("#flush").click();
      await p.evaluate(() => window.pageRecovery.settle("update", false));
      await browserExpect.poll(() => p.evaluate(() => window.pageRecovery.flushResult)).toBe("rejected");
      await browserExpect(notice(p, "save")).toBeVisible();
      await calls(p, "update", 1);
    }, 30_000);
    test("pagehide rejection offers recovery and does not leave a duplicate timer", async () => {
      const p = await open();
      await p.clock.install();
      await mode(p, "update", "reject"); await edit(p, "Hidden-tab draft.");
      await p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await browserExpect(notice(p, "save")).toBeVisible();
      await mode(p, "update", "resolve"); await notice(p, "save").getByRole("button").click();
      await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
      await p.clock.runFor(1000);
      await calls(p, "update", 2);
      expect(await p.evaluate(() => window.pageRecovery.notes.a.body)).toBe("Hidden-tab draft.");
    }, 30_000);
    test("a hidden document exposes save failure and retains the editable body", async () => {
      const p = await open();
      await mode(p, "update", "reject");
      await p.evaluate(() => {
        window.pageRecovery.body("Visibility draft.");
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await browserExpect(notice(p, "save")).toBeVisible();
      expect(await p.evaluate(() => window.pageRecovery.body())).toBe("Visibility draft.");
      await calls(p, "update", 1);
    }, 30_000);
    for (const type of ["plain", "daily", "weekly", "project", "template"]) {
      test(`${type} page retains its exact Markdown through failed save and recovery`, async () => {
        const p = await open({ type });
        await mode(p, "update", "reject");
        const body = await p.evaluate(() => window.pageRecovery.body());
        const changed = `${body}\n\n## A new section\nA fictional paragraph.\n`;
        await edit(p, changed); await browserExpect(notice(p, "save")).toBeVisible();
        await mode(p, "update", "resolve"); await notice(p, "save").getByRole("button").click();
        await browserExpect(p.locator('[data-state="saved"]')).toBeVisible();
        expect(await p.evaluate(() => window.pageRecovery.body())).toBe(changed);
        expect(await p.evaluate(() => window.pageRecovery.notes.a.body)).toBe(changed);
        await browserExpect(p.locator("main")).toHaveCount(1);
        await browserExpect(p.locator("h1")).toHaveCount(1);
      }, 30_000);
    }
  }
  test(`${baseline ? "before" : "after"} EN/HE recovery screenshots at both widths and themes`, async () => {
    for (const lang of ["en", "he"]) for (const width of [390, 1280]) for (const theme of ["light", "dark"]) {
      const p = await open({ lang, width, theme });
      const original = await p.evaluate(() => window.pageRecovery.body());
      await mode(p, "update", "reject");
      await edit(p, `${original}\n\n${lang === "he" ? "טיוטה לדוגמה שנשארת כאן." : "A fictional draft stays here."}`);
      await calls(p, "update", 1);
      if (baseline) await browserExpect(p.locator('[data-state="saving"]')).toBeVisible();
      else {
        const retry = notice(p, "save").getByRole("button");
        await browserExpect(retry).toBeVisible();
        await retry.focus();
        await browserExpect(retry).toBeFocused();
        const box = await retry.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(await retry.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      }
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await p.evaluate(() => document.documentElement.dir)).toBe(lang === "he" ? "rtl" : "ltr");
      await p.screenshot({ path: join(evidence, `${baseline ? "before" : "after"}-${width}-${lang}-${theme}.png`), fullPage: true });
      if (!baseline) {
        await mode(p, "update", "resolve"); await p.keyboard.press("Enter");
        await browserExpect(notice(p, "save")).toHaveCount(0);
      }
      expect(errors).toEqual([]);
      await p.close(); page = undefined;
    }
  }, 90_000);
});
