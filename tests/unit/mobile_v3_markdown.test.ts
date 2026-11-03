import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "@tempo/utils";
import {
  isBlankBody,
  keepPageMeta,
  maskTempoBlocks,
  pageTags,
  parseInline,
  parseMarkdownView,
  splitTempoFences,
  toggleCheckbox,
  unmaskTempoBlocks,
} from "../../apps/mobile/lib/v3/markdown";

const META = '```json tempo\n{"id":"blk_01JABCDEFGHJKMNPQRSTVWXYZ0","v":1,"type":"page-meta","data":{"pageType":"plain","tags":["moving","work"]}}\n```\n';
const TASK = '```json tempo\n{"id":"blk_01JABCDEFGHJKMNPQRSTVWXYZ1","v":1,"type":"task","data":{"title":"Call the bank","durationMin":10,"status":"later","order":0,"inelastic":false}}\n```\n';
const DONE = '```json tempo\n{"id":"blk_01JABCDEFGHJKMNPQRSTVWXYZ2","v":1,"type":"task","data":{"title":"להשקות עציצים","durationMin":5,"status":"done","order":1,"inelastic":false}}\n```\n';

/** Every block type the mobile view knows, Hebrew and English mixed, a GFM table and a code fence. */
const FIXTURE = [
  META,
  "# Moving checklist\n",
  "\n",
  "Some **bold** words and a [[Lease questions]] link.\n",
  "פסקה בעברית עם מילה ב-English באמצע.\n",
  "\n",
  "- [ ] Book the van\n",
  "- [x] Pack the kitchen\n",
  "  - nested bullet\n",
  "1. first\n",
  "\n",
  TASK,
  "> a quiet quote\n",
  "\n",
  "| Room | Boxes |\n",
  "| --- | --- |\n",
  "| Kitchen | 4 |\n",
  "\n",
  "```\n",
  "```json tempo\n",
  "not a block: inside an ordinary fence\n",
  "```\n",
  "\n",
  DONE,
  "---\n",
  "Last line without a newline",
].join("");

describe("splitTempoFences", () => {
  test("joining the segments gives the body back exactly", () => {
    expect(
      splitTempoFences(FIXTURE)
        .map((s) => s.source)
        .join(""),
    ).toBe(FIXTURE);
  });

  test("finds the same Tempo blocks as the shared codec", () => {
    const mine = splitTempoFences(FIXTURE)
      .filter((s) => s.kind === "tempo")
      .map((s) => s.source);
    const codec = parseTempoBlocks(FIXTURE)
      .filter((s) => s.kind !== "markdown")
      .map((s) => s.source);
    expect(mine).toEqual(codec);
    expect(mine).toHaveLength(3);
  });

  test("reads block details without showing JSON", () => {
    const infos = splitTempoFences(FIXTURE).flatMap((s) => (s.kind === "tempo" ? [s.info] : []));
    expect(infos).toEqual([
      { type: "page-meta", tags: ["moving", "work"] },
      { type: "task", title: "Call the bank", done: false },
      { type: "task", title: "להשקות עציצים", done: true },
    ]);
  });

  test("an unclosed tempo fence stays prose", () => {
    const body = "intro\n```json tempo\n{\"a\":1}\n";
    expect(splitTempoFences(body)).toEqual([{ kind: "text", source: body }]);
  });

  test("a broken block is unknown, never raw text", () => {
    const body = "```json tempo\n{not json\n```\n";
    expect(splitTempoFences(body)).toEqual([{ kind: "tempo", source: body, info: { type: "unknown" } }]);
  });
});

