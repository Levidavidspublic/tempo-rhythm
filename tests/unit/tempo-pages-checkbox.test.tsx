import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import {
	type Browser,
	expect as browserExpect,
	chromium,
	type Page,
} from "@playwright/test";

const root = resolve(import.meta.dir, "../..");
const exec = promisify(execFile);
let directory: string;
let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
let page: Page | undefined;
let errors: string[] = [];

type EditorFixture = {
	text(): string;
	select(anchor: number, head?: number): void;
};
declare global {
	interface Window {
		checkboxFixture: EditorFixture;
	}
}

beforeAll(async () => {
	directory = await mkdtemp(join(root, "apps/web/.checkbox-fixture-"));
	const entry = join(directory, "entry.tsx");
	await writeFile(
		entry,
		`
    import React, { useRef } from "react";
    import { createRoot } from "react-dom/client";
    import { EditorView } from "@codemirror/view";
    import { LivePreviewEditor } from "../components/editor/LivePreviewEditor";
    const params = new URLSearchParams(location.search);
    const lang = params.get("lang") === "he" ? "he" : "en";
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = params.get("theme") || "light";
    function Fixture() {
      const editor = useRef(null);
      window.checkboxFixture = {
        text: () => editor.current.getText(),
        select: (anchor, head = anchor) => {
          const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
          view.dispatch({ selection: { anchor, head } });
          view.focus();
        },
      };
      return <main className="tp-paper">
        <h1>{lang === "he" ? "העמוד היומי" : "Daily page"}</h1>
        <LivePreviewEditor ref={editor} initialValue={params.get("body") || ""}
          ariaLabel={lang === "he" ? "תוכן העמוד" : "Page body"}
          labels={{ minutes: "min", removeBlock: "Remove", brokenBlock: "Broken block", template: "Template",
            taskDone: lang === "he" ? "הושלם" : "Done", taskTitle: lang === "he" ? "משימה" : "Task title" }}
          onChange={() => {}} />
        <button type="button">{lang === "he" ? "פעולה נוספת" : "Another action"}</button>
      </main>;
    }
    createRoot(document.getElementById("root")).render(<Fixture />);
  `,
	);
	// A fresh CLI process cannot inherit Bun's process-global mocks from another suite.
	await exec(
		process.execPath,
		[
			"build",
			entry,
			"--target=browser",
			"--outfile",
			join(directory, "bundle.js"),
		],
		{
			cwd: join(root, "apps/web"),
			timeout: 30_000,
			killSignal: "SIGKILL",
			maxBuffer: 2 * 1024 * 1024,
		},
	);
	const script = await readFile(join(directory, "bundle.js"));
	const css = (
		await Promise.all(
			["docs/design/v3/tokens.css", "apps/web/app/tempo.css"].map((file) =>
				readFile(join(root, file), "utf8"),
			),
		)
	)
		.join("\n")
		.replace(/^@import[^\n]*\n/gm, "");
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${css}
    body { margin: 0; background: var(--tp-ground); color: var(--tp-ink); }
    main { margin: var(--tp-space-4); padding: var(--tp-space-4); max-width: var(--tp-measure); }
    button { margin-block-start: var(--tp-space-4); min-height: var(--tp-touch); }
    </style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
	server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		fetch(request) {
			return new URL(request.url).pathname === "/bundle.js"
				? new Response(script, {
						headers: { "Content-Type": "text/javascript" },
					})
				: new Response(html, { headers: { "Content-Type": "text/html" } });
		},
	});
	const executablePath = [
		chromium.executablePath(),
		"/usr/bin/chromium",
		"/usr/bin/google-chrome",
	].find(existsSync);
	if (!executablePath)
		throw new Error("Chromium is required for the mounted checkbox regression");
	browser = await chromium.launch({
		executablePath,
		args: ["--no-sandbox"],
		timeout: 30_000,
	});
}, 60_000);

afterEach(() => {
	expect(errors).toEqual([]);
}, 15_000);

afterAll(async () => {
	// Attempt every cleanup even if an earlier resource fails to close.
	const results = await Promise.allSettled([
		browser?.close(),
		server?.stop(true),
		directory ? rm(directory, { recursive: true, force: true }) : undefined,
	]);
	const failures = results.filter((result) => result.status === "rejected");
	if (failures.length)
		throw new AggregateError(
			failures.map((failure) => failure.reason),
			"Checkbox fixture cleanup failed",
		);
}, 15_000);

async function open(body = "", lang = "en", width = 390, theme = "light") {
	// Each navigation mounts a fresh editor; reuse only the owned browser page.
	errors = [];
	if (!page) {
		page = await browser.newPage({
			viewport: { width, height: 844 },
			reducedMotion: "reduce",
		});
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) => {
			if (message.type() === "error") errors.push(message.text());
		});
	} else await page.setViewportSize({ width, height: 844 });
	await page.goto(
		`${server.url}?${new URLSearchParams({ body, lang, theme })}`,
	);
	await browserExpect(page.locator(".cm-content")).toBeVisible();
	await page.locator(".cm-content").click();
	return page;
}
function currentPage() {
	if (!page)
		throw new Error("Open the checkbox fixture before using its editor");
	return page;
}
const text = () => currentPage().evaluate(() => window.checkboxFixture.text());
const select = (anchor: number, head = anchor) =>
	currentPage().evaluate(
		({ anchor, head }) => window.checkboxFixture.select(anchor, head),
		{ anchor, head },
	);

