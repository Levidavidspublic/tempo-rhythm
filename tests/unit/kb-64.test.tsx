import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

const repo = process.cwd();
const web = join(repo, "apps/web");
const original = process.env.KB64_ORIGINAL === "1";
const childMode = process.env.KB64_CHILD === "1";

async function serveFixture() {
  const dir = process.env.KB64_DIR;
  if (!dir) throw new Error("KB64_DIR is required");
  symlinkSync(join(web, "node_modules"), join(dir, "node_modules"), "dir");
  const host = original
    ? join(repo, "work/before/UndoDeleteToast.tsx")
    : join(web, "components/notes/UndoDeleteToast.tsx");
  writeFileSync(
    join(dir, "entry.tsx"),
    `
import React from "${web}/node_modules/react";
import {createRoot} from "${web}/node_modules/react-dom/client";
import {NotesScreen} from "${web}/components/notes/NotesScreen.tsx";
import {UndoDeleteToast${original ? "" : ",Kb64Gallery"}} from "${host}";
const params=new URLSearchParams(location.search);
const data=window.__kb64={calls:0,expires:0,mode:"defer",pending:null,removed:false,note:{_id:"maya-note",_creationTime:1,userId:"maya",title:"Maya’s reading list",body:"A few pages to read with Dana and Yoni.",pinned:false,createdAt:1,updatedAt:1},notes:null};
data.notes=[data.note];
data.signal=()=>window.dispatchEvent(new Event("kb64:data"));
data.undo=()=>{data.calls++;if(data.mode==="sync")throw new Error("PRIVATE_BACKEND_DETAIL");if(data.mode==="jumpFulfill"){const now=Date.now();Date.now=()=>now+30001;return Promise.resolve()}if(data.mode==="fulfill")return Promise.resolve();return new Promise((resolve,reject)=>{data.pending={resolve,reject}})};
data.reject=()=>{data.pending.reject(new Error("PRIVATE_BACKEND_DETAIL"));data.pending=null};
data.fulfill=(success=true)=>{if(success){data.removed=false;data.signal()}data.pending.resolve({success});data.pending=null};
function Direct(){const [deadline,setDeadline]=React.useState(()=>Date.now()+30000);const [shown,setShown]=React.useState(true);const [,render]=React.useState(0);data.deadline=deadline;data.changeDeadline=ms=>setDeadline(Date.now()+ms);data.unmount=()=>setShown(false);data.renderAgain=()=>render(n=>n+1);return <main><h1>Maya’s reading list</h1><button id="outside" type="button">Read another note</button>{shown&&<UndoDeleteToast undoUntilMs={deadline} onUndo={()=>data.undo()} onExpire={()=>{data.expires++}}/>}</main>}
const caller=params.get("caller");
createRoot(document.getElementById("root")).render(<React.StrictMode>{${original ? "false" : 'params.has("gallery")'}?${original ? "null" : "<Kb64Gallery/>"}:caller?<main><NotesScreen noteId={caller==="page"?"maya-note":undefined}/></main>:<Direct/>}</React.StrictMode>);
`
  );
  const stubs: Record<string, string> = {
    "convex/react": `import React from "${web}/node_modules/react";export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export function useQuery(ref,args){const key=String(ref);const d=window.__kb64;const removed=React.useSyncExternalStore(fn=>{window.addEventListener("kb64:data",fn);return()=>window.removeEventListener("kb64:data",fn)},()=>d.removed,()=>false);if(args==="skip")return undefined;if(key.includes("getProfile"))return {_id:"maya",greetingName:"Maya"};if(key.includes("notes.list"))return removed?[]:d.notes;if(key.includes("notes.getSafe"))return d.note;return []}export const useMutation=ref=>{const key=String(ref);return args=>{const d=window.__kb64;if(key.includes("notes.remove")){d.removed=true;d.signal();return Promise.resolve({success:true,undoUntilMs:Date.now()+30000})}if(key.includes("notes.restore")){d.lastRestoreArgs=args;return d.undo()}return Promise.resolve({success:true})}};export const useConvex=()=>({query:async()=>[]});export const useAction=()=>async()=>null;`,
    "next/navigation": `export const useRouter=()=>({push(){},replace(){},refresh(){}});export const usePathname=()=>"/notes";export const useSearchParams=()=>new URLSearchParams();`,
    "next/link": `import React from "${web}/node_modules/react";export default function Link({href,children,...props}){return React.createElement("a",{href,...props},children)}`,
    "@/components/providers/LocaleProvider": `import React from "${web}/node_modules/react";import {translate} from "${web}/lib/i18n.ts";export function useLocale(){const lang=React.useSyncExternalStore(fn=>{window.addEventListener("kb64:locale",fn);return()=>window.removeEventListener("kb64:locale",fn)},()=>document.documentElement.lang==="he"?"he":"en",()=>"en");return {lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key),setLang(next){document.documentElement.lang=next;document.documentElement.dir=next==="he"?"rtl":"ltr";window.dispatchEvent(new Event("kb64:locale"))}}}`,
    "@/convex/_generated/api": `const node=(path="api")=>new Proxy({},{get(_,key){if(key===Symbol.toPrimitive)return()=>path;if(key==="toString")return()=>path;return node(path+"."+String(key))}});export const api=node();`,
  };
  const result = await Bun.build({
    entrypoints: [join(dir, "entry.tsx")],
    outdir: dir,
    target: "browser",
    plugins: [
      {
        name: "kb64-fictional-boundaries",
        setup(build) {
          build.onResolve({ filter: /UndoDeleteToast$/ }, () => ({ path: host }));
          build.onResolve({ filter: /^(@\/|convex\/react$|next\/(navigation|link)$)/ }, (args) => {
            if (args.path in stubs) return { path: args.path, namespace: "kb64" };
            if (args.path.startsWith("@/")) {
              const base = resolve(web, args.path.slice(2));
              const path = [
                base,
                `${base}.ts`,
                `${base}.tsx`,
                `${base}.js`,
                join(base, "index.ts"),
                join(base, "index.tsx"),
              ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
              if (!path) throw new Error(`KB64 import not found: ${args.path}`);
              return { path };
            }
          });
          build.onLoad({ filter: /.*/, namespace: "kb64" }, (args) => ({
            contents: stubs[args.path],
            loader: "tsx",
            resolveDir: web,
          }));
        },
      },
    ],
  });
  if (!result.success) throw new Error(result.logs.map(String).join("\n"));
  for (const output of result.outputs)
    writeFileSync(join(dir, basename(output.path)), await output.arrayBuffer());
  const files = result.outputs.map((output) => basename(output.path));
  const postcss = (await import(join(web, "node_modules/postcss/lib/postcss.mjs"))).default;
  const tailwind = (await import(join(web, "node_modules/@tailwindcss/postcss/dist/index.mjs")))
    .default;
  const globalSource = join(web, "app/globals.css");
  const css = (
    await postcss([tailwind({ base: repo })]).process(readFileSync(globalSource, "utf8"), {
      from: globalSource,
    })
  ).css;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/") {
        const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
        const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
        return new Response(
          `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><title>Note Undo fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${files
            .filter((file) => file.endsWith(".css"))
            .map((file) => `<link rel="stylesheet" href="/${file}">`)
            .join(
              ""
            )}</head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};window.__rejections=[];window.addEventListener("unhandledrejection",e=>window.__rejections.push(String(e.reason)));</script><script type="module" src="/entry.js"></script></body></html>`,
          { headers: { "content-type": "text/html" } }
        );
      }
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
      if (url.pathname === "/globals.css")
        return new Response(css, { headers: { "content-type": "text/css" } });
      const name = url.pathname.slice(1);
      if (!files.includes(name)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(join(dir, name)), {
        headers: { "content-type": name.endsWith(".css") ? "text/css" : "text/javascript" },
      });
    },
  });
  writeFileSync(join(dir, "port"), String(server.port));
}

