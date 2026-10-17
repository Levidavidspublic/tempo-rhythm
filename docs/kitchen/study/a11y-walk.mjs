// Kitchen study run: a full keyboard walk and a reduced-motion pass over every gallery view.
//   bun docs/kitchen/study/a11y-walk.mjs <galleryDir> [view,view,...]
// The gallery is built by gallery/build.ts (real components, fictional data, stand-in Convex hooks).
// Every view in entry.tsx (or the listed ones) is opened at 390 and 1280 px, in English and Hebrew
// ("-he" views in Hebrew only), light theme (THEME=dark for the dark one):
//   a. Keyboard walk: Tab until focus comes back round (or 200 presses), and flag
//      (i)   unreached: a visible, enabled control Tab never reaches. A radio group's unchecked radios
//            and the rest of a roving-tabindex group count as reached when the group has a Tab stop
//            and an arrow key from it is seen to move within the group; controls outside an open
//            modal and inside closed panels don't count;
//      (ii)  no indicator: outline, box-shadow and border are the same focused and blurred, on the
//            stop, its two parents and its siblings (the blurred styles are read once Tab has moved on),
//            or the stop's own outline is the only sign and the boxes around it clip off over half;
//      (iii) hidden focus: the stop (or the label it stands for) is not visible, is clipped or off
//            screen after the browser scrolled it, shows less than 90% of itself although it would
//            fit (text fields aside: there the browser shows the caret), or is entirely covered;
//      (iv)  trap: focus stays on one element for 3 presses (date, time and media fields, which
//            have parts inside, get 10), or loops without coming back, outside an aria-modal dialog.
//   b. Reduced motion: a context with reducedMotion "reduce", the view's scripted steps (the gallery
//      runs them), then every element or ::before / ::after whose transition or animation still
//      lasts over 10 ms, any script animation still running, and any smooth scroll asked for.
// Writes docs/kitchen/study/a11y-walk.json (OUT= overrides) and prints a summary. WORKERS=4 by default.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const here = import.meta.dir;
const [galleryDir, list] = process.argv.slice(2);
if (!galleryDir) {
  console.error("usage: a11y-walk.mjs <galleryDir> [view,view,...]");
  process.exit(2);
}
const theme = process.env.THEME === "dark" ? "dark" : "light";
const outFile = process.env.OUT ?? path.join(here, theme === "dark" ? "a11y-walk-dark.json" : "a11y-walk.json");
const workers = Number(process.env.WORKERS ?? 4);
const WIDTHS = [390, 1280];
const MAX_PRESSES = 200;
const SETTLE_MS = 1500; // the longest scripted steps finish 1150 ms after mount

/** The view names, read from the VIEWS map in entry.tsx. */
async function galleryViews() {
  const src = await readFile(path.join(here, "gallery/entry.tsx"), "utf8");
  const block = src.slice(src.indexOf("const VIEWS"), src.indexOf("const root ="));
  return [...block.matchAll(/^ {2}"?([a-z0-9-]+)"?: \(\) =>/gm)].map((m) => m[1]);
}

