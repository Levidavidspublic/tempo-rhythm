import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const childMode = process.env.KB76_FIXTURE_CHILD === "1";
const baseline = process.env.KB76_BASELINE === "1";
const names = baseline
  ? ["real ProjectDetail caller keeps B after A settles"]
  : [
      "current success closes once",
      "current rejection retains a reachable retry",
      "retry success closes without extending the deadline",
      "pointer retry remains clickable after countdown updates",
      "same-tick duplicate activation calls Undo once",
      "synchronous callback throw is a safe error",
      "resolution after replacement keeps the new toast",
      "a queued replacement survives success in the same browser task",
      "a queued same-id replacement survives success in the same browser task",
      "rejection after replacement leaves the new toast clean",
      "dismissal then replacement ignores the old resolution",
      "expiry during a pending request cannot close a later toast",
      "rejection after dismissal leaves a replacement clean",
      "rejection after expiry leaves a replacement clean",
      "activation at the deadline is rejected before the timer tick",
      "a toast without Undo has only dismissal",
      "replacement clears old busy and error feedback",
      "the callback receives no arguments",
      "StrictMode cleanup does not disable the current request",
      "same-id replacement ignores the previous request",
      "real ProjectDetail caller keeps B after A settles",
      "real ProjectDetail caller ignores A rejection after B",
      "English and Hebrew new dictionary keys and feedback match",
      "gallery controls drive the actual shared toast",
      "keyboard focus is visible and a late completion cannot steal it",
      "countdown changes stay out of live announcements",
      "real screen and gallery fit both widths languages and themes",
      "reduced motion stays below one millisecond",
      "all unrelated shared exports remain identical to the base",
    ];
type Results = Record<string, { pass: boolean; detail?: string }>;