describe("mask / unmask for the plain-text editor", () => {
  const label = (info: { type: string }) => (info.type === "task" ? "Task" : info.type === "page-meta" ? "Page details" : "");

  test("an untouched text round-trips byte for byte", () => {
    const { text, fences } = maskTempoBlocks(FIXTURE, label);
    expect(text).not.toContain('"type"');
    expect(text).not.toContain("blk_");
    expect(text).toContain("⟦1 · Page details⟧\n");
    expect(text).toContain("⟦2 · Task⟧\n");
    expect(unmaskTempoBlocks(text, fences)).toBe(FIXTURE);
  });

  test("editing prose keeps every block exactly", () => {
    const { text, fences } = maskTempoBlocks(FIXTURE, label);
    const edited = text.replace("Book the van", "Book the big van");
    const body = unmaskTempoBlocks(edited, fences);
    expect(body).toBe(FIXTURE.replace("Book the van", "Book the big van"));
    expect(parseTempoBlocks(body).filter((s) => s.kind === "valid")).toHaveLength(3);
  });

  test("a renamed placeholder still maps back by its number; a removed one removes its block", () => {
    const { text, fences } = maskTempoBlocks(FIXTURE, label);
    const renamed = text.replace("⟦2 · Task⟧", "⟦2 whatever⟧");
    expect(unmaskTempoBlocks(renamed, fences)).toBe(FIXTURE);
    const removed = text.replace("⟦2 · Task⟧\n", "");
    expect(unmaskTempoBlocks(removed, fences)).toBe(FIXTURE.replace(TASK, ""));
  });

  test("page details can't be deleted: a removed or replaced page-meta placeholder comes back on top", () => {
    const { text, fences } = maskTempoBlocks(FIXTURE, label);
    const removed = unmaskTempoBlocks(text.replace("⟦1 · Page details⟧\n", ""), fences);
    expect(removed.startsWith(META)).toBe(false);
    expect(keepPageMeta(removed, FIXTURE)).toBe(FIXTURE);
    expect(keepPageMeta(unmaskTempoBlocks("all new words\n", fences), FIXTURE)).toBe(`${META}all new words\n`);
    // Kept where it is when it is still there; a body without page details stays as it is.
    expect(keepPageMeta(FIXTURE, FIXTURE)).toBe(FIXTURE);
    expect(keepPageMeta("plain\n", "plain before\n")).toBe("plain\n");
  });

  test("CRLF bodies keep their line endings", () => {
    const body = `intro\r\n${TASK.replace(/\n/g, "\r\n")}outro\r\n`;
    const { text, fences } = maskTempoBlocks(body, label);
    expect(text).toBe("intro\r\n⟦1 · Task⟧\r\noutro\r\n");
    expect(unmaskTempoBlocks(text, fences)).toBe(body);
  });
});

describe("read view", () => {
  test("headings, paragraphs, checkboxes, lists, quotes, code, tables and blocks", () => {
    const kinds = parseMarkdownView(FIXTURE).map((b) => b.kind);
    expect(kinds).toEqual([
      "heading",
      "paragraph",
      "check",
      "check",
      "bullet",
      "bullet",
      "tempo",
      "quote",
      "code",
      "code",
      "tempo",
      "rule",
      "paragraph",
    ]);
  });

  test("page-meta renders nothing; code fences keep tempo-looking lines as code", () => {
    const blocks = parseMarkdownView(FIXTURE);
    expect(blocks.some((b) => b.kind === "tempo" && b.info.type === "page-meta")).toBe(false);
    const code = blocks.filter((b) => b.kind === "code").map((b) => (b.kind === "code" ? b.text : ""));
    expect(code[1]).toContain("```json tempo");
  });

  test("checkbox lines point at their line in the body", () => {
    const checks = parseMarkdownView(FIXTURE).filter((b) => b.kind === "check");
    const lines = FIXTURE.split("\n");
    for (const c of checks) {
      if (c.kind !== "check") continue;
      expect(lines[c.line]).toMatch(/^- \[( |x)\]/);
    }
  });

  test("inline marks", () => {
    expect(parseInline("a **b** `c` [[Page|Shown]] [site](https://x) *e*")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", code: true },
      { text: " " },
      { text: "Shown", link: true },
      { text: " " },
      { text: "site", link: true },
      { text: " " },
      { text: "e", italic: true },
    ]);
  });
});

describe("toggleCheckbox", () => {
  test("only that one character changes", () => {
    const checks = parseMarkdownView(FIXTURE).filter((b) => b.kind === "check");
    const first = checks[0];
    if (first?.kind !== "check") throw new Error("no checkbox");
    const once = toggleCheckbox(FIXTURE, first.line);
    expect(once).toBe(FIXTURE.replace("- [ ] Book the van", "- [x] Book the van"));
    expect(toggleCheckbox(once, first.line)).toBe(FIXTURE);
  });

  test("a line that is not a checkbox leaves the body as it was", () => {
    expect(toggleCheckbox(FIXTURE, 0)).toBe(FIXTURE);
    expect(toggleCheckbox(FIXTURE, 999)).toBe(FIXTURE);
  });

  test("CRLF endings survive", () => {
    const body = "- [ ] a\r\n- [ ] b\r\n";
    expect(toggleCheckbox(body, 1)).toBe("- [ ] a\r\n- [x] b\r\n");
  });
});

describe("page details", () => {
  test("tags come from the page-meta block", () => {
    expect(pageTags(FIXTURE)).toEqual(["moving", "work"]);
    expect(pageTags("# no meta")).toEqual([]);
  });

  test("a body with only page details is blank", () => {
    expect(isBlankBody(`${META}\n`)).toBe(true);
    expect(isBlankBody("")).toBe(true);
    expect(isBlankBody(FIXTURE)).toBe(false);
  });
});
