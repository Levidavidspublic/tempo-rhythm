// Signed-in sweep (weekend alpha run, target 2): every app screen at 390 and 1280 px, light and
// dark, en and he, with the synthetic test account. A render fails on an uncaught page error, an
// error screen, a server error or a horizontal scroll. It only loads pages: no clicks that write.
// Exit: 0 clean, 1 at least one failing render, 2 BLOCKED_VERIFICATION (no approved session).
//
//   ALPHA_STORAGE_STATE=… node e2e/alpha/sweep.mjs [--only today,notes] [--widths 390,1280]
import { accessSync, constants, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL, EXIT, launch, newContext, saveState, watchNetwork } from "./lib.mjs";

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
  // No drafts exist yet, so nothing links here; the screen draws its empty state for any id.
  "/modules/preview/alpha-sweep",
];

/**
 * Routes with a parameter: the first matching link found on the listed page (1280, light, en).
 * `nested` are the screens under a found route that have no link to discover from a list page.
 */
const DYNAMIC_ROUTES = [
  { from: "/notes", pattern: /^\/notes\/[^/?#]+$/ },
  { from: "/today", pattern: /^\/week\/[^/?#]+$/ },
  { from: "/templates", pattern: /^\/templates\/run\/[^/?#]+$/ },
  { from: "/templates", pattern: /^\/templates\/editor\/[^/?#]+$/ },
  { from: "/goals", pattern: /^\/goals\/(?!progress)[^/?#]+$/ },
  { from: "/projects", pattern: /^\/projects\/[^/?#]+$/, nested: ["/kanban"] },
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
const WORKERS = Number(process.env.ALPHA_SWEEP_WORKERS ?? 4);
if (!Number.isInteger(WORKERS) || WORKERS < 1 || WORKERS > 16) {
  console.log("sweep FAIL: ALPHA_SWEEP_WORKERS must be a whole number from 1 to 16");
  process.exit(1);
}
const VARIANTS = [];
for (const width of widths) for (const theme of ["light", "dark"]) for (const lang of ["en", "he"]) VARIANTS.push({ width, theme, lang });

/**
 * A detail screen's own "not found" text (en, he). On a route found through a real link on a list
 * page it means a broken link, so it fails the render (a starter template's Use link did this).
 */
const MISSING_TEXT = /was not found|isn't here any ?more|Couldn't (open|load) this|לא נמצאה|כבר לא כאן|לא הצלחנו (לפתוח|לטעון)/i;

/** Text that means the screen failed, even when nothing threw. */
const ERROR_TEXT = /Application error: a client-side exception|Something went wrong|Unhandled Runtime Error|This page could not be found|Internal Server Error/i;

/**
 * One render in its own page. All pages share one context, so they share one session: Convex Auth
 * rotates the refresh token on load and serialises that across pages of a context with a browser
 * lock, while separate contexts would each replay the same token and sign the session out.
 */
async function render(context, route, v, discovered = false) {
  const first = await renderOnce(context, route, v, discovered);
  // A failed render with a request the sandbox network dropped (lib.mjs watchNetwork) says nothing
  // about the screen: it is rendered once more, and the summary lists the repeat.
  if (!failed(first.rec) || first.rec.dropped.length === 0) return first;
  const again = await renderOnce(context, route, v, discovered);
  again.rec.networkRepeat = first.rec.dropped[0];
  return again;
}

async function renderOnce(context, route, v, discovered) {
  const page = await context.newPage();
  const dropped = [];
  watchNetwork(page, dropped);
  await page.setViewportSize({ width: v.width, height: v.width < 600 ? 844 : 900 });
  await page.emulateMedia({ colorScheme: v.theme });
  const rec = { route, ...v, discovered, errors: [], console: [], status: 0, finalPath: "", overflow: 0, errorText: "", missingText: "", appliedTheme: "", dropped };
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
      // The theme the screen shows: an explicit data-theme wins over the system preference.
      theme:
        document.documentElement.getAttribute("data-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    }))
    .catch(() => ({ text: "", overflow: 0, waiting: false, dir: "", theme: "" }));
  rec.overflow = Math.max(0, probe.overflow);
  rec.errorText = ERROR_TEXT.exec(probe.text)?.[0] ?? "";
  rec.missingText = discovered ? (MISSING_TEXT.exec(probe.text)?.[0] ?? "") : "";
  rec.waiting = probe.waiting;
  rec.dir = probe.dir;
  rec.appliedTheme = probe.theme;
  const shot = path.join(OUT, `${route.replace(/\//g, "_")}__${v.width}-${v.theme}-${v.lang}.png`);
  await page.screenshot({ path: shot }).catch(() => {});
  rec.shot = path.relative(process.cwd(), shot);
  let links = [];
  if (v.width === 1280 && v.theme === "light" && v.lang === "en") {
    links = await page.$$eval("a[href]", (as) => as.map((a) => new URL(a.href).pathname)).catch(() => []);
  }
  await page.close();
  return { rec, links };
}

/** The document direction each language must render in. */
const DIR = { en: "ltr", he: "rtl" };

const failed = (r) =>
  r.errors.length > 0 ||
  r.errorText ||
  r.missingText ||
  r.status >= 400 ||
  r.status === 0 ||
  r.overflow > 1 ||
  r.finalPath.startsWith("/sign-in") ||
  r.waiting ||
  r.dir !== DIR[r.lang] ||
  r.appliedTheme !== r.theme;

async function main() {
  const statePath = process.env.ALPHA_STORAGE_STATE;
  if (!statePath) {
    console.log("sweep BLOCKED_VERIFICATION: ALPHA_STORAGE_STATE is not set");
    process.exit(EXIT.BLOCKED_VERIFICATION);
  }
  try {
    accessSync(statePath, constants.R_OK);
  } catch {
    console.log("sweep BLOCKED_VERIFICATION: ALPHA_STORAGE_STATE is not a readable file");
    process.exit(EXIT.BLOCKED_VERIFICATION);
  }
  mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const context = await newContext(browser, statePath);
  const results = [];
  const found = new Map();
  const routes = only ?? STATIC_ROUTES;
  // First pass at 1280/light/en also collects links for the routes with a parameter.
  const queue = [];
  for (const route of routes) for (const v of VARIANTS) queue.push({ route, v });
  const runQueue = async (items) => {
    const workers = Array.from({ length: WORKERS }, async () => {
      for (let item = items.shift(); item; item = items.shift()) {
        const { rec, links } = await render(context, item.route, item.v, Boolean(item.discovered));
        results.push(rec);
        for (const dyn of DYNAMIC_ROUTES) {
          if (dyn.from !== item.route || found.has(dyn.pattern.source)) continue;
          const hit = links.find((l) => dyn.pattern.test(l));
          if (hit) found.set(dyn.pattern.source, [hit, ...(dyn.nested ?? []).map((tail) => `${hit}${tail}`)]);
        }
        console.log(`${failed(rec) ? "FAIL" : "ok  "} ${rec.route} ${rec.width}-${rec.theme}-${rec.lang}`);
      }
    });
    await Promise.all(workers);
  };
  await runQueue(queue);
  if (!only) {
    const dynQueue = [];
    for (const route of [...found.values()].flat()) for (const v of VARIANTS) dynQueue.push({ route, v, discovered: true });
    await runQueue(dynQueue);
  }
  // The context rotated the refresh token: an unsaved state signs the next run out, so it fails this one.
  const saveError = await saveState(context).then(
    () => "",
    (error) => String(error?.message ?? error).split("\n")[0],
  );
  await browser.close();
  // Every route with a parameter must be reached: a list page that stops linking to its detail
  // screen, or an account without the data, would otherwise pass a sweep that skipped screens.
  const missing = only ? [] : DYNAMIC_ROUTES.filter((d) => !found.has(d.pattern.source)).map((d) => d.pattern.source);

  // Approval is per account: one "Waiting for approval" screen means the session is not approved,
  // even though a few screens sit outside the approval gate (/settings/passkeys).
  // A protected preview (401/403 on every load) never reached the app either.
  const blocked =
    results.length > 0 &&
    (results.some((r) => r.waiting) ||
      results.every((r) => r.finalPath.startsWith("/sign-in")) ||
      results.every((r) => r.status === 401 || r.status === 403));
  const bad = results.filter(failed);
  const lines = [
    `# Signed-in sweep, ${new Date().toISOString()}`,
    "",
    `${BASE_URL}: ${results.length} renders of ${new Set(results.map((r) => r.route)).size} routes, ${bad.length} failing.`,
    `Routes with a parameter found: ${[...found.values()].flat().join(", ") || "none"}.`,
    `Not reached (no link on its list page; fails the run): ${missing.join(", ") || "none"}.`,
    ...(saveError ? [`Session state not saved (fails the run): ${saveError}`] : []),
    "",
    "| route | variant | problem |",
    "|---|---|---|",
    ...bad.map(
      (r) =>
        `| ${r.route} | ${r.width}-${r.theme}-${r.lang} | ${[
          r.errors.length ? `page error: ${r.errors.join(" ; ")}` : "",
          r.errorText ? `error text: ${r.errorText}` : "",
          r.missingText ? `linked screen says "${r.missingText}"` : "",
          r.status >= 400 || r.status === 0 ? `HTTP ${r.status || "none"}` : "",
          r.dir !== DIR[r.lang] ? `dir "${r.dir}", not ${DIR[r.lang]}` : "",
          r.appliedTheme !== r.theme ? `theme "${r.appliedTheme}", not ${r.theme}` : "",
          r.overflow > 1 ? `horizontal scroll ${r.overflow}px` : "",
          r.finalPath.startsWith("/sign-in") ? "redirected to sign-in" : "",
          r.waiting ? "waiting for approval" : "",
        ]
          .filter(Boolean)
          .join("; ")
          .replace(/\|/g, "/")} |`,
    ),
    "",
    "Rendered again after a sandbox network drop (the first render failed with a dropped request):",
    ...(results.some((r) => r.networkRepeat)
      ? results.filter((r) => r.networkRepeat).map((r) => `- ${r.route} ${r.width}-${r.theme}-${r.lang}: ${r.networkRepeat}`)
      : ["- none"]),
    "",
    "Console errors (reported, not failing):",
    ...[...new Set(results.flatMap((r) => r.console.map((c) => `${r.route}: ${c}`)))].slice(0, 40).map((c) => `- ${c}`),
  ];
  writeFileSync(path.join(OUT, "summary.md"), `${lines.join("\n")}\n`);
  writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify(results, null, 1)}\n`);
  const code = blocked ? EXIT.BLOCKED_VERIFICATION : bad.length || missing.length || saveError ? EXIT.FAIL : EXIT.PASS;
  console.log(`sweep ${Object.entries(EXIT).find(([, c]) => c === code)?.[0]}: ${results.length} renders, ${bad.length} failing (${path.relative(process.cwd(), OUT)}/summary.md)`);
  process.exit(code);
}

await main();
