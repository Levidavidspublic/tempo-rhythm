import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB78_FIXTURE_CHILD === "1";
type Results = Record<string, { pass: boolean; detail?: string }>;
// Exact integration 52bf280 source, frozen before editing; also permits honest CI before checks.
const originalControls = "\"use client\";\n\nimport { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from \"react\";\nimport { useLocale } from \"@/components/providers/LocaleProvider\";\nimport { TpIcon, type TpIconName } from \"@/components/tempo/TpIcon\";\n\nexport type SegmentedOption<T extends string> = { value: T; label: string; icon?: TpIconName };\n\n/**\n * Segmented (docs/design/v3/components.md): a radiogroup with one tab stop. Arrow keys move\n * and choose, wrapping, and swap direction in RTL.\n */\nexport function Segmented<T extends string>({\n  options,\n  value,\n  onChange,\n  label,\n  labelledBy,\n  disabled,\n}: {\n  options: readonly SegmentedOption<T>[];\n  value: T;\n  onChange: (next: T) => void;\n  label?: string;\n  labelledBy?: string;\n  disabled?: boolean;\n}) {\n  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {\n    const forward = event.key === \"ArrowRight\" || event.key === \"ArrowDown\";\n    const back = event.key === \"ArrowLeft\" || event.key === \"ArrowUp\";\n    if (!forward && !back) return;\n    event.preventDefault();\n    const rtl = getComputedStyle(event.currentTarget).direction === \"rtl\";\n    const horizontal = event.key === \"ArrowRight\" || event.key === \"ArrowLeft\";\n    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);\n    const next = options[(index + step + options.length) % options.length];\n    if (!next) return;\n    onChange(next.value);\n    const group = event.currentTarget.parentElement;\n    window.requestAnimationFrame(() =>\n      group?.querySelector<HTMLButtonElement>(`[data-value=\"${next.value}\"]`)?.focus()\n    );\n  };\n\n  return (\n    <div\n      className=\"tp-segmented\"\n      role=\"radiogroup\"\n      aria-label={label}\n      aria-labelledby={labelledBy}\n      data-component=\"Segmented\"\n    >\n      {options.map((option, index) => (\n        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control\n        <button\n          key={option.value}\n          className=\"tp-seg__opt\"\n          type=\"button\"\n          role=\"radio\"\n          data-value={option.value}\n          aria-checked={value === option.value}\n          tabIndex={value === option.value ? 0 : -1}\n          disabled={disabled}\n          onClick={() => onChange(option.value)}\n          onKeyDown={(event) => onKey(event, index)}\n        >\n          {option.icon ? <TpIcon name={option.icon} size=\"sm\" /> : null}\n          <span>{option.label}</span>\n        </button>\n      ))}\n    </div>\n  );\n}\n\n/** Switch: button role=switch with the visible On / Off word. */\nexport function Switch({\n  on,\n  onToggle,\n  label,\n  labelledBy,\n  describedBy,\n  disabled,\n}: {\n  on: boolean;\n  onToggle: () => void;\n  label?: string;\n  labelledBy?: string;\n  describedBy?: string;\n  disabled?: boolean;\n}) {\n  const { t } = useLocale();\n  return (\n    <button\n      className=\"tp-switch\"\n      type=\"button\"\n      role=\"switch\"\n      aria-checked={on}\n      aria-label={label}\n      aria-labelledby={labelledBy}\n      aria-describedby={describedBy}\n      disabled={disabled}\n      onClick={onToggle}\n      data-component=\"Switch\"\n    >\n      <span className=\"tp-switch__track\" aria-hidden=\"true\">\n        <span className=\"tp-switch__thumb\" />\n      </span>\n      <span className=\"tp-switch__state\" aria-hidden={label ? true : undefined}>\n        {on ? t(\"you.on\") : t(\"you.off\")}\n      </span>\n    </button>\n  );\n}\n\n/**\n * MobileSheet as a confirm (alert-dialog; sheet on phone, centred at 768 and up). Esc and the\n * Close button cancel, Tab stays inside, and focus returns to whatever opened it.\n */\nexport function ConfirmSheet({\n  title,\n  body,\n  confirmLabel,\n  cancelLabel,\n  busy,\n  onConfirm,\n  onClose,\n}: {\n  title: string;\n  body: ReactNode;\n  confirmLabel: string;\n  cancelLabel: string;\n  busy?: boolean;\n  onConfirm: () => void;\n  onClose: () => void;\n}) {\n  const { t } = useLocale();\n  const id = useId();\n  const sheetRef = useRef<HTMLElement>(null);\n  const cancelRef = useRef<HTMLButtonElement>(null);\n  const closeRef = useRef(onClose);\n  closeRef.current = onClose;\n\n  useEffect(() => {\n    const opener = document.activeElement as HTMLElement | null;\n    cancelRef.current?.focus();\n    const onKey = (event: globalThis.KeyboardEvent) => {\n      if (event.key === \"Escape\") {\n        event.preventDefault();\n        closeRef.current();\n        return;\n      }\n      if (event.key !== \"Tab\" || !sheetRef.current) return;\n      const focusable = Array.from(\n        sheetRef.current.querySelectorAll<HTMLElement>(\"button:not([disabled]), a[href]\")\n      );\n      const first = focusable[0];\n      const last = focusable.at(-1);\n      if (!first || !last) return;\n      if (event.shiftKey && document.activeElement === first) {\n        event.preventDefault();\n        last.focus();\n      } else if (!event.shiftKey && document.activeElement === last) {\n        event.preventDefault();\n        first.focus();\n      }\n    };\n    document.addEventListener(\"keydown\", onKey);\n    return () => {\n      document.removeEventListener(\"keydown\", onKey);\n      if (opener?.isConnected) opener.focus();\n    };\n  }, []);\n\n  return (\n    <>\n      <div className=\"tp-sheet-scrim\" aria-hidden=\"true\" />\n      <section\n        ref={sheetRef}\n        className=\"tp-sheet tp-glass\"\n        role=\"alertdialog\"\n        aria-modal=\"true\"\n        aria-labelledby={`${id}-title`}\n        aria-describedby={`${id}-body`}\n        data-component=\"MobileSheet\"\n      >\n        <span className=\"tp-sheet__grabber\" aria-hidden=\"true\" />\n        <div className=\"tp-sheet__head\">\n          <h2 className=\"tp-sheet__title\" id={`${id}-title`}>\n            {title}\n          </h2>\n          <button\n            className=\"tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close\"\n            type=\"button\"\n            aria-label={t(\"you.close\")}\n            onClick={onClose}\n          >\n            <TpIcon name=\"x\" />\n          </button>\n        </div>\n        <div className=\"tp-sheet__body\">\n          <p id={`${id}-body`}>{body}</p>\n        </div>\n        <div className=\"tp-sheet__foot\">\n          <button\n            ref={cancelRef}\n            className=\"tp-btn tp-btn--secondary\"\n            type=\"button\"\n            onClick={onClose}\n          >\n            {cancelLabel}\n          </button>\n          <button\n            className=\"tp-btn tp-btn--danger\"\n            type=\"button\"\n            disabled={busy}\n            onClick={onConfirm}\n          >\n            {confirmLabel}\n          </button>\n        </div>\n      </section>\n    </>\n  );\n}\n";
const originalHash = "2c5f1998fe329c67acbf604782eb1af2c2f90d94b270f5c91575c6436140ee9a";
const otherExportsHash = "5124c4660af9f99eedd876eec519225125106eefb3492c0e42f8d9ff114aa9ed";

