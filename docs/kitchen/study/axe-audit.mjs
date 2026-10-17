// Kitchen study run: an automated axe-core audit of every gallery view.
//   bun docs/kitchen/study/axe-audit.mjs <galleryDir> [view,view,...]
// axe-core comes from https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js (Deque Systems,
// MPL-2.0). It is downloaded at run time (AXE_PATH=<local axe.min.js> skips the download) and injected
// into the page only: it is not a repo dependency, not vendored and not shipped with the app.
// The gallery is built by gallery/build.ts (real components, fictional data, stand-in Convex hooks).
// Every view in entry.tsx (or the listed ones) is opened at 390 and 1280 px, in English and Hebrew
// ("-he" views in Hebrew only), light and dark (THEME=light or THEME=dark for one), and axe runs on the
// whole document with the WCAG 2.0 / 2.1 / 2.2 A and AA rules plus best-practice. The gallery has no app
// shell: only <main class="tp-app__main"> around the view, no <title>, no page <h1>, so page-level rules
// (document-title, page-has-heading-one and the like) can fire because of the gallery, not the app.
// Writes docs/kitchen/study/axe-audit.json (OUT= overrides) and prints a summary. WORKERS=4 by default.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const here = import.meta.dir;
const [galleryDir, list] = process.argv.slice(2);
if (!galleryDir) {
	console.error("usage: axe-audit.mjs <galleryDir> [view,view,...]");
	process.exit(2);
}
const AXE_URL =
	"https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
const TAGS = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
	"best-practice",
];
const themes =
	process.env.THEME === "dark"
		? ["dark"]
		: process.env.THEME === "light"
			? ["light"]
			: ["light", "dark"];
const outFile = process.env.OUT ?? path.join(here, "axe-audit.json");
const workers = Number(process.env.WORKERS ?? 4);
const WIDTHS = [390, 1280];
const SETTLE_MS = 1500; // the longest scripted steps finish 1150 ms after mount
const IMPACTS = ["critical", "serious", "moderate", "minor"];
// Rules that fire because of the gallery page, not the app. Checked by hand against the app's parents
// of each view; a finding of one of these on a view not named here is still counted as the app's.
const GALLERY = {
	"document-title": {
		views: "*",
		why: "gallery/build.ts writes index.html with no <title>; the app sets one in app/layout.tsx metadata",
	},
	"page-has-heading-one": {
		views: [
			"plan-guided",
			"plan-guided-edit",
			"plan-guided-accepted",
			"plan-replan-preview",
			"miniapp-approve",
			"miniapp-stopped",
		],
		why: "the view is a fragment with no gallery <Page>; in the app it sits under PlanPathScreen's h1 (or, for the mini-app frame, has no route yet)",
	},
	"heading-order": {
		views: ["calendar-mover"],
		why: "the gallery's <Page> h1 is followed straight by WeekGrid's mover h3; in the app CalendarViews puts the week's h2 between them",
	},
};
const isGallery = (rule, view) =>
	GALLERY[rule] &&
	(GALLERY[rule].views === "*" || GALLERY[rule].views.includes(view));

/** The view names, read from the VIEWS map in entry.tsx. */
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

/** axe's source: the local copy named by AXE_PATH, or the exact cdnjs version. */
async function axeSource() {
	if (process.env.AXE_PATH) return readFile(process.env.AXE_PATH, "utf8");
	const res = await fetch(AXE_URL);
	if (!res.ok) throw new Error(`axe download failed: ${res.status} ${AXE_URL}`);
	return res.text();
}

async function run(browser, base, axe, job) {
	const result = { violations: [], incomplete: {}, errors: [] };
	const ctx = await browser.newContext({
		viewport: { width: job.width, height: job.width === 390 ? 844 : 900 },
		colorScheme: job.theme,
		locale: job.lang === "he" ? "he-IL" : "en-US",
	});
	try {
		const page = await ctx.newPage();
		page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 200)));
		await page.goto(
			`${base}/?view=${encodeURIComponent(job.view)}&lang=${job.lang}&theme=${job.theme}`,
			{ waitUntil: "networkidle", timeout: 60_000 },
		);
		await page.waitForTimeout(SETTLE_MS);
		await page.addScriptTag({ content: axe });
		const raw = await page.evaluate(
			(values) =>
				window.axe.run(document, {
					runOnly: { type: "tag", values },
					resultTypes: ["violations", "incomplete"],
				}),
			TAGS,
		);
		result.violations = raw.violations.map((v) => ({
			id: v.id,
			impact: v.impact,
			help: v.help,
			...(isGallery(v.id, job.view) ? { gallery: true } : {}),
			nodes: v.nodes.map((n) => ({
				target: n.target.flat().join(" "),
				html: n.html.replace(/\s+/g, " ").slice(0, 160),
			})),
		}));
		// "Needs review": nodes axe could not decide (mostly color-contrast over layered backgrounds). Counted only.
		result.incomplete = Object.fromEntries(
			raw.incomplete.map((v) => [v.id, v.nodes.length]),
		);
	} catch (e) {
		result.errors.push(`axe: ${String(e.message ?? e).split("\n")[0]}`);
	}
	await ctx.close();
	return result;
}

