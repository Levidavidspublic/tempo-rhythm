import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Other suites mock React and Convex process-wide. The mounted proof owns a clean process.
if (process.env.TEMPO_PLAN_ISOLATED !== "1") {
  test("Plan mounted and calendar-boundary regressions in a clean process", () => {
    const output = execFileSync(process.execPath, ["test", import.meta.path], {
      cwd: process.cwd(), env: { ...process.env, TEMPO_PLAN_ISOLATED: "1" },
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024, encoding: "utf8",
    });
    expect(output).toContain("PLAN_FIXTURE_COMPLETE");
  }, 190_000);
} else {
  const { chromium } = await import("@playwright/test");
  const { groupPlanAgenda } = await import("../../apps/web/components/calendar/CalendarViews");
  const { getCalendarRangeMs, fromDateInputValue } = await import("../../apps/web/lib/calendar/date-math");
  const { translate } = await import("../../apps/web/lib/i18n");
  const repo = process.cwd();
  let scratch: string;
  let server: ReturnType<typeof Bun.serve>;
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  describe("Plan calendar boundaries", () => {
    test("groups mixed entries chronologically and does not collide on task/event IDs", () => {
      const start = new Date(2026, 9, 21).getTime();
      const groups = groupPlanAgenda([
        { _id: "same", title: "Task", dueAt: start + 200, status: "todo" },
        { _id: "later", title: "Later", dueAt: start + 400, status: "done" },
      ], [{ id: "same", title: "Event", startsAtMs: start + 100 }], { startMs: start, endMs: start + 1000 });
      expect(groups).toHaveLength(1);
      expect(groups[0]?.items.map((item) => `${item.kind}:${item.id}`)).toEqual(["event:same", "task:same", "task:later"]);
    });
    test("excludes absent/non-finite dates, cancelled tasks and the range's next midnight", () => {
      const range = { startMs: 100, endMs: 200 };
      const groups = groupPlanAgenda([
        { _id: "none", title: "No date", status: "todo" },
        { _id: "bad", title: "Bad", dueAt: Number.NaN, status: "todo" },
        { _id: "cancel", title: "Cancelled", dueAt: 150, status: "cancelled" },
        { _id: "end", title: "Next", dueAt: 200, status: "todo" },
        { _id: "first", title: "First", dueAt: 100, status: "todo" },
      ], [{ id: "last", title: "Last", startsAtMs: 199 }], range);
      expect(groups.flatMap((group) => group.items.map((item) => item.id))).toEqual(["first", "last"]);
    });
    test("day/week/month preserve local DST boundaries across supported browser zones", () => {
      const previous = process.env.TZ;
      try {
        for (const zone of ["UTC", "America/New_York", "Asia/Jerusalem", "Pacific/Auckland"]) {
          process.env.TZ = zone;
          for (const date of ["2026-03-08", "2026-10-25", "2026-11-01"]) {
            for (const mode of ["day", "week", "month"] as const) {
              const range = getCalendarRangeMs(mode, fromDateInputValue(date));
              const groups = groupPlanAgenda([
                { _id: "first", title: "First", dueAt: range.startMs, status: "todo" },
                { _id: "last", title: "Last", dueAt: range.endMs - 1, status: "todo" },
                { _id: "outside", title: "Next", dueAt: range.endMs, status: "todo" },
              ], [], range);
              expect(groups.flatMap((group) => group.items.map((item) => item.id))).toEqual(["first", "last"]);
              expect(range.endMs - range.startMs).toBeLessThanOrEqual(32 * 24 * 60 * 60 * 1000);
            }
          }
        }
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    });
  });

  beforeAll(async () => {
    const work = join(repo, "work");
    await mkdir(work, { recursive: true });
    scratch = await mkdtemp(join(work, "feature-plan-"));
    await symlink(join(repo, "apps/web/node_modules"), join(scratch, "node_modules"));
    const entry = join(scratch, "entry.tsx");
    const react = JSON.stringify(join(repo, "apps/web/node_modules/react"));
    const fixture = `import React, {useSyncExternalStore} from ${react};
import {getFunctionName} from ${JSON.stringify(join(repo, "node_modules/convex/server"))};
const day=new Date();day.setHours(0,0,0,0);const start=day.getTime();
let revision=0;const listeners=new Set();const changes=[];
const task=(id,title,time,projectId='project-a')=>({_id:id,title,status:'todo',dueAt:time,projectId,projectName:projectId,createdAt:1,updatedAt:1});
const tasks=[task('task-a','Morning task',start+9*3600000),task('task-b','Other project task',start+11*3600000,'project-b'),task('next','Next-day task',start+36*3600000)];
const events=[{_id:'event-a',title:'Planning call',startsAtMs:start+8*3600000},{_id:'event-b',title:'Evening event',startsAtMs:start+17*3600000},{_id:'event-next',title:'Next-day event',startsAtMs:start+35*3600000}];
let fail=false;const params=new URLSearchParams(location.search);const state=params.get('state');
const notify=()=>{revision++;for(const listener of listeners)listener();};
window.planFixture={changes,tasks,events,start,setFail(value){fail=value;},clear(){tasks.splice(0);events.splice(0);notify();}};
export const useConvexAuth=()=>({isAuthenticated:state!=='signed-out',isLoading:false});
export function useQuery(ref,args){useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>revision,()=>revision);if(args==='skip')return undefined;const name=getFunctionName(ref);if(name==='users:getProfile')return state==='loading'?undefined:{_id:'fictional-user'};
if(name==='tasks:list')return tasks;if(name==='tasks:listDueInRange')return tasks.filter(x=>x.dueAt>=args.startMs&&x.dueAt<args.endMs);if(name==='calendar_events:listInRange')return events.filter(x=>x.startsAtMs>=args.startMs&&x.startsAtMs<args.endMs);return [];}
const mutations=new Map();export function useMutation(ref){const name=getFunctionName(ref);if(!mutations.has(name)){const mutate=async(args)=>{changes.push({name,args});if(fail)throw Error('controlled failure');if(name==='tasks:update'){const task=tasks.find(x=>x._id===args.taskId);Object.assign(task,args);}
if(name==='tasks:create'){tasks.push(task('created',args.title,start,args.projectId));notify();return 'created';}
if(name==='calendar_events:update'){Object.assign(events.find(x=>x._id===args.eventId),args);}
if(name==='calendar_events:remove'){const i=events.findIndex(x=>x._id===args.eventId);events.splice(i,1);notify();return {undoUntilMs:Date.now()+300000};}
notify();return {success:true};};mutate.withOptimisticUpdate=()=>mutate;mutations.set(name,mutate);}return mutations.get(name);}
export const useAction=()=>async()=>{throw Error('No model calls in fixture');};
export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>;}
export function DayTimeline({localDate,onCreateAt}){return <section role='region' aria-label='Day timeline' data-timeline-date={localDate}><h2>Day timeline</h2><button type='button' className='tp-btn' onClick={()=>onCreateAt(540)}>Add time block</button></section>;}
export function TimeBlockDialog({open,localDate,onOpenChange}){return open?<div role='dialog' aria-label='Time block' data-dialog-date={localDate}><button onClick={()=>onOpenChange(false)}>Close</button></div>:null;}
`;
    await writeFile(join(scratch, "fixture.tsx"), fixture);
    const entrySource = `import React from ${react};import {createRoot} from ${JSON.stringify(join(repo, "apps/web/node_modules/react-dom/client"))};
import {PlanScreen} from ${JSON.stringify(join(repo, "apps/web/app/(tempo)/plan/PlanScreen"))};
import {TaskKanbanBoard} from ${JSON.stringify(join(repo, "apps/web/components/tasks/TaskKanbanBoard"))};
import {LocaleProvider} from ${JSON.stringify(join(repo, "apps/web/components/providers/LocaleProvider"))};
import {TpIconSprite} from ${JSON.stringify(join(repo, "apps/web/components/tempo/TpIcon"))};
const project=new URLSearchParams(location.search).get('project');createRoot(document.getElementById('root')).render(<LocaleProvider><main><TpIconSprite/>{project?<TaskKanbanBoard projectSlug={project}/>:<PlanScreen/>}</main></LocaleProvider>);`;
    await writeFile(entry, entrySource);
    const entrypoints = [entry];
    const capture = process.env.TEMPO_PLAN_EVIDENCE_DIR;
    if (capture) {
      // Optional evidence only: the exact integration Plan component, under identical boundaries.
      const baselineSource = execFileSync("git", ["show", "39b564ec329705587df5262ed5a061bbec9a1e8f:apps/web/app/(tempo)/plan/PlanScreen.tsx"], { cwd: repo, encoding: "utf8" })
        .replaceAll('"@/', `"${join(repo, "apps/web")}/`);
      const baselineComponent = join(scratch, "BaselinePlan.tsx");
      await writeFile(baselineComponent, baselineSource);
      const baselineEntry = join(scratch, "baseline.tsx");
      await writeFile(baselineEntry, entrySource.replace(JSON.stringify(join(repo, "apps/web/app/(tempo)/plan/PlanScreen")), JSON.stringify(baselineComponent)));
      entrypoints.push(baselineEntry);
    }
    const builder = join(scratch, "build.ts");
    await writeFile(builder, `const result=await Bun.build({entrypoints:${JSON.stringify(entrypoints)},outdir:${JSON.stringify(join(scratch, "out"))},target:'browser',plugins:[{name:'controlled-plan-boundaries',setup(build){
build.onResolve({filter:/^(convex\\/react|next\\/link)$/},()=>({path:${JSON.stringify(join(scratch, "fixture.tsx"))}}));
build.onResolve({filter:/components\\/(day-timeline\\/DayTimeline|time-block-dialog\\/TimeBlockDialog)$/},()=>({path:${JSON.stringify(join(scratch, "fixture.tsx"))}}));
}}]});if(!result.success){console.error(result.logs);process.exit(1);}`);
    execFileSync(process.execPath, [builder], { cwd: repo, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    const styles = (await Promise.all(["docs/design/v3/tokens.css", "apps/web/app/tempo.css", "apps/web/app/globals.css", "apps/web/app/v3/goals.css"].map((path) => Bun.file(join(repo, path)).text())))
      .join("\n").replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])[^;]*;/g, "");
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/fixture.js") return new Response(Bun.file(join(scratch, "out/entry.js")), { headers: { "content-type": "text/javascript" } });
      if (pathname === "/baseline.js" && capture) return new Response(Bun.file(join(scratch, "out/baseline.js")), { headers: { "content-type": "text/javascript" } });
      if (pathname === "/fixture.css") return new Response(styles, { headers: { "content-type": "text/css" } });
      const bundle = pathname === "/baseline" && capture ? "/baseline.js" : "/fixture.js";
      return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"production"}};</script><script type="module" src="${bundle}"></script></body></html>`, { headers: { "content-type": "text/html" } });
    } });
    const executablePath = [chromium.executablePath(), "/usr/bin/chromium"].find(existsSync);
    if (!executablePath) throw Error("Chromium unavailable for Plan mounted proof");
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
    if (capture) {
      await mkdir(capture, { recursive: true });
      for (const lang of ["en", "he"]) for (const width of [390, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
        try {
          await page.goto(`${server.url}baseline?lang=${lang}`);
          await page.getByRole("region", { name: "Day timeline" }).waitFor();
          await page.waitForFunction((expected) => document.documentElement.lang === expected, lang);
          await page.screenshot({ path: join(capture, `before-day-${lang}-${width}.png`), fullPage: true });
        } finally { await page.close(); }
      }
    }
  }, 45_000);

  afterAll(async () => {
    try { await browser?.close(); }
    finally { server?.stop(true); if (scratch) await rm(scratch, { recursive: true, force: true }); }
    console.log("PLAN_FIXTURE_COMPLETE");
  });

  for (const lang of ["en", "he"] as const) {
    for (const width of [390, 1280]) {
      test(`mounted Plan mixes dated tasks/events and preserves Board, time blocks and layout: ${lang}/${width}`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(`${server.url}?lang=${lang}`);
          const day = page.getByRole("button", { name: translate(lang, "cal.view.day"), exact: true });
          await day.waitFor();
          await page.waitForFunction((expected) => document.documentElement.lang === expected, lang);
          expect(await page.locator("main").count()).toBe(1);
          expect(await page.locator("h1").count()).toBe(1);
          expect(await page.locator("html").getAttribute("dir")).toBe(lang === "he" ? "rtl" : "ltr");
          expect(await day.getAttribute("aria-pressed")).toBe("true");
          expect(await page.locator("[data-plan-date] li").allTextContents()).toEqual([
            expect.stringContaining("Planning call"), expect.stringContaining("Morning task"),
            expect.stringContaining("Other project task"), expect.stringContaining("Evening event"),
          ]);
          expect(await page.locator('[data-plan-task="task-a"] a').getAttribute("href")).toBe("/tasks");
          expect(await page.getByText("Next-day task", { exact: true }).count()).toBe(0);
          await page.getByRole("button", { name: "Add time block", exact: true }).click();
          expect(await page.getByRole("dialog").count()).toBe(1);
          const selectedDate = await page.locator('input[type="date"]').first().inputValue();
          expect(await page.getByRole("dialog").getAttribute("data-dialog-date")).toBe(selectedDate);
          await page.getByRole("button", { name: "Close", exact: true }).click();
          for (const mode of ["week", "month"] as const) {
            const button = page.getByRole("button", { name: translate(lang, `cal.view.${mode}`), exact: true });
            await button.click();
            expect(await button.getAttribute("aria-pressed")).toBe("true");
            expect(await page.getByText("Planning call", { exact: true }).count()).toBe(1);
            expect(await page.getByText("Morning task", { exact: true }).count()).toBe(1);
            expect(await page.locator("h1").count()).toBe(1);
          }
          const board = page.getByRole("button", { name: translate(lang, "tasks.board"), exact: true });
          await board.focus();
          await page.keyboard.press("Enter");
          await page.locator('[data-component="Kanban"]').waitFor();
          expect(await page.locator('[data-component="KanbanCard"]').count()).toBe(3);
          expect(await page.locator("h1").count()).toBe(1);
          expect(await page.getByRole("link", { name: translate(lang, "kb.back"), exact: true }).count()).toBe(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
          if (width === 390) {
            const rect = await board.boundingBox();
            expect(rect?.height).toBeGreaterThanOrEqual(44);
            expect(rect?.width).toBeGreaterThanOrEqual(44);
          }
          const capture = process.env.TEMPO_PLAN_EVIDENCE_DIR;
          if (capture) { await mkdir(capture, { recursive: true }); await page.screenshot({ path: join(capture, `after-board-${lang}-${width}.png`), fullPage: true }); }
          await day.click();
          if (capture) await page.screenshot({ path: join(capture, `after-day-${lang}-${width}.png`), fullPage: true });
          expect(errors).toEqual([]);
        } finally { await page.close(); }
      }, 30_000);
    }
  }

  test("all-task Board persists movement and Undo without assigning a project", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 844 }, reducedMotion: "reduce" });
    try {
      await page.goto(server.url.href);
      await page.getByRole("button", { name: "Board", exact: true }).click();
      const card = page.locator('[data-card="task-a"]');
      await card.locator('[data-dir="next"]').click();
      await page.waitForFunction(() => (window as unknown as { planFixture: { tasks: Array<{_id:string;status:string}> } }).planFixture.tasks.find((task) => task._id === "task-a")?.status === "in_progress");
      expect(await card.locator("..").locator("..").locator("..").getAttribute("aria-labelledby")).toBe("col-in_progress");
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await page.waitForFunction(() => (window as unknown as { planFixture: { tasks: Array<{_id:string;status:string}> } }).planFixture.tasks.find((task) => task._id === "task-a")?.status === "todo");
      await page.getByRole("button", { name: translate("en", "kb.add"), exact: true }).click();
      await page.getByRole("textbox", { name: translate("en", "kb.newcard"), exact: true }).fill("Unassigned task");
      await page.getByRole("textbox", { name: translate("en", "kb.newcard"), exact: true }).press("Enter");
      await page.getByText("Unassigned task", { exact: true }).waitFor();
      const create = await page.evaluate(() => (window as unknown as { planFixture: { changes: Array<{name:string;args:Record<string,unknown>}> } }).planFixture.changes.find((change) => change.name === "tasks:create"));
      expect(create?.args).toEqual({ title: "Unassigned task", status: "todo" });
    } finally { await page.close(); }
  }, 20_000);

  test("existing project Board stays filtered and has its original back link", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.url}?project=project-a`);
      await page.locator('[data-component="Kanban"]').waitFor();
      expect(await page.locator('[data-component="KanbanCard"]').count()).toBe(2);
      expect(await page.getByText("Other project task", { exact: true }).count()).toBe(0);
      expect(await page.getByRole("link", { name: translate("en", "kb.back"), exact: true }).getAttribute("href")).toBe("/projects/project-a");
      expect(await page.locator("h1").count()).toBe(1);
    } finally { await page.close(); }
  }, 15_000);

  test("changing the selected day updates both the mixed agenda and time-block target", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(server.url.href);
      await page.locator('[data-testid="plan-agenda"]').waitFor();
      const tomorrow = await page.evaluate(() => {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      });
      await page.locator('input[type="date"]').first().fill(tomorrow);
      await page.getByText("Next-day task", { exact: true }).waitFor();
      expect(await page.locator("[data-plan-date] li").allTextContents()).toEqual([
        expect.stringContaining("Next-day event"), expect.stringContaining("Next-day task"),
      ]);
      expect(await page.locator("[data-timeline-date]").getAttribute("data-timeline-date")).toBe(tomorrow);
      await page.getByRole("button", { name: "Add time block", exact: true }).click();
      expect(await page.getByRole("dialog").getAttribute("data-dialog-date")).toBe(tomorrow);
    } finally { await page.close(); }
  }, 15_000);

  test("Today rolls over at midnight while an explicitly selected other day stays selected", async () => {
    const page = await browser.newPage({ timezoneId: "UTC" });
    try {
      await page.clock.install({ time: new Date("2026-10-21T23:59:57Z") });
      await page.clock.pauseAt(new Date("2026-10-21T23:59:58Z"));
      await page.goto(server.url.href);
      const date = page.locator('input[type="date"]').first();
      await date.waitFor();
      expect(await date.inputValue()).toBe("2026-10-21");
      await page.clock.runFor(3_000);
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>('input[type="date"]')?.value === "2026-10-22");
      expect(await page.locator("[data-timeline-date]").getAttribute("data-timeline-date")).toBe("2026-10-22");
      await page.getByText("Next-day task", { exact: true }).waitFor();
      await date.fill("2026-10-20");
      await page.clock.fastForward(24 * 60 * 60 * 1_000);
      expect(await date.inputValue()).toBe("2026-10-20");
      expect(await page.locator("[data-timeline-date]").getAttribute("data-timeline-date")).toBe("2026-10-20");
      await date.fill("2026-10-23");
      await page.clock.fastForward(24 * 60 * 60 * 1_000);
      await page.waitForFunction(() => document.querySelector<HTMLInputElement>('input[type="date"]')?.value === "2026-10-24");
    } finally { await page.close(); }
  }, 20_000);

  test("mixed agenda keeps event editing and a failed save keeps the draft", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(server.url.href);
      await page.getByRole("button", { name: translate("en", "cal.row.editName").replace("{title}", "Planning call"), exact: true }).click();
      const row = page.locator('[data-component="EventRow"][data-editing="true"]');
      const title = row.getByRole("textbox", { name: translate("en", "cal.row.title"), exact: true });
      await title.fill("Updated planning call");
      await page.evaluate(() => (window as unknown as { planFixture: { setFail(value: boolean): void } }).planFixture.setFail(true));
      await row.getByRole("button", { name: translate("en", "cal.row.save"), exact: true }).click();
      await row.getByRole("alert").waitFor();
      expect(await title.inputValue()).toBe("Updated planning call");
      await page.evaluate(() => (window as unknown as { planFixture: { setFail(value: boolean): void } }).planFixture.setFail(false));
      await row.getByRole("button", { name: translate("en", "cal.row.save"), exact: true }).click();
      await page.getByText("Updated planning call", { exact: true }).waitFor();
      expect(await page.locator('[data-component="EventRow"][data-editing="true"]').count()).toBe(0);
    } finally { await page.close(); }
  }, 15_000);

  test("signed-out, loading and empty Plan states stay distinct", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.url}?state=loading`);
      await page.locator('[aria-busy="true"]').first().waitFor();
      expect(await page.locator('[data-testid="plan-agenda"]').count()).toBe(0);
      await page.goto(`${server.url}?state=signed-out`);
      await page.getByRole("button", { name: "Board", exact: true }).click();
      await page.getByText(translate("en", "gx.signedOut"), { exact: true }).waitFor();
      expect(await page.locator('[data-component="Kanban"]').count()).toBe(0);
      await page.goto(server.url.href);
      await page.locator('[data-testid="plan-agenda"]').waitFor();
      await page.evaluate(() => (window as unknown as { planFixture: { clear(): void } }).planFixture.clear());
      await page.getByText(translate("en", "tasks.empty.title"), { exact: true }).waitFor();
      expect(await page.locator('[data-plan-date]').count()).toBe(0);
    } finally { await page.close(); }
  }, 20_000);
}
