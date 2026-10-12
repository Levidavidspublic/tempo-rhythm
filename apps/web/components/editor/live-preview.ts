/**
 * CodeMirror 6 live preview for Tempo pages (OVERNIGHT-RUN.md decision 2).
 *
 * The document is the exact `notes.body` text. Every visual change is a decoration: Markdown
 * marks hide when the cursor is not on their line (Obsidian-style), `json tempo` fences draw
 * as atomic cards that never show their JSON, GFM tables draw as tables until the cursor
 * enters them. Nothing here rewrites text on load, so an untouched page saves back identical.
 */
import {
  Annotation,
  EditorSelection,
  EditorState,
  type Extension,
  type Range,
  StateField,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { parseTempoBlocks, type TempoBlock } from "@tempo/utils";
import { type BlockRange, LINE_SEPARATOR, setTaskDone, setTaskTitle, tempoBlockRanges } from "@/lib/editor/markdown-model";

export type EditorLabels = {
  minutes: string;
  removeBlock: string;
  brokenBlock: string;
  template: string;
  taskDone: string;
  /** Accessible name of a task card's title field. */
  taskTitle: string;
};

/** A task card whose title should take focus when it is drawn (set right after the slash menu inserts it). */
let pendingTitleFocus: string | null = null;
export function focusTaskTitleWhenDrawn(blockId: string): void {
  pendingTitleFocus = blockId;
}

/** Marks a change made by a block card (tick, remove); the boundary guard lets it through. */
export const blockEdit = Annotation.define<boolean>();

/* ------------------------------------------------------------------ */
/* DOM helpers (widgets are plain DOM; React never renders inside CM)   */
/* ------------------------------------------------------------------ */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.append(child);
  return node;
}

function icon(name: string, size: "sm" | "md" = "md"): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", size === "sm" ? "tp-icon tp-icon--sm" : "tp-icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

/* ------------------------------------------------------------------ */
/* Tempo block cards                                                    */
/* ------------------------------------------------------------------ */

/**
 * The block a card stands for, found by the card's own position in the document, so a pasted
 * fence that repeats another block's id still resolves to the card the user clicked. If the
 * position can't be read, only a block with the same exact source counts; ambiguity does nothing.
 */
function findBlock(view: EditorView, dom: HTMLElement, range: BlockRange): BlockRange | undefined {
  const ranges = view.state.field(tempoBlocksField).ranges;
  let at: number | null = null;
  try {
    at = view.posAtDOM(dom);
  } catch {
    at = null;
  }
  if (at !== null) {
    const hit = ranges.find((r) => r.from === at);
    if (hit && hit.segment.source === range.segment.source) return hit;
  }
  const same = ranges.filter((r) => r.segment.source === range.segment.source);
  return same.length === 1 ? same[0] : undefined;
}

class TempoBlockWidget extends WidgetType {
  constructor(
    readonly range: BlockRange,
    readonly labels: EditorLabels,
  ) {
    super();
  }

  eq(other: TempoBlockWidget): boolean {
    return other.range.segment.source === this.range.segment.source && other.labels === this.labels;
  }

