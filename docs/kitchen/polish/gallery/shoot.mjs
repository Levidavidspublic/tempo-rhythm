// Screenshots of the gallery views at 390 and 1280 px, light and dark (full page).
//   bun docs/kitchen/polish/gallery/shoot.mjs <galleryDir> <outDir> [view,view…]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const [dir, outDir, only] = process.argv.slice(2);
const VIEWS = (only ?? "coach,coach-empty,today,today-braindump,notes,notes-read,notes-missing,tasks-checklists,tasks-priority,approval,sign-in-error,sign-in-sent,screen-error").split(",");
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const file = Bun.file(path.join(dir, new URL(req.url).pathname === "/" ? "index.html" : new URL(req.url).pathname));
    return (await file.exists()) ? new Response(file) : new Response("", { status: 404 });
  },
});
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const view of VIEWS) {
  for (const width of [390, 1280]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.goto(`http://localhost:${server.port}/?view=${view}&theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = `gallery-${view}-${width}-${theme}.jpg`;
      await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 80, fullPage: true });
      // A thread scrolls inside its own box: also show its first messages.
      if (view === "coach" && (await page.locator(".tp-coach-thread").count())) {
        await page.locator(".tp-coach-thread").evaluate((el) => { el.scrollTop = 0; });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(outDir, `gallery-coach-top-${width}-${theme}.jpg`), type: "jpeg", quality: 80, fullPage: true });
      }
      console.log(`${view}\t${width}\t${theme}\toverflowX=${overflow}${errors.length ? `\terrors=${errors.join(" | ")}` : ""}`);
      await page.close();
    }
  }
}
await browser.close();
server.stop();
