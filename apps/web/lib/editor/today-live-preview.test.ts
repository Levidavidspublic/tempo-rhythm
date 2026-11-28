import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { pageLanguage, pageSurface } from "@/components/editor/LivePreviewEditor";
import { inlineDecorations, lineDirections, tempoBlocksField } from "@/components/editor/live-preview";
import { STARTER_TEMPLATES } from "@/convex/lib/templateCatalog";
import { periodPageDraft } from "@/lib/period-pages";

/**
 * Today, the weekly pages and every other page draw their Markdown with the live preview: the
 * same LivePreviewEditor as /notes/[id]. A dated page opens with its page-meta block (NT-07);
 * that once hid the whole page's preview, so Today showed "## Intention" and "- [ ] Morning".
 */

const LABELS = {
  minutes: "min",
  removeBlock: "Remove",
  brokenBlock: "Broken block",
  template: "Template",
  taskDone: "Done",
  taskTitle: "Task title",
};

function starter(periodType: "daily" | "weekly"): string {
  const template = STARTER_TEMPLATES.find((t) => t.periodType === periodType);
  if (!template) throw new Error(`no ${periodType} starter`);
  return template.body;
}

type Drawn = { lineClasses: Map<string, string>; hidden: string[]; widgets: string[] };

/** What the page editor draws for `body`: each line's classes, hidden text and widget text. */
function draw(body: string): Drawn {
  let state = EditorState.create({ doc: body, extensions: [pageLanguage(), pageSurface({ labels: LABELS, ariaLabel: "Page" })] });
  // A new state's first parse stops after CodeMirror's 20 ms budget, so on a busy machine its tree
  // can end before the last headings (the editor itself redraws as parsing goes on). Finish the
  // parse, then take a state that carries the whole tree.
  ensureSyntaxTree(state, state.doc.length, 10_000);
  state = state.update({}).state;
  const drawn: Drawn = { lineClasses: new Map(), hidden: [], widgets: [] };
  inlineDecorations(state, [{ from: 0, to: state.doc.length }]).between(0, state.doc.length, (from, to, deco) => {
    const spec = deco.spec as { class?: string; widget?: unknown };
    const text = state.doc.sliceString(from, to);
    if (from === to && spec.class) drawn.lineClasses.set(state.doc.lineAt(from).text, spec.class);
    else if (spec.widget) drawn.widgets.push(`${state.doc.lineAt(from).text}|${text}`);
    else if (!spec.class) drawn.hidden.push(`${state.doc.lineAt(from).text}|${text}`);
  });
  return drawn;
}

describe("Today and weekly pages draw as live preview", () => {
  const daily = periodPageDraft("daily", "2026-10-13", starter("daily")).body;
  const weekly = periodPageDraft("weekly", "2026-10-12", starter("weekly")).body;

  test("the bodies Today and /week make open with their page-meta block", () => {
    expect(daily.startsWith("```json tempo\n")).toBe(true);
    expect(daily).toContain('"type":"page-meta"');
    expect(daily).toContain("## Intention\n");
    expect(daily).toContain("- [ ] Morning\n");
    expect(weekly.startsWith("```json tempo\n")).toBe(true);
  });

  test("Today: headings are headings and their ## marks are hidden", () => {
    const drawn = draw(daily);
    for (const heading of ["## Intention", "## Schedule", "## Notes"]) {
      expect(drawn.lineClasses.get(heading)).toBe("cm-tp-h cm-tp-h2");
      expect(drawn.hidden).toContain(`${heading}|## `);
    }
  });

  test("Today: - [ ] lines are checkboxes", () => {
    const drawn = draw(daily);
    for (const item of ["Morning", "Midday", "Afternoon"]) {
      expect(drawn.widgets.some((w) => w.startsWith(`- [ ] ${item}|`) && w.endsWith("[ ]"))).toBe(true);
    }
  });

  test("weekly page: headings and checkboxes are drawn too", () => {
    const drawn = draw(weekly);
    expect(drawn.lineClasses.get("## Focus")).toBe("cm-tp-h cm-tp-h2");
    expect(drawn.lineClasses.get("### Monday")).toBe("cm-tp-h cm-tp-h3");
    expect(drawn.widgets.some((w) => w.startsWith("- [ ] |"))).toBe(true);
  });

  test("a page that opens with prose draws the same way", () => {
    const drawn = draw("## Intention\nOne line.\n\n- [ ] Morning\n");
    // Line 1 holds the caret, so its marks stay visible while it is being edited.
    expect(drawn.lineClasses.get("## Intention")).toBe("cm-tp-h cm-tp-h2");
    expect(drawn.widgets.some((w) => w.startsWith("- [ ] Morning|"))).toBe(true);
  });

  test("text inside a Tempo block is never drawn as Markdown", () => {
    const drawn = draw(daily);
    for (const line of drawn.lineClasses.keys()) expect(line.startsWith("{")).toBe(false);
  });
});