const axe = await axeSource();
if (!axe.startsWith("/*! axe v4.10.2"))
	throw new Error("unexpected axe source (want axe v4.10.2)");
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
	themes.flatMap((theme) =>
		(view.endsWith("-he") ? ["he"] : ["en", "he"]).flatMap((lang) =>
			WIDTHS.map((width) => ({ view, theme, lang, width })),
		),
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
			const r = await run(browser, base, axe, job);
			results.set(job, r);
			const flags = r.violations.map((v) => `${v.id}=${v.nodes.length}`);
			console.log(
				`${job.view}\t${job.theme}\t${job.width}\t${job.lang}\t${flags.join(" ") || "clean"}${r.errors.length ? `\terrors=${r.errors.join(" | ")}` : ""}`,
			);
		}
	}),
);
await browser.close();
server.stop();

const byView = {};
const byRule = {};
const byImpact = Object.fromEntries(
	IMPACTS.map((i) => [i, { nodes: 0, runs: 0 }]),
);
const unique = new Set();
const incomplete = {};
let errorRuns = 0;
for (const job of jobs) {
	const r = results.get(job);
	byView[job.view] ??= {};
	byView[job.view][job.theme] ??= {};
	byView[job.view][job.theme][job.width] ??= {};
	byView[job.view][job.theme][job.width][job.lang] = r;
	if (r.errors.length) errorRuns++;
	for (const [id, n] of Object.entries(r.incomplete))
		incomplete[id] = (incomplete[id] ?? 0) + n;
	const impactsHere = new Set();
	for (const v of r.violations) {
		byRule[v.id] ??= {
			impact: v.impact,
			help: v.help,
			nodes: 0,
			runs: 0,
			views: new Set(),
			galleryNodes: 0,
		};
		const rule = byRule[v.id];
		rule.nodes += v.nodes.length;
		if (v.gallery) rule.galleryNodes += v.nodes.length;
		rule.runs++;
		rule.views.add(job.view);
		byImpact[v.impact] ??= { nodes: 0, runs: 0 };
		byImpact[v.impact].nodes += v.nodes.length;
		impactsHere.add(v.impact);
		for (const n of v.nodes) unique.add(`${job.view} ${v.id} ${n.target}`);
	}
	for (const i of impactsHere) byImpact[i].runs++;
}
const rules = Object.fromEntries(
	Object.entries(byRule)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([id, r]) => [
			id,
			{
				...r,
				views: [...r.views].sort(),
				...(GALLERY[id] ? { galleryWhy: GALLERY[id].why } : {}),
			},
		]),
);
const totals = {
	violations: Object.values(rules).reduce((s, r) => s + r.nodes, 0),
	appViolations: Object.values(rules).reduce(
		(s, r) => s + r.nodes - r.galleryNodes,
		0,
	),
	unique: unique.size,
	runsWithAny: jobs.filter((j) => results.get(j).violations.length).length,
	errorRuns,
	byImpact,
	byRule: rules,
	incomplete: Object.fromEntries(
		Object.entries(incomplete).sort(([a], [b]) => a.localeCompare(b)),
	),
};
await writeFile(
	outFile,
	`${JSON.stringify({ generated: new Date().toISOString(), axe: AXE_URL, tags: TAGS, runs: jobs.length, views: views.length, themes, totals, unique: [...unique].sort(), byView }, null, 1)}\n`,
);
console.log(
	`\n${jobs.length} runs over ${views.length} views (390 / 1280 px, en / he, ${themes.join(" / ")}), axe 4.10.2 (${TAGS.join(", ")}).`,
);
console.log(
	`Violations (nodes, all runs / unique view+rule+target / runs with any): ${totals.violations} / ${totals.unique} / ${totals.runsWithAny}${errorRuns ? `; ${errorRuns} runs with errors` : ""}`,
);
for (const i of IMPACTS)
	console.log(
		`  ${i.padEnd(14)} ${String(byImpact[i].nodes).padStart(5)} nodes in ${byImpact[i].runs} runs`,
	);
for (const [id, r] of Object.entries(rules)) {
	console.log(
		`  ${id.padEnd(28)} ${r.impact.padEnd(9)} ${String(r.nodes).padStart(5)} nodes (${r.galleryNodes} gallery), ${r.runs} runs, ${r.views.length} views`,
	);
}
console.log(`Outside gallery artefacts: ${totals.appViolations} nodes.`);
console.log(
	`Needs review (axe incomplete, nodes): ${
		Object.entries(totals.incomplete)
			.map(([id, n]) => `${id}=${n}`)
			.join(" ") || "none"
	}`,
);
console.log(`Wrote ${outFile}`);
