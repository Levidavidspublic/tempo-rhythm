import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB75_FIXTURE_CHILD === "1";
type Results = Record<string, { pass: boolean; detail?: string }>;

const backend = `
import { useSyncExternalStore } from "react";
const listeners = new Set();
let version = 0;
const original = [
  { _id:"maya", email:"maya.long.fictional.address@example.test", fullName:"Maya Ronen", status:"pending", isAdmin:false, createdAt:1729296000000 },
  { _id:"dana", email:"dana@example.test", fullName:"דנה", status:"pending", isAdmin:false, createdAt:1729209600000 },
  { _id:"yoni", email:"yoni@example.test", fullName:"Yoni", status:"approved", isAdmin:true, createdAt:1729123200000 },
];
const initial=new URLSearchParams(location.search).get("initial");
const state = { me:initial==="nonadmin"?{status:"approved",isAdmin:false,email:"fictional@example.test"}:
  {status:"approved",isAdmin:true,email:"admin@example.test"}, rows:original,
  calls:[], held:[], hold:[], reject:[], listReads:0 };
function emit(){version++;for(const fn of listeners)fn()}
function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
function snapshot(){return version}
function sortRows(){const rank={pending:0,revoked:1,approved:2};state.rows=[...state.rows].sort((a,b)=>rank[a.status]-rank[b.status]||b.createdAt-a.createdAt)}
function apply(args){state.rows=state.rows.map(row=>row._id===args.userId?{...row,status:args.status}:row);sortRows();emit();return args}
window.__kb75={
  state,
  setMe(value){state.me=value;emit()},
  setRows(value){state.rows=value;emit()},
  hold(userId){state.hold.push(userId)},
  reject(userId){state.reject.push(userId)},
  settle(userId,ok){const at=state.held.findIndex(item=>item.args.userId===userId);if(at<0)throw Error("No held "+userId);
    const [item]=state.held.splice(at,1);if(ok)item.resolve(apply(item.args));else item.reject(Error("SECRET_RAW_PROVIDER_ERROR_STACK"))},
};
export function useQuery(ref,args){useSyncExternalStore(subscribe,snapshot,snapshot);
  if(ref==="approval.myStatus")return state.me;
  if(args==="skip")return undefined;
  state.listReads++;return state.rows;
}
export function useMutation(ref){return async args=>{
  state.calls.push({ref,args});
  if(state.hold.includes(args.userId))return await new Promise((resolve,reject)=>state.held.push({args,resolve,reject}));
  if(state.reject.includes(args.userId))throw Error("SECRET_RAW_PROVIDER_ERROR_STACK");
  return apply(args);
}}
`;
const api = `export const api={approval:{myStatus:"approval.myStatus",listForAdmin:"approval.listForAdmin",setStatus:"approval.setStatus"}};`;
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {LocaleProvider} from "@/components/providers/LocaleProvider";
import {AdminApprovals,Kb75Gallery} from "@/components/approval/AdminApprovals";
const mode=new URLSearchParams(location.search).get("mode");
createRoot(document.getElementById("app")).render(
  <LocaleProvider>{mode==="gallery"?<Kb75Gallery/>:<main><AdminApprovals/></main>}</LocaleProvider>);