/** Runs in the page: helpers the walk calls on every press. Self-contained (Playwright serialises it). */
function install() {
  if (window.__a11y) return;
  const ids = new WeakMap();
  const byId = new Map();
  let next = 1;
  const key = (el) => {
    if (!ids.has(el)) {
      ids.set(el, next);
      byId.set(next, el);
      next++;
    }
    return ids.get(el);
  };
  const short = (s, n = 32) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("");
    const attrs = ["data-action", "data-component", "role", "type", "name"]
      .map((a) => (el.getAttribute(a) ? `[${a}=${el.getAttribute(a)}]` : ""))
      .join("");
    const name = short(el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || el.getAttribute("title") || el.value);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}${attrs}${name ? ` "${name}"` : ""}`;
  };
  const alpha = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c ?? "");
    if (!m) return c === "transparent" ? 0 : 1;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  };
  const ringNodes = (el) => [el, el.parentElement, el.parentElement?.parentElement, el.previousElementSibling, el.nextElementSibling].filter(Boolean);
  const ringProps = (n) => {
    const cs = getComputedStyle(n);
    const sides = ["Top", "Right", "Bottom", "Left"];
    return {
      k: key(n),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      outlineOn: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && alpha(cs.outlineColor) > 0,
      shadow: cs.boxShadow,
      border: sides.map((s) => `${cs[`border${s}Style`]} ${cs[`border${s}Width`]} ${cs[`border${s}Color`]}`).join("|"),
    };
  };
  const snapshot = (el) => ringNodes(el).map(ringProps);

  const hiddenSelf = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 4) return "no size";
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") return "visibility hidden";
    if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(cs.clip) || /inset\(50%/.test(cs.clipPath)) return "clipped to nothing";
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (Number(getComputedStyle(n).opacity) === 0) return "opacity 0";
    }
    return null;
  };
  // A visually hidden input stands for its label (or the wrapper drawn around it).
  const proxyFor = (el) => {
    const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
    return label ?? el.parentElement;
  };
  const intersect = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const area = (x) => Math.max(0, x.r - x.l) * Math.max(0, x.b - x.t);
  /** Where the stop is after the browser scrolled to it: hidden, clipped / off screen, covered, or fine. */
  const placement = (el) => {
    let target = el;
    const self = hiddenSelf(el);
    if (self) {
      const proxy = proxyFor(el);
      if (!proxy || hiddenSelf(proxy)) return { problem: "not visible", detail: self };
      target = proxy;
    }
    const r = target.getBoundingClientRect();
    // The part of the screen the stop can show in: the viewport and every box that clips it.
    let room = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    for (let a = target; a && a !== document.documentElement; a = a.parentElement) {
      if (a !== target) {
        const cs = getComputedStyle(a);
        if (/hidden|auto|scroll|clip/.test(`${cs.overflowX} ${cs.overflowY}`)) {
          const ar = a.getBoundingClientRect();
          const inner = { l: ar.left + a.clientLeft, t: ar.top + a.clientTop, r: ar.left + a.clientLeft + a.clientWidth, b: ar.top + a.clientTop + a.clientHeight };
          room = intersect(room, inner);
        }
      }
      if (getComputedStyle(a).position === "fixed") break;
    }
    const box = intersect({ l: r.left, t: r.top, r: r.right, b: r.bottom }, room);
    if (area(box) < 1) return { problem: "off screen or clipped", detail: `rect ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` };
    // It would fit, yet the browser left part of it outside (a session cut by the week's edge).
    // Text fields are left out: there the browser brings the caret into view, not the whole box.
    const typing = el.matches("textarea, [contenteditable]:not([contenteditable='false']), input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=range], [type=color], [type=file])");
    const fits = !typing && r.width <= room.r - room.l + 0.5 && r.height <= room.b - room.t + 0.5;
    const shown = area(box) / (r.width * r.height);
    if (fits && shown < 0.9) return { problem: "partly out of view", detail: `${Math.round(shown * 100)}% shown` };
    if (getComputedStyle(target).pointerEvents === "none") return null;
    const w = box.r - box.l;
    const h = box.b - box.t;
    const points = [
      [box.l + w / 2, box.t + h / 2],
      [box.l + w * 0.15, box.t + h * 0.15],
      [box.r - w * 0.15, box.t + h * 0.15],
      [box.l + w * 0.15, box.b - h * 0.15],
      [box.r - w * 0.15, box.b - h * 0.15],
    ];
    const related = (hit) => !hit || hit === target || target.contains(hit) || hit.contains(target) || hit === el || el.contains(hit) || (hit.tagName === "LABEL" && hit.control === el);
    const covers = points.map(([x, y]) => document.elementFromPoint(x, y)).filter((hit) => !related(hit));
    if (covers.length === points.length) return { problem: "covered", detail: describe(covers[0]) };
    return null;
  };

  // Arrow-key groups: one Tab stop, arrows for the rest. A native radio group (same name), an ARIA
  // composite (radiogroup, tablist, menu, toolbar, listbox, grid), or siblings that set tabindex="-1"
  // next to one that is a stop (a roving tabindex, such as the month grid's days).
  const groupOf = (el) => {
    if (el.tagName === "INPUT" && el.type === "radio") return el.name ? `radio:${el.form ? key(el.form) : "doc"}:${el.name}` : null;
    const box = el.closest("[role=radiogroup], [role=tablist], [role=menu], [role=menubar], [role=toolbar], [role=listbox], [role=grid]");
    if (box && /^(radio|tab|menuitem|menuitemradio|menuitemcheckbox|option|gridcell)$/.test(el.getAttribute("role") ?? "")) return `roving:${key(box)}`;
    const parent = el.parentElement;
    if (parent && [...parent.children].some((c) => c !== el && c.tagName === el.tagName && c.getAttribute("tabindex") === "-1")) return `roving:${key(parent)}`;
    if (parent && el.getAttribute("tabindex") === "-1" && [...parent.children].some((c) => c !== el && c.tagName === el.tagName)) return `roving:${key(parent)}`;
    return null;
  };
  /** How much of the stop's own outline band survives the boxes that clip it (overflow). */
  const ringShown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === "none" || !(parseFloat(cs.outlineWidth) > 0)) return null;
    const r = el.getBoundingClientRect();
    const grow = (n) => ({ l: r.left - n, t: r.top - n, r: r.right + n, b: r.bottom + n });
    const off = parseFloat(cs.outlineOffset) || 0;
    const outer = grow(off + parseFloat(cs.outlineWidth));
    const inner = grow(off);
    let clip = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
    let by = null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (/hidden|auto|scroll|clip/.test(`${acs.overflowX} ${acs.overflowY}`)) {
        const ar = a.getBoundingClientRect();
        const box = { l: ar.left + a.clientLeft, t: ar.top + a.clientTop, r: ar.left + a.clientLeft + a.clientWidth, b: ar.top + a.clientTop + a.clientHeight };
        const next = intersect(clip, box);
        if (area(intersect(outer, next)) < area(intersect(outer, clip))) by ??= a;
        clip = next;
      }
      if (acs.position === "fixed") break;
    }
    const band = area(outer) - area(inner);
    const shown = area(intersect(outer, clip)) - area(intersect(inner, clip));
    return band > 0 ? { fraction: shown / band, by: by ? describe(by) : null } : null;
  };
  const modalOf = (el) => el.closest('[aria-modal="true"], dialog[open]');
  const subParts = (el) => (el.tagName === "INPUT" && /^(date|time|datetime-local|month|week)$/.test(el.type)) || /^(AUDIO|VIDEO|IFRAME)$/.test(el.tagName) || !!el.shadowRoot;

  window.__a11y = {
    key,
    describe,
    /** One press: the stop now focused, and the previous stop's styles now that it is blurred. */
    atFocus(prevKey) {
      const prevEl = prevKey ? byId.get(prevKey) : null;
      const blurred = prevEl?.isConnected && prevEl !== document.activeElement ? snapshot(prevEl) : null;
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return { body: true, blurred };
      return {
        body: false,
        blurred,
        key: key(el),
        desc: describe(el),
        tag: el.tagName,
        iframe: el.tagName === "IFRAME",
        inModal: !!modalOf(el),
        subParts: subParts(el),
        focused: snapshot(el),
        ring: ringShown(el),
        place: placement(el),
      };
    },
    /** Styles of a stop by key, blurred, when the walk ends on it. */
    snapshotKey(k) {
      const el = byId.get(k);
      return el?.isConnected && el !== document.activeElement ? snapshot(el) : null;
    },
    /** The visible, enabled controls on screen now (key + description + group). */
    candidates() {
      const sel = 'button, a[href], input, select, textarea, [tabindex="0"], summary, [role=button], [role=switch], [role=radio], [role=checkbox], [role=menuitem], [role=tab]';
      const modal = [...document.querySelectorAll('[aria-modal="true"], dialog[open]')].find((m) => m.getBoundingClientRect().width > 0);
      return [...document.querySelectorAll(sel)]
        .filter((el) => {
          if (el.type === "hidden" || el.matches(":disabled")) return false;
          if (el.closest("[inert], [hidden]")) return false;
          if (modal && !modal.contains(el)) return false;
          const details = el.closest("details:not([open])");
          if (details && !(el.tagName === "SUMMARY" && el.parentElement === details)) return false;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
        })
        .map((el) => ({ key: key(el), desc: describe(el), group: groupOf(el) }));
    },
    connected(k) {
      return !!byId.get(k)?.isConnected;
    },
    focusKey(k) {
      byId.get(k)?.focus();
    },
    /** After an arrow key: is focus now on another member of the stop's group? */
    movedWithin(k, group) {
      const el = document.activeElement;
      return !!el && el !== byId.get(k) && groupOf(el) === group;
    },
  };
}

/**
 * Did the stop look different focused? Compares the same nodes focused and blurred. The stop's own
 * outline doesn't count when the boxes around it clip away more than half of it.
 */
function indicator(stop, blurred) {
  const clipped = stop.ring && stop.ring.fraction < 0.5;
  const [self] = stop.focused;
  if (!blurred) return (self.outlineOn && !clipped) || self.shadow !== "none" ? "absolute" : null;
  const before = new Map(blurred.map((n) => [n.k, n]));
  for (const [i, f] of stop.focused.entries()) {
    const b = before.get(f.k);
    if (!b) continue;
    if (f.outlineOn && f.outline !== b.outline && !(i === 0 && clipped)) return "outline";
    if (f.shadow !== "none" && f.shadow !== b.shadow) return "box-shadow";
    if (f.border !== b.border) return "border";
  }
  return null;
}

async function innerActive(page) {
  try {
    const handle = await page.evaluateHandle(() => document.activeElement);
    const frame = await handle.asElement()?.contentFrame();
    if (!frame) return null;
    return await frame.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""} "${(a.textContent ?? "").trim().slice(0, 20)}"`;
    });
  } catch {
    return "?";
  }
}

