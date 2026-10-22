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
const evidence = join(root, "docs/polish/evidence/kb-beta-request");
const baseline = process.env.BETA_REQUEST_BASELINE;
const exec = promisify(execFile);
let directory: string;
let server: ReturnType<typeof serve>;
let browser: Browser;
let page: Page | undefined;
let errors: string[] = [];

type Fixture = {
  calls: Array<{ kind: string; args: unknown }>;
  mode: "resolve" | "reject" | "defer";
  result: "requested" | "approved" | "unavailable";
  profile: Record<string, unknown>;
  signInMode: "resolve" | "reject" | "defer";
  settle(success: boolean): void;
  settleSignIn(success: boolean): void;
  show(screen: string, email?: string, revoked?: boolean): void;
  signal(): void;
};
declare global { interface Window { betaFixture: Fixture; } }

beforeAll(async () => {
  directory = await mkdtemp(join(web, ".beta-request-fixture-"));
  await mkdir(evidence, { recursive: true });
  const entry = join(directory, "entry.tsx");
  await writeFile(entry, `
import React from "react";import{createRoot}from"react-dom/client";
import{SignInForm}from"../components/auth/SignInForm";
import{WaitingForApproval}from"../components/approval/WaitingForApproval";
const params=new URLSearchParams(location.search),lang=params.get("lang")==="he"?"he":"en";
document.documentElement.lang=lang;document.documentElement.dir=lang==="he"?"rtl":"ltr";document.documentElement.dataset.theme=params.get("theme")||"light";
const d=window.betaFixture={calls:[],mode:"resolve",result:"requested",signInMode:"resolve",revision:0,profile:{email:"fixture@example.invalid",fullName:"",approvalStatus:"pending",betaAccess:"none",userType:"free"}};
d.signal=()=>{d.revision++;window.dispatchEvent(new Event("fixture-change"))};
d.request=()=>{d.calls.push({kind:"request",args:{}});if(d.mode==="reject")return Promise.reject(new Error("FICTIONAL_FAILURE"));if(d.mode==="defer")return new Promise((resolve,reject)=>{d.settle=success=>success?resolve({status:d.result}):reject(new Error("FICTIONAL_FAILURE"))});return Promise.resolve({status:d.result})};
d.signIn=(provider,args)=>{d.calls.push({kind:"signIn",args:{provider,...args}});if(d.signInMode==="reject")return Promise.reject(new Error("FICTIONAL_FAILURE"));if(d.signInMode==="defer")return new Promise((resolve,reject)=>{d.settleSignIn=success=>success?resolve():reject(new Error("FICTIONAL_FAILURE"))});return Promise.resolve()};
d.save=args=>{d.calls.push({kind:"name",args});d.profile={...d.profile,...args};d.signal();return Promise.resolve("fixture-user")};
function App(){const[view,setView]=React.useState({screen:params.get("screen")||"signin",email:"fixture@example.invalid",revoked:false});d.show=(screen,email="fixture@example.invalid",revoked=false)=>setView({screen,email,revoked});return view.screen==="waiting"?<WaitingForApproval email={view.email} revoked={view.revoked}/>:view.screen==="gone"?null:<main className="tp-auth" dir="ltr" lang="en"><SignInForm key={view.screen} variant="page" flow={view.screen==="signup"?"sign-up":"sign-in"} nextPath="/today"/></main>}
createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
`);
  const stubs = {
    "@convex-dev/auth/react": `export const useAuthActions=()=>({signIn:(...args)=>window.betaFixture.signIn(...args),signOut:async()=>{window.betaFixture.calls.push({kind:"signOut",args:{}})}});`,
    "convex/react": `import React from"react";const request=()=>window.betaFixture.request(),save=args=>window.betaFixture.save(args);export function useQuery(){const d=window.betaFixture;React.useSyncExternalStore(fn=>{window.addEventListener("fixture-change",fn);return()=>window.removeEventListener("fixture-change",fn)},()=>d.revision,()=>0);return d.profile}export const useMutation=ref=>String(ref).endsWith("requestBetaAccess")?request:save;`,
    "next/navigation": `export const useRouter=()=>({replace:path=>window.betaFixture.calls.push({kind:"replace",args:{path}})});`,
    "next/link": `import React from"react";export default function Link({href,...props}){return <a {...props} href={typeof href==="string"?href:href.pathname+"?"+new URLSearchParams(href.query)}/>}`,
    "@/components/providers/LocaleProvider": `import{translate}from"${web}/lib/i18n.ts";export const useLocale=()=>{const lang=document.documentElement.lang==="he"?"he":"en";return{lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key)}};`,
    "@/convex/_generated/api": `const node=(path="api")=>new Proxy({},{get(_,key){if(key===Symbol.toPrimitive)return()=>path;return node(path+"."+String(key))}});export const api=node();`,
  };
  const builder = join(directory, "build.ts");
  await writeFile(builder, `
import{readFileSync,existsSync,statSync,writeFileSync}from"node:fs";import{join,resolve,basename}from"node:path";
const stubs=${JSON.stringify(stubs)},web=${JSON.stringify(web)},root=${JSON.stringify(root)},dir=${JSON.stringify(directory)},baseline=${JSON.stringify(baseline ?? null)};
const result=await Bun.build({entrypoints:[${JSON.stringify(entry)}],outdir:dir,target:"browser",minify:true,plugins:[{name:"synthetic-beta-boundaries",setup(build){
build.onResolve({filter:/^(@\\/|@convex-dev\\/auth\\/react$|convex\\/react$|next\\/(navigation|link)$)/},args=>{if(args.path in stubs)return{path:args.path,namespace:"fixture"};if(args.path.startsWith("@/")){const base=resolve(web,args.path.slice(2));const found=[base,base+".ts",base+".tsx",join(base,"index.ts"),join(base,"index.tsx")].find(p=>existsSync(p)&&statSync(p).isFile());if(found)return{path:found}}});
build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:stubs[args.path],loader:"tsx",resolveDir:web}));
if(baseline)build.onLoad({filter:/components\\/(auth\\/SignInForm|approval\\/WaitingForApproval)\\.tsx$/},args=>({contents:readFileSync(join(baseline,basename(args.path)),"utf8"),loader:"tsx",resolveDir:args.path.slice(0,args.path.lastIndexOf("/"))}));
}}]});if(!result.success)throw new Error(result.logs.map(String).join("\\n"));for(const output of result.outputs)writeFileSync(join(dir,basename(output.path)),new Uint8Array(await output.arrayBuffer()));
const postcss=(await import(join(web,"node_modules/postcss/lib/postcss.mjs"))).default,tailwind=(await import(join(web,"node_modules/@tailwindcss/postcss/dist/index.mjs"))).default;
const path=join(web,"app/globals.css");writeFileSync(join(dir,"globals.css"),(await postcss([tailwind({base:root})]).process(readFileSync(path,"utf8"),{from:path})).css);
`);
  await exec(process.execPath, ["--no-env-file", builder], { cwd: web, timeout: 90_000, killSignal: "SIGKILL", maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, NODE_ENV: "test" } });
  const assets = new Map<string, Buffer>();
  for (const name of ["entry.js", "entry.css", "globals.css"]) if (existsSync(join(directory, name))) assets.set(`/${name}`, await readFile(join(directory, name)));
  server = serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    const asset = assets.get(path);
    if (asset) return new Response(new Uint8Array(asset).buffer, { headers: { "Content-Type": path.endsWith(".css") ? "text/css" : "text/javascript" } });
    if (path.startsWith("/fonts/")) {
      const file = resolve(web, path.slice(1));
      if (file.startsWith(`${web}/fonts/`) && existsSync(file)) return new Response(await readFile(file), { headers: { "Content-Type": file.endsWith("woff2") ? "font/woff2" : "font/woff" } });
      return new Response("Font not found", { status: 404 });
    }
    if (path === "/favicon.ico") return new Response(null, { status: 204 });
    return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><style>html{--font-newsreader:Newsreader;--font-ibm-mono:"IBM Plex Mono"}@font-face{font-family:Newsreader;src:url("/fonts/newsreader/Newsreader-latin.woff2")}@font-face{font-family:"IBM Plex Mono";src:url("/fonts/ibm-plex-mono/IBMPlexMono-latin-400.woff2")}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script type="module" src="/entry.js"></script></body></html>', { headers: { "Content-Type": "text/html" } });
  } });
  const executablePath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/google-chrome"].find(existsSync);
  if (!executablePath) throw new Error("Chromium is required for mounted beta request tests");
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
}, 120_000);

