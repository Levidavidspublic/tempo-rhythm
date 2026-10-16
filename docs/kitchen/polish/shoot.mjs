// Kitchen polish pass: screenshots of every main screen at 390 and 1280 px, light and dark.
// Run from the repo root against the local dev server (mock Convex URL + the dev-only E2E bypass):
//   bun docs/kitchen/polish/shoot.mjs <before|after> [baseURL]
// No keys, no preview URL. Screens that need a signed-in Convex session show their loading or
// signed-out state here; that is recorded per screen in docs/kitchen/RUN-LOG.md.
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "after";
const base = process.argv[3] ?? "http://localhost:3000";
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const SCREENS = [
  ["today", "/today"],
  ["coach", "/coach"],
  ["brain-dump", "/brain-dump"],
  ["notes", "/notes"],
  ["calendar", "/calendar"],
  ["tasks", "/tasks"],
  ["plan", "/plan"],
  ["settings-profile", "/settings/profile"],
  ["settings-preferences", "/settings/preferences"],
  ["onboarding", "/onboarding"],
  ["sign-in", "/sign-in"],
];
const WIDTHS = [390, 1280];
const THEMES = ["light", "dark"];

const out = new URL(`./${label}/`, import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const report = [];
for (const [name, path] of SCREENS) {
  if (only && !only.includes(name)) continue;
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
        deviceScaleFactor: 1,
        locale: "en-US",
      });
      const page = await ctx.newPage();
      const url = `${base}${path}${path.includes("?") ? "&" : "?"}theme=${theme}`;
      let status = "ok";
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
      } catch (e) {
        status = `load: ${String(e.message).split("\n")[0]}`;
      }
      await page.waitForTimeout(1500);
      // The Next.js dev overlay badge is not part of the app; keep it out of the evidence.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => -1);
      const finalPath = new URL(page.url()).pathname;
      const file = `${name}-${width}-${theme}.jpg`;
      await page.screenshot({ path: `${out}${file}`, type: "jpeg", quality: 80, fullPage: false });
      report.push({ name, width, theme, finalPath, overflow, status, file });
      await ctx.close();
    }
  }
}
await browser.close();
for (const r of report) console.log(`${r.name}\t${r.width}\t${r.theme}\t${r.finalPath}\toverflowX=${r.overflow}\t${r.status}`);