const backend = `
import {useSyncExternalStore} from "react";
const listeners=new Set();let version=0;
const state={rows:[
 {_id:"maya",_creationTime:1,createdAt:1,updatedAt:1,projectId:"maya-project",projectName:"Maya / Dana / Yoni",title:"Plan with Maya",status:"todo"},
 {_id:"dana",_creationTime:2,createdAt:2,updatedAt:2,projectId:"maya-project",projectName:"Maya / Dana / Yoni",title:"Read with Dana",status:"todo"}
],calls:[],held:[],hold:[],callbackArgs:[],closeCalls:0,now:Date.now(),ticks:[],throws:[],rejects:[]};
Date.now=()=>state.now;
const realInterval=window.setInterval.bind(window),realClear=window.clearInterval.bind(window);
window.setInterval=(fn,ms,...args)=>{if(ms!==1000)return realInterval(fn,ms,...args);const id=realInterval(()=>{},2147483647);state.ticks.push({id,fn});return id};
window.clearInterval=id=>{state.ticks=state.ticks.filter(t=>t.id!==id);realClear(id)};
function emit(){version++;for(const fn of listeners)fn()}
const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
window.__kb76={state,advance(ms,tick=true){state.now+=ms;if(tick)for(const t of [...state.ticks])t.fn()},
 settle(label,ok){const index=state.held.findIndex(item=>item.label===label);if(index<0)throw Error("No pending request: "+label);const [item]=state.held.splice(index,1);if(ok)item.resolve();else item.reject(Error("FICTIONAL_RAW_ERROR"))},
 invoke(label,args){state.callbackArgs.push(args);if(state.throws.includes(label))throw Error("FICTIONAL_RAW_ERROR");if(state.rejects.includes(label))return Promise.reject(Error("FICTIONAL_RAW_ERROR"));return new Promise((resolve,reject)=>state.held.push({label,resolve,reject}))}};
export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}}
export function useQuery(ref,args){useSyncExternalStore(subscribe,()=>version,()=>version);if(args==="skip")return undefined;return ref==="tasks.list"?state.rows:{_id:"fictional-user"}}
export function useMutation(ref){const run=async args=>{state.calls.push({ref,args});if(ref==="tasks.toggleCompletion"){
 state.rows=state.rows.map(row=>row._id===args.taskId?{...row,status:row.status==="done"?"todo":"done"}:row);emit();return args.taskId}
 if(ref==="tasks.update"){
  if(state.hold.includes(args.taskId))await new Promise((resolve,reject)=>state.held.push({label:args.taskId,resolve,reject}));
  state.rows=state.rows.map(row=>row._id===args.taskId?{...row,...args}:row);emit();return args.taskId}
 if(ref==="tasks.remove")return {success:true,undoUntilMs:Date.now()+300000};return null};run.withOptimisticUpdate=()=>run;return run}
`;
const api = `export const api={users:{getProfile:"users.getProfile"},tasks:{list:"tasks.list",create:"tasks.create",remove:"tasks.remove",update:"tasks.update",renameProject:"tasks.renameProject",toggleCompletion:"tasks.toggleCompletion"}};`;
const entry = (phase: "before" | "current") => `
import React,{StrictMode,useEffect,useState} from "react";import{createRoot}from"react-dom/client";
import{LocaleProvider}from"@/components/providers/LocaleProvider";
import{TpIconSprite}from"@/components/tempo/TpIcon";
import{ProjectDetailScreen}from"@/components/projects/ProjectDetailScreen";
import * as Shared from "@/components/goals/shared";
const params=new URLSearchParams(location.search),control=window.__kb76;
let nextId=10;
function create(label,options={}){return{id:options.sameId?7:nextId++,title:options.long?label+" "+"Maya / דנה / Yoni ".repeat(50):"Change "+label,
 undoUntilMs:Date.now()+(options.deadline??300000),onUndo:options.noUndo?undefined:(...args)=>control.invoke(label,args)}}
function Harness(){const[toast,setToast]=useState(()=>create("A",{sameId:params.has("sameId"),noUndo:params.has("noUndo"),deadline:params.has("deadline")?0:300000}));
 useEffect(()=>{Object.assign(control,{replace(label,options={}){setToast(create(label,options))},dismiss(){setToast(null)},ready:true})},[]);
 return <main><h1>Shared Undo fixture</h1><button id="reader-action">Reader action</button>{toast?<Shared.UndoToast key={toast.id} toast={toast} onClose={()=>{control.state.closeCalls++;setToast(null)}}/>:null}</main>}
function Screen(){useEffect(()=>{control.ready=true},[]);return <main className="tp-page tp-page--narrow"><ProjectDetailScreen projectSlug="maya-project"/></main>}
const mode=params.get("mode"),content=mode==="screen"?<Screen/>:mode==="gallery"?${phase === "current" && !baseline ? "<Shared.Kb76Gallery/>" : "<Harness/>"}:<Harness/>;
createRoot(document.getElementById("app")).render(<StrictMode><LocaleProvider><TpIconSprite/>{content}</LocaleProvider></StrictMode>);
`;