`;

async function runFixture(): Promise<Results> {
  const { chromium, expect: pwExpect } = await import("@playwright/test");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs")).default;
  const web = join(repo, "apps/web");
  const temp = join(repo, "work/kb75-fixture");
  await mkdir(temp, {recursive:true});
  await Promise.all([
    writeFile(join(temp,"backend.ts"),backend),
    writeFile(join(temp,"api.ts"),api),
    writeFile(join(temp,"entry.tsx"),entry),
  ]);
  const cssPath = join(web,"app/globals.css");
  const baseCss = (await postcss([tailwind({base:repo})]).process(await readFile(cssPath,"utf8"),{from:cssPath})).css;
  const build = async (source:string) => {
    const output=await Bun.build({entrypoints:[source],target:"browser",outdir:temp,
      define:{"process.env.NODE_ENV":'"test"'},
      plugins:[{name:"kb75-fixture",setup(b){
        b.onResolve({filter:/^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/},
          ({path})=>({path:Bun.resolveSync(path,web)}));
        b.onResolve({filter:/^convex\/react$/},()=>({path:join(temp,"backend.ts")}));
        b.onResolve({filter:/^@\/convex\/_generated\/api$/},()=>({path:join(temp,"api.ts")}));
        b.onResolve({filter:/^@\//},({path})=>({path:Bun.resolveSync(path,web)}));
      }}]});
    if(!output.success)throw Error(output.logs.map(String).join("\n"));
    return {js:await output.outputs.find(file=>file.path.endsWith(".js"))?.text()??"",
      css:(await Promise.all(output.outputs.filter(file=>file.path.endsWith(".css")).map(file=>file.text()))).join("\n")};
  };
  const current=await build(join(temp,"entry.tsx"));
  let before:{js:string;css:string}|null=null;
  const snapshot=join(repo,"work/kb75-before-source.tsx");
  if(process.env.KB75_CAPTURE_BEFORE==="1"){
    if(!existsSync(snapshot))throw Error("KB75 capture requires frozen source");
    await writeFile(join(temp,"before-entry.tsx"),`
      import React from "react";import {createRoot} from "react-dom/client";
      import {LocaleProvider} from "@/components/providers/LocaleProvider";
      import {AdminApprovals} from ${JSON.stringify(snapshot)};
      createRoot(document.getElementById("app")).render(<LocaleProvider><main><AdminApprovals/></main></LocaleProvider>);`);
    before=await build(join(temp,"before-entry.tsx"));
  }
  if(process.env.KB75_BUNDLE_ONLY==="1")return {bundle:{pass:Boolean(current.js&&baseCss&&(!before||before.js))}};
  const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/current.js")return new Response(current.js,{headers:{"content-type":"text/javascript"}});
    if(url.pathname==="/before.js")return new Response(before?.js??"",{headers:{"content-type":"text/javascript"}});
    if(url.pathname==="/styles.css")return new Response(baseCss+"\n"+(url.searchParams.get("mode")==="before"?before?.css??"":current.css),
      {headers:{"content-type":"text/css"}});
    const lang=url.searchParams.get("lang")==="he"?"he":"en";
    const phase=url.searchParams.get("mode")==="before"?"before":"current";
    return new Response(`<!doctype html><html lang="${lang}" dir="${lang==="he"?"rtl":"ltr"}"><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/styles.css?mode=${phase}"></head><body><div id="app"></div>
      <script>window.process={env:{NODE_ENV:"test"}}</script><script type="module" src="/${phase}.js"></script></body></html>`,
      {headers:{"content-type":"text/html"}});
  }});
  const executable=[chromium.executablePath(),"/usr/bin/chromium","/usr/bin/google-chrome","/usr/bin/chromium-browser"].find(existsSync);
  if(!executable)throw Error("KB75 fixture requires installed Playwright Chromium or system Chrome/Chromium");
  const browser=await chromium.launch({executablePath:executable,args:["--no-sandbox"]});
  const results:Results={};
  const open=async(mode:"screen"|"gallery"|"before"="screen",lang:"en"|"he"="en",width=390,theme:"light"|"dark"="light",initial:"admin"|"nonadmin"="admin")=>{
    const page=await browser.newPage({viewport:{width,height:844},reducedMotion:"reduce"});
    const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.port}/?mode=${mode}&lang=${lang}&initial=${initial}`);
    await page.locator("h1").waitFor({state:"visible",timeout:15_000}).catch(async()=>{throw Error("No hydrated h1: "+errors.join(" | "))});
    await page.waitForFunction(target=>document.documentElement.lang===target,lang);
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    await page.waitForFunction(t=>getComputedStyle(document.documentElement)
      .getPropertyValue("--tp-ground").trim().toLowerCase()===(t==="dark"?"#161412":"#f3eee4"),theme);
    await page.waitForFunction(t=>getComputedStyle(document.body).backgroundColor===
      (t==="dark"?"rgb(22, 20, 18)":"rgb(243, 238, 228)"),theme);
    return page;
  };
  const check=async(name:string,fn:()=>Promise<void>)=>{
    try{await fn();results[name]={pass:true}}catch(error){results[name]={pass:false,detail:String(error)}}
  };
  const state=(page:any)=>page.evaluate(()=>(window as any).__kb75.state);
  const act=(page:any,name:string)=>(page.locator('[data-user-id="'+name+'"]'));
  const settle=(page:any,id:string,ok:boolean)=>page.evaluate(([userId,success])=>(window as any).__kb75.settle(userId,success),[id,ok]);
  try {
    await check("loading distinct from zero",async()=>{
      const page=await open();
      await page.evaluate(()=>(window as any).__kb75.setMe(undefined));
      await pwExpect(page.getByTestId("approval-summary")).toContainText("Loading accounts");
      if((await page.getByTestId("approval-summary").innerText()).includes("0 waiting"))throw Error("loading called zero");
      await page.close();
    });
    await check("non-admin skips list query",async()=>{
      const page=await open("screen","en",390,"light","nonadmin");
      await pwExpect(page.getByRole("heading",{name:"Admins only"})).toBeVisible();
      if((await state(page)).listReads!==0)throw Error("initial non-admin subscribed to list");
      await page.evaluate(()=>(window as any).__kb75.setMe(null));
      await pwExpect(page.getByRole("heading",{name:"Admins only"})).toBeVisible();
      if((await state(page)).listReads!==0)throw Error("signed-out state subscribed to list");
      await page.close();
    });
    await check("empty list is explained",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.setRows([]));
      await pwExpect(page.getByTestId("approval-summary")).toContainText("No accounts");
      await page.close();
    });
    await check("pending count is qualified to shown rows",async()=>{
      const page=await open();await pwExpect(page.getByTestId("approval-summary")).toContainText("2 waiting for approval among 3 accounts shown (up to 500)");
      await page.close();
    });
    await check("admin row has no decisions",async()=>{
      const page=await open();if(await act(page,"yoni").getByRole("button").count())throw Error("admin actions rendered");
      await page.close();
    });
    await check("exact status mutation arguments",async()=>{
      const page=await open();await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await pwExpect(act(page,"maya")).toHaveAttribute("data-status","approved");
      const calls=(await state(page)).calls;
      if(JSON.stringify(calls)!==JSON.stringify([{ref:"approval.setStatus",args:{userId:"maya",status:"approved"}}]))throw Error(JSON.stringify(calls));
      await page.close();
    });
    await check("rapid same-row submit is single call",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).evaluate((node:any)=>{node.click();node.click()});
      if((await state(page)).calls.length!==1)throw Error("duplicate call");
      await page.close();
    });
    await check("different rows remain pending independently",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));await page.evaluate(()=>(window as any).__kb75.hold("dana"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await act(page,"dana").getByRole("button",{name:/Approve/}).click();
      await pwExpect(act(page,"maya").getByRole("button",{name:/Approve/})).toBeDisabled();
      await pwExpect(act(page,"dana").getByRole("button",{name:/Approve/})).toBeDisabled();
      if((await state(page)).calls.length!==2)throw Error("different row blocked");
      await page.close();
    });
    await check("A success leaves B pending",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));await page.evaluate(()=>(window as any).__kb75.hold("dana"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await act(page,"dana").getByRole("button",{name:/Approve/}).click();await settle(page,"maya",true);
      await pwExpect(act(page,"maya")).toHaveAttribute("data-status","approved");
      await pwExpect(act(page,"dana").getByRole("button",{name:/Approve/})).toBeDisabled();
      await page.close();
    });
    await check("A error leaves B pending",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));await page.evaluate(()=>(window as any).__kb75.hold("dana"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await act(page,"dana").getByRole("button",{name:/Approve/}).click();await settle(page,"maya",false);
      await pwExpect(act(page,"maya").getByRole("alert")).toBeVisible();
      await pwExpect(act(page,"dana").getByRole("button",{name:/Approve/})).toBeDisabled();
      await page.close();
    });
    await check("same-row error has reachable retry",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();await settle(page,"maya",false);
      await pwExpect(act(page,"maya").getByRole("button",{name:"Try again"})).toBeEnabled();
      await act(page,"maya").getByRole("button",{name:"Try again"}).click();
      if((await state(page)).calls.length!==2)throw Error("retry absent");
      await page.close();
    });
    await check("raw backend error never appears",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.reject("maya"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await pwExpect(act(page,"maya").getByRole("alert")).toContainText("Could not save");
      if((await page.locator("body").innerText()).includes("SECRET_RAW_PROVIDER"))throw Error("raw error leaked");
      await page.close();
    });
    await check("removed-row completion is discarded",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));
      await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await page.evaluate(()=>(window as any).__kb75.setRows((window as any).__kb75.state.rows.filter((r:any)=>r._id!=="maya")));
      await pwExpect(act(page,"maya")).toHaveCount(0);await settle(page,"maya",false);
      if(await page.getByRole("alert").count())throw Error("stale error shown");
      await page.close();
    });
    await check("query controls status and reordering",async()=>{
      const page=await open();await act(page,"maya").getByRole("button",{name:/Approve/}).click();
      await pwExpect(act(page,"maya")).toHaveAttribute("data-status","approved");
      const first=await page.locator(".kb75-row").first().getAttribute("data-user-id");
      if(first!=="dana")throw Error("query order ignored: "+first);
      await page.close();
    });
    await check("focus recovers when initiating button disappears",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));
      const approve=act(page,"maya").getByRole("button",{name:/Approve/});await approve.focus();await approve.press("Enter");
      await settle(page,"maya",true);await pwExpect(act(page,"maya")).toHaveAttribute("data-status","approved");
      await pwExpect(act(page,"maya")).toBeFocused();await page.close();
    });
    await check("late completion never steals moved focus",async()=>{
      const page=await open();await page.evaluate(()=>(window as any).__kb75.hold("maya"));
      const approve=act(page,"maya").getByRole("button",{name:/Approve/});await approve.focus();await approve.press("Enter");
      const other=act(page,"dana").getByRole("button",{name:/Approve/});await other.focus();
      await settle(page,"maya",true);await pwExpect(act(page,"maya")).toHaveAttribute("data-status","approved");
      await pwExpect(other).toBeFocused();await page.close();
    });
    await check("English and Hebrew date labels and copy",async()=>{
      const en=await open();const he=await open("screen","he");
      await pwExpect(en.getByText(/Joined/).first()).toBeVisible();
      await pwExpect(he.getByText(/תאריך הצטרפות/).first()).toBeVisible();
      await pwExpect(he.getByRole("heading",{name:"אישורי חשבונות"})).toBeVisible();
      await pwExpect(act(en,"maya").locator(".kb75-meta bdi")).toHaveText("10/19/2024");
      await pwExpect(act(he,"maya").locator(".kb75-meta bdi")).toHaveText("19.10.2024");
      await en.close();await he.close();
    });
    await check("long email is isolated and wraps in RTL",async()=>{
      const page=await open("screen","he",390);
      const email=act(page,"maya").locator("bdi.kb75-email").first();
      await pwExpect(email).toHaveAttribute("dir","ltr");
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow)throw Error("horizontal overflow");
      await page.close();
    });
    await check("phone and desktop matrix has one main h1 and 44 px actions",async()=>{
      for(const width of [390,1280])for(const lang of ["en","he"] as const)for(const theme of ["light","dark"] as const){
        const page=await open("screen",lang,width,theme);
        await page.evaluate(()=>document.documentElement.dataset.textSize="l");
        if(await page.locator("main").count()!==1||await page.locator("h1").count()!==1)throw Error("duplicate landmark");
        const size=await act(page,"maya").getByRole("button").first().evaluate((node:any)=>node.getBoundingClientRect().height);
        if(size<44)throw Error(`target ${size}px ${width} ${lang} ${theme}`);
        if(await act(page,"maya").getByRole("button").first().evaluate((node:any)=>node.scrollHeight>node.clientHeight+1))
          throw Error("button text clipped");
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error("horizontal overflow");
        await page.close();
      }
    });
    await check("visible focus and reduced motion",async()=>{
      const page=await open();const control=act(page,"maya").getByRole("button").first();
      await page.keyboard.press("Tab");await pwExpect(control).toBeFocused();
      await pwExpect.poll(()=>control.evaluate((node:any)=>{
        const style=getComputedStyle(node);
        return style.outlineStyle!=="none" || style.boxShadow!=="none";
      })).toBe(true);
      const styles=await control.evaluate((node:any)=>({
        transition:getComputedStyle(node).transitionDuration,
        animation:getComputedStyle(node).animationDuration,
      }));
      const seconds=(value:string)=>value.split(",").map(part=>{
        const trimmed=part.trim();return parseFloat(trimmed)/(trimmed.endsWith("ms")?1000:1);
      });
      if([...seconds(styles.transition),...seconds(styles.animation)].some(value=>value>0.001))
        throw Error("motion remains: "+JSON.stringify(styles));
      await page.close();
    });
    await check("both named views render in interactive gallery",async()=>{
      const page=await open("gallery");
      await pwExpect(page.getByTestId("approval-summary")).toBeVisible();
      await pwExpect(page.getByTestId("approval-row-feedback")).toBeVisible();
      await page.getByRole("button",{name:"Could not save",exact:true}).click();
      await pwExpect(page.getByRole("alert")).toBeVisible();
      await page.close();
    });
    if(process.env.KB75_CAPTURE_DIR){
      await mkdir(process.env.KB75_CAPTURE_DIR,{recursive:true});
      for(const width of [390,1280])for(const lang of ["en","he"] as const)for(const theme of ["light","dark"] as const)
        for(const mode of (before?["before","screen","gallery"]:["screen","gallery"]) as Array<"before"|"screen"|"gallery">){
          const page=await open(mode,lang,width,theme);
          await page.screenshot({path:join(process.env.KB75_CAPTURE_DIR,`${mode}-${width}-${lang}-${theme}.png`),fullPage:true});
          await page.close();
        }
    }
  } finally {await browser.close();server.stop(true)}
  return results;
}