  get estimatedHeight(): number {
    return this.range.segment.kind === "valid" && this.range.segment.block.type === "page-meta" ? 0 : 56;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const { segment } = this.range;
    // Set below to the card's root; handlers only run after toDOM returns.
    let root: HTMLElement | null = null;
    const resolve = () => (root ? findBlock(view, root, this.range) : undefined);
    const remove = () => {
      const r = resolve();
      if (!r) return;
      view.dispatch({ changes: { from: r.from, to: r.to }, annotations: blockEdit.of(true), userEvent: "delete.block" });
      view.focus();
    };
    if (segment.kind === "broken") {
      const button = el("button", { type: "button", class: "tp-btn tp-btn--ghost tp-btn--sm tp-block-broken__action" }, [
        this.labels.removeBlock,
      ]);
      button.addEventListener("click", remove);
      root = el("div", { class: "cm-tp-block tp-block-broken", "data-component": "BrokenBlock", role: "note" }, [
        icon("alert", "sm"),
        el("span", { class: "tp-block-broken__text" }, [this.labels.brokenBlock]),
        button,
      ]);
      return root;
    }
    const block: TempoBlock = segment.block;
    if (block.type === "page-meta") {
      // PageMetaBlock renders nothing (components.md). The page header shows tags instead.
      return el("div", { class: "cm-tp-block cm-tp-meta", "aria-hidden": "true", "data-component": "PageMetaBlock" });
    }
    if (block.type === "template") {
      return el("div", { class: "cm-tp-block tp-card", "data-component": "TemplateBlock" }, [
        el("div", { class: "tp-card__head" }, [
          icon("template", "sm"),
          el("span", { class: "tp-card__title", dir: "auto" }, [`${this.labels.template} · ${block.data.name}`]),
        ]),
      ]);
    }
    const done = block.data.status === "done";
    const check = el(
      "button",
      { type: "button", class: "tp-check", role: "checkbox", "aria-checked": String(done), "aria-label": block.data.title },
      [el("span", { class: "tp-check__box" }, [icon("check")])],
    );
    check.addEventListener("click", () => {
      const r = resolve();
      if (!r) return;
      const body = view.state.doc.toString();
      const next = setTaskDone(body, r, !done);
      if (next === body) return;
      const insert = next.slice(r.from, next.length - (body.length - r.to));
      view.dispatch({ changes: { from: r.from, to: r.to, insert }, annotations: blockEdit.of(true), userEvent: "input.block" });
    });
    // The title is a field: Enter or leaving it saves (only this fence changes), Esc undoes.
    const title = el("input", {
      class: "tp-task-row__title cm-tp-title",
      dir: "auto",
      "aria-label": this.labels.taskTitle,
      maxlength: "500",
    });
    title.value = block.data.title;
    const commitTitle = () => {
      const r = resolve();
      if (!r) return;
      const body = view.state.doc.toString();
      const next = setTaskTitle(body, r, title.value);
      if (next === body) {
        title.value = block.data.title;
        return;
      }
      const insert = next.slice(r.from, next.length - (body.length - r.to));
      view.dispatch({ changes: { from: r.from, to: r.to, insert }, annotations: blockEdit.of(true), userEvent: "input.block" });
    };
    title.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        title.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        title.value = block.data.title;
        title.blur();
        view.focus();
      }
    });
    title.addEventListener("blur", commitTitle);
    if (pendingTitleFocus === block.id) {
      pendingTitleFocus = null;
      window.requestAnimationFrame(() => {
        title.focus();
        title.select();
      });
    }
    const removeButton = el(
      "button",
      { type: "button", class: "tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon", "aria-label": this.labels.removeBlock },
      [icon("x", "sm")],
    );
    removeButton.addEventListener("click", remove);
    const meta = el("span", { class: "tp-task-row__meta" }, [
      el("span", {}, [el("span", { class: "tp-num" }, [String(block.data.durationMin)]), ` ${this.labels.minutes}`]),
    ]);
    root = el("div", { class: "cm-tp-block tp-block", "data-component": "TaskBlock" }, [
      el("ul", { class: "tp-block-task" }, [
        el("li", { class: "tp-task-row", "data-component": "TaskRow", "data-done": String(done) }, [
          check,
          el("div", { class: "tp-task-row__body" }, [
            title,
            meta,
          ]),
          removeButton,
        ]),
      ]),
    ]);
    return root;
  }
}

/* ------------------------------------------------------------------ */
/* GFM tables                                                           */
/* ------------------------------------------------------------------ */

/** Splits a GFM table row into cells. `\|` stays a literal pipe. */
export function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

class TableWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }
  eq(other: TableWidget): boolean {
    return other.source === this.source;
  }
  toDOM(): HTMLElement {
    const lines = this.source.split("\n").filter((l) => l.trim().length > 0);
    const head = tableCells(lines[0] ?? "");
    const aligns = tableCells(lines[1] ?? "").map((c) =>
      c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "end" : "start",
    );
    const table = el("table", { class: "cm-tp-table" });
    const thead = el("thead");
    const headRow = el("tr");
    head.forEach((cell, i) => {
      headRow.append(el("th", { dir: "auto", style: `text-align:${aligns[i] ?? "start"}` }, [cell]));
    });
    thead.append(headRow);
    const tbody = el("tbody");
    for (const line of lines.slice(2)) {
      const row = el("tr");
      tableCells(line).forEach((cell, i) => {
        row.append(el("td", { dir: "auto", style: `text-align:${aligns[i] ?? "start"}` }, [cell]));
      });
      tbody.append(row);
    }
    table.append(thead, tbody);
    return el("div", { class: "cm-tp-block cm-tp-tablewrap" }, [table]);
  }
}

/* ------------------------------------------------------------------ */
/* Block decorations (state field: block widgets may not come from a   */
/* view plugin)                                                         */
/* ------------------------------------------------------------------ */

type BlocksValue = { ranges: BlockRange[]; decos: DecorationSet; atomic: DecorationSet };

/** Lines the selection touches. On these lines the raw Markdown shows. */
function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n += 1) lines.add(n);
  }
  return lines;
}

let currentLabels: EditorLabels | null = null;

function computeBlocks(state: EditorState, labels: EditorLabels): BlocksValue {
  const body = state.doc.toString();
  const ranges = tempoBlockRanges(body);
  const decos: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  for (const range of ranges) {
    // An unclosed fence is someone typing a new fence: show it as text, never swallow the page.
    if (range.segment.kind === "broken" && range.segment.errorCode === "unclosed_fence") continue;
    const to = body[range.to - 1] === "\n" ? range.to - 1 : range.to;
    const widget = Decoration.replace({ widget: new TempoBlockWidget(range, labels), block: true });
    decos.push(widget.range(range.from, to));
    atomic.push(Decoration.mark({}).range(range.from, range.to));
  }
  const active = activeLineNumbers(state);
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== "Table") return;
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(node.to);
      for (let n = first.number; n <= last.number; n += 1) if (active.has(n)) return false;
      if (ranges.some((r) => node.from < r.to && node.to > r.from)) return false;
      decos.push(
        Decoration.replace({ widget: new TableWidget(state.doc.sliceString(first.from, last.to)), block: true }).range(
          first.from,
          last.to,
        ),
      );
      return false;
    },
  });
  return { ranges, decos: Decoration.set(decos, true), atomic: Decoration.set(atomic, true) };
}

export const tempoBlocksField = StateField.define<BlocksValue>({
  create(state) {
    return computeBlocks(state, currentLabels ?? DEFAULT_LABELS);
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
      return computeBlocks(tr.state, currentLabels ?? DEFAULT_LABELS);
    }
    return value;
  },
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.decos),
    EditorView.atomicRanges.of((view) => view.state.field(field).atomic),
  ],
});

const DEFAULT_LABELS: EditorLabels = {
  minutes: "min",
  removeBlock: "Remove",
  brokenBlock: "This part has a problem. The rest of your page is safe.",
  template: "Template",
  taskDone: "Done",
  taskTitle: "Task title",
};

/* ------------------------------------------------------------------ */
/* Boundary guard (PR #874 BD fixtures)                                 */
/* ------------------------------------------------------------------ */

function sameSegmentsKept(tr: Transaction): boolean {
  const before = tr.startState.field(tempoBlocksField).ranges.filter(
    (r) => !(r.segment.kind === "broken" && r.segment.errorCode === "unclosed_fence"),
  );
  if (before.length === 0) return true;
  const after = parseTempoBlocks(tr.newDoc.toString()).filter((s) => s.kind !== "markdown");
  for (const r of before) {
    let covered = false;
    tr.changes.iterChangedRanges((fromA, toA) => {
      if (fromA <= r.from && toA >= r.to) covered = true;
    });
    if (covered) continue; // removed or replaced as a whole: allowed
    const mapped = tr.changes.mapPos(r.from, 1);
    const kept = after.find((s) => s.start === mapped && s.source === r.segment.source && s.kind === r.segment.kind);
    if (!kept) return false;
  }
  return true;
}