describe("Today and /week mount the page editor with live preview", () => {
  const web = join(import.meta.dir, "..", "..");
  const source = (path: string) => readFileSync(join(web, path), "utf8");

  test("Today's daily page is the shared NotePage", () => {
    const daily = source("components/today/DailyPage.tsx");
    expect(daily).toMatch(/import \{ NotePage \} from "@\/components\/notes\/NotesScreen";/);
    expect(daily).toMatch(/<NotePage\b/);
  });

  test("/week opens its page at /notes/[id]", () => {
    expect(source("components/today/WeekOpener.tsx")).toContain("router.replace(`/notes/${state.noteId}`)");
  });

  test("NotePage edits in PageEditorView, which mounts LivePreviewEditor", () => {
    expect(source("components/notes/NotesScreen.tsx")).toMatch(/<PageEditorView\b/);
    expect(source("components/notes/PageEditorView.tsx")).toMatch(/<LivePreviewEditor\b/);
  });

  test("LivePreviewEditor mounts the Markdown language and the live preview", () => {
    const editor = source("components/editor/LivePreviewEditor.tsx");
    expect(editor).toMatch(/\bpageLanguage\(\),/);
    expect(editor).toMatch(/\bpageSurface\(\{/);
    const state = EditorState.create({ doc: "", extensions: [pageLanguage(), pageSurface({ labels: LABELS, ariaLabel: "Page" })] });
    expect(state.field(tempoBlocksField, false)).toBeDefined();
  });
});

describe("each page line takes its own direction (F-72)", () => {
  /** The `dir` each line gets, by line text. */
  function directions(body: string, ranges?: { from: number; to: number }[]) {
    const state = EditorState.create({ doc: body });
    const out: Array<[string, string | undefined]> = [];
    lineDirections(state, ranges ?? [{ from: 0, to: state.doc.length }]).between(0, state.doc.length, (from, _to, deco) => {
      const spec = deco.spec as { attributes?: { dir?: string } };
      out.push([state.doc.lineAt(from).text, spec.attributes?.dir]);
    });
    return out;
  }

  test("every line of the daily starter gets dir=auto, once, in order", () => {
    const body = starter("daily");
    const lines = body.split("\n");
    expect(directions(body)).toEqual(lines.map((line) => [line, "auto"]));
  });

  test("an English line and a Hebrew line each get their own dir=auto; empty lines too", () => {
    expect(directions("One line for what would make today feel complete.\n\nשורה אחת בעברית.")).toEqual([
      ["One line for what would make today feel complete.", "auto"],
      ["", "auto"],
      ["שורה אחת בעברית.", "auto"],
    ]);
  });

  test("only the visible ranges are decorated, and a line two ranges share is decorated once", () => {
    const body = "a\nb\nc\nd";
    expect(directions(body, [{ from: 0, to: 1 }, { from: 1, to: 3 }, { from: 6, to: 7 }])).toEqual([
      ["a", "auto"],
      ["b", "auto"],
      ["d", "auto"],
    ]);
  });
});