async function walk(page) {
  await page.evaluate(install);
  const before = await page.evaluate(() => window.__a11y.candidates());
  const start = await page.evaluate(() => (document.activeElement && document.activeElement !== document.body ? window.__a11y.describe(document.activeElement) : null));
  const stops = [];
  const seen = new Map();
  const found = { noIndicator: [], hidden: [], trap: [] };
  let prev = null;
  let same = 0;
  let end = "limit";
  let bodies = 0;
  const closeIndicator = (stop, blurred) => {
    if (!stop || stop.checked || stop.iframe) return;
    stop.checked = true;
    if (indicator(stop, blurred)) return;
    const clip = stop.ring && stop.ring.fraction < 0.5 ? `: outline ${Math.round(stop.ring.fraction * 100)}% shown, clipped by ${stop.ring.by}` : "";
    found.noIndicator.push(`${stop.desc}${clip}`);
  };
  for (let press = 0; press < MAX_PRESSES; press++) {
    await page.keyboard.press("Tab");
    const cur = await page.evaluate((k) => window.__a11y.atFocus(k), prev?.key ?? null);
    if (prev && !prev.checked && cur.blurred) closeIndicator(prev, cur.blurred);
    if (cur.body) {
      if (prev) closeIndicator(prev, null);
      // Focus left the page after the last stop. A walk that began on the page's own focus (a
      // sheet's first field, a heading) goes round once more to reach what comes before it.
      bodies++;
      if ((stops.length > 0 && (!start || bodies > 1)) || bodies > 2) {
        end = stops.length ? "wrapped" : "no stops";
        break;
      }
      prev = null;
      continue;
    }
    if (cur.iframe) cur.key = `${cur.key}>${(await innerActive(page)) ?? "frame"}`;
    if (prev && cur.key === prev.key) {
      same++;
      if (same >= (cur.subParts ? 10 : 3) && !cur.inModal) {
        found.trap.push(`${cur.desc}: ${same} presses without moving`);
        end = "trap";
        break;
      }
      continue;
    }
    same = 0;
    if (seen.has(cur.key)) {
      if (seen.get(cur.key) !== 0 && !cur.inModal) found.trap.push(`loops back to ${cur.desc} without returning to the first stop`);
      if (prev) closeIndicator(prev, cur.blurred);
      end = "cycle";
      break;
    }
    seen.set(cur.key, stops.length);
    if (prev) closeIndicator(prev, cur.blurred);
    if (cur.place) found.hidden.push(`${cur.desc}: ${cur.place.problem} (${cur.place.detail})`);
    stops.push(cur);
    prev = cur;
  }
  if (prev && !prev.checked) closeIndicator(prev, await page.evaluate((k) => window.__a11y.snapshotKey(k), prev.key));

  // (i) What Tab never reached, from the controls on screen before the walk. A group member counts
  // as reached when its group has a Tab stop and an arrow key from that stop moves within the group.
  const reached = new Set(stops.map((s) => String(s.key)));
  const unreached = [];
  const arrows = new Map();
  for (const c of before) {
    if (reached.has(String(c.key))) continue;
    if (!(await page.evaluate((k) => window.__a11y.connected(k), c.key))) continue; // gone during the walk: can't tell
    const stop = c.group ? before.find((m) => m.group === c.group && reached.has(String(m.key))) : null;
    if (stop) {
      if (!arrows.has(c.group)) {
        let moved = false;
        for (const key of ["ArrowDown", "ArrowRight"]) {
          await page.evaluate((k) => window.__a11y.focusKey(k), stop.key);
          await page.keyboard.press(key);
          // Some groups move focus on the next frame (Segmented): wait two frames before looking.
          await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          moved = await page.evaluate(([k, g]) => window.__a11y.movedWithin(k, g), [stop.key, c.group]);
          if (moved) break;
        }
        arrows.set(c.group, moved);
      }
      if (arrows.get(c.group)) continue;
    }
    unreached.push(`${c.desc}${stop ? " (arrow keys don't reach it either)" : ""}`);
  }
  const list = process.env.STOPS ? { list: stops.map((s) => `${s.desc}${s.ring && s.ring.fraction < 0.99 ? ` [ring ${Math.round(s.ring.fraction * 100)}%]` : ""}`) } : {};
  return { stops: stops.length, ...list, start, end, unreached, arrowGroups: arrows.size, ...found };
}

