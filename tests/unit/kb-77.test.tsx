import * as Bun from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const childMode = process.env.KB77_FIXTURE_CHILD === "1";
const beforeOnly = process.env.KB77_BEFORE_ONLY === "1";
const frozen =
  'import * as React from "react";\n\nimport { cn } from "@/lib/utils";\n\nconst Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(\n  ({ className, type, ...props }, ref) => (\n    <input\n      className={cn(\n        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",\n        className\n      )}\n      ref={ref}\n      type={type}\n      {...props}\n    />\n  )\n);\nInput.displayName = "Input";\n\nexport { Input };\n';
const names = beforeOnly
  ? ["frozen real Today and Plan callers have 40 px inputs"]
  : [
      "original and current real Today intention geometry",
      "original and current real Plan title and native time geometry",
      "phone defaults reach 44 px and desktop stays 40 px",
      "explicit taller and narrower caller classes remain usable",
      "controlled change keeps the native event value",
      "uncontrolled input preserves its editable default value",
      "forwarded ref focuses the real input",
      "name type required autocomplete and native form behavior survive",
      "disabled and readOnly remain native and do not change",
      "invalid state and description stay associated",
      "English and Hebrew gallery dictionaries have exact parity",
      "pure gallery mounts real inputs with one main and heading",
      "long Hebrew labels wrap and user text keeps its direction",
      "keyboard focus remains visible with reduced motion",
      "real Today blur saves the existing intention argument",
      "real Plan title and time submit the existing native arguments",
      "caller and gallery matrix fits both widths languages and themes",
      "browser identity content and console stay healthy",
    ];
type Results = Record<string, { pass: boolean; detail?: string }>;
const boundary = `
export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});
export function useQuery(ref,args){if(args==="skip")return undefined;switch(ref){
case"users.getProfile":return {_id:"fictional-maya",greetingName:"Maya",email:"maya@example.test"};
case"dayPlans.getForDate":return {_id:"fictional-plan",status:"draft",intention:"Read with Maya",topTaskIds:[],energy:"medium"};
default:return []}}
export const useMutation=ref=>async args=>{window.__kb77.calls.push({ref,args});return ref==="dayPlans.commit"?{dayPlanId:"fictional-plan",committedAt:Date.now()}:"fictional-block"};
`;
const api = `export const api={users:{getProfile:"users.getProfile"},dayPlans:{getForDate:"dayPlans.getForDate",listCarryOver:"dayPlans.listCarryOver",upsert:"dayPlans.upsert",commit:"dayPlans.commit"},tasks:{listToday:"tasks.listToday"},habits:{list:"habits.list"},timeBlocks:{create:"timeBlocks.create",update:"timeBlocks.update",remove:"timeBlocks.remove"}};`;
const entry = (phase: string) => `
import React,{useEffect,useRef,useState}from"react";import{createRoot}from"react-dom/client";
import*as Inputs from"@/components/ui/input";import{DayPlanPanel}from"@/components/day-plan-panel/DayPlanPanel";
import{TodayGreeting}from"@/components/today/TodayGreeting";import{TimeBlockDialog}from"@/components/time-block-dialog/TimeBlockDialog";
const params=new URLSearchParams(location.search),lang=params.get("lang")==="he"?"he":"en";
const localDate=new Date().toLocaleDateString("en-CA");
function Today(){return <main className="container mx-auto max-w-5xl px-6 py-12"><TodayGreeting greetingName="Maya"/><div data-testid="today-day-plan-panel"><DayPlanPanel/></div></main>}
function Plan(){const[open,setOpen]=useState(true);return <main><h1>{lang==="he"?"תכנון":"Plan"}</h1><button id="open-plan" onClick={()=>setOpen(true)}>Open</button><TimeBlockDialog open={open} onOpenChange={setOpen} localDate={localDate} initialStartMinute={540}/></main>}
function Native(){const[value,setValue]=useState("Maya"),ref=useRef(null);useEffect(()=>{window.__kb77.focus=()=>ref.current.focus()},[]);return <main><h1>Input contract</h1><form onSubmit={event=>{event.preventDefault();window.__kb77.submitted=Object.fromEntries(new FormData(event.currentTarget))}}>
<label htmlFor="controlled">Name</label><Inputs.Input id="controlled" ref={ref} name="name" value={value} required autoComplete="name" data-custom="kept" onChange={event=>{window.__kb77.values.push({value:event.target.value,type:event.target.type});setValue(event.target.value)}}/>
<label htmlFor="uncontrolled">Uncontrolled</label><Inputs.Input id="uncontrolled" name="other" defaultValue="Dana"/>
<label htmlFor="clock">Time</label><Inputs.Input id="clock" name="clock" type="time" defaultValue="09:30"/>
<label htmlFor="disabled">Disabled</label><Inputs.Input id="disabled" name="disabled" defaultValue="Yoni" disabled/>
<label htmlFor="readonly">Read only</label><Inputs.Input id="readonly" name="readOnly" defaultValue="Maya" readOnly/>
<label htmlFor="invalid">Invalid</label><Inputs.Input id="invalid" aria-invalid="true" aria-describedby="detail"/><p id="detail">Choose a name</p>
<label htmlFor="larger">Larger</label><Inputs.Input id="larger" className="h-16 w-16"/>
<label htmlFor="minimum">Custom minimum</label><Inputs.Input id="minimum" className="min-h-16 min-w-16"/>
<label htmlFor="narrower">Narrower</label><Inputs.Input id="narrower" className="h-8 w-8"/>
<button type="submit">Save</button></form></main>}
const mode=params.get("mode");createRoot(document.getElementById("app")).render(mode==="today"?<Today/>:mode==="plan"?<Plan/>:mode==="gallery"?${phase === "current" && !beforeOnly ? "<Inputs.Kb77Gallery lang={lang}/>" : "<Native/>"}:<Native/>);
`;

