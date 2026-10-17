// Kitchen study run: a click-through of every control in every gallery view (gate rule R-35, "every
// control was run"). The keyboard walk (a11y-walk.mjs) reaches every control; this presses them.
//   bun docs/kitchen/study/click-through.mjs <galleryDir> [view,view,...]
// The gallery is built by gallery/build.ts (real components, fictional data, stand-in Convex hooks).
// Every view in entry.tsx (or the listed ones) is opened at 390 and 1280 px, in English and Hebrew
// ("-he" views in Hebrew only), light theme. For each run:
//   1. The view is opened and left to settle (its scripted steps finish), and every visible, enabled
//      button, link, checkbox, radio, switch, select and summary inside <main> is listed. Links to
//      other origins and file inputs are skipped. A visually hidden radio or checkbox is pressed
//      through its visible label. Controls inside an iframe (the mini-app's sandbox) are not reached.
//   2. For each control, the view is opened fresh, the control found again (same place in the list,
//      same description) and pressed: a real click (a DOM click when something covers it, noted as
//      "dom"); a select gets another option chosen. Links don't leave: a capture listener stops the
//      navigation and records where it would go. A form submit nobody prevented is stopped too, and
//      counts as a failure (in the app the page would reload).
//   3. After 600 ms, a failure is any page error, console error, unhandled rejection, a new error
//      state (data-component="StateError", the screens' error boundary), the page going blank
//      (#root or <main> empty), or a link whose target reads "undefined", "null" or "NaN". An error
//      the view already logged while loading (an error-mode view's own error) doesn't count again.
// The app's stylesheet comes from the dev server named in index.html; it is fetched once and served
// to every page from memory, so a long run doesn't load that server.
// Writes docs/kitchen/study/click-through.json (OUT= overrides) and prints a summary.
// WORKERS=4 by default; CHROMIUM_PATH picks the browser, as in a11y-walk.mjs.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const here = import.meta.dir;
const [galleryDir, list] = process.argv.slice(2);
if (!galleryDir) {
	console.error("usage: click-through.mjs <galleryDir> [view,view,...]");
	process.exit(2);
}
const theme = "light";
const outFile = process.env.OUT ?? path.join(here, "click-through.json");
const workers = Number(process.env.WORKERS ?? 4);
const WIDTHS = [390, 1280];
const AFTER_CLICK_MS = 600;
// Settling: wait until the DOM has been still for QUIET_MS (the gallery's scripted steps run every
// 150 ms, starting 250 ms after mount), but at least MIN and at most MAX after load.
const QUIET_MS = 400;
const SETTLE_MIN_MS = 500;
const SETTLE_MAX_MS = 2500;

/** The view names, read from the VIEWS map in entry.tsx (as a11y-walk.mjs does). */
async function galleryViews() {
	const src = await readFile(path.join(here, "gallery/entry.tsx"), "utf8");
	const block = src.slice(
		src.indexOf("const VIEWS"),
		src.indexOf("const root ="),
	);
	return [...block.matchAll(/^ {2}"?([a-z0-9-]+)"?: \(\) =>/gm)].map(
		(m) => m[1],
	);
}

/** Runs in the page before any script: navigation stops, rejections and window.open are noted. */
function guard() {
	window.__ct = { nav: [], rejections: [], submits: [], opened: [] };
	window.addEventListener("unhandledrejection", (e) => {
		const r = e.reason;
		window.__ct.rejections.push(
			String(r?.stack ?? r?.message ?? r)
				.split("\n")
				.slice(0, 2)
				.join(" ")
				.slice(0, 300),
		);
	});
	// Capture phase on window: runs before React's handlers, which still run (only the default stops).
	window.addEventListener(
		"click",
		(e) => {
			const a =
				e.target instanceof Element ? e.target.closest("a[href]") : null;
			if (!a) return;
			e.preventDefault();
			window.__ct.nav.push(a.getAttribute("href"));
		},
		true,
	);
	// Bubble phase on window: after React's onSubmit. A submit nobody prevented would reload the page.
	window.addEventListener("submit", (e) => {
		if (!e.defaultPrevented) {
			window.__ct.submits.push(
				e.target?.getAttribute?.("data-component") ||
					e.target?.className ||
					"form",
			);
			e.preventDefault();
		}
	});
	window.open = (url) => {
		window.__ct.opened.push(String(url));
		return null;
	};
}