/** Runs in the page: motion that is still there under reduced motion. */
function stillMoving() {
  const ms = (list) => list.split(",").map((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000));
  const out = [];
  const describe = window.__a11y?.describe ?? ((el) => el.tagName.toLowerCase());
  for (const el of document.querySelectorAll("*")) {
    for (const pseudo of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === "none") continue;
      const props = cs.transitionProperty.split(",").map((p) => p.trim());
      const tMax = Math.max(...ms(cs.transitionDuration));
      if (props.some((p) => p !== "none") && tMax > 10) out.push(`${describe(el)}${pseudo ?? ""}: transition ${cs.transitionProperty} ${cs.transitionDuration}`);
      const names = cs.animationName.split(",").map((n) => n.trim());
      const aMax = Math.max(...ms(cs.animationDuration));
      if (names.some((n) => n !== "none") && aMax > 10) out.push(`${describe(el)}${pseudo ?? ""}: animation ${cs.animationName} ${cs.animationDuration}`);
    }
  }
  for (const a of document.getAnimations()) {
    if (a.constructor.name === "CSSAnimation" || a.constructor.name === "CSSTransition") continue;
    const d = Number(a.effect?.getTiming().duration);
    if (a.playState === "running" && d > 10) out.push(`${describe(a.effect?.target)}: script animation ${d} ms`);
  }
  out.push(...(window.__smooth ?? []));
  return [...new Set(out)];
}

