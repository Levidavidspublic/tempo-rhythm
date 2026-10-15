// Signed-in sweep (weekend alpha run, target 2): every app screen at 390 and 1280 px, light and
// dark, en and he, with the synthetic test account. A render fails on an uncaught page error, an
// error screen, a server error or a horizontal scroll. It only loads pages: no clicks that write.
// Exit: 0 clean, 1 at least one failing render, 2 BLOCKED_VERIFICATION (no approved session).
//
//   ALPHA_STORAGE_STATE=… node e2e/alpha/sweep.mjs [--only today,notes] [--widths 390,1280]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL, EXIT, launch, newContext } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(process.env.ALPHA_OUT || path.join(HERE, "out"), "sweep", new Date().toISOString().replace(/[:.]/g, "-"));

/** Every signed-in route without a parameter (apps/web/app/(tempo) and (bare)). */
const STATIC_ROUTES = [
  "/today", "/week", "/coach", "/brain-dump", "/plan", "/journal", "/daily-note", "/notes", "/search", "/command",
  "/tasks", "/tasks/checklists", "/tasks/energy", "/tasks/priority", "/calendar", "/habits", "/routines",
  "/goals", "/goals/progress", "/projects", "/templates", "/templates/builder", "/templates/sketch",
  "/insights", "/activity", "/history", "/tracking", "/notifications", "/modules", "/empty-states",
  "/settings", "/settings/profile", "/settings/preferences", "/settings/privacy", "/settings/integrations",
  "/settings/memory", "/settings/memory/import", "/settings/nags", "/settings/passkeys",
  "/billing", "/billing/trial-end", "/ask-founder", "/admin/approvals", "/onboarding",
];

