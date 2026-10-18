// Kitchen study run: screenshots at 390 and 1280 px, light and dark, plus the measurable part of the
// anti-slop Delivery Gate (gate.mjs) for every shot.
//   bun docs/kitchen/study/shoot.mjs live <outDir> <baseURL> <name=/route,...>
//   bun docs/kitchen/study/shoot.mjs gallery <outDir> <galleryDir> <view,view,...>
// Live shots run against the local dev server (placeholder Convex URL + the dev-only E2E bypass):
// no keys, no preview URL. Gallery shots are the real components with fictional sample data and
// stand-in Convex hooks, so their file names say MOCKED. Writes <outDir>/gate.json.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { runGate } from "./gate.mjs";

const [mode, outDir, source, list] = process.argv.slice(2);
if (!["live", "gallery"].includes(mode) || !outDir || !source || !list) {
  console.error("usage: shoot.mjs live|gallery <outDir> <baseURL|galleryDir> <items>");
  process.exit(2);
}
const langs = (process.env.LANGS ?? "en").split(",");
let server;
let base = source;
if (mode === "gallery") {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const p = new URL(req.url).pathname;
      const file = Bun.file(path.join(source, p === "/" ? "index.html" : p));
      return (await file.exists()) ? new Response(file) : new Response("", { status: 404 });
    },
  });
  base = `http://localhost:${server.port}`;
}
const items = list.split(",").map((entry) => {
  const [name, route] = entry.split("=");
  return { name, route: route ?? name };
});
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = [];
for (const { name, route } of items) {
  for (const lang of langs) {
    for (const width of [390, 1280]) {
      for (const theme of ["light", "dark"]) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme, locale: lang === "he" ? "he-IL" : "en-US" });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        const url =
          mode === "gallery"
            ? `${base}/?view=${encodeURIComponent(route)}&theme=${theme}&lang=${lang}`
            : `${base}${route}${route.includes("?") ? "&" : "?"}theme=${theme}${lang === "he" ? "&lang=he" : ""}`;
        let status = "ok";
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        } catch (e) {
          status = `load: ${String(e.message).split("\n")[0]}`;
        }
        await page.waitForTimeout(mode === "gallery" ? 600 : 1500);
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        const suffix = `${lang === "en" ? "" : `-${lang}`}-${width}-${theme}.jpg`;
        const file = mode === "gallery" ? `gallery-MOCKED-${name}${suffix}` : `${name}${suffix}`;
        await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 80, fullPage: true });
        const gate = await runGate(page).catch((e) => [{ id: "gate", rule: "gate ran", pass: null, detail: String(e).slice(0, 120) }]);
        const failed = gate.filter((g) => g.pass === false).map((g) => g.id);
        results.push({ name, lang, width, theme, file, finalPath: new URL(page.url()).pathname, status, errors, gate });
        console.log(`${name}\t${lang}\t${width}\t${theme}\t${status}\tgate=${failed.length ? `FAIL ${failed.join(",")}` : "PASS"}${errors.length ? `\terrors=${errors.join(" | ")}` : ""}`);
        await ctx.close();
      }
    }
  }
}
await browser.close();
server?.stop();
await writeFile(path.join(outDir, `gate-${mode}.json`), `${JSON.stringify(results, null, 2)}\n`);