/** Runs in the page: tags every pressable control in <main> with data-ct=<index>; returns the list. */
function listControls() {
	for (const el of document.querySelectorAll("[data-ct]"))
		el.removeAttribute("data-ct");
	const main = document.querySelector("main");
	if (!main) return [];
	const short = (s, n = 40) =>
		(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
	const describe = (el) => {
		const cls = [...el.classList]
			.slice(0, 2)
			.map((c) => `.${c}`)
			.join("");
		const attrs = [
			"data-action",
			"data-grade",
			"data-component",
			"role",
			"type",
			"name",
			"value",
		]
			.map((a) =>
				el.getAttribute(a) ? `[${a}=${short(el.getAttribute(a), 24)}]` : "",
			)
			.join("");
		const label = el.labels?.[0]?.textContent;
		const name = short(
			el.getAttribute("aria-label") ||
				label ||
				el.textContent ||
				el.getAttribute("title") ||
				el.value,
		);
		return `${el.tagName.toLowerCase()}${cls}${attrs}${name ? ` "${name}"` : ""}`;
	};
	const shown = (el) => {
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return false;
		const cs = getComputedStyle(el);
		if (
			cs.visibility === "hidden" ||
			cs.display === "none" ||
			Number(cs.opacity) === 0
		)
			return false;
		for (let p = el; p; p = p.parentElement) {
			if (p.hidden || p.inert || p.getAttribute("aria-hidden") === "true")
				return false;
			if (
				p.tagName === "DETAILS" &&
				!p.open &&
				!(
					p.firstElementChild?.tagName === "SUMMARY" &&
					p.firstElementChild.contains(el)
				)
			)
				return false;
		}
		return true;
	};
	const disabled = (el) =>
		el.disabled ||
		el.matches(":disabled") ||
		el.closest('[aria-disabled="true"]') !== null;
	const sel =
		"button, a[href], input[type=checkbox], input[type=radio], select, summary, [role=button], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=tab]";
	const out = [];
	const seen = new Set();
	for (const el of main.querySelectorAll(sel)) {
		if (seen.has(el)) continue;
		seen.add(el);
		if (el.closest("[data-ct-skip]")) continue;
		if (el.matches("input[type=file]")) continue;
		if (el.tagName === "A") {
			const href = el.getAttribute("href") ?? "";
			let url;
			try {
				url = new URL(href, location.href);
			} catch {
				url = null;
			}
			if (url && url.origin !== location.origin) continue;
		}
		if (disabled(el)) continue;
		let target = el;
		if (!shown(el)) {
			// A visually hidden checkbox or radio is pressed through its label.
			const label = el.labels?.[0];
			if (el.tagName === "INPUT" && label && shown(label)) target = label;
			else continue;
		}
		const index = out.length;
		target.setAttribute("data-ct", String(index));
		out.push({
			index,
			desc: describe(el),
			kind:
				el.tagName === "SELECT"
					? "select"
					: el.tagName === "A"
						? "link"
						: "press",
		});
	}
	return out;
}

/** Runs in the page: what the click left behind. */
function snapshot() {
	const root = document.getElementById("root");
	const main = document.querySelector("main");
	return {
		errorStates: document.querySelectorAll('[data-component="StateError"]')
			.length,
		blank:
			!root ||
			root.childElementCount === 0 ||
			!main ||
			(main.innerText.trim() === "" &&
				!main.querySelector("img, svg, canvas, iframe, video")),
		nav: [...window.__ct.nav],
		rejections: [...window.__ct.rejections],
		submits: [...window.__ct.submits],
		opened: [...window.__ct.opened],
	};
}

/** Waits until the DOM has been still for QUIET_MS (bounded by SETTLE_MIN_MS and SETTLE_MAX_MS). */
async function settle(page) {
	await page.evaluate(
		([quiet, min, max]) =>
			new Promise((resolve) => {
				const start = performance.now();
				let last = start;
				const obs = new MutationObserver(() => {
					last = performance.now();
				});
				obs.observe(document.body, {
					subtree: true,
					childList: true,
					attributes: true,
					characterData: true,
				});
				const tick = () => {
					const now = performance.now();
					if (
						now - start >= max ||
						(now - start >= min && now - last >= quiet)
					) {
						obs.disconnect();
						resolve();
					} else setTimeout(tick, 50);
				};
				tick();
			}),
		[QUIET_MS, SETTLE_MIN_MS, SETTLE_MAX_MS],
	);
}

const cssCache = new Map();
async function newContext(browser, job) {
	const ctx = await browser.newContext({
		viewport: { width: job.width, height: job.width === 390 ? 844 : 900 },
		colorScheme: theme,
		locale: job.lang === "he" ? "he-IL" : "en-US",
	});
	await ctx.addInitScript(guard);
	// The stylesheet from the dev server (any other origin): fetched once per run, then from memory.
	await ctx.route(
		(url) => url.origin !== base,
		async (route) => {
			const url = route.request().url();
			if (!cssCache.has(url)) {
				cssCache.set(
					url,
					fetch(url).then(async (r) => ({
						status: r.status,
						body: Buffer.from(await r.arrayBuffer()),
						type: r.headers.get("content-type") ?? "text/css",
					})),
				);
			}
			try {
				const hit = await cssCache.get(url);
				await route.fulfill({
					status: hit.status,
					body: hit.body,
					contentType: hit.type,
				});
			} catch {
				await route.abort();
			}
		},
	);
	return ctx;
}

/** Opens the view fresh in `page`, with error listeners reset; returns the error buckets. */
async function openView(page, base, job) {
	const errs = { page: [], console: [] };
	page.removeAllListeners("pageerror");
	page.removeAllListeners("console");
	page.on("pageerror", (e) =>
		errs.page.push(
			String(e.stack ?? e)
				.split("\n")
				.slice(0, 2)
				.join(" ")
				.slice(0, 300),
		),
	);
	page.on("console", (m) => {
		if (m.type() !== "error") return;
		const text = m.text();
		if (/favicon\.ico/.test(m.location()?.url ?? "") || /favicon/.test(text))
			return;
		errs.console.push(text.replace(/\s+/g, " ").slice(0, 300));
	});
	await page.goto(
		`${base}/?view=${encodeURIComponent(job.view)}&lang=${job.lang}&theme=${theme}`,
		{ waitUntil: "networkidle", timeout: 60_000 },
	);
	await settle(page);
	return errs;
}

const SUSPICIOUS_HREF = /undefined|null|NaN|\[object/;
/** An error's text without the gallery's address (its port and ?view= change between runs). */
const plain = (text) =>
	text.replace(/https?:\/\/localhost:\d+\/[^\s):]*/g, "<gallery>");

async function run(browser, base, job) {
	const result = {
		controls: 0,
		pressed: 0,
		failures: [],
		links: {},
		dom: [],
		loadErrors: [],
		skipped: [],
	};
	try {
		const first = await browserPage(browser, job);
		const firstErrs = await openView(first.page, base, job);
		const loadRejections = await first.page.evaluate(
			() => window.__ct.rejections,
		);
		const load = [
			...firstErrs.page,
			...firstErrs.console,
			...loadRejections,
		].map(plain);
		result.loadErrors = load;
		const controls = await first.page.evaluate(listControls);
		await first.ctx.close();
		result.controls = controls.length;
		for (const control of controls) {
			// A new context for every press: what one press stored (a toggle remembered in
			// localStorage, say) never changes the next one's starting point.
			const { ctx, page } = await browserPage(browser, job);
			try {
				await press(page, base, job, control, load, result);
			} finally {
				await ctx.close();
			}
		}
	} catch (e) {
		result.failures.push({
			index: -1,
			control: "(run)",
			kind: "harness",
			error: String(e.message ?? e).split("\n")[0],
		});
	}
	return result;
}

async function browserPage(browser, job) {
	const ctx = await newContext(browser, job);
	return { ctx, page: await ctx.newPage() };
}

async function press(page, base, job, control, load, result) {
	const errs = await openView(page, base, job);
	const again = await page.evaluate(listControls);
	const match = again[control.index];
	if (!match || match.desc !== control.desc) {
		result.skipped.push(`${control.desc}: not found again after a fresh load`);
		return;
	}
	const before = await page.evaluate(snapshot);
	const loc = page.locator(`[data-ct="${control.index}"]`);
	let via = "click";
	try {
		if (control.kind === "select") {
			const value = await loc.evaluate(
				(s) =>
					[...s.options].find((o) => !o.disabled && o.value !== s.value)
						?.value ?? null,
			);
			if (value === null) {
				result.skipped.push(`${control.desc}: no other option`);
				return;
			}
			await loc.selectOption(value, { timeout: 2000 });
			via = "select";
		} else {
			await loc.click({ timeout: 2000 });
		}
	} catch {
		// Covered (a toast, a sheet) or moving: press it the way a script would, and say so.
		via = "dom";
		await loc.evaluate((el) => el.click()).catch(() => {});
	}
	await page.waitForTimeout(AFTER_CLICK_MS);
	const after = await page.evaluate(snapshot);
	result.pressed++;
	if (via === "dom") result.dom.push(control.desc);
	const fail = (kind, error) =>
		result.failures.push({
			index: control.index,
			control: control.desc,
			kind,
			error: plain(error),
		});
	const pageErrors = errs.page.map(plain);
	for (const e of pageErrors) if (!load.includes(e)) fail("pageerror", e);
	for (const e of errs.console)
		if (!load.includes(plain(e))) fail("console", e);
	// Chromium also reports an unhandled rejection as a page error: count it once.
	for (const e of after.rejections) {
		const message = plain(e)
			.split(/\s+at\s/)[0]
			.trim();
		if (
			!load.includes(plain(e)) &&
			!pageErrors.some((p) => p.includes(message))
		)
			fail("rejection", e);
	}
	if (after.errorStates > before.errorStates)
		fail(
			"errorState",
			`${after.errorStates - before.errorStates} new StateError`,
		);
	if (after.blank && !before.blank) fail("blank", "the page went blank");
	for (const s of after.submits)
		fail("submit", `form submit not prevented (${s})`);
	for (const href of [...after.nav, ...after.opened]) {
		result.links[control.desc] = href;
		if (href === null || SUSPICIOUS_HREF.test(href))
			fail("link", `link target ${JSON.stringify(href)}`);
	}
}

const server = Bun.serve({
	port: 0,
	async fetch(req) {
		const p = new URL(req.url).pathname;
		const file = Bun.file(path.join(galleryDir, p === "/" ? "index.html" : p));
		return (await file.exists())
			? new Response(file)
			: new Response("", { status: 404 });
	},
});
const base = `http://localhost:${server.port}`;
const views = list ? list.split(",") : await galleryViews();
const jobs = views.flatMap((view) =>
	(view.endsWith("-he") ? ["he"] : ["en", "he"]).flatMap((lang) =>
		WIDTHS.map((width) => ({ view, lang, width })),
	),
);
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH || undefined,
});
const results = new Map();
let cursor = 0;
await Promise.all(
	Array.from({ length: workers }, async () => {
		while (cursor < jobs.length) {
			const job = jobs[cursor++];
			const r = await run(browser, base, job);
			results.set(job, r);
			console.log(
				`${job.view}\t${job.width}\t${job.lang}\tcontrols=${r.controls}\tpressed=${r.pressed}\t${r.failures.length ? `failures=${r.failures.length}\t${r.failures.map((f) => `${f.control} -> ${f.kind}: ${f.error}`).join(" | ")}` : "clean"}`,
			);
		}
	}),
);
await browser.close();
server.stop();