const backend = `
import {useSyncExternalStore} from 'react';
const profile={email:'fictional@example.test'};
let view={enabled:true,status:'connected',connectedAt:1729296000000};
let version=0;const listeners=new Set();
const state={calls:[],held:[]};
window.__backend={state,settle(ok){const item=state.held.shift();if(!item)throw Error('No held fictional action');
 if(ok){view={enabled:true,status:'not_connected'};version++;for(const f of listeners)f();item.resolve({status:'disconnected',revokedAtProvider:true})}
 else item.reject(Error('SECRET_PROVIDER_DETAIL_NEVER_RENDER'));}};
function subscribe(f){listeners.add(f);return()=>listeners.delete(f)}
export function useConvexAuth(){return{isAuthenticated:true,isLoading:false}}
export function useQuery(ref,args){useSyncExternalStore(subscribe,()=>version,()=>version);if(args==='skip')return undefined;if(ref==='users.getProfile')return profile;if(ref==='connections.status')return view;throw Error('Unexpected query '+ref)}
export function useAction(ref){return async args=>{state.calls.push({ref,args});if(ref!=='connections.disconnect')throw Error('Unexpected action '+ref);return await new Promise((resolve,reject)=>state.held.push({resolve,reject}))}}
`;
const api = `export const api={users:{getProfile:'users.getProfile'},connections:{status:'connections.status',disconnect:'connections.disconnect',startExecutorConnect:'connections.startExecutorConnect',confirmExecutorConnect:'connections.confirmExecutorConnect'}};`;
const router = `const router={replace(){throw Error('Unexpected fixture redirect')}};export function useRouter(){return router}`;
const common = `
import {StrictMode,Suspense,startTransition,useState} from 'react';import {createRoot} from 'react-dom/client';
import {LocaleProvider,useLocale} from '@/components/providers/LocaleProvider';
import {TpIconSprite} from '@/components/tempo/TpIcon';
import {ExecutorConnection} from '@/components/settings/ExecutorConnection';
`;
const host = `function Host(){const{t}=useLocale();return <main className="tp-page tp-page--narrow"><h1>{t('set.integ.title')}</h1><button id="before" type="button">Before fictional connection</button><ExecutorConnection/><button id="after" type="button">After fictional connection</button></main>}`;
const currentEntry = common + `
import {ConfirmSheet,Segmented,Switch,Kb78Gallery} from '@/components/you/Controls';
${host}
window.__directCalls=[];window.__closes=[];
function Direct(){const[open,setOpen]=useState(false);const[busy,setBusy]=useState(false);const[version,setVersion]=useState(1);
 window.__direct={setBusy,setVersion,unmount(){setOpen(false)}};
 return <main data-version={version}><h1>Fictional confirmation</h1><button id="before">Before</button><button id="opener" onClick={()=>{setBusy(false);setOpen(true)}}>Open confirmation</button>
 {open?<ConfirmSheet title="Fictional connection" body={<><span>Only a fictional example.</span><input id="body-field" aria-label="Example field"/><a id="body-link" href="#example">Example link</a></>} confirmLabel={busy?'Waiting':'Accept example'} cancelLabel="Keep example" busy={busy}
 onConfirm={(...args)=>{window.__directCalls.push({version,args:args.length});setBusy(true)}} onClose={(...args)=>{window.__closes.push({version,args:args.length});setOpen(false)}}/>:null}<button id="after">After</button></main>}
const suspendedRender = new Promise(()=>{});
function SuspendVersion({version}){if(version===2){window.__pendingRendered=true;throw suspendedRender}return null}
function Concurrent(){const[open,setOpen]=useState(false);const[version,setVersion]=useState(1);
 window.__concurrent={suspend(){startTransition(()=>setVersion(2))}};
 return <main data-version={version}><h1>Fictional concurrent confirmation</h1><button id="opener" onClick={()=>setOpen(true)}>Open confirmation</button>
 {open?<><ConfirmSheet title="Committed confirmation" body="Only fictional data." confirmLabel="Accept example" cancelLabel="Keep example" busy={version===2}
 onConfirm={(...args)=>window.__directCalls.push({version,args:args.length})} onClose={(...args)=>{window.__closes.push({version,args:args.length});setOpen(false)}}/><SuspendVersion version={version}/></>:null}</main>}
function Others(){const[checked,setChecked]=useState(false);const[value,setValue]=useState('a');return <main><h1>Existing controls</h1><Switch on={checked} onToggle={()=>setChecked(x=>!x)} label="Existing switch"/><Segmented options={[{value:'a',label:'A'},{value:'b',label:'B'}]} value={value} onChange={setValue} label="Existing choices"/></main>}
const mode=new URLSearchParams(location.search).get('mode');
const content=mode==='concurrent'?<Suspense fallback={<p>Waiting for fictional render</p>}><Concurrent/></Suspense>:mode==='gallery'?<Kb78Gallery/>:mode==='others'?<Others/>:mode==='direct'||mode==='strict'?<Direct/>:<Host/>;
createRoot(document.getElementById('app')).render(<LocaleProvider><TpIconSprite/>{mode==='strict'?<StrictMode>{content}</StrictMode>:content}</LocaleProvider>);
`;
const beforeEntry = common + host + `createRoot(document.getElementById('app')).render(<LocaleProvider><TpIconSprite/><Host/></LocaleProvider>);`;