/** Routes with a parameter: the first matching link found on the listed page (1280, light, en). */
const DYNAMIC_ROUTES = [
  { from: "/notes", pattern: /^\/notes\/[^/?#]+$/ },
  { from: "/today", pattern: /^\/week\/[^/?#]+$/ },
  { from: "/templates", pattern: /^\/templates\/run\/[^/?#]+$/ },
  { from: "/templates", pattern: /^\/templates\/editor\/[^/?#]+$/ },
  { from: "/goals", pattern: /^\/goals\/(?!progress)[^/?#]+$/ },
  { from: "/projects", pattern: /^\/projects\/[^/?#]+$/ },
  { from: "/habits", pattern: /^\/habits\/[^/?#]+$/ },
  { from: "/routines", pattern: /^\/routines\/[^/?#]+$/ },
];

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flag("--only")?.split(",").map((r) => (r.startsWith("/") ? r : `/${r}`));
const widths = (flag("--widths") ?? "390,1280").split(",").map(Number);
const VARIANTS = [];
for (const width of widths) for (const theme of ["light", "dark"]) for (const lang of ["en", "he"]) VARIANTS.push({ width, theme, lang });

/** Text that means the screen failed, even when nothing threw. */
const ERROR_TEXT = /Application error: a client-side exception|Something went wrong|Unhandled Runtime Error|This page could not be found|Internal Server Error/i;

async function render(browser, statePath, route, v) {
  const context = await newContext(browser, statePath, {
    viewport: { width: v.width, height: v.width < 600 ? 844 : 900 },
    colorScheme: v.theme,
  });
  const page = await context.newPage();
  const rec = { route, ...v, errors: [], console: [], status: 0, finalPath: "", overflow: 0, errorText: "" };
  page.on("pageerror", (e) => rec.errors.push(String(e.message || e).split("\n")[0].slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() === "error") rec.console.push(m.text().split("\n")[0].slice(0, 200));
  });
  try {
    const response = await page.goto(`${BASE_URL}${route}?theme=${v.theme}&lang=${v.lang}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    rec.status = response?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.getByTestId("approval-loading").waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(800);
  } catch (error) {
    rec.errors.push(`navigation: ${String(error.message).split("\n")[0].slice(0, 160)}`);
  }
  rec.finalPath = new URL(page.url()).pathname;
  const probe = await page
    .evaluate(() => ({
      text: document.body?.innerText ?? "",
      overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - document.documentElement.clientWidth,
      waiting: Boolean(document.querySelector('[data-testid="approval-waiting"]')),
      dir: document.documentElement.dir,
    }))
    .catch(() => ({ text: "", overflow: 0, waiting: false, dir: "" }));
  rec.overflow = Math.max(0, probe.overflow);
  rec.errorText = ERROR_TEXT.exec(probe.text)?.[0] ?? "";
  rec.waiting = probe.waiting;
  rec.dir = probe.dir;
  const shot = path.join(OUT, `${route.replace(/\//g, "_")}__${v.width}-${v.theme}-${v.lang}.png`);
  await page.screenshot({ path: shot }).catch(() => {});
  rec.shot = path.relative(process.cwd(), shot);
  let links = [];
  if (v.width === 1280 && v.theme === "light" && v.lang === "en") {
    links = await page.$$eval("a[href]", (as) => as.map((a) => new URL(a.href).pathname)).catch(() => []);
  }
  await context.close();
  return { rec, links };
}

const failed = (r) =>
  r.errors.length > 0 || r.errorText || r.status >= 500 || r.overflow > 1 || r.finalPath.startsWith("/sign-in") || r.waiting;

async function main() {
  const statePath = process.env.ALPHA_STORAGE_STATE;
  if (!statePath) {
    console.log("sweep BLOCKED_VERIFICATION: ALPHA_STORAGE_STATE is not set");
    process.exit(EXIT.BLOCKED_VERIFICATION);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const results = [];
  const found = new Map();
  const routes = only ?? STATIC_ROUTES;
  // First pass at 1280/light/en also collects links for the routes with a parameter.
  const queue = [];
  for (const route of routes) for (const v of VARIANTS) queue.push({ route, v });
  const runQueue = async (items) => {
    const workers = Array.from({ length: Number(process.env.ALPHA_SWEEP_WORKERS ?? 4) }, async () => {
      for (let item = items.shift(); item; item = items.shift()) {
        const { rec, links } = await render(browser, statePath, item.route, item.v);
        results.push(rec);
        for (const dyn of DYNAMIC_ROUTES) {
          if (dyn.from !== item.route || found.has(dyn.pattern.source)) continue;
          const hit = links.find((l) => dyn.pattern.test(l));
          if (hit) found.set(dyn.pattern.source, hit);
        }
        console.log(`${failed(rec) ? "FAIL" : "ok  "} ${rec.route} ${rec.width}-${rec.theme}-${rec.lang}`);
      }
    });
    await Promise.all(workers);
  };
  await runQueue(queue);
  if (!only) {
    const dynQueue = [];
    for (const route of found.values()) for (const v of VARIANTS) dynQueue.push({ route, v });
    await runQueue(dynQueue);
  }
  await browser.close();

  const blocked = results.length > 0 && results.every((r) => r.waiting || r.finalPath.startsWith("/sign-in"));
  const bad = results.filter(failed);
  const lines = [
    `# Signed-in sweep, ${new Date().toISOString()}`,
    "",
    `${BASE_URL}: ${results.length} renders of ${new Set(results.map((r) => r.route)).size} routes, ${bad.length} failing.`,
    `Routes with a parameter found: ${[...found.values()].join(", ") || "none"}.`,
    `Not found (no link on its list page): ${DYNAMIC_ROUTES.filter((d) => !found.has(d.pattern.source)).map((d) => d.pattern.source).join(", ") || "none"}.`,
    "",
    "| route | variant | problem |",
    "|---|---|---|",
    ...bad.map(
      (r) =>
        `| ${r.route} | ${r.width}-${r.theme}-${r.lang} | ${[
          r.errors.length ? `page error: ${r.errors.join(" ; ")}` : "",
          r.errorText ? `error text: ${r.errorText}` : "",
          r.status >= 500 ? `HTTP ${r.status}` : "",
          r.overflow > 1 ? `horizontal scroll ${r.overflow}px` : "",
          r.finalPath.startsWith("/sign-in") ? "redirected to sign-in" : "",
          r.waiting ? "waiting for approval" : "",
        ]
          .filter(Boolean)
          .join("; ")
          .replace(/\|/g, "/")} |`,
    ),
    "",
    "Console errors (reported, not failing):",
    ...[...new Set(results.flatMap((r) => r.console.map((c) => `${r.route}: ${c}`)))].slice(0, 40).map((c) => `- ${c}`),
  ];
  writeFileSync(path.join(OUT, "summary.md"), `${lines.join("\n")}\n`);
  writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify(results, null, 1)}\n`);
  const code = blocked ? EXIT.BLOCKED_VERIFICATION : bad.length ? EXIT.FAIL : EXIT.PASS;
  console.log(`sweep ${Object.entries(EXIT).find(([, c]) => c === code)?.[0]}: ${results.length} renders, ${bad.length} failing (${path.relative(process.cwd(), OUT)}/summary.md)`);
  process.exit(code);
}

await main();