// Per view: the runs, and the failures folded to unique (control, kind, error) with where they hit.
const byView = {};
let pressed = 0;
let failures = 0;
const unique = new Map();
for (const job of jobs) {
	const r = results.get(job);
	if (!byView[job.view])
		byView[job.view] = {
			controls: 0,
			pressed: 0,
			failures: [],
			links: {},
			dom: [],
			skipped: [],
			loadErrors: [],
			runs: {},
		};
	const v = byView[job.view];
	v.controls = Math.max(v.controls, r.controls);
	v.pressed += r.pressed;
	pressed += r.pressed;
	failures += r.failures.length;
	v.runs[`${job.lang}-${job.width}`] = {
		controls: r.controls,
		pressed: r.pressed,
		failures: r.failures.length,
	};
	Object.assign(v.links, r.links);
	for (const d of r.dom) if (!v.dom.includes(d)) v.dom.push(d);
	for (const s of r.skipped) if (!v.skipped.includes(s)) v.skipped.push(s);
	for (const e of r.loadErrors)
		if (!v.loadErrors.includes(e)) v.loadErrors.push(e);
	for (const f of r.failures) {
		// The same control (its place in the list) and the same error, in any language or width.
		const key = `${job.view}\u0000${f.index}\u0000${f.kind}\u0000${f.error.replace(/lang=\w+/g, "")}`;
		const at = `${job.lang}-${job.width}`;
		if (!unique.has(key)) {
			const { index: _i, ...rest } = f;
			const entry = { ...rest, runs: [] };
			unique.set(key, entry);
			v.failures.push(entry);
		}
		unique.get(key).runs.push(at);
	}
}
const viewsWithFailures = Object.values(byView).filter(
	(v) => v.failures.length,
).length;
await writeFile(
	outFile,
	`${JSON.stringify({ generated: new Date().toISOString(), runs: jobs.length, views: views.length, totals: { pressed, failures, unique: unique.size, viewsWithFailures }, byView }, null, 1)}\n`,
);
console.log(
	`\n${jobs.length} runs over ${views.length} views (390 / 1280 px, en / he, ${theme}).`,
);
console.log(
	`  pressed ${pressed} controls; failures ${failures} (unique ${unique.size}) in ${viewsWithFailures} views`,
);
for (const [key, f] of unique)
	console.log(
		`  - ${key.split("\u0000")[0]}: ${f.control} -> ${f.kind}: ${f.error} [${f.runs.join(" ")}]`,
	);
console.log(`Wrote ${outFile}`);