async function runFixture(): Promise<Results> {
  const { chromium, expect: pw } = await import("@playwright/test");
  const {translate} = await import("../../apps/web/lib/i18n");
  const {kb78Copy} = await import("../../apps/web/lib/i18n-groups/kb-78");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs")).default;
  const web = join(repo, "apps/web"), temp = join(repo, "work/kb78-fixture");
  await mkdir(temp, { recursive: true });
  await Promise.all([writeFile(join(temp,"backend.ts"),backend),writeFile(join(temp,"api.ts"),api),writeFile(join(temp,"router.ts"),router),writeFile(join(temp,"current.tsx"),currentEntry),writeFile(join(temp,"before.tsx"),beforeEntry),writeFile(join(temp,"original-controls.tsx"),originalControls)]);
  const globals=join(web,"app/globals.css");
  const baseCss=(await postcss([tailwind({base:repo})]).process(await readFile(globals,"utf8"),{from:globals})).css;
  const layoutFonts=`@font-face{font-family:Kb78Newsreader;src:url('/fonts/newsreader/Newsreader-latin.woff2') format('woff2');font-weight:400 700;font-style:normal;font-display:swap}:root{--font-newsreader:Kb78Newsreader;--font-ibm-mono:monospace}`;
  const build=async(before:boolean)=>{
    const built=await Bun.build({entrypoints:[join(temp,before?"before.tsx":"current.tsx")],target:"browser",define:{"process.env.NODE_ENV":'"test"'},plugins:[{name:"kb78-clean-fixture",setup(b){
      b.onResolve({filter:/^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/},({path})=>({path:Bun.resolveSync(path,web)}));
      b.onResolve({filter:/^convex\/react$/},()=>({path:join(temp,"backend.ts")}));
      b.onResolve({filter:/^next\/navigation$/},()=>({path:join(temp,"router.ts")}));
      b.onResolve({filter:/^@\/convex\/_generated\/api$/},()=>({path:join(temp,"api.ts")}));
      if(before)b.onResolve({filter:/^@\/components\/you\/Controls$/},()=>({path:join(temp,"original-controls.tsx")}));
      b.onResolve({filter:/^@\//},({path})=>({path:Bun.resolveSync(path,web)}));
    }}]});
    if(!built.success)throw Error(built.logs.map(String).join("\n"));
    return {js:await built.outputs.find(o=>o.path.endsWith(".js"))!.text(),css:(await Promise.all(built.outputs.filter(o=>o.path.endsWith(".css")).map(o=>o.text()))).join("\n")};
  };
  const current=await build(false),before=await build(true);
  if(process.env.KB78_BUNDLE_ONLY==="1")return {bundle:{pass:!!(baseCss&&current.js&&before.js)}};
  const fontFiles=new Map<string,string>();
  for await(const name of new Bun.Glob("**/*.woff*").scan({cwd:join(web,"fonts")}))fontFiles.set("/fonts/"+name,join(web,"fonts",name));
  const fontRequests=new Set<string>();
  const server=Bun.serve({hostname:"127.0.0.1",port:0,fetch(request){
    const url=new URL(request.url),phase=url.searchParams.get("phase")==="before"?before:current;
    if(fontFiles.has(url.pathname)){fontRequests.add(url.pathname);return new Response(Bun.file(fontFiles.get(url.pathname)!),{headers:{"content-type":url.pathname.endsWith(".woff2")?"font/woff2":"font/woff"}})}
    if(url.pathname==="/app.js")return new Response(phase.js,{headers:{"content-type":"text/javascript; charset=utf-8"}});
    if(url.pathname==="/styles.css")return new Response(baseCss+"\n"+layoutFonts+"\n"+phase.css,{headers:{"content-type":"text/css; charset=utf-8"}});
    if(url.pathname==="/favicon.ico")return new Response(null,{status:204});
    if(url.pathname!=="/")return new Response("Not found",{status:404});
    const lang=url.searchParams.get("lang")==="he"?"he":"en",theme=url.searchParams.get("theme")==="dark"?"dark":"light",tag=url.searchParams.get("phase")==="before"?"before":"current";
    return new Response(`<!doctype html><html lang="${lang}" dir="${lang==='he'?'rtl':'ltr'}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KB-78 fixture</title><link rel="stylesheet" href="/styles.css?phase=${tag}"></head><body><div id="app"></div><script src="/app.js?phase=${tag}"></script></body></html>`,{headers:{"content-type":"text/html; charset=utf-8"}});
  }});
  const executable=[chromium.executablePath(),"/usr/bin/chromium","/usr/bin/google-chrome","/usr/bin/chromium-browser"].find(existsSync);
  if(!executable)throw Error("KB78 needs installed Chromium/Chrome; browser cases never skip");
  const browser=await chromium.launch({executablePath:executable,args:["--no-sandbox"]});
  const results:Results={},traces:Record<string,unknown>={};
  const errors:string[]=[];
  const page=async(mode="host",phase="current",lang="en",theme="light",width=390)=>{
    const p=await browser.newPage({viewport:{width,height:844},reducedMotion:"reduce"});p.setDefaultTimeout(7000);
    p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    await p.goto(`${server.url}?mode=${mode}&phase=${phase}&lang=${lang}&theme=${theme}`);await p.locator("h1").waitFor();await p.evaluate(()=>document.fonts.ready);
    return p;
  };
  const record=async(name:string,fn:()=>Promise<void>)=>{try{await fn();results[name]={pass:true}}catch(e){results[name]={pass:false,detail:String(e)}}};
  const inside=(p:any)=>p.evaluate(()=>!!document.activeElement?.closest('[role="alertdialog"]'));
  const openHost=async(p:any)=>{await p.locator('[data-action="disconnect"]').click();await p.getByRole("alertdialog").waitFor()};
  const openDirect=async(p:any)=>{await p.locator("#opener").click();await p.getByRole("alertdialog").waitFor()};
  const confirm=(p:any)=>p.locator('[role="alertdialog"] .tp-sheet__foot button').last();
  try{
    await record("actual caller original escape and current Enter pending Tab containment",async()=>{
      for(const phase of ["before","current"]){const p=await page("host",phase);await openHost(p);await confirm(p).focus();await p.keyboard.press("Enter");
        await pw(p.getByRole("alertdialog")).toBeVisible();await p.waitForFunction(()=>window.__backend.state.calls.length===1);
        const activeBefore=await p.evaluate(()=>document.activeElement?.tagName);await p.keyboard.press("Tab");
        const contained=await inside(p);traces[phase]={activeBefore,contained,calls:await p.evaluate(()=>window.__backend.state.calls)};
        if(phase==="before"){pw(activeBefore).toBe("BODY");await pw(p.locator("#after")).toBeFocused();pw(contained).toBe(false)}else pw(contained).toBe(true);await p.close();}
    });
    await record("Shift Tab stays inside the busy real caller",async()=>{const p=await page();await openHost(p);await confirm(p).focus();await p.keyboard.press("Enter");await pw(confirm(p)).toHaveAttribute("aria-disabled","true");await p.keyboard.press("Shift+Tab");pw(await inside(p)).toBe(true);await p.close()});
    await record("pointer accepted action retains focus while pending",async()=>{const p=await page();await openHost(p);await confirm(p).click();await pw(confirm(p)).toBeFocused();await pw(p.getByRole("alertdialog")).toHaveAttribute("aria-busy","true");await p.keyboard.press("Tab");pw(await inside(p)).toBe(true);await p.close()});
    await record("busy Enter Space and pointer repeat send one unchanged call",async()=>{const p=await page();await openHost(p);await confirm(p).click();await pw(confirm(p)).toHaveAttribute("aria-disabled","true");await p.keyboard.press("Enter");await p.keyboard.press("Space");const hit=await confirm(p).boundingBox();if(!hit)throw Error("Missing busy control bounds");await p.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);pw(await p.evaluate(()=>window.__backend.state.calls)).toEqual([{ref:"connections.disconnect",args:{provider:"executor"}}]);await p.close()});
    await record("normal forward and reverse wrapping includes available body controls",async()=>{const p=await page("direct");await openDirect(p);const first=p.locator('[role="alertdialog"] button').first();await confirm(p).focus();await p.keyboard.press("Tab");await pw(first).toBeFocused();await p.keyboard.press("Shift+Tab");await pw(confirm(p)).toBeFocused();await first.focus();await p.keyboard.press("Tab");await pw(p.locator("#body-field")).toBeFocused();await p.close()});
    await record("lost outside focus recovers in either direction",async()=>{const p=await page("direct");await openDirect(p);await p.locator("#after").focus();await p.keyboard.press("Tab");await pw(p.locator('[role="alertdialog"] button').first()).toBeFocused();await p.locator("#before").focus();await p.keyboard.press("Shift+Tab");await pw(confirm(p)).toBeFocused();await p.close()});
    await record("Cancel receives initial safe focus",async()=>{const p=await page("direct");await openDirect(p);await pw(p.getByRole("button",{name:"Keep example",exact:true})).toBeFocused();await p.close()});
    await record("Escape Close and Cancel restore the existing opener",async()=>{for(const method of ["escape","close","cancel"]){const p=await page("direct");await openDirect(p);if(method==="escape")await p.keyboard.press("Escape");else if(method==="close")await p.locator('[role="alertdialog"] button').first().click();else await p.getByRole("button",{name:"Keep example",exact:true}).click();await pw(p.getByRole("alertdialog")).toHaveCount(0);await pw(p.locator("#opener")).toBeFocused();pw(await p.evaluate(()=>window.__closes[0].args)).toBe(0);await p.close()}});
    await record("busy explicit closing still follows the parent callback",async()=>{const p=await page("direct");await openDirect(p);await confirm(p).click();await p.getByRole("button",{name:"Keep example",exact:true}).click();await pw(p.getByRole("alertdialog")).toHaveCount(0);pw(await p.evaluate(()=>window.__closes.length)).toBe(1);await p.close()});
    await record("real parent success closes and updates its own connection state",async()=>{const p=await page();await openHost(p);await confirm(p).click();await p.evaluate(()=>window.__backend.settle(true));await pw(p.getByRole("alertdialog")).toHaveCount(0);await pw(p.locator('[data-action="connect"]')).toBeVisible();pw(await p.evaluate(()=>window.__backend.state.calls.length)).toBe(1);await p.close()});
    await record("real parent rejection owns error and closing without raw detail",async()=>{const p=await page();await openHost(p);await confirm(p).click();await p.evaluate(()=>window.__backend.settle(false));await pw(p.getByRole("alertdialog")).toHaveCount(0);await pw(p.getByRole("alert")).toBeVisible();pw(await p.locator("body").innerText()).not.toContain("SECRET_PROVIDER_DETAIL");await pw(p.locator('[data-action="disconnect"]')).toBeVisible();await p.close()});
    await record("suspended render cannot replace committed callbacks or busy state",async()=>{
      const p=await page("concurrent");await openDirect(p);await p.evaluate(()=>window.__concurrent.suspend());
      await p.waitForFunction(()=>window.__pendingRendered===true);await pw(p.locator("main")).toHaveAttribute("data-version","1");
      await pw(confirm(p)).not.toHaveAttribute("aria-disabled","true");await confirm(p).click();await p.keyboard.press("Escape");
      traces.suspendedRender=await p.evaluate(()=>({confirms:window.__directCalls,closes:window.__closes}));pw(await p.evaluate(()=>window.__directCalls)).toEqual([{version:1,args:0}]);pw(await p.evaluate(()=>window.__closes)).toEqual([{version:1,args:0}]);await p.close();
    });
    // evaluate(setState) schedules React work; the DOM marker proves the new callback committed.
    await record("fresh callbacks receive no event arguments",async()=>{const p=await page("direct");await openDirect(p);await p.evaluate(()=>window.__direct.setVersion(2));await pw(p.locator("main")).toHaveAttribute("data-version","2");await confirm(p).click();pw(await p.evaluate(()=>window.__directCalls)).toEqual([{version:2,args:0}]);await p.evaluate(()=>window.__direct.setVersion(3));await pw(p.locator("main")).toHaveAttribute("data-version","3");await p.keyboard.press("Escape");pw(await p.evaluate(()=>window.__closes)).toEqual([{version:3,args:0}]);await p.close()});
    // An unmount request is not cleanup: verify removal/restoration before probing for leaked listeners.
    await record("StrictMode unmount removes listeners and restores once",async()=>{const p=await page("strict");await openDirect(p);await p.keyboard.press("Escape");await pw(p.locator("#opener")).toBeFocused();await p.keyboard.press("Escape");pw(await p.evaluate(()=>window.__closes.length)).toBe(1);await openDirect(p);await p.evaluate(()=>window.__direct.unmount());await pw(p.getByRole("alertdialog")).toHaveCount(0);await pw(p.locator("#opener")).toBeFocused();await p.keyboard.press("Escape");pw(await p.evaluate(()=>window.__closes.length)).toBe(1);await p.close()});
    await record("Segmented and Switch keep their existing runtime behavior",async()=>{const p=await page("others");const sw=p.getByRole("switch");await sw.click();await pw(sw).toHaveAttribute("aria-checked","true");const a=p.getByRole("radio",{name:"A",exact:true}),b=p.getByRole("radio",{name:"B",exact:true});await a.focus();await p.keyboard.press("ArrowRight");await pw(b).toHaveAttribute("aria-checked","true");await pw(b).toBeFocused();await p.close()});
    await record("parent busy remains authoritative without an inferred lifetime",async()=>{const p=await page("direct");await openDirect(p);await confirm(p).click();await pw(confirm(p)).toHaveAttribute("aria-disabled","true");await p.evaluate(()=>window.__direct.setBusy(false));await pw(confirm(p)).not.toHaveAttribute("aria-disabled","true");await confirm(p).click();pw(await p.evaluate(()=>window.__directCalls.length)).toBe(2);await p.close()});
    await record("English Hebrew RTL and real gallery states",async()=>{for(const lang of ["en","he"]){const p=await page("gallery","current",lang);pw(await p.locator("html").getAttribute("dir")).toBe(lang==="he"?"rtl":"ltr");await pw(p.locator("h1")).toHaveText(kb78Copy[lang].title);await p.locator("main > button").click();await confirm(p).click();await pw(confirm(p)).toHaveAttribute("aria-disabled","true");await p.locator(".kb78-gallery-settle button").first().click();await pw(p.getByRole("alertdialog")).toHaveCount(0);await pw(p.locator(".kb78-gallery-result")).toHaveText(kb78Copy[lang].success);await p.locator("main > button").click();await confirm(p).click();await p.locator(".kb78-gallery-settle button").last().click();await pw(p.getByRole("alertdialog")).toHaveCount(0);await p.close()}});
    await record("exact UTF8 production copy and actual shell icons render",async()=>{for(const lang of ["en","he"] as const)for(const phase of ["before","current"]){const p=await page("host",phase,lang);await openHost(p);await pw(p.getByRole("alertdialog").getByRole("heading")).toHaveText(translate(lang,"exec.confirm.title"));await confirm(p).focus();await p.keyboard.press("Enter");await pw(confirm(p)).toHaveText(translate(lang,"exec.disconnecting"));pw(await p.locator("body").innerText()).not.toMatch(/[×âÂ]/);pw(await p.evaluate(()=>Array.from(document.querySelectorAll("svg use")).every(use=>{const href=use.getAttribute("href");return !!href&&!!document.querySelector(href)}))).toBe(true);await pw(p.locator("symbol#i-x")).toHaveCount(1);await p.close()}});
    await record("visible focus and reduced motion stay available while busy",async()=>{const p=await page();await openHost(p);await confirm(p).focus();await p.keyboard.press("Enter");const style=await confirm(p).evaluate(el=>{const s=getComputedStyle(el);return{outline:s.outlineStyle,width:parseFloat(s.outlineWidth),duration:s.transitionDuration}});pw(style.outline).not.toBe("none");pw(style.width).toBeGreaterThanOrEqual(2);pw(style.duration.split(",").every(x=>parseFloat(x)<=0.0001)).toBe(true);await p.close()});
    await record("390 1280 light dark matrix has 44px targets and no overflow",async()=>{
      const capture=process.env.KB78_CAPTURE_DIR;if(capture)await mkdir(capture,{recursive:true});
      for(const width of [390,1280])for(const lang of ["en","he"])for(const theme of ["light","dark"])for(const mode of ["before","current","gallery"]){
        const p=await page(mode==="gallery"?"gallery":"host",mode==="before"?"before":"current",lang,theme,width);
        if(mode==="gallery")await p.locator("main > button").click();else await openHost(p);
        await confirm(p).focus();await p.keyboard.press("Enter");await p.keyboard.press("Tab");await p.evaluate(()=>document.fonts.ready);
        await pw(p.getByRole("alertdialog").getByRole("heading")).toHaveText(mode==="gallery"?kb78Copy[lang].confirmTitle:translate(lang,"exec.confirm.title"));
        pw(await p.locator("body").innerText()).not.toMatch(/[×âÂ]/);
        const metrics=await p.evaluate(()=>({main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth,buttons:Array.from(document.querySelectorAll('[role="alertdialog"] button')).map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})),fonts:Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family)}));
        pw(metrics.main).toBe(1);pw(metrics.h1).toBe(1);pw(metrics.overflow).toBe(false);
        if(mode!=="before"){pw(metrics.buttons.every(x=>x.w>=44&&x.h>=44)).toBe(true);pw(await inside(p)).toBe(true)}
        pw(metrics.fonts.some(f=>f.includes(lang==="he"?"Assistant":"Source Sans 3"))).toBe(true);
        if(capture)await p.screenshot({path:join(capture,`${mode}-${width}-${lang}-${theme}.png`)});await p.close();
      }
    });
    await record("real fonts are served and fixture console stays clean",async()=>{pw(fontRequests.size).toBeGreaterThanOrEqual(4);pw(errors).toEqual([])});
  }finally{await browser.close();server.stop(true)}
  await writeFile(join(temp,"traces.json"),JSON.stringify({traces,fontRequests:[...fontRequests],errors},null,2));
  return results;
}

