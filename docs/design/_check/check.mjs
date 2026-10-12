#!/usr/bin/env node
// Tempo design check. Renders every design screen in Chromium and reports mechanical problems.
//
//   node check.mjs --design ../tempo-v3 --out ./out [--sheets ../tempo-v3/screenshots]
//                  [--shots-label "C:\\...\\screens-check"] [--only today] [--concurrency 4] [--strict]
//
// For every page in config.json "pages", at every width x theme x dir:
//   overflow       document scrollWidth > viewport width (plus the first elements sticking out)
//   console        console errors and uncaught page errors
//   fonts          failed font requests and FontFaces with status "error"
//   resources      other failed requests (404s, blocked files)
//   overlap        an interactive element whose centre (elementFromPoint) lands on another interactive element
//   covered        an interactive element whose centre is covered by something non-interactive (warning)
//   forbidden      forbidden words visible on screen (config.json "forbidden")
//   axe            axe-core rules in config.json "axeRules" (contrast, labels, alt text)
//   links          relative links that point at a file that does not exist (checked once per page)
//   rtl            heuristic: the side nav sits on the same side in LTR and RTL
// Writes: <out>/<group>/<page>__<width>-<theme>-<dir>.png, <out>/results.json, <out>/summary.md,
//         and one contact sheet per group per config.json "contactSheets" entry into --sheets.
// Never edits the design. Reads only the --design folder.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- args + config
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const CONFIG = JSON.parse(fs.readFileSync(arg("config", path.join(HERE, "config.json")), "utf8"));
const DESIGN = path.resolve(arg("design", path.join(HERE, "..", "tempo-v3")));
const OUT = path.resolve(arg("out", path.join(HERE, "out")));
const SHEETS = arg("no-sheets", false) ? null : path.resolve(arg("sheets", path.join(DESIGN, "screenshots")));
const SHOTS_LABEL = String(arg("shots-label", OUT)).replace(/[\\/]+$/, "");
const ONLY = arg("only", null);
const CONCURRENCY = Number(arg("concurrency", 4));
const STRICT = !!arg("strict", false);
const SEP = SHOTS_LABEL.includes("\\") ? "\\" : "/";

if (!fs.existsSync(DESIGN)) { console.error(`Design folder not found: ${DESIGN}`); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
if (SHEETS) fs.mkdirSync(SHEETS, { recursive: true });

// ---------------------------------------------------------------- find pages
const globRe = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000")
  .replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, "(?:.*/)?") + "$");
function walk(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue; // .file-versions, .od-*, .remember
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r));
    else out.push(r);
  }
  return out;
}
const ALL_FILES = walk(DESIGN);
const pageRes = CONFIG.pages.map(globRe);
let PAGES = ALL_FILES.filter((f) => f.endsWith(".html") && pageRes.some((re) => re.test(f))).sort();
if (ONLY) PAGES = PAGES.filter((f) => f.includes(ONLY));
if (!PAGES.length) { console.error(`No pages matched ${CONFIG.pages.join(", ")} under ${DESIGN}`); process.exit(2); }