/**
 * Typing right before a fence or right after a closer that has no line break would glue prose
 * onto the fence line and break the block (or swallow the text). Add the line break instead;
 * refuse any other change that would alter a block it does not replace whole.
 */
const boundaryGuard = EditorState.transactionFilter.of((tr): Transaction | TransactionSpec | readonly TransactionSpec[] => {
  if (!tr.docChanged || tr.annotation(blockEdit)) return tr;
  const ranges = tr.startState.field(tempoBlocksField).ranges;
  const body = tr.startState.doc;
  let single: { from: number; to: number; text: string } | null = null;
  let count = 0;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    count += 1;
    single = { from: fromA, to: toA, text: inserted.toString() };
  });
  if (count === 1 && single) {
    const { from, to, text } = single as { from: number; to: number; text: string };
    if (from === to && text.length > 0) {
      for (const r of ranges) {
        const endsWithBreak = body.sliceString(r.to - 1, r.to) === "\n";
        if (from === r.to && !endsWithBreak && !text.startsWith("\n")) {
          return { changes: { from, insert: `\n${text}` }, selection: EditorSelection.cursor(from + 1 + text.length), scrollIntoView: true };
        }
        if (from === r.from && !text.endsWith("\n")) {
          return { changes: { from, insert: `${text}\n` }, selection: EditorSelection.cursor(from + text.length), scrollIntoView: true };
        }
      }
    }
  }
  return sameSegmentsKept(tr) ? tr : [];
});

/* ------------------------------------------------------------------ */
/* Inline live preview (view plugin)                                    */
/* ------------------------------------------------------------------ */

const hide = Decoration.replace({});

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly at: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.at === this.at;
  }
  toDOM(view: EditorView): HTMLElement {
    const box = el("input", { type: "checkbox", class: "cm-tp-checkbox", "aria-label": "Done" });
    (box as HTMLInputElement).checked = this.checked;
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const marker = view.state.doc.sliceString(this.at, this.at + 3);
      if (!/^\[[ xX]\]$/.test(marker)) return;
      view.dispatch({ changes: { from: this.at + 1, to: this.at + 2, insert: this.checked ? " " : "x" }, userEvent: "input.check" });
    });
    return box;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

class BulletWidget extends WidgetType {
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    return el("span", { class: "cm-tp-bullet", "aria-hidden": "true" }, ["•"]);
  }
}

class RuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    return el("span", { class: "cm-tp-hr", role: "separator" });
  }
}