describe.serial("editable page checkboxes", () => {
	test("typing the exact empty prefix draws a checkbox without leaving the line", async () => {
		const p = await open();
		await p.keyboard.type("- [ ] ");
		await browserExpect(
			p.getByRole("checkbox", { name: "Done" }),
		).toBeVisible();
		expect(await text()).toBe("- [ ] ");
		await p.keyboard.type("Read one page");
		expect(await text()).toBe("- [ ] Read one page");
		await browserExpect(p.getByRole("checkbox")).toHaveCount(1);
	}, 15_000);

	test("completed and empty items keep native checkbox states on the active line", async () => {
		const p = await open("- [x] Complete\n- [ ] ");
		await select(21);
		await browserExpect(p.getByRole("checkbox")).toHaveCount(2);
		await browserExpect(p.getByRole("checkbox").first()).toBeChecked();
		await browserExpect(p.getByRole("checkbox").last()).not.toBeChecked();
	}, 15_000);

	test("clicking toggles only the marker and the change supports undo and redo", async () => {
		const p = await open("- [ ] Read one page");
		await select(18);
		await p.getByRole("checkbox").click();
		expect(await text()).toBe("- [x] Read one page");
		await browserExpect(p.getByRole("checkbox")).toBeChecked();
		await p.locator(".cm-content").focus();
		await p.keyboard.press("Control+z");
		expect(await text()).toBe("- [ ] Read one page");
		await p.keyboard.press("Control+Shift+z");
		expect(await text()).toBe("- [x] Read one page");
	}, 15_000);

	test("keyboard checkbox activation preserves a visible focus target", async () => {
		const p = await open("- [ ] Read");
		await select(10);
		await p.getByRole("checkbox").focus();
		await p.keyboard.press("Space");
		expect(await text()).toBe("- [x] Read");
		await browserExpect(p.getByRole("checkbox")).toBeFocused();
		expect(
			await p
				.getByRole("checkbox")
				.evaluate((element) => getComputedStyle(element).outlineStyle),
		).not.toBe("none");
	}, 15_000);

	test("title selection can be replaced while the checkbox remains drawn", async () => {
		const p = await open("- [ ] Old title");
		await select(6, 15);
		await p.keyboard.type("New title");
		expect(await text()).toBe("- [ ] New title");
		await browserExpect(p.getByRole("checkbox")).toHaveCount(1);
		await select(6);
		await p.keyboard.press("ArrowRight");
		await p.keyboard.type("!");
		expect(await text()).toBe("- [ ] N!ew title");
	}, 15_000);

	test("fenced and inline code never become live checkboxes", async () => {
		const body = "```md\n- [ ] Code\n```\n\n`- [ ] inline`\n\n- [ ] Live";
		const p = await open(body);
		await select(body.length);
		await browserExpect(p.getByRole("checkbox")).toHaveCount(1);
		expect(await text()).toBe(body);
	}, 15_000);

	test("Hebrew typing keeps direction, a phone target and no horizontal overflow", async () => {
		const p = await open("", "he");
		await p.keyboard.type("- [ ] לקרוא עמוד");
		const box = p.getByRole("checkbox", { name: "הושלם" });
		await browserExpect(box).toBeVisible();
		expect(await text()).toBe("- [ ] לקרוא עמוד");
		expect(await p.locator("html").getAttribute("dir")).toBe("rtl");
		const target = await box.evaluate((element) =>
			(element.closest("label") ?? element).getBoundingClientRect().toJSON(),
		);
		expect(target.width).toBeGreaterThanOrEqual(44);
		expect(target.height).toBeGreaterThanOrEqual(44);
		expect(
			await p.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
	}, 15_000);

	test("captures the actual mounted page editor in both languages and widths", async () => {
		const output = process.env.TEMPO_CHECKBOX_EVIDENCE_DIR ?? directory;
		await mkdir(output, { recursive: true });
		for (const lang of ["en", "he"])
			for (const width of [390, 1280])
				for (const theme of ["light", "dark"]) {
					const p = await open("", lang, width, theme);
					await p.keyboard.insertText(
						lang === "he" ? "- [ ] לקרוא עמוד" : "- [ ] Read one page",
					);
					await browserExpect(p.locator("main")).toHaveCount(1);
					await browserExpect(p.locator("h1")).toHaveCount(1);
					expect(
						await p.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
					).toBe(true);
					expect(errors).toEqual([]);
					await p.screenshot({
						path: join(output, `${lang}-${width}-${theme}.jpg`),
						type: "jpeg",
						fullPage: true,
					});
				}
	}, 60_000);
});
