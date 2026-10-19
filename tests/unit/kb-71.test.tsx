import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../..");
const child = process.env.KB71_FIXTURE_CHILD === "1";

declare global {
  interface Window {
    __kb71: {
      events: string[];
      calls: Array<{ name: string; args: { status?: string; localDate?: string } }>;
      ref?: string;
      linkRef?: string;
    };
  }
}

type Results = Record<string, boolean | number | string>;

async function runFixture(): Promise<Results> {
  const { chromium } = await import("@playwright/test");
  const postcss = (await import("../../apps/web/node_modules/postcss/lib/postcss.mjs")).default;
  const tailwind = (await import("../../apps/web/node_modules/@tailwindcss/postcss/dist/index.mjs"))
    .default;
  await mkdir(join(repo, "apps/web/work"), { recursive: true });
  const directory = await mkdtemp(join(repo, "apps/web/work/kb71-"));
  const root = join(repo, "apps/web");
  const buttonPath = join(root, "components/ui/button.tsx");
  // Byte-for-byte baseline source captured from integration 52bf280 before editing.
  const frozen =
    'import { Slot } from "@radix-ui/react-slot";\nimport { cva, type VariantProps } from "class-variance-authority";\nimport * as React from "react";\n\nimport { cn } from "@/lib/utils";\n\nconst buttonVariants = cva(\n  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",\n  {\n    variants: {\n      variant: {\n        default: "bg-primary text-primary-foreground hover:bg-primary/90",\n        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",\n        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",\n        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",\n        ghost: "hover:bg-accent hover:text-accent-foreground",\n        link: "text-primary underline-offset-4 hover:underline",\n      },\n      size: {\n        default: "h-10 px-4 py-2",\n        sm: "h-9 rounded-md px-3",\n        lg: "h-11 rounded-md px-8",\n        icon: "h-10 w-10",\n      },\n    },\n    defaultVariants: {\n      variant: "default",\n      size: "default",\n    },\n  }\n);\n\nexport interface ButtonProps\n  extends React.ButtonHTMLAttributes<HTMLButtonElement>,\n    VariantProps<typeof buttonVariants> {\n  asChild?: boolean;\n}\n\nconst Button = React.forwardRef<HTMLButtonElement, ButtonProps>(\n  ({ className, variant, size, asChild = false, ...props }, ref) => {\n    const Comp = asChild ? Slot : "button";\n    return (\n      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />\n    );\n  }\n);\nButton.displayName = "Button";\n\nexport { Button, buttonVariants };\n';
  const cssSource = join(root, "app/globals.css");
  const css = (
    await postcss([tailwind({ base: repo })]).process(await readFile(cssSource, "utf8"), {
      from: cssSource,
    })
  ).css;
  const results: Results = {};
  const assets = new Map<string, Uint8Array>();
  assets.set("/globals.css", new TextEncoder().encode(css));
  const react = join(root, "node_modules/react");
  const reactClient = join(root, "node_modules/react-dom/client");
  const adminPath = join(root, "components/approval/AdminApprovals.tsx");
  const dayPath = join(root, "components/day-plan-panel/DayPlanPanel.tsx");
  const apiStub = `export const api={approval:{myStatus:"approval.myStatus",listForAdmin:"approval.listForAdmin",setStatus:"approval.setStatus"},users:{getProfile:"users.getProfile"},dayPlans:{getForDate:"dayPlans.getForDate",listCarryOver:"dayPlans.listCarryOver",upsert:"dayPlans.upsert",commit:"dayPlans.commit"},tasks:{listToday:"tasks.listToday"}};`;
  const convexStub = `export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const useQuery=(name,args)=>args==="skip"?undefined:window.__kb71.queries[name];export const useMutation=(name)=>(args)=>window.__kb71.mutate(name,args);`;
  const localeStub = `import {translate} from ${JSON.stringify(join(root, "lib/i18n.ts"))};export const useLocale=()=>({lang:window.__kb71.lang,t:(key)=>translate(window.__kb71.lang,key)});`;
  const boundsStub = `export const useLocalDayBounds=()=>({startMs:1735689600000,endMs:1735776000000});`;
  const captureDir = process.env.KB71_CAPTURE_DIR;
  for (const phase of (captureDir ? ["before", "after"] : ["after"]) as Array<"before" | "after">) {
    const entry = join(directory, `${phase}.tsx`);
    await writeFile(
      entry,
      `import React from ${JSON.stringify(react)};import {createRoot} from ${JSON.stringify(reactClient)};import {Button${phase === "after" ? ",Kb71Gallery" : ""}} from ${JSON.stringify(buttonPath)};import {AdminApprovals} from ${JSON.stringify(adminPath)};import {DayPlanPanel} from ${JSON.stringify(dayPath)};
const p=new URLSearchParams(location.search);const kind=p.get("kind");const lang=p.get("lang")==="he"?"he":"en";
function Primitive(){return <main><h1>Button contract</h1><form onSubmit={e=>{e.preventDefault();window.__kb71.events.push("submit")}}><Button ref={node=>{if(node)window.__kb71.ref=node.tagName}} data-kb="native" aria-label="Native action" className="kb71-custom" onClick={()=>window.__kb71.events.push("native")}>Native action</Button><Button type="button" onClick={()=>window.__kb71.events.push("explicit")}>Explicit button</Button><Button disabled onClick={()=>window.__kb71.events.push("disabled")}>Disabled action</Button><Button size="icon" aria-label="Add item">＋</Button><Button asChild variant="outline"><a href="/today" onClick={e=>{e.preventDefault();window.__kb71.events.push("link")}} ref={node=>{if(node)window.__kb71.linkRef=node.tagName}}>Open today</a></Button><Button className="kb71-unbroken">SupercalifragilisticexpialidociousUnbrokenLongActionLabelForPhone</Button><Button className="h-16">Explicit height</Button></form></main>}
const view=kind==="admin"?<main><AdminApprovals/></main>:kind==="day"?<main><h1>Today</h1><DayPlanPanel/></main>:kind==="gallery"?${phase === "after" ? "<Kb71Gallery lang={lang} onAction={sample=>window.__kb71.events.push(sample)} onLink={()=>window.__kb71.events.push('gallery-link')}/>" : "<Primitive/>"}:<Primitive/>;
createRoot(document.getElementById("root")).render(view);`
    );
    const built = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      outdir: directory,
      minify: false,
      plugins: [
        {
          name: "kb71-fixture",
          setup(build) {
            build.onResolve({ filter: /^convex\/react$/ }, () => ({
              path: "convex-react",
              namespace: "kb71",
            }));
            build.onResolve({ filter: /^@\/convex\/_generated\/api$/ }, () => ({
              path: "api",
              namespace: "kb71",
            }));
            build.onResolve({ filter: /^@\/components\/providers\/LocaleProvider$/ }, () => ({
              path: "locale",
              namespace: "kb71",
            }));
            build.onResolve({ filter: /^@\/lib\/useLocalDayBounds$/ }, () => ({
              path: "bounds",
              namespace: "kb71",
            }));
            build.onLoad({ filter: /.*/, namespace: "kb71" }, ({ path }) => ({
              contents: (
                {
                  "convex-react": convexStub,
                  api: apiStub,
                  locale: localeStub,
                  bounds: boundsStub,
                } as Record<string, string>
              )[path],
              loader: "js",
            }));
            if (phase === "before")
              build.onLoad({ filter: /components\/ui\/button\.tsx$/ }, () => ({
                contents: frozen,
                loader: "tsx",
              }));
          },
        },
      ],
    });
    if (!built.success)
      throw new Error(`KB71 ${phase} bundle failed: ${built.logs.map(String).join(" | ")}`);
    for (const output of built.outputs)
      assets.set(
        `/${phase}-${output.path.split("/").at(-1)}`,
        new Uint8Array(await output.arrayBuffer())
      );
  }
  if (process.env.KB71_BUNDLE_ONLY === "1") {
    await rm(directory, { recursive: true, force: true });
    return { bundled: true };
  }
  const browserPath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].find(existsSync);
  if (!browserPath)
    throw new Error(
      "KB71 browser fixture needs Playwright Chromium or an installed chromium/google-chrome binary"
    );
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/") {
        const asset = assets.get(url.pathname);
        return asset
          ? new Response(asset, {
              headers: {
                "content-type": url.pathname.endsWith(".css") ? "text/css" : "text/javascript",
              },
            })
          : new Response("missing", { status: 404 });
      }
      const phase = url.searchParams.get("phase") === "before" ? "before" : "after";
      const scripts = [...assets.keys()].filter(
        (k) => k.startsWith(`/${phase}-`) && k.endsWith(".js")
      );
      const styles = [...assets.keys()].filter(
        (k) => k.startsWith(`/${phase}-`) && k.endsWith(".css")
      );
      const lang = url.searchParams.get("lang") === "he" ? "he" : "en";
      const theme = url.searchParams.get("theme") === "dark" ? "dark" : "light";
      const planStatus = url.searchParams.get("plan") === "committed" ? "committed" : "draft";
      const queries = {
        "approval.myStatus": {
          status: "approved",
          isAdmin: true,
          email: "fictional-admin@example.test",
        },
        "approval.listForAdmin": [
          {
            _id: "person-a",
            email: "maya@example.test",
            status: "pending",
            isAdmin: false,
            createdAt: 1735689600000,
          },
          {
            _id: "person-b",
            email: "dana@example.test",
            status: "approved",
            isAdmin: false,
            createdAt: 1735689600000,
          },
          {
            _id: "person-c",
            email: "yoni@example.test",
            status: "revoked",
            isAdmin: false,
            createdAt: 1735689600000,
          },
        ],
        "users.getProfile": { _id: "fictional-user", greetingName: "Maya" },
        "dayPlans.getForDate": {
          _id: "fictional-plan",
          userId: "fictional-user",
          localDate: "2025-01-01",
          status: planStatus,
          intention: "A calm day",
          topTaskIds: [],
          createdAt: 1735689600000,
          updatedAt: 1735689600000,
        },
        "tasks.listToday": [],
        "dayPlans.listCarryOver": [],
      };
      const state = `window.process={env:{NODE_ENV:"production"}};window.__kb71={lang:${JSON.stringify(lang)},events:[],calls:[],failCommitOnce:true,queries:${JSON.stringify(queries)},mutate:async function(name,args){this.calls.push({name,args});if(name==="dayPlans.commit"&&this.failCommitOnce){this.failCommitOnce=false;throw Error("fictional failure")}return name==="dayPlans.commit"?{dayPlanId:"fictional-plan",committedAt:1735689600000}:name==="approval.setStatus"?{userId:args.userId,status:args.status}:"fictional-plan"}};`;
      const html = `<!doctype html><html lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css">${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join("")}</head><body><div id="root"></div><script>${state}</script><script src="${scripts[0]}"></script></body></html>`;
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });
  const open = async (
    phase: "before" | "after",
    kind: string,
    lang: "en" | "he",
    width: number,
    theme: "light" | "dark",
    plan?: string
  ) => {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:${server.port}/?phase=${phase}&kind=${kind}&lang=${lang}&theme=${theme}&plan=${plan ?? "draft"}`
    );
    await page.locator("h1").first().waitFor({ timeout: 10000 });
    if (kind === "day") {
      const action =
        plan === "committed"
          ? lang === "he"
            ? "עריכת התוכנית"
            : "Edit plan"
          : lang === "he"
            ? "זה היום שלי"
            : "This is my day";
      await page.getByRole("button", { name: action }).waitFor({ timeout: 10000 });
    }
    if (kind === "day")
      await page
        .getByRole("button", {
          name:
            plan === "committed"
              ? lang === "he"
                ? "עריכת התוכנית"
                : "Edit plan"
              : lang === "he"
                ? "זה היום שלי"
                : "This is my day",
        })
        .waitFor({ timeout: 10000 });
    if (errors.length) throw Error(`KB71 ${phase}/${kind} page errors: ${errors.join(" | ")}`);
    if (captureDir)
      await page.screenshot({
        path: join(
          captureDir,
          `${phase}-${kind}-${lang}-${width}-${theme}${plan ? `-${plan}` : ""}.png`
        ),
        fullPage: true,
      });
    return page;
  };
  try {
    const measure = async (page: Awaited<ReturnType<typeof browser.newPage>>, selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            w: r.width,
            h: r.height,
            nowrap: getComputedStyle(el).whiteSpace,
            outline: getComputedStyle(el).outlineStyle,
            shadow: getComputedStyle(el).boxShadow,
            transition: getComputedStyle(el).transitionDuration,
          };
        });
    if (captureDir) {
      const before = await open("before", "admin", "en", 390, "light");
      results.beforeAdminSmall = (await measure(before, "button")).h;
      await before.close();
    }
    const admin = await open("after", "admin", "en", 390, "light");
    results.adminActions = (await admin.getByRole("button").allTextContents()).join("|");
    results.adminMin = Math.min(
      ...(await admin.locator("button").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return Math.min(r.width, r.height);
        })
      ))
    );
    await admin.getByRole("button", { name: "Approve" }).first().click();
    await admin.getByRole("button", { name: "Revoke" }).first().click();
    await admin.getByRole("button", { name: "Back to pending" }).click();
    results.adminCalls = await admin.evaluate(() =>
      JSON.stringify(
        window.__kb71.calls.filter((c) => c.name === "approval.setStatus").map((c) => c.args.status)
      )
    );
    results.adminOneMainH1 = await admin.evaluate(
      () =>
        document.querySelectorAll("main").length === 1 &&
        document.querySelectorAll("h1").length === 1
    );
    await admin.close();
    const dayCommitted = await open("after", "day", "en", 390, "light", "committed");
    await dayCommitted.getByRole("button", { name: "Edit plan" }).waitFor();
    results.dayEdit = (await measure(dayCommitted, "button")).h;
    await dayCommitted.getByRole("button", { name: "Edit plan" }).click();
    results.dayEditOpens = await dayCommitted
      .getByRole("button", { name: "Done editing" })
      .isVisible();
    await dayCommitted.close();
    const day = await open("after", "day", "en", 390, "light");
    await day.getByRole("button", { name: "This is my day" }).waitFor();
    results.dayCommit = (await measure(day, "button")).h;
    await day.getByRole("button", { name: "This is my day" }).click();
    await day.getByRole("alert").waitFor();
    results.dayRetry = (await measure(day, "[role=alert] button")).h;
    await day.getByRole("button", { name: "Try again" }).click();
    results.dayCalls = await day.evaluate(() =>
      JSON.stringify(
        window.__kb71.calls.filter((c) => c.name === "dayPlans.commit").map((c) => c.args.localDate)
      )
    );
    await day.close();
    const primitive = await open("after", "primitive", "en", 390, "light");
    results.defaultPhone = (await measure(primitive, "button.kb71-button")).h;
    results.explicitHeight = await primitive
      .getByRole("button", { name: "Explicit height" })
      .evaluate((el) => el.getBoundingClientRect().height);
    results.icon = await primitive.getByRole("button", { name: "Add item" }).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.width, r.height);
    });
    results.ref = await primitive.evaluate(() => window.__kb71.ref);
    results.nativeType =
      (await primitive.getByRole("button", { name: "Native action" }).getAttribute("type")) ??
      "omitted";
    await primitive.getByRole("button", { name: "Native action" }).click();
    results.submit = await primitive.evaluate(() => JSON.stringify(window.__kb71.events));
    await primitive.getByRole("button", { name: "Explicit button" }).click();
    results.explicit = await primitive.evaluate(() => JSON.stringify(window.__kb71.events));
    await primitive
      .getByRole("button", { name: "Disabled action" })
      .click({ force: true })
      .catch(() => {});
    results.disabled = await primitive.evaluate(() => window.__kb71.events.includes("disabled"));
    results.attrs = await primitive
      .getByRole("button", { name: "Native action" })
      .evaluate(
        (el) =>
          el.classList.contains("kb71-custom") &&
          el.getAttribute("data-kb") === "native" &&
          el.getAttribute("aria-label") === "Native action"
      );
    const link = primitive.getByRole("link", { name: "Open today" });
    results.linkHref = (await link.getAttribute("href")) ?? "";
    results.linkRef = await primitive.evaluate(() => window.__kb71.linkRef);
    await link.focus();
    await link.press("Enter");
    results.linkCall = await primitive.evaluate(() => window.__kb71.events.includes("link"));
    await primitive.keyboard.press("Tab");
    await primitive.waitForFunction(() => {
      const el = document.activeElement;
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    });
    const focus = await primitive.evaluate(() => {
      const el = document.activeElement;
      const s = el ? getComputedStyle(el) : null;
      return Boolean(s && (s.outlineStyle !== "none" || s.boxShadow !== "none"));
    });
    results.focus = focus;
    results.reducedMotion = (await measure(primitive, "button.kb71-button")).transition;
    results.longNoOverflow = await primitive.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    );
    await primitive.close();
    const gallery = await open("after", "gallery", "he", 390, "dark");
    results.small = (await measure(gallery, "button")).h;
    results.galleryDir = (await gallery.locator("main").getAttribute("dir")) ?? "";
    results.galleryOneMainH1 = await gallery.evaluate(
      () =>
        document.querySelectorAll("main").length === 1 &&
        document.querySelectorAll("h1").length === 1
    );
    results.galleryMin = Math.min(
      ...(await gallery.locator("button,a.kb71-button").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return Math.min(r.width, r.height);
        })
      ))
    );
    results.galleryNoOverflow = await gallery.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    );
    results.galleryLongWrap = (await measure(gallery, ".kb71-gallery__long")).nowrap;
    await gallery.evaluate(() => {
      document.documentElement.style.fontSize = "24px";
    });
    await gallery.waitForFunction(
      () => parseFloat(getComputedStyle(document.documentElement).fontSize) === 24
    );
    results.largeTextContained = await gallery.locator(".kb71-gallery__long").evaluate((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const text = range.getBoundingClientRect();
      const hit = button.getBoundingClientRect();
      return text.top >= hit.top - 1 && text.bottom <= hit.bottom + 1 && hit.height > 44;
    });
    results.largeTextNoOverflow = await gallery.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    );
    await gallery.close();
    const desktop = await open("after", "gallery", "en", 1280, "light");
    results.desktopSmall = (await measure(desktop, "button")).h;
    results.desktopLarge = await desktop
      .locator("button")
      .nth(2)
      .evaluate((el) => el.getBoundingClientRect().height);
    await desktop.close();
    for (const phase of (captureDir ? ["before", "after"] : ["after"]) as Array<"before" | "after">)
      for (const kind of ["admin", "day"] as const)
        for (const lang of ["en", "he"] as const)
          for (const width of [390, 1280])
            for (const theme of ["light", "dark"] as const) {
              const page = await open(phase, kind, lang, width, theme);
              results[`caller-${phase}-${kind}-${lang}-${width}-${theme}`] = await page.evaluate(
                () =>
                  document.documentElement.scrollWidth <= innerWidth &&
                  document.querySelectorAll("main").length === 1 &&
                  document.querySelectorAll("h1").length === 1
              );
              if (phase === "after" && width === 390)
                results[`caller-touch-${kind}-${lang}-${theme}`] = Math.min(
                  ...(await page.locator("button").evaluateAll((nodes) =>
                    nodes.map((n) => {
                      const r = n.getBoundingClientRect();
                      return Math.min(r.width, r.height);
                    })
                  ))
                );
              await page.close();
            }
    for (const lang of ["en", "he"] as const)
      for (const width of [390, 1280])
        for (const theme of ["light", "dark"] as const) {
          const page = await open("after", "gallery", lang, width, theme);
          results[`matrix-${lang}-${width}-${theme}`] = await page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.querySelectorAll("main").length === 1 &&
              document.querySelectorAll("h1").length === 1
          );
          if (width === 390)
            results[`matrix-touch-${lang}-${theme}`] = Math.min(
              ...(await page.locator(".kb71-button").evaluateAll((nodes) =>
                nodes.map((n) => {
                  const r = n.getBoundingClientRect();
                  return Math.min(r.width, r.height);
                })
              ))
            );
          await page.close();
        }
  } finally {
    await browser.close();
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
  return results;
}

if (child) {
  try {
    console.log(JSON.stringify(await runFixture()));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
} else {
  const { beforeAll, describe, expect, test } = await import("bun:test");
  const { createElement } = await import("../../apps/web/node_modules/react");
  const { renderToStaticMarkup } = await import("../../apps/web/node_modules/react-dom/server");
  const { Button, buttonVariants, Kb71Gallery } = await import(
    "../../apps/web/components/ui/button"
  );
  const { en, he, kb71t } = await import("../../apps/web/lib/i18n-groups/kb-71");
  let r: Results = {};
  beforeAll(async () => {
    const proc = Bun.spawn([process.execPath, import.meta.path], {
      cwd: repo,
      env: { ...process.env, KB71_FIXTURE_CHILD: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) throw Error(`KB71 clean child exited ${code}: ${err.slice(-5000)}`);
    r = JSON.parse(out.trim().split("\n").at(-1) ?? "{}");
  }, 240_000);
  describe("KB-71 shared Button contract", () => {
    test("small phone button reaches 44 px", () => expect(r.small).toBeGreaterThanOrEqual(44));
    test("default phone button reaches 44 px", () => {
      expect(r.defaultPhone).toBeGreaterThanOrEqual(44);
      expect(r.dayCommit).toBeGreaterThanOrEqual(44);
    });
    test("icon phone button reaches 44 px in both axes", () =>
      expect(r.icon).toBeGreaterThanOrEqual(44));
    test("large button keeps its original minimum", () =>
      expect(r.desktopLarge).toBeGreaterThanOrEqual(44));
    test("caller explicit height class is preserved on phone", () =>
      expect(r.explicitHeight).toBe(64));
    test("desktop small button retains 36 px density", () => expect(r.desktopSmall).toBe(36));
    test("actual AdminApprovals decision actions have phone targets", () => {
      if (process.env.KB71_CAPTURE_DIR) expect(r.beforeAdminSmall).toBe(36);
      expect(r.adminMin).toBeGreaterThanOrEqual(44);
      expect(r.adminActions).toContain("Back to pending");
      expect(r.adminCalls).toBe('["approved","revoked","pending"]');
    });
    test("actual DayPlanPanel Edit Commit and Retry have phone targets", () => {
      expect(r.dayEdit).toBeGreaterThanOrEqual(44);
      expect(r.dayEditOpens).toBe(true);
      expect(r.dayRetry).toBeGreaterThanOrEqual(44);
      expect(r.dayCalls).toBe('["2025-01-01","2025-01-01"]');
    });
    test("disabled native button never calls back", () => expect(r.disabled).toBe(false));
    test("enabled callback and forwarded native ref work", () => {
      expect(r.ref).toBe("BUTTON");
      expect(r.submit).toBe('["native","submit"]');
    });
    test("native omitted type still submits", () => expect(r.nativeType).toBe("omitted"));
    test("explicit type button does not submit", () =>
      expect(r.explicit).toBe('["native","submit","explicit"]'));
    test("asChild link keeps href keyboard click and ref", () => {
      expect(r.linkHref).toBe("/today");
      expect(r.linkRef).toBe("A");
      expect(r.linkCall).toBe(true);
    });
    test("custom class and aria/data attributes survive", () => expect(r.attrs).toBe(true));
    test("keyboard focus is visible and reduced motion applies", () => {
      expect(r.focus).toBe(true);
      expect(Number(String(r.reducedMotion).replace(/s$/, ""))).toBeLessThanOrEqual(0.00002);
    });
    test("long phone label wraps inside its hit area at large text", () => {
      expect(r.longNoOverflow).toBe(true);
      expect(r.galleryNoOverflow).toBe(true);
      expect(r.galleryLongWrap).toBe("normal");
      expect(r.largeTextContained).toBe(true);
      expect(r.largeTextNoOverflow).toBe(true);
    });
    test("pure gallery is bilingual and has one main and heading", () => {
      expect(r.galleryDir).toBe("rtl");
      expect(r.galleryOneMainH1).toBe(true);
      expect(r.adminOneMainH1).toBe(true);
      expect(renderToStaticMarkup(createElement(Kb71Gallery, { lang: "he" }))).toContain(
        "כפתורים בטלפון"
      );
    });
    test("all gallery phone controls have 44 px hit areas", () =>
      expect(r.galleryMin).toBeGreaterThanOrEqual(44));
    test("locale theme and viewport matrix keeps one page and no overflow", () => {
      for (const lang of ["en", "he"])
        for (const width of [390, 1280])
          for (const theme of ["light", "dark"]) {
            expect(r[`matrix-${lang}-${width}-${theme}`]).toBe(true);
            if (width === 390) {
              expect(r[`matrix-touch-${lang}-${theme}`]).toBeGreaterThanOrEqual(44);
              for (const kind of ["admin", "day"]) {
                expect(r[`caller-touch-${kind}-${lang}-${theme}`]).toBeGreaterThanOrEqual(44);
              }
            }
            for (const kind of ["admin", "day"])
              for (const phase of process.env.KB71_CAPTURE_DIR ? ["before", "after"] : ["after"])
                expect(r[`caller-${phase}-${kind}-${lang}-${width}-${theme}`]).toBe(true);
          }
    });
    test("dictionary keys and callable variant export remain paired", () => {
      expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(kb71t("he", key).trim()).not.toBe("");
        expect(kb71t("en", key).trim()).not.toBe("");
      }
      expect(buttonVariants({ size: "sm" })).toContain("kb71-button");
      expect(
        renderToStaticMarkup(
          createElement(Button, { asChild: true }, createElement("a", { href: "/today" }, "Today"))
        )
      ).toContain('href="/today"');
    });
  });
}