if(child){try{console.log(JSON.stringify(await runFixture()))}catch(e){console.error(e);process.exitCode=1}}
else{
  const {beforeAll,describe,expect,test}=await import("bun:test");
  const {kb78Copy}=await import("../../apps/web/lib/i18n-groups/kb-78");
  let results:Results={};
  beforeAll(async()=>{const p=Bun.spawn([process.execPath,import.meta.path],{cwd:repo,env:{...process.env,KB78_FIXTURE_CHILD:"1"},stdout:"pipe",stderr:"pipe"});const[out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code!==0)throw Error(`KB78 clean child ${code}: ${err.slice(-6000)}`);results=JSON.parse(out.trim().split("\n").at(-1)??"{}");},process.env.KB78_CAPTURE_DIR?480_000:240_000);
  describe("KB-78 actual confirm pending focus",()=>{
    test("dictionary parity and exact frozen source preserve the other exports",async()=>{
      expect(Object.keys(kb78Copy.en).sort()).toEqual(Object.keys(kb78Copy.he).sort());expect(kb78Copy.he.title).toContain("אישור");
      expect(createHash("sha256").update(originalControls).digest("hex")).toBe(originalHash);
      const source=await readFile(join(repo,"apps/web/components/you/Controls.tsx"),"utf8");const section=source.slice(source.indexOf("export type SegmentedOption"),source.indexOf('/**\n * MobileSheet'));
      expect(createHash("sha256").update(section).digest("hex")).toBe(otherExportsHash);
    });
    for(const name of [
      "actual caller original escape and current Enter pending Tab containment","Shift Tab stays inside the busy real caller","pointer accepted action retains focus while pending","busy Enter Space and pointer repeat send one unchanged call","normal forward and reverse wrapping includes available body controls","lost outside focus recovers in either direction","Cancel receives initial safe focus","Escape Close and Cancel restore the existing opener","busy explicit closing still follows the parent callback","real parent success closes and updates its own connection state","real parent rejection owns error and closing without raw detail","suspended render cannot replace committed callbacks or busy state","fresh callbacks receive no event arguments","StrictMode unmount removes listeners and restores once","Segmented and Switch keep their existing runtime behavior","parent busy remains authoritative without an inferred lifetime","English Hebrew RTL and real gallery states","exact UTF8 production copy and actual shell icons render","visible focus and reduced motion stay available while busy","390 1280 light dark matrix has 44px targets and no overflow","real fonts are served and fixture console stays clean",
    ])test(name,()=>expect(results[name]).toEqual({pass:true}));
  });
}