async function runFixture(): Promise<Results> {
  const { chromium, expect: pw } = await import("@playwright/test");
  const web = join(repo, "apps/web");
  const require = createRequire(join(web, "package.json"));
  const postcss = require("postcss");
  const tailwind = require("@tailwindcss/postcss");
  const dir = join(repo, "work/kb76-fixture");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "backend.ts"), backend);
  writeFileSync(join(dir, "api.ts"), api);
  const globalsPath = join(web, "app/globals.css");
  const baseCss = (
    await postcss([tailwind({ base: repo })]).process(readFileSync(globalsPath, "utf8"), {
      from: globalsPath,
    })
  ).css;
  const frozen = process.env.KB76_FROZEN_SOURCE || join(repo, "work/kb76-shared.before.tsx");
  const build = async (phase: "before" | "current") => {
    const source = join(dir, `${phase}.tsx`);
    writeFileSync(source, entry(phase));
    const output = await Bun.build({
      entrypoints: [source],
      outdir: dir,
      target: "browser",
      define: { "process.env.NODE_ENV": '"development"' },
      plugins: [
        {
          name: "kb76-fictional-boundaries",
          setup(b) {
            b.onResolve(
              { filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ },
              ({ path }) => ({ path: Bun.resolveSync(path, web) })
            );
            b.onResolve({ filter: /^convex\/react$/ }, () => ({ path: join(dir, "backend.ts") }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "kb76" }));
            b.onLoad({ filter: /.*/, namespace: "kb76" }, () => ({
              contents:
                'import React from "react";export default function Link({children,href,...rest}){return <a href={href} {...rest}>{children}</a>}',
              loader: "tsx",
              resolveDir: web,
            }));
            b.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
              path: join(dir, "api.ts"),
            }));
            b.onResolve({ filter: /^@\/components\/goals\/shared$/ }, () => ({
              path: phase === "before" ? frozen : join(web, "components/goals/shared.tsx"),
            }));
            b.onResolve({ filter: /^@\// }, ({ path }) => ({ path: Bun.resolveSync(path, web) }));
          },
        },
      ],
    });
    if (!output.success) throw Error(output.logs.map(String).join("\n"));
    return {
      js: await output.outputs.find((item) => item.path.endsWith(".js"))!.text(),
      css: (
        await Promise.all(
          output.outputs.filter((item) => item.path.endsWith(".css")).map((item) => item.text())
        )
      ).join("\n"),
    };
  };
  const current = await build("current");
  const before = existsSync(frozen) ? await build("before") : current;
  if (process.env.KB76_BUNDLE_ONLY === "1")
    return { bundle: { pass: Boolean(current.js && before.js && baseCss) } };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      const phase = url.searchParams.get("phase") === "before" ? "before" : "current";
      if (url.pathname === "/entry.js")
        return new Response(phase === "before" ? before.js : current.js, {
          headers: { "content-type": "text/javascript" },
        });
      if (url.pathname === "/styles.css")
        return new Response(baseCss + "\n" + (phase === "before" ? before.css : current.css), {
          headers: { "content-type": "text/css" },
        });
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      return new Response(
        `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css?phase=${phase}"><title>KB-76 shared Undo fixture</title></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"development"}}</script><script type="module" src="/entry.js?phase=${phase}"></script></body></html>`,
        { headers: { "content-type": "text/html" } }
      );
    },
  });
  const executablePath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
  if (!executablePath) throw Error("KB76 requires an installed Chromium browser");
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const results: Results = {};
  const errors: string[] = [];
  const open = async (
    mode = "direct",
    phase = "current",
    width = 390,
    lang = "en",
    theme = "light",
    extra = ""
  ) => {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${server.port}/?mode=${mode}&phase=${phase}&lang=${lang}&${extra}`
    );
    await page.locator("h1").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction((target) => document.documentElement.lang === target, lang);
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement).getPropertyValue("--tp-touch").trim() === "44px"
    );
    await page.waitForFunction(
      (value) =>
        getComputedStyle(document.body).backgroundColor ===
        (value === "dark" ? "rgb(22, 20, 18)" : "rgb(243, 238, 228)"),
      theme
    );
    return page;
  };
  const control = (page: any, source: string) =>
    page.evaluate((code: string) => Function("c", code)((window as any).__kb76), source);
  const toast = (page: any) => page.locator('[data-component="UndoToast"]');
  const undo = (page: any) => toast(page).locator("button").first();
  const dismiss = (page: any) => toast(page).locator("button").last();
  const settle = (page: any, label = "A", ok = true) =>
    control(page, `c.settle(${JSON.stringify(label)},${ok})`);
  const replace = async (page: any, label: string, options: { sameId?: boolean } = {}) => {
    await control(page, `c.replace(${JSON.stringify(label)},${JSON.stringify(options)})`);
    // A queued parent update is not a replacement until React commits it.
    // Observe the new title before completing the previous mounted request.
    await pw(toast(page)).toContainText(`Change ${label}`);
  };
  const check = async (name: string, fn: () => Promise<void>) => {
    if (!names.includes(name)) return;
    try {
      await fn();
      results[name] = { pass: true };
    } catch (error) {
      results[name] = { pass: false, detail: String(error) };
    }
    writeFileSync(join(dir, "progress.json"), JSON.stringify(results, null, 2));
  };
  const capture = async (page: any, name: string) => {
    const output = process.env.KB76_EVIDENCE_DIR;
    if (!output) return;
    mkdirSync(output, { recursive: true });
    await page.screenshot({ path: join(output, name), fullPage: true, animations: "disabled" });
  };
  const callerAB = async (page: any) => {
    await control(page, 'c.state.hold.push("maya")');
    await page.getByRole("checkbox", { name: "Plan with Maya", exact: true }).click();
    await pw(toast(page)).toBeVisible();
    await undo(page).click();
    await control(page, "c.advance(1,false)");
    await page.getByRole("checkbox", { name: "Read with Dana", exact: true }).click();
    await pw(undo(page)).toBeEnabled();
  };
  try {
    await check("current success closes once", async () => {
      const p = await open();
      await undo(p).click();
      await settle(p);
      await pw(toast(p)).toHaveCount(0);
      pw(await control(p, "return c.state.closeCalls")).toBe(1);
      await p.close();
    });
    await check("current rejection retains a reachable retry", async () => {
      const p = await open();
      await undo(p).click();
      await settle(p, "A", false);
      await pw(toast(p).getByRole("alert")).toBeVisible();
      await pw(undo(p)).toBeEnabled();
      pw(await p.locator("body").innerText()).not.toContain("FICTIONAL_RAW_ERROR");
      await p.close();
    });
    await check("retry success closes without extending the deadline", async () => {
      const p = await open();
      await undo(p).click();
      await settle(p, "A", false);
      await control(p, "c.advance(5000)");
      await pw(toast(p)).toContainText("4:55");
      await pw(undo(p)).toBeEnabled();
      await undo(p).focus();
      await p.keyboard.press("Enter");
      await pw.poll(() => control(p, "return c.state.callbackArgs.length")).toBe(2);
      await settle(p);
      await pw(toast(p)).toHaveCount(0);
      await p.close();
    });
    await check("pointer retry remains clickable after countdown updates", async () => {
      const p = await open();
      const context = p.context();
      const trace = Boolean(process.env.KB76_EVIDENCE_DIR);
      if (trace) await context.tracing.start({ screenshots: true, snapshots: true });
      try {
        await undo(p).click();
        await settle(p, "A", false);
        await pw(undo(p)).toBeEnabled();
        await control(p, "c.advance(5000)");
        await pw(toast(p)).toContainText("4:55");
        const hit = await undo(p).evaluate((el: Element) => {
          const box = el.getBoundingClientRect();
          const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return {
            width: box.width,
            height: box.height,
            ownsHit: el === target || el.contains(target),
          };
        });
        pw(hit.ownsHit).toBe(true);
        pw(hit.width >= 44 && hit.height >= 44).toBe(true);
        await undo(p).click();
        await pw.poll(() => control(p, "return c.state.callbackArgs.length")).toBe(2);
        await settle(p);
        await pw(toast(p)).toHaveCount(0);
      } catch (error) {
        await p.screenshot({ path: join(dir, "pointer-retry-failure.png"), fullPage: true });
        throw error;
      } finally {
        if (trace) await context.tracing.stop({ path: join(dir, "pointer-retry-trace.zip") });
        await p.close();
      }
    });
    await check("same-tick duplicate activation calls Undo once", async () => {
      const p = await open();
      await undo(p).evaluate((el: any) => {
        el.click();
        el.click();
      });
      pw(await control(p, "return c.state.callbackArgs.length")).toBe(1);
      await p.close();
    });
    await check("synchronous callback throw is a safe error", async () => {
      const p = await open();
      await control(p, 'c.state.throws.push("A")');
      await undo(p).click();
      await pw(toast(p).getByRole("alert")).toBeVisible();
      await pw(undo(p)).toBeEnabled();
      await p.close();
    });
    await check("resolution after replacement keeps the new toast", async () => {
      const p = await open();
      await undo(p).click();
      await replace(p, "B");
      await settle(p);
      await pw(toast(p)).toContainText("Change B");
      await pw(undo(p)).toBeEnabled();
      await p.close();
    });
    await check("rejection after replacement leaves the new toast clean", async () => {
      const p = await open();
      await undo(p).click();
      await replace(p, "B");
      await settle(p, "A", false);
      await pw(toast(p)).toContainText("Change B");
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await p.close();
    });
    for (const sameId of [false, true]) {
      await check(
        sameId
          ? "a queued same-id replacement survives success in the same browser task"
          : "a queued replacement survives success in the same browser task",
        async () => {
          const p = await open("direct", "current", 390, "en", "light", sameId ? "sameId" : "");
          await undo(p).click();
          // Deliberately settle before React can commit the queued parent update.
          await control(p, `c.replace("B",{sameId:${sameId}});c.settle("A",true)`);
          await pw(toast(p)).toContainText("Change B");
          await pw(undo(p)).toBeEnabled();
          pw(await control(p, "return c.state.closeCalls")).toBe(0);
          await undo(p).click();
          await settle(p, "B");
          await pw(toast(p)).toHaveCount(0);
          pw(await control(p, "return c.state.closeCalls")).toBe(1);
          await p.close();
        }
      );
    }
    await check("dismissal then replacement ignores the old resolution", async () => {
      const p = await open();
      await undo(p).click();
      await dismiss(p).click();
      await replace(p, "B");
      await settle(p);
      await pw(toast(p)).toContainText("Change B");
      await p.close();
    });
    await check("expiry during a pending request cannot close a later toast", async () => {
      const p = await open();
      await undo(p).click();
      await control(p, "c.advance(300000)");
      await pw(toast(p)).toHaveCount(0);
      await replace(p, "B");
      await settle(p);
      await pw(toast(p)).toContainText("Change B");
      await p.close();
    });
    await check("rejection after dismissal leaves a replacement clean", async () => {
      const p = await open();
      await undo(p).click();
      await dismiss(p).click();
      await replace(p, "B");
      await settle(p, "A", false);
      await pw(toast(p)).toContainText("Change B");
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await p.close();
    });
    await check("rejection after expiry leaves a replacement clean", async () => {
      const p = await open();
      await undo(p).click();
      await control(p, "c.advance(300000)");
      await pw(toast(p)).toHaveCount(0);
      await replace(p, "B");
      await settle(p, "A", false);
      await pw(toast(p)).toContainText("Change B");
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await p.close();
    });
    await check("activation at the deadline is rejected before the timer tick", async () => {
      const p = await open();
      await control(p, "c.advance(300000,false)");
      await undo(p).evaluate((el: any) => el.click());
      pw(await control(p, "return c.state.callbackArgs.length")).toBe(0);
      await p.close();
    });
    await check("a toast without Undo has only dismissal", async () => {
      const p = await open("direct", "current", 390, "en", "light", "noUndo");
      await pw(toast(p).locator("button")).toHaveCount(1);
      await dismiss(p).click();
      await pw(toast(p)).toHaveCount(0);
      await p.close();
    });
    await check("replacement clears old busy and error feedback", async () => {
      const p = await open();
      await undo(p).click();
      await settle(p, "A", false);
      await pw(toast(p).getByRole("alert")).toBeVisible();
      await replace(p, "B", { sameId: true });
      await pw(undo(p)).toBeEnabled();
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await undo(p).click();
      await replace(p, "C", { sameId: true });
      await pw(undo(p)).toBeEnabled();
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await p.close();
    });
    await check("the callback receives no arguments", async () => {
      const p = await open();
      await undo(p).click();
      pw(await control(p, "return c.state.callbackArgs")).toEqual([[]]);
      await p.close();
    });
    await check("StrictMode cleanup does not disable the current request", async () => {
      const p = await open();
      await undo(p).click();
      await settle(p);
      await pw(toast(p)).toHaveCount(0);
      await p.close();
    });
    await check("same-id replacement ignores the previous request", async () => {
      const p = await open("direct", "current", 390, "en", "light", "sameId");
      await undo(p).click();
      await replace(p, "B", { sameId: true });
      await pw(undo(p)).toBeEnabled();
      await settle(p);
      await pw(toast(p)).toContainText("Change B");
      await p.close();
    });
    await check("real ProjectDetail caller keeps B after A settles", async () => {
      const p = await open("screen", baseline ? "before" : "current");
      await callerAB(p);
      await capture(
        p,
        baseline ? "baseline-B-before-A-resolves.png" : "current-B-before-A-resolves.png"
      );
      await settle(p, "maya");
      await capture(
        p,
        baseline ? "baseline-B-after-A-resolves.png" : "current-B-after-A-resolves.png"
      );
      await pw(toast(p)).toHaveCount(1);
      await undo(p).click();
      pw(
        await control(
          p,
          'return c.state.calls.filter(call=>call.ref==="tasks.update").map(call=>call.args)'
        )
      ).toEqual([
        { taskId: "maya", status: "todo" },
        { taskId: "dana", status: "todo" },
      ]);
      await p.close();
    });
    await check("real ProjectDetail caller ignores A rejection after B", async () => {
      const p = await open("screen");
      await callerAB(p);
      await settle(p, "maya", false);
      await pw(toast(p)).toHaveCount(1);
      await pw(toast(p).getByRole("alert")).toHaveCount(0);
      await p.close();
    });
    await check("English and Hebrew new dictionary keys and feedback match", async () => {
      const text = await import("../../apps/web/lib/i18n-groups/kb-76");
      pw(Object.keys(text.en).sort()).toEqual(Object.keys(text.he).sort());
      for (const lang of ["en", "he"] as const) {
        const p = await open("direct", "current", 390, lang);
        await undo(p).click();
        await pw(toast(p)).toContainText(text.tKb76(lang, "kb76.pending"));
        await settle(p, "A", false);
        await pw(toast(p).getByRole("alert")).toHaveText(text.tKb76(lang, "kb76.error"));
        await p.close();
      }
    });
    await check("gallery controls drive the actual shared toast", async () => {
      const p = await open("gallery");
      await p.getByRole("button", { name: "Show Maya’s change", exact: true }).click();
      await undo(p).click();
      await p.getByRole("button", { name: "Show Dana’s change", exact: true }).click();
      await p.getByRole("button", { name: "Complete oldest request", exact: true }).click();
      await pw(toast(p)).toContainText("Dana");
      await undo(p).click();
      await p.getByRole("button", { name: "Reject oldest request", exact: true }).click();
      await pw(toast(p).getByRole("alert")).toBeVisible();
      await p.close();
    });
    await check("keyboard focus is visible and a late completion cannot steal it", async () => {
      const p = await open();
      await p.locator("#reader-action").focus();
      await p.keyboard.press("Tab");
      const style = await undo(p).evaluate((el: any) => {
        const s = getComputedStyle(el);
        return {
          focus: el === document.activeElement && el.matches(":focus-visible"),
          visible:
            (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none",
        };
      });
      pw(style).toEqual({ focus: true, visible: true });
      await p.keyboard.press("Enter");
      await replace(p, "B");
      await p.locator("#reader-action").focus();
      await settle(p);
      await pw(p.locator("#reader-action")).toBeFocused();
      await pw(toast(p)).toContainText("Change B");
      await p.close();
    });
    await check("countdown changes stay out of live announcements", async () => {
      const p = await open();
      await control(p, "c.advance(1000)");
      await pw(toast(p).locator('[aria-hidden="true"]').filter({ hasText: "4:59" })).toHaveCount(1);
      await pw(toast(p).locator(".tp-sr-only")).toHaveText("5:00");
      await p.close();
    });
    await check("real screen and gallery fit both widths languages and themes", async () => {
      for (const width of [390, 1280])
        for (const lang of ["en", "he"])
          for (const theme of ["light", "dark"])
            for (const mode of ["screen", "gallery"]) {
              const p = await open(mode, "current", width, lang, theme);
              if (mode === "screen") {
                await callerAB(p);
                await settle(p, "maya");
              } else {
                await p.locator('[data-gallery-action="long"]').click();
              }
              await pw(toast(p)).toBeVisible();
              pw(await p.locator("main").count()).toBe(1);
              pw(await p.locator("h1").count()).toBe(1);
              pw(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
                true
              );
              pw(await p.locator("html").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
              pw(
                await toast(p)
                  .locator("button")
                  .evaluateAll((nodes: Element[]) =>
                    nodes.every((el) => {
                      const box = el.getBoundingClientRect();
                      return box.height >= 44 && box.width >= 44;
                    })
                  )
              ).toBe(true);
              await capture(p, `${mode}-${width}-${lang}-${theme}.png`);
              await p.close();
            }
    });
    await check("reduced motion stays below one millisecond", async () => {
      const p = await open();
      const durations = await toast(p).evaluate((el: Element) => {
        const s = getComputedStyle(el);
        return [s.animationDuration, s.transitionDuration].flatMap((list) =>
          list
            .split(",")
            .map((x) => (x.trim().endsWith("ms") ? parseFloat(x) / 1000 : parseFloat(x)))
        );
      });
      pw(Math.max(...durations)).toBeLessThanOrEqual(0.001);
      await p.close();
    });
    await check("all unrelated shared exports remain identical to the base", async () => {
      const { createHash } = await import("node:crypto");
      const currentSource = readFileSync(join(web, "components/goals/shared.tsx"), "utf8");
      const hash = (text: string) => createHash("sha256").update(text).digest("hex");
      pw(
        hash(
          currentSource.slice(
            currentSource.indexOf("/** Dev-only"),
            currentSource.indexOf("export function UndoToast")
          )
        )
      ).toBe("42426ad59b04d869e25ba8b4e432610d40e061febb87d8400304b02b30e5e906");
      pw(hash(currentSource.slice(currentSource.indexOf("/* Inline add row")))).toBe(
        "4e4d527765f65738c8ab32d8b381856252dbb19848f46581ed5ff2a088ddefb4"
      );
    });
    if (process.env.KB76_CAPTURE_BEFORE === "1" && process.env.KB76_EVIDENCE_DIR) {
      for (const width of [390, 1280])
        for (const lang of ["en", "he"])
          for (const theme of ["light", "dark"]) {
            const p = await open("screen", "before", width, lang, theme);
            await callerAB(p);
            await settle(p, "maya");
            await capture(p, `before-screen-${width}-${lang}-${theme}.png`);
            await p.close();
            const direct = await open("direct", "before", width, lang, theme);
            await capture(direct, `before-toast-${width}-${lang}-${theme}.png`);
            await direct.close();
          }
    }
    if (errors.length)
      results[names[0]] = { pass: false, detail: "Browser errors: " + errors.join(" | ") };
    return results;
  } finally {
    await browser.close();
    server.stop(true);
  }
}

if (childMode) {
  const result = await runFixture();
  writeFileSync(process.env.KB76_RESULTS!, JSON.stringify(result, null, 2));
} else {
  const { beforeAll, test, expect } = await import("bun:test");
  let results: Results;
  beforeAll(async () => {
    const dir = join(repo, "work");
    mkdirSync(dir, { recursive: true });
    const output = join(dir, "kb76-results.json");
    const child = Bun.spawn([process.execPath, import.meta.path], {
      cwd: repo,
      env: { ...process.env, KB76_FIXTURE_CHILD: "1", KB76_RESULTS: output },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = new Response(child.stdout).text();
    const stderr = new Response(child.stderr).text();
    const exit = await child.exited;
    const logs = await Promise.all([stdout, stderr]);
    if (exit !== 0) throw Error(`KB76 browser child exit ${exit}:\n${logs.join("\n")}`);
    results = JSON.parse(readFileSync(output, "utf8"));
    for (const [name, result] of Object.entries(results))
      if (!result.pass) console.error(name, result.detail);
  }, 360_000);
  for (const name of names)
    test(`KB-76: ${name}`, () => {
      expect(results[name], name).toBeDefined();
      expect(results[name].detail || "").toBe("");
      expect(results[name].pass).toBe(true);
    });
}