if (childMode) await serveFixture();

if (!childMode) {
  let browser: Browser;
  let child: ReturnType<typeof Bun.spawn>;
  let dir: string;
  let origin: string;
  const errors: string[] = [];
  async function open(params = "", width = 390) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("KB64 pageerror", error.message);
    });
    await page.clock.install({ time: 1_800_000_000_000 });
    await page.goto(`${origin}/?${params}`, { waitUntil: "load" });
    await page.locator("h1").waitFor();
    return page;
  }
  async function remove(page: Page, caller: "list" | "page" = "list") {
    if (caller === "page") {
      await page.getByRole("button", { name: /Page options|אפשרויות דף/ }).click();
      await page.getByRole("menuitem", { name: /Delete|מחיק/ }).click();
      await page.getByRole("button", { name: /Confirm delete|אישור מחיקה/, exact: true }).click();
    } else {
      await page.locator("li button").last().click();
      await page
        .locator("li button")
        .filter({ hasText: /Confirm delete|אישור מחיקה/ })
        .last()
        .click();
    }
    await page.locator("output").waitFor();
  }
  async function capture(page: Page, name: string) {
    if (!process.env.KB64_EVIDENCE_DIR) return;
    mkdirSync(process.env.KB64_EVIDENCE_DIR, { recursive: true });
    await page.screenshot({
      path: join(process.env.KB64_EVIDENCE_DIR, name),
      fullPage: true,
      animations: "disabled",
    });
  }
  beforeAll(async () => {
    mkdirSync(join(repo, "work"), { recursive: true });
    dir = mkdtempSync(join(repo, "work/kb64-fixture-"));
    child = Bun.spawn([process.execPath, resolve(repo, "tests/unit/kb-64.test.tsx")], {
      cwd: repo,
      env: { ...process.env, KB64_CHILD: "1", KB64_DIR: dir },
      stdout: "ignore",
      stderr: "inherit",
    });
    let exited = false;
    void child.exited.then(() => {
      exited = true;
    });
    for (let n = 0; n < 900 && !existsSync(join(dir, "port")) && !exited; n++) await Bun.sleep(100);
    if (!existsSync(join(dir, "port")))
      throw new Error(`KB64 fixture failed to start (child exited=${exited})`);
    origin = `http://127.0.0.1:${readFileSync(join(dir, "port"), "utf8")}`;
    const executablePath = [
      chromium.executablePath(),
      "/usr/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    ].find(existsSync);
    if (!executablePath)
      throw new Error("No installed Chromium or Google Chrome is available for the KB64 fixture");
    browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  }, 100_000);
  afterAll(async () => {
    await browser?.close();
    child?.kill();
    await child?.exited;
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (!original) expect(errors).toEqual([]);
  });

  if (original)
    describe("KB64 frozen original", () => {
      test("real caller rejection is unhandled and gives no safe retry", async () => {
        for (const width of [390, 1280])
          for (const lang of ["en", "he"])
            for (const theme of ["light", "dark"]) {
              const page = await open(`caller=list&lang=${lang}&theme=${theme}`, width);
              await remove(page);
              await page.getByRole("button", { name: "Undo", exact: true }).click();
              await page.evaluate(() => (window as any).__kb64.reject());
              await page.waitForFunction(() => (window as any).__rejections.length === 1);
              expect(await page.getByRole("button", { name: /Try Undo again/ }).count()).toBe(0);
              expect(await page.locator("output").innerText()).toContain("Note removed.");
              console.log(
                "Original real NotesScreen rejection",
                width,
                lang,
                theme,
                await page.evaluate(() => (window as any).__rejections)
              );
              await capture(page, `before-${width}-${lang}-${theme}.png`);
              await page.close();
            }
      }, 120_000);
    });
  else
    describe.serial("KB64 Undo recovery", () => {
      async function reject(page: Page) {
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.reject());
        await page.locator("output button[aria-describedby]").waitFor();
      }
      test("isUndoActive keeps the existing strict deadline boundary", async () => {
        const { isUndoActive } = await import("../../apps/web/components/notes/UndoDeleteToast");
        expect(isUndoActive(1001, 1000)).toBe(true);
        expect(isUndoActive(1000, 1000)).toBe(false);
        expect(isUndoActive(999, 1000)).toBe(false);
      });
      test("English and machine-drafted Hebrew have matching typed keys", async () => {
        const { en, he, kb64t } = await import("../../apps/web/lib/i18n-groups/kb-64");
        expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
        expect(kb64t("he", "retry")).toBe(he.retry);
      });
      test("a rejected callback shows safe recovery without an unhandled rejection", async () => {
        const page = await open();
        await reject(page);
        expect(await page.locator("output").innerText()).toContain("That couldn't be undone.");
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await page.close();
      }, 30_000);
      test("raw backend detail is never rendered in the notice", async () => {
        const page = await open();
        await reject(page);
        expect(await page.locator("body").innerText()).not.toContain("PRIVATE_BACKEND_DETAIL");
        expect(await page.locator("output button").getAttribute("aria-describedby")).toBeTruthy();
        await page.close();
      }, 30_000);
      test("a synchronously thrown callback also returns a safe retry", async () => {
        const page = await open();
        await page.evaluate(() => {
          (window as any).__kb64.mode = "sync";
        });
        await page.locator("output button").click();
        await page.getByRole("button", { name: "Try Undo again", exact: true }).waitFor();
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(1);
        await page.close();
      }, 30_000);
      test("pointer retry calls once more and keeps the original deadline", async () => {
        const page = await open();
        const deadline = await page.evaluate(() => (window as any).__kb64.deadline);
        await reject(page);
        await page.locator("output button").click();
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(2);
        expect(await page.evaluate(() => (window as any).__kb64.deadline)).toBe(deadline);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
        await page.close();
      }, 30_000);
      test("keyboard retry is reachable and has a visible focus ring", async () => {
        const page = await open();
        await reject(page);
        await page.keyboard.press("Tab");
        for (
          let n = 0;
          n < 4 &&
          !(await page.locator("output button").evaluate((el) => el === document.activeElement));
          n++
        )
          await page.keyboard.press("Tab");
        expect(
          await page.locator("output button").evaluate((el) => el === document.activeElement)
        ).toBe(true);
        expect(
          await page
            .locator("output button")
            .evaluate((el) => Number.parseFloat(getComputedStyle(el).outlineWidth))
        ).toBeGreaterThanOrEqual(2);
        await page.keyboard.press("Enter");
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(2);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.close();
      }, 30_000);
      test("same-tick duplicate activation starts one callback", async () => {
        const page = await open();
        await page.locator("output button").evaluate((el) => {
          (el as HTMLButtonElement).click();
          (el as HTMLButtonElement).click();
        });
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(1);
        expect(await page.locator("output button").isDisabled()).toBe(true);
        expect(await page.locator("output button").getAttribute("aria-busy")).toBe("true");
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.close();
      }, 30_000);
      test("activation at the deadline cannot start a callback even before its timer fires", async () => {
        const page = await open();
        const deadline = await page.evaluate(() => (window as any).__kb64.deadline);
        await page.clock.setSystemTime(new Date(deadline));
        await page.locator("output button").evaluate((el) => (el as HTMLButtonElement).click());
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(0);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        await page.close();
      }, 30_000);
      test("activation after the deadline is also refused", async () => {
        const page = await open();
        const deadline = await page.evaluate(() => (window as any).__kb64.deadline);
        await page.clock.setSystemTime(new Date(deadline + 1));
        await page.locator("output button").evaluate((el) => (el as HTMLButtonElement).click());
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(0);
        await page.close();
      }, 30_000);
      test("normal expiry runs once through StrictMode and callback re-renders", async () => {
        const page = await open();
        await page.clock.fastForward(30_001);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        await page.evaluate(() => (window as any).__kb64.renderAgain());
        await page.clock.fastForward(30_000);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        expect(await page.locator("output").count()).toBe(0);
        await page.close();
      }, 30_000);
      test("expiry during a pending request waits for fulfillment then expires once", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.clock.fastForward(30_001);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        expect(await page.locator("output button").isDisabled()).toBe(true);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        await page.close();
      }, 30_000);
      test("rejection after pending expiry expires without offering a fresh retry", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.clock.fastForward(30_001);
        await page.evaluate(() => (window as any).__kb64.reject());
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await page.close();
      }, 30_000);
      test("retry does not restart the expiry timer", async () => {
        const page = await open();
        await page.clock.fastForward(10_000);
        await reject(page);
        await page.locator("output button").click();
        await page.clock.fastForward(20_001);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        await page.close();
      }, 30_000);
      test("fulfillment makes no invented success claim and does not expire early", async () => {
        const page = await open();
        await page.evaluate(() => {
          (window as any).__kb64.mode = "fulfill";
        });
        await page.locator("output button").click();
        await page.waitForFunction(
          () => document.querySelector("output button")?.getAttribute("aria-busy") === "false"
        );
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        expect(await page.locator("output").innerText()).not.toMatch(/restored|success/i);
        expect(await page.locator("output button").isEnabled()).toBe(true);
        await page.close();
      }, 30_000);
      test("unmount fences a stale rejected request and cancels expiry", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.unmount());
        await page.locator("output").waitFor({ state: "detached" });
        await page.evaluate(() => (window as any).__kb64.reject());
        await page.clock.fastForward(30_001);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await page.close();
      }, 30_000);
      test("changed deadline fences an old rejection without leaking error or busy state", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.changeDeadline(60_000));
        await page.waitForFunction(
          () => document.querySelector("output button")?.getAttribute("aria-busy") === "false"
        );
        await page.evaluate(() => (window as any).__kb64.reject());
        expect(await page.getByRole("button", { name: "Undo", exact: true }).count()).toBe(1);
        expect(await page.getByRole("button", { name: "Try Undo again" }).count()).toBe(0);
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        await page.close();
      }, 30_000);
      test("changed deadline fences an old fulfilled request after the old deadline", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.changeDeadline(60_000));
        await page.waitForFunction(
          () => document.querySelector("output button")?.getAttribute("aria-busy") === "false"
        );
        await page.clock.fastForward(30_001);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(0);
        expect(await page.locator("output").count()).toBe(1);
        await page.close();
      }, 30_000);
      test("new inline callback identities do not reset an active request", async () => {
        const page = await open();
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.renderAgain());
        expect(await page.locator("output button").isDisabled()).toBe(true);
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(1);
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.close();
      }, 30_000);
      test("Hebrew recovery has RTL direction and localized action copy", async () => {
        const { he } = await import("../../apps/web/lib/i18n-groups/kb-64");
        const page = await open("lang=he");
        await page.evaluate(() => {
          (window as any).__kb64.mode = "sync";
        });
        await page.locator("output button").click();
        await page.getByRole("button", { name: he.retry, exact: true }).waitFor();
        expect(await page.locator("output").getAttribute("dir")).toBe("rtl");
        expect(await page.locator("output").innerText()).toContain(he.error);
        expect(await page.locator("output").innerText()).not.toContain("Note removed.");
        await page.close();
      }, 30_000);
      test("an immediate fulfillment crossing the deadline still schedules post-commit expiry", async () => {
        const page = await open();
        await page.evaluate(() => {
          (window as any).__kb64.mode = "jumpFulfill";
        });
        await page.locator("output button").click();
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.evaluate(() => (window as any).__kb64.expires)).toBe(1);
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(1);
        await page.close();
      }, 30_000);
      test("late successful real detail restoration keeps the parent navigation authoritative", async () => {
        const page = await open("caller=page");
        await remove(page, "page");
        await page.locator("output button").click();
        await page.clock.fastForward(30_001);
        expect(await page.locator("output button").getAttribute("aria-busy")).toBe("true");
        await page.evaluate(() => (window as any).__kb64.fulfill(true));
        await page.locator('[data-component="PageEditor"]').waitFor();
        await page.locator(".kb64-toast").waitFor({ state: "detached" });
        expect(new URL(page.url()).pathname).toBe("/notes/maya-note");
        expect(await page.locator("h1").count()).toBe(1);
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await page.close();
      }, 30_000);
      test("real NotesScreen list callback contains rejection and retries the same note", async () => {
        const page = await open("caller=list");
        await remove(page);
        await reject(page);
        expect(await page.evaluate(() => (window as any).__kb64.lastRestoreArgs)).toEqual({
          noteId: "maya-note",
        });
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.fulfill(true));
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.evaluate(() => (window as any).__kb64.calls)).toBe(2);
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await page.close();
      }, 30_000);
      test("real NotesScreen page callback contains rejection and leaves false fulfillment neutral", async () => {
        const page = await open("caller=page");
        await remove(page, "page");
        await reject(page);
        expect(await page.evaluate(() => (window as any).__kb64.lastRestoreArgs)).toEqual({
          noteId: "maya-note",
        });
        await page.locator("output button").click();
        await page.evaluate(() => (window as any).__kb64.fulfill(false));
        await page.waitForFunction(
          () => document.querySelector("output button")?.getAttribute("aria-busy") === "false"
        );
        expect(await page.locator("output").count()).toBe(1);
        expect(await page.locator("output").innerText()).not.toMatch(/restored|success/i);
        expect(await page.evaluate(() => (window as any).__rejections)).toEqual([]);
        await capture(page, "after-page-390-en-light.png");
        await page.close();
      }, 30_000);
      test("gallery reuses the notice and supports reject retry expiration and language", async () => {
        const { en, he } = await import("../../apps/web/lib/i18n-groups/kb-64");
        const page = await open("gallery");
        await page.locator("output button").click();
        await page.getByRole("button", { name: en.retry, exact: true }).waitFor();
        await page.getByRole("button", { name: en.language, exact: true }).click();
        await page.getByRole("button", { name: he.retry, exact: true }).click();
        await page.locator("output").waitFor({ state: "detached" });
        await page.getByRole("button", { name: he.removeNote, exact: true }).click();
        await page.locator("output").waitFor();
        await page.getByRole("button", { name: he.endWindow, exact: true }).click();
        await page.locator("output").waitFor({ state: "detached" });
        expect(await page.locator("main").count()).toBe(1);
        expect(await page.locator("h1").count()).toBe(1);
        await page.close();
      }, 30_000);
      test("real caller and gallery fit both widths languages and themes with 44px controls", async () => {
        for (const width of [390, 1280])
          for (const lang of ["en", "he"])
            for (const theme of ["light", "dark"])
              for (const gallery of [false, true]) {
                const page = await open(
                  `${gallery ? "gallery" : "caller=list"}&lang=${lang}&theme=${theme}`,
                  width
                );
                if (!gallery) {
                  await remove(page);
                  await reject(page);
                } else {
                  await page.locator("output button").click();
                  await page.locator("output button[aria-describedby]").waitFor();
                }
                expect(await page.title()).toBe("Note Undo fixture");
                expect(await page.locator("main").count()).toBe(1);
                expect(await page.locator("h1").count()).toBe(1);
                expect(await page.locator("nextjs-portal").count()).toBe(0);
                expect(
                  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
                ).toBe(true);
                expect(
                  await page.locator("output button").evaluate((el) => {
                    const r = el.getBoundingClientRect();
                    return r.height >= 44 && r.width >= 44;
                  })
                ).toBe(true);
                await page.keyboard.press("Tab");
                await page.locator("output button").focus();
                expect(
                  await page
                    .locator("output button")
                    .evaluate((el) => Number.parseFloat(getComputedStyle(el).outlineWidth))
                ).toBeGreaterThanOrEqual(2);
                await capture(
                  page,
                  `${gallery ? "gallery" : "after"}-${width}-${lang}-${theme}.png`
                );
                await page.close();
              }
      }, 120_000);
      test("large text wraps and reduced motion has no toast animation", async () => {
        const page = await open("lang=he");
        await page.evaluate(() => {
          (window as any).__kb64.mode = "sync";
          document.documentElement.style.setProperty("--tp-text-md", "32px");
        });
        const normalSeconds = await page
          .locator("output")
          .evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration));
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.locator("output button").click();
        await page.locator("output button[aria-describedby]").waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        );
        expect(
          await page.locator("output").evaluate((el) => el.scrollWidth <= el.clientWidth)
        ).toBe(true);
        expect(
          await page.locator("output").evaluate((el) => getComputedStyle(el).animationName)
        ).toBe("none");
        expect(await page.locator("output").evaluate((el) => getComputedStyle(el).fontSize)).toBe(
          "32px"
        );
        const reducedSeconds = await page.locator("output").evaluate((el) => {
          const value = getComputedStyle(el).transitionDuration.split(",")[0].trim();
          return value.endsWith("ms") ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
        });
        // The unchanged global reduced-motion policy uses 0.01ms !important.
        expect(reducedSeconds).toBeLessThanOrEqual(0.0000101);
        if (normalSeconds > 0.0000101) expect(reducedSeconds).toBeLessThan(normalSeconds);
        await page.close();
      }, 30_000);
    });
}
