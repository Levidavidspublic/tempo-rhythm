import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, expect as pwExpect, type Browser, type Page } from "@playwright/test";
import { ActivityEndStatus, ActivityLoadMore, Kb66Gallery } from "../../apps/web/components/activity/ActivityScreen";
import { en, he } from "../../apps/web/lib/i18n-groups/kb-66";

const root = join(import.meta.dir, "../..");
const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("KB-66 activity reading position", () => {
  test("load-more view names the currently visible count and preserves LTR numerals", () => {
    const html = render(createElement(ActivityLoadMore, { shown: 20, total: 31, lang: "en", onLoad() {} }));
    expect(html).toContain("Showing");
    expect(html).toContain('<bdi dir="ltr" class="tp-num">20</bdi>');
    expect(html).toContain('<bdi dir="ltr" class="tp-num">31</bdi>');
    expect(html).toContain("Show older");
  });

  test("end view describes the current snapshot rather than all history", () => {
    const html = render(createElement(ActivityEndStatus, { shown: 21, total: 21, lang: "en" }));
    expect(html).toContain("All currently available activity is shown.");
    expect(html).toContain('<bdi dir="ltr" class="tp-num">21</bdi>');
    expect(html).not.toContain("all historical");
  });

  test("Hebrew count and end message keep numbers isolated", () => {
    const html = render(createElement(ActivityEndStatus, { shown: 30, total: 30, lang: "he" }));
    expect(html).toContain("מוצגים");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("הזמינה כרגע");
  });

  test("Hebrew load-more control remains a real button", () => {
    const html = render(createElement(ActivityLoadMore, { shown: 20, total: 31, lang: "he", onLoad() {} }));
    expect(html).toContain("הצגת ישנים יותר");
    expect(html).toContain('type="button"');
  });

  test("gallery statically mounts the actual activity heading and feed views", () => {
    const html = render(createElement(Kb66Gallery));
    expect((html.match(/<main\b/g) ?? []).length).toBe(1);
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(html).toContain('data-component="ActivityLoadMore"');
    expect(html).toContain("Maya");
  });

  test("mounted caller and exact query contract remain wired", async () => {
    const source = await readFile(join(root, "apps/web/components/activity/ActivityScreen.tsx"), "utf8");
    const route = await readFile(join(root, "apps/web/app/(tempo)/activity/page.tsx"), "utf8");
    expect(source).toContain('useQuery(api.users.getProfile, isAuthenticated ? {} : "skip")');
    expect(source).toContain('useQuery(api.activity.list, isAuthenticated && profile ? {} : "skip")');
    expect(source).toContain("groupByDay(activity ?? [], bounds.startMs)");
    expect(source).toContain("firstRows(groups, limit)");
    expect(route).toContain("<ActivityScreen />");
  });

  test("English and machine-drafted Hebrew keys have parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });
});

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
let directory: string;

async function fixture(width = 390, lang: "en" | "he" = "en", probe = false, strict = false): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.port}/?lang=${lang}${probe ? "&probe=1" : ""}${strict ? "&strict=1" : ""}`, { waitUntil: "domcontentloaded" });
  try { await pwExpect(page.locator("main")).toHaveCount(1, { timeout: 20_000 }); }
  catch { throw new Error(`KB-66 fixture did not hydrate: ${errors.join(" | ")}`); }
  await pwExpect(page.locator("h1")).toHaveCount(1);
  return page;
}

async function setActivityCount(page: Page, count: number) {
  await page.evaluate((next) => {
    (window as any).__kb66Activity = (window as any).__kb66Activity.slice(0, next);
    window.dispatchEvent(new Event("kb66-query"));
  }, count);
  await pwExpect(page.locator("[data-kb66-row-id]")).toHaveCount(Math.min(count, 20));
}

describe("KB-66 hydrated activity gallery and mounted screen", () => {
  beforeAll(async () => {
    await mkdir(join(root, "work"), { recursive: true });
    directory = await mkdtemp(join(root, "work/kb66-gallery-"));
    const reactPath = join(root, "apps/web/node_modules/react");
    const source = join(root, "apps/web/components/activity/ActivityScreen.tsx");
    const mockQuery = join(directory, "mock-query.tsx");
    const mockLink = join(directory, "mock-link.tsx");
    const mockApi = join(directory, "mock-api.ts");
    const mockBounds = join(directory, "mock-bounds.ts");
    await writeFile(mockQuery, `import React from ${JSON.stringify(reactPath)};\nconst now=Date.now();const names=["Maya","Dana","Yoni"];window.__kb66Activity=Array.from({length:31},(_,i)=>({id:"a"+i,kind:i%3===0?"task":i%3===1?"note":"habit",action:i%3===0?"Completed task":i%3===1?"Created note":"Logged habit",title:names[i%3]+"'s activity "+(i+1),href:"/tasks/a"+i,occurredAt:now-i*60000}));export function useConvexAuth(){return {isAuthenticated:true,isLoading:false}};export function useQuery(ref){const[version,setVersion]=React.useState(0);React.useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener("kb66-query",refresh);return()=>window.removeEventListener("kb66-query",refresh)},[]);void version;return ref==="profile"?{greetingName:"Maya"}:window.__kb66Activity}`);
    await writeFile(mockLink, `import React from ${JSON.stringify(reactPath)};export default function Link({href,children,...rest}){return React.createElement("a",{href,...rest},children)}`);
    await writeFile(mockApi, `export const api={users:{getProfile:"profile"},activity:{list:"activity"}};`);
    await writeFile(mockBounds, `export function useLocalDayBounds(){const today=new Date();today.setHours(0,0,0,0);return {startMs:today.getTime()}}`);
    const entry = join(directory, "entry.tsx");
    await writeFile(entry, `import React from ${JSON.stringify(reactPath)};import{createRoot}from ${JSON.stringify(join(root,"apps/web/node_modules/react-dom/client"))};import{TpIconSprite}from ${JSON.stringify(join(root,"apps/web/components/tempo/TpIcon.tsx"))};import{LocaleProvider}from ${JSON.stringify(join(root,"apps/web/components/providers/LocaleProvider.tsx"))};import{ActivityScreen,Kb66Gallery}from ${JSON.stringify(source)};const params=new URLSearchParams(location.search);const lang=params.get("lang")==="he"?"he":"en";const view=params.has("probe")?React.createElement(LocaleProvider,null,React.createElement("main",null,React.createElement(ActivityScreen))):React.createElement(Kb66Gallery,{initialLang:lang});const tree=React.createElement(React.Fragment,null,React.createElement(TpIconSprite),view,React.createElement("button",{id:"kb66-away"},"Other action"));createRoot(document.getElementById("root")).render(params.has("strict")?React.createElement(React.StrictMode,null,tree):tree);`);
    const mocks: Record<string,string> = { "convex/react":mockQuery, "next/link":mockLink, "@/convex/_generated/api":mockApi, "@/lib/useLocalDayBounds":mockBounds };
    const bundle = await Bun.build({ entrypoints:[entry], target:"browser", minify:false,
      alias:{ "react-native":join(root,"apps/web/node_modules/react-native-web") },
      plugins:[{ name:"kb66-browser-stubs", setup(build) {
        build.onResolve({ filter:/^(convex\/react|next\/link|@\/convex\/_generated\/api|@\/lib\/useLocalDayBounds)$/ }, ({path})=>({path:mocks[path]??path}));
      }}],
    });
    if(!bundle.success)throw new Error(`KB-66 bundle failed: ${bundle.logs.map(String).join(" | ")}`);
    const script=await bundle.outputs.find((output)=>output.path.endsWith(".js"))?.text();
    if(!script)throw new Error("KB-66 bundle had no JavaScript output");
    const css=await Promise.all(["docs/design/v3/tokens.css","apps/web/app/tempo.css","apps/web/app/globals.css","apps/web/app/v3/you.css","apps/web/app/v3/kb-66.css"].map((file)=>readFile(join(root,file),"utf8")));
    const generated=await Promise.all(bundle.outputs.filter((output)=>output.path.endsWith(".css")).map((output)=>output.text()));
    const html=`<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.join("\n")}\n${generated.join("\n")}</style></head><body style="margin:0;background:var(--tp-ground);color:var(--tp-ink)"><div id="root" style="max-width:760px;margin:auto;padding:16px"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script src="/bundle.js"></script></body></html>`;
    server=Bun.serve({hostname:"127.0.0.1",port:0,fetch(request){const url=new URL(request.url);const page=url.searchParams.get("lang")==="he"?html.replace('<html lang="en" dir="ltr">','<html lang="he" dir="rtl">'):html;const isScript=url.pathname==="/bundle.js";return new Response(isScript?script:page,{headers:{"Content-Type":isScript?"text/javascript; charset=utf-8":"text/html; charset=utf-8"}})}});
    const bundledBrowser=chromium.executablePath();
    const systemBrowser=["/usr/bin/chromium","/usr/bin/google-chrome"].find(existsSync);
    if(!existsSync(bundledBrowser)&&!systemBrowser)throw new Error("No Chromium installed for KB-66 browser checks");
    browser=await chromium.launch({...(existsSync(bundledBrowser)?{}:{executablePath:systemBrowser}),args:["--no-sandbox"]});
  }, 120_000);

  afterAll(async()=>{await browser?.close();server?.stop();if(directory)await rm(directory,{recursive:true,force:true});});

  test("no entries retain the mounted empty view and no paging control", async () => {
    const page=await fixture(390,"en",true);
    try { await setActivityCount(page,0); await pwExpect(page.getByText("Your activity will collect here")).toBeVisible(); await pwExpect(page.getByRole("button",{name:"Show older"})).toHaveCount(0); }
    finally { await page.close(); }
  },120_000);

  test("exactly 20 items show a current-snapshot end without a button", async () => {
    const page=await fixture(390,"en",true);
    try { await setActivityCount(page,20); await pwExpect(page.locator(".kb66-end")).toContainText("Showing 20 of 20"); await pwExpect(page.getByRole("button",{name:"Show older"})).toHaveCount(0); }
    finally { await page.close(); }
  },120_000);

  test("21 items focus the new row after final-button removal", async () => {
    const page=await fixture(390,"en",true);
    try { await setActivityCount(page,21); const button=page.getByRole("button",{name:"Show older"}); await button.focus(); await page.keyboard.press("Enter"); await pwExpect(button).toHaveCount(0); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await pwExpect(page.locator(".kb66-end")).toContainText("21 of 21"); expect(await page.locator('[data-kb66-row-id="a20"]').getAttribute("tabindex")).toBe("-1"); }
    finally { await page.close(); }
  },120_000);

  test("30 exactly completes in one chunk and keeps the new row in view", async () => {
    const page=await fixture(390,"en",true);
    try { await setActivityCount(page,30); await page.getByRole("button",{name:"Show older"}).focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await pwExpect(page.locator(".kb66-end")).toContainText("30 of 30"); }
    finally { await page.close(); }
  },120_000);

  test("31 items require two chunks and focus rows 21 then 31", async () => {
    const page=await fixture(390,"en",true);
    try { const button=page.getByRole("button",{name:"Show older"}); await button.focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await pwExpect(button).toBeVisible(); await button.focus(); await page.keyboard.press("Enter"); await pwExpect(button).toHaveCount(0); await pwExpect(page.locator('[data-kb66-row-id="a30"]')).toBeFocused(); await pwExpect(page.locator("output[aria-live=polite]")).toContainText("31"); }
    finally { await page.close(); }
  },120_000);

  test("focus moved elsewhere during a load remains there", async () => {
    const page=await fixture(390,"en",true);
    try { await setActivityCount(page,21); await page.evaluate(()=>{const button=[...document.querySelectorAll("button")].find((value)=>value.textContent?.includes("Show older"));button?.click();document.getElementById("kb66-away")?.focus()}); await pwExpect(page.locator("#kb66-away")).toBeFocused(); await pwExpect(page.locator(".kb66-end")).toBeVisible(); }
    finally { await page.close(); }
  },120_000);

  test("Hebrew direction, time and counts remain readable", async () => {
    const page=await fixture(390,"he",true);
    try { await pwExpect(page.locator("html")).toHaveAttribute("dir","rtl"); await pwExpect(page.locator("h2").first()).toContainText(/\d/); await pwExpect(page.locator(".kb66-load-more bdi").first()).toHaveAttribute("dir","ltr"); expect(await page.locator("time").first().evaluate((value)=>getComputedStyle(value).direction)).toBe("ltr"); }
    finally { await page.close(); }
  },120_000);

  test("StrictMode announces each loaded count once and transfers focus once", async () => {
    const page=await fixture(390,"en",true,true);
    try { await setActivityCount(page,21); await page.getByRole("button",{name:"Show older"}).focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await pwExpect(page.locator("output[aria-live=polite]")).toHaveCount(1); await pwExpect(page.locator("output[aria-live=polite]")).toContainText("21"); }
    finally { await page.close(); }
  },120_000);

  test("reactive insertion alone does not steal focus and next chunk uses its stable boundary", async () => {
    const page=await fixture(390,"en",true);
    try { const button=page.getByRole("button",{name:"Show older"}); await button.focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await page.evaluate(()=>{const items=(window as any).__kb66Activity;items.unshift({...items[0],id:"new-activity",title:"Dana's new activity",occurredAt:Date.now()});window.dispatchEvent(new Event("kb66-query"))}); await pwExpect(page.locator('[data-kb66-row-id="new-activity"]')).toBeVisible(); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused(); await button.focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a29"]')).toBeFocused(); }
    finally { await page.close(); }
  },120_000);

  test("gallery controls and retry callback remain operable", async () => {
    const page=await fixture();
    try { await page.getByRole("button",{name:"Error example"}).click(); await pwExpect(page.getByRole("button",{name:"Try again"})).toBeVisible(); await page.getByRole("button",{name:"Try again"}).click(); await pwExpect(page.getByRole("button",{name:"Show older"})).toBeVisible(); await page.getByRole("button",{name:"0 items"}).click(); await pwExpect(page.getByText("No recent activity")).toBeVisible(); await page.getByRole("button",{name:"31 items"}).click(); await pwExpect(page.getByRole("button",{name:"Show older"})).toBeVisible(); await page.getByRole("button",{name:"New activity arrived"}).click(); await pwExpect(page.getByText("Dana's new activity")).toBeVisible(); await page.getByRole("button",{name:"עברית"}).click(); await pwExpect(page.locator("html")).toHaveAttribute("dir","rtl"); await page.getByRole("button",{name:"English"}).click(); await pwExpect(page.locator("html")).toHaveAttribute("dir","ltr"); }
    finally { await page.close(); }
  },120_000);

  test("mounted production view and gallery fit phone and desktop in both languages and themes", async () => {
    for(const width of [390,1280])for(const lang of ["en","he"] as const){
      const page=await fixture(width,lang,true);
      try {
        const button=page.getByRole("button",{name:lang==="he"?"הצגת ישנים יותר":"Show older"});
        await button.focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a20"]')).toBeFocused();
        await button.focus(); await page.keyboard.press("Enter"); await pwExpect(page.locator('[data-kb66-row-id="a30"]')).toBeFocused();
        await page.screenshot({path:join(root,"work",`kb66-mounted-final-${width}-${lang}-light.png`),fullPage:true});
        await page.evaluate(()=>document.documentElement.setAttribute("data-theme","dark"));
        await page.screenshot({path:join(root,"work",`kb66-mounted-final-${width}-${lang}-dark.png`),fullPage:true});
        await page.evaluate(()=>document.documentElement.setAttribute("data-text-size","l"));
        const metrics=await page.evaluate(()=>({
          overflow:document.documentElement.scrollWidth<=innerWidth,
          targets:[...document.querySelectorAll(".kb66-row a")].every((value)=>value.getBoundingClientRect().height>=44),
          motion:matchMedia("(prefers-reduced-motion: reduce)").matches,
          largeText:parseFloat(getComputedStyle(document.body).fontSize)>=20,
          mains:document.querySelectorAll("main").length,
          headings:document.querySelectorAll("h1").length,
        }));
        expect(metrics).toEqual({overflow:true,targets:true,motion:true,largeText:true,mains:1,headings:1});
      } finally { await page.close(); }
      const gallery=await fixture(width,lang);
      try { await pwExpect(gallery.getByRole("button",{name:lang==="he"?"הצגת ישנים יותר":"Show older"})).toBeVisible(); expect(await gallery.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
      finally { await gallery.close(); }
    }
  },240_000);
});