afterEach(async () => { try { expect(errors).toEqual([]); } finally { await page?.close(); page = undefined; } });
afterAll(async () => { await browser?.close(); server?.stop(true); if (directory) await rm(directory, { recursive: true, force: true }); });

async function open(screen = "waiting", lang = "en", width = 390, theme = "light") {
  errors = [];
  page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.port}/?screen=${screen}&lang=${lang}&theme=${theme}`);
  await page.locator("h1").waitFor();
  return page;
}

describe("mounted beta request", () => {
  test("beta sign-in sends only a Resend magic link and keeps the entered email on error", async () => {
    const p = await open("signin");
    await p.getByLabel("Email", { exact: true }).fill("fictional@example.invalid");
    await p.getByRole("button", { name: "Sign in as beta tester", exact: true }).click();
    await p.evaluate(() => { window.betaFixture.signInMode = "reject"; });
    await p.getByRole("button", { name: "Send magic link", exact: true }).click();
    await browserExpect(p.getByRole("alert")).toContainText("couldn’t send the link");
    await browserExpect(p.getByLabel("Email", { exact: true })).toHaveValue("fictional@example.invalid");
    await p.evaluate(() => { window.betaFixture.signInMode = "resolve"; });
    await p.getByRole("button", { name: "Send magic link", exact: true }).click();
    await browserExpect(p.getByRole("heading", { level: 1 })).toHaveText("Check your email");
    await browserExpect(p.getByText("After signing in, choose Request beta access.", { exact: false })).toBeVisible();
    expect(await p.evaluate(() => window.betaFixture.calls)).toEqual([
      { kind: "signIn", args: { provider: "resend", email: "fictional@example.invalid", redirectTo: "/today" } },
      { kind: "signIn", args: { provider: "resend", email: "fictional@example.invalid", redirectTo: "/today" } },
    ]);
    expect(await p.locator('input[type="password"]').count()).toBe(0);
  });

  test("ordinary signup discloses the trial/off switch without making a beta request", async () => {
    const p = await open("signup");
    await browserExpect(p.getByText("Every plan starts with a $1 trial.", { exact: false })).toBeVisible();
    expect(await p.evaluate(() => window.betaFixture.calls)).toEqual([]);
    await p.getByLabel("Email", { exact: true }).fill("new@example.invalid");
    await p.getByRole("button", { name: "Send magic link", exact: true }).click();
    await browserExpect(p.getByRole("heading", { level: 1 })).toHaveText("Check your email");
    expect(await p.evaluate(() => window.betaFixture.calls.map(call => call.kind))).toEqual(["signIn"]);
  });

  test("a deliberate request shows queued only after success and suppresses duplicate clicks", async () => {
    const p = await open();
    expect(await p.evaluate(() => window.betaFixture.calls)).toEqual([]);
    await p.evaluate(() => { window.betaFixture.mode = "defer"; });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await browserExpect(p.getByRole("button", { name: "Sending request…", exact: true })).toBeDisabled();
    expect(await p.getByText("Your beta request is in the approval queue.", { exact: false }).count()).toBe(0);
    await p.evaluate(() => window.betaFixture.settle(true));
    await browserExpect(p.getByText("Your beta request is in the approval queue.", { exact: false })).toBeVisible();
    expect(await p.evaluate(() => window.betaFixture.calls)).toEqual([{ kind: "request", args: {} }]);
  });

  test("a failed request preserves the name draft and can retry", async () => {
    const p = await open();
    await p.locator("#waiting-name").fill("Fictional name");
    await p.evaluate(() => { window.betaFixture.mode = "reject"; });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await browserExpect(p.getByRole("alert")).toContainText("couldn’t send the request");
    await browserExpect(p.locator("#waiting-name")).toHaveValue("Fictional name");
    await p.evaluate(() => { window.betaFixture.mode = "resolve"; });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await browserExpect(p.getByText("Your beta request is in the approval queue.", { exact: false })).toBeVisible();
    await browserExpect(p.locator("#waiting-name")).toHaveValue("Fictional name");
    expect(await p.evaluate(() => window.betaFixture.calls.filter(call => call.kind === "request").length)).toBe(2);
  });

  test("persisted queue state and server approval are honest without bypassing the gate", async () => {
    const p = await open();
    await p.evaluate(() => { window.betaFixture.profile.betaRequestedAt = 123; window.betaFixture.signal(); });
    await browserExpect(p.getByText("Your beta request is in the approval queue.", { exact: false })).toBeVisible();
    expect(await p.evaluate(() => window.betaFixture.calls)).toEqual([]);
    await p.evaluate(() => { delete window.betaFixture.profile.betaRequestedAt; window.betaFixture.result = "approved"; window.betaFixture.signal(); });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await browserExpect(p.getByText("Beta access is approved.", { exact: false })).toBeVisible();
    expect(await p.evaluate(() => window.betaFixture.calls.some(call => call.kind === "replace"))).toBe(false);
  });

  test("revocation and account switches ignore a stale successful request", async () => {
    const p = await open();
    await p.evaluate(() => { window.betaFixture.mode = "defer"; });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await p.evaluate(() => window.betaFixture.show("waiting", "other@example.invalid", true));
    await p.evaluate(() => window.betaFixture.settle(true));
    expect(await p.getByTestId("beta-request").count()).toBe(0);
    await p.evaluate(() => window.betaFixture.show("waiting", "other@example.invalid", false));
    await browserExpect(p.getByRole("button", { name: "Request beta access", exact: true })).toBeVisible();
    expect(await p.getByText("Your beta request is in the approval queue.", { exact: false }).count()).toBe(0);
    await p.getByRole("button", { name: "Sign out", exact: true }).click();
    expect(await p.evaluate(() => window.betaFixture.calls.slice(-2))).toEqual([{ kind: "signOut", args: {} }, { kind: "replace", args: { path: "/sign-in" } }]);
  });

  test("an unavailable response leaves no queued claim and no request button", async () => {
    const p = await open();
    await p.evaluate(() => { window.betaFixture.result = "unavailable"; });
    await p.getByRole("button", { name: "Request beta access", exact: true }).click();
    await browserExpect(p.getByText("Beta requests are not available", { exact: false })).toBeVisible();
    expect(await p.getByRole("button", { name: "Request beta access", exact: true }).count()).toBe(0);
  });

  test("an unmounted sign-in result cannot change a new form", async () => {
    const p = await open("signin");
    await p.evaluate(() => { window.betaFixture.signInMode = "defer"; });
    await p.getByLabel("Email", { exact: true }).fill("before@example.invalid");
    await p.getByRole("button", { name: "Send magic link", exact: true }).click();
    await p.evaluate(() => window.betaFixture.show("signup"));
    await p.evaluate(() => window.betaFixture.settleSignIn(true));
    await browserExpect(p.getByRole("heading", { level: 1 })).toHaveText("Create your account");
    await browserExpect(p.getByLabel("Email", { exact: true })).toHaveValue("");
  });

  test("screenshots of real mounted EN/HE screens at 390 and 1280", async () => {
    for (const screen of ["signin", "waiting"]) for (const width of [390, 1280]) for (const lang of ["en", "he"]) for (const theme of ["light", "dark"]) {
      const p = await open(screen, lang, width, theme);
      await browserExpect(p.locator("h1")).toHaveCount(1);
      await browserExpect(p.locator("main")).toHaveCount(1);
      await p.evaluate(() => document.fonts.ready);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (!baseline) {
        expect(await p.locator("body").innerText()).not.toContain("betaAuth.");
        const controls = p.locator("button, input, a");
        for (const control of await controls.all()) {
          if (await control.isVisible()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        await p.keyboard.press("Tab");
        expect(await p.locator(":focus-visible").count()).toBe(1);
      }
      await p.screenshot({ path: join(evidence, `${baseline ? "before" : "after"}-${screen}-${width}-${lang}-${theme}.png`), fullPage: true });
      expect(errors).toEqual([]);
      await p.close(); page = undefined;
    }
  }, 120_000);
});