const WIKI_IN_LINE = /\[\[([^[\]\n|]{1,200})(?:\|([^[\]\n]{1,200}))?\]\]/g;
const TAG_IN_LINE = /(^|\s)(#[\p{L}\p{N}_-]{1,40})/gu;

function buildInline(view: EditorView): DecorationSet {
  const { state } = view;
  const active = activeLineNumbers(state);
  const blocks = state.field(tempoBlocksField).ranges;
  const inBlock = (pos: number) => blocks.some((r) => pos >= r.from && pos < r.to);
  const decos: Range<Decoration>[] = [];
  const tree = syntaxTree(state);
  const codeAt = (pos: number) => {
    let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, 1);
    while (node) {
      if (node.name === "InlineCode" || node.name === "FencedCode" || node.name === "CodeBlock") return true;
      node = node.parent;
    }
    return false;
  };

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (inBlock(node.from)) return false;
        const line = state.doc.lineAt(node.from);
        const isActive = active.has(line.number);
        const name = node.name;
        const heading = /^ATXHeading([1-6])$/.exec(name);
        if (heading) {
          decos.push(Decoration.line({ class: `cm-tp-h cm-tp-h${heading[1]}` }).range(line.from));
          return;
        }
        switch (name) {
          case "HeaderMark": {
            if (isActive) return;
            const end = state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            if (end > node.from) decos.push(hide.range(node.from, end));
            return;
          }
          case "Emphasis":
            decos.push(Decoration.mark({ class: "cm-tp-em" }).range(node.from, node.to));
            return;
          case "StrongEmphasis":
            decos.push(Decoration.mark({ class: "cm-tp-strong" }).range(node.from, node.to));
            return;
          case "Strikethrough":
            decos.push(Decoration.mark({ class: "cm-tp-strike" }).range(node.from, node.to));
            return;
          case "InlineCode":
            decos.push(Decoration.mark({ class: "cm-tp-code tp-mono" }).range(node.from, node.to));
            return;
          case "EmphasisMark":
          case "StrikethroughMark":
            if (!isActive) decos.push(hide.range(node.from, node.to));
            return;
          case "CodeMark":
            if (!isActive && node.node.parent?.name === "InlineCode") decos.push(hide.range(node.from, node.to));
            return;
          case "Link": {
            const marks: { from: number; to: number }[] = [];
            let url: { from: number; to: number } | null = null;
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
              do {
                if (cursor.name === "LinkMark") marks.push({ from: cursor.from, to: cursor.to });
                if (cursor.name === "URL") url = { from: cursor.from, to: cursor.to };
              } while (cursor.nextSibling());
            }
            if (marks.length >= 2) {
              const textFrom = marks[0]!.to;
              const textTo = marks[1]!.from;
              if (textTo > textFrom) decos.push(Decoration.mark({ class: "cm-tp-link" }).range(textFrom, textTo));
              if (!isActive) {
                decos.push(hide.range(marks[0]!.from, marks[0]!.to));
                decos.push(hide.range(marks[1]!.from, node.to));
              }
            } else if (url) {
              decos.push(Decoration.mark({ class: "cm-tp-link" }).range((url as { from: number }).from, (url as { to: number }).to));
            }
            return false;
          }
          case "Blockquote": {
            const first = state.doc.lineAt(node.from).number;
            const last = state.doc.lineAt(node.to).number;
            for (let n = first; n <= last; n += 1) {
              decos.push(Decoration.line({ class: "cm-tp-quote" }).range(state.doc.line(n).from));
            }
            return;
          }
          case "QuoteMark": {
            if (isActive) return;
            const end = state.doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
            decos.push(hide.range(node.from, end));
            return;
          }
          case "ListMark": {
            if (isActive) return;
            const marker = state.doc.sliceString(node.from, node.to);
            const after = state.doc.sliceString(node.to, node.to + 4);
            if (/^ \[[ xX]\]/.test(after)) return; // the task marker draws the checkbox
            if (/^[-*+]$/.test(marker)) decos.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to));
            return;
          }
          case "TaskMarker": {
            const marker = state.doc.sliceString(node.from, node.to);
            const checked = /x/i.test(marker);
            if (checked) {
              const lineEnd = line.to;
              if (node.to < lineEnd) decos.push(Decoration.mark({ class: "cm-tp-done" }).range(node.to, lineEnd));
            }
            if (isActive) return;
            // Hide "- " before the marker so only the checkbox shows.
            const listStart = state.doc.sliceString(line.from, node.from);
            const markFrom = line.from + listStart.search(/[-*+]\s+$/);
            const replaceFrom = markFrom >= line.from && markFrom < node.from ? markFrom : node.from;
            decos.push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(replaceFrom, node.to));
            return;
          }
          case "HorizontalRule":
            if (!isActive) decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to));
            return;
          case "FencedCode": {
            const first = state.doc.lineAt(node.from).number;
            const last = state.doc.lineAt(node.to).number;
            for (let n = first; n <= last; n += 1) {
              decos.push(Decoration.line({ class: "cm-tp-codeblock" }).range(state.doc.line(n).from));
            }
            return false;
          }
          default:
            return;
        }
      },
    });

    // [[links]] and #tags are not part of the Markdown grammar: find them per visible line.
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);
      const isActive = active.has(line.number);
      if (!inBlock(line.from)) {
        WIKI_IN_LINE.lastIndex = 0;
        for (let m = WIKI_IN_LINE.exec(line.text); m !== null; m = WIKI_IN_LINE.exec(line.text)) {
          const start = line.from + m.index;
          const end = start + m[0].length;
          if (codeAt(start)) continue;
          const title = m[1]!.trim();
          if (isActive) {
            decos.push(Decoration.mark({ class: "cm-tp-wikilink-raw" }).range(start, end));
            continue;
          }
          const shownFrom = m[2] ? start + 2 + m[1]!.length + 1 : start + 2;
          const shownTo = end - 2;
          decos.push(hide.range(start, shownFrom));
          decos.push(
            Decoration.mark({
              class: "cm-tp-wikilink",
              attributes: { "data-title": title, role: "link", title },
            }).range(shownFrom, shownTo),
          );
          decos.push(hide.range(shownTo, end));
        }
        TAG_IN_LINE.lastIndex = 0;
        for (let m = TAG_IN_LINE.exec(line.text); m !== null; m = TAG_IN_LINE.exec(line.text)) {
          const start = line.from + m.index + m[1]!.length;
          if (codeAt(start)) continue;
          if (line.text.startsWith("#") && m.index === 0 && /^#{1,6}\s/.test(line.text)) continue;
          decos.push(Decoration.mark({ class: "cm-tp-tag" }).range(start, start + m[2]!.length));
        }
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(decos, true);
}

const inlinePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildInline(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = buildInline(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/* ------------------------------------------------------------------ */
/* Theme: tokens only                                                   */
/* ------------------------------------------------------------------ */

const tempoTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "var(--tp-ink)", fontSize: "var(--tp-text-md)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--tp-font-sans)", lineHeight: "var(--tp-leading-body)", overflow: "visible" },
  ".cm-content": { padding: "0", caretColor: "var(--tp-ink)", maxWidth: "var(--tp-measure)", whiteSpace: "pre-wrap" },
  ".cm-line": { padding: "2px 0" },
  ".cm-cursor": { borderInlineStartColor: "var(--tp-ink)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--tp-accent-wash)" },
  ".cm-placeholder": { color: "var(--tp-ink-subtle)" },
  ".cm-tp-h": { fontFamily: "var(--tp-font-serif)", fontWeight: "500", lineHeight: "var(--tp-leading-heading)" },
  ".cm-tp-h1": { fontSize: "var(--tp-text-2xl)", paddingTop: "var(--tp-space-4)" },
  ".cm-tp-h2": { fontSize: "var(--tp-text-xl)", paddingTop: "var(--tp-space-4)" },
  ".cm-tp-h3": { fontSize: "var(--tp-text-lg)", paddingTop: "var(--tp-space-3)" },
  ".cm-tp-h4, .cm-tp-h5, .cm-tp-h6": { fontSize: "var(--tp-text-md)", fontWeight: "600" },
  ".cm-tp-em": { fontStyle: "italic" },
  ".cm-tp-strong": { fontWeight: "700" },
  ".cm-tp-strike, .cm-tp-done": { textDecoration: "line-through", color: "var(--tp-ink-muted)" },
  ".cm-tp-code": {
    direction: "ltr",
    unicodeBidi: "isolate",
    background: "var(--tp-sunken)",
    borderRadius: "var(--tp-radius-sm)",
    padding: "0 4px",
  },
  ".cm-tp-codeblock": {
    fontFamily: "var(--tp-font-mono)",
    fontSize: "0.9em",
    direction: "ltr",
    unicodeBidi: "isolate",
    background: "var(--tp-sunken)",
    paddingInline: "var(--tp-space-3)",
  },
  ".cm-tp-quote": {
    borderInlineStart: "3px solid var(--tp-line-strong)",
    paddingInlineStart: "var(--tp-space-3)",
    color: "var(--tp-ink-muted)",
  },
  ".cm-tp-link": { color: "var(--tp-ink)", textDecoration: "underline", textDecorationColor: "var(--tp-line-strong)" },
  ".cm-tp-wikilink": {
    color: "var(--tp-ink)",
    textDecoration: "underline",
    textDecorationColor: "var(--tp-accent)",
    textUnderlineOffset: "3px",
    cursor: "pointer",
  },
  ".cm-tp-wikilink-raw": { color: "var(--tp-ink-muted)" },
  ".cm-tp-tag": {
    color: "var(--tp-ink-muted)",
    background: "var(--tp-sunken)",
    borderRadius: "var(--tp-radius-pill)",
    padding: "0 6px",
    fontSize: "var(--tp-text-sm)",
  },
  ".cm-tp-bullet": { display: "inline-block", width: "1.1em", color: "var(--tp-ink-muted)" },
  ".cm-tp-checkbox": {
    width: "18px",
    height: "18px",
    margin: "0 6px 0 0",
    verticalAlign: "-3px",
    accentColor: "var(--tp-done)",
    cursor: "pointer",
  },
  ".cm-tp-hr": { display: "inline-block", width: "100%", borderTop: "1px solid var(--tp-line)", verticalAlign: "middle" },
  ".cm-tp-block": { margin: "var(--tp-space-2) 0" },
  // A task card's title is a field that reads as plain text until it is focused.
  ".cm-tp-title": {
    font: "inherit",
    color: "inherit",
    background: "transparent",
    border: "0",
    padding: "0",
    width: "100%",
    minWidth: "0",
    borderRadius: "var(--tp-radius-sm)",
  },
  ".cm-tp-title:focus-visible": { outline: "2px solid var(--tp-accent)", outlineOffset: "2px" },
  "[data-done='true'] .cm-tp-title": { textDecoration: "line-through", color: "var(--tp-ink-muted)" },
  ".cm-tp-meta": { margin: "0", height: "0", overflow: "hidden" },
  ".cm-tp-tablewrap": { overflowX: "auto" },
  ".cm-tp-table": { borderCollapse: "collapse", width: "100%", fontSize: "var(--tp-text-sm)" },
  ".cm-tp-table th, .cm-tp-table td": { border: "1px solid var(--tp-line)", padding: "var(--tp-space-1) var(--tp-space-2)" },
  ".cm-tp-table th": { background: "var(--tp-sunken)", fontWeight: "600" },
});