// ---------------------------------------------------------------- static server (/d = design, /o = out)
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const m = u.pathname.match(/^\/(d|o)\/(.*)$/);
  const rootDir = m && (m[1] === "d" ? DESIGN : OUT);
  let file = rootDir && path.resolve(rootDir, decodeURIComponent(m[2]));
  if (!file || !file.startsWith(rootDir)) { res.writeHead(404).end("outside the design folder"); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------- helpers
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const slugOf = (f) => path.basename(f, ".html");
function fallbackGroup(f) {
  const slug = slugOf(f);
  for (const g of CONFIG.groupsFallback || []) if (new RegExp(g.match).test(slug)) return g.group;
  const parts = f.split("/");
  if (parts[0] === "screens" && parts.length > 2) return parts[1];
  if (!f.startsWith("screens/")) return "board";
  return slug.split("-")[0] || "misc";
}
const variantsFor = () => {
  const v = [];
  for (const width of CONFIG.widths) for (const theme of CONFIG.themes) for (const dir of CONFIG.dirs) v.push({ width, theme, dir });
  return v;
};
const vkey = (v) => `${v.width}-${v.theme}-${v.dir}`;
const shotRel = (group, f, v) => `${group}/${f.replace(/\.html$/, "").replace(/\//g, "__")}__${vkey(v)}.png`;
const LABEL_RULES = new Set(["label", "button-name", "link-name", "image-alt", "input-image-alt", "input-button-name", "select-name",
  "aria-input-field-name", "aria-toggle-field-name", "svg-img-alt", "role-img-alt"]);

// In-page probes (run inside the browser) ------------------------------------------------
function probeDesc(el) {
  const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls}${t ? ` "${t}"` : ""}`;
}
async function probeAll(page, cfg) {
  return page.evaluate(async ({ cfg, descSrc }) => {
    const desc = new Function(`return (${descSrc})`)();
    const root = document.documentElement;
    // overflow
    const vw = root.clientWidth || innerWidth;
    const sw = Math.max(root.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const offenders = [];
    if (sw > vw + 1) {
      const unclipped = (el) => { let p = el.parentElement; while (p && p !== document.body) { if (getComputedStyle(p).overflowX !== "visible") return false; p = p.parentElement; } return true; };
      // 1. boxes that sit outside the viewport
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || (r.right <= vw + 1 && r.left >= -1)) continue;
        if (unclipped(el)) { offenders.push(`${desc(el)} (x ${Math.round(r.left)}..${Math.round(r.right)})`); if (offenders.length >= 5) break; }
      }
      // 2. deepest elements whose content (text, ::before/::after) spills out of them
      if (!offenders.length) {
        const spill = [...document.body.querySelectorAll("*")].filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "visible" && unclipped(el));
        const leaves = spill.filter((el) => !spill.some((o) => o !== el && el.contains(o)));
        for (const el of leaves.slice(0, 5)) {
          const pseudo = ["::before", "::after"].map((ps) => { const c = getComputedStyle(el, ps); return c.content !== "none" && c.position === "absolute" && (parseFloat(c.left) < 0 || parseFloat(c.right) < 0) ? `${ps} left ${c.left} right ${c.right}` : ""; }).filter(Boolean);
          offenders.push(`${desc(el)} content ${el.scrollWidth}px > box ${el.clientWidth}px${pseudo.length ? ` (${pseudo.join(", ")})` : ""}`);
        }
      }
    }
    // fonts
    await document.fonts.ready;
    const badFonts = [...document.fonts].filter((f) => f.status === "error").map((f) => `${f.family} ${f.weight} ${f.style}`);
    // forbidden words (visible text + placeholders + input values)
    const texts = [document.body ? document.body.innerText : ""];
    document.querySelectorAll("input, textarea").forEach((i) => {
      if (i.type === "hidden") return;
      if (i.placeholder) texts.push(i.placeholder);
      if (i.value && !["checkbox", "radio", "range", "color"].includes(i.type)) texts.push(i.value);
    });
    const all = texts.join("\n");
    const forbidden = [];
    for (const f of cfg.forbidden) {
      let n = 0;
      for (const m of all.matchAll(new RegExp(f.pattern, (f.flags || "") + "g"))) {
        forbidden.push({ label: f.label, match: m[0], context: all.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, " ").trim() });
        if (++n >= 5) break;
      }
    }
    // overlap: centre of each visible interactive element, via elementFromPoint
    const sel = cfg.interactiveSelector;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || parseFloat(s.opacity) === 0 || s.pointerEvents === "none") return false;
      if (el.closest("[hidden], [aria-hidden='true'], [inert], dialog:not([open])")) return false;
      const det = el.closest("details:not([open])");
      if (det && !(el.tagName === "SUMMARY" && el.parentElement === det)) return false;
      return true;
    };
    const overlaps = [], covered = [], seen = new Set();
    const x0 = scrollX, y0 = scrollY;
    const scrolled = [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth).map((e) => [e, e.scrollTop, e.scrollLeft]);
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el)) continue;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
      const other = hit.closest(sel);
      if (other && other !== el && !other.contains(el) && !el.contains(other)) {
        const k = desc(el) + "|" + desc(other);
        if (!seen.has(k) && overlaps.length < 20) { seen.add(k); overlaps.push({ el: desc(el), by: desc(other) }); }
      } else if (covered.length < 20) covered.push({ el: desc(el), by: desc(hit) });
    }
    for (const [e, t, l] of scrolled) { e.scrollTop = t; e.scrollLeft = l; }
    scrollTo(x0, y0);
    // nav position (for the RTL mirror heuristic)
    let nav = null;
    for (const el of document.querySelectorAll(cfg.navSelector)) {
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20 || r.width > vw * 0.6 || !vis(el)) continue;
      nav = { el: desc(el), centre: (r.left + r.width / 2) / vw };
      break;
    }
    // links (absolute after the page's own scripts rewrote them)
    const links = [...document.querySelectorAll("a[href]")].map((a) => ({ raw: a.getAttribute("href"), abs: a.href, text: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40) }));
    // group from the design's own registry if present (tempo.js exposes window.Tempo.screens)
    let group = null;
    try {
      const slug = location.pathname.split("/").pop().replace(/\.html$/, "");
      const s = window.Tempo && Array.isArray(window.Tempo.screens) && window.Tempo.screens.find((x) => x.slug === slug);
      if (s && s.group) group = s.group;
    } catch (e) { /* ignore */ }
    return { overflow: { overflow: sw > vw + 1, sw, vw, offenders }, badFonts, forbidden, overlaps, covered, nav, links, group,
      dirNow: root.dir || getComputedStyle(document.body).direction, themeNow: root.dataset.theme || "" };
  }, { cfg, descSrc: probeDesc.toString() });
}

// ---------------------------------------------------------------- one render
async function runOne(browser, file, v) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: CONFIG.heights[String(v.width)] || 900 },
    deviceScaleFactor: 1,
    colorScheme: v.theme === "dark" ? "dark" : "light",
    locale: v.dir === "rtl" ? "he-IL" : "en-US",
  });
  const page = await ctx.newPage();
  const rec = { file, ...v, toggle: "url", console: [], fonts: [], resources: [] };
  const isFont = (req) => req.resourceType() === "font" || /fonts\.(googleapis|gstatic)\.com/.test(req.url());
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const at = m.location()?.url || "";
    if (/\/favicon\.ico$/.test(at)) return; // browsers ask for it; the design doesn't ship one
    rec.console.push(`${m.text().slice(0, 300)}${at && !m.text().includes(at) ? ` [${at.replace(ORIGIN + "/d/", "")}]` : ""}`);
  });
  page.on("pageerror", (e) => rec.console.push(`pageerror: ${String(e.message || e).slice(0, 300)}`));
  page.on("requestfailed", (r) => (isFont(r) ? rec.fonts : rec.resources).push(`${r.url()} (${r.failure()?.errorText || "failed"})`));
  page.on("response", (r) => { if (r.status() >= 400) (isFont(r.request()) ? rec.fonts : rec.resources).push(`${r.url()} (HTTP ${r.status()})`); });
  const q = [CONFIG.query[v.theme], CONFIG.query[v.dir]].filter(Boolean).join("&");
  const url = `${ORIGIN}/d/${file.split("/").map(encodeURIComponent).join("/")}${q ? "?" + q : ""}`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: CONFIG.timeoutMs });
  } catch (e) {
    rec.console.push(`navigation: ${String(e.message).split("\n")[0]}`);
  }
  // If the page ignored the URL switches, set the theme / direction on <html> ourselves.
  const forced = await page.evaluate(({ theme, dir, f }) => {
    const r = document.documentElement; const did = [];
    const themeOk = (r.getAttribute(f.themeAttr) || "") === theme || (theme === "dark" ? r.classList.contains(f.darkClass) : !r.classList.contains(f.darkClass) && !r.getAttribute(f.themeAttr));
    if (!themeOk) { r.setAttribute(f.themeAttr, theme); r.classList.toggle(f.darkClass, theme === "dark"); did.push("theme"); }
    if ((r.dir || getComputedStyle(document.body).direction) !== dir) { r.dir = dir; did.push("dir"); }
    return did;
  }, { theme: v.theme, dir: v.dir, f: CONFIG.force }).catch(() => []);
  if (forced.length) rec.toggle = `forced(${forced.join("+")})`;
  await page.waitForTimeout(CONFIG.settleMs);
  const group0 = await page.evaluate(() => { try { const slug = location.pathname.split("/").pop().replace(/\.html$/, ""); const s = window.Tempo && Array.isArray(window.Tempo.screens) && window.Tempo.screens.find((x) => x.slug === slug); return (s && s.group) || null; } catch (e) { return null; } }).catch(() => null);
  rec.shot = shotRel(group0 || fallbackGroup(file), file, v);
  fs.mkdirSync(path.dirname(path.join(OUT, rec.shot)), { recursive: true });
  await page.screenshot({ path: path.join(OUT, rec.shot), fullPage: true }).catch((e) => rec.console.push(`screenshot: ${e.message}`));
  const p = await probeAll(page, CONFIG).catch((e) => ({ error: String(e.message || e) }));
  if (p.error) rec.console.push(`probe: ${p.error}`);
  Object.assign(rec, { overflow: p.overflow || null, forbidden: p.forbidden || [], overlaps: p.overlaps || [], covered: p.covered || [],
    nav: p.nav || null, links: p.links || [], group: p.group || fallbackGroup(file) });
  if (p.badFonts) rec.fonts.push(...p.badFonts.map((f) => `FontFace error: ${f}`));
  // axe
  try {
    await page.addScriptTag({ content: AXE });
    rec.axe = await page.evaluate((rules) => window.axe.run(document, { runOnly: { type: "rule", values: rules }, resultTypes: ["violations"] })
      .then((r) => r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length,
        targets: x.nodes.slice(0, 5).map((n) => n.target.join(" ")), summary: (x.nodes[0]?.failureSummary || "").replace(/\s+/g, " ").slice(0, 240) }))), CONFIG.axeRules);
  } catch (e) { rec.axe = []; rec.console.push(`axe: ${String(e.message || e).slice(0, 200)}`); }
  await ctx.close();
  rec.console = [...new Set(rec.console)]; rec.fonts = [...new Set(rec.fonts)]; rec.resources = [...new Set(rec.resources)];
  return rec;
}

// ---------------------------------------------------------------- run all
const browser = await chromium.launch(process.env.DESIGN_CHECK_CHROMIUM ? { executablePath: process.env.DESIGN_CHECK_CHROMIUM } : {});
const jobs = [];
for (const f of PAGES) for (const v of variantsFor()) jobs.push({ f, v });
const results = [];
let done = 0;
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
  while (jobs.length) {
    const { f, v } = jobs.shift();
    results.push(await runOne(browser, f, v));
    if (++done % 20 === 0 || done === PAGES.length * variantsFor().length) console.log(`  rendered ${done}/${PAGES.length * variantsFor().length}`);
  }
}));

// groups: one group per page, taken from the first render that knew it
const groupOf = {};
for (const r of results) if (!groupOf[r.file] || groupOf[r.file] === fallbackGroup(r.file)) groupOf[r.file] = r.group;

// links: check once per page (1280 light ltr if present)
const linkIssues = {};
for (const f of PAGES) {
  const r = results.find((x) => x.file === f && x.width === CONFIG.widths.at(-1) && x.theme === "light" && x.dir === "ltr") || results.find((x) => x.file === f);
  const bad = [];
  for (const l of r.links || []) {
    if (!l.raw || /^(#|mailto:|tel:|javascript:|data:)/i.test(l.raw)) continue;
    if (/^file:|^[a-z]:\\/i.test(l.raw)) { bad.push(`${l.raw} (local file path)`); continue; }
    let u; try { u = new URL(l.abs); } catch { bad.push(`${l.raw} (invalid)`); continue; }
    if (u.origin !== ORIGIN) continue; // external
    if (!u.pathname.startsWith("/d/")) { bad.push(`${l.raw} (outside the design folder)`); continue; }
    const target = path.join(DESIGN, decodeURIComponent(u.pathname.slice(3)));
    if (!fs.existsSync(target)) bad.push(`${l.raw}${l.text ? ` "${l.text}"` : ""} -> missing ${path.relative(DESIGN, target).replace(/\\/g, "/")}`);
  }
  linkIssues[f] = [...new Set(bad)];
}

// RTL mirror heuristic: nav on the same side in LTR and RTL
const rtlIssues = [];
for (const r of results.filter((x) => x.dir === "rtl")) {
  const l = results.find((x) => x.file === r.file && x.width === r.width && x.theme === r.theme && x.dir === "ltr");
  if (!l || !l.nav || !r.nav) continue;
  const side = (c) => (c < 0.4 ? "left" : c > 0.6 ? "right" : "centre");
  if (side(l.nav.centre) !== "centre" && side(l.nav.centre) === side(r.nav.centre))
    rtlIssues.push({ file: r.file, variant: vkey(r), detail: `${r.nav.el} stays on the ${side(r.nav.centre)} in RTL`, shot: r.shot });
}

await browser.close();

// ---------------------------------------------------------------- classify + write results
const label = (shot) => `${SHOTS_LABEL}${SEP}${shot.replace(/\//g, SEP)}`;
const mech = [], design = [];
for (const r of results) {
  const where = { file: r.file, variant: vkey(r), shot: label(r.shot) };
  if (r.overflow?.overflow) mech.push({ ...where, kind: "overflow", detail: `scrollWidth ${r.overflow.sw} > ${r.overflow.vw}. ${r.overflow.offenders.join("; ")}` });
  for (const f of r.forbidden) mech.push({ ...where, kind: "forbidden word", detail: `${f.label}: "...${f.context}..."` });
  for (const a of r.axe || []) {
    if (LABEL_RULES.has(a.id)) mech.push({ ...where, kind: `axe ${a.id}`, detail: `${a.nodes} node(s): ${a.targets.join(", ")}` });
    else design.push({ ...where, kind: `axe ${a.id}`, detail: `${a.nodes} node(s): ${a.targets.join(", ")}. ${a.summary}` });
  }
  for (const o of r.overlaps) design.push({ ...where, kind: "overlap", detail: `${o.el} is under ${o.by}` });
  for (const c of r.console) design.push({ ...where, kind: "console error", detail: c });
  for (const f of r.fonts) design.push({ ...where, kind: "font", detail: f });
  for (const x of r.resources) design.push({ ...where, kind: "resource", detail: x });
}
for (const [f, bad] of Object.entries(linkIssues)) for (const b of bad) mech.push({ file: f, variant: "all", shot: "", kind: "broken link", detail: b });
for (const x of rtlIssues) mech.push({ file: x.file, variant: x.variant, shot: label(x.shot), kind: "rtl mirror (heuristic)", detail: x.detail });

// per-page table
const nV = variantsFor().length;
const cell = (n, of = nV) => (n ? `${n}/${of}` : "✓");
const rows = PAGES.map((f) => {
  const rs = results.filter((r) => r.file === f);
  const c = (fn) => rs.filter(fn).length;
  return {
    file: f, group: groupOf[f],
    overflow: c((r) => r.overflow?.overflow), console: c((r) => r.console.length), fonts: c((r) => r.fonts.length),
    overlap: c((r) => r.overlaps.length), forbidden: c((r) => r.forbidden.length),
    contrast: c((r) => (r.axe || []).some((a) => a.id === "color-contrast")),
    labels: c((r) => (r.axe || []).some((a) => LABEL_RULES.has(a.id))),
    links: linkIssues[f].length, rtl: rtlIssues.filter((x) => x.file === f).length,
    forced: c((r) => r.toggle !== "url"),
  };
});
const tot = (k) => rows.reduce((s, r) => s + (r[k] ? 1 : 0), 0);
const md = [];
md.push(`Checked ${PAGES.length} page(s) x ${nV} variants (${CONFIG.widths.join("/")} px, ${CONFIG.themes.join("/")}, ${CONFIG.dirs.join("/")}) = ${results.length} renders.`);
md.push(`Cells show failing variants out of ${nV}; ✓ = clean. Links = broken links on the page.`, "");
md.push("| Page | Group | Overflow | Console | Fonts | Overlap | Forbidden words | Contrast | Labels/alt | Links | RTL |");
md.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) md.push(`| ${r.file} | ${r.group} | ${cell(r.overflow)} | ${cell(r.console)} | ${cell(r.fonts)} | ${cell(r.overlap)} | ${cell(r.forbidden)} | ${cell(r.contrast)} | ${cell(r.labels)} | ${r.links ? r.links : "✓"} | ${cell(r.rtl, nV / 2)} |`);
md.push(`| **Pages with issues** | | ${tot("overflow")} | ${tot("console")} | ${tot("fonts")} | ${tot("overlap")} | ${tot("forbidden")} | ${tot("contrast")} | ${tot("labels")} | ${tot("links")} | ${tot("rtl")} |`);
if (rows.some((r) => r.forced)) md.push("", `Note: ${rows.filter((r) => r.forced).length} page(s) ignored the ?theme / ?lang switches, so the checker set data-theme / dir on <html> itself.`);
const list = (items) => {
  const byKey = new Map();
  for (const i of items) {
    const k = `${i.file}\u0000${i.kind}\u0000${i.detail}`;
    if (!byKey.has(k)) byKey.set(k, { ...i, variants: [], shots: [] });
    const g = byKey.get(k); g.variants.push(i.variant); if (i.shot) g.shots.push(i.shot);
  }
  return [...byKey.values()].sort((a, b) => a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind))
    .map((g) => `- **${g.file}** · ${g.kind} · ${g.variants.length === nV ? "all variants" : g.variants.join(", ")}: ${g.detail}${g.shots.length ? `  \n  screenshot: \`${g.shots[0]}\`` : ""}`);
};
const mechL = list(mech), desL = list(design);
md.push("", `## Mechanical (${mechL.length} distinct, ${mech.length} incl. variants)`, "", ...(mechL.length ? mechL : ["None."]));
md.push("", `## Design-level or runtime (${desL.length} distinct, ${design.length} incl. variants)`, "", ...(desL.length ? desL : ["None."]));
fs.writeFileSync(path.join(OUT, "summary.md"), md.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ design: DESIGN, pages: PAGES, groups: groupOf, rows, mechanical: mech, designLevel: design, linkIssues, rtlIssues, results }, null, 2));