async function runFixture(): Promise<Results> {
  const { chromium, expect: pw } = await import("@playwright/test");
  const web = join(repo, "apps/web"),
    require = createRequire(join(web, "package.json"));
  const postcss = require("postcss"),
    tailwind = require("@tailwindcss/postcss");
  const dir = join(repo, "work/kb77-fixture");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "boundary.ts"), boundary);
  writeFileSync(join(dir, "api.ts"), api);
  const globals = join(web, "app/globals.css");
  const baseCss = (
    await postcss([tailwind({ base: repo })]).process(readFileSync(globals, "utf8"), {
      from: globals,
    })
  ).css;
  const build = async (phase: string) => {
    const source = join(dir, phase + ".tsx");
    writeFileSync(source, entry(phase));
    const output = await Bun.build({
      entrypoints: [source],
      outdir: dir,
      target: "browser",
      define: { "process.env.NODE_ENV": '"development"' },
      plugins: [
        {
          name: "kb77-fictional-boundaries",
          setup(b) {
            b.onResolve(
              {
                filter: /^(react|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/,
              },
              ({ path }) => ({ path: Bun.resolveSync(path, web) })
            );
            b.onResolve({ filter: /^convex\/react$/ }, () => ({
              path: join(dir, "boundary.ts"),
            }));
            b.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
              path: join(dir, "api.ts"),
            }));
            b.onResolve({ filter: /^@\/components\/providers\/LocaleProvider$/ }, () => ({
              path: "locale",
              namespace: "kb77",
            }));
            b.onLoad({ filter: /.*/, namespace: "kb77" }, () => ({
              contents: `import{translate}from${JSON.stringify(join(web, "lib/i18n.ts"))};export const useLocale=()=>{const lang=new URLSearchParams(location.search).get("lang")==="he"?"he":"en";return{lang,dir:lang==="he"?"rtl":"ltr",t:key=>translate(lang,key)}}`,
              loader: "js",
              resolveDir: web,
            }));
            if (phase === "before")
              b.onLoad({ filter: /components\/ui\/input\.tsx$/ }, () => ({
                contents: frozen,
                loader: "tsx",
                resolveDir: web,
              }));
            b.onResolve({ filter: /^@\// }, ({ path }) => ({
              path: Bun.resolveSync(path, web),
            }));
          },
        },
      ],
    });
    if (!output.success) throw Error(output.logs.map(String).join("\n"));
    return {
      js: await output.outputs.find((x) => x.path.endsWith(".js"))!.text(),
      css: (
        await Promise.all(
          output.outputs.filter((x) => x.path.endsWith(".css")).map((x) => x.text())
        )
      ).join("\n"),
    };
  };
  const original = await build("before"),
    current = beforeOnly ? original : await build("current");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const u = new URL(request.url),
        phase = u.searchParams.get("phase") === "before" ? "before" : "current",
        asset = phase === "before" ? original : current;
      if (u.pathname === "/entry.js")
        return new Response(asset.js, {
          headers: { "content-type": "text/javascript" },
        });
      if (u.pathname === "/styles.css")
        return new Response(baseCss + "\n" + asset.css, {
          headers: { "content-type": "text/css" },
        });
      const lang = u.searchParams.get("lang") === "he" ? "he" : "en",
        theme = u.searchParams.get("theme") === "dark" ? "dark" : "light";
      return new Response(
        `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>KB-77 existing input callers</title><link rel="stylesheet" href="/styles.css?phase=${phase}"></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:"development"}};window.__kb77={calls:[],values:[]}</script><script type="module" src="/entry.js?phase=${phase}"></script></body></html>`,
        { headers: { "content-type": "text/html" } }
      );
    },
  });
  const executablePath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].find(existsSync);
  if (!executablePath) throw Error("Installed Chromium unavailable");
  const browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox"],
    }),
    results: Results = {},
    errors: string[] = [];
  const open = async (
    mode: string,
    phase = "current",
    width = 390,
    lang = "en",
    theme = "light"
  ) => {
    const page = await browser.newPage({
      viewport: { width, height: 1100 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(
      `http://127.0.0.1:${server.port}/?mode=${mode}&phase=${phase}&lang=${lang}&theme=${theme}`
    );
    await page
      .locator(
        mode === "today" ? "#day-plan-intention" : mode === "plan" ? "#time-block-title" : "input"
      )
      .first()
      .waitFor();
    return page;
  };
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results[name] = { pass: true };
    } catch (error) {
      results[name] = { pass: false, detail: String(error) };
    }
  };
  const height = async (page: any, id: string) =>
    page.locator(id).evaluate((el: HTMLElement) => el.getBoundingClientRect().height);
  const capture = async (page: any, name: string) => {
    const dest = process.env.KB77_EVIDENCE_DIR;
    if (dest) {
      mkdirSync(dest, { recursive: true });
      await page.screenshot({
        path: join(dest, name + ".png"),
        fullPage: true,
      });
    }
  };
  const geometry = async () => {
    for (const mode of ["today", "plan"])
      for (const width of [390, 1280]) {
        const p = await open(mode, "before", width);
        pw(await height(p, mode === "today" ? "#day-plan-intention" : "#time-block-title")).toBe(
          40
        );
        if (mode === "plan") pw(await height(p, "#time-block-start")).toBe(40);
        await p.close();
      }
  };
  try {
    if (beforeOnly) {
      await check(names[0], geometry);
    } else {
      await check(names[0], async () => {
        for (const width of [390, 1280])
          for (const phase of ["before", "current"]) {
            const p = await open("today", phase, width);
            pw(await height(p, "#day-plan-intention")).toBe(
              width < 768 && phase === "current" ? 44 : 40
            );
            await p.close();
          }
      });
      await check(names[1], async () => {
        for (const width of [390, 1280])
          for (const phase of ["before", "current"]) {
            const p = await open("plan", phase, width);
            for (const id of ["#time-block-title", "#time-block-start"])
              pw(await height(p, id)).toBe(width < 768 && phase === "current" ? 44 : 40);
            pw(await p.locator("#time-block-start").getAttribute("type")).toBe("time");
            await p.close();
          }
      });
      await check(names[2], async () => {
        for (const width of [390, 1280]) {
          const p = await open("native", "current", width);
          pw(await height(p, "#controlled")).toBe(width < 768 ? 44 : 40);
          await p.close();
        }
      });
      await check(names[3], async () => {
        for (const width of [390, 1280]) {
          const p = await open("native", "current", width);
          pw(await height(p, "#larger")).toBe(64);
          pw(await height(p, "#minimum")).toBe(64);
          pw(await p.locator("#minimum").evaluate((el) => getComputedStyle(el).minWidth)).toBe(
            "64px"
          );
          pw(await p.locator("#larger").evaluate((el) => el.getBoundingClientRect().width)).toBe(
            64
          );
          pw(await height(p, "#narrower")).toBe(width < 768 ? 44 : 32);
          pw(await p.locator("#narrower").evaluate((el) => el.getBoundingClientRect().width)).toBe(
            width < 768 ? 44 : 32
          );
          await p.close();
        }
      });
      await check(names[4], async () => {
        const p = await open("native");
        await p.locator("#controlled").fill("Dana");
        pw(await p.locator("#controlled").inputValue()).toBe("Dana");
        pw(await p.evaluate(() => window.__kb77.values.at(-1))).toEqual({
          value: "Dana",
          type: "text",
        });
        await p.close();
      });
      await check(names[5], async () => {
        const p = await open("native");
        pw(await p.locator("#uncontrolled").inputValue()).toBe("Dana");
        await p.locator("#uncontrolled").fill("Yoni");
        pw(await p.locator("#uncontrolled").inputValue()).toBe("Yoni");
        await p.close();
      });
      await check(names[6], async () => {
        const p = await open("native");
        await pw.poll(() => p.evaluate(() => typeof window.__kb77.focus)).toBe("function");
        await p.evaluate(() => window.__kb77.focus());
        await pw(p.locator("#controlled")).toBeFocused();
        await p.close();
      });
      await check(names[7], async () => {
        const p = await open("native");
        await p.locator("#controlled").fill("");
        await p.getByRole("button", { name: "Save", exact: true }).click();
        pw(await p.evaluate(() => window.__kb77.submitted)).toBeUndefined();
        await p.locator("#controlled").fill("Maya");
        await p.locator("#clock").fill("10:45");
        await p.getByRole("button", { name: "Save", exact: true }).click();
        pw(await p.evaluate(() => window.__kb77.submitted)).toMatchObject({
          name: "Maya",
          other: "Dana",
          clock: "10:45",
          readOnly: "Maya",
        });
        pw(await p.locator("#controlled").getAttribute("autocomplete")).toBe("name");
        pw(await p.locator("#controlled").getAttribute("data-custom")).toBe("kept");
        await p.close();
      });
      await check(names[8], async () => {
        const p = await open("native");
        await pw(p.locator("#disabled")).toBeDisabled();
        await pw(p.locator("#readonly")).not.toBeEditable();
        await p.locator("#readonly").focus();
        await p.keyboard.type("Different");
        pw(await p.locator("#readonly").inputValue()).toBe("Maya");
        await p.close();
      });
      await check(names[9], async () => {
        const p = await open("native");
        await pw(p.locator("#invalid")).toHaveAttribute("aria-invalid", "true");
        await pw(p.locator("#invalid")).toHaveAccessibleDescription("Choose a name");
        await p.close();
      });
      await check(names[10], async () => {
        const group = await import("../../apps/web/lib/i18n-groups/kb-77");
        pw(Object.keys(group.en).sort()).toEqual(Object.keys(group.he).sort());
        for (const key of Object.keys(group.en))
          pw(group.kb77t("he", key as keyof typeof group.en)).toBeTruthy();
      });
      await check(names[11], async () => {
        const p = await open("gallery");
        pw(await p.locator("main").count()).toBe(1);
        pw(await p.locator("h1").count()).toBe(1);
        pw(await p.locator("input").count()).toBeGreaterThanOrEqual(6);
        for (const el of await p.locator("input").all())
          pw((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await p.close();
      });
      await check(names[12], async () => {
        const p = await open("gallery", "current", 390, "he");
        pw(await p.locator("main").getAttribute("dir")).toBe("rtl");
        pw(await p.locator("#kb77-long").getAttribute("dir")).toBe("auto");
        pw(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await p.close();
      });
      await check(names[13], async () => {
        const p = await open("native");
        await p.keyboard.press("Tab");
        await pw(p.locator("#controlled")).toBeFocused();
        const style = await p.locator("#controlled").evaluate((el) => ({
          shadow: getComputedStyle(el).boxShadow,
          durations: [
            getComputedStyle(el).animationDuration,
            getComputedStyle(el).transitionDuration,
          ],
        }));
        pw(style.shadow).not.toBe("none");
        for (const list of style.durations)
          for (const n of list.split(",")) pw(parseFloat(n) || 0).toBeLessThanOrEqual(0.001);
        await p.close();
      });
      await check(names[14], async () => {
        const p = await open("today");
        await p.locator("#day-plan-intention").fill("Read with Dana");
        await p.locator("#day-plan-intention").press("Tab");
        await pw
          .poll(() =>
            p.evaluate(() =>
              window.__kb77.calls.some(
                (x: any) => x.ref === "dayPlans.upsert" && x.args.intention === "Read with Dana"
              )
            )
          )
          .toBe(true);
        const call = await p.evaluate(() =>
          window.__kb77.calls.find((x: any) => x.ref === "dayPlans.upsert")
        );
        pw(Object.keys(call.args).sort()).toEqual(["intention", "localDate", "timezone"]);
        await p.close();
      });
      await check(names[15], async () => {
        const p = await open("plan");
        await p.locator("#time-block-title").fill("Read with Dana");
        await p.locator("#time-block-start").fill("10:15");
        await p.locator('form button[type="submit"]').click();
        await pw
          .poll(() =>
            p.evaluate(() => window.__kb77.calls.some((x: any) => x.ref === "timeBlocks.create"))
          )
          .toBe(true);
        const call = await p.evaluate(() =>
          window.__kb77.calls.find((x: any) => x.ref === "timeBlocks.create")
        );
        pw(call.args).toMatchObject({
          title: "Read with Dana",
          startMinute: 615,
          durationMinutes: 30,
          kind: "focus",
        });
        await p.close();
      });
      await check(names[16], async () => {
        for (const width of [390, 1280])
          for (const lang of ["en", "he"])
            for (const theme of ["light", "dark"])
              for (const mode of ["today", "plan", "gallery"]) {
                const p = await open(mode, "current", width, lang, theme);
                pw(await p.locator("main").count()).toBe(1);
                pw(await p.locator("h1").count()).toBe(1);
                pw(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
                  true
                );
                const id =
                  mode === "today"
                    ? "#day-plan-intention"
                    : mode === "plan"
                      ? "#time-block-title"
                      : "#kb77-text";
                pw(await height(p, id)).toBe(width < 768 ? 44 : 40);
                await capture(p, `current-${mode}-${width}-${lang}-${theme}`);
                await p.close();
              }
      });
      await check(names[17], async () => {
        const p = await open("today");
        pw(await p.title()).toBe("KB-77 existing input callers");
        pw(await p.locator("#day-plan-intention").inputValue()).toBe("Read with Maya");
        pw(await p.locator("nextjs-portal").count()).toBe(0);
        pw(errors).toEqual([]);
        await p.close();
      });
    }
    if (process.env.KB77_EVIDENCE_DIR)
      for (const width of [390, 1280])
        for (const lang of ["en", "he"])
          for (const theme of ["light", "dark"])
            for (const mode of ["today", "plan"]) {
              const p = await open(mode, "before", width, lang, theme);
              await capture(p, `before-${mode}-${width}-${lang}-${theme}`);
              await p.close();
            }
    return results;
  } finally {
    await browser.close();
    server.stop(true);
  }
}
if (childMode) {
  writeFileSync(process.env.KB77_RESULTS!, JSON.stringify(await runFixture(), null, 2));
} else {
  const { beforeAll, test, expect } = await import("bun:test");
  let results: Results;
  beforeAll(async () => {
    mkdirSync(join(repo, "work"), { recursive: true });
    const output = join(repo, "work/kb77-results.json");
    const child = Bun.spawn([process.execPath, import.meta.path], {
      cwd: repo,
      env: { ...process.env, KB77_FIXTURE_CHILD: "1", KB77_RESULTS: output },
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = new Response(child.stdout).text(),
      stderr = new Response(child.stderr).text();
    const exit = await child.exited;
    const logs = await Promise.all([stdout, stderr]);
    if (exit !== 0) throw Error(`KB77 browser child exit ${exit}:\n${logs.join("\n")}`);
    results = JSON.parse(readFileSync(output, "utf8"));
  }, 480_000);
  for (const name of names)
    test(`KB-77: ${name}`, () => {
      expect(results[name], name).toBeDefined();
      expect(results[name].detail || "").toBe("");
      expect(results[name].pass).toBe(true);
    });
}