/** Runs in the page before it loads (reduced-motion context only). */
function recordSmoothScrolls() {
  window.__smooth = [];
  for (const [target, names] of [
    [Element.prototype, ["scrollIntoView", "scrollTo", "scrollBy"]],
    [window, ["scrollTo", "scrollBy"]],
  ]) {
    for (const name of names) {
      const original = target[name];
      target[name] = function (...args) {
        if (args[0] && typeof args[0] === "object" && args[0].behavior === "smooth") {
          window.__smooth.push(`${this === window ? "window" : `${this.tagName.toLowerCase()}.${this.classList[0] ?? ""}`}: smooth ${name}`);
        }
        return original.apply(this, args);
      };
    }
  }
}

async function open(browser, base, job, reducedMotion) {
  const ctx = await browser.newContext({
    viewport: { width: job.width, height: job.width === 390 ? 844 : 900 },
    colorScheme: theme,
    locale: job.lang === "he" ? "he-IL" : "en-US",
    reducedMotion,
  });
  // Smooth scrolling asked for from script is motion the stylesheet can't see: note each call.
  if (reducedMotion === "reduce") await ctx.addInitScript(recordSmoothScrolls);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/?view=${encodeURIComponent(job.view)}&lang=${job.lang}&theme=${theme}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);
  return { ctx, page, errors };
}