// ---------------------------------------------------------------- contact sheets
const sheetsWritten = [];
if (SHEETS) {
  const b2 = await chromium.launch(process.env.DESIGN_CHECK_CHROMIUM ? { executablePath: process.env.DESIGN_CHECK_CHROMIUM } : {});
  const groups = [...new Set(PAGES.map((f) => groupOf[f]))].sort();
  for (const g of groups) {
    for (const s of CONFIG.contactSheets) {
      const items = results.filter((r) => groupOf[r.file] === g && r.width === s.width && r.theme === s.theme && r.dir === s.dir)
        .sort((a, b) => a.file.localeCompare(b.file));
      if (!items.length) continue;
      const dark = s.theme === "dark";
      const gap = 16, pad = 24, w = pad * 2 + s.columns * s.thumbWidth + (s.columns - 1) * gap;
      const h = Math.round((s.thumbWidth * s.cropHeight) / s.width);
      const issues = (r) => (r.overflow?.overflow ? 1 : 0) + r.overlaps.length + r.forbidden.length + (r.axe || []).length + r.console.length;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:${pad}px;background:${dark ? "#141416" : "#f3f3f1"};color:${dark ? "#e8e8e6" : "#1d1d1b"};font:13px/1.35 system-ui,sans-serif}
        h1{font-size:17px;margin:0 0 ${gap}px;font-weight:600}
        .grid{display:grid;grid-template-columns:repeat(${s.columns},${s.thumbWidth}px);gap:${gap}px}
        figure{margin:0}.img{width:${s.thumbWidth}px;height:${h}px;overflow:hidden;border-radius:6px;border:1px solid ${dark ? "#33332f" : "#d6d6d1"};background:${dark ? "#000" : "#fff"}}
        img{width:100%;display:block}figcaption{margin-top:5px;display:flex;justify-content:space-between;gap:6px;font-size:12px}
        .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bad{color:${dark ? "#ff8a80" : "#b3261e"}}.ok{color:${dark ? "#8fd694" : "#2e7d32"}}
        </style></head><body><h1>Tempo v3 · ${g} · ${s.width} px · ${s.theme} · ${s.dir.toUpperCase()}</h1><div class="grid">${items.map((r) => {
          const n = issues(r);
          return `<figure><div class="img"><img src="${ORIGIN}/o/${r.shot.split("/").map(encodeURIComponent).join("/")}"></div><figcaption><span class="n">${slugOf(r.file)}</span><span class="${n ? "bad" : "ok"}">${n ? n + " issue" + (n > 1 ? "s" : "") : "clean"}</span></figcaption></figure>`;
        }).join("")}</div></body></html>`;
      const htmlPath = path.join(OUT, "_sheets", `${g}--${s.width}-${s.theme}.html`);
      fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
      fs.writeFileSync(htmlPath, html);
      const p = await b2.newPage({ viewport: { width: w, height: 600 }, deviceScaleFactor: 1 });
      await p.goto(`${ORIGIN}/o/_sheets/${encodeURIComponent(path.basename(htmlPath))}`, { waitUntil: "load" });
      await p.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
      const outFile = path.join(SHEETS, `${g}--${s.width}-${s.theme}.jpg`);
      await p.screenshot({ path: outFile, fullPage: true, type: "jpeg", quality: 72 });
      await p.close();
      sheetsWritten.push(outFile);
    }
  }
  await b2.close();
}
server.close();

console.log(`\n${PAGES.length} page(s), ${results.length} renders. Mechanical: ${mechL.length} distinct. Design-level/runtime: ${desL.length} distinct. Contact sheets: ${sheetsWritten.length}.`);
console.log(`Summary: ${path.join(OUT, "summary.md")}`);
process.exit(STRICT && mech.length ? 1 : 0);