/** The copied text with every closed `json tempo` fence removed. */
export function withoutTempoBlocks(text: string): string {
  return parseTempoBlocks(text)
    .filter((s) => s.kind === "markdown" || (s.kind === "broken" && s.errorCode === "unclosed_fence"))
    .map((s) => s.source)
    .join("");
}

/* ------------------------------------------------------------------ */
/* Public extension                                                     */
/* ------------------------------------------------------------------ */

export type LivePreviewOptions = {
  labels: EditorLabels;
  onOpenLink?: (title: string) => void;
};

/** Everything the page editor needs on top of Markdown, history and keymaps. */
export function livePreview(options: LivePreviewOptions): Extension {
  currentLabels = options.labels;
  return [
    EditorState.lineSeparator.of(LINE_SEPARATOR),
    EditorView.lineWrapping,
    EditorView.perLineTextDirection.of(true),
    tempoBlocksField,
    boundaryGuard,
    inlinePreview,
    tempoTheme,
    // Copy gives Markdown: a Tempo block inside the selection adds nothing to the clipboard,
    // so its JSON never leaves the page this way (contract ED-07, B-07). A fence the user is
    // still typing (unclosed) is ordinary text and is kept.
    EditorView.clipboardOutputFilter.of((text) => withoutTempoBlocks(text)),
    EditorView.domEventHandlers({
      mousedown(event) {
        const target = event.target as HTMLElement | null;
        const link = target?.closest?.(".cm-tp-wikilink[data-title]") as HTMLElement | null;
        if (link && options.onOpenLink && !event.shiftKey) {
          event.preventDefault();
          options.onOpenLink(link.dataset.title ?? "");
          return true;
        }
        return false;
      },
    }),
  ];
}