async function run(browser, base, job) {
  const result = { stops: 0, end: "", unreached: [], noIndicator: [], hidden: [], trap: [], reducedMotion: [], errors: [] };
  try {
    const a = await open(browser, base, job, "no-preference");
    Object.assign(result, await walk(a.page));
    result.errors.push(...a.errors);
    await a.ctx.close();
    const b = await open(browser, base, job, "reduce");
    if (!(await b.page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))) throw new Error("reduced motion not emulated");
    await b.page.evaluate(install);
    result.reducedMotion = await b.page.evaluate(stillMoving);
    result.errors.push(...b.errors);
    await b.ctx.close();
  } catch (e) {
    result.errors.push(`walk: ${String(e.message ?? e).split("\n")[0]}`);
  }
  return result;
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const p = new URL(req.url).pathname;
    const file = Bun.file(path.join(galleryDir, p === "/" ? "index.html" : p));
    return (await file.exists()) ? new Response(file) : new Response("", { status: 404 });
  },
});
const base = `http://localhost:${server.port}`;
const views = list ? list.split(",") : await galleryViews();
const jobs = views.flatMap((view) =>
  (view.endsWith("-he") ? ["he"] : ["en", "he"]).flatMap((lang) => WIDTHS.map((width) => ({ view, lang, width }))),
);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const results = new Map();
let cursor = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const r = await run(browser, base, job);
      results.set(job, r);
      const flags = ["unreached", "noIndicator", "hidden", "trap", "reducedMotion"].filter((c) => r[c].length).map((c) => `${c}=${r[c].length}`);
      console.log(`${job.view}\t${job.width}\t${job.lang}\tstops=${r.stops}\tend=${r.end}\t${flags.join(" ") || "clean"}${r.errors.length ? `\terrors=${r.errors.join(" | ")}` : ""}`);
    }
  }),
);
await browser.close();
server.stop();

const CHECKS = ["unreached", "noIndicator", "hidden", "trap", "reducedMotion"];
const byView = {};
const summary = Object.fromEntries(CHECKS.map((c) => [c, { findings: 0, unique: new Set(), runs: 0 }]));
for (const job of jobs) {
  const r = results.get(job);
  byView[job.view] ??= {};
  byView[job.view][job.width] ??= {};
  byView[job.view][job.width][job.lang] = r;
  for (const c of CHECKS) {
    summary[c].findings += r[c].length;
    if (r[c].length) summary[c].runs++;
    for (const f of r[c]) summary[c].unique.add(`${job.view} ${f}`);
  }
}
const totals = Object.fromEntries(CHECKS.map((c) => [c, { findings: summary[c].findings, unique: summary[c].unique.size, runs: summary[c].runs }]));
await writeFile(
  outFile,
  `${JSON.stringify({ generated: new Date().toISOString(), runs: jobs.length, views: views.length, totals, unique: Object.fromEntries(CHECKS.map((c) => [c, [...summary[c].unique].sort()])), byView }, null, 1)}\n`,
);
console.log(`\n${jobs.length} runs over ${views.length} views (390 / 1280 px, en / he, light). Findings (all runs / unique per view / runs with any):`);
for (const c of CHECKS) console.log(`  ${c.padEnd(14)} ${String(totals[c].findings).padStart(4)} / ${String(totals[c].unique).padStart(3)} / ${totals[c].runs}`);
console.log(`Wrote ${outFile}`);