if(child){
  try{console.log(JSON.stringify(await runFixture()))}
  catch(error){console.error(error);process.exitCode=1}
}else{
  const {beforeAll,describe,expect,test}=await import("bun:test");
  const {kb75Copy}=await import("../../apps/web/lib/i18n-groups/kb-75");
  let results:Results={};
  beforeAll(async()=>{
    const processChild=Bun.spawn([process.execPath,import.meta.path],{
      cwd:repo,env:{...process.env,KB75_FIXTURE_CHILD:"1"},stdout:"pipe",stderr:"pipe"});
    const [out,err,code]=await Promise.all([
      new Response(processChild.stdout).text(),new Response(processChild.stderr).text(),processChild.exited]);
    if(code!==0)throw Error(`KB75 clean child exit ${code}: ${err.slice(-5000)}`);
    results=JSON.parse(out.trim().split("\n").at(-1)??"{}");
  },process.env.KB75_CAPTURE_DIR ? 480_000 : 240_000);
  describe("KB-75 mounted admin approvals",()=>{
    test("dictionary keys match and Hebrew is present",()=>{
      expect(Object.keys(kb75Copy.en).sort()).toEqual(Object.keys(kb75Copy.he).sort());
      expect(kb75Copy.he.title).toContain("אישורי");
    });
    for(const name of [
      "loading distinct from zero","non-admin skips list query","empty list is explained",
      "pending count is qualified to shown rows","admin row has no decisions","exact status mutation arguments",
      "rapid same-row submit is single call","different rows remain pending independently",
      "A success leaves B pending","A error leaves B pending","same-row error has reachable retry",
      "raw backend error never appears","removed-row completion is discarded",
      "query controls status and reordering","focus recovers when initiating button disappears",
      "late completion never steals moved focus","English and Hebrew date labels and copy",
      "long email is isolated and wraps in RTL","phone and desktop matrix has one main h1 and 44 px actions",
      "visible focus and reduced motion","both named views render in interactive gallery",
    ])test(name,()=>expect(results[name]).toEqual({pass:true}));
  });
}
